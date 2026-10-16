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
- Gist categories found (counts only): code editor 22, light web/docs 18,
  dark app windows 22, mixed web 10, music streaming/playback 9, video-site
  UI 2, purple design/chat 2 — 85 screenshots in total. Blurred gist contact
  sheets are in `img_data_pack/processed/` for local review.

## Resulting packs (all demo text, procedurally drawn)

In Desktop Pack → **Apps & Devices** (`src/lib/desktopPack.ts`,
`packAssetUrl()` renders 1280×720 PNGs on canvas at runtime):

- **Music** — Music Player desktop/Mac/phone and Podcast Player, all with
  demo tracks/episodes.
- **Files & Browsers** — File Explorer Win11, Finder Mac, Chrome phone and a
  Chrome webpage recreation.
- **Phones** — iOS/Android home screens, Figma-style phone canvas, Chrome,
  Maps, Photo Gallery, Notes, Weather and Settings phone layouts. (Phone
  layouts were requested even though no phone screenshot was supplied.)
- **Creators** — Creator Studio analytics dashboard.
- **Code & Design** — Code Editor demo project and desktop Design Canvas.
- **Productivity** — Demo Calendar and Demo Budget spreadsheet.
- **Chat & Mail** — Mail inbox, chat app and community-chat recreations.

All names, tracks, files, messages, places and numbers inside these
recreations are demo/test text ("Demo Track 01 — Test Artist", "Demo Clip
01.mp4", "Demo Park", …). Twelve one-click bundles stack them, including
**Music Video**, **Phone Demo**, **Phone Story** and **Creator Desk**.
Covered by `qa/apps-scenes-e2e.mjs` and `qa/desktop-pack-e2e.mjs`.
