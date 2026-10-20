# data_ui — ReferenceTool UI inventory (all info)

Mined verbatim from the shipped bundle
(`_next/static/chunks/pages/_app-b0bee8b57a907b9e.js`, 4,544,658 bytes)
plus the offline DOM captures in `snapshots/`. Frequencies are bundle
hit counts. Honest limit: the live panel UI needs the vendor backend;
this inventory is the app's own strings/code, not screenshots.

## 1. Section registry (command palette / panel stack)

| Category | Title | Command | Section id |
|---|---|---|---|
| Open Section | Mockup | open | mockup |
| Open Section | Border | open | border |
| Open Section | Shadow | open | shadow |
| Open Section | Background | open | background |
| Open Section | Layout | open | layout |
| Open Section | Position | open | position |
| Open Section | 3D Effect | open | transform |
| Open Section | Watermark | open | watermark |
| Open Section | Annotation | open | annotation |
| Open Section | Title / Header | open | title |
| Open Section | Images | open | images |
| Open Section | Templates | open | templates |
| Open Section | Brands | open | brands |
| Open Section | AI | open | ai |
| Export | Copy image | copy | — |
| Export | Download PNG image | download-png | — |
| Export | Download JPG image | download-jpg | — |
| Utility | Preview on socials (Twitter, Instagram, LinkedIn, Bluesky) | preview | — |
| Utility | Preview Tweet | preview | — |
| Utility | Start with a blank canvas | reset-canvas | — |
| Help | Ask a question or Share feedback | help | — |

## 2. The control atom

`Mockup Controls` (21 hits) is an accordion section
(`title:"Mockup Controls", w:"100%", innerSpacing:4, spacing:6`).
Every control is one row: **14 px icon + one-line label + slider
(min/max/step) + numeric value**, e.g. `Border Radius 0–100 step 1`,
`Opacity`, `Border Width`, `Padding Around`, `Letter Spacing`,
`Line Height`. Properties group by **object part** — frame, border,
shadow, background, spacing — never by feature.

## 3. Control-label vocabulary (266 distinct labels, abridged)

Alignment (Align Left/Center/Right, top/bottom, distribute spacing,
force equal width / same aspect), Amount, Background Color, Blur /
Blur Density / Blur Radius, Border Radius / Border Width, Color
Overlay, Dash size, Dither Effect, Duotone, Fade in grid corners,
Fill, Font Family / Font Size, Gradient highlighter, Grain, Grid
Overlay, Icon Scale, Intensity, Letter Spacing, Line Height, Logo
Size, Margin, Mesh Gradient, Offset, Opacity, Padding (Around),
Paper Texture, Pixelate, Roundness, Scale, Shadow / Bar Shadow / Add
Shadow, Size Ratio, Spacing, Spread, Text Color / Text Size, Thickness,
Transparency, Watermark, Zoom. Blend modes present: Color Burn,
Darken, Lighten, Luminosity, Multiply, Normal, Plus Lighter.

## 4. Device frames

MacBook (Front, Pro 14, Pro 14 Left Side), iPad (Mini, Pro 12.9-inch,
with Pencil, Simulator), iPhone (14 5.8", 14 Plus 6.5", 14 Pro 6.1",
15 Pro / 16, Dynamic Island), Android Mobile, Browser, Chromebook,
Apple Watch Series / Ultra. Generators: "Browser Mockup Generator",
"MacBook Mockup Generator", "iPad Mockup Generator", "iPhone 14/15
Mockup Generator", Mobile Mockups Grid, Device Mockups, Device OS.

## 5. Backgrounds

Flat/Solid Color, Gradient (+ Gradient Background, Gradient fill,
Gradient Suggestions), Mesh Gradient (+ Helper), Pattern / Patterns
(Polka v2, Dotted, Dashed), Paper Texture, image backgrounds
(`imageURL`, `topPadding`, `bgColor` props), Swap with background
color, Make Padding Transparent, Screenshot Fill Screen.

## 6. Content & extras

Annotation (arrows, handwritten circle/rectangle/underline, text
highlight/highlighter, Delete/Duplicate highlight, Highlight Layers),
Templates (Your Templates, Manage saved templates, Close template),
Uploads (Upload Image 9×, Manage your uploads, Replace From Uploads,
Replace Image), Brands (Brand Assets), social tooling (Fake Tweet
Generator, Tweet to image, OG Image Generator, Carousel Maker, App
Store / Play Store Screenshots, Feature Graphic, Profile Picture
Maker, Emoji Maker, QR Code), AI (AI Image Edits, Text to Image,
Text Generation, Remove background, Upscale Image, Anime portrait),
themes (Dark/Light mode), Smart Paste onboarding
(pastes/downloads/copies/saves counters gating tips).

## 7. Shell (what renders offline — see BRANDBIRD-UI.md)

Dark dotted-grid canvas, viewport-full; bottom-right "Share Feedback"
pill + shortcuts + help icon buttons; Inter font; no other chrome
before auth. `ingest/` = PostHog analytics. `_ext/` hosts hang
(assets.customer.io, tally.so, usefathom, wdfl) — marketing/site
chrome, not studio.

## 8. What OmniFrame adopted from this

1. Group controls by object part with one-line labels (LUT/adjustment
   sections, pack sections) — already the panel grammar.
2. Canvas-first: explanatory prose moved OUT of panels into one
   **Help docker** (`HelpModal`, `?` header button, context-menu
   "Tutorial & Info") — shipped this wave.
3. Explorer metaphors for libraries: **Pack Browser** (95% window,
   folders, search, tags, bundle previews showing what's inside) —
   shipped this wave; sub-modes spawn the same 95% window on desktop.
4. Device/background vocabulary seeded the Desktop Pack sections
   (Windows & Apps, Apps & Phones, Scenes, Cursors, Overlays).
