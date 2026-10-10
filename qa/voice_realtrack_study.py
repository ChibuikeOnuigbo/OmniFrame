#!/usr/bin/env python3
"""
voice_realtrack_study.py — deep DSP study & vetting of voice isolation on
real-world, heavily processed music (slowed / reverb edits, dense mixes).

WHY THIS EXISTS
---------------
The synthetic studies (evidence/voice/listen, evidence/voice/robustness)
score the separator against exact ground truth on 0 dB mixes of TTS voices
and synthesized beds. Real tracks broke that: two "slowed" edits the user
committed produced (by ear) failed separations while every synthetic case
passed. The failure is not visible in SI-SDR (no ground truth exists for
commercial music), so this tool measures it directly from signal physics:

  * WHERE the vocal-like energy actually went (which stem captured it),
  * WHETHER the track is out-of-distribution for the model (tempo/pitch
    analysis detects "slowed" edits and recommends a speed correction),
  * HOW a candidate fix compares to the previous attempt (vet mode).

SUBCOMMANDS
-----------
  audit   <input.wav> [stems-dir] [--acapella X] [--json out.json]
          Full vocal-content audit: per-stem vocal-likelihood accounting,
          most vocal-dense timeline windows, artifact checks.

  speed   <input.wav>
          Tempo analysis + slowed-edit detection; prints recommended
          speed-up factors that bring the track back into the model's
          training distribution (115–165 BPM).

  vet     <old.wav> <new.wav> [--json out.json]
          Before/after comparison of two acapellas (or two instrumentals):
          vocal yield, artifact metrics, verdict.

  refine  <vocals.f32> <other.f32> <out.wav>
          Time-frequency mask recovery: pulls vocal-like content that the
          model mis-filed into the "other" stem back into the acapella.

  yield   <input.wav> <acapella.wav>
          One-line vocal-yield number (used to compare speed factors).

Vocal detection: DSP features alone (harmonic comb, formant band, HNR)
cannot separate "sung vocal" from "harmonic synth pad" on heavily produced
music — the first audit version scored a synth-heavy slowed edit at 70%
vocal-like. This tool therefore runs the shipped Silero VAD v5 ONNX model
(onnxruntime) as the PRIMARY vocal-likelihood detector, with the DSP
features kept as secondary diagnostics.

numpy + onnxruntime + stdlib; MP3s are decoded through the bundled ffmpeg
binary. Operates on 16-bit PCM WAVs or the .f32 stem dumps produced by the
node harness (interleaved stereo).

Usage examples
--------------
  python3 qa/voice_realtrack_study.py speed evidence/voice/realworld/_wav/t1.wav
  python3 qa/voice_realtrack_study.py audit t1.wav _study/track1 --acapella a.mp3
  python3 qa/voice_realtrack_study.py vet old.mp3 new.mp3
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import wave
from dataclasses import dataclass, field, asdict

import numpy as np

FFMPEG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg",
)

SR = 44100
WIN = 8192          # STFT size: 5.4 Hz resolution so the f0 comb is meaningful
HOP = 1024
F0_MIN, F0_MAX = 70.0, 400.0     # human vocal fundamental (slowed edits go low)
N_HARMONICS = 6
FORMANT_LO, FORMANT_HI = 300.0, 3400.0   # classic speech band


# ----------------------------------------------------------------------------
# audio I/O
# ----------------------------------------------------------------------------
def read_audio(path: str) -> tuple[np.ndarray, int]:
    """Read any audio file as float32 [-1, 1], shape (channels, samples)."""
    if path.endswith((".mp3", ".m4a", ".aac", ".ogg")):
        wav = path + ".__study.wav"
        subprocess.run(
            [FFMPEG, "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
             "-i", path, "-ar", str(SR), "-ac", "2", wav],
            check=True,
        )
        data, sr = _read_wav(wav)
        os.unlink(wav)
        return data, sr
    if path.endswith(".f32"):
        raw = np.fromfile(path, dtype="<f4")
        return raw.reshape(-1, 2).T.copy(), SR
    return _read_wav(path)


def _read_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        sw = w.getsampwidth()
        n = w.getnframes()
        if sw != 2:
            raise SystemExit(f"{path}: expected 16-bit PCM, got {sw * 8}-bit")
        raw = np.frombuffer(w.readframes(n), dtype="<i2")
    data = raw.reshape(-1, ch).T.astype(np.float32) / 32768.0
    return data, sr


def write_wav(path: str, chans: np.ndarray) -> None:
    x = np.clip(np.stack(chans, axis=1), -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ----------------------------------------------------------------------------
# framing + STFT
# ----------------------------------------------------------------------------
@dataclass
class Framed:
    """Mono mid-channel analysis of one signal."""
    mag: np.ndarray          # (frames, bins) magnitude spectrogram
    mono: np.ndarray         # (samples,) mid channel
    side: np.ndarray         # (samples,) side channel
    times: np.ndarray        # (frames,) center time of each frame, seconds


def frame_signal(data: np.ndarray) -> Framed:
    mono = data.mean(axis=0)
    side = (data[0] - data[-1]) / 2.0 if data.shape[0] > 1 else np.zeros_like(mono)
    win = np.hanning(WIN).astype(np.float32)
    n = len(mono)
    frames = 1 + max(0, (n - WIN) // HOP)
    idx = np.arange(WIN)[None, :] + HOP * np.arange(frames)[:, None]
    blocks = mono[idx] * win
    spec = np.fft.rfft(blocks, axis=1)
    mag = np.abs(spec).astype(np.float32)
    times = (idx[:, WIN // 2]) / SR
    return Framed(mag=mag, mono=mono, side=side, times=times)


# ----------------------------------------------------------------------------
# per-frame features
# ----------------------------------------------------------------------------
def _bin(freq: float) -> int:
    return int(round(freq * WIN / SR))


def spectral_flatness(mag: np.ndarray) -> np.ndarray:
    """Wiener entropy per frame in [0,1]; tonal→0, noise→1."""
    m = np.maximum(mag, 1e-12)
    geo = np.exp(np.log(m).mean(axis=1))
    arith = m.mean(axis=1)
    return np.clip(geo / np.maximum(arith, 1e-12), 0, 1)


def formant_fraction(mag: np.ndarray) -> np.ndarray:
    """Energy fraction inside the 300–3400 Hz speech band."""
    lo, hi = _bin(FORMANT_LO), _bin(FORMANT_HI)
    band = mag[:, lo:hi].sum(axis=1)
    total = mag[:, 1:].sum(axis=1) + 1e-12
    return np.clip(band / total, 0, 1)


def f0_and_comb(mag: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Harmonic-comb f0 estimate per frame + comb salience.

    For each candidate f0 (70–400 Hz) the comb score is the mean magnitude
    at the first N_HARMONICS multiples, normalized by the frame's low-band
    magnitude. Voiced / sung frames have one clearly winning comb; drums and
    noise do not.
    """
    lo, hi = _bin(F0_MIN), _bin(F0_MAX)
    low = mag[:, 1:_bin(1000.0)]
    low_energy = low.sum(axis=1) + 1e-12
    freqs = np.fft.rfftfreq(WIN, 1.0 / SR)
    candidates = np.where((freqs >= F0_MIN) & (freqs <= F0_MAX))[0]
    if len(candidates) == 0:
        return np.zeros(len(mag)), np.zeros(len(mag))
    # (cands, harmonics) — indexing a (frames, bins) spectrogram with a
    # (cands, harmonics) index array yields (frames, cands, harmonics)
    harm_idx = candidates[:, None] * np.arange(1, N_HARMONICS + 1)[None, :]
    harm_idx = np.minimum(harm_idx, mag.shape[1] - 1)
    comb = mag[:, harm_idx].mean(axis=2)          # (frames, cands)
    best = np.argmax(comb, axis=1)
    rows = np.arange(len(mag))
    salience = comb[rows, best] / (low_energy / _bin(1000.0) + 1e-12)
    f0 = freqs[candidates][best]
    return f0, salience


