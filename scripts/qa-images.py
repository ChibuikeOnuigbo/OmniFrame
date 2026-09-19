#!/usr/bin/env python3
"""OpenCV measurements for collected editor references.

Reference screenshots are kept outside the product bundle. The measurements
are descriptive evidence for information architecture, not claims about
OmniFrame runtime pixels (browser screenshots require an installed browser).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np


folder = Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "qa/images")
output = Path(sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "/tmp/omniframe-qa/image-measurements.json")
allow_empty = "--allow-empty" in sys.argv
files = sorted([*folder.glob("*.png"), *folder.glob("*.jpg"), *folder.glob("*.jpeg")])
if not files:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"status": "no-images", "folder": str(folder), "note": "Add licensed/local captures before measuring."}, indent=2) + "\n")
    print(f"no reference images found in {folder}; folder is ready for licensed/local captures")
    if allow_empty:
        raise SystemExit(0)
    raise SystemExit(2)

measurements = []
for path in files:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"unable to decode {path}")
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)
    column_density = (edges > 0).mean(axis=0)
    row_density = (edges > 0).mean(axis=1)
    vertical_threshold = float(column_density.mean() + 2 * column_density.std())
    horizontal_threshold = float(row_density.mean() + 2 * row_density.std())
    vertical_candidates = np.flatnonzero(column_density >= vertical_threshold)
    horizontal_candidates = np.flatnonzero(row_density >= horizontal_threshold)
    measurements.append({
        "file": path.name,
        "width": width,
        "height": height,
        "aspect_ratio": round(width / height, 3),
        "dark_pixel_ratio_lt_48": round(float((gray < 48).mean()), 3),
        "edge_density": round(float((edges > 0).mean()), 3),
        "vertical_separator_candidates": vertical_candidates.tolist(),
        "horizontal_separator_candidates": horizontal_candidates.tolist(),
        "vertical_peak_count": int(len(vertical_candidates)),
        "horizontal_peak_count": int(len(horizontal_candidates)),
    })

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(measurements, indent=2) + "\n")
print(json.dumps(measurements, indent=2))
