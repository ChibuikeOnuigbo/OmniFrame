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

    # 1. Crop compact drawing toolbar near bottom of preview stage (y: 575..625, x: 10..380)
    toolbar_crop = img[580:620, 15:min(w-15, 375)]
    cv2.imwrite('evidence/cutouts/cut-mobile-drawing-toolbar.png', toolbar_crop)

    # 2. Crop tiny sequence ping icon near timeline (y: 620..660, x: 15..95)
    seq_icon_crop = img[620:660, 15:95]
    cv2.imwrite('evidence/cutouts/cut-timeline-seq-ping-icon.png', seq_icon_crop)

    def calc_metrics(cropped):
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        contrast = float(gray.std())
        mean_brightness = float(gray.mean())
        return {
            'laplacian_variance_sharpness': round(laplacian_var, 2),
            'contrast_std': round(contrast, 2),
            'mean_brightness': round(mean_brightness, 2),
            'width': cropped.shape[1],
            'height': cropped.shape[0]
        }

    metrics = {
        'mobile_drawing_toolbar': calc_metrics(toolbar_crop),
        'timeline_seq_ping_icon': calc_metrics(seq_icon_crop)
    }

    print("Mobile Drawing & Sequence Icon Metrics:")
    print(json.dumps(metrics, indent=2))
    with open('qa/reports/mobile-toolbar-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

if __name__ == '__main__':
    process_mobile_toolbar()
