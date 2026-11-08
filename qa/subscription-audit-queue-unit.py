#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "build-subscription-audit-queue.py"
SPEC = importlib.util.spec_from_file_location("subscription_audit", MODULE_PATH)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

channels = module.load_channels(
    ROOT / "research" / "youtube-subscriptions" / "subscriptions-20261108.csv",
    6,
)
assert len(channels) == 211, len(channels)
assert channels[0]["priority_score"] >= channels[-1]["priority_score"]
assert channels[-1]["audit_batch"] == 36
assert len({channel["channel_id"] for channel in channels}) == 211

positive = [
    ("How to make a vertical blur in After Effects", "Example Edits"),
    ("Directional light effect breakdown", "Motion Lab"),
    ("Aura tutorial | Alight Motion", "Creator"),
    ("Smooth velocity graph", "Zept Tutorials"),
]
for title, channel in positive:
    candidate, reasons = module.classify_video(title, channel)
    assert candidate and reasons, (title, reasons)

for title, channel in [
    ("My weekend lunch", "Travel Diary"),
    ("I Challenged 15 Editors To Decide The Best Software", "Dr. Xenios Tutorials"),
    ("Free 4K Neymar Clips", "mxtstutorials"),
    ("After Effects Is Finally on Mobile?!", "Tyson Tutorials"),
]:
    candidate, reasons = module.classify_video(title, channel)
    assert not candidate and reasons == [], (title, reasons)

print("subscription-audit-queue-unit: 211 channels, 36 batches, classifier boundaries PASS")
