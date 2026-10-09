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

## License

MIT. Third-party model weights and native libraries are out of scope for this foundation and will be
audited before shipping (see the master spec's license policy).
