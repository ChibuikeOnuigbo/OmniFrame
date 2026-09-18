# UI and workbench research

**Checked:** 2026-09-19. Sources include Kdenlive UI elements, Kdenlive project monitor and shortcuts documentation, OpenCut's local timeline architecture, Adobe Premiere workspace/effect-controls documentation, DaVinci Resolve's Edit/Cut/Inspector notes, Krita modifier conventions, shadcn/ui/Radix primitives and Lucide icons.

## Comparative findings

| Reference | Useful structural signal | OmniFrame decision |
| --- | --- | --- |
| Kdenlive | Project/media area, monitor toolbar and timecode, timeline zone, zoom bar and audio meters are persistent work surfaces. | Keep media left, viewer/transport above the timeline, timeline ruler/playhead visible and status information compact rather than hiding it in a modal. |
| Premiere | Effect Controls is contextual: clip properties, effects and keyframes share a panel with a timeline-oriented view. | Keep the right inspector selection-aware; do not make model/runtime settings the first surface. |
| DaVinci Resolve | Cut/Edit viewers and Inspector separate source/program and clip-scoped controls while the timeline remains the primary editing surface. | Preserve viewer-to-timeline relationship and expose transform/crop/audio/effects in the inspector. |
| OpenCut | A local-first multi-track model benefits from explicit segment validation and a render/export boundary. | Keep project state serialisable, local by default and honest about native/export capability gates. |
| Krita | Shift add, Alt subtract, Ctrl replace and Shift+Alt intersect are fast, learnable mask modifiers. | Preserve these mappings and keep `THIS FRAME`, `RANGE`, `ALL FRAMES` visible. |

The collected Kdenlive and VEGAS reference images are in the temporary `image-search/` directory. `scripts/qa-images.py` uses OpenCV to record dimensions, aspect ratio, dark-pixel density, edge density and candidate vertical/horizontal separators. This is comparative evidence only; it is not a local-app screenshot pass.

## Layout decisions

- landing page and editor are separate routes/states;
- top application chrome: project identity, File/Edit/View/Workspace/Help menus, save/undo/redo/command palette, canvas aspect selector, workspace tabs, performance/export;
- left rail: media, edit, colour, masking, tracking, Omniframe, 3D, audio, assets;
- centre: preview, viewer tools and dense multi-track timeline;
- right: contextual inspector and effects controls;
- bottom: status row with sequence dimensions, fps, playhead time, asset/track counts, selected clip and actual job status;
- timeline rows remain virtualisation-ready and own their internal horizontal scroll;
- aspect presets are explicit sequence state: 16:9, 1:1, 9:16 portrait and 4:5, with export using the selected dimensions rather than a hard-coded landscape canvas.

The UI avoids generic SaaS cards, oversized rounded containers, random icon sets, slider walls and false activity. Segmented controls, disclosure sections, scrubbable values, compact popovers and keyboard shortcuts carry the density. Lucide remains the coherent icon family; the YouTube delivery preset uses its `Youtube` glyph where a brand cue is useful, without mixing arbitrary icon packs.

## Responsive and visual QA record

The source layout tokens are deliberately conservative: 54px top bar, `82px minmax(440px, 1fr) 300px` desktop columns and a 25px minimum status row. At 1100px the optional application-menu/aspect controls hide before the editor grid compresses. At 760px the right inspector becomes a drawer, the rail and transport compact, and the status row keeps only the most useful facts. Browser screenshot validation remains pending until a Chromium executable is available; the Playwright request probe and BeautifulSoup/OpenCV scripts therefore report structure and comparative image measurements without claiming visual runtime coverage.

## Accessibility and failure behaviour

- keyboard shortcuts are configurable;
- menus use real buttons with `aria-expanded`, disabled undo/redo states and keyboard-visible labels;
- dialog focus and Escape behaviour use accessible primitives in the next component pass;
- errors state what failed, why, and which fallback was selected;
- experimental/slow model options are explicitly labelled;
- no major button is a silent toast-only placeholder: visible editor actions either mutate real state, start a real engine path, save, or explain a concrete limitation.

## Motion

Anime.js/WAAPI are suitable for restrained landing/workbench transitions. Playback, tracking progress and export are driven by engine/job state and frame clocks, not decorative animation timers.
