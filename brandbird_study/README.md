# brandbird_study — ReferenceTool (BrandBird-style) UI study

This folder is a study of the **reference work the user supplied**: the
`refernce.zip` mirror downloaded from Google Drive (see
`../ui_downlaod_study/UI-STUDY.md` for provenance). The app is
**ReferenceTool** — "Powerful image, mockup & screenshot editor for
entrepreneurs" (a BrandBird-style screenshot beautifier: drop in a
screenshot, get a framed, shadowed, gradient-backed marketing image).

## What is in here

| File | What it is |
|---|---|
| `BRANDBIRD-UI.md` | The snapshot-linked tour: every capture taken, what each shows, and what we learned from it. |
| `data_ui.md` | The full mined UI inventory: sections, command palette, control labels, device frames, background system, export — all info extracted from the app's bundle + DOM. |
| `snapshots/` | Raw captures: `01-collection-studio.png/html`, `02-collection-fresh.png/html`, `capture-report.json` (machine-readable route report). |

## Honest rendering limit (important)

The ZIP is a **static mirror** (HTML + JS chunks). Served locally, the
studio boots to its **empty dotted canvas** only: the panel stack,
templates and dashboard are rendered from a live backend (auth +
API at `storage.googleapis.com` etc.) that is not in the ZIP and
cannot be reproduced offline. So:

- Screenshots here show **exactly what genuinely renders offline** —
  the canvas shell + Share Feedback widget. We do **not** fabricate
  panel screenshots.
- Everything known about the real panels comes from **mining the
  shipped JS bundle** (4.5 MB `_app` chunk): component titles, section
  registry, slider labels, device/background vocabularies. That
  inventory is complete and verbatim in `data_ui.md`.

## How OmniFrame uses this (summary)

1. **Canvas-first shell**: the reference puts the canvas center-stage
   with nothing but a feedback/help affordance — OmniFrame keeps its
   own studio canvas-first and moves help into one docker (HelpModal).
2. **Controls group by object part** (Mockup / Border / Shadow /
   Background / Padding / Position), one-line labels, sliders with
   icon + label + value. OmniFrame panels follow the same grouping.
3. **Command palette sections** (`Open Section`, `Export`, `Utility`,
   `Help`) mirror OmniFrame's context-menu + tool-finder model.
4. **Device frames + backgrounds** vocabulary informed the Desktop
   Pack (windows/apps/cursors/overlays) and the Explorer Pack Browser.
