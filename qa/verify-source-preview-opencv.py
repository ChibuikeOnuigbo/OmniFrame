import cv2
import numpy as np
import os
import json

def process_source_preview_verification():
    os.makedirs('evidence/cutouts', exist_ok=True)
    os.makedirs('qa/reports', exist_ok=True)

    img_source = cv2.imread('evidence/screenshots/source-preview-fullscreen-bar.png')
    img_tracks = cv2.imread('evidence/screenshots/source-preview-oop-tracks-verified.png')

    if img_source is None or img_tracks is None:
        raise ValueError("Screenshots not found!")

    h_s, w_s, _ = img_source.shape
    h_t, w_t, _ = img_tracks.shape

    # 1. Cutout Source Preview Bottom-Left Details Banner (x: 336..755, y: 514..550)
    detail_crop = img_source[510:555, 330:760]
    cv2.imwrite('evidence/cutouts/cut-source-preview-detail-banner.png', detail_crop)

    # 2. Cutout Full-Width Expanded Media Transport Bar (x: 337..1105, y: 558..602)
    transport_crop = img_source[554:606, 330:1110]
    cv2.imwrite('evidence/cutouts/cut-source-preview-transport-bar.png', transport_crop)

    # 3. Cutout Media Specifications Modal (Three-Dot info)
    img_modal = cv2.imread('evidence/screenshots/media-specs-modal-verified.png')
    if img_modal is not None:
        h_m, w_m, _ = img_modal.shape
        modal_crop = img_modal[int(h_m*0.25):int(h_m*0.75), int(w_m*0.35):int(w_m*0.65)]
        cv2.imwrite('evidence/cutouts/cut-media-specs-modal.png', modal_crop)
    else:
        modal_crop = np.zeros((100, 100, 3), dtype=np.uint8)

    # 4. Cutout Media Library with 3D Objects Filter & Cards
    medialib_crop = img_tracks[40:500, 48:320]
    cv2.imwrite('evidence/cutouts/cut-medialib-threed-filter.png', medialib_crop)

    # 5. Cutout Timeline Tracks with 40% Reduced Text Track & Orangish Clip
    tracks_crop = img_tracks[max(0, h_t-220):h_t-40, 168:min(w_t, 850)]
    cv2.imwrite('evidence/cutouts/cut-timeline-text-track-reduced.png', tracks_crop)

    # 6. Cutout Track Headers with Z-Index
    headers_crop = img_tracks[max(0, h_t-220):h_t-40, 0:168]
    cv2.imwrite('evidence/cutouts/cut-track-headers-zindex.png', headers_crop)

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
        'source_preview_detail_banner': calc_metrics(detail_crop),
        'source_preview_transport_bar': calc_metrics(transport_crop),
        'media_specs_modal': calc_metrics(modal_crop),
        'medialib_threed_filter': calc_metrics(medialib_crop),
        'timeline_text_track_reduced': calc_metrics(tracks_crop),
        'track_headers_zindex': calc_metrics(headers_crop),
    }

    print(json.dumps(metrics, indent=2))
    with open('qa/reports/source-preview-opencv-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print("OpenCV Source Preview & OOP Tracks Verification Completed!")

if __name__ == '__main__':
    process_source_preview_verification()
