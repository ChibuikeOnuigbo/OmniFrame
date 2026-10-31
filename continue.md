# OmniFrame continuation — read every run

## Current source and acceptance

Latest asset-pack increment: `docs/EXTERNAL_TRANSITION_ASSETS_20261031.md`. Five licensed external models (two CRT TVs, payphone, arrow geometry, bullet-shell geometry) and a CC0 cracked-concrete material are acquired and verified. Six new presets are in Device 3D / Object 3D. Runtime GLBs embed their maps; six packed editable Blender sources are in `assets-source/transition-pack/`. Do not confuse the original 35-piece fracture rig with a downloaded simulation. Sketchfab search worked but downloading needs authentication; no protected model was taken from a viewer.

View `evidence_video/asset-transitions/six-asset-reel.mp4` and its manifest. Six actual PreviewEngine/GLB demos each have 49 distinct 30-fps frames and advancing source video; native MP4 export retains sound (RMS 0.06314), with 19 VFR frames in 1.63075 s on software WebGL. Exact endpoints, controls/undo, bundle round-trip and the generic transition API passed. Existing device/glitch/drawing, context-menu and live MCP checks passed; current device catalog is nine models. Current phone/desktop UI screenshots and no-overflow measurements are under the evidence folder's `ui/`.

Latest user instruction authorizes pushing the saved editor changes to a **new branch**, leaving PR creation to the user. Current branch is `codex/omniframe-editor-improvements`. Initial saved commit `807e8f1b` was pushed and verified on GitHub; latest main `d9214115` was merged into this working branch. Do not push/merge main, create the PR, force-push, or publish environment configuration. Earlier local-only statements are superseded. Read `docs/RESUMED_EDITOR_WORK_20261031.md` for current code, actual access tests and remaining work.

The resumed increment fixes shared headless speed-curve source clocks (15 MP4s, 120 exact source-pixel comparisons), live MCP curve/trim/volume validation plus undo/project persistence, and nonzero-start compound timing. A second original word-stack motion study is in `evidence_video/reala/motion design/`. These are diagnostics/studies, not the full 150-edit quiz or faithful recreations.

Drive full file downloads now work: actual 1080×1920 / 27.632 s `8hjWrzum_vQ` reference, collection manifest and correct BrandBird RAR were acquired, hashed and studied. Native frames at 3/18/24 s and responsive BrandBird interactions at 390/768/1440 px are recorded in `research/new_study_vdieos/`. The collection index has 259 metadata records / 60 archive plans; historical download claims are not new viewing. Direct YouTube yt-dlp requests still return proxy CONNECT 403. Do not route around denied destinations.

Earlier upload checkpoint: the user supplied `RDT_20261027_092910.mp4` directly. Its 25.067 s / 360×640 / 30 fps source is preserved in `evidence_video/reala/source/`. `qa/render-rdt-reference.mjs` renders the reference-derived `evidence_video/reala/normal edit/RDT_recopy.mp4` through universal tools: 752 frames, 750 distinct decoded hashes, one audible source track, 0.99736 decoded-audio correlation. This is a two-layer recomposition of the finished edit; existing titles/cuts/effects remain baked in. Independent recreation still needs original scene clips. Source access to that finished reference is resolved.

Headless exports now preserve top-level imported-video audio, trims, placement and volume. `qa/headless-video-audio-e2e.mjs` checks source offset, delay, overlapping gain, silence, mute, independent duplicate/replacement source windows and actual fast/layered video pixels. Visual speed curves are supported. Nested compound audio, nonlinear speed-remapped audio and audio time effects remain explicitly unsupported by this export path. Browser audio export remains on its existing engine.

The user merged the prior branches into **main** and explicitly asked to use it. Work started from `origin/main` at `ba7103b89600ef4afa2d4ac5a55e1be1a24ac1ea` on `codex/omniframe-device-glitch-production`. Preserve local/user work. Never hard-reset to the old Arena branch, force-push, or merge to main without authorization.

Read **`docs/CODEX_TASK_RECOVERY.md`** for the recovered quizzes A–T, YouTube/Drive requests, screenshot packs, exact file map and acceptance questions. `reports/repo-audit/historical-questions.json` preserves distinct historical feature/failure topics with all source heading lines. Old generated ledgers and check marks are claims, not verified completions.

## Verified implementation in this branch

