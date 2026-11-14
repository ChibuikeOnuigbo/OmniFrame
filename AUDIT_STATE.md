# OmniFrame adversarial audit state

## Cycle 9 — preview lifetime and source-scan accuracy

- Fixed: a physical pointer click generated duplicate cursor bursts because both
  pointer and compatibility mouse events were handled. The cursor now chooses
  one event family, keeps each burst at its click position during movement, and
  clears its timers on unmount. The live browser check verifies one burst, its
  fixed position, and expiry.
- Fixed: filmstrip retries now clear on cleanup, recover from rejected or empty
  renders, and omit broken image tiles after retry exhaustion. The filmstrip
  browser test starts with an empty project, requires both imported assets and
  checks the image clip before entering a compound sequence; all 14 assertions
  pass. Added both browser cases to the repeatable smoke runner.
- Scan: replaced a 16-line JSX-key lookahead with TypeScript AST inspection of
  JSX returned from `.map()` callbacks. Its two reported cases were data maps,
  so the current scan reports 281 findings: 173 color literals, 65 non-null
  assertions, 29 timer heuristics, nine console calls, four large handlers and
  one TODO. The scanner remains heuristic and does not prove every rendered
  list has a stable key.
- Gates: 35 unit scripts, nine browser smoke flows, lint, typecheck and build
  passed. The browser suite includes context-menu and live MCP checks. The
  build still warns about the large main chunk.
- Remaining: timer findings include intentional promise delays and handlers
  needing case-by-case review. `BackgroundRemovalModal` still has simulated
  progress and an apply action that changes only the clip name; that workflow
  needs a separate functional acceptance pass. Native builds and broad browser
  coverage are unverified.
- Next pass: replace the background-removal placeholder with a genuine clip
  processing path or remove its misleading success flow, then verify preview,
  export and undo. Triage high-impact timers and profile main-bundle startup
  before changing its split points. Preserve generated media and audit output.

This log records bounded evidence. At the start, the repository had 34
`qa/*-unit.mjs` scripts after the first new adversarial case and 136
`qa/*-e2e.mjs` scripts, with no aggregate `test` or `lint` npm script. The
current inventory and gates are recorded in Cycle 8. A passing subset is
never labeled a full suite.

## Cycle 1 — mask bounds and test inventory

- Fixed: `effectMaskFeatherBounds` now returns a safe full-frame rectangle for an
  empty region list or non-finite geometry and Bezier handles. The new
  `qa/effect-mask-bounds-adversarial-unit.mjs` failed before the fix and passed
  after it. Typecheck and build passed.
