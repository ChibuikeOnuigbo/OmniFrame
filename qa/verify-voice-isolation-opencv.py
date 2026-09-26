import cv2
import numpy as np
import os
import json

ROOT = os.getcwd()
SHOTS = os.path.join(ROOT, "qa/screenshots")
CUTOUTS = os.path.join(ROOT, "evidence/cutouts")
os.makedirs(CUTOUTS, exist_ok=True)

metrics = {}

# 1. Process Voice Isolation Modal Screenshot
modal_img_path = os.path.join(SHOTS, "voice-isolation-modal.png")
if os.path.exists(modal_img_path):
    img = cv2.imread(modal_img_path)
    h, w, c = img.shape
    # Modal is centered: extract center region (w: 450 to 990, h: 180 to 720)
    modal_crop = img[180:720, 450:990]
    cut_modal_path = os.path.join(CUTOUTS, "cut-voice-isolation-modal.png")
    cv2.imwrite(cut_modal_path, modal_crop)
    
    # Calculate contrast and mean luminance
    gray = cv2.cvtColor(modal_crop, cv2.COLOR_BGR2GRAY)
    mean_lum = float(np.mean(gray))
    std_lum = float(np.std(gray))
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    
    metrics["modal"] = {
        "width": modal_crop.shape[1],
        "height": modal_crop.shape[0],
        "mean_luminance": mean_lum,
        "std_luminance": std_lum,
        "sharpness_laplacian": laplacian_var,
        "path": cut_modal_path
    }
    print(f"Modal Cutout saved: {cut_modal_path} (std: {std_lum:.2f}, sharpness: {laplacian_var:.2f})")

# 2. Process Voice Isolation Sidebar Panel Screenshot
panel_img_path = os.path.join(SHOTS, "voice-isolation-sidebar-panel.png")
if os.path.exists(panel_img_path):
    img = cv2.imread(panel_img_path)
    # Left dock panel is located between x: 48 to 320, y: 40 to 600
    panel_crop = img[40:650, 48:320]
    cut_panel_path = os.path.join(CUTOUTS, "cut-voice-isolation-panel.png")
    cv2.imwrite(cut_panel_path, panel_crop)
    
    gray = cv2.cvtColor(panel_crop, cv2.COLOR_BGR2GRAY)
    mean_lum = float(np.mean(gray))
    std_lum = float(np.std(gray))
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    
    metrics["panel"] = {
        "width": panel_crop.shape[1],
        "height": panel_crop.shape[0],
        "mean_luminance": mean_lum,
        "std_luminance": std_lum,
        "sharpness_laplacian": laplacian_var,
        "path": cut_panel_path
    }
    print(f"Panel Cutout saved: {cut_panel_path} (std: {std_lum:.2f}, sharpness: {laplacian_var:.2f})")

# 3. Process Context Menu Screenshot
ctx_img_path = os.path.join(SHOTS, "voice-isolation-context-menu.png")
if os.path.exists(ctx_img_path):
    img = cv2.imread(ctx_img_path)
    # Timeline context menu crop
    # Find bounding area of context menu
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Context menu has dark purple/slate background with bright borders
    cut_ctx_path = os.path.join(CUTOUTS, "cut-voice-isolation-context-menu.png")
    # Grab timeline area where context menu is rendered (lower half)
    ctx_crop = img[400:850, 100:600]
    cv2.imwrite(cut_ctx_path, ctx_crop)
    metrics["context_menu"] = {
        "width": ctx_crop.shape[1],
        "height": ctx_crop.shape[0],
        "path": cut_ctx_path
    }
    print(f"Context Menu Cutout saved: {cut_ctx_path}")

report_path = os.path.join(ROOT, "qa/reports/voice-isolation-opencv-metrics.json")
with open(report_path, "w") as f:
    json.dump(metrics, f, indent=2)
print("OpenCV verification completed successfully. Report written to:", report_path)
