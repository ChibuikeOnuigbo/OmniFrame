"""Encode the captured transition frames into transistion_video_result/.

One MP4 per preset (CLIP 1 -> transition at its BASE seconds -> CLIP 2),
one combined reel with a title card per preset, and README.md linking every
video. Frames come from qa/render-transition-videos.mjs (/tmp/tvframes).
"""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = '/tmp/tvframes'
OUT = os.path.join(os.getcwd(), 'transistion_video_result')
SEQ = os.path.join(ROOT, 'reel-seq')
FPS = 24
CARD_FRAMES = 20  # ~0.83s per title card

manifest = json.load(open(os.path.join(ROOT, 'manifest.json')))
items = manifest['items']
os.makedirs(OUT, exist_ok=True)
os.makedirs(SEQ, exist_ok=True)

BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def encode(frame_dir, out_path, pattern='f%04d.jpg'):
    subprocess.run([FF, '-y', '-framerate', str(FPS), '-i', os.path.join(frame_dir, pattern),
                    '-vf', 'scale=1280:720', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-crf', '21', '-movflags', '+faststart', out_path],
                   check=True, capture_output=True)

def title_card(item, idx):
    img = Image.new('RGB', (1280, 720), (13, 13, 18))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1280, 6], fill=(245, 158, 11))
    d.text((80, 150), f"{idx + 1:02d} / {len(items)}  ·  {item['category'].upper()}", font=ImageFont.truetype(BOLD, 26), fill=(160, 160, 175))
    d.text((80, 210), item['name'], font=ImageFont.truetype(BOLD, 72), fill=(255, 255, 255))
    d.text((80, 330), f"base {item['baseDuration']}s  ·  applied {item['appliedDuration']}s  ·  adjustable 0.1-5s",
           font=ImageFont.truetype(REG, 34), fill=(120, 200, 255))
    d.text((80, 400), 'transition between CLIP 1 and CLIP 2, rendered in the OmniFrame editor',
           font=ImageFont.truetype(REG, 26), fill=(120, 120, 135))
    d.rectangle([80, 560, 1200, 562], fill=(40, 40, 52))
    d.text((80, 590), 'OmniFrame transition reel', font=ImageFont.truetype(BOLD, 24), fill=(90, 90, 105))
    path = os.path.join(SEQ, f'card-{item["id"]}.jpg')
    img.save(path, quality=90)
    return path

seq_index = 0
def add_seq(src):
    global seq_index
    dst = os.path.join(SEQ, f's{seq_index:05d}.jpg')
    os.link(src, dst)
    seq_index += 1

for idx, item in enumerate(items):
    # per-preset video
    encode(os.path.join(ROOT, item['id']), os.path.join(OUT, f"{item['id']}.mp4"))
    # reel: title card then the segment frames
    card = title_card(item, idx)
    for _ in range(CARD_FRAMES):
        add_seq(card)
    fdir = os.path.join(ROOT, f"reel-{item['id']}")
    for fn in sorted(os.listdir(fdir)):
        add_seq(os.path.join(fdir, fn))
    print('encoded', item['id'])

encode(SEQ, os.path.join(OUT, 'all-transitions-reel.mp4'), pattern='s%05d.jpg')
print('encoded reel')

# --- README.md index ---------------------------------------------------------
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.mp4'))
lines = []
lines.append('# Transition video results')
lines.append('')
lines.append('Every transition preset rendered for real inside the OmniFrame editor at '
             f'{FPS} fps, between the two test clips (**CLIP 1** `#dc2645` -> **CLIP 2** `#2456e6`, '
             '6 s each, cut at 6 s). Each video was produced through the agent surface '
             '(`window.__omniframe_transitions.apply`) with the preset\'s **base duration**; frames were '
             'captured from the live editor canvas (`qa/render-transition-videos.mjs`) and encoded by '
             '`qa/encode-transition-videos.py`.')
lines.append('')
lines.append('A transition always sits **between two clips**: the clip on each side of the cut must hold at '
             'least `duration / 2` seconds of material. Every preset ships a **base** number of seconds; you can '
             'raise or lower it in the Transitions panel (slider + chips), but the applied value is capped to '
             '**0.1 s floor / 5 s ceiling**.')
lines.append('')
lines.append(f'- **Combined reel (all {len(items)} transitions, title cards included):** [all-transitions-reel.mp4](./all-transitions-reel.mp4)')
lines.append(f'- Total video payload: {total / 1e6:.1f} MB')
lines.append('')
lines.append('| # | Transition | Category | Base (s) | Applied (s) | Video |')
lines.append('|---|------------|----------|----------|-------------|-------|')
for i, item in enumerate(items, 1):
    lines.append(f"| {i} | {item['name']} | {item['category']} | {item['baseDuration']} | {item['appliedDuration']} "
                 f"| [{item['id']}.mp4](./{item['id']}.mp4) |")
lines.append('')
lines.append('## Re-render')
lines.append('')
lines.append('```bash')
lines.append('LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/render-transition-videos.mjs')
lines.append('python3 qa/encode-transition-videos.py')
lines.append('```')
lines.append('')
open(os.path.join(OUT, 'README.md'), 'w').write('\n'.join(lines))
print('README.md written,', len(items), 'videos + reel')
shutil.rmtree(ROOT, ignore_errors=True)
