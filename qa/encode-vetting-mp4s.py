#!/usr/bin/env python3
"""Encode testing_asset_etc/*/preview.webm -> preview.mp4 with a sound-cue
track (whoosh-in, settle pop, out ding; glitch ticks for Glitch category),
then rewrite testing_asset_etc/README.md with video-first vetting links.

Cues are synthesized test tones (ffmpeg lavfi), not music — they exist so a
human vetting the MP4 can hear whether the motion lands on the cue.
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = Path(__file__).resolve().parent.parent / "testing_asset_etc"


def encode(pack: Path, spec: dict) -> None:
    webm = pack / "preview.webm"
    mp4 = pack / "preview.mp4"
    if not webm.exists():
        print(f"skip {pack.name} (no webm)")
        return
    cues = spec.get("soundCues", [])
    inputs = ["-i", str(webm)]
    filters = []
    labels = []
    for i, cue in enumerate(cues):
        t_ms = int(cue["t"] * 1000)
        if cue["kind"] == "whoosh":
            inputs += ["-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.6"]
            filters.append(f"[{i + 1}:a]afade=t=in:st=0:d=0.08,afade=t=out:st=0.4:d=0.3,volume=0.35,adelay={t_ms}|{t_ms}[c{i}]")
        elif cue["kind"] == "pop":
            inputs += ["-f", "lavfi", "-i", "sine=frequency=150:duration=0.12"]
            filters.append(f"[{i + 1}:a]afade=t=out:st=0:d=0.12,volume=0.8,adelay={t_ms}|{t_ms}[c{i}]")
        elif cue["kind"] == "tick":
            inputs += ["-f", "lavfi", "-i", "sine=frequency=2100:duration=0.03"]
            filters.append(f"[{i + 1}:a]volume=0.25,adelay={t_ms}|{t_ms}[c{i}]")
        else:  # ding
            inputs += ["-f", "lavfi", "-i", "sine=frequency=880:duration=0.35"]
            filters.append(f"[{i + 1}:a]afade=t=out:st=0:d=0.35,volume=0.3,adelay={t_ms}|{t_ms}[c{i}]")
        labels.append(f"[c{i}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=longest:normalize=0[a]")
    cmd = [FF, "-y", *inputs, "-filter_complex", ";".join(filters),
           "-map", "0:v", "-map", "[a]", "-vf", "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,fps=30",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "96k", "-t", "2.8", "-shortest", "-movflags", "+faststart", str(mp4)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {pack.name}: {r.stderr[-400:]}")
        sys.exit(1)
    print(f"mp4 {pack.name} ({mp4.stat().st_size // 1024} KB)")


def main() -> None:
    rows = []
    for pack in sorted(ROOT.iterdir()):
        if not pack.is_dir() or pack.name == 'videos' or not (pack / 'spec.json').exists():
            continue
        spec = json.loads((pack / "spec.json").read_text())
        encode(pack, spec)
        rows.append(spec)
    table = "\n".join(
        f"| {s['name']} | {s['category']} | {s['idealCharacters'][0]}–{s['idealCharacters'][1]} | "
        f"[▶ MP4 (sound cues)]({s['preset']}/preview.mp4) · [WebM]({s['preset']}/preview.webm) · "
        f"[f1]({s['preset']}/frame-1-early.png) [f2]({s['preset']}/frame-2-mid.png) [f3]({s['preset']}/frame-3-settled.png) · "
        f"[spec]({s['preset']}/spec.json) | | |"
        for s in rows
    )
    (ROOT / "README.md").write_text(f"""# Text preset test packs — vet the VIDEOS

**Watch `preview.mp4` in each folder** (2.8 s, with sound cues: whoosh as the
effect starts, a pop when the letters settle, a ding on the out — glitch
presets add ticks). `preview.webm` is the same capture without the cue mix.
Stills are kept as thumbnails only.

Mark each row **Perfect** or **Horrible** below (edit this file, or just tell
me in chat: "karaoke-sweep perfect, matrix horrible"). Approved presets
become the app's vetted defaults; horrible ones get rebuilt or cut.

## How the character-count problem is solved

Presets are **procedures, not recordings**: stagger/settle/wave key off each
letter's normalized position `u = i/(n-1)`, so any text length runs the same
animation shape. No preset forces the tutorial's character count — each has a
sweet spot (listed below) and the app warns live without blocking.

## Packs ({len(rows)} presets)

| Preset | Category | Ideal chars | ▶ Video + stills | Perfect? | Horrible? |
|---|---|---|---|---|---|---|
{table}

## Recreate / change the text

OmniFrame → Text panel → **Text Preset Library** → type ANY text → click the
preset. Seed re-rolls randomized looks; accent colour rethemes.

Regenerate: `node qa/export-text-preset-videos.mjs && python3 qa/encode-vetting-mp4s.py`
""")
    print(f"README updated ({len(rows)} packs)")


if __name__ == "__main__":
    main()
