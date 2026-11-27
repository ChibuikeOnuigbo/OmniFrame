## Cycle 28 — clean sequence-sized 3D output and paced rendering (2026-11-27)

3D exports now use the live scene with a separate sequence-aspect camera/output
renderer, excluding editor guides and viewport padding. Working viewport pixels
are preserved; cancellation/unmount release the export renderer. 30 fps recording
budgets avoid redundant renders/copies and catch-up bursts. Isolated median scene
copies fell 79→62 (~22%); viewport step 68→60. Recorded frame counts improved, but
wall time stayed ~2.3 s and long tasks remain. No whole-app/competitor speed claim.

50 units, 14 browser smoke flows, native landscape/portrait exports, export fault
recovery, 100-clip revisit/reset, audio and proxy checks pass. Static/build gates
pass with 278 nonblocking hints and large chunk warning. Detailed evidence/ratings:
reports/CLEAN_3D_AND_SPEED_REVIEW_20261127.md. 3D/2.5D rises provisionally to 6/10;
overall tested browser editor remains 6/10. Native apps/AI/security not rated.

Remaining: temporary renderer memory/context pressure, sustained GPU/4K and A/V,
older-decoder MP4 compatibility, first-frame/long/background recording, advanced
multi-object/plane and camera persistence. Next measure realistic sustained work
and expand scene coverage without duplicating renderer semantics.

## Cycle 27 — deterministic 3D poses and short-export endpoints (2026-11-27)

Playback/rewind changed automatic 3D poses; timeline-derived rotation now restores
identical pixels. Keyed seeks, isolated moving video plane, 256-dab sphere limit,
and projected X/Y title animation pass. Final Low/Full samples submitted 85/75
renders over ~2.55 s; these are not displayed FPS. Native 3D and XY WebM exports
decode. Fixed export using the five-second editing floor: short WebM outputs now
measure ~2.12–2.15 s, while explicit 4 s range remains 4.052 s. Earlier two-second
export wording was inaccurate and is corrected. Full details: reports/THREE_RENDER_REVIEW_20261127.md.

48 units/14 browser flows after pose fix; targeted endpoint/failure tests, 15 source
clock renders and final static/build gates pass. Three new MP4s fail old pinned
parser but decode with FFmpeg 7.1.5. Remaining: guide-free sequence-sized 3D export
(current viewport capture includes guides/padding), multi-object/plane depth,
large scenes, actual GPU/display timing, A/V sync and native-platform coverage.
Next implement/test clean 3D rendering without changing preview camera behavior.
Provisional tested 3D/2.5D capability: 5/10; no competitor superiority claim.

## Cycle 26 — export ownership, cancellation and failure recovery (2026-11-27)

Added Cancel and explicit WebM export. Concurrent requests, recorder errors,
interrupted playback, empty data and premature stop now reject; cleanup restores
settings unless a replacement project owns them. Progress panel now portals above
the inspector after a real click test reproduced interception. Six final native
MP4/WebM exports decode with pinned FFmpeg. Failure/replacement/UI checks, 48 units,
14 browser flows and static/build gates pass. See reports/EXPORT_RELIABILITY_20261127.md.

The retained old MP4 decodes with supplemental FFmpeg 7.1.5 (H.264/Opus, 6.1322 s),
so corruption is unproven; older-decoder/container compatibility remains open.
Remaining: long-duration/finalization-timeout fault tests, background suspension,
A/V drift, first-frame synchronization, native platforms and external players.
Next inspect fragment/audio metadata with old/new decoders, then sustained A/V
exports. Source lint retains 278 nonblocking findings and the large bundle warning.

## Cycle 25 — decoder-ready paused preview scheduling (2026-11-27)

Active decoder seek/load completion now invalidates the paused preview for the
next animation frame, avoiding the 250 ms heartbeat wait. Inactive/sample events
are ignored; disposal removes listeners. Eight-seek median ready-to-canvas delay
fell from 159.9 ms to 23.1 ms (repeat 14.9 ms); idle stayed at four commits/1.1 s.
48 units, 14 browser flows, 15 source-clock renders, static/build gates and 100-clip
revisit/reset pass. Native edit export/reopen/decode passed on retry; first MP4 header failure remains unresolved.
Preview guides are grouped, fit tick removed, and exact 1% zoom entry added. Detailed evidence and
scope: reports/SEEK_READY_REVIEW_20261127.md. Overall speed remains provisional 6/10.

