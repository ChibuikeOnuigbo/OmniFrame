"""
Train the OmniFrame GRU spectral-mask denoiser.

Data is synthesized on the fly (deterministic seeds):
  * wanted signal — the speech fixture, augmented (pitch / tempo / EQ / gain)
  * interference  — procedural SFX (hum, clicks, rain, traffic, ...),
    competing-voice babble, a synthesized song, and a "heavily padded song"
    stack (several songs + SFX, i.e. structured audio that acts as noise)
  * mixed at random SNR in [-8, +12] dB

Artifacts:
  public/models/omni-denoise-v1.onnx   — browser + desktop runtime model
  public/models/omni-denoise-v1.json   — feature/model constants
  qa/models/omni-denoise-v1.npz        — NumPy weights (parity testing)

Usage: python3 scripts/python/train_denoiser.py [steps]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import denoise_common as dc  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
VOICE_PATH = ROOT / "qa/fixtures/test-audio-6s.ogg"
ONNX_PATH = ROOT / "public/models/omni-denoise-v1.onnx"
JSON_PATH = ROOT / "public/models/omni-denoise-v1.json"
NPZ_PATH = ROOT / "qa/models/omni-denoise-v1.npz"


def batch(rng: np.random.Generator, voice: np.ndarray, B: int = 8, T: int = dc.BLOCK):
    """Synthesize a training batch: X [B, T, F] features, M [B, T, F] targets."""
    n = T * dc.HOP
    Xs, Ms = [], []
    for _ in range(B):
        mix, clean, noise, _, _ = dc.make_mixture(voice, rng, n)
        mag_mix, _ = dc.stft(mix)
        mag_clean, _ = dc.stft(clean)
        mag_noise, _ = dc.stft(noise)
        Tm = min(T, mag_mix.shape[1])
        Xs.append(dc.feature(mag_mix[:, :Tm]).T)
        Ms.append(dc.target_mask(mag_clean[:, :Tm], mag_noise[:, :Tm]).T)
    Tm = min(len(x) for x in Xs)
    X = np.stack([x[:Tm] for x in Xs])
    M = np.stack([m[:Tm] for m in Ms])
    return X, M


def val_loss(model: dc.GruDenoiser, voice: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    """Loss + delta SI-SDR on a fixed-ish validation mixture set."""
    X, M = batch(rng, voice, B=4)
    masks, _ = model.forward(X)
    loss = float(((masks - M) ** 2).mean())
    # quick waveform check on one mixture
    mix, clean, noise, _, _ = dc.make_mixture(voice, rng, dc.SR * 3, snr_db=0.0)
    mag, phase = dc.stft(mix)
    masks_full, _ = model.forward(dc.feature(mag).T[None, :, :])
    mask = masks_full[0].T
    est = dc.istft(mask * mag, phase, len(mix))
    # scale reference to the estimate for SI-SDR
    return loss, dc.si_sdr(est, clean) - dc.si_sdr(mix, clean)


def main() -> None:
    steps = int(sys.argv[1]) if len(sys.argv) > 1 else 1500
    rng = np.random.default_rng(2026)
    val_rng = np.random.default_rng(99)

    voice = dc.load_voice(str(VOICE_PATH), rng)
    print(f"voice: {len(voice)/dc.SR:.1f}s @ {dc.SR} Hz, rms {np.sqrt((voice**2).mean()):.3f}")

    model = dc.GruDenoiser()
    opt = dc.Adam(model.W, lr=2e-3)

    best_val = float("inf")
    ONNX_PATH.parent.mkdir(parents=True, exist_ok=True)
    NPZ_PATH.parent.mkdir(parents=True, exist_ok=True)

    for step in range(1, steps + 1):
        opt.lr = 2e-3 * (0.1 ** (step / steps))  # exponential decay 2e-3 -> 2e-4
        X, M = batch(rng, voice)
        loss, grads = model.loss_grad(X, M)
        opt.step(model.W, grads)
        if step % 25 == 0:
            print(f"step {step:5d}  loss {loss:.5f}", flush=True)
        if step % 150 == 0 or step == steps:
            vloss, dsdr = val_loss(model, voice, val_rng)
            print(f"  [val] loss {vloss:.5f}  dSI-SDR {dsdr:+.2f} dB", flush=True)
            if vloss < best_val:
                best_val = vloss
                np.savez(NPZ_PATH, **model.W)
                dc.export_onnx(model, str(ONNX_PATH))
                dc.save_json(dc.model_json(str(ONNX_PATH)), str(JSON_PATH))

    # final artifacts (always save the final model too if it was best)
    print("training done. best val loss:", round(best_val, 5))
    print("artifacts:", ONNX_PATH, JSON_PATH, NPZ_PATH, sep="\n  ")


if __name__ == "__main__":
    main()
