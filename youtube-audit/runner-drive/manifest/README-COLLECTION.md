# Editing-Research Collection — Phase 1: Footage Collection

Collected: 2025-10-21. Purpose: source footage + tutorial corpus for the OmniFrame
editing-effects research phase. **No analysis or effect implementation was performed in this phase.**

## What's inside

```
editing-research-collection/
├── manifest/                     all-videos.csv, all-videos.json, download-errors.csv,
│                                 collection-summary.md, discovered-channels.json,
│                                 individual-videos.json, google-drive-assets.json
├── youtube-channels/             6 channels — 243 full videos w/ audio (H.264 + AAC, ≤1080p, native fps)
│   ├── spaceless2041/            Spaceless
│   ├── Deppey/                   DeppeyVFX
│   ├── AvoidAEP/                 Avoid
│   ├── MatttVfx/                 MatttVfx
│   ├── Keditz123/                kai
│   └── chosensyt/                CHOSEN
├── individual-videos/            4 requested standalone videos (1 deduped into its channel)
├── google-drive-assets/          Drive folder 1uP9ySa8P2p9yGM4gJsn8fxuosQ1k2XrN
├── anime-scene-packs/            scenepacks.com catalog (2,746 packs, metadata + source URLs)
└── other-references/             source/attribution notes
```

## File naming

`<videoId>_<original title>.mp4`

The `videoId` prefix keeps names unique and lets you look up the original URL
(`https://www.youtube.com/watch?v=<videoId>`). Every file is also listed in
`manifest/all-videos.csv` with channel, title, URL, resolution, fps, codecs and size.

## Archive conventions

- Archives are ≤92 MB each to stay under the 100 MB Drive upload limit.
- Archives whose name ends with a **single** `.zip` are ordinary ZIPs.
- Archives that had to carry one oversized video (>92 MB) are **split ZIPs**
  (`.z01`, `.z02`, … plus a final `.zip`). Reassemble and extract with:
  ```
  unzip -s 0 <name>.zip -d <dir>
  ```
  (all parts must sit in the same directory).
- Every archive embeds a copy of `manifest/` and this README.

## Access limitations recorded (not bypassed)

- 5 YouTube videos are **members-only** and were not downloaded. See `download-errors.csv`.
- scenepacks.com individual packs are 1.6–9 GB each (7.22 TB across the catalogue) and the
  download flow is gated behind an interactive, timer-based browser page. Bulk transfer is
  impossible within this environment's 100 MB-per-file upload limit; the **full catalogue
  metadata** (`anime-scene-packs/catalog/scenepacks-catalog.json`) is included instead,
  with a direct source URL for every pack.

## Attribution

All clips and tutorials remain the property of their original creators. Channel and
video URLs are preserved in the manifests. Scene-pack entries record creator, actors,
origin title, quality and source URL. This corpus is for private research/reference.
