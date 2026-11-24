# Editor reference study and nested effects

Updated 2026-11-24. This is a source inventory plus a tested implementation increment. It is **not** a claim that every reference effect has been ported, every tutorial watched, or every desktop platform validated.

## What changed in OmniFrame

Effects now have stable group paths. Choose a category, open a subgroup, then continue to a more specific group. Breadcrumbs and the back arrow move up a level. Each parent includes its descendants; search stays within the selected group and collection. Group labels also act as searchable tags. Favorites retain their existing IDs. Square photographic previews, single-click audition, scrubbing, double-click/+ placement and drag-to-clip remain available.

Examples:

- Blur → Shape Blur → Box / Gaussian / Lens Bokeh / Fractal.
- Blur → Motion → Directional / Zoom / Trails; Blur → Focus → Tilt Shift.
- Color → Selective → Color Hold; Color → Channels → Channel Mixer.
- Key & Matte → Chroma → Despill → Green / Blue.
- Key & Matte → Luminance → Range / Threshold.
- Distort → Warp → Liquify / Turbulence; Distort → Repeat.
- Motion → Transform → Card Flip; Burst → Fracture → Glass / Crack / Shatter / Tiles / Slice.
- Glitch → Displacement → Slice / Blocks / Pixel Sort / Datamosh / Signal Tear.
- Glitch NG → Digital, Signal, Motion or Graphic → recipe family.

The generated recipe bank stays lazy. Whole-family searches and folder paging compute counts and offsets from family indexes instead of constructing or scanning every recipe. Numeric descriptor/ID searches still scan the bounded index. Generated combinations have a stable primary group; burst combinations are under Mixed. These are parameter variations, not hundreds of thousands of independent effect engines. Counts come from the catalog; fixed “300K+” UI badges were removed.

The Essentials collection exposes existing fundamentals and eight new presets backed by five original implementations:

| Operation | Controls and behavior | Implementation |
| --- | --- | --- |
| Box Blur | Separable square kernel, radius 0–64 px, clamped edges, premultiplied alpha | `src/lib/boxBlur.ts` |
| Color Hold | Keep color, RGB similarity, softness, amount; other colors become luminance gray | `src/lib/selectionGrade.ts` |
| Luma Range / Midtone Matte | Low/high bounds, feather, invert, amount; multiplies existing alpha | Same shared pixel module |
| Despill Green / Blue | Channel, amount, balance, luminance compensation | Same shared pixel module |
| Channel Mixer / Channel Swap | Nine signed RGB coefficients and mix amount | Same shared pixel module |

The same pixel path is used by browser preview/export and the headless compositor. Native adjustment layers show schema-based controls with Undo. Effects dropped onto image/video/compound clips use the existing FX Stack, including numeric keyframes. Native adjustment-layer numeric properties now have diamonds, previous/next, auto-keyed sliders, freeze and reset. Their source clock survives cuts/trims/extensions and project/template persistence. Easing graphs and animated color/string controls remain open. Existing projects are not migrated or renamed.

Animation mode now provides Trim Path for visible freehand strokes on the active paint layer: Start, End, Offset, key buttons, reset and stroke selection. Trimming follows arc length, interpolates pressure/timestamps, and wraps into disjoint segments without drawing a bridge. Keys use project seconds and linear interpolation; once a field is keyed, changing its slider edits that frame. Draw On, onion ghosts, Undo and `.omni` save/reopen honor trim. This is not yet Bezier-shape Trim Path, a trim graph editor, a full Glaxnimate modifier stack or Lottie import/export inside OmniFrame.

The browser test also exposed an existing compositor bug: reusable padded/plain canvases kept obsolete dimensions after a project or preview resize. Acquiring a pooled surface now resizes it before rendering; masked areas no longer disappear after switching resolutions.

## Reference evidence

