#!/usr/bin/env python3
"""
omni-unified-v1 — the in-house unified isolation + denoise + normalize model.

ONE model, three jobs at once:
  1. ISOLATION  — spectral mask head extracts the voice out of
                  voice + music-bed + noise mixes (trained with ground-truth
                  clean components, no distillation).
  2. DENOISE   — the same mask suppresses additive noise (white / pink /
                  hum) at any SNR; the clean voice IS the target, so the
                  mask learns to strip everything that is not the voice.
  3. NORMALIZE — a loudness head predicts, from the same encoder states,
                  the gain that lands the isolated voice at -18 dBFS RMS
                  (the app's finalizeIsolationOutput target), clamped to
                  +-12 dB like the DSP finalizer's gain window.

Training is fully on-the-fly: every step samples a fresh deterministic mix
(voice fixture x music bed x noise type x random SNRs/gains/EQ), so the
corpus is effectively infinite and exactly reproducible. Checkpoints
resume mid-run; the step budget is 1,000,000+ optimizer updates
(RUNS.md documents the exact count reached).

Domain (matches the existing omni-denoise infra, src/lib/aiDenoise.ts):
  16 kHz mono, STFT n_fft 512 / hop 128 / hann / centered, rfft layout
  (257 bins), log10(|S| + 1e-4) with per-frame normalization (MU/STD).

Graph input: raw normalized frames [batch, time, 257]; the 3-frame
context stack is built inside the graph (UnifiedNet.forward).
Outputs: mask (257, sigmoid) + loudness gain log-scale scalar.

Run:
  python3 scripts/python/train_unified.py --steps 1000000 \
      --assets qa/assets/voice --out public/models/omni-unified-v1.onnx
"""

import argparse
import json
import math
import os
import sys
import wave
from pathlib import Path

import numpy as np

try:
    import torch
    import torch.nn as nn
except ImportError:
    print("torch missing: pip install --user --break-system-packages torch", file=sys.stderr)
    sys.exit(1)

SR = 16000
NFFT = 512
HOP = 128
BINS = NFFT // 2 + 1  # 257
EPS = 1e-4

# per-frame log-magnitude normalization (same transform family as
# src/lib/aiDenoise.ts; values measured on the training corpus — see
# --recalibrate which prints them; the committed values are what the
# trained weights expect).
MU = -0.3685   # measured on this corpus (--recalibrate)
STD = 0.7878

GAIN_TARGET_DBFS = -18.0   # RMS target of the isolated voice
GAIN_WINDOW_DB = 12.0      # +- clamp, same as the DSP finalizer


# ---------------------------------------------------------------------------
# model
# ---------------------------------------------------------------------------
class UnifiedNet(nn.Module):
    """Encoder GRU -> (mask head, loudness head). Default ~0.68M params
    (hidden 224, 1 GRU layer, 5-frame context) — sized for this 2-core
    training sandbox: ~17 steps/s at batch 16 x 0.5 s snippets, so 1M
    optimizer updates is reachable in ~16 h of checkpointed background
    training. (Run-5 sizing: hidden 192/ctx 3 plateaued on the harmonic
    beds — arp-synth +2.9 dB, pad-chords +3.6 dB at 30k steps while
    percussive reached +9.)"""

    CTX = 5  # stacked frames of context

    def __init__(self, hidden=224, layers=1):
        super().__init__()
        self.hidden = hidden
        self.enc = nn.Linear(BINS * self.CTX, hidden)
        self.gru = nn.GRU(hidden, hidden, num_layers=layers, batch_first=True)
        self.mask_head = nn.Linear(hidden, BINS)
        # loudness head: global mean-pooled states -> gain (offline model,
        # sees the whole clip; mirrors the finalizer's whole-buffer RMS)
        self.gain_fc1 = nn.Linear(hidden, 32)
        self.gain_fc2 = nn.Linear(32, 1)

    def forward(self, x):
        # x: [B, T, 257] normalized log-mags -> context stack [B, T, 771]
        B, T, _ = x.shape
        pad = torch.zeros(B, self.CTX - 1, BINS, device=x.device, dtype=x.dtype)
        xp = torch.cat([pad, x], dim=1)            # [B, T+2, 257]
        frames = torch.stack(
            [xp[:, i:i + T, :] for i in range(self.CTX)], dim=2
        ).reshape(B, T, BINS * self.CTX)
        h = torch.relu(self.enc(frames))
        h, _ = self.gru(h)                          # [B, T, hidden]
        mask = torch.sigmoid(self.mask_head(h))     # [B, T, 257]
        pooled = h.mean(dim=1)                      # [B, hidden]
        g = torch.sigmoid(self.gain_fc2(torch.relu(self.gain_fc1(pooled))))  # [B, 1]
        # gain in dB: sigmoid(0..1) -> (-12, +12)
        gain_db = (g * 2.0 - 1.0) * GAIN_WINDOW_DB
        return mask, gain_db


