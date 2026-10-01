import cv2
import numpy as np
import json
import os

screenshots = [
    {
        'id': 'SS-098',
        'file': 'evidence/screenshots/SS-098-ui-declutter-category-filters.png',
        'desc': 'Left Dock with Category Filter Pills (ALL, VID, 2D, 3D) reducing UI clutter across video, 2D paint, and 3D compositing',
    },
    {
        'id': 'SS-099',
        'file': 'evidence/screenshots/SS-099-submode-3d-materials-channel.png',
        'desc': '3D Scene Materials Sub-Mode Channel with temporary sub-rail icon and breadcrumb header navigation',
    },
    {
        'id': 'SS-100',
        'file': 'evidence/screenshots/SS-100-submode-text-presets-channel.png',
        'desc': 'Text & Titles Presets Sub-Mode Channel focused on title templates with temporary rail badge',
    },
    {
        'id': 'SS-101',
        'file': 'evidence/screenshots/SS-101-submode-omniframe-selection-channel.png',
        'desc': 'OmniFrame AI Selection Subtool Channel focused with sub-rail badge and non-destructive masking',
    },
    {
        'id': 'SS-102',
        'file': 'evidence/screenshots/SS-102-demo-edits-ledger-200-recreation.png',
        'desc': 'OmniFrame 200 Demo Edits recreation verification combining 3D in 2D video plane, 2D segmentation, and NLE timeline',
    },
]

cutouts = [
    {
        'id': 'CUT-109',
        'source': 'evidence/screenshots/SS-098-ui-declutter-category-filters.png',
        'output': 'evidence/cutouts/CUT-109-category-filter-rail.png',
        'desc': 'Close-up of Left Dock Icon Rail with Category Filter Pills (ALL, VID, 2D, 3D)',
        'crop': (35, 0, 480, 52), # y1, x1, y2, x2
    },
    {
        'id': 'CUT-110',
        'source': 'evidence/screenshots/SS-099-submode-3d-materials-channel.png',
        'output': 'evidence/cutouts/CUT-110-3d-materials-focused-panel.png',
        'desc': 'Close-up of focused 3D Materials section with PBR roughness, metallic, and emission controls',
        'crop': (35, 48, 480, 320),
    },
    {
        'id': 'CUT-111',
        'source': 'evidence/screenshots/SS-100-submode-text-presets-channel.png',
        'output': 'evidence/cutouts/CUT-111-text-presets-focused-panel.png',
        'desc': 'Close-up of focused Title Presets channel with Cinematic, Lower Third, and Glow styles',
        'crop': (35, 48, 480, 320),
    },
    {
        'id': 'CUT-112',
        'source': 'evidence/screenshots/SS-101-submode-omniframe-selection-channel.png',
        'output': 'evidence/cutouts/CUT-112-omniframe-selection-focused-panel.png',
        'desc': 'Close-up of focused OmniFrame AI Selection Subtool with 6 selection geometries and towel recolor',
        'crop': (35, 48, 480, 320),
    },
    {
        'id': 'CUT-113',
        'source': 'evidence/screenshots/SS-099-submode-3d-materials-channel.png',
        'output': 'evidence/cutouts/CUT-113-submode-breadcrumb-header.png',
        'desc': 'Close-up of Contextual Sub-Mode Breadcrumb Header (‹ Back / 3D Materials & PBR Shaders)',
        'crop': (35, 48, 80, 320),
    },
]

def analyze_image(path):
    img = cv2.imread(path)
    if img is None:
        return None
    h, w, c = img.shape
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(gray.std())
    brightness = float(gray.mean())
    return {
        'dimensions': f"{w}x{h}",
        'sharpness': round(sharpness, 2),
        'contrast': round(contrast, 2),
        'brightness': round(brightness, 2),
    }

results = {'screenshots': {}, 'cutouts': {}}

for s in screenshots:
    if os.path.exists(s['file']):
        metrics = analyze_image(s['file'])
        results['screenshots'][s['id']] = {
            'file': s['file'],
            'desc': s['desc'],
            'metrics': metrics,
        }
        print(f"✓ Analyzed {s['id']}: {metrics}")

for c in cutouts:
    if os.path.exists(c['source']):
        src = cv2.imread(c['source'])
        y1, x1, y2, x2 = c['crop']
        crop = src[y1:y2, x1:x2]
        cv2.imwrite(c['output'], crop)
        metrics = analyze_image(c['output'])
        results['cutouts'][c['id']] = {
            'file': c['output'],
            'desc': c['desc'],
            'metrics': metrics,
        }
        print(f"✓ Generated & analyzed {c['id']}: {metrics}")

out_path = 'qa/reports/submode-opencv-metrics.json'
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nAll OpenCV analysis complete! Saved to {out_path}")
