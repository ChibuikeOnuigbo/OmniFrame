# brandbird_study — BrandBird UI study (REDONE with the correct file)

> **Redo note:** the first upload (`refernce.zip`) was a spoilt/partial
> mirror — its studio could never boot (the shared webpack chunks were
> missing), so the earlier study was bundle-mining only. The user
> replaced it with **`BrandBird - Powerful image, mockup & screenshot
> editor for entrepreneurs - www.b.rar`** (3,323,095 bytes, Drive file
> `15PnvqnUPOJwkB34q-6mmgkyy25jb7ic0`), which contains the complete
> app: `index.html` (1.7 MB prerendered studio), all shared chunks,
> fonts, favicons. **The real BrandBird studio boots and runs offline
> from this mirror** — everything in this folder is now based on the
> live app, screenshotted state by state.

## What is in here

| File | What it is |
|---|---|
| `BRANDBIRD-UI.md` | Snapshot-linked tour: all 25 captures, what each shows, and the design lesson taken from it. |
| `data_ui.md` | The full UI inventory from the live app + bundle: rail sections, every panel's controls, sliders, export options, onboarding, PRO gating, vocabulary. |
| `snapshots/` | 25 PNG captures + per-state JSON DOM dumps (`buttons`, `inputs`, slider counts) + `capture-report.json`. |

## How it was run

- RAR extracted with `node-unrar-js` (WASM unrar) into
  `ui_downlaod_study/brandbird-rar-extract/bb/` (gitignored — third-party mirror).
- Served with an SPA-fallback static server (any unknown path →
  `index.html`), driven with Playwright: onboarding dismissed, every
  rail section opened, one of our own screenshots uploaded through
  their file chooser so image-selected states (Mockup/Shadow/Border/
  Position controls, floating selection toolbar) could be captured.
- The app is **fully client-side for editing**: canvas, panels,
  uploads, mockup/shadow/border/position controls and the Export
  options popover all work offline. Only account/template-cloud
  features need their backend (Sign In, public template gallery
  thumbnails, PRO unlocks).

## What OmniFrame took from it (shipped this wave)

1. **Floating selection quick-bar** — BrandBird floats a contextual
   toolbar (AI Tools / Crop / Highlight / Padding / Blur) over the
   selected image. OmniFrame's monitor now floats an equivalent bar
   over a selected clip: clip name · Effects · Text (titles) · Split ·
   Delete (`selection-quick-bar` in `Preview.tsx`).
2. Their grammar was already our direction and is now confirmed by
   the live app: icon rail + floating panel card, CAPS micro-headers,
   label-left/value-right sliders, segmented chips (Original/Fixed,
   PNG/JPG/WebP/PDF, 0.5x–3x), big primary action with shortcut hint
   (Download PNG ⌘B), empty states that say what to select.
3. Export popover pattern (format chips + scale chips + primary
   download + "Advanced options") is recorded in `data_ui.md` §6 as
   the reference for OmniFrame's export surface.
