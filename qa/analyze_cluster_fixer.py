import cv2
import numpy as np
import json
import os

images = {
    "desktop_studio_settings": "evidence/screenshots/cluster-fixer-settings-desktop.png",
    "mobile_settings_360x800": "evidence/screenshots/cluster-fixer-settings-mobile-360x800.png",
    "context_menu_customizer": "evidence/cutouts/cut-settings-context-menu-customizer.png",
    "shortcuts_customizer": "evidence/cutouts/cut-settings-shortcuts-customizer.png",
    "inspector_unclustered": "evidence/cutouts/cut-inspector-unclustered-accordion.png",
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

with open("qa/reports/cluster-fixer-opencv-metrics.json", "w") as f:
    json.dump(results, f, indent=2)

print("Cluster Fixer OpenCV Analysis Complete:")
print(json.dumps(results, indent=2))
