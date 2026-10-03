import cv2
import numpy as np
import json
import os

screenshots = [
    {
        'id': 'SS-093',
        'file': 'evidence/screenshots/SS-093-omniframe-selection-subtool.png',
        'desc': 'OmniFrame Selection & Masking Sub-Tool with 6 Selection Types, Invert, Grow/Shrink',
    },
    {
        'id': 'SS-094',
        'file': 'evidence/screenshots/SS-094-real-photo-room-towel-recolor-blue.png',
        'desc': 'Real Photo Room Towel recolored to Royal Blue with luminance-preserving folds',
    },
    {
        'id': 'SS-095',
        'file': 'evidence/screenshots/SS-095-real-photo-room-towel-recolor-red.png',
        'desc': 'Real Photo Room Towel recolored to Crimson Red on dark brown armchair',
    },
    {
        'id': 'SS-096',
        'file': 'evidence/screenshots/SS-096-real-photo-towel-infill-shift.png',
        'desc': 'Real Photo Towel shifted (+60, -20) with clean background infill behind it',
    },
    {
        'id': 'SS-097',
        'file': 'evidence/screenshots/SS-097-non-destructive-mask-layer-rubylith.png',
        'desc': 'Non-destructive Rubylith Mask Layer overlay (LumaCut mode) protecting background',
    },
]

cutouts = [
    {
        'id': 'CUT-104',
        'source': 'evidence/screenshots/SS-093-omniframe-selection-subtool.png',
        'output': 'evidence/cutouts/CUT-104-selection-subtool-types.png',
        'desc': 'Close-up of Selection & Masking Sub-Tool bar with Rect, Ellipse, Lasso, Polygon, Brush, Wand',
        'crop': (80, 0, 420, 360), # y1, x1, y2, x2
    },
    {
        'id': 'CUT-105',
        'source': 'evidence/screenshots/SS-094-real-photo-room-towel-recolor-blue.png',
        'output': 'evidence/cutouts/CUT-105-room-towel-recolor-blue.png',
        'desc': 'Close-up of Real Photo Royal Blue Draped Towel with fabric texture and lighting preserved',
        'crop': (120, 400, 700, 1000),
    },
    {
        'id': 'CUT-106',
        'source': 'evidence/screenshots/SS-095-real-photo-room-towel-recolor-red.png',
        'output': 'evidence/cutouts/CUT-106-room-towel-recolor-red.png',
        'desc': 'Close-up of Real Photo Crimson Red Draped Towel on Leather Armchair',
        'crop': (120, 400, 700, 1000),
    },
    {
        'id': 'CUT-107',
        'source': 'evidence/screenshots/SS-096-real-photo-towel-infill-shift.png',
        'output': 'evidence/cutouts/CUT-107-towel-infill-shifted.png',
        'desc': 'Close-up of shifted towel and clean infilled armchair background showing no ghosting',
        'crop': (120, 400, 700, 1080),
    },
    {
        'id': 'CUT-108',
        'source': 'evidence/screenshots/SS-097-non-destructive-mask-layer-rubylith.png',
        'output': 'evidence/cutouts/CUT-108-non-destructive-mask-rubylith.png',
        'desc': 'Close-up of Non-Destructive Rubylith mask preview overlay in preview canvas',
        'crop': (120, 400, 700, 1080),
    },
]

def calc_metrics(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(gray.std())
    brightness = float(gray.mean())
    return {
        'sharpness': round(sharpness, 2),
        'contrast': round(contrast, 2),
        'brightness': round(brightness, 2),
    }

metrics_data = {'screenshots': {}, 'cutouts': {}}

# Process screenshots
for sc in screenshots:
    img = cv2.imread(sc['file'])
    if img is not None:
        h, w = img.shape[:2]
        m = calc_metrics(img)
        m['dimensions'] = f'{w}x{h}'
        m['desc'] = sc['desc']
        metrics_data['screenshots'][sc['id']] = m
        print(f"Screenshot {sc['id']}: {w}x{h} | Sharpness: {m['sharpness']} | Contrast: {m['contrast']} | Brightness: {m['brightness']}")

# Process cutouts
os.makedirs('evidence/cutouts', exist_ok=True)
for ct in cutouts:
    img = cv2.imread(ct['source'])
    if img is not None:
        y1, x1, y2, x2 = ct['crop']
        cropped = img[y1:y2, x1:x2]
        cv2.imwrite(ct['output'], cropped)
        h, w = cropped.shape[:2]
        m = calc_metrics(cropped)
        m['dimensions'] = f'{w}x{h}'
        m['desc'] = ct['desc']
        metrics_data['cutouts'][ct['id']] = m
        print(f"Cutout {ct['id']}: {w}x{h} | Sharpness: {m['sharpness']} | Contrast: {m['contrast']} | Brightness: {m['brightness']}")

with open('qa/reports/selection-opencv-metrics.json', 'w') as f:
    json.dump(metrics_data, f, indent=2)

print('Metrics saved to qa/reports/selection-opencv-metrics.json')
