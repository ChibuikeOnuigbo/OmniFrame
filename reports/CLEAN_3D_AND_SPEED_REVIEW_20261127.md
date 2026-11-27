# Clean 3D export, frame budget and broad verification — 27 November 2026

## Implemented

3D export now renders the existing live scene into a dedicated output renderer at
exact sequence dimensions. A copied camera uses the output aspect ratio; the
working viewport and camera are not resized or overwritten. Grid, axes and plane
editor outlines are hidden only for the synchronous output render, then restored.
Lighting, materials, animation, tone mapping and color space use the same scene
and source-renderer configuration. This is not a second scene implementation.

The export renderer is created only for recording/direct preview and disposed on
completion, cancellation, failure or viewport unmount. A lazy registry keeps Three
out of the main export module's eager imports. Stale viewport cleanup cannot detach
a replacement viewport. Closing 3D during recording rejects the operation instead
of silently continuing with invalid frames. Renderer/copy errors now propagate.
Export waits for the requested 3D canvas instead of falling back to a 2D canvas.

Recording still targets 30 fps. Both expensive export renders/copies and the
working 3D viewport are paced to that budget while an export session is active.
Timeline/animation clocks continue independently. Missed slots are skipped rather
than rendered in catch-up bursts; half-millisecond jitter tolerance prevents
accidental half-rate capture. Normal viewport policy resumes outside export.

## Native render proof

The actual clean-render test passed 1280×720 landscape and 720×1280 portrait:

- Buffer and decoded-video dimensions match the requested dimensions.
- Direct output rendering leaves viewport pixels and size unchanged.
- Output pixels are identical with the working grid toggled on/off.
- Scene background reaches all corners without viewport-aspect padding.
- Cancellation restores Low preview quality; disposal is idempotent and rejects
  subsequent use. Unmount disposes active sessions and unregisters the factory.
- Closing the 3D view during native export reports renderer unavailability.
- Both native WebM recordings fully decode with pinned FFmpeg. Decoded frames
  were inspected visually and contain the cube/footage without grid or axes.

The new path uses an additional temporary WebGL context and GPU resources. It does
not eliminate memory pressure on large scenes. It also does not establish camera
persistence, multiple independently animated objects/planes, ray tracing, depth of
field or advanced lighting. Tests use one cube and one real video plane.

## Isolated work-budget measurements

Three repetitions per phase: a two-second 640×360 cube/title recording in software
Chromium, no concurrent suites. Both baseline and final runs use the **new clean
renderer**; this is not a whole-app speed comparison against the previous release.

| Median | Initial unpaced export | Final paced export |
|---|---:|---:|
| Full-scene copies | 79 | 62 |
| Export wall time | 2324.8 ms | 2257.4 ms |
| Encoded frames in ~2.1 seconds | 36 | 47 |

This is approximately **22% fewer scene-copy operations**. The separate matched
viewport-budget step reduced median working-viewport renders from 68 to 60.
The intermediate export-only pacing phase already reduced copies to a median 64.
Raw counts, timings and encoded-frame inspection are retained under
`qa-output/export-cadence/`.

Wall time stayed around 2.3 seconds; three repetitions cannot establish a meaningful
overall speedup. Final recordings contained 42–49 encoded frames over ~2.1 seconds,
still below consistent 30 fps. These are encoded frames, not verified unique
presentation frames. Final long tasks reached 150 ms. Cold shader work, shared-host
variability, memory/driver effects and different hardware remain uncontrolled.
The frame-budget unit check covers 60/120/144/240 Hz schedules, jitter and stalls.

## Final verification

- 50 unit scripts and all 14 browser smoke flows passed.
- Targeted clean 3D export and six native export/recovery recordings passed.
  All six automatic MP4/WebM files decoded in this run; earlier older-decoder MP4
  failures remain a compatibility concern, not proven resolved by these passes.
- 100 distinct asset IDs using one source passed eviction/revisit, rapid seeks,
  clip-boundary playback and project reset. This is not 100 unique UHD videos.
- Audio checks passed real stereo RMS/peak, element volume, detach silence and
  reconnection. Sustained audible A/V synchronization remains unverified.
- Proxy checks passed actual 854×480 preparation from a synthetic 1080p source,
  original audio, original-source export, cancellation and failure cleanup.
  Proxy timing here ran with other suites and is not a controlled speed result.
- Typecheck, source lint and production build passed. 278 nonblocking source-scan
  findings and large-chunk warning remain. Three is still emitted separately.

## Ratings

These are subjective ratings of demonstrated capabilities, not percentage-complete
scores or measured comparisons with CapCut, After Effects, Krita or Blender.

| Aspect | Rating | Basis / main remaining limit |
|---|---:|---|
| Speed / responsiveness | 6/10 | Less repeated rendering; startup stalls and sustained 4K unproven |
| Rendering / video export | 6/10 | Clean sequence-sized 3D output and recovery; older MP4 parser compatibility remains |
| 3D / 2.5D | 6/10 | Up from 5: clean output, stable keyed poses and moving plane; complex scenes unproven |
| Timeline / core editing | 7/10 | Seek/reset/compound/interaction flows pass; varied heavy footage still needed |
| Effects / keyframe animation | 6/10 | Mask/keyframe/animation gates pass; full catalog visual quality not audited |
| Primitive sculpting | 5/10 | Real gesture/undo and 256-dab limit tested; limited geometry tools |
| Audio basics | 6/10 | Stereo routing and gain verified; long A/V sync and broader processing unverified |
| Project handling / proxies | 7/10 | Lifecycle, restoration and proxy ownership checks pass; large import limits remain |
| UI / organization | 6/10 | Usable measured interactions; dense 3D panels and broader polish remain |
| Live MCP tools | 7/10 | Mask, undo, transform/curve, persistence and invalid-input flows pass; not every ability |
| Overall tested browser editor | 6/10 | Clear progress, substantial capability and performance gaps remain |
| Native apps, mobile end-to-end, AI/models, large asset packs, security | Not rated | No sufficient platform/model/security audit in this round |

Next priorities: sustained real-source A/V tests, GPU measurements and context
pressure, camera/object persistence and independent multi-object/plane coverage.
First-frame synchronization and long-duration/background-tab recording also need
further review. Do not label the editor lag-free or universally production-ready.

Evidence includes `qa-output/clean-three-export/1280x720.webm`,
`720x1280.webm`, `report.json`, the proxy/audio/stress reports and before/final
cadence recordings. Rerun `qa/clean-three-export-e2e.mjs` and
`ASSERT_BUDGET=1 node qa/export-cadence-e2e.mjs` with Vite on 5183. Run benchmark
scripts alone before broad suites if interpreting timing.
