# data_ui — BrandBird UI inventory (from the live app)

Source: the correct RAR mirror, run locally (see `README.md`).
Frequencies/labels mined from `_app-b0bee8b57a907b9e.js` (4.5 MB) and
confirmed against the live DOM dumps in `snapshots/*.json`.

## 1. Shell layout

- **Top bar**: logo + plan badge (FREE) · undo/redo · preview eye ·
  canvas-size selector (`2400 × 1350 px`) · Save as Template ·
  Export · alerts bell · Sign In (primary).
- **Left rail** (icon + 10px label, active = filled tile + blue
  label, `+` create button pinned bottom): AI, Uploads, Templates,
  Images, Annotation, Background, Mockup, Position, 3D, Shadow,
  Border, Layout, Header, Watermark, Brands.
- **Panel**: floating rounded card next to the rail; header = icon +
  CAPS title + optional PRO badge.
- **Canvas**: dotted dark workspace; design centered; zoom −/+
  bottom-left; Share Feedback + shortcut/help buttons bottom-right.
- **Selection**: blue handles + floating toolbar above the object:
  AI Tools, Crop, Highlight, Padding, Blur, overflow ⋮, close ✕.

## 2. Panel inventory (live-verified)

| Panel | Controls (in order) |
|---|---|
| AI | History · ACTIVE TOOL · PROMPT · Unlock AI tools (gate) |
| Uploads | chips All/Images/Backgrounds/AI · Upload New · Select |
| Templates | Public/Saved · platform filter · template card grid |
| Images | Upload Image · paste Ctrl+V · Import Tweet PRO · Screenshot Website PRO · MagicPattern Tools PRO · Install Figma Plugin · Install Chrome Extension |
| Annotation | ADD ANNOTATION: Image/Text/Icons/Arrow/Rectangle… |
| Background | Save/Saved/Settings/Effects · Gradient (Direction 45°, Type Linear/Conic, from-a-color) · Gallery |
| Mockup | frame tile (NONE…) · Remove mockup · LAYOUT SCALE · ASPECT RATIO Original/Fixed · device frames (MacBook/iPad/iPhone/Browser/Android in bundle vocab) |
| Position | 3×3 position grid · Take border radius into account · POSITION X/Y · SCALE |
| 3D | (image required) tilt/perspective effect |
| Shadow | SELECTED IMAGE · PICK SHADOW · COLOR · Remove shadow |
| Border | Border Radius (0–100) · Border Width · color |
| Layout | PICK A LAYOUT · CONFIG Start/Center/End · SPACING · SCALE · FORCE EQUAL WIDTH (PRO) |
| Header | USE A HEADER toggle · title text controls |
| Watermark | Classic/Fullscreen/Dark/Light (PRO) |
| Brands | brand assets: colors, logos, fonts (PRO) |

Empty panels (Mockup/Shadow/Border/3D without a selection) show one
caps line: "PLEASE, SELECT AN IMAGE TO CUSTOMIZE ITS …".

## 3. Control grammar

- Slider row: CAPS label left, value right, thin track
  (`LAYOUT SCALE ——— 0.80`, `SPACING 0.50`).
- Segmented chips for enums: Original/Fixed, Linear/Conic,
  PNG/JPG/WebP/PDF, 0.5x/1x/1.5x/2x/3x, Start/Center/End.
- Toggles for booleans (Use a header, Take border radius into
  account, Force equal width).
- PRO = small badge on the panel header or inline gate line; the
  tool remains visible.

## 4. Command palette registry (bundle)

Open Section: annotation, shadow, mockup, background, title,
images, templates, layout, border, position, transform (3D),
watermark, brands, ai · Export: copy, download-png, download-jpg ·
Utility: preview (socials), reset-canvas · Help: help/feedback.

## 5. Vocabulary (bundle, abridged)

266 control labels: Alignment set (Align/Distribute/Force equal
width), Blur Density/Radius, Border Radius/Width, Dash size, Dither,
Duotone, Fade in grid corners, Font Family/Size, Gradient
highlighter, Grain, Grid Overlay, Icon Scale, Letter/Line spacing,
Mesh Gradient, Padding Around, Paper Texture, Pixelate, Roundness,
Spread, Text highlight, Zoom. Devices: MacBook (Pro 14…), iPad
(Mini/Pro/Pencil), iPhone (14/15, Dynamic Island), Android, Browser,
Chromebook, Apple Watch. Blend modes: Color Burn, Darken, Lighten,
Luminosity, Multiply, Normal, Plus Lighter.