| Source | Actual work | Artifact |
| --- | --- | --- |
| [Kdenlive manual](https://docs.kdenlive.org/en/effects_and_filters.html) | Indexed 303 pages: 275 effect pages and 28 category/index pages, zero fetch errors. Read selected color/key/blur parameter documentation. | `kdenlive-manual-index.json` |
| [Kdenlive source tree](https://github.com/KDE/kdenlive/tree/master/data/effects) | Indexed 457 XML paths at the recorded Git tree SHA. This is a different revision from the release package. | `kdenlive-source-effect-index.json` |
| [Kdenlive official download](https://kdenlive.org/download/) | Downloaded 26.08.3 x86-64 Linux AppImage, verified upstream SHA256, extracted locally, ran `--version`. Indexed 447 effect definitions from 433 XML files; 416 definitions expose parameter metadata. | `reference-downloads.json`, `kdenlive-installed-effects.json` |
| [Glaxnimate manual](https://docs.glaxnimate.org/en/) | Indexed 14 manual pages; studied shapes/modifiers, docks and supported formats. | `glaxnimate-manual-index.json` |
| [Glaxnimate official download](https://glaxnimate.org/download/) | Downloaded/verified 0.6.0 Linux AppImage. `--version` reports `0.6.0-git-d2da67a`. Its CLI exported an original SVG path to Lottie JSON and rendered a PNG. | `reference-downloads.json`, `glaxnimate-probe/` |
| [After Effects effect list](https://helpx.adobe.com/after-effects/desktop/apply-effects-and-animation-presets/effects-and-animation-presets/effect-list.html) | Indexed 290 names in 22 categories; reviewed the documented families and bit-depth/GPU distinctions. No Adobe installation or native plugin extraction. | `adobe-effect-index.json` |
| [CapCut desktop page](https://www.capcut.com/tools/desktop-video-editor) | Read official descriptions of effects, searching, keyframes/graphs, color tools, captions and supported platforms. Recorded official download links. Two older effect-resource URLs returned 404. No CapCut installation. | `capcut-product-index.json` |

Official proprietary download entry points: [CapCut](https://www.capcut.com/activity/download_pc), [After Effects trial](https://www.adobe.com/products/aftereffects/free-trial-download.html). Their native effects are not browser modules and are not bundled here. KDE binaries and complete HTML are local ignored reference material under `.cache/reference-apps/`; they are not part of the app installation or Git commit. No third-party native implementation was copied into the new pixel kernels.

Kdenlive and Glaxnimate manual material is credited to their documentation contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The title/control-name indexes in this folder are adapted metadata from those linked manuals; retain source links and attribution when reusing them. Installed Kdenlive metadata is recorded for comparison, with the official package/hash as provenance. The Glaxnimate probe path is original QA artwork. Existing photographic subject credits remain under `public/assets/effect-subjects/`.

## Capability mapping and remaining work

| Reference family | OmniFrame status | Remaining distinction |
| --- | --- | --- |
| Box/Gaussian/lens/directional/zoom blur | Box added; others already present and grouped | No assertion of Adobe/Kdenlive exact kernel or bit-depth parity |
| Color hold, luma selection, despill, channel mixing | Added with pixel and compositor checks | Despill is RGB math, not a Keylight-equivalent keyer; no ABI/HCI color-space keyer |
| Chroma key and mattes | Existing Chroma Key and effect-mask paths retained | Advanced edge replacement, spill maps and 32-bit HDR compositing remain open |
| Exposure, gamma, temperature, LUTs, gradients | Existing tools collected/grouped | Full color-management/scopes parity not established by this study |
| Turbulence, liquify, wave, repeat/kaleidoscope | Existing engines now grouped by operation | Arbitrary displacement-map sources and AE plugin parity remain open |
| Shake, oscillation, echo, card flip, explosions | Existing controls/recipes retained under subgroups | Similar names or numerous presets do not prove visual parity |
| Glaxnimate Trim Path | Added for freehand paths with linear keys and offset | Bezier vector paths, easing graphs and modifier chaining remain open |
| Glaxnimate repeater/offset/inflate/zigzag | Documentation indexed; some analogous editor repeat/deformation tools exist | No interoperable modifier stack or general Glaxnimate project import |
| Lottie/animated SVG/Rive | Official Glaxnimate CLI export probe succeeded | OmniFrame import/export round trip is not implemented here |
| CapCut graph editing, search and color controls | Existing editor features retained; catalog browsing improved | This study does not reproduce every CapCut tool/template |
| Optical flow, advanced tracking, HDR, GPU/multiframe processing | Reference names indexed | No new model, native-plugin host, performance parity or platform acceptance claim |

## Reproduce and verify

Run `python3 scripts/research-editor-capabilities.py` for manual/product indexes and `python3 scripts/fetch-editor-references.py` for verified official package downloads. Extract each verified AppImage with `--appimage-extract` inside its own ignored cache subdirectory, then run `python3 scripts/inspect-editor-references.py`. The source-tree inventory retains its exact tree SHA; do not equate that development revision with the release definition count.

`qa/editor-capabilities-unit.mjs` tests kernel identity, bad values, transparent pixels, a naive-vs-separable box convolution, group partitions/paging, trim wrap, key interpolation and onion ghosts. `qa/effect-recipe-bank-unit.mjs` now derives expected totals from the catalog rather than hardcoding an old recipe count.

`qa/editor-capabilities-e2e.mjs` exercises nested browsing, scoped tags, generated pages, non-destructive audition, placement, adjustment controls/Undo, 390px layout, masked/animated Program pixels after a resolution change, and grade/trim project round trips. It passed against both Vite development and production builds and is included in the repeatable browser smoke runner.

`qa/editor-capabilities-render.mjs` uses the shared headless renderer and `render_export`: [18-second proof](../../qa-output/editor-capabilities/effects-and-trim.mp4), [contact sheet](../../qa-output/editor-capabilities/contact-sheet.png), [report](../../qa-output/editor-capabilities/report.json). The exported proof has 216 decoded frames and 207 distinct frame hashes. Pixel tests separately assert masked Color Hold, luma alpha, despill and channel mixing. Distinct hashes establish changing frames, not human acceptance of every effect.

Screenshots: [nested blur](../../evidence/screenshots/effects-nested-shape-blur.png), [narrow dock](../../evidence/screenshots/effects-nested-mobile.png), [Trim Path](../../evidence/screenshots/animation-trim-path.png).

## Native effect animation follow-up — 2026-11-24

[Six-second MP4](../../qa-output/native-effect-keyframes/native-keyframes.mp4),
[frame sheet](../../qa-output/native-effect-keyframes/contact-sheet.png),
[report](../../qa-output/native-effect-keyframes/report.json),
[desktop](../../evidence/screenshots/native-effect-keyframes.png) and
[mobile](../../evidence/screenshots/native-effect-keyframes-mobile.png).
The right half of an existing credited Pexels car photo receives animated blur
and selective color; the left half stays unchanged. All 72 decoded frames are
distinct. Actual browser checks cover key controls, masks, cut/trim/extend,
overwrite/move, Undo, locked tracks, invalid MCP inputs and Save/New/Open.
See `AUDIT_STATE.md` Cycle 15 for limitations, including linear interpolation
and the separate work still required for dropped-instance trim clocks.
