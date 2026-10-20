#!/usr/bin/env python3
"""Build testing_asset_etc/00-VETTING-REEL.mp4 — every preset's preview.mp4
in one numbered video (label burned in: "#07 karaoke-sweep — PERFECT or
HORRIBLE?"), so vetting needs a single watch. Also copies each preset MP4
into testing_asset_etc/videos/ so the videos are findable without digging
through per-preset folders full of PNG stills.

Run after qa/encode-vetting-mp4s.py:  python3 qa/build-vetting-reel.py
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = Path(__file__).resolve().parent.parent / "testing_asset_etc"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
TMP = Path("/tmp/vetting-reel")
TMP.mkdir(exist_ok=True)


def label_png(idx: int, total: int, spec: dict, out: Path) -> None:
    img = Image.new("RGBA", (854, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 8, 854, 56], fill=(8, 8, 14, 205))
    font = ImageFont.truetype(FONT, 25)
    small = ImageFont.truetype(FONT, 19)
    d.text((14, 20), f"#{idx:02d}/{total}", font=font, fill=(255, 209, 63, 255))
    d.text((118, 20), spec["preset"], font=font, fill=(255, 255, 255, 255))
    d.text((118, 46 - 24), "", font=small, fill=(255, 255, 255, 255))
    d.text((560, 23), "PERFECT or HORRIBLE?", font=small, fill=(150, 220, 255, 255))
    img.save(out)


def main() -> None:
    packs = []
    for pack in sorted(ROOT.iterdir()):
        if pack.is_dir() and (pack / "preview.mp4").exists() and (pack / "spec.json").exists():
            packs.append((pack, json.loads((pack / "spec.json").read_text())))
    if not packs:
        print("no packs found — run the export + encode scripts first")
        sys.exit(1)

    videos_dir = ROOT / "videos"
    videos_dir.mkdir(exist_ok=True)
    segs = []
    for i, (pack, spec) in enumerate(packs, 1):
        shutil.copy2(pack / "preview.mp4", videos_dir / f"{i:02d}-{spec['preset']}.mp4")
        lbl = TMP / f"label-{i:02d}.png"
        label_png(i, len(packs), spec, lbl)
        seg = TMP / f"seg-{i:02d}.mp4"
        cmd = [FF, "-y", "-i", str(pack / "preview.mp4"), "-i", str(lbl),
               "-filter_complex", "[0:v][1:v]overlay=0:H-h,format=yuv420p[v]",
               "-map", "[v]", "-map", "0:a", "-t", "2.4",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
               "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "1", str(seg)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"FAIL seg {spec['preset']}: {r.stderr[-300:]}")
            sys.exit(1)
        segs.append(seg)
        print(f"seg {i:02d} {spec['preset']}")

    list_file = TMP / "list.txt"
    list_file.write_text("".join(f"file '{s}'\n" for s in segs))
    reel = ROOT / "00-VETTING-REEL.mp4"
    r = subprocess.run([FF, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
                        "-c", "copy", "-movflags", "+faststart", str(reel)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL concat: {r.stderr[-300:]}")
        sys.exit(1)

    index = "\n".join(f"{i}. **{spec['preset']}** — {spec['name']} ({spec['category']}, demo “{spec['demoText']}”)"
                      for i, (_, spec) in enumerate(packs, 1))
    readme = ROOT / "README.md"
    text = readme.read_text()
    header = f"""# ▶ START HERE: [00-VETTING-REEL.mp4](00-VETTING-REEL.mp4)

**One video, every preset (79 s).** Each clip is numbered and named on
screen and has sound cues (whoosh in, pop on settle, ding out). Watch it,
then reply with the numbers: e.g. *"3, 7, 12 perfect — 5, 20 horrible"*.
Individual MP4s (same numbering) are in [videos/](videos/); per-preset
folders keep the WebM, stills and spec.json.

{index}

---

"""
    if "00-VETTING-REEL" not in text:
        readme.write_text(header + text)
    print(f"REEL DONE {reel} ({reel.stat().st_size // 1024} KB, {len(packs)} presets)")


if __name__ == "__main__":
    main()
