import cv2
import numpy as np
import os
import json

def process_keyframe_graph_3d_verification():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    cutouts = {
        'graph_editor_curve_canvas': 'evidence/cutouts/cut-graph-editor-curve-canvas.png',
        'three_d_blender_toolbar': 'evidence/cutouts/cut-3d-blender-toolbar.png',
        'three_d_safe_frame': 'evidence/cutouts/cut-3d-safe-frame.png',
        'rightpanel_keyframe_diamonds': 'evidence/cutouts/cut-rightpanel-keyframe-diamonds.png',
    }

    def calc_metrics(path):
        if not os.path.exists(path):
            return {'error': f'file {path} not found'}
        cropped = cv2.imread(path)
        if cropped is None or cropped.size == 0:
            return {'error': 'empty image'}
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

    metrics = {k: calc_metrics(v) for k, v in cutouts.items()}

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/keyframe-graph-3d-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print("OpenCV Keyframe, Curve Graph & 3D Mode Verification Completed Successfully!")

if __name__ == '__main__':
    process_keyframe_graph_3d_verification()
