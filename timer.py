#!/usr/bin/env python3
"""Bounded local work/research supervisor for OmniFrame.

This command cannot force an AI agent to think, and it never fabricates progress.
It keeps a human-started local session alive for a finite budget, repeats a
research/QA observation pass, records blockers, and remains ``needs_review``
until explicit completion gates are supplied. The default budget is the user's
requested ten hours and 1009 finite passes, but nothing starts until this file
is run deliberately.

Example:
  python timer.py --hours 10 --iterations 1009 --interval 60 \
    --scan-root . --research-queue research/queue.jsonl \
    --gate "npm test" --gate "npm run typecheck"

A timer is coordination/logging, not a substitute for implementation. It does
not post forms, upload footage, scrape websites, request credentials, or run an
arbitrary command unless the caller explicitly supplies a local gate command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import signal
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_HOURS = 10.0
DEFAULT_ITERATIONS = 1009
DEFAULT_HEARTBEAT = 60.0
DEFAULT_GATE_EVERY = 10
EXCLUDED_DIRS = {".git", "node_modules", "dist", "build", "coverage", ".cache", ".venv", "target", "__pycache__"}
LOG = Path("development-sessions.jsonl")
active = True


@dataclass
class Session:
    session_id: str
    started_at: str
    ended_at: str | None
    duration_seconds: int
    iteration_budget: int
    iteration: int
    stage: str
    status: str
    progress: float
    completed_tests: int
    blockers: list[str]
    completion_file: str | None


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_event(event: dict[str, Any]) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"time": now(), **event}, sort_keys=True) + "\n")


def stop(_signum: int, _frame: object) -> None:
    global active
    active = False


def safe_path(path: str | None) -> Path | None:
    if not path:
        return None
    return Path(path).expanduser().resolve()


def load_completion(path: Path | None) -> bool:
    if not path or not path.is_file():
        return False
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value.get("complete") is True
    except (OSError, json.JSONDecodeError, AttributeError):
        return False


def queue_items(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.is_file():
        return []
    items: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            items.append(value)
    return items


def scan_tree(root: Path) -> dict[str, Any]:
    """Collect local structural facts without pretending they are quality scores."""
    files = 0
    lines = 0
    digest = hashlib.sha256()
    extensions: dict[str, int] = {}
    if not root.exists():
        return {"root": str(root), "files": 0, "lines": 0, "digest": None, "extensions": {}}
    for current, directories, names in os.walk(root):
        directories[:] = sorted(name for name in directories if name not in EXCLUDED_DIRS and not name.startswith("."))
        for name in sorted(names):
            path = Path(current) / name
            if path.is_symlink() or path.stat().st_size > 2_000_000:
                continue
            try:
                data = path.read_bytes()
            except OSError:
                continue
            files += 1
            lines += data.count(b"\n") + (1 if data and not data.endswith(b"\n") else 0)
            digest.update(str(path.relative_to(root)).encode("utf-8", errors="replace"))
            digest.update(hashlib.sha256(data).digest())
            suffix = path.suffix.lower() or "[none]"
            extensions[suffix] = extensions.get(suffix, 0) + 1
    return {"root": str(root), "files": files, "lines": lines, "digest": digest.hexdigest(), "extensions": extensions}


def run_gate(command: str, cwd: Path, timeout: float) -> dict[str, Any]:
    """Run an explicitly supplied local gate with argv parsing, never a shell."""
    argv = shlex.split(command)
    if not argv:
        return {"command": command, "ok": False, "error": "empty command"}
    try:
        result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False)
        output = (result.stdout + result.stderr).strip()
        return {"command": command, "ok": result.returncode == 0, "returncode": result.returncode, "output_tail": output[-2000:]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"command": command, "ok": False, "error": str(error)}


def blockers_for(gates: list[dict[str, Any]], completion: bool, queue: list[dict[str, Any]]) -> list[str]:
    blockers = [f"gate failed: {gate['command']}" for gate in gates if not gate.get("ok")]
    if not completion:
        blockers.append("explicit completion file is absent or does not contain {complete: true}")
    open_items = [item for item in queue if item.get("status", "open") not in {"done", "complete", "closed"}]
    if open_items:
        blockers.append(f"{len(open_items)} research/QA queue item(s) remain open")
    return blockers


def main() -> int:
    global LOG
    parser = argparse.ArgumentParser(description="Bounded, honest OmniFrame work/research timer")
    parser.add_argument("--hours", type=float, default=DEFAULT_HOURS, help="maximum runtime; default 10 hours")
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS, help="finite repeat passes; capped at 1009")
    parser.add_argument("--heartbeat", "--interval", dest="heartbeat", type=float, default=DEFAULT_HEARTBEAT, help="seconds between passes; default 60")
    parser.add_argument("--stage", default="research-and-QA")
    parser.add_argument("--progress", type=float, default=0.0, help="reported planning progress only; never inferred")
    parser.add_argument("--tests", type=int, default=0, help="known completed test count supplied by caller")
    parser.add_argument("--log", default=str(LOG))
    parser.add_argument("--scan-root", default=".", help="local repository path to structurally scan")
    parser.add_argument("--research-queue", help="optional local JSONL queue; this tool only reports open items")
    parser.add_argument("--completion-file", help="optional JSON file that explicitly contains {\"complete\": true}")
    parser.add_argument("--gate", action="append", default=[], help="local gate command; argv-parsed and run every --gate-every pass")
    parser.add_argument("--gate-every", type=int, default=DEFAULT_GATE_EVERY)
    parser.add_argument("--gate-timeout", type=float, default=900.0)
    parser.add_argument("--minimum-lines", type=int, default=0, help="report a line-count observation; never treats lines as quality")
    parser.add_argument("--once", action="store_true", help="run one observation pass instead of waiting")
    args = parser.parse_args()

    LOG = Path(args.log).expanduser()
    limit = max(1, int(args.hours * 3600))
    iterations = max(1, min(DEFAULT_ITERATIONS, args.iterations))
    heartbeat = max(0.1, args.heartbeat)
    root = safe_path(args.scan_root) or Path.cwd()
    queue_path = safe_path(args.research_queue)
    completion_path = safe_path(args.completion_file)
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    started = time.monotonic()
    session = Session(
        session_id=f"session-{int(time.time())}", started_at=now(), ended_at=None,
        duration_seconds=limit, iteration_budget=iterations, iteration=0,
        stage=args.stage, status="needs_review", progress=max(0.0, min(1.0, args.progress)),
        completed_tests=max(0, args.tests), blockers=["no explicit completion gate has been supplied"],
        completion_file=str(completion_path) if completion_path else None,
    )
    write_event({"event": "session_start", "session": asdict(session), "scan_root": str(root), "research_queue": str(queue_path) if queue_path else None})
    print(f"OmniFrame timer started: {session.session_id} · limit {args.hours:g}h · up to {iterations} passes · {session.stage}", flush=True)
    last_gates: list[dict[str, Any]] = []
    try:
        while active:
            if args.once and session.iteration >= 1:
                break
            if not args.once and (session.iteration >= iterations or time.monotonic() - started >= limit):
                break
            session.iteration += 1
            elapsed = int(time.monotonic() - started)
            remaining = max(0, limit - elapsed)
            queue = queue_items(queue_path)
            scan = scan_tree(root) if session.iteration == 1 or session.iteration % max(1, args.gate_every) == 0 else None
            if args.gate and (session.iteration == 1 or session.iteration % max(1, args.gate_every) == 0):
                last_gates = [run_gate(command, root, args.gate_timeout) for command in args.gate]
            completion = load_completion(completion_path)
            blockers = blockers_for(last_gates, completion, queue)
            if scan and args.minimum_lines and scan["lines"] < args.minimum_lines:
                # This is a visible observation, not a requirement to generate
                # pointless code. The project remains needs_review either way.
                blockers.append(f"line-count observation {scan['lines']} is below requested review threshold {args.minimum_lines}")
            session.status = "complete" if not blockers else "needs_review"
            session.blockers = blockers
            event = {"event": "research_pass", "session_id": session.session_id, "iteration": session.iteration, "iteration_budget": iterations, "elapsed_seconds": elapsed, "remaining_seconds": remaining, "status": session.status, "blockers": blockers, "gates": last_gates, "queue_open": sum(item.get("status", "open") not in {"done", "complete", "closed"} for item in queue), "scan": scan}
            write_event(event)
            line_note = f" · lines {scan['lines']}" if scan else ""
            print(f"pass {session.iteration:04d}/{iterations} · {elapsed // 3600:02d}:{elapsed % 3600 // 60:02d}:{elapsed % 60:02d} elapsed · {remaining}s remaining · {session.status} · blockers {len(blockers)}{line_note}", flush=True)
            if args.once or not active or session.iteration >= iterations:
                break
            time.sleep(heartbeat)
    finally:
        session.ended_at = now()
        elapsed = int(time.monotonic() - started)
        write_event({"event": "session_end", "session": asdict(session), "elapsed_seconds": elapsed, "final_status": session.status})
        print(f"OmniFrame timer ended: {session.session_id} · {session.status} · passes {session.iteration}", flush=True)
    return 0 if session.status == "complete" else 3


if __name__ == "__main__":
    raise SystemExit(main())