- Seven real Blender-authored device GLBs, metadata and editable `.blend` sources in `public/models/device_transitions/`, with separate UV-mapped `ScreenSurface`. Browser Three renderer uses actual composited video; exact final handoff; perspective Canvas fallback retained.
- Nineteen device motion paths including spin, barrel roll and bounce; Device3D tab; right inspector for model/motion/fit/FOV/distance/angles/lighting/brightness/duration, reset and preview. Settings persist through `.omni`, undo and redo.
- All 5,000 authored NG recipes in the lazy UI pack; ordered layers, blend/opacity, keyframes, per-clip clocks, deterministic seeds and meaningful families. Zero-strength/all-blend identity, split-key/phase continuity, bounds and alpha tested.
- Eight additional geometric tools, shared preview/export drawing, correct closed-shape fill and star geometry; compact grouped toolbar.
- Denoise strength direction, dry bypass, RNNoise mix, retryable model sessions; sample-rate-aware DC rejection, linked normalization, peak guard; real measured audio meter. Repeated recorder exports retain sound and use range playback clock.
- Headless project reset clears prior paint/selections/compound stack/video frames; saved templates survive. Patch-only clips now enter the compositor; clone/gradient/four-tap blur affect real pixels using immutable samples and clip-local coordinates. Natural object-removal quality still needs work.
- Live MCP mask defaults, immutable curve persistence, undoable edits and invalid-input errors fixed. **21 live bridge tools; 69 headless registry tools**, not equivalent surfaces.
- Measured/scrollable viewport-safe timeline context menus with keyboard navigation; marker popup height bounds and Escape.
- Restored archived A–J recipe rendering through universal tools; regenerated outputs are in `qa-output/recovered-boards/`, machine results in its `report.json`. Board A offsets corrected after viewing actual output. Visual source-match acceptance remains separate.

## 5,000 recipe mandate — unfinished full-motion acceptance

Canonical source: `new_glitch/presets.ndjson`. Rebuild UI pack: `node scripts/build-glitch-recipe-pack.mjs`.

Canonical full-motion queue: `node qa/newglitch-batch.mjs --count=88`. Legacy `new_glitch/batch/glitch_batch.mjs` delegates to it. Only one writer at a time. The cursor is the next **1-based** recipe number; completed IDs repair old zero/one-based disagreements. Failures remain pending, checkpoints write atomically, interrupts finish the current item. Dedupe uses uniformly rebuilt v2 temporal luma signatures from retained MP4s.

Checkpoint at this update: **next 868; 602 retained; 253 historical/new duplicate decisions; zero failed**. Historical duplicate decisions remain historical; do not present them as newly re-reviewed. Continue until all 5,000 candidates have full-motion classification; perceptual/human acceptance is still separate.

All 5,000 passed three-frame shared-kernel checks and one active compositor frame each. `qa-output/glitch-v2/all-5000-compositor-diagnostic.mp4` is a single-frame-per-recipe diagnostic, **not 5,000 fully watched/unique videos**. Keep these counts distinct. Return to the queue after special tasks.

## Next unresolved work, oldest requirements first

1. Complete per-board visual review against actual instruction images; A–J replay success alone does not prove roto/inpaint accuracy. Board C explicitly requests **150 edits** and 15 speed curves; ten archived still-based variants are insufficient. Recover its original moving source, and S/T input media where absent. See the recovered task guide.
2. Reconcile individual YouTube inventory/frame/media records; `scripts/audit-study-evidence.mjs` found 98 sample sets with fewer than three distinct decoded images. Fixes for zero-metadata sampling and portrait stretching are in `scripts/extract-study-evidence.py`, tested with a real portrait fixture; remote worker has not been run. top-level `progress.json` conflicts with its checkpoint and older final report. Do not call metadata-only or sampled sheets continuous watching/audio review.
3. Published unrestricted policy now permits full Drive downloads, not just listing HTML. The full requested short, collection manifest and correct BrandBird mirror were acquired; `access-refresh.json` records hashes and actual probe data. Separate raw RDT scene sources and full pack pagination/cutouts remain unresolved. Do not reapply the old configuration draft or publish environment settings. Direct yt-dlp requests still return proxy HTTP 403. Collection metadata and sampled observations are in `research/new_study_vdieos/new_study_vdieos.md`; inventories do not count as full creator viewing.
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

## Creative-workspace increment (local, not published)

See `docs/CREATIVE_WORKSPACE_20261031.md`: mobile stacking/hit ownership and drawer sizing repaired; grouped phone actions; fully bound original purple palette; combined transform modes; actual corner-pin and four liquify brushes with shared raster rendering, history and project persistence; headless video decoding fixed. Live MCP now 23 tools; headless registry remains 69. New proofs are under `evidence_video/`. All source requests and remaining limits are recorded in the new study. User instructed not to publish; keep changes local unless subsequently authorized.
