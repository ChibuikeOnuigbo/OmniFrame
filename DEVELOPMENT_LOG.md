# Development log

## 2026-09-18

- **Task:** establish the repository and engine architecture.
  **Status:** complete.
  **Files:** monorepo package files, engine core/timeline/mask/tracking/Omniframe/3D/effects/project/template/audio/export modules.
  **Tests:** timeline, tracker, Omniframe, mask, three, systems suites.
  **Benchmark:** Node engine suites complete in approximately 1–2 seconds on this sandbox; record only as a local reference, not a product promise.
  **Problems:** Rust/FFmpeg binaries are not installed in this sandbox; native shell and desktop media adapter remain documented gates.

- **Task:** read `moreresearch.md` and rework the web workbench instead of extending the deterministic demo surface.
  **Status:** implemented and verified by typecheck/build.
  **Changes:** the editor now starts with an honest empty sequence; imports are explicit and local; the canvas renders decoded video/image frames rather than a synthetic person scene; the timeline exposes real selection, snapping, markers, track mute/solo/hide/lock, trim/split/ripple/roll/slip/slide/move commands, adjustment tracks, keyframes, effects and autosave/recovery; masking, mask tracking, general tracking and Omniframe have separate workspaces; Krita modifiers and visible mask display modes are wired to a real mask buffer.
  **Changes:** WebCodecs + `mp4-muxer` is connected as a real local H.264/AAC MP4 path. The export action refuses to write when either encoder is unsupported and reports the platform error. CPU effect definitions are applied to both viewer and export surfaces.
  **Changes:** a real Three.js GLB/glTF viewport is connected with orbit controls, scene-linear-ish tone mapping, RoomEnvironment/PMREM lighting, PBR material loading, animation-count reporting and an explicit CPU lightmap/AO bake action with a measured cache key. A Three.js chunk, ONNX Runtime chunk and MP4 muxer chunk are split at build time.
  **Changes:** the Tauri shell now exposes audited native commands for atomic `.vxproj` writes, recovery snapshots, project envelope validation, media fingerprints/relink checks, FFmpeg capability probing and cooperative job cancellation. These commands are not claimed as built here because Rust/Tauri/FFmpeg are absent in the sandbox.
  **Decision:** no default fake footage, no fake tracking points, no fake model download progress, no timer-based bake/export progress, and no label of GPU/native readiness without a capability check.

- **Task:** investigate and implement SAM2 as an explicit option.
  **Status:** classical engine path complete; SAM2 adapter and licence registry complete; browser model download is explicit and not automatic.
  **Decision:** sparse keyframes plus classical propagation; no encoder-per-preview-frame. The async provider bridge now supports decoded browser frames instead of throwing on an asynchronous video provider. Approximate registry model size is no longer shown as byte download progress; ORT load is indeterminate until sessions are ready.
  **Next:** pin an exact ORT export/revision, download and benchmark the weights on target browsers, and record the measured licence/latency result.

- **Task:** investigate 3D baking, environments, lighting, animation and rigging.
  **Status:** CPU reference bake, AO, PMREM/room/HDRI data model, glTF-oriented rigs, FABRIK/CCD, skins and clip sampling implemented/tested; browser GLB viewport and a real bake trigger are now connected.
  **Next:** native/GPU production baker, actual animation playback/rig/IK controls and GLB fixture tests.

## Honest activity rule

This log records completed changes and observed failures only. It does not claim visual/performance checks that have not run.

- **Task:** browser E2E smoke pass.
  **Status:** Playwright config and no-overflow/workbench tests are present.
  **Result:** engine/typecheck/build/license checks pass; Chromium could not be installed because the sandbox connection to `cdn.playwright.dev` reset. The E2E assertions therefore remain unexecuted in this environment, not falsely marked green.
  **Next:** run `npx playwright install chromium && npm run test:e2e` in CI or a connected dev environment.

- **Task:** export honesty pass.
  **Status:** the browser adapter is now implemented, but platform support is still capability-gated.
  **Result:** `mp4-muxer@5.2.2` is MIT and included in the audit. The adapter encodes video and audio through WebCodecs and muxes a local MP4; it does not fall back to a fake file or silent progress.
  **Next:** run an actual browser export fixture on Chrome/Edge/Safari combinations and validate the produced MP4 with media tooling.

- **Task:** native desktop verification.
  **Status:** native command boundary is implemented in `apps/desktop/src-tauri` and `crates/omniframe-core`.
  **Result:** not compiled in this sandbox because `cargo`, `rustc` and FFmpeg are unavailable.
  **Next:** install Rust/Tauri/FFmpeg in a connected desktop CI job, run `cargo fmt`, `cargo check`, Tauri dev/build for Windows/macOS/Linux and exercise atomic save, relink, cancellation and export failure paths.
