# QA

## Automated gates

Run from the repository root:

```bash
npm run typecheck
npm test
npm run build
npm run license:audit
git diff --check
npm run qa:http
python scripts/qa-structure.py
python scripts/qa-images.py image-search
npm run test:e2e
```

Latest local results on 2026-09-19:

- `npm run typecheck` passed for the web and engine TypeScript projects.
- `npm test` passed: 6 files, 120 tests.
- `npm run build` passed with Vite; the largest generated assets are the expected ORT WASM, Three.js and muxer bundles.
- `npm run license:audit` passed: 299 lockfile entries reviewed. Its review notices for CC-BY-4.0 `caniuse-lite` and MPL-2.0 `lightningcss` remain dependency-policy review items, not shipped model entries.
- `git diff --check` passed.
- Playwright request-context inspection passed against the production preview on port 4174: HTTP 200, HTML content type, React root and stylesheet were present. It deliberately does not claim a browser render.
- BeautifulSoup source/HTML inspection passed for application menus, the status bar, aspect presets, mask scopes, Krita modifiers and responsive CSS breakpoints.
- OpenCV measurement completed for all three collected editor references. It reports image dimensions, aspect ratio, dark-pixel ratio, edge density and candidate separator coordinates in `/tmp/omniframe-qa/image-measurements.json`:

  | reference | dimensions | aspect | dark pixels (<48) | edge density |
  | --- | ---: | ---: | ---: | ---: |
  | editor reference 1 | 825×451 | 1.829 | 0.403 | 0.165 |
  | editor reference 2 | 309×197 | 1.569 | 0.553 | 0.144 |
  | editor reference 3 | 600×375 | 1.600 | 0.647 | 0.055 |

## Browser and desktop coverage

`npm run test:e2e` contains three Playwright tests for landing overflow/entry, editor shortcuts/command palette and mask/tracking controls. The isolated production server now builds before preview and starts correctly, but browser launch is blocked in this sandbox: the Playwright Chromium headless-shell executable is absent and CDN installation failed with `ECONNRESET`. No visual screenshot, browser runtime, media fixture or desktop-WebView result is represented as passing until an executable is available.

Required browser/desktop pass once the environment provides a browser:

- landing and editor routes;
- no page-level horizontal overflow at desktop, tablet and mobile widths;
- import video/audio/image through the local file input;
- play/pause/frame step/blade/ripple/undo/save;
- `THIS FRAME`, `RANGE`, `ALL FRAMES` mask controls;
- mask tracking classical path and explicit SAM2 fallback message;
- Omniframe operation progress/cancel/error state;
- 3D inspector environment/bake action;
- command palette, application menus, status bar, dialogs and export progress;
- 16:9, 1:1, 9:16 portrait and 4:5 canvas composition;
- screenshot review for clipping, overlap, dead controls, low-contrast labels and accidental horizontal overflow;
- native filesystem, job cancellation, relink, FFmpeg and Tauri capability paths.

## Information-architecture and measurement record

The editor keeps the established professional arrangement: media/asset access on the left, viewer and transport above a dominant multi-track timeline, contextual inspector on the right, and a compact status row below the work area. The top application chrome now exposes File, Edit, View, Workspace and Help menus, a canvas aspect selector and explicit local/native status. Menu commands call existing project/editor actions rather than acting as decorative labels.

The CSS layout tokens are intentionally reviewable without inventing runtime pixels:

- desktop editor grid: `82px minmax(440px, 1fr) 300px`;
- top bar: 54px;
- status bar: minimum 25px;
- tablet breakpoint: 1100px, hiding optional menu/aspect chrome before the timeline collapses;
- narrow breakpoint: 760px, two-column editor with an inspector drawer and compact status row.

Reference screenshots were collected only for comparative layout research and are not product assets. OpenCV measurements are evidence for density and separator patterns, not claims that OmniFrame has been visually validated. The conclusions are consistent with the research record in `research/ui.md`: retain the media/project left zone, source/program viewer area, contextual effects/inspector and dominant timeline, while keeping technical runtimes and model controls behind Advanced.
