"""Create full-duration, timestamped review evidence without retaining source media."""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
from pathlib import Path


def probe_media(source: Path, ffprobe: str = "ffprobe") -> dict:
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(source)],
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    data = json.loads(result.stdout)
    duration = float(data.get("format", {}).get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Source has no positive measured duration")
    if not any(stream.get("codec_type") == "video" for stream in data.get("streams", [])):
        raise ValueError("Source has no video stream")
    return {"duration_seconds": duration, "probe": data}


def review_interval(duration: float) -> float:
    """Keep complete temporal coverage while capping very long tutorials."""
    if duration <= 180:
        return 2.0
    if duration <= 900:
        return 5.0
    return max(5.0, duration / 240.0)


def extract_review(source: Path, destination: Path, ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe") -> dict:
    destination.mkdir(parents=True, exist_ok=True)
    measured = probe_media(source, ffprobe)
    duration = measured["duration_seconds"]
    interval = review_interval(duration)
    expected_samples = max(1, math.ceil(duration / interval))

    # Five columns × five rows. Every tile carries its source timestamp. Each
    # emitted sheet therefore covers 50 seconds for short-form edits at 2 s.
    vf = (
        f"fps=1/{interval:.6f},"
        "scale=236:131:force_original_aspect_ratio=decrease,"
        "pad=240:135:(ow-iw)/2:(oh-ih)/2:black,setsar=1,"
        "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:"
        "text='%{pts\\:hms}':x=5:y=h-th-5:fontsize=13:fontcolor=white:"
        "box=1:boxcolor=black@0.65,"
        "tile=5x5:padding=2:margin=2:color=black"
    )
    pattern = destination / "sheet-%03d.jpg"
    environment = dict(os.environ)
    environment.setdefault("XDG_CACHE_HOME", str(destination / ".cache"))
    result = subprocess.run(
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(source), "-an", "-vf", vf, "-q:v", "5", str(pattern)],
        capture_output=True,
        text=True,
        timeout=1200,
        env=environment,
    )
    sheets = sorted(path.name for path in destination.glob("sheet-*.jpg") if path.stat().st_size > 0)
    if result.returncode != 0 or not sheets:
        raise RuntimeError((result.stderr or "No contact sheets were created")[-1600:])

    report = {
        "status": "FULL_DURATION_EVIDENCE",
        "duration_seconds": duration,
        "sample_interval_seconds": interval,
        "expected_sample_count": expected_samples,
        "contact_sheet_count": len(sheets),
        "tiles_per_sheet": 25,
        "contact_sheets": sheets,
        "coverage": "Uniform timestamped samples span measured source duration; this is review evidence, not continuous human playback.",
        "probe": measured["probe"],
    }
    (destination / "review.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()
    print(json.dumps(extract_review(args.source, args.destination, args.ffmpeg, args.ffprobe)))
