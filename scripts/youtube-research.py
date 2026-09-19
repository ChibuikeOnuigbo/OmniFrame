#!/usr/bin/env python3
"""Opt-in YouTube feature research through yt-dlp metadata.

Default mode retrieves metadata only. It never downloads video, submits a form,
uses cookies, uploads footage or calls a remote service with project data.
Downloading requires both --download and --allow-download and is still limited
to a user-provided search/URL and a 250 MB per-file ceiling.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

QUERIES = [
    "video editor layers compositing masking tracking tutorial",
    "DaVinci Resolve Fusion point tracking masks compositing tutorial",
    "Blender compositor layers nodes transforms video editing tutorial",
    "After Effects layers blend modes masks tracking tutorial",
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def executable() -> str:
    path = shutil.which("yt-dlp")
    if path:
        return path
    raise RuntimeError("yt-dlp is not installed; install it in an isolated environment with python -m pip install yt-dlp")


def search(binary: str, query: str, count: int) -> dict[str, Any]:
    command = [binary, f"ytsearch{count}:{query}", "--flat-playlist", "--dump-single-json", "--skip-download", "--no-warnings"]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode != 0:
        return {"query": query, "status": "error", "error": (result.stderr or result.stdout).strip()[-2000:]}
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        return {"query": query, "status": "error", "error": f"yt-dlp returned invalid JSON: {error}"}
    entries = []
    for entry in value.get("entries", []):
        if not entry:
            continue
        entries.append({key: entry.get(key) for key in ("id", "title", "channel", "uploader", "duration", "webpage_url", "url")})
    return {"query": query, "status": "ok", "entries": entries}


def download(binary: str, url: str, output: Path) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=True)
    template = str(output / "%(id)s.%(ext)s")
    command = [binary, url, "--no-playlist", "--format", "bestvideo[height<=720]+bestaudio/best[height<=720]", "--max-filesize", "250M", "--write-info-json", "--no-overwrites", "--output", template]
    result = subprocess.run(command, capture_output=True, text=True, timeout=900, check=False)
    return {"url": url, "status": "downloaded" if result.returncode == 0 else "error", "output_tail": (result.stderr or result.stdout).strip()[-2000:]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Opt-in yt-dlp feature research")
    parser.add_argument("--query", action="append", help="repeatable ytsearch query; defaults to editor feature queries")
    parser.add_argument("--url", action="append", help="explicit video URL to record, or download with --download")
    parser.add_argument("--max-results", type=int, default=5)
    parser.add_argument("--output", default="research/youtube-features.json")
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--allow-download", action="store_true", help="required safety acknowledgement for video downloads")
    parser.add_argument("--download-dir", default="qa/fixtures/youtube")
    args = parser.parse_args()
    if args.download and not args.allow_download:
        parser.error("--download requires --allow-download; metadata-only mode is the default")
    try:
        binary = executable()
    except RuntimeError as error:
        print(f"youtube-research: {error}", file=sys.stderr)
        return 2
    queries = args.query or QUERIES
    report: dict[str, Any] = {"retrievedAt": now(), "tool": "yt-dlp", "downloaded": False, "networkPolicy": "metadata-only unless explicit download flags are supplied", "queries": [], "urls": []}
    for query in queries:
        report["queries"].append(search(binary, query, max(1, min(20, args.max_results))))
    for url in args.url or []:
        report["urls"].append({"url": url, "status": "recorded"})
        if args.download:
            report["urls"][-1] = download(binary, url, Path(args.download_dir))
            report["downloaded"] = True
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if any(item.get("status") == "ok" for item in report["queries"]) or report["urls"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
