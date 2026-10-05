"""
Model tests for omni-denoise-v1.

1. Parity: NumPy reference vs the deployed ONNX artifact (onnxruntime).
2. Evaluation on fixed, held-out mixtures — the brief's test matrix:
     * white noise            (classic noise)
     * babble                 (competing voices)
     * song                   (structured music interference)
     * heavily padded song    (multiple songs + SFX stacked until the
                               interference is effectively noise)
   Metrics: SI-SDR before/after, residual-noise reduction.
3. Writes qa/reports/ai-denoise-model.json and demo WAVs to evidence/audio/.

Usage: python3 scripts/python/test_model.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import denoise_common as dc  # noqa: E402

import onnxruntime as ort  # noqa: E402
import soundfile as sf  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ONNX_PATH = ROOT / "public/models/omni-denoise-v1.onnx"
NPZ_PATH = ROOT / "qa/models/omni-denoise-v1.npz"
REPORT_PATH = ROOT / "qa/reports/ai-denoise-model.json"
AUDIO_DIR = ROOT / "evidence/audio"


def load_model() -> dc.GruDenoiser:
    model = dc.GruDenoiser()
    with np.load(NPZ_PATH) as z:
        for k in model.W:
            model.W[k] = z[k]
    return model


def numpy_mask(model: dc.GruDenoiser, mag: np.ndarray) -> np.ndarray:
    x = dc.feature(mag).T[None, :, :]  # [1, T, F]
    masks, _ = model.forward(x)
    return masks[0].T


def main() -> None:
    failures: list[str] = []

    # ---- 1. parity -----------------------------------------------------
    model = load_model()
    sess = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(5)
    X = rng.normal(0, 1, (1, dc.BLOCK, dc.FREQ_BINS)).astype(np.float32)
    h0 = np.zeros((1, dc.HIDDEN), dtype=np.float32)
    m_onnx, _ = sess.run(["MASK", "HOUT"], {"X": X, "H0": h0})
    m_np, _ = model.forward(X.astype(np.float64), h0.astype(np.float64))
    parity = float(np.abs(m_onnx - m_np).max())
    print(f"parity numpy vs onnx: max abs diff {parity:.2e}")
    if parity > 1e-4:
        failures.append(f"parity diff {parity:.2e} > 1e-4")

    onnx_kb = ONNX_PATH.stat().st_size // 1024
    print(f"onnx artifact: {onnx_kb} KB")
    if onnx_kb > 4096:
        failures.append(f"onnx too large: {onnx_kb} KB")

    # ---- 2. evaluation cases -------------------------------------------
    # held-out rng seeds (never used in training: 2026 train / 99 val)
    voice = dc.load_voice(str(ROOT / "qa/fixtures/test-audio-6s.ogg"), np.random.default_rng(1234))
    cases = [
        ("white_noise_0db", "white", 0.0),
        # competing voices with the main voice dominant ("main consistent voice
        # with high ratio higher") — equal-energy cocktail party is beyond a
        # magnitude masker's design intent
        ("babble_+6db", "babble", 6.0),
        ("song_-3db", "song", -3.0),
        ("heavily_padded_song_-8db", "song_stack", -8.0),
    ]
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for name, kind, snr in cases:
        r = np.random.default_rng(hash(name) % (2**31))
        n = dc.SR * 5
        mix, clean, noise, _, actual_snr = dc.make_mixture(voice, r, n, snr_db=snr, noise_kind=kind)
        est = dc.denoise_waveform(sess, mix, alpha=1.0)

        sdr_in = dc.si_sdr(mix, clean)
        sdr_out = dc.si_sdr(est, clean)
        # noise actually removed: compare (mix - clean) vs (est - clean)
        noise_before = float((noise**2).mean())
        resid = est - clean
        noise_after = float((resid**2).mean())
        supp_db = 10 * np.log10(noise_before / (noise_after + 1e-12))
        # voice kept? correlate est with clean
        voice_corr = float(np.corrcoef(est, clean)[0, 1])

        row = {
            "case": name,
            "interference": kind,
            "snrDb": round(actual_snr, 1),
            "siSdrBeforeDb": round(sdr_in, 2),
            "siSdrAfterDb": round(sdr_out, 2),
            "deltaSiSdrDb": round(sdr_out - sdr_in, 2),
            "noiseSuppressionDb": round(supp_db, 1),
            "voiceCorrelation": round(voice_corr, 3),
        }
        results.append(row)
        print(json.dumps(row))
        sf.write(AUDIO_DIR / f"denoise-{name}-mix.wav", np.clip(mix, -1, 1), dc.SR, subtype="PCM_16")
        sf.write(AUDIO_DIR / f"denoise-{name}-out.wav", np.clip(est, -1, 1), dc.SR, subtype="PCM_16")
        sf.write(AUDIO_DIR / f"denoise-{name}-clean.wav", np.clip(clean, -1, 1), dc.SR, subtype="PCM_16")
        if sdr_out - sdr_in <= 0:
            failures.append(f"{name}: delta SI-SDR {sdr_out - sdr_in:+.2f} dB (must be > 0)")

    mean_delta = float(np.mean([r["deltaSiSdrDb"] for r in results]))
    print(f"mean delta SI-SDR: {mean_delta:+.2f} dB")
    if mean_delta < 3.0:
        failures.append(f"mean delta SI-SDR {mean_delta:+.2f} < 3 dB")

    report = {
        "model": dc.model_json(str(ONNX_PATH)),
        "onnxSizeKb": onnx_kb,
        "parityMaxAbsDiff": parity,
        "noiseDefinition": (
            "Acoustic noise is any unwanted sound — it does not have to be random. "
            "Hum, hiss, clicks, other people's conversations, or a song are all noise "
            "when the wanted signal is the speaker's voice; a song padded on heavily "
            "enough becomes broadband interference, i.e. functionally noise."
        ),
        "cases": results,
        "meanDeltaSiSdrDb": round(mean_delta, 2),
        "passed": len(failures) == 0,
        "failures": failures,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print("report:", REPORT_PATH)
    if failures:
        print("FAILURES:", failures)
        sys.exit(1)
    print("ALL MODEL TESTS PASSED")


if __name__ == "__main__":
    main()
