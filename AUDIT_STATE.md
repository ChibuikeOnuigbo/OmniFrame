# OmniFrame adversarial audit state

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


## Cycle 18 — persisted sculpting and 3D history (2026-11-25)

- Added Raise/Carve/Flatten with radius, strength, Reset and collapsible controls
  on cube, sphere, torus, plane and diamond. Deterministic object-local brush
  samples are shared by WebGL preview and OBJ geometry export. Imports reject
  invalid brushes, non-finite coordinates, unsupported targets and over-capacity
  stroke arrays. Capacity stops new work without discarding earlier samples.
- Found 3D objects missing from Undo snapshots. Scene geometry and selection now
  survive Undo/Redo; scene property changes create history, and deleting the
  first selected object selects a remaining object instead of the deleted ID.
  One brush drag owns one transaction. Cancel, blur, unmount and capture loss
  release it; extra pointers cannot steal it. Zero-strength brushes do nothing.
- Found a real aspect mismatch between the sequence-shaped camera and the
  differently shaped working viewport. Renderer, camera and pointer surface now
  share actual container dimensions. Right-drag panning reads held buttons.
  Mode/HUD controls scroll within their panel; status and aspect controls no
  longer overlap the top mode row or bottom tool row. Help explains sculpting.
- Real browser export preserves the captured viewport aspect with letterboxing.
  A native 2-second MP4 was decoded by OpenCV: 65 distinct frames at 640×360.
  Before/after sculpt pixels differ; a clear centered sphere measures 0.998
  width/height. The first visual assertion failed because the test sphere
  intersected the video plane; moved the fixture in front of it, retaining the
  strict circularity assertion. Inspect qa-output/sculpt/ for original evidence.
- Verified 46 unit scripts, 14 browser smoke flows (including actual MCP),
  responsive workbench and graph/camera/mask integration, TypeScript, source
  lint and build. History inventory rerun. No high-severity source-scan findings;
  277 lower-severity findings and large build chunks remain. These are not full
  coverage of every QA script, native desktop acceptance or speed comparisons.
- Remaining: only five single primitives support sculpting. 256 samples per
  object; no remeshing, pressure, animated sculpt or imported model sculpting.
  Brush influence is volumetric, not front-surface-only. The scene viewport
  still presents one selected object; OBJ is only a geometry subset. Browser
  video captures viewport resolution, potentially letterboxed/upscaled; there
  is no matching headless 3D scene renderer. On narrow views users may need to
  zoom out after resizing; camera-fit and brush-outline feedback remain work.
  Native effect easing/phase continuity, desktop builds, tutorial recreations,
  source findings and matched competitor benchmarks remain unresolved.
- Next pass: implement proper camera framing and a separate sequence-resolution
  render target, with real 3D browser/headless export comparisons. Expand scene
  history tests for imported-object resource ownership. Then native effect
  easing and motion-clock continuity. Retain existing IDs/media and do not
  promote recipe counts, successful test counts or old video inventories into
  all-feature or all-tutorial acceptance.


## Cycle 17 — effect-window intersections (2026-11-24)

- Replaced clamp-on-trim with interval intersection for pointer trims, keyboard
  trims and overwrite splits. Completed/future effects are removed from the
  visible window; surviving curves are rebased without dropping their offscreen
  keys. Procedural source offsets advance by the consumed instance duration.
- Fixed `clampFxToClip` exceeding a parent shorter than its 0.1-second minimum;
  empty/invalid duration and non-finite range inputs now produce bounded ranges.
- New adversarial helper tests cover repeated trims, before/after intervals,
  short fragments, left extension and immutability. Real browser proof verifies
  identical preview pixels after trim and Save/New/Open, Undo/Redo, keyboard
  trim and overwrite clocks. Headless shared compositor yields four exact PNG
  matches on real photo footage; the comparison sheet was visually inspected.
- Verified 45 unit scripts, 13 smoke browser flows, source clocks (120 exact
  comparisons and 15 exports), TypeScript, source lint and production build.
  Project history audit rerun. Existing 277 non-high findings and large bundle
  warnings remain; no broad speed or all-effect acceptance claim.
- Remaining: trimming removes fully excluded effect intervals; use Undo to
  recover them. Native easing graphs and duration-based procedural phase
  continuity are separate work. Inspection found no persisted sculpting engine
  in the current object/edit/paint 3D code; prior acceptance wording must not
  imply sculpt-mesh support. Desktop acceptance and fair speed benchmarks remain.