Remaining: actual presentation, varied cold long-GOP decoding, sustained A/V sync,
GPU/4K/native desktop and competitor checks. 277 source-scan hints and large build
chunk remain. Next reproduce the retained MP4 header failure, then profile cold decode/proxy readiness; preserve complete-frame
commits and idle limits. Do not generalize this fixture to lag-free editing.

## Cycle 24 — repeated edit/export speed review (2026-11-26)

Created a six-second 720p edit and portable project; repeated Low/Full samples,
validated native export decoding and project reopening. Repeated 100-clip seek,
eviction and reset stress passed. Fixed QA's insufficient screenshot wait:
300 ms showed a stale title; decoder-ready wait measured 444 ms and the settled
preview was correct. Final export took 6.135 s; speed remains provisional 6/10.
Production code unchanged. Syntax, whitespace and source lint checks pass;
277 nonblocking source-scan hints remain. See reports/EDIT_SPEED_REVIEW_20261126.md.

Remaining: precise displayed-frame latency, varied real sources, sustained A/V
sync, GPU/4K/native desktop and competitor comparisons. Next profile decoder seek
and canvas commit separately; test long-GOP media and avoid fixed-sleep screenshots.

## Cycle 23 — revisit, boundary and audio regression tests (2026-11-26)

Four targeted browser scripts passed: 100-clip eviction/reload and rapid seeks,
clip-boundary transport/reset, stereo audio detach/reconnect, filmstrip/compound
previews and live MCP (the boundary/reset checks are in the revisit script).
Added real audio silence/reconnection assertions. No new application defect was
reproduced; production code is unchanged. Details: reports/STRESS_REVISIT_20261126.md.

Remaining: unique-footage import, sustained audible boundary continuity, displayed
frame/seek latency and 4K/GPU behavior are not established. Next measure actual
presented frames and A/V drift with diverse long-GOP sources. Do not promote
short automated waits or transport-clock advancement to lag-free playback claims.

## Cycle 22 — 100-video decoder stress (2026-11-26)

Tested 100 assets/100 sequential clips with blur and 100 catalog instances, then
ten overlapping video tracks. Assets have distinct IDs/blob URLs but reuse one
Pexels fixture. Retained video elements fell from 107 to 24 after bounding inactive
playback caches; the latter includes 16 playback and eight thumbnail decoders.
Active composition layers are never evicted; released sources and audio nodes
are unloaded/disconnected. Tests initially conflated sampling/playback pools;
corrected selectors separate them. Seek p95 remained about 599 ms: no speedup claim.

48 units, 14 browser smoke flows, targeted stress test, typecheck, lint and build
pass. Raw evidence and limitations: reports/STRESS_100_20261126.md.
Remaining: unique large footage imports, sustained A/V sync, 100 simultaneous
layers, precise presented-frame/seek latency, 4K/GPU/native desktop benchmarks.
Next test decoder eviction/reload at transitions and measure seek-to-present
before claiming smoothness. Existing source findings and build warnings remain.

## Cycle 21 — proxy decoding and error ownership (2026-11-25)

Hardened proxy cancellation, missing canvas context and interval drawing errors;
completion now stops source playback and interval work once. Real browser tests
verify proxy decode dimensions, original audio, original-source export, immediate
cancel, clear-during-preparation and injected drawing failure cleanup. Eight warm
decoder seeks on a synthetic 1080p source reported upper-middle 120.6 ms original
versus 36 ms proxy. This does not measure whole-editor or real-camera performance.
47 units, 14 browser smoke flows, expanded proxy checks and static/build gates pass.
Details and raw-sample scope: reports/PROXY_REVIEW_20261125.md. Two development
hot-module duplicate-store test failures were resolved by restarting Vite.

Remaining: real footage/long GOP, sustained audio sync, frame-time distributions,
layered 4K rendering and queue-wide cancel/clear need further testing. Next run
matched camera-footage playback and seek-to-present tests, then fix measured
bottlenecks. Appearance/MCP ratings remain 6/10 and 7/10; overall speed unrated.

## Cycle 20 — paused 3D render budget (2026-11-25)