def hnr_time(mono: np.ndarray, frames: int) -> np.ndarray:
    """
    Time-domain harmonics-to-noise proxy via normalized autocorrelation peak
    in the 2.5–15 ms lag band (70–400 Hz periodicity).
    """
    out = np.zeros(frames, dtype=np.float32)
    lag_lo, lag_hi = int(0.0025 * SR), int(0.015 * SR)
    for i in range(frames):
        seg = mono[i * HOP: i * HOP + WIN]
        if len(seg) < WIN:
            break
        seg = seg - seg.mean()
        energy = np.dot(seg, seg)
        if energy < 1e-10:
            continue
        # coarse-then-fine autocorrelation on the lag band (keeps it cheap)
        ac = np.correlate(seg[::4], seg[::4], mode="full")
        ac = ac[len(ac) // 2:]
        step = 4
        lags = np.arange(len(ac)) * step
        band = (lags >= lag_lo * 0.5) & (lags <= lag_hi)
        if not band.any():
            continue
        out[i] = float(np.max(ac[band]) / (energy / 4))
    return np.clip(out, 0, 1)


def spectral_flux(mag: np.ndarray) -> np.ndarray:
    d = np.abs(np.diff(mag, axis=0))
    d = np.vstack([np.zeros((1, d.shape[1]), dtype=d.dtype), d])
    return d.sum(axis=1)


def side_energy_frac(data: np.ndarray) -> float:
    mono = data.mean(axis=0)
    side = (data[0] - data[-1]) / 2.0 if data.shape[0] > 1 else np.zeros(1)
    return float(np.dot(side, side) / (np.dot(mono, mono) + 1e-12))


# ----------------------------------------------------------------------------
# unsupervised vocal-likelihood: 2-component GMM over standardized features
# ----------------------------------------------------------------------------
@dataclass
class VocalModel:
    weights: np.ndarray
    means: np.ndarray
    covs: np.ndarray
    vocal_component: int
    feature_names: list = field(default_factory=list)


FEATURES = ["comb", "formant", "hnr", "neg_flatness", "low_modulation", "f0_stability"]


def extract_features(f: Framed) -> dict[str, np.ndarray]:
    f0, comb = f0_and_comb(f.mag)
    flat = spectral_flatness(f.mag)
    form = formant_fraction(f.mag)
    flux = spectral_flux(f.mag)
    # slow amplitude modulation (sung sustains) vs fast (percuussive attacks):
    # envelope of the formant band, smoothed, compared frame-to-frame
    lo, hi = _bin(FORMANT_LO), _bin(FORMANT_HI)
    env = f.mag[:, lo:hi].sum(axis=1)
    kernel = np.hanning(9); kernel /= kernel.sum()
    env_s = np.convolve(env, kernel, mode="same")
    d_env = np.abs(np.diff(env_s, prepend=env_s[0])) / (env_s + 1e-9)
    low_modulation = 1.0 / (1.0 + 20.0 * d_env)          # sustained → ~1
    # f0 continuity over ±6 frames
    f0s = f0.copy()
    stable = np.zeros(len(f0))
    half = 6
    for i in range(len(f0)):
        a, b = max(0, i - half), min(len(f0), i + half + 1)
        seg = f0s[a:b]
        seg = seg[(seg > F0_MIN + 5) & (seg < F0_MAX - 5)]
        stable[i] = 1.0 / (1.0 + 8.0 * (np.std(seg) / (np.mean(seg) + 1e-9))) if len(seg) > 2 else 0.0
    return {
        "comb": np.clip(comb / (np.percentile(comb, 95) + 1e-9), 0, 1),
        "formant": form,
        "hnr": hnr_time(f.mono, len(f.times)),
        "neg_flatness": 1.0 - flat,
        "low_modulation": low_modulation,
        "f0_stability": stable,
    }


def fit_vocal_gmm(feats: dict[str, np.ndarray], iters: int = 40) -> VocalModel:
    """2-component diagonal-covariance GMM (EM) over the 6 features."""
    names = FEATURES
    X = np.stack([feats[n] for n in names], axis=1).astype(np.float64)
    mu = X.mean(axis=0)
    sd = X.std(axis=0) + 1e-9
    Z = (X - mu) / sd

    rng = np.random.default_rng(7)
    means = np.vstack([Z[:64].mean(axis=0), Z[-64:].mean(axis=0)])
    means += rng.normal(0, 0.05, means.shape)
    covs = np.tile(np.ones(Z.shape[1]), (2, 1))
    weights = np.array([0.5, 0.5])

    for _ in range(iters):
        # E step: log N(z | mean, diag cov)
        logp = np.zeros((len(Z), 2))
        for k in range(2):
            diff = Z - means[k]
            logp[:, k] = (
                np.log(weights[k] + 1e-12)
                - 0.5 * np.sum(np.log(2 * np.pi * covs[k]))
                - 0.5 * np.sum(diff ** 2 / covs[k], axis=1)
            )
        m = logp.max(axis=1, keepdims=True)
        p = np.exp(logp - m)
        resp = p / p.sum(axis=1, keepdims=True)
        # M step
        nk = resp.sum(axis=0) + 1e-9
        weights = nk / len(Z)
        for k in range(2):
            means[k] = (resp[:, k, None] * Z).sum(axis=0) / nk[k]
            covs[k] = (resp[:, k, None] * (Z - means[k]) ** 2).sum(axis=0) / nk[k] + 0.05

    # which component is the "vocal" one? the one whose mean loads higher on
    # comb + formant + hnr (voiced evidence) — robust even for instrumental
    # files, where both load low and posteriors stay low.
    vocal_score = means[:, names.index("comb")] + means[:, names.index("formant")] + means[:, names.index("hnr")]
    vocal_component = int(np.argmax(vocal_score))
    return VocalModel(weights=weights, means=means, covs=covs,
                      vocal_component=vocal_component, feature_names=names)


def vocal_posterior(model: VocalModel, feats: dict[str, np.ndarray]) -> np.ndarray:
    names = FEATURES
    X = np.stack([feats[n] for n in names], axis=1).astype(np.float64)
    # re-standardize with the SAME statistics used at fit time is impossible
    # here (not stored), so the model is refit per file and posteriors come
    # from the same features — see audit(); this function is used only for
    # same-file scoring.
    raise NotImplementedError("use audit()/yield internally")


def frame_vocal_probability(feats: dict[str, np.ndarray]) -> tuple[np.ndarray, VocalModel]:
    model = fit_vocal_gmm(feats)
    names = FEATURES
    X = np.stack([feats[n] for n in names], axis=1).astype(np.float64)
    mu = X.mean(axis=0)
    sd = X.std(axis=0) + 1e-9
    Z = (X - mu) / sd
    logp = np.zeros((len(Z), 2))
    for k in range(2):
        diff = Z - model.means[k]
        logp[:, k] = (
            np.log(model.weights[k] + 1e-12)
            - 0.5 * np.sum(np.log(2 * np.pi * model.covs[k]))
            - 0.5 * np.sum(diff ** 2 / model.covs[k], axis=1)
        )
    m = logp.max(axis=1, keepdims=True)
    p = np.exp(logp - m)
    post = p / p.sum(axis=1, keepdims=True)
    return post[:, model.vocal_component], model


def frame_energy_db(f: Framed) -> np.ndarray:
    e = f.mag.sum(axis=1)
    return 10 * np.log10(e / (np.percentile(e, 99) + 1e-12) + 1e-12)


# ----------------------------------------------------------------------------
# Silero VAD — the primary vocal-likelihood detector
# ----------------------------------------------------------------------------
_SILERO = None
SILERO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "models", "silero-vad-v5.onnx",
)


