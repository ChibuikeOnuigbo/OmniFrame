#!/usr/bin/env python3
"""Honest local development/session timer.

It writes one JSON object per line and prints a heartbeat. The timer never invents
completed work; callers provide stage/progress/test-count updates explicitly.
"""
from __future__ import annotations
import argparse
import json
import signal
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

@dataclass
class Session:
    session_id: str
    started_at: str
    ended_at: str | None
    duration_seconds: int
    stage: str
    progress: float
    completed_tests: int

LOG = Path("development-sessions.jsonl")
active = True

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def write_event(event: dict) -> None:
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"time": now(), **event}, sort_keys=True) + "\n")

def stop(_signum: int, _frame: object) -> None:
    global active
    active = False

def main() -> int:
    global LOG
    parser = argparse.ArgumentParser(description="Local OmniFrame development timer")
    parser.add_argument("--hours", type=float, default=10.0, help="maximum session duration, default 10 hours")
    parser.add_argument("--heartbeat", type=float, default=60.0, help="heartbeat period in seconds")
    parser.add_argument("--stage", default="development")
    parser.add_argument("--progress", type=float, default=0.0)
    parser.add_argument("--tests", type=int, default=0)
    parser.add_argument("--log", default=str(LOG))
    args = parser.parse_args()
    LOG = Path(args.log)
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    limit = max(1, int(args.hours * 3600))
    started = time.monotonic()
    session = Session(f"session-{int(time.time())}", now(), None, limit, args.stage, max(0, min(1, args.progress)), max(0, args.tests))
    write_event({"event": "session_start", "session": asdict(session)})
    print(f"OmniFrame timer started: {session.session_id} · limit {args.hours:g}h · stage {session.stage}", flush=True)
    try:
        while active and time.monotonic() - started < limit:
            elapsed = int(time.monotonic() - started)
            remaining = max(0, limit - elapsed)
            print(f"heartbeat · {elapsed // 3600:02d}:{elapsed % 3600 // 60:02d}:{elapsed % 60:02d} elapsed · {remaining}s remaining · {session.stage} · {session.progress:.0%} · tests {session.completed_tests}", flush=True)
            write_event({"event": "heartbeat", "session_id": session.session_id, "elapsed_seconds": elapsed, "remaining_seconds": remaining, "stage": session.stage, "progress": session.progress, "completed_tests": session.completed_tests})
            time.sleep(max(0.1, args.heartbeat))
    finally:
        session.ended_at = now()
        write_event({"event": "session_end", "session": asdict(session), "elapsed_seconds": int(time.monotonic() - started)})
        print(f"OmniFrame timer ended: {session.session_id}", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