Avoided repeated GPU submission for unchanged paused 3D frames while retaining
camera, geometry, settings and source-refresh invalidation. Measured eight idle
redraws in two seconds, following the intentional 2D 4 Hz decode refresh. Tested
actual grid/camera updates and preserved sculpt/export/persistence regressions.
47 unit scripts, 14 browser flows, targeted idle checks, typecheck, lint and build
pass. Reviewed the desktop screenshot and proxy implementation. Details, measured
limits and ratings: reports/SPEED_REVIEW_20261125.md.

Remaining: no source/proxy seek benchmark, representative 4K workload or native
GPU comparison yet; speed remains unrated. Appearance remains 6/10, MCP 7/10.
Next run matched original/proxy playback and seek tests with frame-time percentiles,
long tasks and audio sync; harden proxy cancellation/cache ownership, then revisit
sequence-resolution 3D capture. Existing 277 lint findings and bundle warnings remain.

## Cycle 19 — camera fit and input ownership (2026-11-25)

Object focus now uses transformed geometry bounds and both camera axes. Narrow
resizes refit a focused object; manual zoom switches to free framing. WASD/QE
movement belongs to the focused viewport, clears on blur, and ignores modifier
chords. A targeted browser test verifies keyboard ownership and scaled-object
margins at 390 px. Its initial image mask included cyan grid lines; visual review
confirmed the object fit and the mask was corrected to isolate neutral highlights.

Verified: 47 unit scripts, 14 browser smoke flows, the additional camera flow,
typecheck, source lint and production build. History inventory rerun. Evidence:
qa-output/camera-review/. Existing media outputs were restored after testing.

Remaining: sequence-resolution 3D capture was explored but not integrated; the
untested render-target prototype was removed. Video still captures the viewport.
Imported sculpting, multi-object preview, native desktop validation, effect easing,
277 source findings and large bundles remain. Next: implement a scoped capture
session with tone/color parity, disposal, context-loss and concurrent-export tests;
then run actual resolution/detail comparisons before claiming export completion.

## 2026-11-25 — persisted primitive sculpting and 3D fixes

Added Raise/Carve/Flatten on five editable primitives, radius/strength, Reset
and collapsible controls. One drag is one Undo step; .omni retains editable
strokes and OBJ exports the same deformed geometry. Fixed missing 3D history,
deleted-object selection, right-drag panning, camera/canvas aspect mismatch and
overlapping viewport controls. Actual browser video export preserves proportions.

Verified: 46 unit scripts, 14 browser smoke flows including live MCP, responsive
workbench and graph/camera/mask checks, typecheck, lint and build. OpenCV decoded
65 distinct frames from the real browser MP4. Screenshots, OBJ and demo:
`qa-output/sculpt/README.md`. Details and limitations: `AUDIT_STATE.md` Cycle 18.

Still open: imported/multi-part sculpting, larger/remeshed geometry, pressure,
brush-outline feedback, narrow-view camera fitting, multi-object scene preview,
sequence-resolution/headless 3D rendering, native effect easing and phase
continuity, competitor benchmarks and native desktop acceptance. The existing
277 lower-severity source findings and bundle warnings were not suppressed.
Next: camera framing/render-target parity and imported-object history ownership,
then native effect easing and motion clocks. This closes the primitive-sculpt
gap only; the older general sculpting claims remain unverified beyond this scope.

## 2026-11-24 — effect-instance trim continuity

Fixed pointer/keyboard trims and overwrite tails pulling completed/future effects
into the remaining clip or restarting surviving keys. Effect intervals now
intersect the remaining parent window; numeric curves and procedural source
offsets retain their timing. Fully removed intervals are restored by Undo, not
by later extending footage. Short-parent range clamping no longer creates an
effect longer than its clip.

New browser proof checks exact preview pixels, Undo/Redo, Save/Open, keyboard
trim and overwrite clocks. Shared headless photo renders match exactly at four
timecodes. Evidence: `qa-output/fx-trim/`; tests: `qa/fx-trim-*`.
Verification: 45 unit scripts, 13 browser smoke flows, all 15 speed curves
(120 pixel comparisons/15 moving exports), typecheck, lint and build pass.

Still open: persisted mesh sculpting is not present in the inspected 3D
object/edit/paint implementation; it needs implementation rather than a blanket
acceptance label. Native effect easing graphs, duration-dependent motion phases,
matched competitor benchmarks and native desktop validation remain open.
Next: design serializable non-destructive sculpt strokes and test mesh changes,
Undo, Save/Open and preview/export before claiming sculpt support.

## 2026-11-24 follow-up — parent controls and motion review

