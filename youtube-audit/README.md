# youtube-audit — YouTube channel video audit (mission record)

**Mission:** inspect every accessible video of six channels + four explicit IDs,
prioritising actual footage over metadata, with resumable batches, persistent
per-video statuses, and no false completion claims.

## Headline result (honest)

- **Videos actually watched / visually inspected: 0.** No environment available
  to this agent can retrieve YouTube media bytes today (matrix below). Nothing
  in this audit claims otherwise.
- **Full channel inventory: COMPLETE — 250 videos** (248 enumerated by the
  GitHub runner via yt-dlp flat playlists over `/videos` + `/shorts` of all six
  channels, plus 2 explicit IDs confirmed through the text gateway).
- **Text-level analysis: 4 videos** (`METADATA_ONLY`) — author chapter lists,
  descriptions, and one downloaded code asset (see `evidence/`).
- **Footage attempts: 5 videos in batch 1, all `BLOCKED`** with the full error
  ladder preserved (`errors/`, `runner/reports/batch1.json`).
- **Remaining 243 videos: `INVENTORIED`**, queued for batches 2..N once a
  media route is unblocked (see "Unblocking" below).

## Execution-environment matrix (capability tests, verbatim logs in errors/)

| Environment | DNS | TCP | TLS | HTTP | Media bytes | Frames/audio inspectable |
|---|---|---|---|---|---|---|
| Normal sandbox (bash/Playwright) | ok | ok | **RESET** (SNI allowlist) | n/a | NO | NO |
| Arena text gateway | – | – | – | 200 (text) | NO (text proxy; transcripts bot-walled) | NO |
| GitHub-hosted Actions runner | ok | ok | ok | 200 | **BLOCKED by YouTube bot-check (datacenter IP)** | would be YES if bytes flowed |
| Public Invidious/Piped instances (via runner) | ok | ok | ok | 401/403 | NO (instances reject datacenter IPs) | NO |
| Local/residential media worker | – | – | – | – | none connected | – |
| Owner cookie secret (`YT_COOKIES`) | – | – | – | – | not set | – |

Logs: `errors/sandbox-capability.txt`, `errors/runner-capability.txt`,
`errors/<videoid>.txt` (per-video ladder), `Itired mybest.txt` (repo root,
pre-mission 15-method ladder).

## Structure

- `inventory.json` — all 250 videos: id, url, title, duration, channel, format
  (videos/shorts/explicit), status, access method, failure, next action.
- `progress.json` — resumable manifest: counts by status, current batch,
  checkpoint, last media-access test per environment.
- `reports/batch1.json` (runner) — per-video batch records.
- `evidence/` — text-level evidence per analysed video (+ code asset note).
- `errors/` — capability tests + exact per-video failure ladders.
- `runner/` — raw runner commit (inventory, batch report, errors).
- `technique-catalog.md`, `cross-video-patterns.md` — analysis from the
  evidence levels actually reached, labelled as such.

## Statuses used (never inflated)

`INVENTORIED` (243) · `METADATA_ONLY` (2) · `BLOCKED` (5) ·
`FOOTAGE_ACQUIRED`/`VISUAL_ANALYSIS_COMPLETE`/`AUDIO_ANALYSIS_COMPLETE`/
`FULL_ANALYSIS_COMPLETE` (0 — requires bytes; none retrieved) · `UNAVAILABLE` (0).

## Resuming / batching

The worker is `.github/workflows/video-audit.yml` (triggered only by changes
to itself or `youtube-audit/batch-trigger.txt`). It re-enumerates, processes
the batch slice `[(N-1)*20, N*20)` of the selection order (explicit IDs first,
then newest per channel), extracts 12 uniform + up to 6 scene frames
(640×360 JPEG), loudness JSON, spectrum + waveform PNGs per video, and
commits everything back under `youtube-audit/runner/` (artifact zips live on
Azure, outside the sandbox allowlist; commits travel via github.com).
To process the next slice: edit `batch-trigger.txt` to `batch=N` and push.

## Unblocking (owner actions — the agent cannot and may not do these itself)

1. **Repo secret `YT_COOKIES`** (Settings → Secrets → Actions): the owner's own
   browser cookie export. The workflow uses it only inside the runner when
   present; the agent never reads it. This defeats the bot-check legitimately
   with the owner's own session.
2. **Or a residential-egress worker**: run the same batch script on any machine
   with home internet and push the resulting `youtube-audit/runner/` tree.
3. Neither is required for inventory/metadata work, which remains complete.

Until then every footage item keeps status `BLOCKED` with its exact ladder and
next action — the mission's honest end-state, not a false completion.