- Next: implement/test serializable sculpt deformations through actual renderer,
  Undo and project persistence; retain existing geometry/asset ownership. Then
  native effect easing and comprehensive motion-clock tests. Do not raise app
  ratings solely because these regression cases pass.

## Cycle 16 — selective catalog consolidation and motion review (2026-11-24)

- Eleven angle-only blur cards now live under Directional Blur controls; old
  project IDs and favorites remain resolvable. Distinct blur implementations stay.
  Added native direction buttons. Adversarial unit runs caught duplicate parent
  IDs from repeated insertion and counts including hidden aliases; fixed both.
- Graph suite initially failed two punctuation-only label assertions. Corrected
  them to test axis semantics; all 37 assertions pass, including actual dragging,
  easing strength, custom points and visible 2.5D foreshortening. MCP, Motion Lab,
  camera/keyframe/3D masks and responsive corner-pin/liquify browser flows pass.
  Deformation units and the 35-family curve simulator pass.
- Rendered an original 72-frame three-word MCP typography study. OpenCV decoded
  sampled frames; inspected the contact sheet. Kdenlive launches and Glaxnimate
  renders the original SVG. These are not comparative speed benchmarks.
- Revisited an archived Drive reference frame. Folder HTML was accessible but
  no new video/audio was recovered or watched. Detailed evidence, provisional
  MCP 7/10 and overall readiness 6/10 judgments, and limitations are in
  `reports/EDITOR_REVIEW_20261124.md`.
- Remaining: matched hardware/media performance benchmarks, actual sculpt-mesh
  acceptance and persistence, full tutorial retrieval/recreations, broader
  consolidation, plus Cycle 15 graph/clock and ownership gaps. Next: add failing
  sculpt persistence tests and matched preview workloads before rating speed;
  preserve saved recipe IDs when consolidating further parameter-only variants.

## Cycle 15 — native effect keys, editing clocks and persistence (2026-11-24)

- Re-read modified paths and reviewed rendering, history ownership, timeline
  edits, import/tool mutation, serialization, templates and inspector lifecycle.
  Native `effectKeys` and `effectSourceOffset` are evaluated in the shared
  `clipEffectAnimation`/`fxInstances` path; legacy clips retain static behavior.
- Native effect and clip-grade numeric controls now have key diamonds,
  previous/next, auto-keyed sliders, freeze/reset, locked-track protection and
  Undo. One schema-driven inspector replaces duplicate controls. Color/select
  properties stay static; numeric interpolation is linear. A Help entry explains
  the workflow. Interrupted slider gestures close only their own history group.
- Cuts, overwrite tails and pointer/keyboard left trims shift the retained
  source clock; moving clips does not. Right trims preserve future keys.
  Adjustment clips can extend beyond their original duration. Fixed left-trim
  clamping that could move a clip's end when its in-point reached zero.
- Adversarial browser testing reproduced an empty inspector after a focus
  request raced section registration. Requests are now consumed once the target
  exists; manual tab selection cancels pending focus. Reset returns to a valid
  section; Undo restores animation.
- Save-after-split reproduced a false cycle error because concurrent siblings
  shared one serialization ancestor set. Branch-local ancestor sets preserve
  legitimate shared keys/typed data/Map/Set members while rejecting true cycles.
  Validated actual split-project Save/New/Open and nested malformed imports.
- Shared validation rejects non-finite keys/clocks, incompatible base types,
  prototype keys and oversized key collections before import or MCP mutation.
  Live/headless edits and dumps expose native animation. Templates preserve it;
  no-carry replacement clears keys/clocks along with effect values.
- The headless adjustment branch had bypassed masks and LUTs. It now uses the
  shared grade path and composites the masked grade over the original frame,
  matching PreviewEngine for the exercised grades. A combined LUT/grade matches
  separate layers in the browser pipeline order. Half-opacity masks retain
  opaque footage; higher clips stay unaffected. Keyed split tails produce exact
  PNG matches. No blanket procedural-motion or alpha-keying parity claim.
- Executed: 43 unit scripts, 13 browser smoke flows, TypeScript, source lint and
  production build. New native-keyframe workflow passes development and built
  production. Speed-curve tests performed 120 exact media-pixel comparisons and
  15 moving exports. Replacement/template, TYMM LUT parity and Alight XML
  round-trip passed. The template test was expanded from three cleared stages
  to assert all five fields and actual carried/cleared keys, not just a count.
