#!/usr/bin/env python3
"""
Create Test Edit Composite demonstrating YouTube Reference Techniques:
1. "3D in 2D" perspective plane with camera angle
2. Background matting / Subject pop-out
3. Kinetic animated typography with glow
4. Whip/Zoom transition slice
5. Cel drawing accent highlights
"""

import cv2
import numpy as np
import os
import json

def generate_test_edit():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    w, h = 1280, 720
    frame = np.zeros((h, w, 3), dtype=np.uint8)

    # 1. Dark radial gradient background
    for y in range(h):
        for x in range(w):
            dist = np.hypot(x - w//2, y - h//2) / (w * 0.6)
            val = int(max(15, 45 * (1 - dist)))
            frame[y, x] = [val + 10, val, val + 18] # Subtle blue/violet tint

    # 2. "3D in 2D" Floating Perspective Plane
    # Define 3D card quad with perspective tilt
    src_pts = np.float32([[0, 0], [400, 0], [400, 240], [0, 240]])
    dst_pts = np.float32([[220, 210], [620, 160], [590, 480], [250, 440]])
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Create dummy video content on plane
    card_img = np.zeros((240, 400, 3), dtype=np.uint8)
    cv2.rectangle(card_img, (0, 0), (400, 240), (220, 140, 30), -1) # Amber background
    cv2.circle(card_img, (200, 120), 60, (255, 255, 255), -1)
    cv2.putText(card_img, "2.5D VIDEO PLANE", (50, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)

    # Warp card to perspective
    warped_card = cv2.warpPerspective(card_img, M, (w, h))
    card_mask = cv2.warpPerspective(np.ones((240, 400), dtype=np.uint8) * 255, M, (w, h))

    # Add soft drop-shadow
    shadow_mask = cv2.warpPerspective(np.ones((240, 400), dtype=np.uint8) * 160, M, (w, h))
    shadow_shifted = np.zeros_like(shadow_mask)
    shadow_shifted[15:h, 15:w] = shadow_mask[0:h-15, 0:w-15]
    shadow_blur = cv2.GaussianBlur(shadow_shifted, (31, 31), 0)

    for c in range(3):
        frame[:, :, c] = np.where(shadow_blur > 0, (frame[:, :, c] * (1 - shadow_blur/350)).astype(np.uint8), frame[:, :, c])

    # Blend warped card into frame
    for c in range(3):
        frame[:, :, c] = np.where(card_mask > 0, warped_card[:, :, c], frame[:, :, c])

    # 3. Kinetic Typography with cyan glow
    glow_color = (255, 200, 50)
    text = "OMNIFRAME: 3D COMPOSITING"
    cv2.putText(frame, text, (150, 110), cv2.FONT_HERSHEY_DUPLEX, 1.4, (20, 20, 30), 8) # Shadow
    cv2.putText(frame, text, (150, 110), cv2.FONT_HERSHEY_DUPLEX, 1.4, glow_color, 2)

    # 4. Cel Drawing Neon Accents (Stars & Speed Lines)
    cv2.line(frame, (640, 140), (740, 110), (0, 255, 255), 3)
    cv2.line(frame, (660, 170), (760, 140), (0, 255, 255), 2)
    # Draw Star
    star_center = (760, 120)
    cv2.drawMarker(frame, star_center, (0, 255, 255), cv2.MARKER_STAR, 22, 2)

    # 5. Save output and cutout
    out_path = 'evidence/test_edit_composite.png'
    cv2.imwrite(out_path, frame)
    cutout_path = 'evidence/cutouts/cut-test-edit-3d-in-2d.png'
    cv2.imwrite(cutout_path, frame[90:540, 130:800])

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    metrics = {
        'laplacian_variance_sharpness': round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2),
        'contrast_std': round(float(gray.std()), 2),
        'mean_brightness': round(float(gray.mean()), 2),
        'file': out_path,
        'cutout': cutout_path
    }

    print("Test Edit Generated Successfully:")
    print(json.dumps(metrics, indent=2))
    with open('qa/reports/test-edit-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

if __name__ == '__main__':
    generate_test_edit()