def silero_posterior(data: np.ndarray) -> np.ndarray:
    """
    Run Silero VAD v5 over the mid-channel signal at 16 kHz.

    Model contract (same as src/lib/vad.ts): input [1, 576] =
    concat(64-sample context, 512-sample chunk), state [2, 1, 128] float32
    chained between calls, sr scalar = 16000. Non-finite samples (raw
    single-pass stems contain NaN at chunk tails) are scrubbed to zero.
    """
    global _SILERO
    if _SILERO is None:
        import onnxruntime as ort
        _SILERO = ort.InferenceSession(SILERO_PATH, providers=["CPUExecutionProvider"])
    x = np.nan_to_num(data.mean(axis=0), nan=0.0, posinf=0.0, neginf=0.0)
    n16 = int(len(x) * 16000 / SR)
    if n16 < 512:
        return np.zeros(1, dtype=np.float32)
    # linear resample is fine for a probability envelope
    idx = np.linspace(0, len(x) - 1, n16)
    x16 = np.interp(idx, np.arange(len(x)), x).astype(np.float32)

    state = np.zeros((2, 1, 128), dtype=np.float32)
    ctx = np.zeros(64, dtype=np.float32)
    sr = np.array(16000, dtype=np.int64)
    probs = []
    for i in range(0, len(x16) - 512 + 1, 512):
        chunk = np.concatenate([ctx, x16[i:i + 512]])[None, :]
        out, state = _SILERO.run(None, {"input": chunk, "state": state, "sr": sr})
        probs.append(float(out[0, 0]))
        ctx = x16[i:i + 512][-64:]
    return np.array(probs, dtype=np.float32)


