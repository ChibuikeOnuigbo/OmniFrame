#!/usr/bin/env python3
"""
Emit deterministic parity vectors for omni-unified-v1:

  features.f32  [T, 771]  normalized context-stacked inputs (graph input)
  mask.f32      [T, 257]  torch model's mask output
  gain.f32      [1]       torch model's gain_db output
  meta.json     shapes + the mix description

The mix is built from the repo fixtures with a FIXED seed and FIXED segment
(the first 3.0 s of tts-m1-numbers over pad-chords at 0 dB SNR + white noise
at 12 dB SNR), so the browser E2E can rebuild the exact same audio and
compare the ONNX (onnxruntime-web) outputs against these torch outputs.

Usage:
  python3 scripts/python/emit_unified_parity.py [ckpt] [outdir]
  (default ckpt training-runs/omni-unified/ckpt.pt, outdir qa/fixtures/omni-unified-parity)
"""
import json
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent))
from train_unified import (Corpus, UnifiedNet, SR, NFFT, HOP, EPS, MU, STD,
                           js_hann, BINS)

ckpt = sys.argv[1] if len(sys.argv) > 1 else 'training-runs/omni-unified/ckpt.pt'
outdir = Path(sys.argv[2] if len(sys.argv) > 2 else 'qa/fixtures/omni-unified-parity')
outdir.mkdir(parents=True, exist_ok=True)

model = UnifiedNet()
ck = torch.load(ckpt, map_location='cpu', weights_only=False)
model.load_state_dict(ck['model'])
model.eval()
print(f'loaded {ckpt} at step {ck.get("step", "?")}')

corpus = Corpus('qa/assets/voice')
seg = 3 * SR
rng = np.random.default_rng(424242)
# fixed, described in meta: voice + bed at 0 dB, white noise at 12 dB
v = corpus.crop(corpus.voices[4], seg, rng)   # tts-m1-numbers (sorted glob index 4)
m = corpus.crop(corpus.beds[4], seg, rng)     # pad-chords (sorted glob index 4)
v_rms = float(np.sqrt(np.mean(v ** 2) + 1e-12))
m_rms = float(np.sqrt(np.mean(m ** 2) + 1e-12))
voice = v * (0.1 / v_rms)
music = m * (0.1 / m_rms)                      # 0 dB SNR
noise = rng.standard_normal(seg).astype(np.float32) * (0.1 * 10 ** (-12 / 20))
mix = voice + music + noise

window = js_hann(NFFT)
X = torch.stft(torch.from_numpy(mix).unsqueeze(0), NFFT, HOP, window=window,
               center=True, return_complex=True).abs()[0]           # [bins, T]
x_norm = (torch.log10(X + EPS) - MU) / STD                          # [bins, T]
with torch.no_grad():
    mask, gain_db = model(x_norm.T.unsqueeze(0))                    # [1,T,bins], [1,1]

T = x_norm.shape[1]
# the graph input is the raw normalized frames [T, 257]; the 3-frame
# context stack is built inside the graph
x_norm.T.numpy().tofile(outdir / 'features.f32')
mask[0].numpy().tofile(outdir / 'mask.f32')
np.asarray([gain_db.item()], dtype=np.float32).tofile(outdir / 'gain.f32')
mix.tofile(outdir / 'mix.f32')
voice.tofile(outdir / 'voice.f32')
(outdir / 'meta.json').write_text(json.dumps({
    'T': T, 'bins': BINS, 'ctx': model.CTX,
    'step': ck.get('step', 0),
    'voices_sorted_index': 4, 'beds_sorted_index': 4,
    'seed': 424242, 'seg_samples': seg, 'sr': SR,
    'voice_rms': 0.1, 'music_rms': 0.1, 'noise_snr_db': 12,
}, indent=2))
print(f'emitted parity vectors to {outdir} (T={T})')
