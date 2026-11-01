# Editor improvement checkpoint — 2026-10-31

The current increment implements playback performance controls and temporary media proxies, repairs the 3D viewport lifecycle, and preserves desktop CI build artifacts. This is an incremental delivery against the uploaded full-request ledger; it does not certify feature completion or superiority to another editor.

## Implemented behavior

- Settings → Playback exposes 15/30/60 fps compositing limits and measured last-frame cost, render dimensions and frame count. Timeline/audio clocks continue in real elapsed time. Full-quality preview/export bypasses the cap.
- An unchanged paused 2D preview composites at approximately 4 Hz while edits invalidate it immediately. Periodic refresh intentionally remains for asynchronous media/texture readiness.
- Preview quality caps the longest composition edge without upscaling small compositions. Full quality retains exact sequence dimensions.
- Settings → Playback → Media proxies prepares an 854-pixel-long-edge WebM proxy from an imported video, with progress, cancellation, an enable switch and cache clearing. A progress card remains visible after closing settings. Preparation runs in real time and keeps the editor tab visible; it is not an offline or frame-exact encoder.
- Proxies supply video only. Original media supplies audio. Export selects original media, restores preview quality afterward, and sampling tools use originals. Proxy state is separate from project state and is not embedded in `.omni` files. Entries validate source URL identity to avoid reusing a proxy for replaced media.
- Browser proxy limits: one active job, five-minute source limit, 128 MB per encoded proxy, 256 MB session cache. The session cache disappears when the tab closes. Disk persistence and a native transcoding queue remain future work.
- The 3D scene and WebGL context survive playhead changes and viewport resizing. Previously, playhead-dependent effect teardown recreated them continuously. The animation loop now reads current timeline state through a ref. Auto-spin uses elapsed time rather than frame count. Resolution changes resize the renderer; old geometry/materials and complete video-plane groups are disposed on replacement. The 2D selection quick bar no longer covers 3D controls.
- The general E2E test uses current zoom/split/export controls and fails if no export is produced, replacing outdated ambiguous selectors and an optional-export success condition.
- Desktop CI uses Node 24, typechecks before native builds, and uploads installer artifacts for every matrix job, including manual runs. The matrix already targets Linux, Windows and both macOS architectures. It was not dispatched here; native compilation, installers, signing and platform behavior remain unverified.

## Executed evidence

`qa-output/performance-20261031/` holds current measurements, screenshots, proxy source/export and regression evidence.

- `qa/preview-performance-unit.mjs`: dimensions, portrait aspect, full resolution, edit invalidation, idle refresh and frame-budget checks passed.
- `qa/preview-performance-e2e.mjs`: a paused timeline rendered four frames over one second; a 15 fps limit yielded 13 frames over 1.000 seconds of timeline advancement on this cloud instance. The 320×180 composition stayed at 320×180. 3D canvas identity survived four playhead changes and a resize; no page errors.
- `qa/media-proxy-e2e.mjs`: actual 1920×1080 source encoded to 854×480; active muted proxy video and original audible audio verified; export switched back to 1920×1080 originals and restored preview quality; cancellation left no incomplete entry. The export decoded with stereo audio, measured mean level −25.1 dB on the first test run. This is a deterministic synthetic fixture, not a comparative application benchmark.
- General E2E passed real moving-video import, playback, frame zoom, split, MP4 download and responsive captures with no browser errors. Its artifacts are outside the checkout under `/workspace/.omniframe-onboarding/qa/shots/`.
- Project bundle suite: 15 passed / 0 failed, including byte-exact original-media restoration, PNG/OBJ subset export, and corrupt-media rejection.
- Context-menu viewport, live MCP, project reset, smart-patch compositor, deformation, glitch kernels, device rigs and audio math passed.
- Device/glitch production E2E passed nine GLBs / 63 sampled renders, shared handoff, layered recipes, save/reopen, undo/redo, and pointer drawing. These counts are not exhaustive full-motion recipe acceptance.
- ONNX audio strength E2E passed with approximately 0.926 dB synthetic-fixture SI-SNR improvement and correct dry bypass. No model was newly trained by this increment.
- Typecheck and production build passed, with existing dynamic-import/chunk-size warnings. The build and browser tests do not certify native desktop builds or hardware acceleration performance.

