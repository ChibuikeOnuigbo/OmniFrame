#!/usr/bin/env bash
# Builds the native DSP core (native/dsp-core/omni_dsp.cpp) to freestanding
# wasm32 and installs it at public/wasm/omni-dsp.wasm.
#
# Toolchain: any clang with a wasm32 target. The default is the zig-bundled
# clang (zig cc IS clang + lld — one dependency, available via
# `pip install ziglang` or from ziglang.org):
#
#   pip3 install --user ziglang
#   ./scripts/build-dsp-wasm.sh
#
# Or point ZIG_CC at any clang with wasm support:
#   ZIG_CC="wasi-sdk/bin/clang++" ./scripts/build-dsp-wasm.sh
#
# No libc, no exceptions, no RTTI. The parity bar between this module and the
# pure-JS fallback is asserted by qa/native-dsp-parity.mjs — run it after
# any change here.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${ZIG_CC:-}" ]]; then
  CC=($ZIG_CC)
elif command -v zig >/dev/null 2>&1; then
  CC=(zig c++)
elif python3 -m ziglang version >/dev/null 2>&1; then
  CC=(python3 -m ziglang c++)
else
  echo "error: no clang found — install one of: zig, 'pip3 install ziglang', or set ZIG_CC" >&2
  exit 1
fi

mkdir -p public/wasm
"${CC[@]}" --target=wasm32-freestanding -O3 \
  -fno-exceptions -fno-rtti -nostdlib \
  -Wl,--no-entry -Wl,--export-memory -Wl,--export=__heap_base \
  -Wl,--export=omni_resample \
  -Wl,--export=omni_ls_leakage \
  -Wl,--export=omni_average_passes \
  -Wl,--export=omni_peak_scale -Wl,--export=omni_normalize \
  native/dsp-core/omni_dsp.cpp \
  -o public/wasm/omni-dsp.wasm

echo "built public/wasm/omni-dsp.wasm ($(stat -c%s public/wasm/omni-dsp.wasm) bytes)"
