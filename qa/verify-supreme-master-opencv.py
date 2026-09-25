import cv2
import numpy as np
import os
import json

def process_supreme_master():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img = cv2.imread('evidence/screenshots/supreme-master-verification.png')
    if img is None:
        raise ValueError("Screenshot evidence/screenshots/supreme-master-verification.png not found!")

    h, w, _ = img.shape
    print(f"Loaded image resolution: {w}x{h}")

    # 1. Cutout Left Rail & Dock Tabs (x: 0..320, y: 0..600)
    rail_crop = img[40:550, 0:320]
    cv2.imwrite('evidence/cutouts/cut-supreme-left-dock.png', rail_crop)

    # 2. Cutout TopBar with Templates button (y: 0..50, x: w-450..w)
    topbar_crop = img[0:50, max(0, w-500):w]
    cv2.imwrite('evidence/cutouts/cut-supreme-topbar-templates.png', topbar_crop)

    # 3. Cutout Drawing Panel with Apply to All Frames toggle (x: 48..320, y: 40..350)
    drawing_toggle_crop = img[40:350, 48:320]
    cv2.imwrite('evidence/cutouts/cut-supreme-apply-all-frames.png', drawing_toggle_crop)

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
        'left_dock_tabs': calc_metrics(rail_crop),
        'topbar_templates_button': calc_metrics(topbar_crop),
        'apply_to_all_frames_toggle': calc_metrics(drawing_toggle_crop)
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/supreme-master-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

if __name__ == '__main__':
    process_supreme_master()