## 6. Export (reference for OmniFrame's export surface)

One popover from the Export button: FORMAT chips (PNG/JPG/WebP/
PDF), SCALE chips (0.5x–3x) with computed output px, two option
checkboxes (Remove watermark PRO, Remove background PRO), primary
**Download PNG ⌘B**, secondary **Copy as PNG ⌘C**, ADVANCE OPTIONS
expander. Keyboard shortcuts printed on the actions themselves.

## 7. Onboarding & help

One welcome modal (4 steps, primary CTA + "I'll explore on my own"),
a shortcuts button and a help button bottom-right, Share Feedback
pill. No explanatory prose inside panels afterwards — labels, empty
states, and this one help affordance carry everything.

## 8. Limits (honest)

Editing is client-side and works offline from the mirror. Sign In,
cloud templates/uploads sync, template gallery thumbnails and PRO
checkout need brandbird.com backends (Stripe/Firebase/Google
storage hosts in `_ext/`) and were not exercised. No credentials
were used; nothing was uploaded anywhere.

## 9. Measured geometry (Playwright getBoundingClientRect, 1600×1000)

Raw dump: `snapshots/metrics.json` (script `qa/brandbird-metrics*.mjs`).

| Region | Rect (x, y, w, h) | Derived |
|---|---|---|
| Top bar | 0, 0, 1600, 54 | fixed 54px |
| Icon rail | 11, 91, 74, 866 | buttons **74×59**, pitch **75** (16px gap); **15 sections** + create; rail **scrolls itself** (scrollH 1311 > clientH 866) |
| Panel card | 105, 75, 266, ~496+ | rail→panel gap **20px** (105 − 85); panel = 16.6% of viewport width; top offset 21px under the bar |
| Design canvas | 416, 74, 1152, 649 | panel→canvas gap **45px** (416 − 371); 2400×1350 shown at **0.48 scale**; right margin 32px |
| Welcome modal | 401, 65, 798, 424 | ≈ 50% × 42% of viewport, centered |
| Selection toolbar | floats ~8px above the selected image | AI Tools/Crop/Highlight/Padding/Blur |

**Per-section control census** (buttons+inputs+sliders in the open
panel): Images 7 · Background 9 · Position 7 (1 btn, 3 inputs, 3
sliders) · Watermark 9 · Templates 5 primary + inner card scroll ·
Brands 1 · Layout 18 but grouped (Pick / Config / Spacing / Scale /
Force-equal-width). **Rule: one section = one object-part group; the
primary-control budget is ≈ 9; anything longer becomes a sub-group
or an inner scroll region — never a taller mega-section.**

**Scroll & linkage**: rail click swaps the panel 1:1 (panel title =
section); the panel owns the only vertical scroll in its column;
scrolling it leaves the design pixel-identical (measured before/
after: x 416, y 74 → 416, 74). Rail, panel and canvas are three
independent regions with fixed gaps (20 / 45px) — nothing overlaps
anything else.

## 10. Applied to OmniFrame: the segmented strip (user sketch)

`HScrollStrip` rewritten to the sketch's maths:
`visible = clamp(floor(viewportW / 76), 1, total)`,
`cellW = viewportW / visible`, offsets snapped to whole multiples of
`cellW`. Arrows are full-height layout cells flanking the viewport
(never overlays); segments are equal cells; at rest a segment is
fully visible or fully hidden — never sliced ("cut out"). Clicking
an arrow pages by `visible` segments and lands flush; wheel/drag
snap on release. Proven geometrically by `qa/segment-strip-e2e.mjs`
(8/8: arrow cells don't overlap the view, equal widths, zero cut
segments before/after paging, boundary-exact scrollLeft).

## 11. Dashboard & size presets (deep pass)

Dashboard (`/dashboard`): sidebar card (Welcome / Integrations /
Useful Tutorials) + Quick Start preset cards with pixel sizes
(Twitter Post 2400×1350, Twitter Cover 1200×400, Instagram Post
1200×1200, LinkedIn Post 1200×1200, Dribbble Shot 2800×2100,
Product Hunt Gallery 1270×760) + Popular Tools + Your Templates.
Canvas-size menu: platform-grouped presets (8 platforms, each item
name + WxH), custom Width/Height fields, Scale 0.5x/2x/3x, "Create
size preset". Background section sub-tabs: Save/Saved/Settings/
Effects. Annotation tool choice swaps the panel to that tool's
controls. Captures 26–47 in `snapshots/`.
