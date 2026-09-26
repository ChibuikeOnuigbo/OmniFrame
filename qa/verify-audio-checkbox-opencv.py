import cv2
import numpy as np
import os
import json

def process_audio_checkbox_verification():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img = cv2.imread('evidence/screenshots/audio-inspector-checkbox-context.png')
    if img is None:
        raise ValueError("Screenshot evidence/screenshots/audio-inspector-checkbox-context.png not found!")

    h, w, _ = img.shape
    print(f"Loaded image resolution: {w}x{h}")

    # 1. Cutout RightPanel Audio Section with Checkbox & Custom Dropdown (Right panel roughly at x: 1100..w-36, y: 300..650)
    inspector_crop = img[280:650, 1120:w-36]
    cv2.imwrite('evidence/cutouts/cut-audio-inspector-checkbox.png', inspector_crop)

    # 2. Cutout LeftDock Audio Tab (Left rail roughly at x: 0..48, y: 40..150)
    leftdock_crop = img[40:150, 0:48]
    cv2.imwrite('evidence/cutouts/cut-leftdock-audio-tab.png', leftdock_crop)

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
        'audio_inspector_checkbox': calc_metrics(inspector_crop),
        'leftdock_audio_tab': calc_metrics(leftdock_crop),
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/audio-checkbox-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print("OpenCV Audio Checkbox & Context Verification Completed!")

if __name__ == '__main__':
    process_audio_checkbox_verification()
