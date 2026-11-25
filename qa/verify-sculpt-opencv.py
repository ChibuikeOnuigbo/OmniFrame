"""Inspect real browser-rendered sculpt evidence; no synthetic reference frames."""
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np

out = Path('qa-output/sculpt')
before, after = (cv2.imread(str(out / name)) for name in ('before.png', 'after.png'))
assert before is not None and after is not None and before.shape == after.shape
changed = int(np.count_nonzero(np.any(cv2.absdiff(before, after) > 4, axis=2)))
assert changed > 100, 'brush must visibly deform the scene'
# The centered unsculpted sphere should remain circular in a non-16:9 panel.
mask = ((before.min(axis=2) > 85) & (np.ptp(before, axis=2) < 80)).astype(np.uint8)
count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
assert count > 1
largest = stats[1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])]
ratio = float(largest[cv2.CC_STAT_WIDTH] / largest[cv2.CC_STAT_HEIGHT])
assert .94 < ratio < 1.06, f'camera stretches the sphere: {ratio}'
video = next(iter(out.glob('omniframe-export.*')))
cap = cv2.VideoCapture(str(video))
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    assert frame.shape[:2] == (360, 640)
    frames.append(frame)
cap.release()
unique = len({hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames})
assert len(frames) >= 6 and unique >= 3, 'export must decode as moving geometry'
chosen = [frames[int((len(frames) - 1) * fraction)] for fraction in (.15, .4, .65, .85)]
assert all(float(frame.std()) > 10 for frame in chosen), 'blank export frame'
cv2.imwrite(str(out / 'video-contact-sheet.jpg'), np.vstack([np.hstack(chosen[:2]), np.hstack(chosen[2:])]))
report = dict(opencv=cv2.__version__, changed_preview_pixels=changed,
              unsculpted_sphere_width_height_ratio=ratio,
              decoded_video_frames=len(frames), distinct_video_frames=unique,
              exported_frame_size=[640, 360])
(out / 'opencv-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