Consolidated eleven angle-only blur cards into Directional Blur settings,
retaining old IDs/favorites and distinct kernels. Added direction shortcuts;
corrected catalog count/ID regressions during testing. Motion graph tests pass
37 assertions; MCP, camera/3D masks, editable Motion Lab, liquify/corner pin and
35 curve families pass. Final gate: 44 unit scripts, typecheck, lint and build passed. Original MCP motion demo and provisional ratings:
`reports/EDITOR_REVIEW_20261124.md`. No competitor speed or all-tutorial claim.

## 2026-11-24 — animated effect layers

Added numeric keyframe diamonds, previous/next, auto-keyed sliders, freeze and
reset to native Effects controls. Animation retains its source clock through
cuts, trims, overwrite tails and moves; native effect clips extend freely.
Numeric keys use linear interpolation. Color/string controls remain static.

Fixed inspector focus, slider history cleanup, shared-object `.omni` saving,
and missing headless standalone masks/LUTs. New keys/clocks survive project and
template round trips; malformed animation payloads are rejected before mutation.
Forty-three unit scripts, thirteen browser smoke flows, production keyframe UI,
static gates, speed curves and compatibility checks passed. Evidence and limits:
`AUDIT_STATE.md` Cycle 15; `qa-output/native-effect-keyframes/report.json`.

## 2026-11-23 — nested effect groups and animation trim

Added nested groups/tags, breadcrumb navigation, scoped search and lazy family
paging. Box Blur now has a real square kernel; new Color Hold, Luma Range,
Despill and Channel Mixer controls share browser/headless render math. Freehand
Trim Path supports linear keys, wrapped segments, onion ghosts and save/reopen.
Fixed stale preview scratch dimensions after canvas resizing and Undo for new
adjustment controls. Existing square photographic previews remain interactive.

41 unit scripts, 12 browser smoke flows and static/build gates passed. Actual
screenshots, a decoded export proof, source attribution and limitations:
`research/editor-capabilities/README.md`, `AUDIT_STATE.md` Cycle 14.

## 2026-11-16 — safe project imports and local credential preservation

Core .omni validation now protects live state from malformed timelines, numeric
fields, duplicate IDs, broken tracks, cyclic compounds and store-action fields.
Invalid decoded projects release their embedded URLs. New .omni files omit the
memory-only AI API key; legacy imported keys cannot replace local configuration.
Valid PSD/media bundles and compound projects still reopen with editable content.
Tests and the remaining schema coverage limits: `AUDIT_STATE.md` Cycle 13.

## 2026-11-16 — reliable project replacement and empty-scene 3D controls

New/Open clear old project selections, generated overlays and nested media
ownership; obsolete opens cannot replace newer work. Discarded URLs, cached
preview media and sampling decoders are released. Smart Patch and filmstrip
results cannot cross project boundaries. In an empty 3D scene, choosing a
primitive or material now creates editable, persisted geometry. The 3D browser
check uses real local video instead of a fake media URL and checks moving pixels.

Unit, browser, persistence and scan evidence/limits: `AUDIT_STATE.md` Cycle 12.
This does not establish completion of all asynchronous producer guards or native
platform acceptance.

## 2026-11-14 — eight-pass adversarial repository audit

Added safe mask bounds for malformed and offscreen geometry, removed duplicate
clipboard/duplicate keyboard handling, made QA roots and direct browser
navigations portable, fixed the scene-test loader, and removed ineffective
audio/model-progress dynamic imports. The final gate passed 35 unit scripts,
seven browser flows, a VAD rate check, Demucs unavailable/recovery, typecheck,
build and source lint. Remaining findings and limits: `AUDIT_STATE.md`.

## 2026-11-14 — bounded 4K feather work

Ordinary effect masks now use a bounded union matte and clear the remainder of
the frame. The same 4K headless sample takes 325–374 ms/frame and about 381 MiB
RSS; seven mask layouts matched prior pixels at 512×384. Inverted masks keep a
full-frame matte. Real-time 4K and browser/GPU timing remain open.
An inverted 4K sample took 501–954 ms/frame; its tint readback remains local.

Temporary effect-mask shape canvases now use only each region's bounds in browser
and headless rendering. The same 4K headless sample now takes 459–645 ms/frame
and about 542 MiB RSS. Four shape cases matched previous pixels at 512×384.
Real-time 4K remains open.

