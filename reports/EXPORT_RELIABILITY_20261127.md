# Export reliability review — 27 November 2026

Correction from the subsequent 3D review: clip length was two seconds, but the
sequence retained a five-second minimum. The original exports below therefore
did not prove two-second output. The later endpoint fix and measured-duration
checks are documented in `THREE_RENDER_REVIEW_20261127.md`.

Export now supports cancellation, rejects overlapping API requests, and refuses
to label interrupted playback, empty encoder output, premature encoder stop or
timeout as successful. Recorder error events terminate the operation and cleanup
releases capture tracks/audio routing. Normal completion and failure restore the
original speed/preview quality. If the project is replaced, cleanup preserves the
replacement project's settings instead of restoring stale settings over it.

## User-facing changes

- Cancel in the export progress panel; AbortError produces “Export cancelled”.
- Explicit Export WebM option alongside the normal browser-selected format.
- Progress/cancel panel is portalled above the editor. Real pointer testing found
  that the inspector previously intercepted Cancel; a normal click now passes.
- Timeout scales with timeline length; the old fixed five-minute break could
  quietly save an unfinished long export. Encoder finalization has a separate
  bounded wait. This long-duration condition is code-reviewed, not soak-tested.

## Adversarial browser checks

`qa/export-reliability-e2e.mjs` uses the running app and its native export engine:

1. Cancel during recording; no partial download, tracks ended, settings restored.
2. Concurrent second call rejected while first remains owned by its caller.
3. Injected real MediaRecorder error event rejected and cleaned up.
4. Interrupted playback rejected instead of producing a partial success.
5. Fake recorder with normal stop but no data rejected as an empty file.
6. Normal pointer click on the actual Cancel control; cancellation status visible.
7. Six successive two-second exports from real footage: three automatic MP4 and
   three WebM. Every file decoded fully with the repository's pinned FFmpeg.
   The last WebM export uses the actual menu action rather than a direct API call.
8. Project replacement mid-export rejected, preserving the replacement project's
   Medium quality, 1.5× speed and empty clip state; capture tracks ended.

The initial harness shortened a clip without recomputing duration, leaving a
trailing gap. Final runs explicitly recompute it, so the evidence is a two-second
sequence. The first Cancel test failed on the covered panel; the test was not
force-clicked or weakened. Screenshot inspection confirmed the raised panel.

48 unit scripts, 14 browser smoke flows, typecheck, source lint and production
build pass. Lint retains 278 nonblocking heuristic findings; the existing large
bundle warning remains. Tests prove these scoped workflows, not every export
codec, desktop build or arbitrary-duration project. The fault tests are synthetic;
the six MP4/WebM recordings use the native browser encoder and real footage.

## The retained MP4 failure

The previously retained `seek-ready-review/demo-failed/coast-edit.mp4` is not
established as corrupt. The pinned older FFmpeg rejects its header, but system
FFmpeg **7.1.5** fully decodes it with `-xerror`, original time base and no errors.
A supplemental probe finds 1280×720 H.264 video plus Opus audio, duration 6.1322 s.
An extracted frame was visually inspected and shows the expected BREATHE title.

This narrows the issue to decoder/container compatibility. The supplemental system
decoder was diagnostic; all new export acceptance checks still use pinned FFmpeg.
The exact older-parser failure and support across external players remain open.
WebM is an explicit alternative, not an automatic retry or a claim that MP4 is fixed.

## Remaining checks

Long-duration recording and finalization timeout fault injection, background-tab
suspension, audible A/V drift, arbitrary container/player compatibility and native
OS exports remain unverified. Initial seek-to-first-recorded-frame synchronization
also needs frame-level review. Next inspect MP4 fragment/audio metadata against
the older parser and run sustained A/V tests; preserve both success and failure
artifacts. This update improves reliability/control; it claims no speed gain.

Evidence: `qa-output/export-reliability/` contains six native recordings, the
failure/replacement report, cancellation screenshot and retained-file decoder
comparison. Rerun with Vite on port 5183:

```sh
node qa/export-reliability-e2e.mjs
```
