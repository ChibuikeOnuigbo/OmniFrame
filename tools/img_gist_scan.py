#!/usr/bin/env python3
"""Structural gist scan of img_data_pack screenshots.

Privacy rule: this script NEVER runs OCR and never stores text, filenames
beyond an index, or pixel crops. It records only structural signals --
dimensions, aspect class, dominant palette, mean luminance, edge density --
used to decide which demo-data pack scenes to generate. All generated pack
assets replace real content with demo/test fields.
"""
import json
import os
import sys

import cv2
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), "..", "img_data_pack")
OUT = os.path.join(SRC, "processed", "gist-summary.json")


def gist(path: str) -> dict:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        return {"ok": False}
    h, w = img.shape[:2]
    aspect = w / max(h, 1)
    if aspect < 0.8:
        device = "portrait-phone-like"
    elif aspect > 2.0:
        device = "ultrawide-desktop-like"
    else:
        device = "landscape-desktop-like"
    small = cv2.resize(img, (160, 90), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    lum = float(gray.mean())
    theme = "dark" if lum < 110 else "light"
    edges = cv2.Canny(gray, 60, 160)
    edge_density = float((edges > 0).mean())
    if edge_density > 0.16:
        layout = "dense-ui"
    elif edge_density > 0.07:
        layout = "standard-ui"
    else:
        layout = "sparse-media"
    # Dominant palette via k-means (k=4) on the downscaled frame.
    data = small.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 8, 1.0)
    _, labels, centers = cv2.kmeans(data, 4, None, criteria, 2, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=4)
    order = np.argsort(-counts)
    palette = []
    for i in order[:3]:
        b, g, r = centers[i].astype(int)
        palette.append("#%02x%02x%02x" % (r, g, b))
    return {
        "ok": True,
        "w": int(w),
        "h": int(h),
        "aspect": round(float(aspect), 3),
        "device": device,
        "theme": theme,
        "layout": layout,
        "palette": palette,
    }


def main() -> int:
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
    records = []
    for i, name in enumerate(files):
        g = gist(os.path.join(SRC, name))
        g["index"] = i
        records.append(g)
    ok = [r for r in records if r.get("ok")]
    agg = {}
    for key in ("device", "theme", "layout"):
        agg[key] = {}
        for r in ok:
            agg[key][r[key]] = agg[key].get(r[key], 0) + 1
    agg["total"] = len(ok)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump({"aggregate": agg, "records": records}, fh, indent=1)
    print(json.dumps(agg, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
