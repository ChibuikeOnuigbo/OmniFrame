# OmniFrame implementation and evidence — 2026-10-31

Repository: `ChibuikeOnuigbo/OmniFrame`. Work began from merged `main` at `ba7103b89600ef4afa2d4ac5a55e1be1a24ac1ea`, following the latest user instruction, on `codex/omniframe-device-glitch-production`. Core implementation commit: `f1915b06`. During work, main received evidence-only commit `4d343e73`; it was merged into this implementation branch as `91099b81`. No protected branch was reset, overwritten or merged into.

## Implemented

Seven original Blender 4.3.2 device models have real rounded geometry, materials, UV-mapped `ScreenSurface`, cameras/buttons/stands/decks and editable `.blend` sources. A cached Three renderer maps the actual composited video frame onto the screen and hands off to a pixel-exact flat frame. Perspective Canvas fallback remains available. Device3D is reachable in the left panel; the right inspector controls model, 19 motions, fit, brightness, FOV, camera distance, yaw/pitch/roll, key/rim/hemisphere light, duration and preview/reset. These settings persist in `.omni` projects and undo/redo.

The authored 5,000-recipe Glitch V2 library now loads lazily into the UI. The shared engine implements distinct event patterns/families, ordered layers, blend/opacity, envelope timing, deterministic seeds, per-clip/instance clocks, alpha preservation and zero-strength bypass across blend modes. FX keys and phase survive splitting. The queue recovers its 1-based cursor from completed IDs, handles failures/interrupts atomically, uses uniform v2 temporal signatures and builds the complete retained reel.

Drawing adds eight geometric tools and corrects closed-shape fill/star geometry, with a compact grouped toolbar. Voice cleanup fixes reversed denoise strength, respects dry/wet in RNNoise, retries failed model sessions, applies actual-rate DC removal and stereo-linked normalization with a peak ceiling. The audio meter now measures actual stereo RMS/peaks. A reusable audio bus fixes sound loss on repeated exports; recorder range playback no longer drifts into slow motion, restores preview quality and cleans streams.

Headless project reset now clears prior paint, selections, compound navigation and decoded-frame ownership while retaining the saved template library. Visual board review exposed that prior paint had covered later projects. Patch-only clips also bypassed the compositor and clone mode lacked a donor source; the shared patch path now processes immutable donor pixels, feathered clone/gradient/four-tap blur and correct clip-local coordinates. The car region visibly changes after the fix, but donor seams and remaining reflections mean natural object-removal acceptance is still open.

Live app MCP fixes include mask defaults, immutable key/curve updates, undoable mutations and honest failures for invalid selections/values/tracks. There are **21 live bridge tools and 69 headless registry tools**; parity is not claimed. Viewport-measured global/timeline menus support scrolling, keyboard navigation and focus restoration. Inline submenus stay within the scroll container, and marker popups fit short displays and close with Escape.

The recovered task guide `docs/CODEX_TASK_RECOVERY.md` maps all A–T quiz groups, actual instruction images, YouTube requests, Drive manifests, motion studies, screenshot packs, code and tests into explicit acceptance questions. The repository audit inventories file/Git age/media dimensions and missing references; repeated historical ledger headings and generated search URLs are not promoted to completed features or watched tutorials.

The current YouTube worker also had a concrete sampling bug: metadata string `"0"` produced twelve samples at time zero; portrait footage was forced to 640×360. The repaired extractor measures duration from acquired bytes, records sample times and preserves aspect ratio for uniform and scene-cut frames. A local real-video regression passes. Stored evidence was decoded separately to flag uniform/low-diversity sets for source review. The remote acquisition workflow was **not executed** here; automatic pushes are restricted to main, with a manual trigger available.

## Rendered proofs

All paths are repository-relative and can be opened locally. The checked-in evidence commit will make them available on the review branch.

| Artifact | Path |
|---|---|
| Combined device transitions, real browser renderer + decoded moving video | `qa-output/device-transitions/combined-device-demo.mp4` |
| Device motion/model manifests and repeat export timing/audio measurements | `qa-output/device-transitions/{manifest,native-export-manifest}.json` |
| Individual device MP4s and progress frames | `qa-output/device-transitions/` |
| Blender model previews (seven models × three angles) | `qa-output/device-transitions/model-previews/` |
| Device geometry/video contact sheets | `qa-output/screenshots/{device-model-contact-sheet,device-contact-sheet}.png` |
| Five animated Glitch V2 demos + combined video | `qa-output/glitch-v2/combined-glitch-demo.mp4`, `demo-manifest.json` |
| All-5,000 **single active frame per recipe** diagnostic | `qa-output/glitch-v2/all-5000-compositor-diagnostic.mp4` |
| All-5,000 kernel/compositor measurements and contact sheets | `qa-output/glitch-v2/`, `qa-output/screenshots/glitch-*.png` |
| A–J board replays: 43 recipe variants/runs, 45 MP4s, timelines/traces | `qa-output/recovered-boards/report.json`, sibling directories |
| Live MCP timeline and report | `qa-output/mcp/` |
| Real speech denoise fixture + measured stereo meter | `qa-output/audio/` |
| Fresh inspector, effect builder, filled-heart UI | `qa-output/screenshots/` |
| Popup/mobile keyboard and bounds screenshots/report | `qa-output/popups/` |
| Landing responsive/studio transition/navigation proof | `qa-output/landing/` |

