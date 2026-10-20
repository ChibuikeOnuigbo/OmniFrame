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
