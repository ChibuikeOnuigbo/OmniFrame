# Timeline geometry test evidence

Executed in headless Chromium against the real Vite application with imported WebM fixture.

- Ruler suite: **34 PASS**, zero runtime errors.
- Context/visibility/settings suite: **45 PASS**, zero runtime errors.
- Clip widths at 40, 160, 640, 2400 px/s: 320.109, 1280.469, 5121.906, 19207.188 CSS px.
- Pointer-anchored wheel zoom: 2.0840 s before, 2.0839 s after.
- Label overlap: PASS at all four sampled scales.
- Tick monotonicity/density: PASS at all four sampled scales.
- Frame ticks: increasing at all nine supported project rates.

Machine-readable evidence: `qa/reports/timeline-ruler-results.json` and `qa/reports/context-menu-results.json`.

Not executed here: browser zoom 200%, Firefox, native desktop windows, multi-hour projects, and 1000-clip performance profiling. These remain SKIPPED, not PASS.
