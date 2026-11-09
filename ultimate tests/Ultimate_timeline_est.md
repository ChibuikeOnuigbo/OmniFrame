# Ultimate timeline test ledger — 2026-11-09

## Executed counts and meaning

`node qa/ultimate-timeline-matrix.mjs` executed **20,000,000 numeric seek-boundary cases**, with zero failures. They enumerate 200 durations × 100 starting offsets × 1,000 pointer positions. Each case checks finite clamping, legal timeline bounds and identity inside the range. The complete reproducible list is defined by these three loops in the test, rather than twenty million duplicated Markdown lines. Results: `numeric-matrix.json`.

This is **not 20 million independent UI tests**. It does not certify all compound, rendering, decoder or editing scenarios. Browser and render checks below are separate evidence.

## Interaction contract

- During playback, dragging the ruler holds the timeline clock and decoded media; releasing resumes the existing playback intent. Paused scrubbing stays paused.
- Empty-lane primary click seeks; right-click opens commands without seeking.
- The 3px playhead sits at z-index 80 above clip, effect, transition, marker and drag overlays within the timeline. It turns amber when aligned to a marker.
- Ruler density moves from clock labels to frames to millisecond labels. Frame rate remains the media's temporal resolution; finer ruler coordinates do not create new video frames.
- Marker finder searches names, notes, kind and host clip. Navigation resolves the current clip-relative marker position.
- Ripple delete removes the chosen clip and shifts following clips on that track. Existing compound/render tests below retain their stated scope.

## Executed UI checks

`qa/square-preview-e2e.mjs`: square shape; 305,000 loaded count; one-click non-mutating audition; pointer scrub to 75%; release clears scrubbing; Add insertion at current playhead; double-click adds one more layer; millisecond ruler mode; 3px/z80 playhead; named-marker search and jump; transition preview and commit. Screenshots and report: `qa-output/square-preview/`.

`qa/context-menu-viewport-e2e.mjs`: measured short/mobile/desktop menu bounds, scrolling, keyboard navigation and dismissal.

`qa/mcp-live-bridge-e2e.mjs`: undo, mask defaults, source clock, keyframes, invalid inputs, bundle persistence and timeline capture.

## Executed rendering checks

- `qa/compound-source-clock-unit.mjs`: nonzero compound creation, nested hold clock, retimed ungroup rejection in headless tools and moved ungroup timing.
- `qa/fx-split-continuity-unit.mjs`: split keys, source clock, left/right pixels, NG and action phase.
- `qa/mcp-project-reset-unit.mjs`: clears selections, compound navigation and decoded frame ownership.
- `qa/smart-patch-compositor-unit.mjs`: target pixels, outside region and alpha preservation.

## Remaining audit coverage

A complete browser compound decomposition audit, every split/retime combination, long media decoder latency measurements, all-native desktop checks and deletion of all clips during playback remain open. The numerical loop does not cover these cases. No zero-latency playback or universal bug-free claim is made.
