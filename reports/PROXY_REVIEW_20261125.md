# Proxy validation — 25 November 2026

Hardened proxy cancellation after metadata loading, missing canvas allocation,
interval drawing failures, and repeated completion/error callbacks. Completion
now stops the drawing interval and source playback immediately. Injected drawing
failure releases the active job; clearing during preparation cannot repopulate
the cache. Original audio and full-quality export source ownership passed.

The browser test now uses current settings labels and an isolated fresh project.
A fresh Vite instance was required after hot updates: the unversioned dynamic
test import and UI had observed different store instances. The two earlier
empty-store timeouts are not counted as successful test runs.

Eight warm decoder seeks on a two-second synthetic 1920×1080 VP8 source were
compared with its real browser-generated 854×480 proxy. Reported upper-middle
samples: original 120.6 ms, proxy 36 ms; slowest samples 131.8 ms and 62 ms.
Raw samples and export are in qa-output/proxy-review-20261125/. The proxy reduced
decoding work for this fixture. This is a single software-Chromium run, not a
whole-editor speedup, compositor/seek-to-present metric, representative camera
footage, 4K acceptance or long-project benchmark. Audio source ownership was
checked; precise sustained A/V synchronization was not measured.

47 unit scripts, 14 browser smoke flows, the expanded real proxy workflow,
typecheck, build and source lint passed. 277 lower-severity findings remain.
Appearance remains 6/10, MCP 7/10 for exercised workflows; broad playback speed
remains unrated pending realistic workloads and frame-time/long-task profiling.
Next: test long GOP camera footage, repeated seek direction changes, dropped
frames, sustained audio sync, multiple layers and proxy queue cancellation.
