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


def sam_segment(frame_bgr: "cv2.Mat", model_file: str, clicks: list) -> "cv2.Mat":
    """Promptable SAM path (MobileSAM encoder + decoder).

    clicks: [[x_norm, y_norm, positive], ...] in 0..1 frame coordinates.
    Mirrors the browser implementation: ImageNet normalisation before
    zero-padding to 1024, points scaled into 1024-space, one iterative
    refinement pass feeding the logits back as mask_input.
    """
    import base64 as _b64
    import hashlib

    enc_path = model_file
    dec_path = model_file.replace("encoder", "decoder")
    enc = get_session(enc_path)
    dec = get_session(dec_path)

    h, w = frame_bgr.shape[:2]
    scale = 1024 / max(h, w)
    rw, rh = int(w * scale), int(h * scale)
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    small = cv2.resize(rgb, (rw, rh)).astype(np.float32)
    mean = np.array([123.675, 116.28, 103.53], dtype=np.float32)
    std = np.array([58.395, 57.12, 57.375], dtype=np.float32)
    small = (small - mean) / std
    x = np.zeros((1, 3, 1024, 1024), np.float32)
    x[0, :, :rh, :rw] = small.transpose(2, 0, 1)

    key = hashlib.sha1(x.tobytes()).hexdigest()
    emb = _sam_cache.get(key)
    if emb is None:
        emb = enc.run(None, {"image": x})[0]
        _sam_cache[key] = emb
        while len(_sam_cache) > 4:
            _sam_cache.pop(next(iter(_sam_cache)))

    coords = np.array(
        [[[c[0] * w * scale, c[1] * h * scale] for c in clicks]], dtype=np.float32
    )
    labels = np.array([[1.0 if c[2] else 0.0 for c in clicks]], dtype=np.float32)
    common = {
        "image_embedding": emb,
        "point_coords": coords,
        "point_labels": labels,
        "orig_im_size": np.array([h, w], dtype=np.float32),
    }
    masks, scores, logits = dec.run(
        None,
        {
            **common,
            "mask_input": np.zeros((1, 1, 256, 256), np.float32),
            "has_mask_input": np.zeros(1, np.float32),
        },
    )
    masks, scores, _ = dec.run(
        None,
        {
            **common,
            "mask_input": logits,
            "has_mask_input": np.ones(1, np.float32),
        },
    )
    del _b64  # (kept symmetric with the module style)
    m = np.asarray(masks).squeeze()
    if m.shape != (h, w):
        m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
    return (m > 0).astype(np.uint8) * 255


_sam_cache: "dict[str, object]" = {}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to a saliency ONNX model (or SAM encoder for --sam)")
    ap.add_argument(
        "--sam",
        action="store_true",
        help="promptable SAM mode: stdin JSON {frame: <b64 png>, clicks: [[x, y, pos], ...]}",
    )
    args = ap.parse_args()

    if args.sam:
        import json as _json

        payload = _json.loads(sys.stdin.read())
        raw = base64.b64decode(payload["frame"])
        buf = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if frame is None:
            sys.stderr.write("roto_onnx: sam mode frame is not a decodable PNG\n")
            sys.exit(1)
        mask = sam_segment(frame, args.model, payload.get("clicks", []))
        ok, png = cv2.imencode(".png", mask)
        if not ok:
            sys.stderr.write("roto_onnx: PNG encode failed\n")
            sys.exit(1)
        sys.stdout.write(base64.b64encode(png.tobytes()).decode("ascii"))
        sys.stdout.flush()
        return

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