Browser and headless renderers now restrict optional mask tint/offset pixel work
to the affected region. A 3840×2160 headless sample improved from 842–1071 to
690–833 ms/frame, with RSS falling from about 975 to 684 MiB. Three mask cases
matched the previous output pixel for pixel. This is still too slow for real-time
4K; see `docs/EDITOR_FINISHING_GOAL.md`.

## 2026-11-14 — colored effect-mask feather

Effect masks now expose black/white/blue/custom edge color, tint strength and
inward/outward edge bias. Browser and headless rendering share the alpha/tint math;
headless pixel and live control checks passed. This optional path uses canvas
pixel readback; the 4K profile and remaining speed work are in the finishing goal.

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

| Change | Code | Verification / artifact |
|---|---|---|
| Angled selective-focus compositor with reusable scratch surfaces | `pixelGrade.ts` | Three distinct renders and measured sharp-plane retention |
| Amount, centre X/Y, angle, width and feather | `types.ts`, `effectCatalog.ts`, `customEffects.ts` | Six editable/keyframeable controls; import clamping |
| 48 curated focus-plane recipes | `effectCatalog.ts` | Four orientations × three offsets × four widths; unique patches |
| Punctuation-tolerant multiword recipe search | `effectCatalog.ts`, `effectRecipeBank.ts` | Natural query finds the matching middle-dot preset live |
| Live apply, parameter editing, keyframes and effect region | `qa/tilt-shift-focus-ui-e2e.mjs` | Browser screenshot and machine report |

Details: `docs/TILT_SHIFT_FOCUS_20261108.md`.

## 2026-11-08 — 200-control UI quality gate

| Change | Code | Verification / artifact |
|---|---|---|
| Three-cell Effects collection picker and four-column category grid | `EffectsPanel.tsx` | Arrow order/cycling, 24px targets and four computed columns asserted live |
| Persistent selected state, quieter hover border and pressed semantics | `EffectsPanel.tsx`, `SectionsNav.tsx`, `TransitionsPanel.tsx`, audio/3D panels | Computed selected/rest/hover colors and ARIA state checked |
| Shared keyboard focus fallback and repaired undersized controls | `index.css`, `LinkPanel.tsx`, `TransitionsPanel.tsx` | Every measured target is at least 24×24 with visible focus |
| Exactly 200 live UI scans and ten cutout contact sheets | `qa/ui-200-scan-e2e.mjs` | 200 PASS / 0 REVIEW / 0 FAIL; zero page errors |
| Broader mode/submode affordance sweep at 1440 and 1024 | `qa/ui-affordance-audit.mjs` | 0 tiny, 0 unnamed and 0 duplicate-test-id findings |

Full numbered evidence: `docs/UI_QUALITY_200_SCAN_20261108.md` and
`qa-output/ui-200/`.

## 2026-11-08 — 150K effects and persistent runtime shortcuts

| Change | Code | Verification / artifact |
|---|---|---|
| 139,425 deterministic indexed recipes across 12 generator families | `effectRecipeBank.ts` | All IDs unique/reconstructable; 150,048 current base total |
| Paged UI and MCP search without allocating the full bank | `effectCatalog.ts`, `EffectsPanel.tsx`, `tools/mcp/tools.mjs` | Final ID applied; 155,048 live with authored pack |
| 44 configurable commands wired to Studio runtime | `settingsRegistry.ts`, `Studio.tsx`, `store.ts` | Rebind, execute, reload, clear and Reset-compatible persistence |
| Removed duplicate hard-coded Timeline shortcut listeners | `Timeline.tsx` | Group, multi-delete and export range commands use one registry |

Details: `docs/EFFECT_CATALOG_150K_20261108.md`. Recipe count is separate
from renderer-family count, perceptual uniqueness and full-motion acceptance.

## 2026-11-08 — camera lens bokeh and licensed source audit

| Change | Code | Verification / artifact |
|---|---|---|
| Shared highlight-defocus renderer with eight diaphragm shapes | `src/lib/pixelGrade.ts`, `src/types.ts` | Eight deterministic distinct renders; inspected contact sheet |
| Amount/radius/threshold/gain/shape/rotation/softness controls | `effectCatalog.ts`, `customEffects.ts`, `FxStackSection.tsx` | Import clamping, numeric keyframe and live shape persistence |
| Sixteen curated lens-bokeh recipes and unique catalog IDs | `effectCatalog.ts` | 10,575 unique base / 15,575 loaded recipe count; duplicate AM ID removed |
| Effect-region and translated clip-isolation correctness | `pixelGrade.ts`, existing `playback.ts` mask path | Live ellipse-mask screenshot; browser-caught shifted/black output fixed |
| Official documentation, licensed APK and CC0 model audit | `research/effect-source-audit-20261108.json` | LibreCuts APK digest/ZIP check; Poly Haven 11-file MD5 check and Blender render |