- Proof: `qa/native-effect-keyframes-{e2e,render}.mjs`,
  `qa/clip-effect-animation-unit.mjs`, `qa/omni-project-sharing-unit.mjs`;
  `qa-output/native-effect-keyframes/{native-keyframes.mp4,contact-sheet.png,report.json}`;
  `evidence/screenshots/native-effect-keyframes{,-mobile}.png`.
  MP4 has 72 frames and 72 distinct decoded hashes. Frame sheet and desktop/
  mobile screenshots were visually inspected. These are synthetic/color-plate
  regression and photo demonstrations, not universal artistic acceptance.
- Scan: source lint reports the existing 277 non-high findings (170 UI-color
  literals, 65 non-null assertions, 28 timer heuristics, nine debug calls, four
  inline handlers, one Demucs TODO). The targeted repository hint scan also
  sees report/scanner references to that TODO. History audit was rerun. Large
  bundle warnings remain visible; unrelated regenerated outputs are restored.
- Remaining: native keys lack easing graphs and color/discrete interpolation.
  Dropped FX instances still need left-trim/overwrite source-key preservation;
  duration-dependent procedural motion (for example Card Flip) does not acquire
  full cut/extension phase continuity from native scalar keys. Optional import
  schemas outside these keys, async audio/roto ownership, retained media and
  same-project filmstrip invalidation remain open. Shared blob attachment
  deduplication, all-browser-script coverage, native installers, 4K performance,
  prior video-study and all-effect visual acceptance are not established.
- Next pass: add failing browser/export tests for FX-instance left trim and
  overwrite, including active, completed and future intervals; preserve the
  source curves without forcing hidden instances back into the clip. Audit
  procedural clocks separately before claiming seamless motion cuts. Then
  connect native keys to easing/graphs with mask, Undo and `.omni` round trips.
  Continue Bezier path trim and async project ownership work from Cycles 12–14.

## Cycle 14 — effect hierarchy, reference study and shared rendering (2026-11-23)

- Added nested effect browsing, breadcrumb/back navigation, searchable group tags,
  scoped search, and an Essentials collection. Categories and subgroups are based
  on actual patch fields; corrected Liquify and glitch-style classification during
  review. Generated recipe groups use arithmetic paging and family search. Fixed
  count badges were removed; totals are derived from the current catalog.
- Implemented original Box Blur, Color Hold, Luma Range, green/blue Despill and
  Channel Mixer kernels (eight presets). They share preview/export paths, masks,
  custom-effect serialization, and the existing dropped-effect keyframe system.
  Added adjustment-layer controls and corrected their missing Undo boundary.
- Added arc-length Trim Path for freehand strokes with Start/End/Offset, linear
  keys, pressure/time interpolation, disjoint wrapping, reset and persistence.
  Draw On and frame-addressed onion ghosts now honor trim. Slider gestures use
  a single history transaction; individual keyboard/input edits stay undoable.
- Browser regression reproduced black masked regions after switching project
  dimensions: pooled offscreen canvases retained their old sizes. Both padded
  and plain surfaces now resize when acquired. The live test renders a photo
  at 640×360, then a masked/keyframed fixture at 320×180 in the same engine.
- Research: indexed 303 Kdenlive manual pages, 14 Glaxnimate pages, 290 Adobe
  effect names and the CapCut product/download page. Checksum-verified both KDE
  AppImages; ran their version commands; indexed 447 installed Kdenlive effect
  definitions (433 files) and exported/rendered an original SVG using Glaxnimate.
  These are inventory and selected-feature study, not full tutorial watching or
  native-plugin parity. Source attribution, scripts and coverage gaps are in
  research/editor-capabilities/README.md. Cached binaries/HTML are not shipped.
- Verification: all 41 unit scripts, all 12 browser smoke flows, TypeScript,
  source lint and production build passed. The new browser workflow also passed
  against the production bundle. The newly added custom-effect
  serialization/adversarial cases also passed after that full gate. Browser
  proof covers nested search, bounded generated pages, audition versus commit,
  radius/Undo, narrow dock, masked/animated Program pixels, and grade/trim
  save/New/Open. Shared headless export decoded 216 frames with 207 distinct
  hashes; compositor checks cover masked Color Hold, luma alpha, despill and
  channel mixing. Screenshots and an 18-second video are linked in the research
  README. The project-history audit was rerun; reference package caches are now
  excluded from that project-source inventory.
