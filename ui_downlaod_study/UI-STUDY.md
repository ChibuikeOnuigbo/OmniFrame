# UI Study — space-saving panels (from `refernce.zip` request)

## What you gave me, and what I could actually get

You linked a Google Drive ZIP: file id `1lsp7EwETtHZhRbbFhKRpQXLhwtFMLgG0`,
name **`refernce.zip`** (`application/x-zip-compressed`) — confirmed via
your asset gateway, which renders the Drive viewer page.

**Honest limit:** the ZIP binary cannot be extracted inside this sandbox.
Outbound traffic here only reaches GitHub / npm / PyPI; the gateway
returns web pages as text (great for YouTube metadata — used heavily in
the preset waves) but cannot pass a binary archive through, and direct
Drive/yt-dlp downloads are TLS-blocked. So no screenshots *from inside
your ZIP* exist in this folder — if you want that software's exact
screens studied, drop the unzipped screenshots (PNGs) into this folder
and I'll annotate them one by one.

What IS in this folder: screenshots of **our own app, before and after**
the refactor, captured with the same harness as the QA suites
(`qa/ui-study-capture.mjs`).

## The reference software's space ideas (from your description)

1. **Panels have up/down travel** — content scrolls inside a fixed-height
   dock instead of growing the window.
2. **Panels drag** — docks can be grabbed and moved/resized, so the user
   decides where space goes.
3. **Long tools leave the main panel** — heavy functionality becomes a
   mode you enter, not a section you scroll past.

## Audit of our app (before)

- Text panel rendered **4,063 px** tall (`before-text-panel.png`):
  styling + title presets + 42-preset library + animation settings +
  cursor forme window + Retro Studio + Watermark Studio, all stacked,
  all always visible. Lengthy studios (Retro, Watermark) were the worst
  offenders — exactly what you flagged.
- The sub-mode machinery already existed (rail chips under the parent
  tool icon, Back button, focused title: `submode-back-btn`,
  `contextualSubModes`) but only covered Styling and Title Presets.
- Effects panel already splits into category sections (LUT gallery,
  placed adjustments, custom effects) — acceptable, left alone.
- Left panel header already supports drag (`left-panel-header` pointer
  handlers) and the panel scrolls internally — matching reference
  ideas 1–2; idea 3 was the missing piece.

## The fix applied ("icon mode under the parent tool")

Text tab is now an **overview of 5 icon tiles** (icon + one-line label,
tooltip for detail — no paragraphs):

| Tile | Sub-mode | Contents (only visible inside the mode) |
|---|---|---|
| Text & Styling | `text-styling` | content, fonts, colours (also auto-shows when a text clip is selected for editing) |
| Title Presets | `text-presets` | 4 quick title templates |
| Preset Library | `text-library` | 42 procedural presets + animation settings + cursor forme window |
| Retro Studio | `text-retro` | Retro Text Studio (both methods) |
| Watermark | `text-watermark` | Watermark Studio levels 1–6 + saved stamps |

Entering a mode registers an **icon chip under the Text tool in the left
rail** (so the mode is one click away afterwards), the panel header
shows `‹ Back / <Mode name>`, and everything else is hidden — each mode
is a short, single-purpose panel. Verbose helper paragraphs were cut to
one-liners.

## Measured result

- Overview panel height: **4,063 px → 334 px** (measured in-browser before/after; −92%). Screenshots: `before-text-panel.png`, `after-text-panel.png`, `after-text-library.png`, `after-text-retro.png`, `after-text-watermark.png`.
- Every studio still fully reachable in ≤2 clicks; all previous
  testids preserved, QA suites re-navigated (see
  `qa/ui-declutter-submode-channeling-e2e.mjs` + preset suites).

## Rules going forward (applied app-wide from now on)

1. Any tool longer than ~one viewport becomes a sub-mode tile under its
   parent tool, never an always-visible stack.
2. Panel copy = labels + tooltips; paragraphs only where they prevent
   mistakes (loss warnings).
3. New lengthy features must ship with their tile + focused panel +
   QA navigation, not appended to an existing scroll.
