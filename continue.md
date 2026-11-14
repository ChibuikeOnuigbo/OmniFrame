## 2026-11-14 — colored effect-mask feather

Effect masks now expose black/white/blue/custom edge color, tint strength and
inward/outward edge bias. Browser and headless rendering share the alpha/tint math;
headless pixel and live control checks passed. This optional path uses canvas
pixel readback; 4K performance profiling remains open. See the finishing goal.

## 2026-11-14 — Bezier effect-mask handles

Each custom-mask point now supports editable incoming/outgoing handles with preview
overlays, reset control and shared browser/headless cubic geometry. The mask pixel
check compares the same polygon with and without handles; live drag/reset tested.
See docs/EDITOR_FINISHING_GOAL.md for remaining tasks.

## 2026-11-14 — monitor mask drawing and curve smoothing

Effect masks now support click/drag polygon editing, freehand outlines, quarter-guide
snapping, smooth cubic curves and conversion from a selection. Empty/unfinished
custom masks stay transparent. Browser and headless renderers use the same curved
path calculation. See docs/EDITOR_FINISHING_GOAL.md for acceptance and open work.

## 2026-11-14 — editor finishing goal and View Mask shapes

The working goal and acceptance rules are in docs/EDITOR_FINISHING_GOAL.md. Added
star and hexagon effect masks through shared browser/headless path geometry, plus
text font selection and editable polygon point coordinates. Further handwriting,
interactive mask drawing and physics effects remain open.

## 2026-11-14 — OpenCV acceptance and Draw on

The full onion-skin export test passed with project-local OpenCV: 124 decoded
frames, average luminance 205.42. Animation adds an adjustable freehand path
reveal using the shared browser/headless paint renderer; pixel progression and
live undo checked. Details: docs/ANIMATION_MASK_WORK_20261114.md. Typed
handwriting and advanced requested effects remain open.

## 2026-11-14 — animation entry and effect mask controls

Animation now has a dedicated 2D entry using existing frame drawing, onion skins and
curves, with duplicate/clear cel exposure edits and undo. Effect masks can start with
a chosen shape; Split covers a rotatable half-plane and Outside swaps sides. Shared
browser/headless renderers support it. See docs/ANIMATION_MASK_WORK_20261114.md.
The broader physics, handwriting, hologram and learned-model requests remain open.

## 2026-11-09 — photographic thumbnail correction

Effect catalog subjects now use two bundled Pexels photographs: a portrait for
face/skin/beauty, color, blur and lighting; a car for glitch and other motion.
Idle thumbnails apply shared canvas filters and raster grading before selection.
Motion blur demonstrates shared temporal sample weights on a staged photo pan.
LUT previews use the portrait, including their loading/error fallback, without
category text over the picture. Source URLs, licenses and SHA-256 hashes are in
`public/assets/effect-subjects/credits.json`.

Fixed idle photo restoration after adding an effect or stopping an audition.
Browser coverage includes photo restoration, Gaussian/temporal blur pixel changes,
scrubbing, add/double-click, menus and live MCP. Typecheck and production build
pass. Screenshots: `qa-output/square-preview/{glitch-photos,blur-photos}.png`.
Idle cards are representative stills, not exhaustive temporal/3D effect renders;
active auditions continue to mirror actual project footage. Full catalog visual
acceptance and the earlier outstanding editor tasks remain open.

## 2026-11-09 — square previews, 300K recipes and timeline audit

Square effect/transition cards mirror active program auditions, expose a scrubber,
hover/focus Add and double-click commit. Three reusable local subject images,
themed catalog shortcuts, 300,000 base / 305,000 loaded recipes. Timeline gets
3px raised playhead, marker alignment color, searchable markers, resolved marker
navigation, millisecond ruler and decoded-media scrub pause. Ripple-delete menu
added. Evidence and limits: `docs/SQUARE_EFFECT_BROWSER_20261109.md` and
`ultimate tests/Ultimate_timeline_est.md`. Twenty million numerical clamp cases
are distinct from the browser/render tests; full timeline certification is open.

## 2026-11-08 — movable tilt-shift focus plane

Tilt Shift now has six shared preview/export controls: amount, focus X/Y,
angle, width and feather. The renderer keeps an angled sharp plane over a
blurred field, works in translated clip-isolation canvases and reuses bounded
scratch surfaces instead of allocating three canvases per frame. Forty-eight
curated, editable presets raise the catalog to 150,048 base / 155,048 loaded
while preserving every indexed ID. Catalog search now matches all natural query
tokens across punctuation. Unit and live browser evidence is documented in
`docs/TILT_SHIFT_FOCUS_20261108.md`.

## 2026-11-08 — strict 200-control UI scan