Details and limits: `docs/LENS_BOKEH_EFFECTS_20261108.md`. Recipe totals are
not independent algorithm or full-motion acceptance counts. The LibreCuts APK
was statically inspected and never executed. The CC0 camera was rendered as a
candidate and was not bundled into the product library.

## 2026-11-07 — Motion Lab template system

| Change | Code | Verification / artifact |
|---|---|---|
| 201 original editable recipes across 16 motion-design categories | `src/lib/templatePresets.ts`, `src/types.ts` | Exact count, unique IDs/names, slot integrity and search unit test |
| Search, category filtering, palette/aspect/duration preview and asset mapping | `TemplatePickerModal.tsx` | Live Data/Neon search and inspector screenshot |
| Generated backdrop, editable media/text layers and 12 real keyframe motions | `TemplatePickerModal.tsx` | Browser-built four-layer Data Story scene with three animated text tracks |
| Reachable desktop/mobile entry and correct modal stacking | `TopBar.tsx`, `TemplatePickerModal.tsx` | Live top-bar open, modal visibility and z-order inspection |

Motionvid scope evidence is recorded in `research/motionvid-public-catalog-scope-20261107.json`. Terms blocked bulk scraping/copying, so no third-party projects or previews were committed. Full details and evidence: `docs/MOTION_LAB_20261107.md`, `qa-output/motion-lab/`.

## 2026-11-01 — 1,152 Studio Looks and effect-library controls

Added 1,152 original shared-engine presets (12 families × 12 palettes × 8 tonal mixes), collection filtering, persistent favorites, explicit reversible previews and visible adjustment-layer actions. All new recipes passed changed-pixel, distinct-fixture-signature and parameter-bound checks; browser apply/undo/redo, bundle round-trip and real video export passed. Base catalog: 10,481; fully loaded with existing glitch pack: 15,481 entries. Counts are recipes, not algorithms or universal perceptual uniqueness. See `docs/STUDIO_LOOKS_20261101.md` and `qa-output/studio-looks-20261101/`. Prior broad editor/model/sculpting/native-platform work remains open.

## 2026-11-01 continuation

Supplied Gold Motion and Toji Motion APKs downloaded and statically identified; resource catalogues and package metadata saved under `research/editor-upgrade-20261031/`. Open-source licensing and Nova identity remain unverified. The preview render budget now covers 3D WebGL draws as well as 2D composition. See `docs/EDITOR_PERFORMANCE_20261031.md`.

## 2026-10-31 — Playback performance, media proxies and stable 3D viewport

Current user request is a broad editor quality/performance upgrade against the uploaded full ledger. Implemented and measured: preview frame budgets, idle render suppression, no preview upscaling, visible render metrics, temporary video proxy preparation with original audio/export preservation, cancellation and memory bounds, stable 3D context across scrubbing/resizing, geometry/material cleanup, and unobstructed 3D tools. Desktop CI now preserves installers and typechecks. General E2E selectors and export-success requirement repaired.

Read `docs/EDITOR_PERFORMANCE_20261031.md` for exact checks, current research and remaining scope. Evidence: `qa-output/performance-20261031/`; fresh Drive listings, uploaded-ledger index, repository searches and sampled reference review: `research/editor-upgrade-20261031/`. Proxies are tab-local realtime WebM, not frame-exact persistent/native proxies. No comparative speed benchmark, new model training, sculpting implementation or native platform certification is claimed. No environment configuration or publication, remote push or PR performed. Continue the open work listed in that report; preserve user media and historical evidence.

## 2026-11-07 action effects, aura, liquify and effect regions

