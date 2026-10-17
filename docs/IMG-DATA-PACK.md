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

## Structural gist scan (OpenCV)

`tools/img_gist_scan.py` bisects the extracted pack with OpenCV —
dimensions, aspect class, dominant palette (k-means), mean luminance and
Canny edge density per screenshot. It never runs OCR and stores no text or
crops from the images; only the aggregates below steer which demo scenes
get generated.

Latest scan of the 85 extracted screenshots:

- **Device class:** 82 landscape-desktop-like, 3 ultrawide-desktop-like,
  0 portrait — the supplied set is desktop captures, which is why phone
  layouts in the pack are generated rather than traced.
- **Theme:** 57 dark, 28 light — pack scenes lean dark for desktop apps.
- **Layout density:** 31 dense-ui, 39 standard-ui, 15 sparse-media.

Wave-5 followed this gist: a dark two-host **Podcast Studio** window and a
**Slides** explainer window for the desktop majority, plus generated
**Fitness** and **Food Delivery** phone layouts for the phone gap. Per-file
records live in `img_data_pack/processed/gist-summary.json` (gitignored,
alongside the screenshots). The pack now totals 69 generated assets and 16
one-click bundles.
