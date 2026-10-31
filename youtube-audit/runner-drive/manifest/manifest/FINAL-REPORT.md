# Phase 1 Final Report — footage collection & upload

## Counts

| Metric | Value |
|---|---|
| Videos discovered (YouTube) | **249** — 248 channel uploads (incl. 31 Shorts) + 4 individual, 3 of which dedupe into channels |
| Successfully downloaded (video w/ audio) | **250** — 243 channel + 4 individual + 3 Drive videos |
| Unavailable | **5** — all YouTube members-only (not bypassed) |
| Failed downloads | **0** |
| Anime scene packs catalogued (metadata) | **2,746** (7.22 TB, not transferred) |
| Reference images retrieved | **85** PNG |
| Total media collected | **≈ 5.2 GB**, 23.6 hours |
| ZIP archives created & uploaded | **66** (60 logical archives; 6 split into 2 parts) |
| Total uploaded bytes | **5.08 GB** |

## Verification performed

- Every media file probed with `ffprobe` — video stream present, audio stream present on 100% of video files.
- Every archive tested with `unzip -t` before upload.
- Round-trip test: 3 archives re-downloaded from Drive and re-tested
  (`spaceless2041__part01.zip` = 58,403,540 bytes byte-exact, 12 MP4s, valid).
- 369/369 on-disk source files confirmed present in exactly one archive; 0 duplicates, 0 omissions.
- Drive folder audited: 66 archive parts present + the 8 pre-existing source items.

## Split archives (need both parts to extract)

`unzip -s 0 <name>.zip -d <dir>` with all parts in one directory:
youtube-channels__MatttVfx__part01–04, chosensyt__part01, google-drive-assets__media__part01.

## Blockers & next steps

1. **Drive 100 MB/file cap** → 66 archives. Structural, not fixable client-side.
2. **One-transfer-per-batch throttle** on the connector — parallel uploads fail with
   `file_transfer_failed`; uploads are effectively serialised.
3. **5 members-only videos** need a channel membership to obtain (IDs in `download-errors.csv`).
4. **scenepacks.com** — packs are 1.6–9 GB and gated behind an interactive timer page.
   Catalogue metadata included; a browser-automation session with sufficient quota is needed
   to fetch actual packs.
5. Collected at **720p** (not 1080p) to fit the cap + throttle; per-file native resolution,
   aspect ratio and frame rate are recorded in `all-videos.csv`.