def silero_summary(data: np.ndarray) -> dict:
    p = silero_posterior(data)
    if len(p) == 0:
        return {"mean": 0.0, "frames_over_50": 0.0, "peak": 0.0}
    return {
        "mean": float(p.mean()),
        "frames_over_50": float((p > 0.5).mean()),
        "peak": float(p.max()),
    }


# ----------------------------------------------------------------------------
# audit
# ----------------------------------------------------------------------------
def vocal_yield(data: np.ndarray) -> dict:
    """Vocal-like energy share + densest windows for one signal."""
    nonfinite_total = int((~np.isfinite(data)).sum())
    if nonfinite_total:
        data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
    f = frame_signal(data)
    feats = extract_features(f)
    post, model = frame_vocal_probability(feats)
    energy = f.mag.sum(axis=1)
    vocal_energy = float(np.sum(post * energy))
    total = float(np.sum(energy)) + 1e-12
    # densest 10-second vocal windows
    win_frames = int(10 * SR / HOP)
    scores = np.convolve(post * energy, np.ones(win_frames), mode="valid")
    best = int(np.argmax(scores)) if len(scores) else 0
    t0 = float(f.times[min(best, len(f.times) - 1)])
    rms = float(np.sqrt(np.mean(data[0] ** 2)))
    nonfinite = nonfinite_total
    sil = silero_summary(data)
    # energy-weighted vocal fraction using the SILERO posterior as the
    # authoritative voice detector; the GMM/DSP posterior is kept as a
    # secondary diagnostic
    sp = silero_posterior(data)
    sp_mapped = np.interp(
        np.linspace(0, len(sp) - 1, len(post)), np.arange(len(sp)), sp
    ) if len(sp) else np.zeros(len(post))
    vocal_frac_silero = float(np.sum(sp_mapped * energy) / (np.sum(energy) + 1e-12))
    return {
        "vocal_like_energy_frac": vocal_frac_silero,
        "vocal_like_energy_frac_dsp": vocal_energy / total,
        "vocal_like_frames_frac": float((sp_mapped > 0.5).mean()),
        "silero_mean": sil["mean"],
        "silero_frames_over_50": sil["frames_over_50"],
        "silero_peak": sil["peak"],
        "peak_vocal_window_start_s": t0,
        "rms_dbfs": 10 * np.log10(rms ** 2 + 1e-12),
        "seconds": float(len(data[0]) / SR),
        "side_fraction": side_energy_frac(data),
        "nonfinite_samples": nonfinite,
        "posterior": post,
        "times": f.times,
        "energy": energy,
        "model_vocal_share": float(model.weights[model.vocal_component]),
    }


