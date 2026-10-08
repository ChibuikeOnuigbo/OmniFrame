#!/usr/bin/env bash
# Ensure a 2 GB swapfile exists (CI sandbox / low-RAM boxes).
#
# The demucs WASM passes peak ~3.1 GB each in the renderer; two sequential
# shift-averaging passes (strength >= 0.6) exceed the 4 GB sandbox by
# ~100-200 MB and the kernel OOM-kills the renderer. With swap, the full
# two-pass profile passes (qa/voice-demucs-robustness-e2e.mjs 9/9).
#
# Safe to run repeatedly: no-ops when swap is already active. Sandbox
# resets wipe the swapfile — re-run after each recovery.
# See RUNS.md "Regression sweep 2026-10-08" for the memory profile.
set -euo pipefail

if swapon --show=NAME --noheadings 2>/dev/null | grep -q .; then
  echo "swap already active:"
  swapon --show
  exit 0
fi

if [[ $EUID -ne 0 ]]; then
  echo "this script needs root — run: sudo bash scripts/ensure-swap.sh" >&2
  exit 1
fi

fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile >/dev/null
swapon /swapfile
echo "swap enabled:"
swapon --show