- Scan: source lint retains 277 non-high findings across 201 files; the broad
  TODO/FIXME/HACK/weak-typing/empty-catch scan has 25 matches. The production
  bundle still warns about large chunks. No warning was suppressed.
- Remaining: native adjustment properties still lack the dropped FX Stack's
  general keyframe UI. Trim supports freehand paths and linear keys, not Bezier
  shapes, an easing graph, modifier chains or Lottie round trips. Generated
  combinations have one primary group and parameter variants are not independent
  engines. Pixel math remains 8-bit RGB; no GPU/HDR or 4K real-time claim. Broader
  import schemas, generated audio/roto project ownership, media retention,
  same-project filmstrip invalidation, native OS acceptance, prior video-study
  and all-effect visual acceptance remain open as recorded in Cycles 12–13.
- Next pass: unify native adjustment and FX-instance parameter/keyframe editing
  while preserving split/trim/extend behavior and old projects; add animated
  layer-mask/alpha export proofs. Extend trim to editable Bezier paths only with
  shared renderer and graph/persistence tests. Continue project-owned async-job
  guards and optional drawing/effect import validation. Do not equate reference
  indexes, recipe totals or CLI version checks with shipped feature parity.

## Cycle 13 — project import validation and credential privacy (2026-11-16)

- Reproduced in the real browser: a document without clip.volume replaced the
  active project and caused a Timeline failure; a document containing pause:null
  replaced the editor's pause action. Both now fail before any live-state change,
  and staged embedded media URLs are released on validation failure.
- Core import validation checks unique collection IDs, media/track/clip fields,
  finite numeric values, track references, transforms, nested timelines, sequence
  settings, markers, paint layers, transitions and 3D vectors. Compound sequence
  cycles, missing source sequences without fallback children, and more than 32
  compound nesting levels are rejected. Canvas dimensions must be safe integers,
  no axis over 32768 and no area above the existing 7680-square custom limit.
  Runtime action names and reserved prototype fields cannot be imported.
- Privacy: the memory-only AI API key was included by the generic bundle encoder.
  It is now excluded from new saves and stripped from decoded legacy files, so
  importing a project preserves the current local key. Tests use invented keys;
  no real credential was inspected. Existing saved archives are not rewritten.
- Verification: 35 hostile validation cases plus valid minimal/nested inputs;
  browser rejection checks preserve the exact current state and functions and
  verify attachment release. A real compound save/New/Open still restores its
  editable child sequence. Credential tests inspect archive bytes and a legacy
  manifest; the live browser verifies local-key preservation. The existing
  15-check PSD/media/project round-trip also passed during this pass.
  Final combined gate: all 40 unit scripts and 11 browser smoke flows passed,
  along with typecheck, source lint and production build. The history inventory
  was rerun. Source scan retains 277 non-high findings across 197 files and the
  build retains its large-chunk warning.
- Remaining: this is core-document validation, not a complete schema for every
  nested effect, animation/keyframe, rig, font or drawing-tool payload. Those
  collections still need deeper adversarial tests and explicit schema/version
  migration. Model/audio/roto producers still need project-generation guards;
  generated media retention, full same-project filmstrip invalidation, native
  desktop acceptance, the large main bundle and 277 non-high source-scan findings
  remain. Previous video/effect coverage limitations still apply.
- Next pass: protect generated audio/stem/roto completion and progress from
  project switches, clip/source replacement and Undo; dispose abandoned output
  URLs and use atomic Undo for commits. Expand import validation to optional
  animation/effect payloads with round-trip fixtures from existing projects.
  Do not declare every historical editor feature or platform complete.

## Cycle 12 — project ownership, stale jobs and empty 3D scenes (2026-11-16)

- Reproduced and fixed: New Project retained old cutouts, source-preview state,
  selections, clone donors, rigs and 3D objects. A shared reset now clears
  project-owned data before New/Open; imported documents can still supply their
  own content. User preferences/libraries and media still referenced there stay.
- Project loading now uses request ordering: older successful or failed opens
  cannot replace a newer project or its status. New Project cancels pending
  opens. Uninstalled parsed projects release embedded object URLs; replacement
  releases discarded main/nested/history URLs, retaining shared library URLs.
  Runtime generation is excluded from saved bundles.
- Filmstrip work checks project ownership before using its decoder or publishing
  tiles. Replacement releases its sampler, queue and cached images. Live preview
  releases old video/audio DOM elements and image caches. Reused asset IDs update
  source URLs; sampler eviction now detaches its DOM elements. Cutout previews
  also invalidate when the project changes, even if clip/source IDs recur.
