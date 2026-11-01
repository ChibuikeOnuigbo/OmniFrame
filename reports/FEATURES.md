## 2026-11-01 — 1,152 Studio Looks and effect-library controls

Added 1,152 original shared-engine presets (12 families × 12 palettes × 8 tonal mixes), collection filtering, persistent favorites, explicit reversible previews and visible adjustment-layer actions. All new recipes passed changed-pixel, distinct-fixture-signature and parameter-bound checks; browser apply/undo/redo, bundle round-trip and real video export passed. Base catalog: 10,481; fully loaded with existing glitch pack: 15,481 entries. Counts are recipes, not algorithms or universal perceptual uniqueness. See `docs/STUDIO_LOOKS_20261101.md` and `qa-output/studio-looks-20261101/`. Prior broad editor/model/sculpting/native-platform work remains open.

## 2026-11-01 continuation

Supplied Gold Motion and Toji Motion APKs downloaded and statically identified; resource catalogues and package metadata saved under `research/editor-upgrade-20261031/`. Open-source licensing and Nova identity remain unverified. The preview render budget now covers 3D WebGL draws as well as 2D composition. See `docs/EDITOR_PERFORMANCE_20261031.md`.

## 2026-10-31 — Playback performance, media proxies and stable 3D viewport

Current user request is a broad editor quality/performance upgrade against the uploaded full ledger. Implemented and measured: preview frame budgets, idle render suppression, no preview upscaling, visible render metrics, temporary video proxy preparation with original audio/export preservation, cancellation and memory bounds, stable 3D context across scrubbing/resizing, geometry/material cleanup, and unobstructed 3D tools. Desktop CI now preserves installers and typechecks. General E2E selectors and export-success requirement repaired.

Read `docs/EDITOR_PERFORMANCE_20261031.md` for exact checks, current research and remaining scope. Evidence: `qa-output/performance-20261031/`; fresh Drive listings, uploaded-ledger index, repository searches and sampled reference review: `research/editor-upgrade-20261031/`. Proxies are tab-local realtime WebM, not frame-exact persistent/native proxies. No comparative speed benchmark, new model training, sculpting implementation or native platform certification is claimed. No environment configuration or publication, remote push or PR performed. Continue the open work listed in that report; preserve user media and historical evidence.

# Verified implementation changes — 2026-10-31

Textured external asset increment: six new transition presets, five downloaded CC0 models plus one original fracture rig using a CC0 material. Device 3D now includes two Poly Haven CRTs with live video screens; Object 3D includes arrow/shell/payphone/fracture motions with parameter controls, thumbnails, source credits, undo and bundle persistence. Actual moving WebGL renders, native MP4/audio export, packed-source reopening and existing browser regressions passed. See `docs/EXTERNAL_TRANSITION_ASSETS_20261031.md` and `evidence_video/asset-transitions/` for source links, measured output and scope. Sketchfab download authentication remained unavailable.

Latest resumed increment: `docs/RESUMED_EDITOR_WORK_20261031.md`. Saved commit `807e8f1b` is pushed to `codex/omniframe-editor-improvements`; latest main was merged into that working branch. All 15 speed curves now control actual headless source sampling via shared app maths, with 120 exact pixel comparisons / 15 moving exports. Live MCP clock/trim/volume editing supports undo and project persistence. Nonzero-start compound creation and ordinary moved ungroup preserve time. A second original kinetic typography MP4 is delivered. Actual Drive source downloads and BrandBird responsive interactions are now evidenced; YouTube direct requests still return 403. Older local-only/access statements below are historical.

This ledger describes code and executed checks in `codex/omniframe-device-glitch-production`, based on merged main `ba7103b8`. It supersedes conflicting historical counts, without certifying every old feature claim. See `docs/CODEX_TASK_RECOVERY.md` and `continue.md` for remaining work.

