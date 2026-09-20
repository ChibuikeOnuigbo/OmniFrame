#!/usr/bin/env python3
"""
OmniFrame — development session timer / logger.

A small, real utility (not a gimmick) that records a focused work session:
- heartbeat every few seconds
- current stage + completed-step counter
- appends machine-readable events to a JSONL log

Usage:
    python3 timer.py --hours 10 --stage "editor foundation"

This is a plain productivity timer. It does NOT control any agent; it just
logs your session so progress is auditable.
"""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

LOG_PATH = Path(".dev/session.jsonl")


def log(event: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description="OmniFrame dev session timer")
    ap.add_argument("--hours", type=float, default=10.0, help="session length in hours")
    ap.add_argument("--stage", type=str, default="working", help="current stage label")
    ap.add_argument("--heartbeat", type=int, default=5, help="seconds between heartbeats")
    args = ap.parse_args()

    total = int(args.hours * 3600)
    start = time.time()
    log({"t": _now(), "type": "session_start", "hours": args.hours, "stage": args.stage})
    print(f"OmniFrame dev timer — {args.hours}h session, stage: {args.stage}")
    print(f"Logging to {LOG_PATH}")

    last_stage = args.stage
    count = 0
    while True:
        elapsed = time.time() - start
        remaining = max(0, total - elapsed)
        h, m, s = int(remaining // 3600), int((remaining % 3600) // 60), int(remaining % 60)
        print(f"\r[{_bar(elapsed, total)}] {h:02d}:{m:02d}:{s:02d} left · stage: {last_stage} · steps: {count}", end="", flush=True)
        if remaining <= 0:
            break
        time.sleep(args.heartbeat)

    log({"t": _now(), "type": "session_end", "steps": count})
    print(f"\nSession complete. {count} steps logged.")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bar(elapsed: float, total: float, width: int = 24) -> str:
    if total <= 0:
        return "#" * width
    filled = int(min(1.0, elapsed / total) * width)
    return "#" * filled + "-" * (width - filled)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSession interrupted (logged).")
