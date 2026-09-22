# Baseline before real-editor upgrade

Captured: 2026-09-22  
Branch baseline: `arena/01a0bf54-omniframe` at `87d3333`

## Runtime-confirmed capabilities

- Shared React/Vite frontend and Tauri 2 shell scaffold.
- Media import for browser video, image, and audio files using object URLs.
- Stable asset, track, and clip IDs during the current browser session.
- Clip move/trim/split/delete/duplicate/copy/paste, extracted audio, clip visibility, undo/redo.
- Adaptive zoom ruler, continuous scale, frame-rate selection, drop-frame display for 29.97/59.94, pointer-captured scrubbing.
- Central target-aware context menu and browser-safe editor shortcut routing.
- Canvas preview compositor and MediaRecorder-based web export foundation.
- Compact searchable Settings overlay; three real preview-quality profiles.

## Confirmed limitations (not disguised as completion)

- Time fields are JavaScript seconds, not yet rational/fixed-point values.
- Track model has video/audio type, mute, hide, lock, and height only. Gapless, solo, sync groups, native ordering commands, and full cross-track drag are absent.
- Media object URLs are not durable project persistence.
- Preview/export equivalence has not been decoded and frame-compared.
- Masking, tracking, OmniFrame temporal graph, effects, transitions, keyframes, and 3D scene graph are not implemented by the current small source tree; UI claims must remain absent until real.
- Desktop shell cannot currently be compiled in this environment because Cargo/rustc are unavailable.
- Firefox, Safari, Windows, macOS, and native Linux desktop QA are unavailable here.
- User-attached `lumacutEngine.ts`, `bgRemovalWorker.ts`, and master command were announced at `/home/user/uploads`, but that directory is absent in the sandbox. Their source has therefore **not** been inspected; this is a hard blocker for modifying that subsystem safely.

## Latest measured checks before this phase

- Typecheck and production build: PASS at `87d3333`.
- Chromium context/Settings suite: 55 PASS, zero captured runtime errors.
- Timeline ruler suite: 37 PASS in prior evidence.
- Timeline controls suite: 13 PASS in prior evidence.

## Evidence paths

- `.audit/final-acceptance.md`
- `.audit/timeline-ruler-algorithm.md`
- `.audit/hide-clip-tests.md`
- `.audit/settings-popup-tests.md`
- `qa/reports/`

This report records capability truth, not the much larger requested target state.
