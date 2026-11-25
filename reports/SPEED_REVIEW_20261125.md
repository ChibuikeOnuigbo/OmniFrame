# Rendering and speed review — 25 November 2026

Paused 3D rendering now checks state, camera pose, geometry identity, viewport
size, grid visibility and source-preview refreshes before submitting another
GPU frame. Playback and camera movement still redraw. The 2D renderer retains
its deliberate 4 Hz polling for asynchronously decoded media.

Measured in software Chromium: 8 paused redraws over two seconds; eight automated
grid interactions averaged 144.75 ms end to end (104–212 ms), including Playwright
click scheduling and polling. These timings are NOT pure render latency, seek
latency or a hardware benchmark. No numeric before/after FPS gain is claimed.
The original zero-idle expectation was corrected after inspecting the deliberate
2D refresh heartbeat; removing it could miss newly decoded media.

Validation: 47 unit scripts, 14 browser smoke flows, the additional idle-render
check, typecheck, source lint and build passed. Sculpt tests wait for an actual
render rather than requiring five redundant frames. Existing 277 lower-severity
source findings and bundle warnings remain. Evidence: qa-output/speed-review/.

## Proxy/settings audit

Fast selects 426-pixel preview, 30 fps compositing and enables prepared proxies.
Balanced uses 1440-pixel preview, 30 fps and proxies. Full uses originals. Select
Fast, then Prepare all: the checkbox alone creates no proxy files. Session-only
silent video proxies use an 854-pixel cap; original audio stays attached and
full-quality output uses original video. Current preparation is real time, with
five-minute sources and 256 MB session-cache limits. This pass inspected the code
and settings UI; it did NOT measure proxy decoding or source/proxy seek parity.
Browser-reported logical CPU count is not proof that all work is threaded.

Blender's official proxy documentation URL returned HTTP 403. No successful
new documentation review or Blender benchmark is claimed.

## Ratings and next tests

Subjective appearance: 6/10. Clearer grouping and recognizable controls, but tiny
labels, dense borders, subdued contrast and horizontally scrolling toolbars still
need refinement. MCP: 7/10 for exercised workflows. Overall readiness: 6/10.
Broad playback speed remains unrated: idle-work savings do not establish lag-free
4K decoding, complex effects or competitor superiority.

Next: benchmark identical real media with originals/proxies at all preview
resolutions; record frame-time percentiles, long tasks, seek completion and audio
sync. Check repeated proxy preparation/cancel/clear and export-original ownership.
Then profile layered effects and sequence-resolution 3D capture. Native desktop
and GPU hardware acceptance remain open.
