# Verified implementation changes — 2026-10-31

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