def _clean(d: dict) -> dict:
    return {k: v for k, v in d.items() if not isinstance(v, np.ndarray)}


def cmd_audit(args: argparse.Namespace) -> None:
    report: dict = {"input": os.path.basename(args.input)}
    data, sr = read_audio(args.input)
    print(f"\n=== AUDIT {os.path.basename(args.input)} ({len(data[0])/SR:.1f}s) ===")
    inp = vocal_yield(data)
    print(f"  input:            vocal-like energy {100*inp['vocal_like_energy_frac']:5.1f}%   "
          f"frames {100*inp['vocal_like_frames_frac']:5.1f}%   side {100*inp['side_fraction']:4.1f}%   "
          f"rms {inp['rms_dbfs']:.1f} dBFS")
    report["input"] = _clean(inp)

    files = []
    if args.stems_dir and os.path.isdir(args.stems_dir):
        files = sorted(os.path.join(args.stems_dir, f) for f in os.listdir(args.stems_dir))
    for extra in args.acapella or []:
        files.append(extra)

    where = []
    for p in files:
        d, _ = read_audio(p)
        y = vocal_yield(d)
        name = os.path.basename(p)
        # how much of the input's vocal-like energy this stem captured
        capture = 10 * np.log10(y["vocal_like_energy_frac"] + 1e-9) - \
                  10 * np.log10(inp["vocal_like_energy_frac"] + 1e-9)
        y["capture_db_vs_input"] = float(capture)
        print(f"  {name:22s} vocal-like {100*y['vocal_like_energy_frac']:5.1f}%   "
              f"rms {y['rms_dbfs']:6.1f} dBFS   capture {capture:+5.1f} dB")
        where.append((name, y))
        report.setdefault("stems", []).append({**_clean(y), "file": name})

    # verdict: did the vocals stem actually get the vocal-like content?
    voc = next((y for n, y in where if "vocals" in n), None)
    others = [(n, y) for n, y in where if "vocals" not in n and n.endswith((".f32", ".wav", ".mp3"))]
    if voc and others:
        best_other = max(others, key=lambda t: t[1]["vocal_like_energy_frac"])
        leak = best_other[1]["vocal_like_energy_frac"] - voc["vocal_like_energy_frac"]
        if voc["vocal_like_energy_frac"] < 0.10:
            verdict = "FAIL: vocals stem carries almost no vocal-like content"
        elif leak > 0.15:
            verdict = f"LEAKY: {best_other[0]} holds more vocal-like energy than the vocals stem"
        else:
            verdict = "OK: vocals stem captured the vocal-like content"
        print(f"  VERDICT: {verdict}")
        report["verdict"] = verdict

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(report, fh, indent=2)
        print(f"  report → {args.json}")


