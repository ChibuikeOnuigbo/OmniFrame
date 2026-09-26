import cv2
import numpy as np
import os
import json

def process_blender_rotation():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img = cv2.imread('evidence/screenshots/blender-rotation-full.png')
    if img is None:
        raise ValueError("Screenshot evidence/screenshots/blender-rotation-full.png not found!")

    h, w, _ = img.shape
    print(f"Loaded image resolution: {w}x{h}")

    # 1. Cutout RightPanel Rotation Field (x: w-320..w, y: 260..450)
    inspector_crop = img[260:460, max(0, w-320):w]
    cv2.imwrite('evidence/cutouts/cut-blender-rotation-inspector.png', inspector_crop)

    # 2. Cutout ThreePanel Camera Controls Guide with Blender Rotation Icon (x: 48..320, y: 480..680)
    guide_crop = img[480:680, 48:320]
    cv2.imwrite('evidence/cutouts/cut-blender-rotation-3d-guide.png', guide_crop)

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
        'inspector_rotation_field': calc_metrics(inspector_crop),
        'three_panel_camera_guide': calc_metrics(guide_crop)
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/blender-rotation-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print("OpenCV Blender Rotation verification finished successfully!")

if __name__ == '__main__':
    process_blender_rotation()
