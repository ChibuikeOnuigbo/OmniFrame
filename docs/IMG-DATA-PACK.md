# img_data_pack — user screenshot processing notes

The user supplied 85 screenshots of programs and data via a Google Drive
folder and asked for them to be extracted into `img_data_pack/` and processed
into per-app asset packs.

## Privacy rule (hard)

Originals may contain personal information. They:

- live only in `img_data_pack/` (repo root), which is **gitignored** and must
  never be committed;
- are never reproduced in assets, docs, tests, or commit messages;
- were only used for **gist**: which apps, layouts and UI patterns appear.

## Processing

- Each screenshot was classified by app/window type (privacy-safe category
  counts only — no file names, account names, messages, or other personal
  strings were recorded anywhere).
- Gist categories found: Windows File Explorer, Chrome/web apps (mail,
  video-studio dashboards, chat, docs, music streaming), VS Code, phone-style
  app UIs, video-editor UIs, 3D screens.

## Resulting packs (all demo text, procedurally drawn)

In Desktop Pack → **Apps & Devices** (`src/lib/desktopPack.ts`,
`packAssetUrl()` renders 1280×720 PNGs on canvas at runtime):

- **Music** — Music Player (streaming player with demo playlist).
- **Files & Browsers** — File Explorer Win11, Finder Mac, Chrome phone.
- **Phones** — iOS home screen, Android home screen, Figma-style phone
  canvas. (Phone layouts were requested even though no phone screenshot was
  supplied.)
- **Creators** — YouTube Studio dashboard.
- **Chat & Mail** — Gmail window, WhatsApp chat.

All names, tracks, files and messages inside these recreations are demo/test
text ("Demo Track 01 — Test Artist", "Demo Clip 01.mp4", …). Two bundles use
them: **Music Video** (player + progress bar + click ring) and **Phone Demo**
(Android home + cursor hand). Covered by `qa/apps-scenes-e2e.mjs` and
`qa/desktop-pack-e2e.mjs`.