- Smart Patch rejects late results/progress/errors after project replacement,
  clip deletion/movement, source replacement, layer changes or a newer request.
  Rejected results do not add Undo snapshots or leave the current job busy.
- Visual review found the former 3D smoke used a fake blob URL and nonexistent
  track. Its success was not moving-video evidence. Replaced it with local real
  footage and actual canvas/decoder checks. This exposed empty-scene primitive
  controls changing local state without storing geometry; they now create a
  project object, and an empty scene no longer displays unsaved phantom geometry.
- Checks: the initial project-reset and stale-patch regressions failed before
  fixes. All 38 unit scripts passed. The project bundle test passed 15 checks,
  including native PSD bytes, raster output and tampered-resource rejection.
  Smart Patch passed its current/range/still browser flow. The expanded lifecycle
  browser test checks overlapping opens, rejected-load URL cleanup, failure
  safety, real Program pixels with reused IDs and detached decoders.
  Final gate: all 11 browser smoke flows, typecheck, source lint and build passed.
  Responsive-workbench checks passed. Six external-model transitions each rendered
  49/49 distinct sampled frames; product recorder export had 18/18 distinct VFR
  frames with audio RMS 0.07055. This is browser export, not a native-app build.
  Fresh 3D screenshot inspected: real footage appears on the plane beside a stored
  diamond primitive. The main bundle warning remains.
- Scan: repository history audit rerun (inventory is not feature acceptance).
  Source scan currently retains 277 non-high findings across 196 files; exact
  locations are in qa/reports/source-scan.json. Targeted weak-type/error hints
  remain in reports/audit-remaining-hints.txt. Large bundle warning persists.
- Remaining: voice isolation, Demucs stem/vocal-patch, roto/tracking and other
  asynchronous producers still need project/clip ownership guards. This pass
  does not terminate every model computation or prove browser memory reclamation.
  Same-project generated assets intentionally remain in the library for reuse
  and Redo; a deliberate unused-media cleanup flow is still needed. Filmstrip
  hashing does not yet cover every compound/effect/source edit within one project.
  Per-field .omni validation remains incomplete: an incomplete test fixture
  missing clip.volume crashed Timeline's toFixed call until the fixture was
  corrected. Audit root fields that could overwrite store actions as well.
  Native OS builds, complex/video matting, real-time 4K and the full tutorial/
  effect acceptance backlog remain unverified; no new videos were watched here.
- Next pass: add adversarial malformed-document tests and validate/normalize
  root/clip/track fields before installation; preserve the current project on
  failure and release decoded attachments. Then guard generated-audio and roto
  commits (including progress and output URLs), test deletion/undo/project switch
  during processing, and verify atomic Undo. Expand filmstrip content invalidation
  with actual same-ID source replacement and compound edits. Run relevant browser
  flows and the repeatable gates; keep native/model/performance claims separate.

## Cycle 11 — cancellable cutout processing and alpha correctness

- Fixed: preview and Apply previously processed different resolutions and could
  show different feather edges. The dialog now generates one PNG at up to
  2048 px and Apply commits that exact result. Changes to the source or options
  invalidate old results; Apply stays disabled until the current preview is ready.
- Responsive processing: a dedicated worker runs matte generation, refinement,
  compositing and PNG encoding. Close, Cancel and superseding edits terminate
  the worker. Completed/failed jobs also terminate; failures can be retried.
  Bitmap and file-reader cancellation paths release resources. Older browsers
  without OffscreenCanvas retain a synchronous compatibility path.
- Adversarial fixes: new tests failed on existing source transparency being
  ignored over a solid backdrop and transparent black corners erasing opaque
  black subjects. Both now pass. The feather slider matches the engine's 10 px
  maximum instead of silently ignoring its last five steps.
- Gates: all 36 unit scripts, ten browser smoke flows, lint, typecheck and build
  passed. The cutout browser flow also passed against the production bundle.
  It checks cancellation, injected worker failure/retry, worker cleanup, exact
  preview/applied pixel equality, fallback parity, PNG export and project reopen.
  A separate 2048² sample with maximum refinement took 1546 ms while the UI
  timer fired 95 times; cancellation during another job returned AbortError.
  These measurements apply only to this cloud Chromium run.
- Remaining: complex-scene and video matting, the 2048 px output cap, generated
  asset retention after Undo, native desktop validation and the large main
  bundle remain open. Source lint retains 277 non-high findings across 195
  files. The compatibility path can still block older browsers during math.