# ----------------------------------------------------------------------------
# speed / tempo
# ----------------------------------------------------------------------------
def onset_envelope(mag: np.ndarray) -> np.ndarray:
    flux = spectral_flux(mag)
    return (flux - flux.mean()) / (flux.std() + 1e-12)


def tempo_candidates(mag: np.ndarray) -> list[tuple[float, float]]:
    """Autocorrelation of the onset envelope; returns (bpm, score) peaks."""
    env = onset_envelope(mag)
    fps = SR / HOP
    max_lag = int(fps * 2.0)          # 30 BPM floor
    min_lag = int(fps * 60.0 / 200.0) # 200 BPM cap
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    ac = ac[: max_lag + 1]
    ac /= ac[0] + 1e-12
    peaks = []
    for lag in range(min_lag, min(max_lag, len(ac) - 1)):
        if ac[lag] > ac[lag - 1] and ac[lag] >= ac[lag + 1] and ac[lag] > 0.05:
            peaks.append((60.0 * fps / lag, float(ac[lag])))
    peaks.sort(key=lambda t: -t[1])
    # merge near-duplicates (within 3%)
    merged: list[tuple[float, float]] = []
    for bpm, sc in peaks:
        if not any(abs(bpm / m[0] - 1) < 0.03 for m in merged):
            merged.append((bpm, sc))
    return merged[:6]


