#!/usr/bin/env python3
"""Compare two QA screenshots and optional Playwright geometry reports.

The result is descriptive evidence: pixel error, edge overlap, aspect ratio,
corner/vector samples and panel-box deltas. It is not a visual quality score.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np


def image_metrics(image: np.ndarray) -> dict[str, Any]:
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)
    points = cv2.goodFeaturesToTrack(gray, maxCorners=80, qualityLevel=0.01, minDistance=8)
    vector_points = [] if points is None else [[round(float(point[0][0]), 2), round(float(point[0][1]), 2)] for point in points]
    return {
        "width": width,
        "height": height,
        "aspect_ratio": round(width / height, 5),
        "dark_pixel_ratio_lt_48": round(float((gray < 48).mean()), 5),
        "edge_density": round(float((edges > 0).mean()), 5),
        "vector_point_count": len(vector_points),
        "vector_points": vector_points,
    }


def load_geometry(path: Path | None) -> dict[str, Any] | None:
    if not path:
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    captures = value.get("captures", value if isinstance(value, list) else [])
    return {str(item.get("file", item.get("route", index))): item for index, item in enumerate(captures)}


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenCV screenshot and panel geometry comparison")
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--output", default="qa/measurements/compare.json")
    parser.add_argument("--diff-image")
    parser.add_argument("--baseline-geometry")
    parser.add_argument("--candidate-geometry")
    args = parser.parse_args()
    baseline = cv2.imread(args.baseline, cv2.IMREAD_COLOR)
    candidate = cv2.imread(args.candidate, cv2.IMREAD_COLOR)
    if baseline is None or candidate is None:
        raise SystemExit("both images must be decodable")
    if baseline.shape != candidate.shape:
        raise SystemExit(f"image dimensions differ: {baseline.shape} vs {candidate.shape}; crop or capture at the same viewport")
    difference = cv2.absdiff(baseline, candidate)
    gray_difference = cv2.cvtColor(difference, cv2.COLOR_BGR2GRAY)
    base_edges = cv2.Canny(cv2.cvtColor(baseline, cv2.COLOR_BGR2GRAY), 80, 160) > 0
    candidate_edges = cv2.Canny(cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY), 80, 160) > 0
    union = base_edges | candidate_edges
    intersection = base_edges & candidate_edges
    result: dict[str, Any] = {
        "baseline": image_metrics(baseline),
        "candidate": image_metrics(candidate),
        "mean_absolute_pixel_difference": round(float(difference.mean()), 5),
        "changed_pixel_ratio_gt_8": round(float((gray_difference > 8).mean()), 5),
        "edge_iou": round(float(intersection.sum() / union.sum()), 5) if union.any() else 1.0,
        "note": "descriptive image/vector evidence; not a fabricated visual-quality score",
    }
    if args.diff_image:
        diff_path = Path(args.diff_image)
        diff_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(diff_path), difference)
        result["diff_image"] = str(diff_path)
    baseline_geometry = load_geometry(Path(args.baseline_geometry) if args.baseline_geometry else None)
    candidate_geometry = load_geometry(Path(args.candidate_geometry) if args.candidate_geometry else None)
    if baseline_geometry and candidate_geometry:
        result["geometry_deltas"] = []
        for key in sorted(set(baseline_geometry) & set(candidate_geometry)):
            left = baseline_geometry[key].get("geometry", baseline_geometry[key])
            right = candidate_geometry[key].get("geometry", candidate_geometry[key])
            boxes = {}
            for selector in sorted(set(left.get("boxes", left)) & set(right.get("boxes", right))):
                a = left.get("boxes", left).get(selector)
                b = right.get("boxes", right).get(selector)
                if not a or not b:
                    continue
                boxes[selector] = {field: round(float(b[field]) - float(a[field]), 3) for field in ("x", "y", "width", "height") if field in a and field in b}
            result["geometry_deltas"].append({"capture": key, "boxes": boxes})
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
