#!/usr/bin/env python3
"""build-micro-sheets.py — turn runner evidence frames into watch sheets.

For each video id given (or every id in youtube-audit/runner/evidence that has
no sheet yet), composes frames s1/s3/s5 (fallback: first three present) into a
3x256x144 contact sheet at JPEG q78 — the exact micro-sheet spec used for the
248 watched tutorials — and writes youtube-audit/evidence/micro/<id>.jpg.

Usage:
  python3 tools/build-micro-sheets.py            # all missing
  python3 tools/build-micro-sheets.py ID1 ID2    # explicit ids
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = os.path.join(ROOT, 'youtube-audit', 'runner', 'evidence')
OUT = os.path.join(ROOT, 'youtube-audit', 'evidence', 'micro')
TILE = (256, 144)


def build(vid: str) -> bool:
    d = os.path.join(EV, vid)
    if not os.path.isdir(d):
        return False
    frames = [os.path.join(d, f) for f in ('s1.jpg', 's3.jpg', 's5.jpg') if os.path.exists(os.path.join(d, f))]
    if len(frames) < 3:
        names = sorted((x for x in os.listdir(d) if x.endswith('.jpg') and (x[0] in 'su')),
                       key=lambda x: (x[0], int(x[1:].split('.')[0])))
        frames = [os.path.join(d, x) for x in names]
    if len(frames) < 3:
        return False
    pick = [frames[0], frames[len(frames) // 2], frames[-1]]
    # legacy micro-sheet spec: 14px caption band (id) on top of 3x256x144 tiles
    sheet = Image.new('RGB', (TILE[0] * 3, TILE[1] + 14), 'black')
    from PIL import ImageDraw
    ImageDraw.Draw(sheet).text((3, 2), vid, fill='white')
    for i, fp in enumerate(pick):
        im = Image.open(fp).convert('RGB').resize(TILE)
        sheet.paste(im, (i * TILE[0], 14))
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f'{vid}.jpg'), quality=78)
    return True


def main() -> None:
    ids = sys.argv[1:]
    if not ids:
        have = set(f[:-4] for f in os.listdir(OUT) if f.endswith('.jpg')) if os.path.isdir(OUT) else set()
        ids = [d for d in sorted(os.listdir(EV)) if d not in have]
    ok = [v for v in ids if build(v)]
    print(f'sheets built: {len(ok)}/{len(ids)}')
    if len(ok) != len(ids):
        print('missing:', [v for v in ids if v not in ok])


if __name__ == '__main__':
    main()