The left dock now uses a reusable keyboard focus fallback, 24px slider/action
targets, explicit pressed semantics and stronger selected/rest/hover border
hierarchies. The Effects collection picker follows the requested three-cell
layout (previous / current collection / next), and its categories use a stable
four-column grid. A live 1600×1000 Chromium audit measured exactly 20 visible,
unclipped controls in each of ten modes and produced **200 PASS / 0 REVIEW /
0 FAIL**, with no page errors. Ten cutout contact sheets and the complete
numbered ledger are in `docs/UI_QUALITY_200_SCAN_20261108.md` and
`qa-output/ui-200/`. The separate two-viewport affordance sweep also reports
zero tiny, unnamed or duplicate-test-id findings.

## 2026-11-08 — 150K indexed effects and working shortcut settings

The Effects browser now has 150,048 base recipes: 10,623 curated/materialized
plus 139,425 stable indexed variations. Loading the separate authored Glitch NG
pack produces 155,048 live recipes. Indexed recipes are reconstructed by page
or ID instead of retained as 139k objects. UI search, categories, collections,
favorites, project application and MCP paging/lookup use the same catalog API.

Settings now exposes 44 configurable commands and Studio actually executes
those saved bindings. Rebind, reload persistence, clearing, exact modifiers,
multi-delete, grouping and export In/Out passed unit/live browser checks.
Details and limits: `docs/EFFECT_CATALOG_150K_20261108.md` and
`qa-output/effect-150k/`. Counts are recipes over shared kernels; do not report
them as 150,048 independent algorithms or full-motion approvals.

## 2026-11-08 — lens bokeh, exact catalog count and source audit

Camera lens bokeh is now a shared browser/headless raster effect with editable
amount, radius, highlight threshold/gain, eight aperture shapes, rotation and
softness. Sixteen real recipes bring the base catalog to 10,575 unique IDs and
the loaded total to 15,575 with the existing 5,000 pack. These are recipe
counts. Numeric controls keyframe and the existing effect-region mask scopes
the result. A live-browser translated-pad bug was found from the screenshot and
fixed; rerun the live UI test after future pixel-grade transform work.

Official blur/animation pages, the MIT LibreCuts release/source and a CC0 Poly
Haven camera candidate are recorded in `docs/LENS_BOKEH_EFFECTS_20261108.md`
and `research/effect-source-audit-20261108.json`. The APK was never executed;
the camera candidate was hash-verified and Blender-rendered but not bundled.
Do not call this a complete scan of every linked product manual or a native
Android/desktop certification.

## 2026-11-07 — Motion Lab 201 original editable templates

The orphaned four-item sequence-template modal is now a reachable Motion Lab with 201 original recipes, 16 categories, 12 keyframe motion families, eight procedural backdrops, search/filtering, media slot mapping and a real editable scene builder. The top-bar/mobile opener, modal stacking, generated SVG background, aspect setting, media fallbacks, styled text layers and Curve Engine keys passed unit and live Chromium checks. Evidence and exact access limits: `docs/MOTION_LAB_20261107.md`, `research/motionvid-public-catalog-scope-20261107.json`, `qa-output/motion-lab/`.

Motionvid public pages reported 201 individual template URLs, but its Terms prohibit scripted scraping/internal endpoints and copying or derivative platform technology. No Motionvid projects or preview assets were bulk-downloaded or committed; no full-preview watch is claimed. The response is an independent OmniFrame catalogue using general motion-design techniques.

## 2026-11-07 — shared Burst/Aura engine, turbulence, liquify and effect regions

Current branch `codex/omniframe-text-crop-gif-providers` now has a shared deterministic action engine: 50 real Burst presets (10 families × 5 tiers), eight bright-pixel aura presets, six FBM/curl/glass turbulence presets and eight parameterized liquify presets. Burst ranges loop with editable speed/cycle/gap, preserve phase across parent splits, and expose `Fit 1×`. Every FX stack row links to the existing multi-region effect mask; the mask scopes the combined clip stack, including raster/action effects and adjustment layers. Effect tabs/cards gained compact icons and asset browsing no longer displays licence acronyms, while attribution metadata remains stored.

Verified: typecheck/build; action, deformation, particle and split-clock units; live Burst catalog/apply/fit/mask/asset-library browser test; required context-menu and live MCP regressions. Evidence and source limits: `docs/ACTION_EFFECTS_20261107.md`, `qa/artifacts/burst-fx-contact-sheet.png`, `qa-output/action-fx/`. Base catalog is now 10,550 recipes and 15,550 after the existing 5,000-recipe lazy pack loads; counts are presets, not unique algorithms. A read-only GitHub API scan recorded ten upscaling, roto, depth and 3D candidates with API-reported code licences; no uncertain or heavyweight model was silently bundled. Rust/Cargo is absent on this runner, so a native Tauri build remains unverified. No new end-to-end YouTube viewing is claimed; retained audit evidence was used.

## 2026-11-01 — 1,152 Studio Looks and effect-library controls