# ---------------------------------------------------------------------------
# corpus: fixtures decoded to float arrays
# ---------------------------------------------------------------------------
def load_wav_mono(path, target_sr=SR):
    """Read a 16-bit PCM wav as mono float32 RESAMPLED to target_sr.

    The music beds are 44.1 kHz stereo — reading them raw (the original
    bug) fed the model beds pitch-shifted ~3x down: 64k samples of 44.1k
    audio treated as 4 s at 16 kHz. Chrome decodes at true pitch, so the
    model had never heard a real-pitch bed and failed in-browser
    (measured +11 dB on corpus-style mixes, +0.0 dB on true-pitch beds).
    """
    with wave.open(str(path), 'rb') as w:
        sr = w.getframerate()
        assert w.getnchannels() in (1, 2), f"{path}: channels {w.getnchannels()}"
        assert w.getsampwidth() == 2, f"{path}: sampwidth {w.getsampwidth()}"
        raw = w.readframes(w.getnframes())
        x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
        if w.getnchannels() == 2:
            x = 0.5 * (x[0::2] + x[1::2])
    if sr == target_sr:
        return x
    # bandlimited polyphase-free resample: rfft, cut above new Nyquist, irfft
    n_in = len(x)
    n_out = int(round(n_in * target_sr / sr))
    X = np.fft.rfft(x)
    k_keep = int(np.floor(n_out / 2))
    X = X[:k_keep + 1]
    if len(X) < n_out // 2 + 1:
        X = np.pad(X, (0, n_out // 2 + 1 - len(X)))
    y = np.fft.irfft(X, n_out)
    # amplitude correction: irfft sums n_out harmonics of a spectrum whose
    # scale matches n_in-sample rfft -> scale by n_out/n_in to keep RMS
    return (y * (n_out / n_in)).astype(np.float32)


class Corpus:
    """Voice fixtures + music beds + synthetic noise generators."""

    def __init__(self, assets_dir):
        assets = Path(assets_dir)
        self.voices = [load_wav_mono(p) for p in sorted(assets.glob('tts-*.wav'))]
        self.beds = [load_wav_mono(p) for p in sorted(assets.glob('*.wav'))
                     if not p.name.startswith('tts-')]
        if not self.voices:
            raise SystemExit(f'no tts-*.wav voice fixtures under {assets_dir} '
                             '(decode the mp3s first — see scripts/python/decode_voice_fixtures.mjs)')
        if not self.beds:
            raise SystemExit(f'no music-bed wavs under {assets_dir}')
        self.min_voice = min(len(v) for v in self.voices)
        self.min_bed = min(len(b) for b in self.beds)
        print(f'corpus: {len(self.voices)} voices (min {self.min_voice/SR:.1f}s), '
              f'{len(self.beds)} beds (min {self.min_bed/SR:.1f}s)')

    def crop(self, x, n, rng):
        if len(x) <= n:
            return x
        i = rng.integers(0, len(x) - n)
        return x[i:i + n]


def js_hann(n):
    """EXACT copy of the JS runner's hann window
    (src/lib/aiDenoise.ts): 0.5*(1 - cos(2*pi*(i+1)/(n+1)))."""
    i = torch.arange(n, dtype=torch.float32)
    return 0.5 * (1 - torch.cos(2 * math.pi * (i + 1) / (n + 1)))


def stft_mag(x, window=None):
    """torch rfft magnitude, numpy-compatible layout, matching the JS runner."""
    if window is None:
        window = js_hann(NFFT)
    S = torch.stft(x, NFFT, HOP, window=window, center=True, return_complex=True)
    return S.abs()  # [B, bins, T]


def normalize_frames(mag):
    """log10 + (x - MU)/STD per frame — identical transform in the JS runner."""
    return (torch.log10(mag + EPS) - MU) / STD


def gain_target_db(clean_voice):
    """Finalizer-equivalent gain for the clean voice, +-12 dB window."""
    rms = float(torch.sqrt(torch.mean(clean_voice ** 2) + 1e-12))
    if rms < 10 ** (-50 / 20):     # near-silence skip (finalizer parity)
        return 0.0
    target = 10 ** (GAIN_TARGET_DBFS / 20)
    db = 20 * math.log10(target / max(rms, 1e-9))
    return max(-GAIN_WINDOW_DB, min(GAIN_WINDOW_DB, db))


# ---------------------------------------------------------------------------
# training step: deterministic on-the-fly mix
# ---------------------------------------------------------------------------
def make_mix(corpus, batch, seg_samples, rng, device):
    """Returns mix [B,N], clean voice [B,N], gain targets [B]."""
    voices = np.zeros((batch, seg_samples), dtype=np.float32)
    mixes = np.zeros((batch, seg_samples), dtype=np.float32)
    gains = np.zeros(batch, dtype=np.float32)
    n = seg_samples
    for b in range(batch):
        v = corpus.crop(corpus.voices[rng.integers(0, len(corpus.voices))], n, rng)
        m = corpus.crop(corpus.beds[rng.integers(0, len(corpus.beds))], n, rng)
        # bed augmentation (run 4): the harmonic beds (pad-chords, arp-synth)
        # are the hard interference — measured +2.5/+3.1 dB SI-SNR at 0 dB
        # vs +8.2/+8.8 for percussive/full-band at 20k steps. Random
        # pitch/speed resampling (FFT-domain, bandlimited) multiplies the
        # effective harmonic-interference variety; random reversal decorates
        # the envelope. The VOICE is never augmented (it is the target).
        if rng.random() < 0.8:
            factor = float(rng.uniform(0.72, 1.4))
            n_out = max(n, int(round(len(m) / factor)))
            M = np.fft.rfft(m)
            k = min(len(M), n_out // 2 + 1)
            Mr = M[:k]
            if len(Mr) < n_out // 2 + 1:
                Mr = np.pad(Mr, (0, n_out // 2 + 1 - len(Mr)))
            m = (np.fft.irfft(Mr, n_out) * (n_out / len(m))).astype(np.float32)
            m = m[:n] if len(m) >= n else np.pad(m, (0, n - len(m)))
        if rng.random() < 0.5:
            m = m[::-1].copy()
        # voice at a healthy level, music at -5..+15 dB relative SNR
        v_rms = np.sqrt(np.mean(v ** 2) + 1e-12)
        m_rms = np.sqrt(np.mean(m ** 2) + 1e-12)
        v_gain = 10 ** (rng.uniform(-14, -4) / 20) / max(v_rms, 1e-9)
        snr_db = rng.uniform(-5, 15)
        m_gain = v_gain * v_rms * 10 ** (-snr_db / 20) / max(m_rms, 1e-9)
        # noise: white / pink / hum at 0..30 dB SNR vs the voice
        noise_type = rng.integers(0, 3)
        noise = np.zeros(n, dtype=np.float32)
        if noise_type == 0:      # white
            noise = rng.standard_normal(n).astype(np.float32)
        elif noise_type == 1:    # pink (1/sqrt(f) tilt via cumulative filter)
            w = rng.standard_normal(n).astype(np.float32)
            pink = np.cumsum(w)
            pink -= np.linspace(pink[0], pink[-1], n)  # detrend
            noise = (pink / (np.sqrt(np.mean(pink ** 2)) + 1e-9)).astype(np.float32)
        else:                    # hum: 50 Hz + harmonics + light hiss
            t = np.arange(n, dtype=np.float32) / SR
            for h in range(1, 7):
                noise += (1.0 / h) * np.sin(2 * np.pi * 50 * h * t + rng.uniform(0, 6.28))
            noise = noise / (np.sqrt(np.mean(noise ** 2)) + 1e-9)
            noise += 0.05 * rng.standard_normal(n).astype(np.float32)
        n_snr = rng.uniform(0, 30)
        n_gain = v_gain * v_rms * 10 ** (-n_snr / 20)
        voice = v * v_gain
        mixes[b] = voice + m * m_gain + noise * n_gain
        voices[b] = voice
        gains[b] = gain_target_db(torch.from_numpy(voice))
    return (torch.from_numpy(mixes).to(device),
            torch.from_numpy(voices).to(device),
            torch.from_numpy(gains).to(device))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--assets', default='qa/assets/voice')
    ap.add_argument('--out', default='public/models/omni-unified-v1.onnx')
    ap.add_argument('--ckpt', default='tmp/omni-unified/ckpt.pt')
    ap.add_argument('--steps', type=int, default=1_000_000)
    ap.add_argument('--batch', type=int, default=16)
    ap.add_argument('--seg-s', type=float, default=0.5)
    ap.add_argument('--lr', type=float, default=3e-4)
    ap.add_argument('--save-every', type=int, default=10_000)
    ap.add_argument('--log-every', type=int, default=1000)
    ap.add_argument('--threads', type=int, default=2)
    ap.add_argument('--export-only', action='store_true',
                    help='load the checkpoint and export ONNX without training')
    ap.add_argument('--smoke', action='store_true', help='tiny run to validate the loop + export')
    ap.add_argument('--recalibrate', action='store_true', help='print corpus MU/STD and exit')
    args = ap.parse_args()

    if args.smoke:
        args.steps = min(args.steps, 1200)
        args.log_every = 200
        args.save_every = 600

    torch.manual_seed(20261007)
    device = 'cpu'
    torch.set_num_threads(args.threads)

    corpus = Corpus(args.assets)
    seg = int(args.seg_s * SR)
    model = UnifiedNet().to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f'model params: {n_params:,}')

    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    start_step = 0
    best = float('inf')

    Path(args.ckpt).parent.mkdir(parents=True, exist_ok=True)
    model_only = Path(args.ckpt).with_name('model-only.pt')
    if Path(args.ckpt).exists() and not args.smoke:
        ck = torch.load(args.ckpt, map_location=device, weights_only=False)
        model.load_state_dict(ck['model'])
        opt.load_state_dict(ck['opt'])
        start_step = ck['step']
        best = ck.get('best', float('inf'))
        print(f'resumed at step {start_step:,} (best {best:.4f})')
    elif model_only.exists() and not args.smoke:
        # sandbox resets wipe gitignored files; the model-only snapshot is
        # small enough to COMMIT, so it survives — resume weights exactly,
        # optimizer state cold (small, quickly-recovered bump)
        ck = torch.load(model_only, map_location=device, weights_only=False)
        model.load_state_dict(ck['model'])
        start_step = ck['step']
        print(f'resumed MODEL-ONLY at step {start_step:,} (fresh optimizer)')
    elif Path(args.ckpt).exists() and args.smoke:
        print('smoke run ignores the existing checkpoint')

    if args.export_only:
        if not Path(args.ckpt).exists():
            raise SystemExit(f'no checkpoint at {args.ckpt}')
        export(model, args.out, seg)
        selfcheck(model, corpus, seg, js_hann(NFFT).to(device), device)
        return

    rng = np.random.default_rng(20261007 + start_step)
    T = seg // HOP + 1

    if args.recalibrate:
        vals = []
        for _ in range(64):
            mix, _, _ = make_mix(corpus, 4, seg, rng, device)
            with torch.no_grad():
                vals.append(torch.log10(stft_mag(mix) + EPS))
        v = torch.cat(vals).flatten()
        print(f'corpus log10-mag MU={v.mean():.4f} STD={v.std():.4f}')
        return

    window = js_hann(NFFT).to(device)
    running = None
    t_check = torch.arange(seg, dtype=torch.float32, device=device) / SR

    for step in range(start_step, args.steps):
        model.train()
        mix, voice, gains = make_mix(corpus, args.batch, seg, rng, device)
        X = torch.stft(mix, NFFT, HOP, window=window, center=True, return_complex=True).abs()
        V = torch.stft(voice, NFFT, HOP, window=window, center=True, return_complex=True).abs()
        x_norm = (torch.log10(X + EPS) - MU) / STD            # [B, bins, T]
        mask, gain_db = model(x_norm.transpose(1, 2))          # [B,T,bins], [B]
        maskT = mask.transpose(1, 2)
        Shat = maskT * X
        # primary: log-domain L1 on the estimated voice magnitude
        l_mask = (torch.log10(Shat + EPS) - torch.log10(V + EPS)).abs().mean()
        # direct supervision toward the ORACLE ideal-ratio mask |V|/|X|
        # (measured: the oracle IRM reaches +9.7 dB SI-SNR where the
        # magnitude-L1-only objective plateaued at +1.7 dB after 30k steps
        # with masks 0.39 L1 away from oracle — this term targets exactly
        # that gap)
        oracle = (V / (X + 1e-8)).clamp(0, 1)
        l_irm = (maskT - oracle).abs().mean()
        # gain head: L1 in dB
        l_gain = (gain_db - gains).abs().mean()
        loss = l_mask + l_irm + 0.3 * l_gain

        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        opt.step()

        item = loss.item()
        running = item if running is None else 0.98 * running + 0.02 * item
        if (step + 1) % args.log_every == 0:
            rate = (step + 1 - start_step) / max(1e-9, 1)
            print(f'step {step+1:>9,}/{args.steps:,}  loss {item:.4f}  '
                  f'ema {running:.4f}  mask {l_mask.item():.4f}  irm {l_irm.item():.4f}  gain {l_gain.item():.3f}dB',
                  flush=True)
        if (step + 1) % args.save_every == 0 or (step + 1) == args.steps:
            torch.save({'model': model.state_dict(), 'opt': opt.state_dict(),
                        'step': step + 1, 'best': min(best, running)}, args.ckpt)
            # model-only snapshot: 1.7 MB vs 5.1 MB — small enough to commit
            # so training survives sandbox resets (see resume path above)
            torch.save({'model': model.state_dict(), 'step': step + 1},
                       Path(args.ckpt).with_name('model-only.pt'))
            if running < best:
                best = running
            # sidecar metrics for the run log
            Path(args.ckpt).with_suffix('.json').write_text(json.dumps({
                'step': step + 1, 'steps_total': args.steps, 'ema_loss': running,
                'mask_loss': l_mask.item(), 'irm_loss': l_irm.item(),
                'gain_loss_db': l_gain.item(),
                'params': n_params,
            }, indent=2))

    # ---- export from the final state -----------------------------------------
    export(model, args.out, seg, steps=args.steps)
    selfcheck(model, corpus, seg, window, device)


def export(model, out, seg_samples, steps=None):
    model.eval()
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    T = seg_samples // HOP + 1
    dummy = torch.zeros(1, T, BINS)
    torch.onnx.export(
        model, dummy, out,
        input_names=['features'], output_names=['mask', 'gain_db'],
        dynamic_axes={'features': {0: 'batch', 1: 'time'},
                      'mask': {0: 'batch', 1: 'time'}},
        opset_version=17,
    )
    # the new exporter stores weights as a companion .onnx.data file — inline
    # them so the app ships ONE self-contained model file
    import onnx as _onnx
    from onnx.external_data_helper import convert_model_from_external_data as _inline
    _m = _onnx.load(out)
    _inline(_m)
    _onnx.save(_m, out, save_as_external_data=False)
    # the inlining re-save leaves the orphaned companion file behind
    _data = Path(out + '.data')
    if _data.exists():
        _data.unlink()
    note = f' after {steps:,} steps' if steps else ''
    print(f'exported {out} ({os.path.getsize(out):,} bytes, weights inlined){note}', flush=True)


def selfcheck(model, corpus, seg, window, device):
    """Spectral SNR of the masked output vs the clean voice on a fresh mix."""
    model.eval()
    mix, voice, gains = make_mix(corpus, 1, seg, np.random.default_rng(7), device)
    with torch.no_grad():
        X = torch.stft(mix, NFFT, HOP, window=window, center=True, return_complex=True).abs()
        x_norm = (torch.log10(X + EPS) - MU) / STD
        mask, gain_db = model(x_norm.transpose(1, 2))
        Shat = (mask.transpose(1, 2)) * X
        V = torch.stft(voice, NFFT, HOP, window=window, center=True, return_complex=True).abs()
        snr = 10 * torch.log10((V ** 2).sum() / ((Shat - V) ** 2).sum() + EPS)
        print(f'self-check: spectral SNR vs clean voice {snr.item():.2f} dB '
              f'(mix baseline ~0 dB by construction), gain target {gains[0]:.2f} dB, '
              f'pred {gain_db[0].item():.2f} dB', flush=True)


if __name__ == '__main__':
    main()
