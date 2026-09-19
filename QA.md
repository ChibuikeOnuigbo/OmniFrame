# QA

## Automated gates

Run from the repository root:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run license:audit
git diff --check
npm run qa:http
python scripts/qa-structure.py
python scripts/qa-images.py qa/images --allow-empty  # add licensed/local references when available
npm run qa:capture                         # requires a browser executable
npm run test:e2e
python modeltrainer.py predict --model models/editor-assist/model.json --text "make this sequence portrait"
```

Latest local results on 2026-09-19:

- `npm run typecheck` passed for the web and engine TypeScript projects after the layer/model-runtime additions.
- `npm test` passed: 7 files, 124 tests, including vector rotation, affine inversion, affine fitting and homography tests.
- `npm run build` passed with Vite; generated assets include the expected ORT WASM, Three.js and muxer bundles.
- `npm run license:audit` passed: 299 lockfile entries reviewed. Its review notices for CC-BY-4.0 `caniuse-lite` and MPL-2.0 `lightningcss` remain dependency-policy review items, not shipped model entries.
- `git diff --check` passed.
- Playwright request-context inspection passed against a production preview: HTTP 200, HTML content type, React root and stylesheet were present. It deliberately does not claim a browser render.
- BeautifulSoup source/HTML inspection covers application menus, status bar, aspect presets, mask scopes, Krita modifiers, the Layers compositing view, model runtime contract and responsive CSS breakpoints.
- OpenCV tooling can measure references and compare screenshots using pixel error, edge overlap, crop dimensions and vector/corner points. Generated output belongs under `qa/measurements/`.
- `modeltrainer.py` trained the reproducible editor-assist baseline for exactly 1009 finite passes and exported a checked ONNX graph with optional `numpy`/`onnx` dependencies. The baseline is intentionally an inspectable linear model, not a claimed transformer or general intelligence.

## Browser and desktop coverage

`npm run test:e2e` now contains four Playwright tests for landing overflow/entry, editor shortcuts/command palette, mask/tracking controls, and Layers/menu/aspect controls. `npm run qa:capture` captures landing/editor screenshots at 1440, 1280, 1024, 760 and 390 widths plus 16:9, 1:1, 9:16 and 4:5 editor states, then records DOM panel bounds. Both require a browser executable.

The sandbox still lacks the Playwright Chromium headless-shell executable; its CDN installation previously failed with `ECONNRESET`. The capture script writes `qa/captures/browser-launch-error.json` and exits clearly instead of claiming screenshots. No visual screenshot, browser runtime, media fixture or desktop-WebView result is represented as passing until an executable is available.

Required browser/desktop pass once the environment provides a browser:

- landing and editor routes;
- no page-level horizontal overflow at desktop, tablet, narrow and mobile widths;
- import video/audio/image through the local file input;
- play/pause/frame step/blade/ripple/undo/save;
- `THIS FRAME`, `RANGE`, `ALL FRAMES` mask controls;
- mask tracking classical path and explicit SAM2 fallback message;
- Layers stack selection, visibility, lock, blend mode, opacity and adjustment-layer mutation;
- Omniframe operation progress/cancel/error state;
- 3D inspector environment/bake action;
- command palette, application menus, status bar, dialogs and export progress;
- 16:9, 1:1, 9:16 portrait and 4:5 canvas composition;
- screenshot review for clipping, overlap, dead controls, low-contrast labels and accidental horizontal overflow;
- native filesystem, job cancellation, relink, FFmpeg, optional ONNX model resource and Tauri capability paths.

## Information-architecture and measurement record

The editor keeps the professional arrangement: media/asset access on the left, viewer and transport above a dominant multi-track timeline, contextual inspector on the right, and a compact status row below the work area. The top application chrome exposes File, Edit, View, Workspace and Help menus, a canvas aspect selector and explicit local/native status. Menu commands call existing project/editor actions rather than acting as decorative labels.

The new Layers workspace is a compositing view over real timeline tracks, not a second fake timeline. It supports:

- top-to-bottom track stack ordering;
- track selection, visibility and lock state;
- video, graphics, audio, text, 3D and adjustment-layer identities;
- selected-clip opacity and persisted blend modes including Normal, Multiply, Screen, Overlay, Soft Light, Hard Light, Difference, Add and Subtract;
- actual effects, masks and animated-channel counts from the selected clip;
- real video/graphics/adjustment track creation through the existing store/history path.

The CSS layout tokens are intentionally reviewable without inventing runtime pixels:

- desktop editor grid: `82px minmax(440px, 1fr) 300px`;
- top bar: 54px;
- status bar: minimum 25px;
- tablet breakpoint: 1100px, hiding optional menu/aspect chrome before the timeline collapses;
- narrow breakpoint: 760px, two-column editor with an inspector drawer and compact status row.

Reference screenshots are comparative research, not product assets. OpenCV measurements are evidence for density and separator patterns, not claims that OmniFrame has been visually validated. The conclusions remain consistent with `research/ui.md`: retain the media/project left zone, source/program viewer area, contextual effects/inspector and dominant timeline, while keeping technical runtimes and model controls behind Advanced.

## Timer and model boundaries

`timer.py` is a bounded supervisor, not an agent-control mechanism. Its default is a ten-hour maximum and 1009 finite observation passes, but it remains `needs_review` until explicit gates pass, a completion JSON file says `{"complete": true}`, and the research queue has no open items. A 100k line count can be reported as a user-supplied observation threshold, but code volume is never treated as quality or completion.

`modeltrainer.py` accepts explicit local JSONL examples, runs a finite supervised pass budget, optionally applies explicit reward feedback, packages a portable ONNX/JSON bundle and can serve predictions on loopback. It does not scrape arbitrary sites, submit remote forms, upload footage, collect credentials or pretend that a small classifier is a foundation model. YouTube research is metadata-only by default through `scripts/youtube-research.py`; yt-dlp lookup was attempted in this sandbox and failed due TLS/SSL EOF, so `research/youtube-features.json` records a web-search fallback without bundling videos.