- Next pass: audit generated-media lifetime across undo history and project
  replacement, including stale render jobs. Compare real photographs against
  guided matting before expanding this quick algorithm's quality claims. Keep
  the worker lifecycle checks in the browser gate.

## Cycle 10 — honest still-image background cutout

- Fixed: the old dialog used a synthetic silhouette, fake progress and an Apply
  action that only renamed the clip. It now decodes the selected still, previews
  a real color-edge matte, creates a PNG asset, and replaces only that clip's
  media reference with an undo snapshot. The original asset remains available.
- Hardened: a corner-seeded flood removes connected background colors; choke
  and feather use separable passes with clamped edges. Same-canvas compositing
  captures source pixels before resizing the destination. Existing source alpha
  is multiplied by the matte. UI labels now describe the heuristic rather than
  claiming BiRefNet/MODNet inference or video temporal smoothing.
- Checks: 36 unit scripts, ten browser smoke flows, typecheck, source lint and
  build passed. The new live test checked actual preview alpha, solid backdrop,
  generated-asset alpha, Program PNG subject pixels, undo/redo, `.omni` save and
  reopen, and same-canvas compositing. A 1024² synthetic matte took 91 ms in
  Node on this runner; that is not an interactive device benchmark.
- Remaining: this color-based still-image tool cannot segment complex scenes
  reliably or process moving video. The Apply path caps its longest edge at
  2048 px and is synchronous on the main thread; large images may pause input.
  Undo restores the clip but keeps the generated asset for Redo, so repeated
  abandoned generations can retain memory. The large main bundle and 277
  non-high source-scan findings remain. Native desktop builds are unverified.
- Next pass: add a cancellable worker or chunked pipeline for larger stills,
  then compare real-world cutout quality against the guided matte workflow.
  Review generated-asset retention in undo history and profile project memory.

## Cycle 9 — preview lifetime and source-scan accuracy

- Fixed: a physical pointer click generated duplicate cursor bursts because both
  pointer and compatibility mouse events were handled. The cursor now chooses
  one event family, keeps each burst at its click position during movement, and
  clears its timers on unmount. The live browser check verifies one burst, its
  fixed position, and expiry.
- Fixed: filmstrip retries now clear on cleanup, recover from rejected or empty
  renders, and omit broken image tiles after retry exhaustion. The filmstrip
  browser test starts with an empty project, requires both imported assets and
  checks the image clip before entering a compound sequence; all 14 assertions
  pass. Added both browser cases to the repeatable smoke runner.
- Scan: replaced a 16-line JSX-key lookahead with TypeScript AST inspection of
  JSX returned from `.map()` callbacks. Its two reported cases were data maps,
  so the current scan reports 281 findings: 173 color literals, 65 non-null
  assertions, 29 timer heuristics, nine console calls, four large handlers and
  one TODO. The scanner remains heuristic and does not prove every rendered
  list has a stable key.
- Gates: 35 unit scripts, nine browser smoke flows, lint, typecheck and build
  passed. The browser suite includes context-menu and live MCP checks. The
  build still warns about the large main chunk.
- Remaining: timer findings include intentional promise delays and handlers
  needing case-by-case review. `BackgroundRemovalModal` still has simulated
  progress and an apply action that changes only the clip name; that workflow
  needs a separate functional acceptance pass. Native builds and broad browser
  coverage are unverified.
- Next pass: replace the background-removal placeholder with a genuine clip
  processing path or remove its misleading success flow, then verify preview,
  export and undo. Triage high-impact timers and profile main-bundle startup
  before changing its split points. Preserve generated media and audit output.

This log records bounded evidence. At the start, the repository had 34
`qa/*-unit.mjs` scripts after the first new adversarial case and 136
`qa/*-e2e.mjs` scripts, with no aggregate `test` or `lint` npm script. The
current inventory and gates are recorded in Cycle 8. A passing subset is
never labeled a full suite.

## Cycle 1 — mask bounds and test inventory

- Fixed: `effectMaskFeatherBounds` now returns a safe full-frame rectangle for an
  empty region list or non-finite geometry and Bezier handles. The new
  `qa/effect-mask-bounds-adversarial-unit.mjs` failed before the fix and passed
  after it. Typecheck and build passed.
