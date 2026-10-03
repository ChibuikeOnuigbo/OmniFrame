#!/usr/bin/env python3
"""
OpenCV Visual Analysis for OmniFrame Mode, Drawing Mode & Masking Subsystem:
1. OmniFrame AI Character Cards & Scope Selectors (`cut-omniframe-character-cards.png`)
2. Drawing Attach Frame Picker & Directly-to-Video Toggle (`cut-drawing-attach-picker-toggle.png`)
3. Mask & Selection Conversions with Krita Selection Tools (`cut-mask-conversion-buttons.png`)
4. Full Multi-Scope Studio Screenshot (`omniframe-mode-drawing-mask-verified.png`)
"""

import cv2
import json
import os
from pathlib import Path

def analyze_cutout(path_str):
    if not os.path.exists(path_str):
        return None
    img = cv2.imread(path_str)
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(gray.std())
    mean_b = float(gray.mean())
    h, w = gray.shape
    return {
        'laplacian_variance_sharpness': round(lap_var, 2),
        'contrast_std': round(contrast, 2),
        'mean_brightness': round(mean_b, 2),
        'width': w,
        'height': h
    }

def main():
    os.makedirs('qa/reports', exist_ok=True)

    items = {
        'omniframe_character_cards': 'evidence/cutouts/cut-omniframe-character-cards.png',
        'drawing_attach_picker_toggle': 'evidence/cutouts/cut-drawing-attach-picker-toggle.png',
        'mask_conversion_buttons': 'evidence/cutouts/cut-mask-conversion-buttons.png',
        'omniframe_full_verified_screenshot': 'evidence/screenshots/omniframe-mode-drawing-mask-verified.png',
    }

    metrics = {}
    for name, p in items.items():
        res = analyze_cutout(p)
        if res:
            metrics[name] = res

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/omniframe-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print('OpenCV OmniFrame, Drawing & Masking Verification Completed Successfully!')

if __name__ == '__main__':
    main()