| Change | Code | Verification / artifact |
|---|---|---|
| Seven actual editable device models, UV-mapped video screens and cached WebGL renderer | `scripts/blender/`, `public/models/device_transitions/`, `src/lib/deviceModelRenderer.ts` | Blender 4.3.2 executed; 21 Cycles model previews, seven model/UV checks and exact endpoint screenshots in `qa-output/device-transitions/` |
| Device motions and compact screen/camera/lighting inspector | `device3d.ts`, `DeviceTransitionInspector.tsx`, `TransitionsPanel.tsx`, `RightPanel.tsx` | Four kinds × 19 motions 30/60 fps mathematical checks; actual browser camera/light pixel differences; UI controls, project/undo tests; moving-video MP4 reel |
| Authored 5,000 recipe library and ordered Glitch V2 layers | `effectCatalog.ts`, `glitchNG.ts`, `fxInstances.ts`, `EffectsPanel.tsx`, `FxStackSection.tsx` | All 5,000 shared-kernel + compositor diagnostics; real UI search/apply; deterministic/alpha/zero/blend/layer/keyframe tests; five animated demos |
| Queue recovery, uniform temporal signatures and full retained reel | `qa/newglitch-batch.mjs`, `qa/glitch-video-signature.mjs` | Checkpoint 860 / 602 retained / 245 duplicates / zero failed; full-motion acceptance still unfinished |
| Triangle, diamond, pentagon, hexagon, octagon, heart, chevron, rounded rectangle; corrected star/fill | `drawingEngine.ts`, `DrawingToolbar.tsx`, `DrawingPanel.tsx`, `DrawingCanvasOverlay.tsx` | Geometry/bounds/fill tests and actual filled-heart pointer drawing screenshot |
| Local FX clocks and split keyframe/source-phase continuity | `fxInstances.ts`, `store.ts` | Left/right frame parity and boundary interpolation assertions |
| Correct denoise strength and dry/wet bypass | `aiDenoise.ts`, `rnnoise.ts`, `voiceIsolation.ts` | Real ONNX noisy speech browser fixture; dry bypass error < 1 PCM16 step; one-fixture SI-SNR improvement ~0.93 dB |
| Sample-rate-aware DC removal, stereo-linked RMS gain and peak ceiling | `audioOutputMath.ts`, `voiceIsolation.ts` | 8/16/44.1/48/96 kHz finite/silence/peak/stereo checks |
| Real audio bus and RMS/peak metering; repeated exports keep audio | `audioBus.ts`, `AudioMeter.tsx`, `export.ts`, `playback.ts` | Calibrated stereo tone RMS/peak and -6.02 dB half-volume test; two actual exports decode with nonzero audio |
| Project isolation and actual smart patch rendering | `tools/mcp/{tools,appRender}.mjs`, `src/lib/patchUnder.ts` | New-project pixel cleanup and patch-only compositor tests; browser Smart Patch and universal workflows pass. Clone seams/natural removal remain visual work. |
| Live-agent correctness | `mcpBridge.ts` | Live browser MCP mask defaults, undo, move/key/curve persistence, invalid selection/duration/track rejection, timeline proof |
| Context menus and popup sizing | `ViewportMenu.tsx`, `Studio.tsx`, `Timeline.tsx`, `MarkerPopup.tsx` | Measured global/timeline menus, inline submenus, scrolling and keyboard regression; seven-width existing responsive suite |
| Universal board replay and evidence audit | `qa/recover-board-renders.mjs`, `scripts/audit-project-history.py` | A–J machine replay; separate outputs/traces/timelines; per-file age and source questions; no new task-shaped tools |
| Reliable video-study evidence | `scripts/extract-study-evidence.py`, `audit-study-evidence.mjs`, `.github/workflows/video-audit.yml` | Acquired-byte duration and actual timestamps, aspect-preserving uniform/scene samples; real portrait fixture regression passes; weak historical samples flagged for review |
| Reproducible encoder and error cleanup | `tools/mcp/core.mjs` | Lockfile-pinned FFmpeg; encoder failure regression; valid decoded XML round-trip frames |

Machine checks and viewable proofs do not imply every recreation visually matches its original reference. Native desktop build, all historical tasks, complete 5,000 full-motion acceptance, camera keys, DOF/motion blur and all Drive studies remain outside verified completion.


## Creative-workspace increment

The latest direct RDT upload is now preserved and used in `evidence_video/reala/normal edit/RDT_recopy.mp4`: 752 frames / 30 fps, 750 distinct decoded hashes, one source audio track and 0.99736 audio correlation. It is explicitly a reference-derived recomposition, preserving burned-in scene cuts, typography and effects. Source SHA/probe/cut-score candidates and sampled study notes accompany it. Independent raw-footage recreation remains open. Generic universal-tool exports now preserve imported top-level video audio, source trims, clip delay and volume; a moving/audio end-to-end test checks correlation, summed overlap gain, silence, mute and source-offset pixels. Native video frame canvases and ImageData are reused within the 40-frame bound. No new publish/push was performed.

See `docs/CREATIVE_WORKSPACE_20261031.md` for verified drawer/palette/grouped-menu fixes, shared perspective/liquify engines, existing marquee/roto integration, retained history selection, 23-tool live bridge, real moving-video decoding and source indexing. Evidence: `evidence_video/`. No commercial-tool parity, new trained model, full creator watch or RDT source match is claimed. Checkpoint advanced to next 868 / 602 retained / 253 duplicate decisions / zero failed. This increment remains local under the user’s no-publish instruction.
## 2026-11-01 moving-effects and editor workflow QA

Verified 1,152 two-second moving Studio Look renders and one 2,304-second combined reel (27,648 frames). Added direct Horizontal/Oblique/Vertical/Radial/Cinematic/Motion Blur entries, grouped keyframeable blend modes, non-destructive rendered MCP previews for effects/transitions/LUTs/text, paginated preset discovery, and GIPHY MP4 import. Independently recreated the requested RDT-style edit from seven separate Gojo source segments via editor MCP tools: 25.06 seconds, 360×640, 24 fps, 601 distinct decoded frames, and audio. Evidence and limitations: `docs/EDITOR_QA_20261101.md`.

## 2026-11-01 moving video text crop and GIF providers

Added a real video-inside-text workflow to browser playback and headless MCP. An imported video is duplicated into glyph alpha, can be inverted and graded inside the letters, has a controllable solid core and source offset, and remains editable with Screen/Color Burn blend keys. The duplicated matte has its own live decoder so a background copy and text copy can seek independently. `new_work_qa/RDT_recopy2.mp4` is the corrected 601-frame evidence render with seven different scene looks and speed curves. Added Settings keys and one Media popup for GIPHY plus Klipy, including provider switching, trending/search, attribution, loading/error/download states and MP4 media import. Unit and live browser QA cover both providers and the moving matte.