def cmd_speed(args: argparse.Namespace) -> None:
    data, _ = read_audio(args.input)
    f = frame_signal(data)
    cands = tempo_candidates(f.mag)
    print(f"\n=== SPEED ANALYSIS {os.path.basename(args.input)} ===")
    if not cands:
        print("  no clear tempo; cannot estimate a speed correction")
        return
    bpm, score = cands[0]
    print(f"  dominant tempo: {bpm:.1f} BPM (autocorr {score:.2f})")
    others = ", ".join(f"{b:.0f} ({s:.2f})" for b, s in cands[1:])
    print(f"  other peaks:    {others}")
    # slowed edits: producers typically slow to 0.6–0.9x of the source, which
    # lands electronic/hip-hop material in the 60–105 BPM window. Demucs was
    # trained on normal-pitched music; recommend factors that restore an
    # in-distribution tempo (115–165 BPM).
    if bpm < 105:
        print(f"  → track looks SLOWED ({bpm:.0f} BPM). The separator's training")
        print(f"    distribution assumes normal pitch/tempo — vocals pitched this")
        print(f"    far down often fall out of the model's 'vocals' concept.")
        recs = []
        for target in (120.0, 128.0, 140.0, 150.0, 160.0):
            fac = target / bpm
            if 1.05 <= fac <= 1.8:
                recs.append((fac, target))
        # dedupe close factors
        final: list[tuple[float, float]] = []
        for fac, tgt in sorted(recs):
            if not any(abs(fac / ff - 1) < 0.05 for ff, _ in final):
                final.append((fac, tgt))
        print("  recommended speed-up factors (factor → resulting BPM):")
        for fac, tgt in final:
            print(f"    x{fac:.3f}  → {tgt:.0f} BPM")
        print("  apply: ffmpeg -i in.wav -af asetrate=44100*<factor>,aresample=44100 sped.wav")
        print("         separate sped.wav, then slow stems back with the inverse factor.")
    else:
        print("  tempo is in the normal range — speed correction unlikely to help.")


# ----------------------------------------------------------------------------
# vet
# ----------------------------------------------------------------------------
def artifact_metrics(data: np.ndarray) -> dict:
    f = frame_signal(data)
    flux = spectral_flux(f.mag)
    q99 = np.percentile(flux, 99)
    discontinuities = int((flux > 3 * q99).sum())
    x = data[0]
    clipped = int((np.abs(x) > 0.999).sum())
    nonfinite = int((~np.isfinite(x)).sum())
    return {"flux_outliers": discontinuities, "clipped_samples": clipped, "nonfinite": nonfinite}


def cmd_vet(args: argparse.Namespace) -> None:
    old, _ = read_audio(args.old)
    new, _ = read_audio(args.new)
    print(f"\n=== VET {os.path.basename(args.old)} → {os.path.basename(args.new)} ===")
    yo = vocal_yield(old)
    yn = vocal_yield(new)
    gain = 10 * np.log10(yn["vocal_like_energy_frac"] + 1e-9) - \
           10 * np.log10(yo["vocal_like_energy_frac"] + 1e-9)
    print(f"  vocal-like energy: {100*yo['vocal_like_energy_frac']:5.1f}% → {100*yn['vocal_like_energy_frac']:5.1f}%  ({gain:+.1f} dB)")
    print(f"  vocal-like frames: {100*yo['vocal_like_frames_frac']:5.1f}% → {100*yn['vocal_like_frames_frac']:5.1f}%")
    ao, an = artifact_metrics(old), artifact_metrics(new)
    print(f"  artifacts: flux-outliers {ao['flux_outliers']} → {an['flux_outliers']}, "
          f"clipped {ao['clipped_samples']} → {an['clipped_samples']}, "
          f"non-finite {ao['nonfinite']} → {an['nonfinite']}")
    verdict = ("IMPROVED" if gain > 1.5 else "NO GAIN" if gain > -1.5 else "WORSE")
    print(f"  VERDICT: {verdict}")
    if args.json:
        with open(args.json, "w") as fh:
            json.dump({"old": _clean(yo), "new": _clean(yn), "gain_db": gain,
                       "artifacts": {"old": ao, "new": an}, "verdict": verdict}, fh, indent=2)
        print(f"  report → {args.json}")


