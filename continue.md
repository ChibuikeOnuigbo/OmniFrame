# OmniFrame continuation — read every run

## Current source and acceptance

The user merged the prior branches into **main** and explicitly asked to use it. Work started from `origin/main` at `ba7103b89600ef4afa2d4ac5a55e1be1a24ac1ea` on `codex/omniframe-device-glitch-production`. Preserve local/user work. Never hard-reset to the old Arena branch, force-push, or merge to main without authorization.

Read **`docs/CODEX_TASK_RECOVERY.md`** for the recovered quizzes A–T, YouTube/Drive requests, screenshot packs, exact file map and acceptance questions. `reports/repo-audit/historical-questions.json` preserves distinct historical feature/failure topics with all source heading lines. Old generated ledgers and check marks are claims, not verified completions.

## Verified implementation in this branch

- Seven real Blender-authored device GLBs, metadata and editable `.blend` sources in `public/models/device_transitions/`, with separate UV-mapped `ScreenSurface`. Browser Three renderer uses actual composited video; exact final handoff; perspective Canvas fallback retained.
- Nineteen device motion paths including spin, barrel roll and bounce; Device3D tab; right inspector for model/motion/fit/FOV/distance/angles/lighting/brightness/duration, reset and preview. Settings persist through `.omni`, undo and redo.
- All 5,000 authored NG recipes in the lazy UI pack; ordered layers, blend/opacity, keyframes, per-clip clocks, deterministic seeds and meaningful families. Zero-strength/all-blend identity, split-key/phase continuity, bounds and alpha tested.
- Eight additional geometric tools, shared preview/export drawing, correct closed-shape fill and star geometry; compact grouped toolbar.
- Denoise strength direction, dry bypass, RNNoise mix, retryable model sessions; sample-rate-aware DC rejection, linked normalization, peak guard; real measured audio meter. Repeated recorder exports retain sound and use range playback clock.
- Live MCP mask defaults, immutable curve persistence, undoable edits and invalid-input errors fixed. **21 live bridge tools; 69 headless registry tools**, not equivalent surfaces.
- Measured/scrollable viewport-safe timeline context menus with keyboard navigation; marker popup height bounds and Escape.
- Restored archived A–J recipe rendering through universal tools; regenerated outputs are in `qa-output/recovered-boards/`, machine results in its `report.json`. Board A offsets corrected after viewing actual output. Visual source-match acceptance remains separate.

## 5,000 recipe mandate — unfinished full-motion acceptance

Canonical source: `new_glitch/presets.ndjson`. Rebuild UI pack: `node scripts/build-glitch-recipe-pack.mjs`.

Canonical full-motion queue: `node qa/newglitch-batch.mjs --count=88`. Legacy `new_glitch/batch/glitch_batch.mjs` delegates to it. Only one writer at a time. The cursor is the next **1-based** recipe number; completed IDs repair old zero/one-based disagreements. Failures remain pending, checkpoints write atomically, interrupts finish the current item. Dedupe uses uniformly rebuilt v2 temporal luma signatures from retained MP4s.

Checkpoint at this update: **next 860; 602 retained; 245 historical/new duplicate decisions; zero failed**. Historical duplicate decisions remain historical; do not present them as newly re-reviewed. Continue until all 5,000 candidates have full-motion classification; perceptual/human acceptance is still separate.

All 5,000 passed three-frame shared-kernel checks and one active compositor frame each. `qa-output/glitch-v2/all-5000-compositor-diagnostic.mp4` is a single-frame-per-recipe diagnostic, **not 5,000 fully watched/unique videos**. Keep these counts distinct. Return to the queue after special tasks.

## Next unresolved work, oldest requirements first

1. Complete per-board visual review against actual instruction images; A–J replay success alone does not prove roto/inpaint accuracy. Recover S/T input media where absent. See the recovered task guide.
2. Reconcile individual YouTube inventory/frame/media records; top-level `progress.json` conflicts with its checkpoint and older final report. Do not call metadata-only or sampled sheets continuous watching/audio review.
3. Latest Drive folder `1uP9ySa8P2p9yGM4gJsn8fxuosQ1k2XrN` was blocked by proxy CONNECT 403 before Google. Draft environment allowlist additions for `drive.google.com` and `api.github.com` need review/save/publish to apply. No current folder contents were read. Then recursively inventory subfolders and compare hashes/provenance with archived manifests; do not bypass access restrictions.
4. Continue the 5,000 full-motion queue and review duplicates with declared metrics.
5. Device custom camera animation keys, material/reflection controls, real scene shadows/DOF/motion blur remain open; do not label them implemented. Lighting is real key/rim/hemisphere lighting, not an HDR environment map.
6. Broaden noise/separation acceptance beyond the current synthetic noisy-speech fixture. Do not call DSP a trained separator. Native Tauri build needs Rust/Cargo, GTK and rsvg dependencies.
7. Realtime MediaRecorder export has VFR/timing overhead; exact offline frame/audio export remains work.

## Every-run checks and rules

- Inspect Git status and current HEAD; use the latest user branch instructions.
- `npm ci` if dependencies are absent; retain inherited proxy and CA settings. Blender 4.3.2 is available here. FFmpeg/Chromium use lockfile-pinned packages.
- `npm run typecheck` and `npm run build`.
- Shared engines: `qa/{glitch-ng-layers-unit,device-rig-unit,drawing-shapes-unit,audio-output-math-unit,fx-split-continuity-unit,video-encoder-failure-unit}.mjs`.
- With fresh Vite running: `qa/{device-glitch-production-e2e,audio-strength-e2e,audio-bus-e2e,mcp-live-bridge-e2e,context-menu-viewport-e2e}.mjs`.
- Preserve existing workflows: `qa/{universal-tools-unit,tymm-lut-parity,alight-roundtrip,replace-template-demo}.mjs`.
- Visual QA: `qa/render-device-transition-reel.mjs`, `qa/render-glitch-v2-reel.mjs`, `scripts/create-qa-contact-sheets.mjs`; inspect actual outputs.
- Universal-tools law: no task-shaped tools or agent-authored answer pixels. Preview/export share `src/lib` engines; preserve project persistence and undo. Never delete user media. Keep ≤9 primary items per section. Exact directory spellings: `new_doc_toll_research`, `data_motiondesijg`.
- Regenerate audit after substantial changes with `python scripts/audit-project-history.py`. Use Git age, not checkout mtimes, for the seven-day window. Inventory is not functional or visual acceptance.
- Update `reports/STATE.md`, `reports/FEATURES.md` and concrete checkpoint/evidence. Never invent completion, watched counts or ≥80% similarity without a declared metric.
