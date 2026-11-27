# Export cleanup review — 27 November 2026

## Reproduced and fixed

A native recorder wrapper that calls stop and then throws demonstrated an actual
recovery defect: cancellation left playing=true, quality=full and speed=1 instead
of the previous low/2 settings. The secondary failure replaced AbortError.
`qa-output/export-cleanup/before.json` records that failing baseline.

The new shared cleanup helper attempts each independent action before propagating
the first failure. Export always attempts recorder, all tracks, audio destination,
3D session and editor-state restoration. A primary export error is preserved;
secondary cleanup failures are logged. A successful operation with a cleanup
failure still reports that failure. New projects keep their own settings.

Audio destinations now have idempotent disposal. If connecting the destination or
attaching its track fails, the allocated tracks are still stopped. This fixes
resource ownership gaps without changing playback clocks or render algorithms.

## Verification

- 51 unit scripts passed, including failure at each of eight cleanup positions,
  multiple failures and JavaScript's unusual `throw undefined` case.
- Nine live browser cases passed: recorder stop, track stop, audio disconnect,
  track attachment, status callback, project replacement, canvas capture,
  audio connection, and normal cancellation. No partial downloads or page errors.
- Injected teardown errors call native release first and then throw; these tests
  prove continued cleanup/state recovery, not recovery of a broken graphics driver.
- Repeated audio disposal passes; stereo RMS/peak, detach and reconnection pass.
  The first audio command targeted inactive port 5173; rerunning with the actual
  Vite port 5183 passed. This was a test invocation error, not an app defect.
- Six successive native MP4/WebM exports decode with pinned FFmpeg; explicit
  four-second range measures 4.08 seconds. Earlier MP4 compatibility concerns
  are not declared resolved by this run.
- Clean 1280×720 and 720×1280 3D exports decode; grid exclusion, viewport
  preservation, cancellation, disposal and unmount checks pass.

Typecheck, source lint and final production build passed. The source scan reports
277 nonblocking findings; the large-chunk build warning remains.

## Limits and next pass

This is a reliability improvement, not a measured speedup. Overall browser rating
remains 6/10. The existing broad ratings still apply. First-frame synchronization,
long-duration/background recording and A/V drift need further testing. GPU/4K,
complex scenes and native platform acceptance remain open. Source scan findings
are hints rather than proof that all affected behavior is wrong; no claim that
all repository issues are fixed.

Next: use distinct initial/target video frames and nonzero export ranges to check
first encoded frame correctness before changing capture startup ordering.
