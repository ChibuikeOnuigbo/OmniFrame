# 3D / 2.5D rendering review — 27 November 2026

Fixed two defects found by actual render tests:

- Automatic object spin accumulated elapsed animation-frame time. Playback then
  rewind produced different pixels at time zero. Rotation now derives from clip
  timeline time plus the stored base rotation; explicit wheel/rotation curves
  still take precedence. It updates on seeks while paused and resets all base
  axes before applying the evaluated pose. Before/after pixel proofs are retained.
- Unmarked export used the timeline's five-second editing minimum, adding unwanted
  blank tail to short content. It now ends at the last clip (within sequence
  duration); explicit In/Out ranges are preserved. The editing timeline floor
  itself is unchanged.

## What was actually exercised

A 1280×720 sequence containing a cube, keyed rotation, title and one composited
video plane. The plane carries real local Pexels footage. With the cube moved off
camera, seeking between footage times still changes the plane pixels. This avoids
mistaking object spin for moving video. Keyed rotation returns to identical pixels
after a seek away and back. Automatic rotation now also returns to identical
pixels at zero after playback; this failed before the fix.

The sculpt workload uses a sphere with 256 valid alternating raise/carve dabs.
It renders while playing, retains all dabs and rejects a 257th. This is a modest
primitive mesh (32×32 sphere segments), not a million-polygon stress test. The
browser smoke gate separately exercises real sculpt gestures, undo and OBJ checks.

Projected X/Y title animation uses ease-in-out keys (X to 30°, Y to 60°, then back).
Measured bright-pixel width changes from 623 to 312 pixels; returning keys restore
identical pixels. The larger height at the tilted pose is expected from the slanted
projection. This is 2.5D projection, not volumetric text or physical simulation.

## Software-rendered measurements

Final isolated performance run, one cube + static title plane:

| Workload | Elapsed | Render submissions | Long tasks |
|---|---:|---:|---:|
| Low preview | 2.544 s | 85 | 0 |
| Full preview | 2.551 s | 75 | 0 |
| Sphere / 256 dabs, with video plane | 2.052 s | 66 | not sampled |

The WebGL buffer was 803×618 in both quality modes. Low changes source preview
quality/frame policy; it does not reduce this viewport buffer. These counters
measure renderer calls, not GPU completion or unique presented FPS. Short software
Chromium runs cannot establish real-GPU, sustained 4K or competitor performance.
The earlier first pass had one 55 ms long task, so zero tasks in this run is not a
lag-free guarantee. No other suites ran during the final performance sample.

The four-second 3D composite exported to WebM in 4.209 seconds and fully decoded
with pinned FFmpeg. A separate projected-text WebM also decoded. The final 3D
project was saved with embedded source media; reopening/camera restoration was
not tested here. Screenshots and decoded export frames were visually inspected.

## Export duration correction and compatibility

Earlier export-reliability notes called the final fixtures “two-second sequences”.
That was incorrect: recomputeDuration retains a five-second floor. The new native
checks measure decoded duration rather than assuming clip length equals export
length. Three WebM outputs now decode to 2.123, 2.130 and 2.145 seconds. An explicit
0–4 s range remains 4.052 seconds, including intentionally requested empty space.

The three new automatic MP4s fail the pinned older FFmpeg header parser. All three
fully decode with supplemental system FFmpeg 7.1.5 and probe at 2.07–2.11 seconds.
Keep this compatibility issue open; do not count these as pinned-decoder passes.
The earlier retained failure and these new samples suggest decoder/container
compatibility, not proof of corrupt browser output or proof of universal support.

## Assessment and remaining limits

The tested path is useful for basic animated primitive/video composites and
projected 2D motion. **Provisional 3D/2.5D capability rating: 5/10.** This is a
subjective assessment of this path, not a benchmark against Blender or AE.

- The working 3D viewport shows the selected primitive/model; these checks do not
  establish simultaneous multi-object rendering or independent multi-plane depth.
- Native 3D export currently captures the working viewport. Guides/axes and
  viewport-aspect padding are visible in the export. The 720p output upscales a
  smaller viewport buffer; it is not a dedicated full-resolution scene render.
- Large imported scenes, advanced object/camera animation, depth of field, motion
  blur, complex lighting and ray tracing are not established by these tests.
- Long sessions, GPU hardware, A/V drift and native-platform exports remain open.

Priority next: a clean sequence-sized 3D render path without editor guides, then
multi-object/plane coverage and independent object/camera animation. Preserve the
shared scene/engine and preview/export parity; do not hide limitations behind a
successful file export.

48 unit scripts and 14 browser smoke flows passed after the animation fix. After
the export endpoint follow-up, targeted export/UI/failure tests and final static/
build checks passed. The 15 source-clock proof also passed 120 pixel comparisons
and 15 moving exports. Lint retains 278 nonblocking findings; large bundle warning
remains. Historical generated outputs were restored; new evidence is isolated.

## Files

- `qa-output/three-render-review/final/three-composite.webm`
- `qa-output/three-render-review/final/three-composite.omni`
- `qa-output/three-render-review/rotation-xy/rotation-xy.webm`
- `qa-output/three-render-review/final/report.json`
- `qa-output/three-render-review/export-duration/report.json`

Rerun with Vite on 5183 using `qa/three-render-review-e2e.mjs`,
`qa/rotation-xy-render-e2e.mjs` and `qa/export-reliability-e2e.mjs`.
