# OmniFrame

A real, working **web-based non-linear video editor** built with React + TypeScript + Vite + Tailwind + Zustand.

> **Status (honest):** This is a browser-verified editor foundation, not a static UI mockup.
> A Tauri 2 desktop shell is present under `src-tauri/`; native compilation still requires the
> platform Rust/WebView prerequisites documented in `qa/reports/tauri-info.txt`. Text, effects,
> masks, tracking, Omniframe, and 3D remain explicitly unsupported rather than being faked.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (or the Arena live preview)
npm run build      # production bundle in dist/
npm run typecheck  # tsc --noEmit
npm run tauri dev  # desktop shell; requires Rust + platform WebView prerequisites
npm run qa:stress  # 74-assertion Chromium workflow
npm run qa:advanced # recording/trace/repeat-export workflow
```

## What works right now

- **Import** video / image / audio via the single **Import** button or by dragging a file anywhere.
- **Real preview engine**: an imperative `requestAnimationFrame` canvas renderer (`src/lib/playback.ts`)
  that syncs cached `<video>/<audio>/<img>` elements to the playhead. Scrubbing/dragging never triggers
  React re-render storms, so the canvas updates immediately with no 2-second lag or blink.
- **Multi-track timeline** (`src/components/Timeline.tsx`):
  - add video/audio tracks
  - drag clips to **move** (within and across tracks)
  - drag edges to **trim**
  - **blade** tool + Split button to cut at the playhead
  - **snapping** to clip edges and the playhead
  - **adaptive zoom**: slider, zoom buttons, `Ctrl`+wheel zoom-to-cursor, and a ruler whose ticks go
    down to **frame level** at high zoom (timecode `HH:MM:SS:FF` shown)
  - horizontal scroll stays inside the timeline; the **page never overflows**
- **Inspector** (right panel): per-clip transform (position / scale / rotation / opacity), audio
  volume, source in/out, rename, split, delete.
- **Transport**: play/pause, go-to-start/end, live timecode, speed (0.5× / 1× / 2×, plus J/K/L), undo/redo.
- **Export**: records the live preview with `MediaRecorder` to `.mp4`/`.webm` (best-effort audio mix).
- **Voice isolation (real neural model)**: per-clip **Keep Vocal / Remove Vocal** powered by
  **Meta's Demucs v4 Hybrid Transformer (htdemucs)** running fully in-browser via ONNX Runtime Web
  (WebGPU, WASM fallback). 3 passes with shifted chunk windows averaged per-sample (worker per
  pass), LS cross-talk removal, plus a Silero-VAD pause gate. **"Slowed + reverb" edits are
  auto-fixed**: slowed productions are detected (Silero can't hear the vocals at native speed
  but clearly can when sped back up), separated at the corrected speed, and restored to the
  exact original timing — on by default, toggleable per isolation — or kept at
  **natural pitch** (the corrected-speed acapella: 88% vs 43% voice-like energy
  on the reference slowed track, the usable form for sampling/remixing). Scored on a deterministic mix
  against ground truth: **+20.4 dB SI-SDR, music bleed −56 dB, pauses −37 dB** (previous DSP
  engine: +0.4 dB — see the [listen pack](evidence/voice/listen/README.md) and the
  [robustness suite](evidence/voice/robustness/README.md) for input↔output pairs you can play);
  on a real "ultra slowed" track the auto-fix recovers buried vocals the direct pass misses
  (voice-like energy 52% → 78% on the worst window — [slowed-track pack](evidence/voice/slowed/README.md),
  [full-track study](evidence/voice/realworld/README.md)).
  Weights download once: `npm run fetch:demucs`
  (174 MB, git-ignored; personal/research use per Meta's license). Fast DSP and
  the in-house AI-Denoise ONNX engines remain selectable.
- **3-model audio stack (isolation + denoise + normalization per engine)**:
  1. **Demucs v4 htdemucs** (imported, isolation) — the flagship separator above.
  2. **RNNoise (Xiph)** (imported, denoise) — the classic trained GRU speech
     denoiser compiled from the official C sources (weights embedded, int8 +
     1/256) to a 1 MB freestanding wasm module. **Bit-identical to a native gcc
     build** of the same sources (max|diff| = 0 over the fixture), noise-only
     segments suppressed −24.6 dB, real speech at 0 dB SNR → **+13.3 dB SNR**,
     strict grader **GRADE A** (81% speech, +78 dominance) on the in-app
     evidence output. 48 kHz-native model; the engine resamples with the
     polyphase sinc core. `native/rnnoise/`, `scripts/build-rnnoise-wasm.sh`.
  3. **omni-unified-v1** (self-made, all three jobs in ONE graph) — 655K-param
     GRU masker + loudness head trained in-repo (`scripts/python/train_unified.py`)
     on synthesized mixes with known clean components (repo TTS voices × music
     beds × white/pink/hum noise at random SNRs; direct oracle-IRM mask
     supervision + bed augmentation). keep_vocal = masked voice + the model's
     own normalization gain; remove_vocal = phase-coherent subtraction
     (mix − voice estimate). **Trained 1,020,000 optimizer steps** (run 5,
     checkpoint-resumed across 8 sandbox resets — every segment honest in
     `RUNS.md`): keep_vocal +4.3 dB SI-SNR over the 0 dB-SNR mix bar,
     remove_vocal 0.00% residual speech under the strict grader, all outputs
     GRADE A. Browser runner verified **bit-faithful to torch** (mask parity
     ≤ 5e-6 across checkpoints). Training log with every run's honest
     numbers: `RUNS.md`.
  All three engines share the same finalization (DC block, −18 dBFS RMS
  loudness normalize with peak ceiling, near-silence skip) and are graded by
  the strict sample-level Python grader (`qa/strict_output_grader.py`).
- **Responsive shell** with always-visible icon rail; panels collapse to an arrow instead of hiding.

## Layout

```
TopBar  ── transport · timecode · speed · tools · import · export · panel toggles
LeftDock ── icon rail + expandable Media / Audio / … panels
Center  ── Preview (canvas) over Timeline
RightPanel ── contextual Inspector (collapses to a reopen arrow)
```

## Architecture

- `src/store.ts` — Zustand store: assets, tracks, clips, transport, zoom, undo/redo (state snapshots).
- `src/lib/playback.ts` — `PreviewEngine`: rAF loop, media caching, frame-accurate compositing.
- `src/lib/export.ts` — timeline capture + audio mix → downloadable file.
- `src/lib/demucs/` — vendored Demucs v4 (htdemucs) ONNX inference glue (MIT, npm `demucs` package).
- `src/lib/time.ts` — timecode, tick intervals, snapping, ids.
- `src/components/*` — pure React UI bound to the store.
- `native/dsp-core/` — the compiled DSP core (C++ → wasm32, ~11 KB): resampler, stem de-leak, pass averaging, peak safety. 2-3× faster than the JS fallbacks and **bit-identical** to them; every op falls back transparently. Build + parity policy: `native/dsp-core/README.md`.
- `src/lib/modelLoadStore.ts` + `src/components/ModelLoadOverlay.tsx` — every web model download/compile gets a live progress card (real byte counts when the server sends them, smooth monotonic simulation when it can't). Desktop loads the same models from disk, so its cards just flash by.

## Shipped (formerly the master-spec roadmap)

Every phase below started as a roadmap bullet and now ships with E2E coverage
(each `qa/*-e2e.mjs` runs against the real app in a headless browser):

1. **Masking mode** — brush / lasso / magic / flood-fill selection with
   per-frame masks (`qa/layout-selection-mask-e2e.mjs`, `qa/krita-transparency-mask-paint-e2e.mjs`).
2. **Mask tracking** — tracked propagation with correction
   (`qa/masking-tracking-mobile-drawing-e2e.mjs`, `qa/towel-masking-workflow-e2e.mjs`).
3. **Tracking engine** — the Tracking panel with mask/main track modes
   (`src/components/TrackingPanel.tsx`).
4. **Omniframe mode** — selection-driven edits that propagate across frames
   (`qa/omniframe-*-e2e.mjs`, five suites).
5. **3D / 2.5D** — 3D-in-2D compositing, Blender-style rotation, video planes
   (`qa/three-d-video-plane-e2e.mjs`, `qa/blender-rotation-e2e.mjs`, `qa/keyframe-graph-3d-e2e.mjs`).
6. **Local AI** — background removal modal, RotoMask click-to-segment with
   SAM (`qa/rotomask-e2e.mjs`, `qa/roto-isolation-browser-e2e.mjs`), plus the
   voice-isolation stack below.
7. **Templates** — typed template picker (`src/components/TemplatePickerModal.tsx`).
8. **Desktop shell** — the Tauri 2 crate exists (`src-tauri/`), deliberately
   minimal: it packages the web editor and exposes OS-level capabilities.
   Deeper native work (encoding, project persistence behind commands) stays
   future work.

## Evidence — every input and output, listen for yourself

All evidence files are tracked in the repo. Click any link and A/B the input
against its output. Every audio pair below was produced by the real app
engine through the same code path the UI calls (no reimplementation), and
each pack regenerates from its `qa/` script.

### Audio — input ↔ output pairs

| Pack | What you can play | Where |
|---|---|---|
| **Main study** (showcase A/B + old-DSP comparison + variant + the shared 6 s fixture, both modes) | 3 inputs → 8 output MP3s | [`evidence/voice/listen/`](evidence/voice/listen/README.md) |
| **Robustness edge cases** (mono voice memo, 48 kHz context, 0.5 s clip, two overlapping speakers, **default-strength 3-pass**, instrumental/karaoke mode — 11/11) | 5 inputs → 10 output MP3s | [`evidence/voice/robustness/`](evidence/voice/robustness/README.md) |
| **Real full-length songs** (two complete tracks, keep + remove vocal, plus the "ultra slowed" failure → diagnosis → v2/v3 fix study) | 10 MP3s, 108 s track included | [`evidence/voice/realworld/`](evidence/voice/realworld/README.md) |
| **Slowed + reverb tracks** (auto speed-fix on/off, natural-pitch acapella) | slowed pack | [`evidence/voice/slowed/`](evidence/voice/slowed/README.md) |
| **Per-engine outputs** (RNNoise denoise, omni-unified-v1 keep/remove — with a manifest of timings) | WAVs + [`manifest.json`](evidence/voice/engines/manifest.json) | [`evidence/voice/engines/`](evidence/voice/engines/) |
| **Full-fidelity main study** (the showcase input + its exact clean voice/music ground-truth stems + the isolated output, uncompressed) | WAVs | [`mix-showcase-input.wav`](evidence/voice/mix-showcase-input.wav) · [`mix-showcase-clean-voice.wav`](evidence/voice/mix-showcase-clean-voice.wav) · [`mix-showcase-clean-music.wav`](evidence/voice/mix-showcase-clean-music.wav) · [`mix-showcase-isolated.wav`](evidence/voice/mix-showcase-isolated.wav) |
| **Input source assets** (the TTS voices + synthesized music beds every mix above is built from) | MP3/WAV corpus | [`qa/assets/voice/`](qa/assets/voice/) |

### Scores — the numbers behind the pairs

Every pack above has a machine-written report with the PASS bars and exact
measurements: [`qa/reports/`](qa/reports/) — the headline ones are
[`voice-demucs-robustness.json`](qa/reports/voice-demucs-robustness.json)
(11/11 edge cases), [`voice-tts-mix-isolation.json`](qa/reports/voice-tts-mix-isolation.json)
(main study), [`voice-slowed-fix.json`](qa/reports/voice-slowed-fix.json)
(speed-fix, 18/18), [`ai-denoise-browser.json`](qa/reports/ai-denoise-browser.json)
(11/11), [`loudness-normalization.json`](qa/reports/loudness-normalization.json)
(7/7), and [`strict-audio-grades.json`](qa/reports/strict-audio-grades.json)
(sample-level Python grader, all GRADE A). Guard suites:
[`keyboard-shortcuts.json`](qa/reports/keyboard-shortcuts.json) (19/19),
[`axe-a11y.json`](qa/reports/axe-a11y.json) (14/14 surfaces clean),
[`bundle-budget.json`](qa/reports/bundle-budget.json) (payload budgets),
[`demucs-model-unavailable.json`](qa/reports/demucs-model-unavailable.json)
(failure path). Honest history of every training run and reset:
[`RUNS.md`](RUNS.md).

### Visual evidence

E2E screenshots and cutouts ([`evidence/screenshots/`](evidence/screenshots/),
[`evidence/cutouts/`](evidence/cutouts/)), frame-accurate export stills verified
with OpenCV ([`evidence/rebuild/`](evidence/rebuild/)), timeline/UI states
and drawing studies
([`evidence/drawing/`](evidence/drawing/)).

## License

MIT. Third-party model weights and native libraries are out of scope for this foundation and will be
audited before shipping (see the master spec's license policy).