Added 1,152 original shared-engine presets (12 families × 12 palettes × 8 tonal mixes), collection filtering, persistent favorites, explicit reversible previews and visible adjustment-layer actions. All new recipes passed changed-pixel, distinct-fixture-signature and parameter-bound checks; browser apply/undo/redo, bundle round-trip and real video export passed. Base catalog: 10,481; fully loaded with existing glitch pack: 15,481 entries. Counts are recipes, not algorithms or universal perceptual uniqueness. See `docs/STUDIO_LOOKS_20261101.md` and `qa-output/studio-looks-20261101/`. Prior broad editor/model/sculpting/native-platform work remains open.

## 2026-11-01 continuation

Supplied Gold Motion and Toji Motion APKs downloaded and statically identified; resource catalogues and package metadata saved under `research/editor-upgrade-20261031/`. Open-source licensing and Nova identity remain unverified. The preview render budget now covers 3D WebGL draws as well as 2D composition. See `docs/EDITOR_PERFORMANCE_20261031.md`.

## 2026-10-31 — Playback performance, media proxies and stable 3D viewport

Current user request is a broad editor quality/performance upgrade against the uploaded full ledger. Implemented and measured: preview frame budgets, idle render suppression, no preview upscaling, visible render metrics, temporary video proxy preparation with original audio/export preservation, cancellation and memory bounds, stable 3D context across scrubbing/resizing, geometry/material cleanup, and unobstructed 3D tools. Desktop CI now preserves installers and typechecks. General E2E selectors and export-success requirement repaired.

Read `docs/EDITOR_PERFORMANCE_20261031.md` for exact checks, current research and remaining scope. Evidence: `qa-output/performance-20261031/`; fresh Drive listings, uploaded-ledger index, repository searches and sampled reference review: `research/editor-upgrade-20261031/`. Proxies are tab-local realtime WebM, not frame-exact persistent/native proxies. No comparative speed benchmark, new model training, sculpting implementation or native platform certification is claimed. No environment configuration or publication, remote push or PR performed. Continue the open work listed in that report; preserve user media and historical evidence.

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
## 2026-11-01 moving-effects, RDT, blend keys, previews, and GIPHY increment

All 1,152 Studio Looks now have individual moving MP4s plus a combined 38:24 reel under `effect_vid/`; the manifest proves 27,648 decoded frames. `new_work_qa/RDT_recopy1.mp4` is an independently authored 25.06-second Gojo edit built through the universal MCP tools, with 601/601 distinct decoded frames and audio. Added grouped blend-mode hold keyframes across browser/headless render paths, rendered MCP previews for effect/transition/LUT/text, paginated preset discovery, exact blur-search aliases, and a GIPHY search/import panel. See `docs/EDITOR_QA_20261101.md`. Native Tauri compilation remains blocked on this runner by missing Rust/Cargo, WebKitGTK 4.1 development files, and rsvg2; the desktop frontend IPC contract passes and the cross-platform installer matrix remains configured in CI.

## 2026-11-01 corrected text-matte and GIF-provider increment

`new_work_qa/RDT_recopy2.mp4` supersedes the first pass for review: 25.041667 s, 360×640 H.264 at 24 fps, AAC audio, 601/601 distinct decoded frames, SHA-256 `febe6a61368bc73def09ae3c2bea5f7bd16dbefa91f059c11fcbfbc831178c87`. It uses seven separate scene looks/speed curves and real duplicated negative video cropped inside every title, with keyed Screen/Color Burn holds. Screen is the evidence-based inference for the reference's bright cores; Linear Burn is not claimed. Browser and headless renderers now share editable video fill fields, and browser fills use an independent decoder so the matte does not fight the underlying clip for seek time. Settings → AI & APIs holds tab-only GIPHY and Klipy keys; the Media GIF Library tests provider switching, search, attribution, loading/download states and editable MP4 import. User has now explicitly authorized a GitHub push.
## 2026-11-08 — directional light/blur and subscription audit queue

Added a shared Point/Spot/Directional light compositor, professional directional-blur bias/spread/luma controls, ten focused recipes and icon-first light controls. Browser UI, headless rendering, catalog/sanitizer and a six-render contact sheet passed; the particle/overlay sliders no longer display `NaN`. Product targets are now explicit in `docs/PRODUCT_GOAL.md`. Details: `docs/DIRECTIONAL_LIGHT_BLUR_20261108.md`.

The uploaded 211-channel subscriptions CSV now drives a 36-batch, cookie-capable GitHub audit queue. Refined batch 1 indexed 889 entries / 814 candidates and acquired 20/20 selected videos (2.07 source hours) into 343 timestamped frames and 60 audio diagnostics. Full visual/audio review remains pending; sampled evidence is not a full-watch claim. Details: `docs/SUBSCRIPTION_TUTORIAL_AUDIT_20261108.md`.