| Change | Code | Verification / artifact |
|---|---|---|
| 50 loopable Burst presets across ten source-fragment/energy families | `src/lib/actionFx.ts`, `effectCatalog.ts`, `particleFx.ts`, `fxInstances.ts` | `qa/action-fx-unit.mjs`: exact 50 count, unique ids, ten distinct family renders and deterministic timing; inspected contact sheet |
| Bright-pixel aura and FBM/curl/glass turbulence | `actionFx.ts`, `pixelGrade.ts`, `types.ts` | Eight aura and six turbulence catalog entries; changed-pixel proof and production build |
| Parameterized liquify effect plus signed twirl direction | `pixelGrade.ts`, `deformation.ts` | Eight presets; existing four-mode deformation unit remains green |
| Burst cycle controls, split continuity and one-cycle trim | `FxStackSection.tsx`, `fxInstances.ts` | Split source-clock unit and live UI 1 s / 2× → 0.5 s assertion |
| Effect-region entry from every FX row; action/raster masking on adjustment layers | `FxStackSection.tsx`, `playback.ts`, existing `effectMask.ts` | Live ellipse region UI and visibly isolated burst screenshot; live MCP mask regression |
| Compact effect icons and cleaner asset browsing | `EffectsPanel.tsx`, `AssetLibraryModal.tsx` | 1600×1000 browser screenshots; no visible `CC0` text in library modal, attribution metadata preserved |

Evidence: `docs/ACTION_EFFECTS_20261107.md`, `qa/artifacts/burst-fx-contact-sheet.png`, and `qa-output/action-fx/`. Base catalog 10,550; lazy-pack total 15,550. These are recipe counts. This runner lacks Rust/Cargo, so native desktop compilation and cross-platform certification are not claimed.

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
## 2026-11-08 — directional light/blur and tutorial audit

| Change | Code | Verification / artifact |
|---|---|---|
| Point, rotated Spot and feathered Directional light | `src/lib/lightFx.ts`, `playback.ts`, `tools/mcp/appRender.mjs` | Six distinct fixture renders and inspected contact sheet; universal MCP regression |
| Blur trail bias, angle spread and bright-pixel threshold | `pixelGrade.ts`, `types.ts`, `effectCatalog.ts` | One-side and thresholded fan changed-pixel checks; four editable recipes |
| Compact Point/Spot/Beam controls and valid unset defaults | `EffectsPanel.tsx`, `HelpModal.tsx` | Live browser slider persistence, no `NaN`, screenshot in `qa-output/directional-light-blur/` |
| 211-channel subscription tutorial queue | `build-subscription-audit-queue.py`, `video-audit.yml` | Exact unique count, 36-batch coverage, refined classifier unit; batch 1 acquired 20/20 videos into 343 frames/60 audio diagnostics |
| Measurable cross-platform product target | `docs/PRODUCT_GOAL.md` | Capability, responsiveness, simplicity and platform gates documented |

Full implementation evidence and limits: `docs/DIRECTIONAL_LIGHT_BLUR_20261108.md` and `docs/SUBSCRIPTION_TUTORIAL_AUDIT_20261108.md`. The subscription queue is an inventory/acquisition workflow; 20 videos have decoded evidence, while continuous visual/audio review remains pending.

## 2026-11-14 — stable cursor bursts and clip filmstrips

Each pointer click now makes one stationary cursor burst, with timers removed
on unmount. Clip filmstrips retry failed or empty renders, cancel pending retries
when removed, and avoid broken image tiles. Live browser checks cover those
interactions and real video, image and compound clips. The expanded nine-flow
smoke gate, 35 unit scripts, lint, typecheck and build passed. Remaining work is
in `AUDIT_STATE.md` Cycle 9.

## 2026-11-14 — real still cutout workflow

Quick Background Cutout now previews actual selected image pixels and applies a
color-edge alpha matte to a generated PNG asset. The clip change is undoable;
the source stays in the library. Transparent, solid and blurred backdrops are
available. The browser checked actual alpha, Program PNG subject pixels,
Undo/Redo and `.omni` reopen. All 36 unit scripts, ten browser smoke flows,
lint, typecheck and build passed. Video and complex-scene segmentation remain
open in `AUDIT_STATE.md` Cycle 10.

## 2026-11-14 — cutout cancellation and preview parity

Cutout work runs in a dedicated worker on supported browsers, with cancellation
and retry. Apply uses the exact previewed PNG, avoiding resolution-dependent
edge differences. Transparent source pixels now blend correctly and transparent
corners do not erase black subjects. The unit and browser gates passed, including
production worker loading, cancellation, failure recovery and save/reopen.
Evidence and limits are in `AUDIT_STATE.md` Cycle 11.