## Uploaded ledger and source review

`research/editor-upgrade-20261031/upload-ledger-index.json` records the uploaded document hash, 29 headings and 134 explicit URL-form YouTube IDs. The document also has a bare-ID appendix and historical completion labels; those labels were not treated as current validation.

The repository audit was regenerated; its compact summary is saved with this research and full generated indexes are retained at `/workspace/.omniframe-onboarding/repo-audit-20261031/`, preserving historical tracked reports.

Fresh public Drive inspection returned 42 root entries and 98 visible entries across seven creative subfolders, including the 41-video tutorial folder. The folder explicitly labeled academic/not-for-coding was excluded from editor research. HTML pagination completeness is unverified. Listing records are not downloaded or watched-video counts.

The supplied Drive copy of `8hjWrzum_vQ` was downloaded (11,065,415 bytes) and hashed. `reference-contact-sheet.png` contains 14 frames sampled at two-second intervals. Visual review shows individually staggered word clips, orange camera/solid layers, red null layers, adjustment layers and changing zoom/rotation/scale. This is sampled visual review, not continuous playback or audio analysis. It supports keeping timeline structure readable and avoiding tool overlays that cover active 3D controls. Exact effect parameters cannot be recovered from those samples alone.

GitHub metadata searches for Toji Motion and Gold Motion returned similarly named repositories without declared licenses; official source identity is unverified. Nova is ambiguous among multiple projects. No APK was installed, decompiled or copied into the editor. The requested official upstream links remain useful for verifying identity and licensing before source reuse.

## Remaining scope from the latest request

| Request | Current position / next acceptance gate |
| --- | --- |
| Faster than CapCut / better than AE and Alight Motion | No comparative benchmark. Measure real workloads on matched hardware, source media and export quality before making speed or quality claims. |
| Full ledger feature completion | Audit existing features against exact current behavior and original references; historical checkmarks and generated inventories are insufficient. |
| Threading and preprocessing | Proxy preparation and existing audio workers function; multithreaded compositor/decoder scheduling, native background jobs and persistent render cache remain open. |
| Sculpting and broader Blender tools | This increment fixes viewport lifecycle, resource cleanup and overlay obstruction. Real sculpt geometry, shared export/persistence/undo support and other modeling tools are still unimplemented. |
| Every Drive asset/video and YouTube study | Current visible listings and one fresh sampled video review are recorded. Remaining videos, archives, page completeness and continuous studies remain open. |
| More/better trained ONNX models | Existing bundled model integration was tested. New training needs a defined task, licensed training/evaluation data, baseline and held-out acceptance; no new model or improved general quality is claimed. |
| Perfect desktop on all platforms | CI artifact retention is fixed. Native platform runs, installation tests, codec parity, signing and notarization remain open. |

No environment configuration, publication, remote push or PR was performed by this increment. User media and historical regression evidence were preserved.

## Continuation — 2026-11-01

The user supplied the Gold Motion and Toji Motion APKs. Both were downloaded through Drive's normal large-file confirmation and inspected statically. Gold Motion identifies as `com.goldmotion.pnkj`, version 6.1; Toji Motion identifies as `com.alightcreative.aftermotionskexnxx`, version 5.0.161.106022. Their hashes, package metadata and library inventories are in `supplied-apk-metadata.json` and `apk-static-review.json` under the research folder. The APKs remain outside the checkout in `/workspace/omniframe-reference-cache/editor-packages/`.

Parsed effect-resource catalogues contain 738 Gold Motion XML entries and 692 Toji Motion XML entries. These are resource counts, not distinct verified effects. Both packages contain Android DEX and ARM native libraries including an Alight-named library. Gold Motion includes three TFLite files with interpolation/upscale-oriented filenames; their accuracy, architecture and redistribution rights are unverified. No Java/Kotlin/C++ source files were found by the filename inventory, and no open-source license was established. Package identity and resource inspection do not establish authorship or permission to redistribute code/models. Neither APK was executed or copied into OmniFrame. Nova remains unidentified.

The rendering budget now also controls actual 3D WebGL draws while camera/animation time continues independently. The responsive workbench regression passed actual corner/liquify gestures, undo, persistence, and drawer geometry. Further source-level analysis, sculpting and model evaluation remain outstanding.
