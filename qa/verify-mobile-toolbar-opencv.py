import cv2
import numpy as np
import os
import json

def process_mobile_toolbar():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img = cv2.imread('evidence/screenshots/mobile-drawing-toolbar-responsive.png')
    if img is None:
        raise ValueError("Screenshot evidence/screenshots/mobile-drawing-toolbar-responsive.png not found!")

    h, w, _ = img.shape
    print(f"Loaded mobile screenshot: {w}x{h}")

    # Crop the floating drawing toolbar area near top (y: 35..110, x: 5..385)
    toolbar_crop = img[35:105, 5:min(w-5, 385)]
    cv2.imwrite('evidence/cutouts/cut-mobile-drawing-toolbar.png', toolbar_crop)

    gray = cv2.cvtColor(toolbar_crop, cv2.COLOR_BGR2GRAY)
    metrics = {
        'laplacian_variance_sharpness': round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2),
        'contrast_std': round(float(gray.std()), 2),
        'mean_brightness': round(float(gray.mean()), 2),
        'width': toolbar_crop.shape[1],
        'height': toolbar_crop.shape[0]
    }

    print("Mobile Drawing Toolbar Cutout Metrics:")
    print(json.dumps(metrics, indent=2))
    with open('qa/reports/mobile-toolbar-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

if __name__ == '__main__':
    process_mobile_toolbar()
