#!/usr/bin/env bash
# Builds the vendored Xiph RNNoise C library (native/rnnoise/) — including its
# trained GRU denoiser weights, embedded as int8 arrays in src/rnn_data.c —
# to a WASI reactor wasm module at public/wasm/rnnoise.wasm.
#
# The module has NO imports (pure linear-memory wasm): the app instantiates it
# with an empty import object and calls:
#
#   rnnoise_create(0)          -> state handle (i32; uses the built-in model)
#   rnnoise_process_frame(st, out, in) -> per-frame VAD (f32)
#   rnnoise_destroy(st)
#   rnnoise_get_frame_size()   -> 480 (samples @ 48 kHz)
#   malloc(n) / free(p)        -> wasm-heap scratch for frame buffers
#
# IMPORTANT — input scaling: the model was trained (and the official demo
# reads) 16-bit-PCM-scaled floats. All callers MUST multiply samples by
# 32768 before rnnoise_process_frame and divide the output by 32768. The
# silence gate (E < 0.04 on band energies), the feature offsets and the VAD
# are all calibrated for that scale. Feeding ±1 floats renders the model
# inert (VAD stays 0, gains stay 1) — this is verified behavior, not a bug
# in the build.
#
# Toolchain: zig cc (clang + lld) targeting wasm32-wasi in reactor mode.
#   pip3 install --user ziglang
#   ./scripts/build-rnnoise-wasm.sh
#
# Parity bar: qa/rnnoise-parity.mjs asserts the wasm output is BIT-IDENTICAL
# to a native gcc build of the same sources on a deterministic noisy-speech
# fixture (reference vector checked in at qa/fixtures/rnnoise-ref-output.f32)
# — run it after any change here.
#
# Source: https://github.com/xiph/rnnoise (BSD-style, see native/rnnoise/COPYING)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${ZIG_CC:-}" ]]; then
  CC=($ZIG_CC)
elif command -v zig >/dev/null 2>&1; then
  CC=(zig cc)
elif python3 -m ziglang version >/dev/null 2>&1; then
  CC=(python3 -m ziglang cc)
else
  echo "error: no clang found — install one of: zig, 'pip3 install ziglang', or set ZIG_CC" >&2
  exit 1
fi

SRC=native/rnnoise/src
OUT=public/wasm/rnnoise.wasm

"${CC[@]}" \
  --target=wasm32-wasi -mexec-model=reactor \
  -O3 -DNDEBUG \
  -I "$SRC" -I native/rnnoise/include \
  "$SRC/denoise.c" "$SRC/rnn.c" "$SRC/rnn_data.c" "$SRC/rnn_reader.c" \
  "$SRC/pitch.c" "$SRC/celt_lpc.c" "$SRC/kiss_fft.c" \
  -Wl,--export=rnnoise_create \
  -Wl,--export=rnnoise_destroy \
  -Wl,--export=rnnoise_process_frame \
  -Wl,--export=rnnoise_get_frame_size \
  -Wl,--export=rnnoise_get_size \
  -Wl,--export=malloc \
  -Wl,--export=free \
  -o "$OUT"

# the two *(int*)0=0 debug-assert lines in rnn.c are dead under -DNDEBUG;
# silence the null-deref warnings they raise at -O3
echo "built $OUT ($(stat -c%s "$OUT") bytes)"
