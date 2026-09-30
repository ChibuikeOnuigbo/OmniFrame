import cv2
import json
import numpy as np
import os

images = [
    ('cursor-mac-default', 'evidence/screenshots/cursor-mac-default.png'),
    ('cursor-pointer-hover', 'evidence/screenshots/cursor-pointer-hover.png'),
    ('cursor-drag-plus-badge', 'evidence/screenshots/cursor-drag-plus-badge.png'),
    ('cursor-help-question-badge', 'evidence/screenshots/cursor-help-question-badge.png'),
    ('cursor-settings-customizer', 'evidence/screenshots/cursor-settings-customizer.png'),
    ('cursor-click-burst', 'evidence/screenshots/cursor-click-burst.png'),
    ('cut-cursor-drag-plus', 'evidence/cutouts/cut-cursor-drag-plus.png'),
    ('cut-cursor-help-question', 'evidence/cutouts/cut-cursor-help-question.png'),
    ('cut-cursor-settings-panel', 'evidence/cutouts/cut-cursor-settings-panel.png'),
    ('cut-cursor-click-burst', 'evidence/cutouts/cut-cursor-click-burst.png'),
]

results = {}

for name, path in images:
    if not os.path.exists(path):
        results[name] = {'error': f'File not found: {path}'}
        continue
    
    img = cv2.imread(path)
    if img is None:
        results[name] = {'error': f'Failed to decode: {path}'}
        continue

    h, w, c = img.shape
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Quantitative measurements
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_val = float(np.mean(gray))
    std_val = float(np.std(gray))
    min_val = float(np.min(gray))
    max_val = float(np.max(gray))

    results[name] = {
        'path': path,
        'width': w,
        'height': h,
        'channels': c,
        'sharpness_laplacian_var': round(laplacian_var, 2),
        'rms_contrast_std': round(std_val, 2),
        'mean_brightness': round(mean_val, 2),
        'dynamic_range': [min_val, max_val],
    }
    print(f"[{name}] {w}x{h} | Sharpness: {laplacian_var:.2f} | Contrast: {std_val:.2f} | Brightness: {mean_val:.2f}")

out_path = 'qa/reports/cursor-opencv-metrics.json'
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nOpenCV metrics successfully saved to {out_path}")
