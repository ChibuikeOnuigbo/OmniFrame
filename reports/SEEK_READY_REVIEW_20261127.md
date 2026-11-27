# Paused seek scheduling — 27 November 2026

The paused preview retained old pixels until the next 250 ms polling tick even
when decoding had already completed. Active video `seeked` and `loadeddata`
events now invalidate the paused frame so the next animation frame can commit
it. Playback retains its existing frame cap. Thumbnail/inactive decoder events
are ignored, and event listeners are removed on engine disposal. The 4 Hz idle
heartbeat remains as a fallback for other asynchronous resources.

## Matched fixture measurements

Eight forward/backward seeks per run, same 8-second Pexels fixture, 640×360
sequence, Full quality, software Chromium, Vite development server. Performance
runs finished before the unit/build/browser suites began.

| Median time | Before | After | Repeat |
|---|---:|---:|---:|
| Decoder ready | 112.2 ms | 118.8 ms | 125.3 ms |
| Decoder ready → canvas commit | 159.9 ms | 23.1 ms | 14.9 ms |
| Seek request → canvas commit | 267.8 ms | 140.7 ms | 143.7 ms |

All eight after-change ready-to-commit waits were 12–27 ms; the repeat was 5–21 ms.
The decoder itself was not accelerated. These are canvas `drawImage` commits,
not compositor presentation or unique displayed-frame counts. Host variability,
one source, small sequence and short runs limit generalization.

The new test instruments the actual program canvas and decoder completion events,
asserts a generous 100 ms median ready-to-commit budget, and confirms four idle
commits in 1.1 seconds even while an unrelated video emits completion events at
100 Hz. Its initial harness mistakenly assumed the media host already existed;
listening in document capture phase fixes that setup race. Production listeners
remain scoped to the media host and active decoded videos.

## Validation

Before the toolbar follow-up, 48 unit scripts, 14 browser smoke flows, typecheck,
lint and production build passed. Static/build gates and focused browser checks
were repeated for the toolbar; the final step-size-only fix passed the focused checks. Shared source-clock proof passed all 15 curves, 120 pixel comparisons and
15 actual moving-video exports. Browser gates include timeline, project lifecycle,
MCP, context menus, compound filmstrips, masks, 3D and sculpting. Separate 100-clip
revisit, rapid-seek and project-reset stress passed; those assets reuse one source.
The first edited-video export failed FFmpeg MP4 header parsing. Its bytes and
failure logs are retained under `demo-failed/`. A fresh-server repeat passed full
native export decoding and project reopening (6.145 s export; 220 ms decoder-ready
seek wait). The intermittent failure's root cause is not established; do not treat
the successful retry as a fix. The workspace interruption coincided with this
work, but causation is unproven.
Screenshots were inspected for visible media and settled preview state.

Source lint retains 277 nonblocking heuristic findings. The production build
retains its large-chunk warning. No suppression was added. Existing historical
artifacts were restored after regression tests; new evidence is isolated under
`qa-output/seek-ready-review/`.

## Remaining work and rating

Overall speed remains **6/10 provisional**; the narrow paused-seek delay improved.
Remaining: diverse long-GOP media, sustained A/V sync, precise physical presentation,
4K/GPU/native desktop, larger projects and matched competitor benchmarks. The
100 ms test threshold is a cloud regression budget, not a product latency SLA.
Next reproduce and diagnose the retained MP4 header failure, then profile cold-source decode and proxy readiness with representative real
camera media. Avoid trading away complete-frame composition for apparent speed.

Rerun with Vite on 5183:

```sh
OUT=/tmp/seek-review node qa/seek-ready-e2e.mjs
```

Raw baseline, after and repeat JSON plus screenshots are in the evidence folder.
The demo-repeat subfolder contains the successful export, portable project and report.

## Preview toolbar follow-up

Grouped Safe Areas and Grid together, removed the misleading fit tick, and made
the percentage editable. Enter commits, Escape cancels, empty input restores the
current value, and values clamp to 25–200%. Unchanged focus/blur preserves Fit.
Slider and numeric input both use 1% steps; the browser test caught and corrected
the original slider's 5% rounding. Mobile retains the compact guides; precise
zoom controls retain their existing desktop-only visibility.

Focused toolbar coverage checks 133%, both bounds, repeated out-of-range input,
empty input, cancellation in Fit mode, and 3D/mobile layout. Context-menu and MCP
checks rerun for the UI change. Screenshots: `qa-output/seek-ready-review/toolbar/`.
The rest of the app has not been comprehensively reorganized in this change.