- Scan: a repository-wide code-pattern search found 20 source files containing
  `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `as any`, or empty `catch` patterns.
  `src/lib/demucs/apply.js` still has a random-shifts TODO. Vite reports
  ineffective dynamic imports for model and DSP modules.
- Remaining: `npm run lint` fails because no lint script or ESLint installation
  exists. The first broad unit run exposed subprocess sandbox errors in the
  compound-clock and text-crop tests and a missing `actionFx` module in the
  scene-recreation test. Browser end-to-end scripts remain unrun in this cycle.
- Next pass: finish collecting the broad unit run, rerun subprocess cases with
  supported sandbox access, inspect the scene-recreation loader, and establish
  a repeatable static lint gate without mislabeling typecheck as lint.

## Cycle 2 — test loader and source lint gate

- Fixed: `qa/scene-recreation-unit.mjs` now uses the shared TypeScript module
  loader, so newly imported `actionFx` is included. The test passes all 27
  scene styles at seven progress samples. Added `npm run lint` using the existing
  source scanner; the scanner now reads each file once and has `--no-write` and
  `--fail-on-high` modes. The broad unit run passed all 34 scripts with subprocess
  permission. Typecheck, build, lint, and the live mask, context menu, and MCP
  browser checks passed.
- Scan: the repo-wide pattern count remains 20 code files. The source scanner
  still reports 285 non-high findings: 173 hardcoded UI colors, 65 non-null
  assertions, 31 timers without a clear partner, nine debug calls, four large
  inline handlers, two possible missing JSX keys, and one TODO.
- Remaining: the lightweight scanner is not ESLint and does not cover control
  flow or type-aware rules. The 136 browser end-to-end scripts have no aggregate
  runner; only three targeted flows ran. Vite still warns about ineffective
  dynamic imports. The `demucs/apply.js` random-shifts TODO remains.
- Next pass: attack non-finite feather tint/offset input, check preview/export
  parity, then rerun the unit inventory, lint, typecheck, build and targeted
  browser gates. Keep source-scan findings visible rather than calling them clean.

## Cycle 3 — overflow and offscreen mask geometry

- Fixed: the bounds helper now detects arithmetic overflow after scaling finite
  values to pixels. Fully offscreen shapes use a safe full-frame fallback instead
  of returning coordinates beyond the canvas. New adversarial cases failed
  before the fix and passed after it. All 34 unit scripts, typecheck, build,
  source lint and live mask editing passed.
- Scan: the repo-wide hint count remains 20 files. The scanner still reports
  285 non-high findings and the build still emits dynamic-import warnings.
- Remaining: no real-time 4K guarantee; full-frame fallback for malformed or
  offscreen geometry sacrifices performance to keep reads in bounds. Browser
  export of these malformed values is not separately exercised. The source
  scanner misses bare `catch {}` blocks, including ones in production code.
- Next pass: inspect bare catches for swallowed render failures, teach the
  scanner to flag them, and resolve actionable production cases. Repeat all
  34 units, lint, typecheck, build and a live editor gate.

## Cycle 4 — swallowed exceptions and portable QA roots

- Fixed: source lint now treats truly empty bare catches as high severity; it
  initially failed on five production cases. Three 3D pointer handlers now
  release capture only when held; two workspace-storage catches document the
  in-memory fallback. A 3D integration test exposed a hardcoded old checkout
  path. Replaced that root in 28 QA scripts with a path derived from each
  script's URL, plus one direct model path. All 28 parse. The live 3D test now
  reaches its final visual proof; all 34 units, lint, typecheck and build pass.
- Scan: repo-wide hint files dropped from 20 to 19. The source lint still has
  285 non-high findings. QA scripts still contain 167 hardcoded localhost:5173
  URLs, so many cannot target a server on another port. The 3D test was made
  configurable and passed against port 5174.
- Remaining: browser integration coverage is still sampled rather than all
  136 scripts. A comment-only storage catch still means persistence can fail
  silently, though the current-session workspace remains usable. Existing build
  chunk/dynamic-import warnings and the Demucs TODO remain.
- Next pass: make browser test URLs configurable where they are hardcoded,
  verify script syntax and run representative flows on port 5174. Repeat the
  unit suite and static gates; preserve existing media and restore only outputs
  regenerated by this audit.

## Cycle 5 — browser server portability

- Fixed: `qa/browser-url-portability-unit.mjs` exposed 54 direct navigations
  that ignored the configured dev-server URL. All now honor `process.env.URL`.
  Every QA `.mjs` file parses, and the animation-entry browser flow passed on
  port 5174. All 35 unit scripts, source lint, typecheck and build passed.
- Scan: 19 code files still match the repo-wide hint search. The source scanner
  still has 285 non-high findings. Most remaining `localhost:5173` strings are
  configurable defaults or comments rather than fixed navigation calls.
- Remaining: the 136 browser scripts are still not all executed. The build's
  dynamic-import/chunk warnings remain. QA scripts with `TEST_URL` instead of
  `URL` use a second convention; a single browser-smoke runner does not exist.
- Next pass: create and run a curated browser smoke gate on the alternate port,
  fix failures it exposes, then repeat the unit/static gates. Inspect generated
  artifacts before any commit so QA runs do not overwrite published evidence.

## Cycle 6 — duplicate keyboard handlers

- Fixed: a new seven-flow browser smoke runner caught a real duplicate shortcut
  bug. Studio and Timeline both handled Ctrl+D, producing two copies; copy,
  cut and paste also had two owners. Removed Timeline's extra global clipboard
  listener and made the timeline test start a fresh project and assert exactly
  one duplicate per keypress. That test now passes 17 checks, including snapping
  and scrub playback. The seven-flow browser smoke, all 35 units, lint,
  typecheck and build pass.
- Scan: 19 source files still match the repository-wide hint search; the
  source scanner still reports 285 non-high findings. Build warnings about
  ineffective dynamic imports and a large chunk persist.
- Remaining: global shortcut conflicts outside the exercised chords still need
  review; the smoke runner covers seven of 136 browser scripts. Full desktop
  and hardware performance checks remain open.
- Next pass: remove the two ineffective dynamic imports in `vad.ts` without
  changing resampling behavior, test the audio path, rerun the unit/browser
  suites and static gates, and check build warning output explicitly.

## Cycle 7 — VAD resampling imports

- Fixed: `vad.ts` now imports the resampler and native DSP wrapper directly;
  both were already static elsewhere, so its dynamic imports created no lazy
  chunk. A new browser test measured a 1.25× rendered audio buffer and checked
  finite, audible samples before and after the change. Both related Vite
  ineffective-import warnings disappeared. All 35 units, seven browser smoke
  flows, lint, typecheck and build passed.
- Scan: 19 code files match the broad hint search and source lint still
  reports 285 non-high findings. The build still warns about a dynamic import
  of `modelLoadStore.ts` and the large main chunk.
- Remaining: the new browser audio check proves one short mono speed case, not
  every sample rate, stereo path or native/JS fallback. Model-load and bundle
  warnings remain; full 136-flow browser coverage remains open.
- Next pass: resolve the model-load import warning without breaking progress
  UI, run all static/unit/browser gates again, audit generated changes, and
  record the remaining bundle/performance risks for the next audit session.

## Cycle 8 — model progress ordering and final gates

- Fixed: the shared model-load store was dynamically imported in four modules
  despite already being static in the main graph. All use direct imports now.
  Demucs worker progress updates are synchronous, so `begin` cannot be overtaken
  by a later `bytes` message while awaiting an import. Vite's ineffective
  dynamic-import warning is gone. All 35 units, seven browser smoke flows,
  typecheck, build and source lint passed. The 1.25× VAD render test passed;
  Demucs unavailable/recovery passed six checks.
- Scan: `qa/reports/source-scan.json` enumerates all 285 current source-scan
  findings with file and line. `reports/audit-remaining-hints.txt` enumerates
  26 matches for TODO, weak typing and empty catches across source and QA. The
  repo-wide matching-file count is 19.
- Remaining: 173 UI-color literals, 65 non-null assertions, 31 unpaired-timer
  heuristics, nine debug calls, four large inline handlers, two possible JSX
  key omissions and one Demucs random-shifts TODO remain unreviewed or unfixed.
  The build still warns that the main chunk is large; it was not suppressed.
  The lightweight source lint is not type-aware ESLint. Only seven of 137
  browser end-to-end scripts form the repeatable smoke gate. Native desktop
  builds, model-training claims and real-time 4K playback were not established
  by these eight passes.
- Next audit pass: triage the 285 findings by actual user impact, starting with
  the two possible missing JSX keys, then timer cleanup and the main bundle's
  load profile. Run the relevant browser tests after each fix. Expand the smoke
  gate carefully, with test fixtures and time limits, before claiming full
  browser coverage. Review desktop packaging and hardware performance on each
  supported OS separately. Preserve all user media and keep generated test
  output out of code commits.
