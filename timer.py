#!/usr/bin/env python3
"""Bounded engineering-session heartbeat logger. It performs no simulated work."""
from __future__ import annotations
import argparse, json, time
from datetime import datetime, timezone
from pathlib import Path

WINDOW_SECONDS = 24 * 60 * 60
STATE = Path('.audit/engineering-timer.json')
LOG = Path('DEVELOPMENT_LOG.md')

def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')

def append(message: str) -> None:
    with LOG.open('a', encoding='utf-8') as f:
        f.write(f'\n- {now()} — {message}\n')

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--heartbeat-seconds', type=int, default=1800)
    parser.add_argument('--iteration', type=int, default=1)
    args = parser.parse_args()
    started = time.time()
    deadline = started + WINDOW_SECONDS
    STATE.parent.mkdir(parents=True, exist_ok=True)
    append(f'Iteration {args.iteration}: 24-hour bounded timer started; heartbeat records time only, never completion.')
    while time.time() < deadline:
        STATE.write_text(json.dumps({'iteration': args.iteration, 'startedUnix': started, 'deadlineUnix': deadline, 'heartbeatUnix': time.time(), 'status': 'running'}, indent=2) + '\n')
        time.sleep(max(30, args.heartbeat_seconds))
    STATE.write_text(json.dumps({'iteration': args.iteration, 'startedUnix': started, 'deadlineUnix': deadline, 'heartbeatUnix': time.time(), 'status': 'expired'}, indent=2) + '\n')
    append(f'Iteration {args.iteration}: timer expired; no unverified work marked complete.')

if __name__ == '__main__':
    main()
