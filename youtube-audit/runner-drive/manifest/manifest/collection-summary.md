# Collection Summary — Phase 1 (footage collection)

Date: 2025-10-21 · Environment: Linux sandbox, yt-dlp 2026.08.19, FFmpeg 7.1.5, Google Drive connector.

## Headline numbers

| Metric | Value |
|---|---|
| YouTube videos **discovered** (6 channels + 4 individual) | **249** (248 channel uploads incl. 31 Shorts, + 4 individual; 3 overlap-free unique after dedupe = 248 + 3) |
| Videos **successfully downloaded** | **250** (243 channel + 4 individual + 3 Drive videos) |
| Videos **unavailable** | **5** (all YouTube members-only — not bypassed) |
| Download **failures** | **0** |
| Total video duration collected | ≈ 23.6 h |
| Total media on disk | ≈ 4.8 GB (720p) + 0.37 GB Drive assets |
| Anime scene packs **catalogued** | **2,746** across 185 anime titles (7.22 TB — see limitations) |

## Resolution decision (trade-off, documented)

The first pass downloaded everything at **1080p (8.15 GB → ~89 ZIPs)**. Drive uploads proved to be
**capped at 100 MB per file** and effectively **one successful transfer per batch**, making a 1080p
upload impractical. The corpus was re-fetched at **720p (4.72 GB)** to guarantee that *all* videos get
delivered rather than a high-quality subset. Original resolution and frame rate are preserved per file
and recorded in `all-videos.csv` (`width`, `height`, `fps`); several sources are natively ≤720p.

## Per-channel coverage

| Channel | Slug | Videos | Notes |
|---|---|---|---|
| Spaceless | spaceless2041 | 10 + 2 Shorts | |
| DeppeyVFX | Deppey | 7 | no Shorts tab |
| Avoid | AvoidAEP | 62 + 2 Shorts | 5 members-only videos unavailable (not this channel) |
| MatttVfx | MatttVfx | 119 + 11 Shorts | largest corpus |
| kai | Keditz123 | 9 | no Shorts tab |
| CHOSEN | chosensyt | 11 + 15 Shorts | |

## Known limitations (all real, none worked around)

1. **YouTube members-only** — 5 videos require a paid channel membership. Recorded in
   `download-errors.csv`; access controls were not circumvented.
2. **Drive 100 MB per-file upload cap** — archives are therefore ≤98 MB each.
3. **Upload throughput** — the Drive connector reliably completes ~1 transfer per call batch;
   parallel uploads beyond 2 fail with `file_transfer_failed`. This, not download capability,
   is the binding constraint on total volume.
4. **scenepacks.com** — individual packs are 1.6–9 GB (7.22 TB total) and downloads run through an
   interactive timer-gated browser flow. Full transfer is impossible under (2)+(3); the complete
   catalogue *metadata* (2,746 packs, sizes, creators, actors, source URLs) is included instead.
5. **Pinterest** — no unauthenticated asset API; not harvested (see `other-references/SOURCES.md`).
6. **JJK S2E3 Drive asset** — original 368 MB/1080p; transcoded to 720p (153 MB) to fit (2).

## Manifests

- `all-videos.csv` / `all-videos.json` — every discovered video, downloaded or not
- `download-errors.csv` — the 5 unavailable videos with exact errors
- `discovered-channels.json` — raw channel enumeration
- `archive-plan.json` — archive packing plan
- `upload-log.csv` — archive → Drive file id / link mapping
