# Movable tilt-shift focus plane

## Delivered renderer

Tilt Shift now uses a real selective-focus plane shared by browser preview,
browser export and the headless MCP renderer. The previous implementation
always kept a fixed horizontal strip sharp and allocated three new canvases on
every frame. The new renderer reuses three bounded scratch surfaces and exposes
six editable controls:

- amount / blur radius;
- focus centre X and Y;
- plane angle from -180° to 180°;
- sharp-plane width;
- transition feather.

The sharp source is composited over a blurred source through an angled alpha
ramp. Rendering is performed in backing-canvas coordinates, so translated clip
isolation and effect-region masks do not shift the result. Every numeric control
uses the existing FX-instance keyframe system.

## Presets and catalog count

Forty-eight curated presets cover four orientations, three focus offsets and
four focus widths. They are executable patches over the shared renderer, not
names without pixel behavior. They raise the catalog to **150,048 base recipes**
and **155,048** after the existing 5,000 authored recipes load. The 139,425
indexed IDs remain stable.

Catalog search now tokenizes natural multiword queries, so a query such as
`Diagonal Focus Center Narrow` finds a displayed name that uses middle-dot
separators. The same all-token rule covers curated and generated recipes.

## Verification

- `node qa/tilt-shift-focus-unit.mjs`: three distinct renders; horizontal and
  portrait focus-retention measurements; zero-amount identity; 48 unique
  patches; six keyframeable parameters; import clamping.
- `node qa/tilt-shift-focus-ui-e2e.mjs`: natural multiword search and live
  application, all six controls, angle/position keyframes, effect-region entry
  and browser screenshot.
- `node qa/effect-recipe-bank-unit.mjs`: 150,048 exact base count and stable
  final indexed lookup.

Artifacts are in `qa/artifacts/tilt-shift-focus-planes.png` and
`qa-output/tilt-shift-focus/`.
