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
    ('cursor-drag-ghost-pill', 'evidence/screenshots/cursor-drag-ghost-pill.png'),
    ('cursor-help-info-pill', 'evidence/screenshots/cursor-help-info-pill.png'),
    ('cursor-magnetized-drop-reticle', 'evidence/screenshots/cursor-magnetized-drop-reticle.png'),
    ('cursor-mac-sonoma-pack', 'evidence/screenshots/cursor-mac-sonoma-pack.png'),
    ('cursor-playground-settings', 'evidence/screenshots/cursor-playground-settings.png'),
    ('cut-cursor-drag-plus', 'evidence/cutouts/cut-cursor-drag-plus.png'),
    ('cut-cursor-help-question', 'evidence/cutouts/cut-cursor-help-question.png'),
    ('cut-cursor-settings-panel', 'evidence/cutouts/cut-cursor-settings-panel.png'),
    ('cut-cursor-click-burst', 'evidence/cutouts/cut-cursor-click-burst.png'),
    ('cut-cursor-drag-ghost-pill', 'evidence/cutouts/cut-cursor-drag-ghost-pill.png'),
    ('cut-cursor-help-info-pill', 'evidence/cutouts/cut-cursor-help-info-pill.png'),
    ('cut-cursor-magnetized-drop-reticle', 'evidence/cutouts/cut-cursor-magnetized-drop-reticle.png'),
    ('cut-cursor-playground', 'evidence/cutouts/cut-cursor-playground.png'),
    ('cursor-visibility-canvas-inspection', 'evidence/screenshots/cursor-visibility-canvas-inspection.png'),
    ('cursor-visibility-timeline-inspection', 'evidence/screenshots/cursor-visibility-timeline-inspection.png'),
    ('cursor-visibility-boundary-test', 'evidence/screenshots/cursor-visibility-boundary-test.png'),
    ('cut-cursor-canvas-visibility', 'evidence/cutouts/cut-cursor-canvas-visibility.png'),
    ('cut-cursor-timeline-visibility', 'evidence/cutouts/cut-cursor-timeline-visibility.png'),
    ('cut-cursor-boundary-entry', 'evidence/cutouts/cut-cursor-boundary-entry.png'),
    ('cursor-frame-playhead-scrub', 'evidence/screenshots/cursor-frame-playhead-scrub.png'),
    ('cursor-frame-modal-overlay', 'evidence/screenshots/cursor-frame-modal-overlay.png'),
    ('cursor-frame-inspector-slider', 'evidence/screenshots/cursor-frame-inspector-slider.png'),
    ('cursor-frame-3d-orbit', 'evidence/screenshots/cursor-frame-3d-orbit.png'),
    ('cut-cursor-frame-playhead-scrub', 'evidence/cutouts/cut-cursor-frame-playhead-scrub.png'),
    ('cut-cursor-frame-modal-overlay', 'evidence/cutouts/cut-cursor-frame-modal-overlay.png'),
    ('cut-cursor-frame-inspector-slider', 'evidence/cutouts/cut-cursor-frame-inspector-slider.png'),
    ('cut-cursor-frame-3d-orbit', 'evidence/cutouts/cut-cursor-frame-3d-orbit.png'),
    ('boundary-clip-cursor-drag-pill', 'evidence/screenshots/boundary-clip-cursor-drag-pill.png'),
    ('boundary-clip-timeline-labels', 'evidence/screenshots/boundary-clip-timeline-labels.png'),
    ('boundary-clip-inspector-controls', 'evidence/screenshots/boundary-clip-inspector-controls.png'),
    ('boundary-clip-mobile-viewport', 'evidence/screenshots/boundary-clip-mobile-viewport.png'),
    ('cut-boundary-clip-cursor-drag-pill', 'evidence/cutouts/cut-boundary-clip-cursor-drag-pill.png'),
    ('cut-boundary-clip-timeline-labels', 'evidence/cutouts/cut-boundary-clip-timeline-labels.png'),
    ('cut-boundary-clip-inspector-controls', 'evidence/cutouts/cut-boundary-clip-inspector-controls.png'),
    ('cut-boundary-clip-mobile-viewport', 'evidence/cutouts/cut-boundary-clip-mobile-viewport.png'),
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