- Scan: a repository-wide code-pattern search found 20 source files containing
  `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `as any`, or empty `catch` patterns.
  `src/lib/demucs/apply.js` still has a random-shifts TODO. Vite reports
  ineffective dynamic imports for model and DSP modules.
- Remaining: `npm run lint` fails because no lint script or ESLint installation
  exists. The first broad unit run exposed subprocess sandbox errors in the
  compound-clock and text-crop tests and a missing `actionFx` module in the
  scene-recreation test. Browser end-to-end scripts remain unrun in this cycle.
- Next pass: finish collecting the broad unit run, rerun subprocess cases with
  supported sandbox access, inspect the scene-recreation loader, and establish
  a repeatable static lint gate without mislabeling typecheck as lint.

## Cycle 2 — test loader and source lint gate

- Fixed: `qa/scene-recreation-unit.mjs` now uses the shared TypeScript module
  loader, so newly imported `actionFx` is included. The test passes all 27
  scene styles at seven progress samples. Added `npm run lint` using the existing
  source scanner; the scanner now reads each file once and has `--no-write` and
  `--fail-on-high` modes. The broad unit run passed all 34 scripts with subprocess
  permission. Typecheck, build, lint, and the live mask, context menu, and MCP
  browser checks passed.
- Scan: the repo-wide pattern count remains 20 code files. The source scanner
  still reports 285 non-high findings: 173 hardcoded UI colors, 65 non-null
  assertions, 31 timers without a clear partner, nine debug calls, four large
  inline handlers, two possible missing JSX keys, and one TODO.
- Remaining: the lightweight scanner is not ESLint and does not cover control
  flow or type-aware rules. The 136 browser end-to-end scripts have no aggregate
  runner; only three targeted flows ran. Vite still warns about ineffective
  dynamic imports. The `demucs/apply.js` random-shifts TODO remains.
- Next pass: attack non-finite feather tint/offset input, check preview/export
  parity, then rerun the unit inventory, lint, typecheck, build and targeted
  browser gates. Keep source-scan findings visible rather than calling them clean.

## Cycle 3 — overflow and offscreen mask geometry

- Fixed: the bounds helper now detects arithmetic overflow after scaling finite
  values to pixels. Fully offscreen shapes use a safe full-frame fallback instead
  of returning coordinates beyond the canvas. New adversarial cases failed
  before the fix and passed after it. All 34 unit scripts, typecheck, build,
  source lint and live mask editing passed.
- Scan: the repo-wide hint count remains 20 files. The scanner still reports
  285 non-high findings and the build still emits dynamic-import warnings.
- Remaining: no real-time 4K guarantee; full-frame fallback for malformed or
  offscreen geometry sacrifices performance to keep reads in bounds. Browser
  export of these malformed values is not separately exercised. The source
  scanner misses bare `catch {}` blocks, including ones in production code.
- Next pass: inspect bare catches for swallowed render failures, teach the
  scanner to flag them, and resolve actionable production cases. Repeat all
  34 units, lint, typecheck, build and a live editor gate.

## Cycle 4 — swallowed exceptions and portable QA roots

- Fixed: source lint now treats truly empty bare catches as high severity; it
  initially failed on five production cases. Three 3D pointer handlers now
  release capture only when held; two workspace-storage catches document the
  in-memory fallback. A 3D integration test exposed a hardcoded old checkout
  path. Replaced that root in 28 QA scripts with a path derived from each
  script's URL, plus one direct model path. All 28 parse. The live 3D test now
  reaches its final visual proof; all 34 units, lint, typecheck and build pass.
- Scan: repo-wide hint files dropped from 20 to 19. The source lint still has
  285 non-high findings. QA scripts still contain 167 hardcoded localhost:5173
  URLs, so many cannot target a server on another port. The 3D test was made
  configurable and passed against port 5174.
- Remaining: browser integration coverage is still sampled rather than all
  136 scripts. A comment-only storage catch still means persistence can fail
  silently, though the current-session workspace remains usable. Existing build
  chunk/dynamic-import warnings and the Demucs TODO remain.
- Next pass: make browser test URLs configurable where they are hardcoded,
  verify script syntax and run representative flows on port 5174. Repeat the
  unit suite and static gates; preserve existing media and restore only outputs
  regenerated by this audit.

## Cycle 5 — browser server portability

- Fixed: `qa/browser-url-portability-unit.mjs` exposed 54 direct navigations
  that ignored the configured dev-server URL. All now honor `process.env.URL`.
  Every QA `.mjs` file parses, and the animation-entry browser flow passed on
  port 5174. All 35 unit scripts, source lint, typecheck and build passed.
- Scan: 19 code files still match the repo-wide hint search. The source scanner
  still has 285 non-high findings. Most remaining `localhost:5173` strings are
  configurable defaults or comments rather than fixed navigation calls.
- Remaining: the 136 browser scripts are still not all executed. The build's
  dynamic-import/chunk warnings remain. QA scripts with `TEST_URL` instead of
  `URL` use a second convention; a single browser-smoke runner does not exist.
- Next pass: create and run a curated browser smoke gate on the alternate port,
  fix failures it exposes, then repeat the unit/static gates. Inspect generated
  artifacts before any commit so QA runs do not overwrite published evidence.

## Cycle 6 — duplicate keyboard handlers

- Fixed: a new seven-flow browser smoke runner caught a real duplicate shortcut
  bug. Studio and Timeline both handled Ctrl+D, producing two copies; copy,
  cut and paste also had two owners. Removed Timeline's extra global clipboard
  listener and made the timeline test start a fresh project and assert exactly
  one duplicate per keypress. That test now passes 17 checks, including snapping
  and scrub playback. The seven-flow browser smoke, all 35 units, lint,
  typecheck and build pass.
- Scan: 19 source files still match the repository-wide hint search; the
  source scanner still reports 285 non-high findings. Build warnings about
  ineffective dynamic imports and a large chunk persist.
- Remaining: global shortcut conflicts outside the exercised chords still need
  review; the smoke runner covers seven of 136 browser scripts. Full desktop
  and hardware performance checks remain open.
- Next pass: remove the two ineffective dynamic imports in `vad.ts` without
  changing resampling behavior, test the audio path, rerun the unit/browser
  suites and static gates, and check build warning output explicitly.

## Cycle 7 — VAD resampling imports

- Fixed: `vad.ts` now imports the resampler and native DSP wrapper directly;
  both were already static elsewhere, so its dynamic imports created no lazy
  chunk. A new browser test measured a 1.25× rendered audio buffer and checked
  finite, audible samples before and after the change. Both related Vite
  ineffective-import warnings disappeared. All 35 units, seven browser smoke
  flows, lint, typecheck and build passed.
- Scan: 19 code files match the broad hint search and source lint still
  reports 285 non-high findings. The build still warns about a dynamic import
  of `modelLoadStore.ts` and the large main chunk.
- Remaining: the new browser audio check proves one short mono speed case, not
  every sample rate, stereo path or native/JS fallback. Model-load and bundle
  warnings remain; full 136-flow browser coverage remains open.
- Next pass: resolve the model-load import warning without breaking progress
  UI, run all static/unit/browser gates again, audit generated changes, and
  record the remaining bundle/performance risks for the next audit session.

## Cycle 8 — model progress ordering and final gates

- Fixed: the shared model-load store was dynamically imported in four modules
  despite already being static in the main graph. All use direct imports now.
  Demucs worker progress updates are synchronous, so `begin` cannot be overtaken
  by a later `bytes` message while awaiting an import. Vite's ineffective
  dynamic-import warning is gone. All 35 units, seven browser smoke flows,
  typecheck, build and source lint passed. The 1.25× VAD render test passed;
  Demucs unavailable/recovery passed six checks.
- Scan: `qa/reports/source-scan.json` enumerates all 285 current source-scan
  findings with file and line. `reports/audit-remaining-hints.txt` enumerates
  26 matches for TODO, weak typing and empty catches across source and QA. The
  repo-wide matching-file count is 19.
- Remaining: 173 UI-color literals, 65 non-null assertions, 31 unpaired-timer
  heuristics, nine debug calls, four large inline handlers, two possible JSX
  key omissions and one Demucs random-shifts TODO remain unreviewed or unfixed.
  The build still warns that the main chunk is large; it was not suppressed.
  The lightweight source lint is not type-aware ESLint. Only seven of 137
  browser end-to-end scripts form the repeatable smoke gate. Native desktop
  builds, model-training claims and real-time 4K playback were not established
  by these eight passes.
- Next audit pass: triage the 285 findings by actual user impact, starting with
  the two possible missing JSX keys, then timer cleanup and the main bundle's
  load profile. Run the relevant browser tests after each fix. Expand the smoke
  gate carefully, with test fixtures and time limits, before claiming full
  browser coverage. Review desktop packaging and hardware performance on each
  supported OS separately. Preserve all user media and keep generated test
  output out of code commits.
