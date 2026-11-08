#!/usr/bin/env python3
"""Build a truthful YouTube tutorial queue from an exported subscriptions CSV.

The local plan stage needs no network. The inventory stage is intended for the
existing GitHub audit runner, where yt-dlp and the owner's optional cookie file
are available. It records titles first, then queues only tutorial candidates;
decoded frames remain the workflow's evidence that footage was acquired.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STRONG_TUTORIAL = (
    "tutorial", "how to", "step by step", "step-by-step", "guide", "breakdown",
    "workflow", "tips", "tricks", "explained", "learn", "recreate", "making of",
    "behind the edit", "project file", "editing course",
)
EDITING_TOOLS = (
    "after effects", "after effect", "capcut", "alight motion", "premiere pro",
    "davinci resolve", "resolve", "blender", "cinema 4d", "c4d", "nuke",
    "final cut", "photoshop", "krita", "video editor", "motion graphics",
)
TECHNIQUES = (
    "edit", "effect", "transition", "blur", "light", "glow", "aura", "twixtor",
    "speed ramp", "speed curve", "keyframe", "mask", "rotoscop", "composit",
    "typography", "animation", "motion", "camera", "3d", "vfx", "color grade",
    "colour grade", "shake", "tracking", "liquify", "turbulent", "displacement",
    "particle", "text", "amv", "velocity", "graph", "preset", "overlay",
)
CHANNEL_HINTS = (
    "tutorial", "edit", "vfx", "motion", "animation", "amv", "creator", "design",
)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def hits(text: str, words: tuple[str, ...]) -> list[str]:
    return [word for word in words if word in text]


def channel_priority(title: str) -> tuple[int, list[str]]:
    text = normalized(title)
    reasons: list[str] = []
    score = 0
    if "tutorial" in text:
        score += 10
        reasons.append("tutorial-named channel")
    if any(word in text for word in ("edit", "vfx", "motion", "animation", "amv")):
        score += 6
        reasons.append("editing or motion channel name")
    if any(word in text for word in ("after effects", "capcut", "alight", "blender")):
        score += 5
        reasons.append("editor named in channel")
    return score, reasons or ["unclassified subscription"]


def classify_video(title: str, channel_title: str) -> tuple[bool, list[str]]:
    text = normalized(title)
    strong = hits(text, STRONG_TUTORIAL)
    tools = hits(text, EDITING_TOOLS)
    techniques = hits(text, TECHNIQUES)
    channel = normalized(channel_title)
    channel_is_tutorial = "tutorial" in channel
    reasons: list[str] = []
    if strong:
        reasons.append("tutorial phrase: " + ", ".join(strong[:3]))
    if tools and techniques:
        reasons.append("editor + technique: " + ", ".join((tools + techniques)[:4]))
    if channel_is_tutorial and (techniques or not strong):
        reasons.append("tutorial-named channel")
    if any(hint in channel for hint in CHANNEL_HINTS) and techniques:
        reasons.append("editing channel + technique title")
    return bool(reasons), reasons


def load_channels(path: Path, channels_per_batch: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for source_index, row in enumerate(csv.DictReader(handle), start=1):
            channel_id = (row.get("Channel Id") or "").strip()
            url = (row.get("Channel Url") or "").strip()
            title = (row.get("Channel Title") or "").strip()
            if not channel_id or not url:
                continue
            score, reasons = channel_priority(title)
            rows.append({
                "channel_id": channel_id,
                "channel_url": url.replace("http://", "https://"),
                "channel_title": title or channel_id,
                "source_index": source_index,
                "priority_score": score,
                "priority_reasons": reasons,
            })
    rows.sort(key=lambda row: (-row["priority_score"], row["source_index"]))
    for rank, row in enumerate(rows, start=1):
        row["audit_rank"] = rank
        row["audit_batch"] = (rank - 1) // channels_per_batch + 1
    return rows


def parse_trigger(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def yt_dlp_inventory(
    channel: dict[str, Any],
    tab: str,
    playlist_start: int,
    playlist_end: int,
) -> tuple[list[dict[str, Any]], str]:
    url = channel["channel_url"].rstrip("/") + f"/{tab}"
    cmd = [
        "yt-dlp", "--no-warnings", "--ignore-errors", "--flat-playlist",
        "--socket-timeout", "30", "--extractor-retries", "2",
        "--playlist-start", str(playlist_start),
        "--playlist-end", str(playlist_end), "--dump-single-json",
    ]
    if os.environ.get("YT_COOKIES_ARG") and os.environ.get("YT_COOKIES_PATH"):
        cmd += [os.environ["YT_COOKIES_ARG"], os.environ["YT_COOKIES_PATH"]]
    cmd.append(url)
    try:
        run = subprocess.run(cmd, capture_output=True, text=True, timeout=360, check=False)
    except Exception as exc:  # workflow keeps later channels auditable after one failure
        return [], str(exc)
    if run.returncode != 0 and not run.stdout.strip():
        return [], run.stderr[-2000:]
    try:
        payload = json.loads(run.stdout)
    except Exception as exc:
        return [], f"invalid yt-dlp JSON: {exc}; {run.stderr[-1200:]}"
    if not isinstance(payload, dict):
        return [], f"yt-dlp returned an empty {tab} playlist; {run.stderr[-1200:]}"
    entries: list[dict[str, Any]] = []
    for item in payload.get("entries") or []:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        entries.append(item)
    return entries, run.stderr[-1200:]


def merge_candidates(path: Path, candidates: list[dict[str, Any]]) -> None:
    payload: dict[str, Any] = {"generated": "", "total": 0, "videos": []}
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
    merged = {video["id"]: video for video in payload.get("videos", []) if video.get("id")}
    for video in candidates:
        merged[video["id"]] = video
    payload["videos"] = list(merged.values())
    payload["total"] = len(merged)
    path.write_text(json.dumps(payload, indent=1), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subscriptions", type=Path, required=True)
    parser.add_argument("--trigger", type=Path, default=Path("youtube-audit/batch-trigger.txt"))
    parser.add_argument("--plan-output", type=Path)
    parser.add_argument("--inventory-output", type=Path)
    parser.add_argument("--merge", type=Path)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--channels-per-batch", type=int, default=6)
    parser.add_argument("--playlist-start", type=int, default=1)
    parser.add_argument("--playlist-end", type=int, default=500)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()

    trigger = parse_trigger(args.trigger)
    channels_per_batch = max(1, int(trigger.get("channels_per_batch", args.channels_per_batch)))
    batch = max(1, int(trigger.get("batch", args.batch)))
    playlist_start = max(1, int(trigger.get("playlist_start", args.playlist_start)))
    playlist_end = max(playlist_start, int(trigger.get("playlist_end", args.playlist_end)))
    channels = load_channels(args.subscriptions, channels_per_batch)
    source_hash = hashlib.sha256(args.subscriptions.read_bytes()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    plan = {
        "generated": now,
        "source": str(args.subscriptions),
        "source_sha256": source_hash,
        "total_channels": len(channels),
        "channels_per_batch": channels_per_batch,
        "total_batches": (len(channels) + channels_per_batch - 1) // channels_per_batch,
        "method": "Channel titles prioritize the queue; video titles are classified only on the audit runner.",
        "channels": channels,
    }
    if args.plan_output:
        args.plan_output.parent.mkdir(parents=True, exist_ok=True)
        args.plan_output.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    if args.plan_only:
        print(f"planned {len(channels)} channels across {plan['total_batches']} batches")
        return 0
    if trigger.get("mode") != "subscriptions":
        print("trigger mode is not subscriptions; inventory skipped")
        return 0

    selected = [channel for channel in channels if channel["audit_batch"] == batch]
    scanned: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    channel_reports: list[dict[str, Any]] = []
    for channel in selected:
        entries_by_id: dict[str, tuple[dict[str, Any], str]] = {}
        diagnostics: dict[str, str] = {}
        tab_counts: dict[str, int] = {}
        for tab in ("videos", "shorts"):
            entries, diagnostic = yt_dlp_inventory(channel, tab, playlist_start, playlist_end)
            diagnostics[tab] = diagnostic
            tab_counts[tab] = len(entries)
            for entry in entries:
                entries_by_id.setdefault(str(entry["id"]), (entry, tab))
        candidate_count = 0
        for item, tab in entries_by_id.values():
            title = str(item.get("title") or item.get("id"))
            candidate, reasons = classify_video(title, channel["channel_title"])
            record = {
                "id": str(item["id"]),
                "url": f"https://www.youtube.com/watch?v={item['id']}",
                "title": title,
                "duration": item.get("duration") or 0,
                "channel": channel["channel_title"],
                "channel_id": channel["channel_id"],
                "format": f"subscriptions/{tab}",
                "status": "INVENTORIED",
                "access": "pending-batch",
                "subscription_tutorial": candidate,
                "classification_reasons": reasons,
                "audit_rank": channel["audit_rank"],
            }
            scanned.append(record)
            if candidate:
                candidates.append(record)
                candidate_count += 1
        channel_reports.append({
            "channel_id": channel["channel_id"],
            "channel_title": channel["channel_title"],
            "inventory_count": len(entries_by_id),
            "tab_counts": tab_counts,
            "candidate_count": candidate_count,
            "diagnostic_tails": diagnostics,
        })
        print(channel["channel_title"], len(entries_by_id), "inventory", candidate_count, "tutorial candidates")

    result = {
        "generated": now,
        "batch": batch,
        "channels_per_batch": channels_per_batch,
        "playlist_range_per_tab": [playlist_start, playlist_end],
        "selected_channels": channel_reports,
        "inventory_count": len(scanned),
        "candidate_count": len(candidates),
        "videos": scanned,
    }
    if args.inventory_output:
        args.inventory_output.parent.mkdir(parents=True, exist_ok=True)
        args.inventory_output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if args.merge:
        merge_candidates(args.merge, candidates)
    print(f"subscription batch {batch}: {len(scanned)} titles, {len(candidates)} candidates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
