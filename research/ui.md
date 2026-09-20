# UI and workbench research

**Checked:** 2026-09-20. The comparative pass now includes CapCut Desktop's official PC guide and editor screenshots, the requested recreated CapCut Figma kit, and OpenCut's current editor direction. References are study material only; OmniFrame does not bundle or reuse their screenshots or brand assets.

## Comparative findings

| Reference | Useful structural signal | OmniFrame decision |
| --- | --- | --- |
| CapCut Desktop | A persistent dark editor separates a media/tool surface on the left, player in the centre, selected-item details on the right and a full-width timeline below. Import is a large, obvious action and clips visibly carry thumbnails, names and durations. | Rebuild the editor around a clear upper three-panel work area with the timeline spanning the complete width underneath. Keep Import/Add media visible instead of hiding it in a small rail icon. |
| CapCut Desktop | The top category strip exposes Media, Audio, Text, Stickers, Effects, Transitions, Captions, Filters and Adjustments as an ordered tool family. | Keep workspace choices in a scrollable strip with explicit left/right arrows. At narrow widths, scroll the strip; do not delete categories or silently move them into an overflow menu. |
| CapCut Desktop | A selected clip immediately drives the right Details/Video panel; common controls are grouped into readable sections such as Position & Size, Blend and Stabilize. | Keep the inspector present and contextual, with larger section headers, fewer decorative borders and a stable right column. Remove the close/hide inspector affordance. |
| CapCut Desktop | Timeline controls use a compact toolbar above a dark ruler, visible playhead, track controls, trim handles and an empty-state drop target. | Make the timeline the primary surface: larger lane labels, readable clip duration text, visible trim handles, direct drag/drop and track arrangement lines. |
| CapCut Figma kit | The recreated kit is useful as a component reference for dark surfaces, compact category navigation, media cards and selected-state treatment, but its preview is not a source of implementation assets. | Use the interaction hierarchy, not copied artwork: one accent, consistent 8px rhythm, clear selected states and larger controls. |
| OpenCut | The current product surface presents a simple editor, a visible multi-track timeline, player/properties relationship and an intentionally restrained visual system. | Keep OmniFrame's real engine/state model behind a calmer, simpler workbench instead of decorative mock panels. |
| Kdenlive | Project/media area, monitor toolbar and timecode, timeline zone, zoom bar and audio meters are persistent work surfaces. | Keep media left, viewer/transport above the timeline, timeline ruler/playhead visible and status information compact rather than hiding it in a modal. |
| Premiere | Effect Controls is contextual: clip properties, effects and keyframes share a panel with a timeline-oriented view. | Keep the right inspector selection-aware; do not make model/runtime settings the first surface. |
| DaVinci Resolve | Cut/Edit viewers and Inspector separate source/program and clip-scoped controls while the timeline remains the primary editing surface. | Preserve viewer-to-timeline relationship and expose transform/crop/audio/effects in the inspector. |
| Krita | Shift add, Alt subtract, Ctrl replace and Shift+Alt intersect are fast, learnable mask modifiers. | Preserve these mappings and keep `THIS FRAME`, `RANGE`, `ALL FRAMES` visible. |
| Blender compositor | Alpha Over explicitly distinguishes foreground/background, opacity factor and premultiplied versus straight alpha; Vector Math provides named vector operations. | Keep alpha convention and blend math explicit in render data, and test vector/matrix operations in the engine rather than hiding them in UI sliders. |
| After Effects | A layer owns transforms, effects and multiple masks; layer blend modes affect layers below, while mask modes operate among masks on one layer. | The Layers workspace separates track compositing from mask semantics and persists both in project data. |

The CapCut observations come from the official guides at [`how to use CapCut on PC`](https://www.capcut.com/resource/how-to-use-capcut-on-pc) and [`CapCut Desktop Download`](https://www.capcut.com/resource/capcut-desktop-download), the Figma reference at [`Capcut UI - Free UI Kit (Recreated)`](https://www.figma.com/community/file/1311983320984843858/capcut-ui-free-ui-kit-recreated), and OpenCut at [`opencut.fun`](https://opencut.fun/). Image search was used to inspect public editor screenshots, but no screenshot is shipped in the product.

## Layout decisions

- landing page and editor are separate routes/states;
- top application chrome: project identity, File/Edit/View/Workspace/Help menus, save/undo/redo/command palette, canvas aspect selector, scrollable workspace tabs with left/right arrows, performance/export;
- upper editor: a persistent labelled tool rail on the left, preview/player in the centre, and contextual inspector on the right;
- bottom editor: a full-width timeline below the upper panels, with its own toolbar, ruler, track labels, visible clip durations, trim handles, playhead and drop zones;
- left rail labels stay readable at every viewport; media opens the working media bin and the timeline Add media action accepts video, audio, image and 3D sources;
- right inspector stays mounted even when the stored `showInspector` flag is false; there is no close/hide control that makes options disappear;
- track rows and media files can be dragged onto explicit insertion lines; dropping media into the end zone creates another track rather than silently failing;
- bottom status row remains truthful about sequence dimensions, fps, playhead time, assets, selected clip and actual job status;
- project state remains in the existing Zustand/engine project model. The visual pass changes composition and density without replacing clip, asset, recovery, GLB/glTF, export, masking or tracking data structures.

The visual system avoids generic SaaS cards, oversized rounded containers, random icon sets, slider walls and false activity. It uses charcoal CapCut-like surfaces, one teal accent, consistent 8px spacing, larger readable type, real selected states and Lucide icons. The requested screenshot references are comparative evidence only; licensed/reference images belong in `qa/images/` and generated browser captures belong in `qa/captures/`.

## Responsive and visual QA record

The workbench keeps all editing surfaces in the DOM. At smaller widths, the upper editor and timeline become horizontally scrollable with minimum usable panel widths; the workspace strip has explicit left/right arrows. Legacy rules that hid workspace tabs, editor menus, native status, performance/aspect controls, inspector, transport actions or rail labels are overridden. This is deliberate: a narrow viewport may require panning, but it must not silently remove an option.

Chromium screenshot validation was attempted after the redesign, but the sandbox could not download the Playwright Chromium executable because the CDN connection reset. Typecheck, production build and engine tests remain the automated gates; visual verification should be run in the live preview when a browser executable is available.

## Accessibility and failure behaviour

- keyboard shortcuts are configurable;
- menus use real buttons with `aria-expanded`, disabled undo/redo states and keyboard-visible labels;
- workspace arrows have accessible titles and labels;
- errors state what failed, why, and which fallback was selected;
- experimental/slow model options are explicitly labelled;
- no major button is a silent toast-only placeholder: visible editor actions either mutate real state, start a real engine path, save, or explain a concrete limitation.

## Motion

Anime.js/WAAPI are suitable for restrained landing/workbench transitions. Playback, tracking progress and export are driven by engine/job state and frame clocks, not decorative animation timers.
