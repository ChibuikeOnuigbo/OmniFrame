#!/usr/bin/env python3
"""
Desktop-side AI denoise sidecar (stdin -> stdout WAV pipe).

Reads a 16-bit PCM WAV from stdin, runs the omni-denoise-v1 ONNX model
(native onnxruntime), writes the denoised mono WAV to stdout. Used by the
Tauri desktop shell's `ai_denoise_wav` command so desktop users get native
inference instead of the browser WASM path.

Usage:
    python3 denoise_onnx.py --model /path/to/omni-denoise-v1.onnx \
        [--strength 1.0] < in.wav > out.wav
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import denoise_common as dc  # noqa: E402

import onnxruntime as ort  # noqa: E402
import soundfile as sf  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to omni-denoise-v1.onnx")
    ap.add_argument("--strength", type=float, default=1.0, help="mask exponent alpha (0.5 gentle .. 1.0 full)")
    args = ap.parse_args()

    raw = sys.stdin.buffer.read()
    data, sr = sf.read(io.BytesIO(raw), always_2d=True)
    mono = data.mean(axis=1).astype(np.float64)
    if sr != dc.SR:
        from scipy import signal as dsp

        mono = dsp.resample_poly(mono, dc.SR, sr)

    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
    out = dc.denoise_waveform(sess, mono, alpha=args.strength)

    if sr != dc.SR:
        from scipy import signal as dsp

        out = dsp.resample_poly(out, sr, dc.SR)
    out = np.clip(out, -1.0, 1.0)

    buf = io.BytesIO()
    sf.write(buf, out.astype(np.float32), sr, subtype="PCM_16", format="WAV")
    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()
