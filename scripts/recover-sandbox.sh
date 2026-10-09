#!/usr/bin/env bash
# One-command sandbox recovery after a reset (node_modules, pip packages,
# processes, /tmp and swap are wiped; the repo resets to its base commit).
#
# Every step is idempotent — safe to re-run on a partially recovered box.
# After it completes, restart the dev server (start_process "npm run dev").
#
# What it does (see RUNS.md "sandbox ops notes"):
#   1. hard-reset the working tree to the pushed branch head (all real work
#      is committed+pushed; uncommitted changes do not survive resets)
#   2. ensure the 2 GB swapfile (demucs two-pass WASM needs it on 4 GB boxes)
#   3. reinstall python deps (torch/onnx/onnxruntime/onnxscript/opencv)
#   4. npm install
#   5. regenerate gitignored test assets: music beds, voice fixtures,
#      the 174 MB htdemucs.onnx, playwright's ffmpeg (cdn.playwright.dev is
#      blocked here — @ffmpeg-installer/ffmpeg via npm is the workaround)
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH=arena/01a1068e-omniframe

echo "== 1/5 git reset to origin/$BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
git log --oneline -1

echo "== 2/5 swap"
sudo bash scripts/ensure-swap.sh

echo "== 3/5 python deps"
if ! python3 -c "import torch, numpy, onnx, onnxruntime, onnxscript, cv2" 2>/dev/null; then
  pip install --quiet --user --break-system-packages \
    torch numpy onnx onnxruntime onnxscript opencv-python-headless
fi
python3 -c "import torch, numpy, onnx, onnxruntime, onnxscript, cv2; print('python deps ok')"

echo "== 4/5 npm install"
npm install

echo "== 5/5 gitignored test assets"
node qa/generate-music-beds.mjs
node scripts/python/decode_voice_fixtures.mjs
node scripts/fetch-demucs-model.mjs
if [ ! -x "$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux" ]; then
  mkdir -p /tmp/ffs /tmp/ffs
  ( cd /tmp/ffs && npm install @ffmpeg-installer/ffmpeg >/dev/null 2>&1 )
  mkdir -p "$HOME/.cache/ms-playwright/ffmpeg-1011"
  cp /tmp/ffs/node_modules/@ffmpeg-installer/linux-x64/ffmpeg \
     "$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux"
  chmod +x "$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux"
fi
echo "ffmpeg workaround: $("$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux" -version 2>&1 | head -1)"

echo
echo "recovery complete — restart the dev server: npm run dev"