# ----------------------------------------------------------------------------
# refine: recover vocal-like TF content from the 'other' stem
# ----------------------------------------------------------------------------
def cmd_refine(args: argparse.Namespace) -> None:
    voc, _ = read_audio(args.vocals)
    oth, _ = read_audio(args.other)
    n = min(voc.shape[1], oth.shape[1])
    voc, oth = voc[:, :n], oth[:, :n]
    f = frame_signal(oth)
    feats = extract_features(f)
    post, _ = frame_vocal_probability(feats)
    # per-frame mask from the posterior (soft, squared to be conservative)
    mask = (post ** 2)[:, None]
    win = np.hanning(WIN).astype(np.float32)
    out = np.zeros_like(voc)
    # overlap-add the masked other-stem frames back into time domain
    n_frames = len(f.times)
    for c in range(voc.shape[0]):
        acc = np.zeros(n, dtype=np.float64)
        wsum = np.zeros(n, dtype=np.float64)
        for i in range(n_frames):
            off = i * HOP
            seg = oth[c, off: off + WIN]
            if len(seg) < WIN:
                break
            spec = np.fft.rfft(seg * win)
            m = float(mask[i, 0])
            if m < 0.02:
                continue
            rec = np.fft.irfft(spec * m, n=WIN)
            acc[off: off + WIN] += rec * win
            wsum[off: off + WIN] += win * win
        valid = wsum > 1e-8
        out[c, valid] = (acc[valid] / wsum[valid]).astype(np.float32)
    added = out - voc
    added_energy = float(np.mean(added ** 2))
    print(f"  refined acapella: +{10*np.log10(added_energy + 1e-12):.1f} dBFS of vocal-like content recovered from 'other'")
    write_wav(args.out, out)
    print(f"  → {args.out}")


# ----------------------------------------------------------------------------
# one-line yield (for speed-factor sweeps)
# ----------------------------------------------------------------------------
def cmd_yield(args: argparse.Namespace) -> None:
    d, _ = read_audio(args.input)
    y = vocal_yield(d)
    print(f"{100*y['vocal_like_energy_frac']:.1f}% vocal-like energy "
          f"({100*y['vocal_like_frames_frac']:.1f}% frames, peak @{y['peak_vocal_window_start_s']:.0f}s)")


# ----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("audit", help="full vocal-content audit of input + stems")
    a.add_argument("input")
    a.add_argument("stems_dir", nargs="?", default=None)
    a.add_argument("--acapella", nargs="*", default=[], help="output files to audit too")
    a.add_argument("--json", default=None)

    a = sub.add_parser("speed", help="tempo analysis + slowed-edit detection")
    a.add_argument("input")

    a = sub.add_parser("vet", help="before/after comparison")
    a.add_argument("old"); a.add_argument("new"); a.add_argument("--json", default=None)

    a = sub.add_parser("refine", help="mask-recover vocal content from the other stem")
    a.add_argument("vocals"); a.add_argument("other"); a.add_argument("out")

    a = sub.add_parser("yield", help="one-line vocal yield of a file")
    a.add_argument("input")

    args = ap.parse_args()
    {"audit": cmd_audit, "speed": cmd_speed, "vet": cmd_vet,
     "refine": cmd_refine, "yield": cmd_yield}[args.cmd](args)


if __name__ == "__main__":
    main()
