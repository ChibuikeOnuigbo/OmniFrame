import cv2
import numpy as np
import os
import json

def process_markers_and_meter():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img_modal = cv2.imread('qa/screenshots/marker-dialog-active.png')
    img_timeline = cv2.imread('qa/screenshots/timeline-markers-and-vu-meter.png')

    if img_modal is None or img_timeline is None:
        raise ValueError("Screenshots not found!")

    h, w, _ = img_modal.shape

    # 1. Cutout Marker Modal (centered in screen: ~x: 400..1040, y: 200..700)
    # The modal is centered, max-w-md w-full (around 448px width)
    # Let's crop modal area
    modal_crop = img_modal[int(h*0.2):int(h*0.8), int(w*0.3):int(w*0.7)]
    cv2.imwrite('evidence/cutouts/cut-marker-modal.png', modal_crop)

    # 2. Cutout Audio VU Meter in transport bar (bottom portion of screen above ruler)
    # Transport bar is around y: 640..730, x: 750..1150
    meter_crop = img_timeline[int(h*0.68):int(h*0.80), int(w*0.50):int(w*0.85)]
    cv2.imwrite('evidence/cutouts/cut-audio-vu-meter.png', meter_crop)

    # 3. Cutout Timeline Ruler with marker pin (y: ~710..780, x: 150..800)
    ruler_crop = img_timeline[int(h*0.72):int(h*0.85), int(w*0.12):int(w*0.65)]
    cv2.imwrite('evidence/cutouts/cut-timeline-ruler-markers.png', ruler_crop)

    def calc_metrics(img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        contrast = float(gray.std())
        mean_brightness = float(gray.mean())
        return {
            'laplacian_variance_sharpness': laplacian_var,
            'contrast_std': contrast,
            'mean_brightness': mean_brightness
        }

    metrics = {
        'marker_modal': calc_metrics(modal_crop),
        'audio_vu_meter': calc_metrics(meter_crop),
        'timeline_ruler_markers': calc_metrics(ruler_crop)
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/marker-audiometer-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

if __name__ == '__main__':
    process_markers_and_meter()
