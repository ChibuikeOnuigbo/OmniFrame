#!/usr/bin/env python3
"""
Desktop-side RotoMask sidecar (stdin PNG -> stdout base64 grayscale mask).

Reads an RGBA/RGB PNG of the current video frame from stdin, runs the given
OmniRoto (or any saliency-contract) ONNX model with native onnxruntime, and
writes a base64-encoded 8-bit grayscale PNG of the subject-likelihood map —
same size as the input frame — to stdout. Used by the Tauri desktop shell's
`roto_segment` command so desktop users get native inference instead of the
browser WASM path (mirrors denoise_onnx.py).

Model contract (see src/lib/rotoModels.ts): input [1,3,H,W] float32 0..1,
one output map [1,1,H,W] of subject likelihood.

Usage:
    python3 roto_onnx.py --model /path/to/omni-roto-anime-v1.onnx < frame.png
"""

from __future__ import annotations

import argparse
import base64
import sys

import cv2
import numpy as np
import onnxruntime as ort

_sessions: dict[str, ort.InferenceSession] = {}


def get_session(model_path: str) -> ort.InferenceSession:
    if model_path not in _sessions:
        _sessions[model_path] = ort.InferenceSession(
            model_path, providers=["CPUExecutionProvider"]
        )
    return _sessions[model_path]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to a saliency ONNX model")
    args = ap.parse_args()

    raw = sys.stdin.buffer.read()
    buf = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        sys.stderr.write("roto_onnx: stdin is not a decodable PNG\n")
        sys.exit(1)
    h, w = frame.shape[:2]

    sess = get_session(args.model)
    inp = sess.get_inputs()[0]
    size = 128
    for d in inp.shape:
        if isinstance(d, int) and d > 32:
            size = d
            break
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    small = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = small.transpose(2, 0, 1)[None]

    out = sess.run(None, {inp.name: x})[0].astype(np.float32)
    # min-max normalise the map to 0..1 (matches the web postprocess)
    mn, mx = float(out.min()), float(out.max())
    if mx - mn < 1e-8:
        out = np.zeros_like(out)
    else:
        out = (out - mn) / (mx - mn)
    prob = out[0, 0]
    gray = (np.clip(prob, 0, 1) * 255).astype(np.uint8)
    gray = cv2.resize(gray, (w, h), interpolation=cv2.INTER_LINEAR)

    ok, png = cv2.imencode(".png", gray)
    if not ok:
        sys.stderr.write("roto_onnx: PNG encode failed\n")
        sys.exit(1)
    sys.stdout.write(base64.b64encode(png.tobytes()).decode("ascii"))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
