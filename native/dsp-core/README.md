# OmniFrame native DSP core

`native/dsp-core/omni_dsp.cpp` — the hot DSP loops of the audio pipeline,
compiled to freestanding **wasm32** and shipped as an ~11 KB module at
`public/wasm/omni-dsp.wasm`.

## Why native code in a web app

The professional-editor pattern (see similar tools' language stats: Rust,
C++, Go alongside the UI language): the UI stays TypeScript, while the
per-sample number crunching that runs over **millions of samples per clip**
lives in a compiled core. Here that is:

| Export | What it does | JS fallback (bit-identical) |
| --- | --- | --- |
| `omni_resample` | polyphase windowed-sinc resampler — 32-tap Blackman-windowed sinc, 2048 phases, per-phase DC normalization, anti-aliasing cutoff at Nyquist/rate when decimating (asetrate semantics) | `src/lib/demucs/resample.js` |
| `omni_ls_leakage` | in-place least-squares stem de-leak (coefficient clamped to ±0.5, silent references skipped) | `removeLsLeakage` in `src/lib/demucs/index.ts` |
| `omni_average_passes` | finite-aware averaging of shift-averaged separation passes (NaN/Inf around WASM chunk tails never poison a sample) | averaging loop in `src/lib/demucs/index.ts` |
| `omni_peak_scale` | encode-time peak-safety scaling (one shared gain, threshold 0.999 → target 0.98) | `encodeAudioBufferToWav` in `src/lib/voiceIsolation.ts` |

Measured on the 108 s reference track (stereo, ×1.45): **JS ~750 ms vs
native ~320 ms (2.3-2.5×)** — `qa/reports/native-dsp-parity.json`.

The rest of the heavy compute was already native: the neural models
(Demucs v4, Silero VAD, SAM, roto, denoise) run on onnxruntime-web, which
is itself C++ compiled to WASM. This core extends that to the surrounding
DSP with the same deployment shape (a small WASM module, no install).

## Parity policy — the core is never allowed to drift

The JS implementations are not throwaway fallbacks; they are the reference
and they stay wired in. Every native op is **opportunistic**: if the module
fails to load (or can't grow its memory for a very long clip), the caller
transparently uses the JS path. Audio output is identical either way.

`qa/native-dsp-parity.mjs` (run after **any** change here) asserts it:

- resample across rates ×1.45, ×4/3, ×0.75, ×1.15, ×1.6 and multiple
  lengths — **max|diff| 0.0** (bit-identical; bar 1e-5)
- LS de-leak, pass averaging (with NaN/Inf injections), peak scale —
  **max|diff| 0.0** (bar 1e-6)
- a full-track-scale benchmark

E2E case N (`qa/voice-slowed-fix-e2e.mjs`) additionally proves the module
is active in the real app pipeline and still bit-identical in-browser.
Current state: **19/19 parity, 18/18 E2E**.

Bit-identity is achieved by mirroring the JS exactly, including its float32
rounding points: the polyphase table stores float32 rows, accumulates the
DC-normalization sum in double, and divides the stored value; convolutions
cast both operands to double before multiplying. The one thing that can't
be borrowed from the platform is `Math.sin` — the core carries its own
fdlibm-style implementation (Cody-Waite two-word range reduction + Taylor
kernels through x¹⁷), measured at ≤ 2.2e-16 relative error vs `Math.sin`,
which is why the resampled samples come out bit-identical.

## Build

```sh
./scripts/build-dsp-wasm.sh          # → public/wasm/omni-dsp.wasm
node qa/native-dsp-parity.mjs        # must stay 19/19
```

The script uses any clang with a wasm32 target. The default is the
zig-bundled clang (`zig cc` *is* clang + lld) because it is one dependency
that even installs from PyPI in locked-down environments:

```sh
pip3 install --user ziglang          # or install zig from ziglang.org
```

Any other clang works via `ZIG_CC="…/clang++" ./scripts/build-dsp-wasm.sh`
(e.g. wasi-sdk). Flags: `-O3 -fno-exceptions -fno-rtti -nostdlib`, no
`-ffast-math` (parity over speed).

## Flat ABI (no allocator, no libc)

The module exports its linear `memory` and the `__heap_base` global.
Callers (`src/lib/native/dspNative.ts`) bump a cursor from `__heap_base`,
grow memory once if needed, build their `Float32Array`/`Uint8Array` views
**after** the grow (grow detaches existing buffers), call, and reset.
Scratch lifetime is a single synchronous call. Nothing below `__heap_base`
is touched except the module's own static polyphase table (256 KB, built
lazily on first use / when the resample cutoff changes).
