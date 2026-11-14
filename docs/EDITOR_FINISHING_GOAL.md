# OmniFrame editor finishing goal

Goal: make the editor fast, understandable and reliable across the web and desktop
surfaces, with creative tools that are editable, previewable, exportable and testable.
A catalog count alone is not completion. Every new effect must render in the shared
preview/export path, have usable controls, preserve undo/project persistence and show
its intended visual result on real footage.

## Current work

- [x] Cel animation entry, onion skins, duplicate/clear cel and path-based Draw on.
- [x] Effect View Mask: rectangle, circle, ellipse, text, polygon, split; inside/outside,
  rotation, feather and opacity.
- [x] Star and hexagon View Masks in browser and headless rendering; text font selector
  and numeric polygon point editing.
- [x] Draw polygon and freehand effect masks on the program monitor; drag points,
  snap to quarter guides and smooth outlines with an adjustable cubic curve.
- [x] Add individually draggable Bezier handles with reset and shared preview/export geometry.
- [ ] Add Krita-style perspective/curve assistants and rulers for precise drawing.
- [ ] Color/offset feather controls with verified alpha and color output.
- [ ] Text handwriting reveal with editable glyph paths and a useful preset set.
- [ ] Card flip and hologram families with different motion, controls and test renders.
- [ ] Squash bounce/roll with floor and collision controls; dust, water reflection,
  aura and glowing-eye effects with masks, timing and real preview/export parity.
- [ ] Verify interaction, performance and native desktop builds across supported OSes.

For each item, acceptance requires an actual rendered sample, relevant pixel or
motion check, live UI test where needed, and a review of failure cases. Source links
or recipe IDs do not count as watched tutorials or validated effects. This ledger is
updated as work passes those checks; unchecked items remain open.

14 November check: star and hexagon masks passed headless pixel area tests, the
live editor test selected all four shape/font/point controls, and typecheck/build
plus context-menu, MCP, project reset and compositor regressions passed. The large
legacy bulb-mask browser flow stalled in this environment; the focused mask flow
passed. Visual acceptance of all variants remains open.

14 November follow-up: click/drag polygon points, freehand tracing, guide snapping,
curve smoothing and conversion from an existing selection passed a live browser
flow. Headless pixel checks cover open paths (0–2 points), cubic smoothing and
completed masks. Editable per-point Bezier handles are still open.

14 November Bezier check: independent incoming/outgoing handles change rendered
mask pixels compared with the same straight polygon, drag and reset pass in the
live editor. Colored feather and the larger effect families remain open.
