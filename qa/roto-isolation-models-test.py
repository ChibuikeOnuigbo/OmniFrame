#!/usr/bin/env python3
"""
Isolation-model test for the OmniRoto family (omni-roto-{general,human,anime,hair}-v1).

Three evidence tiers, so every number is honest about where its ground truth
came from:

  EXACT        In-repo RGBA cutouts (death-note characters, room objects) are
               composited onto clean backgrounds / synthetic backgrounds. The
               pasted alpha channel IS the ground truth, pixel for pixel.
  APPROX       The held-out studio portrait (fetched stock preview, never seen
               in training) is on a light seamless backdrop; GT = background
               suppression (luminance/saturation split calibrated on the
               border), largest connected keep.
  QUALITATIVE  The held-out hair close-up has no derivable GT; we report
               coverage and response only.

For every (image, model) pair we compute IoU at the app's 0.5 threshold and
best-IoU over thresholds (headroom). Predictions use the exact sidecar
preprocessing contract (resize 128x128 INTER_AREA, /255, min-max normalise,
upscale) so these numbers describe the shipped artefacts, not an idealised
pipeline.

Outputs:
  - console table
  - qa/reports/roto-isolation-models.json
  - evidence/rotomask-isolation/*.png  (overlay + isolated cutout per image)

Usage: python3 qa/roto-isolation-models-test.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
MODELS = ["omni-roto-general-v1", "omni-roto-human-v1", "omni-roto-anime-v1", "omni-roto-hair-v1"]
OUT = ROOT / "evidence/rotomask-isolation"
REPORT = ROOT / "qa/reports/roto-isolation-models.json"

_sessions: dict[str, ort.InferenceSession] = {}


def session(name: str) -> ort.InferenceSession:
    if name not in _sessions:
        _sessions[name] = ort.InferenceSession(
            str(ROOT / f"public/models/{name}.onnx"), providers=["CPUExecutionProvider"]
        )
    return _sessions[name]


def predict(name: str, rgb: np.ndarray) -> np.ndarray:
    """Mirror scripts/python/roto_onnx.py exactly (128px, min-max norm, upscale)."""
    sess = session(name)
    inp = sess.get_inputs()[0]
    size = 128
    for d in inp.shape:
        if isinstance(d, int) and d > 32:
            size = d
            break
    h, w = rgb.shape[:2]
    small = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = small.transpose(2, 0, 1)[None]
    out = sess.run(None, {inp.name: x})[0].astype(np.float32)
    mn, mx = float(out.min()), float(out.max())
    if mx - mn < 1e-8:
        out = np.zeros_like(out)
    else:
        out = (out - mn) / (mx - mn)
    prob = out[0, 0]
    gray = (np.clip(prob, 0, 1) * 255).astype(np.uint8)
    return cv2.resize(gray, (w, h), interpolation=cv2.INTER_LINEAR)


def iou(a: np.ndarray, b: np.ndarray) -> float:
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter / union) if union else 0.0


def best_iou(prob_u8: np.ndarray, gt: np.ndarray) -> tuple[float, float]:
    """IoU at 0.5 (app threshold) and best IoU over thresholds."""
    at_half = iou(prob_u8 > 127, gt > 127)
    best = 0.0
    for t in range(20, 240, 10):
        best = max(best, iou(prob_u8 > t, gt > 127))
    return at_half, best


def paste_on(bg: np.ndarray, fg_path: str, rel_h: float = 0.55, cx: float = 0.5, cy: float = 0.62) -> tuple[np.ndarray, np.ndarray]:
    """Paste an RGBA cutout onto bg; returns (composite RGB, exact GT uint8 mask)."""
    fg = cv2.imread(str(ROOT / fg_path), cv2.IMREAD_UNCHANGED)
    if fg is None:
        raise FileNotFoundError(fg_path)
    if fg.shape[2] == 3:
        fg = cv2.cvtColor(fg, cv2.COLOR_BGR2BGRA)
    fg = cv2.cvtColor(fg, cv2.COLOR_BGRA2RGBA)
    h, w = bg.shape[:2]
    scale = (h * rel_h) / fg.shape[0]
    nw, nh = int(fg.shape[1] * scale), int(fg.shape[0] * scale)
    fg = cv2.resize(fg, (nw, nh), interpolation=cv2.INTER_AREA)
    x0, y0 = int(w * cx - nw / 2), int(h * cy - nh / 2)
    comp = bg.copy()
    gt = np.zeros((h, w), np.uint8)
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(w, x0 + nw), min(h, y0 + nh)
    sub = fg[ys0 - y0: ys1 - y0, xs0 - x0: xs1 - x0]
    alpha = sub[:, :, 3:4].astype(np.float32) / 255.0
    comp[ys0:ys1, xs0:xs1] = (sub[:, :, :3] * alpha + comp[ys0:ys1, xs0:xs1] * (1 - alpha)).astype(np.uint8)
    gt[ys0:ys1, xs0:xs1] = (alpha[:, :, 0] * 255).astype(np.uint8)
    return comp, gt


def approx_gt_studio(rgb: np.ndarray) -> tuple[np.ndarray, str]:
    """APPROX GT for the seamless-backdrop studio portrait.

    Background = bright, low-saturation (calibrated on border pixels); the
    subject is the largest kept component after suppression.
    """
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    border = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
    thr = max(160.0, float(np.percentile(border, 25)) - 15)
    bg = (lum > thr) & (sat < 70)
    fg = ~bg
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = np.zeros_like(fg)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        keep[labels == biggest] = 255
    holes = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return holes, f"border-calibrated split (lum>{thr:.0f}, sat<70, largest CC)"


def sam_clicks(gt: np.ndarray, split: bool = False) -> list:
    """Prompt points for the SAM engine: deepest interior point of the
    largest component (per half when the case has two subjects)."""
    h, w = gt.shape
    out = []
    regions = []
    if split:
        regions = [(gt[:, : w // 2], 0), (gt[:, w // 2:], w // 2)]
    else:
        regions = [(gt, 0)]
    for reg, x0 in regions:
        n, labels = cv2.connectedComponents((reg > 127).astype(np.uint8), 8)
        if n < 2:
            continue
        biggest = 1 + int(np.bincount(labels.ravel())[1:].argmax())
        comp = labels == biggest
        er = cv2.erode(comp.astype(np.uint8), np.ones((41, 41), np.uint8))
        ys, xs = np.nonzero(er if er.any() else comp)
        if len(xs):
            out.append((float(xs.mean() + x0) / w, float(ys.mean()) / h))
    return out


def checker(h: int, w: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    c = (((yy // 16 + xx // 16) % 2) * 40 + 200).astype(np.uint8)
    return np.stack([c, c, c], axis=2)


def overlay(rgb: np.ndarray, prob: np.ndarray, gt: np.ndarray, model: str) -> np.ndarray:
    ov = rgb.copy()
    m = prob > 127
    red = ov.copy()
    red[m] = [0, 0, 255]
    ov = cv2.addWeighted(red, 0.45, ov, 0.55, 0)
    contours, _ = cv2.findContours((prob > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(ov, contours, -1, (0, 255, 0), 2)  # prediction = green
    contours, _ = cv2.findContours((gt > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(ov, contours, -1, (255, 128, 0), 2)  # ground truth = orange
    cv2.putText(ov, model, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    return ov


def isolated(rgb: np.ndarray, prob: np.ndarray) -> np.ndarray:
    a = (prob > 127).astype(np.float32)
    out = (rgb * a[:, :, None] + checker(*rgb.shape[:2]) * (1 - a[:, :, None])).astype(np.uint8)
    return out


SAM_ENC = None
SAM_DEC = None
SAM_MEAN = np.array([123.675, 116.28, 103.53], dtype=np.float32)
SAM_STD = np.array([58.395, 57.12, 57.375], dtype=np.float32)


def sam_segment(rgb: np.ndarray, clicks: list) -> np.ndarray:
    """MobileSAM promptable segmentation (mirrors the in-app engine):
    normalise -> pad to 1024, encode once, decode with iterative refinement."""
    global SAM_ENC, SAM_DEC
    if SAM_ENC is None:
        SAM_ENC = ort.InferenceSession(str(ROOT / "public/models/sam-mobile-encoder.onnx"), providers=["CPUExecutionProvider"])
        SAM_DEC = ort.InferenceSession(str(ROOT / "public/models/sam-mobile-decoder.onnx"), providers=["CPUExecutionProvider"])
    H, W = rgb.shape[:2]
    scale = 1024 / max(H, W)
    rw, rh = int(W * scale), int(H * scale)
    small = ((cv2.resize(rgb, (rw, rh)) - SAM_MEAN) / SAM_STD).astype(np.float32)
    x = np.zeros((1, 3, 1024, 1024), np.float32)
    x[0, :, :rh, :rw] = small.transpose(2, 0, 1)
    emb = SAM_ENC.run(None, {"image": x})[0]
    coords = np.array([[[c[0] * W * scale, c[1] * H * scale] for c in clicks]], np.float32)
    labels = np.array([[1.0] * len(clicks)], np.float32)
    common = {"image_embedding": emb, "point_coords": coords, "point_labels": labels,
              "orig_im_size": np.array([H, W], np.float32)}
    masks, _, logits = SAM_DEC.run(None, {**common, "mask_input": np.zeros((1, 1, 256, 256), np.float32),
                                          "has_mask_input": np.zeros(1, np.float32)})
    masks, _, _ = SAM_DEC.run(None, {**common, "mask_input": logits, "has_mask_input": np.ones(1, np.float32)})
    return np.asarray(masks).squeeze() > 0


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    bg_dn = cv2.cvtColor(cv2.imread(str(ROOT / "public/assets/death_note/clean_background.png")), cv2.COLOR_BGR2RGB)
    bg_room = cv2.cvtColor(cv2.imread(str(ROOT / "public/assets/room/clean_room_background.png")), cv2.COLOR_BGR2RGB)
    h, w = bg_dn.shape[:2]
    solid = np.full((720, 1280, 3), (60, 130, 140), np.uint8)
    yy, xx = np.mgrid[0:720, 0:1280]
    grad = np.stack([
        (xx / 1280 * 255).astype(np.uint8),
        (yy / 720 * 255).astype(np.uint8),
        ((xx + yy) / 2000 * 255).astype(np.uint8),
    ], axis=2)

    cases: list[dict] = []

    manifest: list[dict] = []
    comp_dir = ROOT / "qa/assets/roto/composites"
    comp_dir.mkdir(parents=True, exist_ok=True)

    def exact(name: str, comp: np.ndarray, gt: np.ndarray, note: str) -> None:
        cases.append({"name": name, "rgb": comp, "gt": gt, "tier": "EXACT", "note": note})
        ys, xs = np.nonzero(gt > 127)
        if len(xs):
            cv2.imwrite(str(comp_dir / f"{name}.png"), cv2.cvtColor(comp, cv2.COLOR_RGB2BGR))
            cv2.imwrite(str(comp_dir / f"{name}--gt.png"), gt)
            manifest.append({
                "name": name, "file": f"qa/assets/roto/composites/{name}.png",
                "gtCover": round(float((gt > 127).mean()), 4),
                "gtCentroid": [round(float(xs.mean()) / comp.shape[1], 4), round(float(ys.mean()) / comp.shape[0], 4)],
                "samClicks": [[round(x, 4), round(y, 4)] for x, y in sam_clicks(gt, split="+" in name)],
            })

    # --- EXACT tier: composites with pasted-alpha ground truth -----------------
    for ch in ["char_light", "char_l", "char_mello", "char_near", "char_ryuk"]:
        comp, gt = paste_on(bg_dn, f"public/assets/death_note/{ch}.png", rel_h=0.55)
        exact(f"{ch}@white-canvas", comp, gt, "RGBA cutout composited on clean scene bg")
    comp, gt = paste_on(bg_dn, "public/assets/death_note/char_light.png", rel_h=0.7, cx=0.35, cy=0.55)
    exact("char_light-large@white-canvas", comp, gt, "bigger paste, off-centre")
    comp, gt = paste_on(solid, "public/assets/death_note/char_light.png")
    exact("char_light@solid-teal", comp, gt, "flat synthetic background")
    comp, gt = paste_on(grad, "public/assets/death_note/char_light.png")
    exact("char_light@gradient", comp, gt, "synthetic gradient background")
    comp, gt = paste_on(bg_room, "public/assets/death_note/char_light.png")
    exact("char_light@room-photo", comp, gt, "anime cutout on real photo room bg")
    # two distinct subjects (dark, model-friendly) for the click-accumulation loop
    comp, gt = paste_on(bg_dn, "public/assets/death_note/char_mello.png", rel_h=0.5, cx=0.35, cy=0.62)
    comp2, gt2 = paste_on(comp, "public/assets/death_note/char_ryuk.png", rel_h=0.55, cx=0.68, cy=0.6)
    gt_comb = np.maximum(gt, gt2)
    exact("mello+ryuk@white-canvas", comp2, gt_comb, "two cutouts for the positive-click accumulation loop")

    comp, gt = paste_on(bg_room, "public/assets/room/obj_chair.png", rel_h=0.8, cx=0.55, cy=0.68)
    exact("obj_chair@room-photo", comp, gt, "real object on its clean room bg")
    comp, gt = paste_on(bg_room, "public/assets/room/obj_towel.png", rel_h=0.6, cx=0.42, cy=0.6)
    exact("obj_towel@room-photo", comp, gt, "real object on clean room bg")

    # --- APPROX tier: held-out studio portrait ---------------------------------
    human_path = ROOT / "image-search/full-body-woman-standing-studio-photo-pl-1.jpg"
    if human_path.exists():
        rgb = cv2.cvtColor(cv2.imread(str(human_path)), cv2.COLOR_BGR2RGB)
        gt, note = approx_gt_studio(rgb)
        cases.append({"name": "heldout-studio-person", "rgb": rgb, "gt": gt, "tier": "APPROX", "note": note})

    # --- QUALITATIVE tier: held-out hair close-up ------------------------------
    hair_path = ROOT / "image-search/woman-long-flowing-hair-close-up-portrai-1.jpg"
    if hair_path.exists():
        rgb = cv2.cvtColor(cv2.imread(str(hair_path)), cv2.COLOR_BGR2RGB)
        cases.append({"name": "heldout-hair-closeup", "rgb": rgb, "gt": None, "tier": "QUALITATIVE", "note": "no derivable GT; coverage only"})

    # held-out photos also go into the manifest (for the in-app browser test)
    if human_path.exists():
        rgb = cv2.cvtColor(cv2.imread(str(human_path)), cv2.COLOR_BGR2RGB)
        gt, _ = approx_gt_studio(rgb)
        ys, xs = np.nonzero(gt > 127)
        cv2.imwrite(str(comp_dir / "heldout-studio-person.png"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        manifest.append({
            "name": "heldout-studio-person", "file": "qa/assets/roto/composites/heldout-studio-person.png",
            "tier": "APPROX", "gtCover": round(float((gt > 127).mean()), 4),
            "gtCentroid": [round(float(xs.mean()) / rgb.shape[1], 4), round(float(ys.mean()) / rgb.shape[0], 4)],
        })
    if hair_path.exists():
        rgb = cv2.cvtColor(cv2.imread(str(hair_path)), cv2.COLOR_BGR2RGB)
        cv2.imwrite(str(comp_dir / "heldout-hair-closeup.png"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        manifest.append({
            "name": "heldout-hair-closeup", "file": "qa/assets/roto/composites/heldout-hair-closeup.png",
            "tier": "QUALITATIVE", "gtCover": None, "gtCentroid": [0.5, 0.45],
        })

    # --- run the matrix ---------------------------------------------------------
    results = []
    cols = MODELS + ["sam-mobile-v1"]
    print(f"{'case':34s} {'tier':10s} " + " ".join(f"{(m.split('-')[2] if m != 'sam-mobile-v1' else 'sam'):>13s}" for m in cols))
    for case in cases:
        row = {"case": case["name"], "tier": case["tier"], "gtNote": case["note"], "models": {}}
        # SAM (promptable): use the recorded per-case prompt points
        man = next((m for m in manifest if m["name"] == case["name"]), None)
        sam_pts = man.get("samClicks") if man else None
        if not sam_pts and case.get("gtCentroid"):
            sam_pts = [case["gtCentroid"]]
        sam_cell = ""
        if sam_pts and len(clicks_ok := [c for c in sam_pts if c]):
            try:
                sam_mask = sam_segment(case["rgb"], clicks_ok)
                if case["gt"] is not None:
                    iou_s = iou(sam_mask, case["gt"] > 127)
                    row["models"]["sam-mobile-v1"] = {"iouHalf": round(iou_s, 4), "iouBest": round(iou_s, 4),
                                                      "predCover": round(float(sam_mask.mean()), 4),
                                                      "gtCover": round(float((case["gt"] > 127).mean()), 4)}
                    sam_cell = f"{iou_s*100:5.1f}/{iou_s*100:4.1f}%"
                else:
                    row["models"]["sam-mobile-v1"] = {"predCover": round(float(sam_mask.mean()), 4)}
                    sam_cell = f"{sam_mask.mean()*100:11.1f}%"
            except Exception as e:  # noqa: BLE001
                row["models"]["sam-mobile-v1"] = {"error": str(e)}
                sam_cell = "        error"
        cells = []
        for m in MODELS:
            prob = predict(m, case["rgb"])
            if case["gt"] is not None:
                at_half, best = best_iou(prob, case["gt"])
                cover = float((prob > 127).mean())
                row["models"][m] = {"iouHalf": round(at_half, 4), "iouBest": round(best, 4),
                                    "predCover": round(cover, 4), "gtCover": round(float((case["gt"] > 127).mean()), 4)}
                cells.append(f"{at_half*100:5.1f}/{best*100:4.1f}%")
            else:
                cover = float((prob > 127).mean())
                row["models"][m] = {"predCover": round(cover, 4)}
                cells.append(f"{cover*100:11.1f}%")
            if m in ("omni-roto-anime-v1", "omni-roto-general-v1") or case["name"].startswith(("obj_", "heldout")):
                tag = case["name"].replace("@", "-at-").replace(" ", "_")
                cv2.imwrite(str(OUT / f"{tag}--{m}.png"), cv2.cvtColor(overlay(case["rgb"], prob, case["gt"] if case["gt"] is not None else np.zeros_like(prob), m), cv2.COLOR_RGB2BGR))
                cv2.imwrite(str(OUT / f"{tag}--{m}--isolated.png"), cv2.cvtColor(isolated(case["rgb"], prob), cv2.COLOR_RGB2BGR))
        cells.append(sam_cell if sam_cell else "             ")
        results.append(row)
        print(f"{case['name']:34s} {case['tier']:10s} " + " ".join(f"{c:>13s}" for c in cells))

    # --- summary ----------------------------------------------------------------
    summary = {}
    for row in results:
        if row["tier"] == "QUALITATIVE":
            continue
        scored = {m: row["models"][m]["iouHalf"] for m in MODELS if m in row["models"]}
        if scored:
            winner = max(scored, key=scored.get)
            summary.setdefault("winners", {})[row["case"]] = {"winner": winner, "iouHalf": scored[winner]}
    exact_rows = [r for r in results if r["tier"] == "EXACT"]
    for m in MODELS + ["sam-mobile-v1"]:
        ious = [r["models"][m]["iouHalf"] for r in exact_rows if m in r["models"] and "iouHalf" in r["models"][m]]
        summary.setdefault("exactMeanIouHalf", {})[m] = round(sum(ious) / len(ious), 4) if ious else None
    wins = [v["winner"] for v in summary.get("winners", {}).values() if "heldout" not in [k for k in summary["winners"] if summary["winners"][k] is v]]
    summary["winCounts"] = {m: wins.count(m) for m in MODELS}

    REPORT.write_text(json.dumps({"results": results, "summary": summary}, indent=2))
    (ROOT / "qa/assets/roto/composites/manifest.json").write_text(json.dumps(manifest, indent=2))
    print("\nExact-tier mean IoU@0.5:", json.dumps(summary["exactMeanIouHalf"], indent=2))
    print("Win counts (IoU@0.5):", summary["winCounts"])
    print(f"Report: {REPORT}")
    print(f"Overlays: {OUT}/")


if __name__ == "__main__":
    main()
