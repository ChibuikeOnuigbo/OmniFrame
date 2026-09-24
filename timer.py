#!/usr/bin/env python3
"""Bounded engineering-session heartbeat and subsystem work-time logger.
Records start, stop, elapsed time, heartbeat, feature verification, and failures.
"""
from __future__ import annotations
import argparse, json, time
from datetime import datetime, timezone
from pathlib import Path

WINDOW_SECONDS = 24 * 60 * 60
STATE = Path('.audit/engineering-timer.json')
DRAWING_STATE = Path('.audit/drawing-subsystem-timer.json')
LOG = Path('DEVELOPMENT_LOG.md')

def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')

def append(message: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open('a', encoding='utf-8') as f:
        f.write(f'\n- {now()} — {message}\n')

def record_drawing_run(feature: str, status: str, details: str = '') -> None:
    DRAWING_STATE.parent.mkdir(parents=True, exist_ok=True)
    data = {'runs': [], 'total_runs': 0, 'last_updated': now()}
    if DRAWING_STATE.exists():
        try:
            data = json.loads(DRAWING_STATE.read_text(encoding='utf-8'))
        except Exception:
            pass

    data['total_runs'] = data.get('total_runs', 0) + 1
    run_entry = {
        'run': data['total_runs'],
        'timestamp': now(),
        'feature': feature,
        'status': status,
        'details': details,
    }
    data.setdefault('runs', []).append(run_entry)
    data['last_updated'] = now()
    DRAWING_STATE.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    append(f"Drawing Run #{run_entry['run']}: [{status.upper()}] {feature} — {details}")
    print(f"Recorded Drawing Run #{run_entry['run']}: {feature} ({status})")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--action', choices=['heartbeat', 'log-feature'], default='heartbeat')
    parser.add_argument('--feature', type=str, default='')
    parser.add_argument('--status', type=str, default='verified')
    parser.add_argument('--details', type=str, default='')
    parser.add_argument('--heartbeat-seconds', type=int, default=1800)
    parser.add_argument('--iteration', type=int, default=1)
    args = parser.parse_args()

    if args.action == 'log-feature':
        record_drawing_run(args.feature, args.status, args.details)
        return

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
