import cv2
import numpy as np
import json
import os

images = {
    "full_screenshot": "evidence/screenshots/omniframe-vetted-decluttered-studio.png",
    "image_proof_canvas": "evidence/cutouts/cut-omniframe-vetting-image-deliverable.png",
    "frame_0": "evidence/cutouts/cut-omniframe-vetting-frame0.png",
    "frame_90_isolated": "evidence/cutouts/cut-omniframe-vetting-frame90-isolated.png",
    "frame_150_section": "evidence/cutouts/cut-omniframe-vetting-frame150-section.png",
    "infill_zero_ghost": "evidence/cutouts/cut-omniframe-vetting-infill-zero-ghost.png",
}

results = {}

for name, path in images.items():
    if not os.path.exists(path):
        results[name] = {"error": f"File not found: {path}"}
        continue
    img = cv2.imread(path)
    if img is None:
        results[name] = {"error": f"Failed to read image: {path}"}
        continue

    h, w, c = img.shape
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(gray.std())
    mean_brightness = float(gray.mean())

    results[name] = {
        "path": path,
        "width": w,
        "height": h,
        "channels": c,
        "sharpness_laplacian": round(laplacian_var, 2),
        "contrast_rms": round(contrast, 2),
        "mean_brightness": round(mean_brightness, 2),
        "valid": True
    }

# Check zero-ghost infill difference
if os.path.exists(images["infill_zero_ghost"]) and os.path.exists(images["frame_0"]):
    img_infill = cv2.imread(images["infill_zero_ghost"])
    img_f0 = cv2.imread(images["frame_0"])
    if img_infill.shape == img_f0.shape:
        diff = cv2.absdiff(img_infill, img_f0)
        diff_mean = float(diff.mean())
        results["zero_ghost_erasure_metric"] = {
            "mean_pixel_diff": round(diff_mean, 2),
            "zero_ghost_verified": diff_mean > 2.0
        }

with open("qa/reports/omniframe-vetting-opencv-metrics.json", "w") as f:
    json.dump(results, f, indent=2)

print("OmniFrame Vetting OpenCV Analysis Complete:")
print(json.dumps(results, indent=2))