Device proof rendering uses original FFmpeg test footage and an original title card, 960×540 at 30 fps. This is a software-rendered proof, not a 1080p/4K/hardware-performance acceptance claim. Blender previews are Cycles CPU renders; this build lacks OIDN, so denoising was disabled. Contact sheets were inspected, including actual model/video mapping, terminal handoff, device wall, glitch families, mobile UI and board instruction images. Not every historical asset or video has been visually reviewed in this session.

## Executed validation

- `npm run typecheck`, `npm run build`: passed. Vite reports large-chunk/plugin timing notices; no production build failure.
- Shared engine regressions: glitch layers/determinism/alpha/zero/blends; four device kinds × 19 motion paths at 30/60 fps; drawing bounds/fill; audio math at 8/16/44.1/48/96 kHz; split-key/clock pixel continuity; encoder process failure cleanup.
- Browser production suite: seven GLBs, UV/geometry/orientation, 49 progress renders, exact final handoff, actual camera/light pixel changes; all 5,000 catalog entries; UI search/apply/opacity and filled-heart pointer drawing; layer/transition undo/redo; project save/reopen; no page errors.
- Real ONNX fixture: speech + deterministic 0 dB white noise, SI-SNR **0.0459→0.9722 dB** (+0.9264 dB), strong setting lower noise energy, peak 0.6617. Zero-strength decoded dry bypass error at most one PCM16 quantization step. This single fixture does not establish broad speech/music separation quality.
- Audio bus calibration: left RMS about −23.07 dBFS / right −29.09 dBFS and −20 dBFS left peak; half element volume shifts about −6.02 dB. Repeated recorder exports decode independently with nonzero sound. The latest two 1.6 s requested ranges produced 1.72 s and 1.56 s realtime recordings; exact frame-accurate export remains open.
- Headless project-reset and patch-only compositor regressions: actual clean new-project pixels, preserved template library, visible target changes for clone/gradient/blur, preserved outside pixels/alpha and invalid input rejection. Browser Smart Patch passes 12-frame clip scope, four-frame OmniFrame range, masked selection and still-image patch checks.
- Existing universal regression: 63 steps / 69 registry tools; lossless TYMM LUT parity; decoded XML round-trip; replace-template workflow. Passed. Those checks regenerated historical tracked answers; they remain preserved outside the implementation commits.
- All 5,000 shared kernel recipes at three frames and one active full-compositor frame each: passed. Distinct diagnostic hashes are not perceptual uniqueness or human approval.
- A–J archived recipes: all ten board files replay successfully; 43 runs and 45 videos. Board A offscreen offsets corrected and re-rendered. Full original visual matching, including inpaint/roto quality, remains separate. Board C’s instruction image explicitly requests 150 video edits and 15 speed curves; the ten archived still-based variants do not fulfill that request.
- Responsive studio suite: seven sizes 320–1920 px, no page horizontal overflow, modal fits. Measured global menu with real video/audio submenus: three mobile/short-desktop sizes, keyboard Home/End/arrows/Escape, expanded bounds. Landing workflow: 25 checks passed; controlled browser time avoids skipping animation checkpoints under software-rendering load.
- Study sampler: actual portrait fixture, nonzero measured duration, zero/NaN rejection, distinct frame times and preserved letterboxing. Remote network acquisition not tested.

## Remaining work and boundaries

1. Full-motion queue is **next 860**, **602 retained**, **245 duplicate decisions**, zero failed. All-5,000 diagnostics are complete; all-5,000 full-motion/perceptual/human acceptance is not. Continue canonical `qa/newglitch-batch.mjs` with one writer.
2. Drive folder `1uP9ySa8P2p9yGM4gJsn8fxuosQ1k2XrN` was blocked by proxy CONNECT 403 before Google; no folder contents were read. Narrow environment-config draft additions for `drive.google.com` and `api.github.com` require environment-settings review/save/publish before they apply. Then recursively inventory and recover authorized originals. No bypass was used.
3. Historical YouTube statuses conflict; weak stored samples need re-extraction/source review. `google_drive/` and `img_data_pack/` referenced by older tasks are absent. S/T renders with those inputs remain blocked; existing local studies are indexed, not newly claimed watched.
4. Custom camera animation keys, material/reflection controls, HDR environment maps, actual scene shadows, DOF and motion blur are not implemented by the new inspector. Lighting controls change real key/rim/hemisphere lights.
5. Tauri native build/runtime was not executed: Rust/Cargo, Linux GTK/rsvg dependencies are missing. Web build is tested separately.
6. Realtime recorder export has timing/VFR limitations; exact offline audio/video export and broader real-world audio quality assessment remain open.
7. A manual proof workflow is added but has not run on GitHub. GitHub API access remains blocked; no PR creation or CI execution is claimed without an actual returned result.

Automatic approval review rejected a cleanup command because discarding historical tracked test/evidence changes could destroy prior work. Those files and generated caches were preserved; no alternate discard was attempted. They are excluded from implementation staging. The full historical mission is **not declared complete**.
