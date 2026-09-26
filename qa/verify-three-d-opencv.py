import cv2
import numpy as np
import os
import json

def process_three_d_verification():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img = cv2.imread('evidence/screenshots/three-d-video-plane-composite.png')
    if img is None:
        raise ValueError("Screenshot evidence/screenshots/three-d-video-plane-composite.png not found!")

    h, w, _ = img.shape
    print(f"Loaded image resolution: {w}x{h}")

    # 1. Cutout 3D HUD Toolbar (Bottom Center of preview)
    # hudBox: x: 429, y: 562, width: 585, height: 40
    hud_crop = img[558:606, 425:1020]
    cv2.imwrite('evidence/cutouts/cut-three-d-hud-aim-toolbar.png', hud_crop)

    # 2. Cutout 3D Camera Aim Status Badge (Top Right of preview)
    # statusBox: x: 712, y: 108, width: 136, height: 25
    status_crop = img[104:138, 708:852]
    cv2.imwrite('evidence/cutouts/cut-three-d-aim-status-badge.png', status_crop)

    # 3. Cutout 2.5D Video Plane Center Area (Center of preview)
    plane_crop = img[150:520, 360:880]
    cv2.imwrite('evidence/cutouts/cut-three-d-video-plane.png', plane_crop)

    # 4. Cutout 3D Floating Object Region (Floating to the right of the plane)
    object_crop = img[220:480, 800:1080]
    cv2.imwrite('evidence/cutouts/cut-three-d-floating-object.png', object_crop)

    def calc_metrics(cropped):
        if cropped.size == 0:
            return {'error': 'empty crop'}
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
        'three_d_hud_toolbar': calc_metrics(hud_crop),
        'three_d_aim_status_badge': calc_metrics(status_crop),
        'three_d_video_plane': calc_metrics(plane_crop),
        'three_d_floating_object': calc_metrics(object_crop),
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/three-d-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print("OpenCV 3D in 2D Video Plane Verification Completed!")

if __name__ == '__main__':
    process_three_d_verification()
