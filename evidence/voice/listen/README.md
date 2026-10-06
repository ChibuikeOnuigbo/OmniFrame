# Voice Isolation — input ↔ output pairs (listen pack)

The actual audio the voice-isolation engines run on, and what they produced —
committed here so you can play them straight from the repo. Every
`input_(name).mp3` pairs with its `output_(name).mp3` (same duration, A/B them
directly).

**Update (this revision):** isolation is now powered by a REAL pretrained
neural network — **Meta's Demucs v4 "Hybrid Transformer" (htdemucs)**, 4-stem
source separation, running in the browser via ONNX Runtime Web (WebGPU with
WASM fallback). The previous mid/side DSP engine could not remove
center-panned/broadband music and made the voice crack; its outputs are kept
below as `-dsp-old` for A/B comparison.

## Objective scores (ground truth = exact stems used to build the mix)

The showcase mix is deterministic (TTS narration + synthesized music bed at
0 dB SNR), so the clean vocal/music stems are known exactly
(`mix-showcase-clean-voice.wav` / `mix-showcase-clean-music.wav` one level up).
Scoring the engines' vocal outputs against them:

| Engine | SI-SDR vs clean voice | Music bleed in output | Verdict |
|---|---|---|---|
| raw mixture (baseline) | −0.3 dB | −2.9 dB | — |
| old DSP (mid/side + bandpass) | +0.4 dB | −24.8 dB | music clearly audible, voice artifacts |
| **Demucs v4 (htdemucs, in-app)** | **+17.4 dB** | **−43.3 dB** | music inaudible, voice intact |

The instrumental output (`remove_vocal`) scores **+19.3 dB** against the clean
music stem with voice residue at −43 dB. Measured by
`qa/voice-demucs-model-e2e.mjs` (5/5 PASS), which drives the real UI.

## The pairs

| Pair | Input | Output | What to listen for |
|---|---|---|---|
| 1 | `input_mix-showcase.mp3` (20s) | `output_mix-showcase-keep-vocal-demucs.mp3` | TTS narration mixed at 0 dB SNR with the full-band music bed → **Demucs Keep Vocal**: music gone, voice clean and uncracked. |
| 2 | `input_mix-showcase.mp3` | `output_mix-showcase-remove-vocal-demucs.mp3` | Same → **Demucs Remove Vocal**: voice gone, instruments intact (karaoke). |
| 3 | `input_test-audio-6s.mp3` (6s) | `output_test-audio-6s-keep-vocal-demucs.mp3` | Shared E2E fixture → **Demucs Keep Vocal**. Note: this fixture contains **no vocals** — the near-silent output is the model correctly *not* hallucinating a voice. |
| 4 | `input_test-audio-6s.mp3` | `output_test-audio-6s-remove-vocal-demucs.mp3` | Same fixture → **Demucs Remove Vocal** (output ≈ input, since there is no voice to remove). |
| 5 | `input_mix-variant2.mp3` (20s) | `output_mix-variant2-keep-vocal-demucs.mp3` | A *different* voice (male conversational TTS) over a *different* bed (drums groove), same 0 dB mix recipe → **Demucs Keep Vocal** generalizes, not a one-case trick. |
| A/B | `input_mix-showcase.mp3` | `output_mix-showcase-keep-vocal-dsp-old.mp3` | The previous DSP output on the same input — hear the difference. |
| A/B | `input_test-audio-6s.mp3` | `output_test-audio-6s-*-dsp-old.mp3` | Previous DSP outputs on the fixture. |

Full-fidelity sources for the study case sit one level up:

- Input: `evidence/voice/mix-showcase-input.wav`
- Ground-truth stems: `mix-showcase-clean-voice.wav`, `mix-showcase-clean-music.wav`
- Previous DSP output: `mix-showcase-isolated.wav`

## Model provenance & license

- Architecture/weights: **Demucs v4 Hybrid Transformer (htdemucs)** by Meta AI
  (facebookresearch/demucs), 4 stems (drums/bass/other/vocals).
- ONNX port + inference glue: MIT-licensed npm package
  [`demucs`](https://www.npmjs.com/package/demucs) (Kevin Gibbons / bakkot),
  vendored with attribution in `src/lib/demucs/` (see its `LICENSE.md`).
- The 174 MB weights file is NOT committed (too large for the repo) — it ships
  inside the npm tarball. Download once with:
  `npm run fetch:demucs` → `public/models/htdemucs.onnx`
- Weights license: derived from weights provided by Meta, **personal and
  research use only** (per the package's LICENSE.md).

## How these were produced

1. `qa/voice-tts-mix-isolation-e2e.mjs` builds the deterministic mixture
   (24/24 PASS) and the previous DSP output WAV.
2. `qa/voice-build-clean-stems.mjs` rebuilds that mixture while also exporting
   the exact clean stems (ground truth for scoring).
3. `qa/voice-isolation-listen-pack.mjs` loads the mix + the shared fixture
   through the real app store, runs `executeVoiceIsolationForClip()` with
   `model: 'htdemucs-v4'` (the same path the UI's *Isolate Audio Track* button
   drives) for both modes, and encodes all pairs to MP3 (libmp3lame, -q:a 2).
4. `qa/voice-demucs-model-e2e.mjs` re-runs the whole flow through the actual
   UI buttons and scores the result (SI-SDR / music-bleed) against ground
   truth.

Regenerate everything (needs the dev server on :5173):

```sh
npm run fetch:demucs                                   # once — weights
node qa/voice-tts-mix-isolation-e2e.mjs                # mix + DSP baseline
node qa/voice-build-clean-stems.mjs evidence/voice/tmp # ground truth
node qa/voice-isolation-listen-pack.mjs                # this pack
node qa/voice-demucs-variant-listen.mjs                # variant2 pair
node qa/voice-demucs-model-e2e.mjs                     # UI + scoring E2E
```

Runtime note: in headless/WASM the model runs slower than realtime; on normal
desktop Chrome with WebGPU it separates at roughly 3× realtime.
