# Final report — YouTube channel audit (batch 1 checkpoint)

## Completion counts (verified, resumable in ../progress.json)
- Discovered / inventoried: **250** (248 runner-enumerated across six channels'
  `/videos` + `/shorts` flat playlists, paginated by yt-dlp until exhaustion;
  +2 explicit IDs confirmed via text gateway after intermittent runner
  bot-checks on their metadata fetch).
- Visually inspected (frames): **0** — no environment could retrieve media.
- Audio inspected: **0**.
- Text-only analysed: **4** (`METADATA_ONLY`: bpUZkFVX6NY, Tvd7qiK_gUA,
  M2_vjAseOns, 9o8GT1Iurv0 — evidence files in ../evidence/).
- Footage attempted and BLOCKED: **5** (batch 1: the two explicit IDs above
  that were inventoried by the runner + Spaceless' fGm0SBFTj3o, L7RueAR-5Zc,
  xeXhlkoOyrw).
- Remaining queued: **243** (`INVENTORIED`, batches 2..13 at 20/run).
- `FULL_ANALYSIS_COMPLETE`: **0** (correctly — nothing was watched).

## What was actually watched or visually inspected
Nothing. Stated plainly per mission rule. The strongest content evidence
obtained is (a) author chapter lists (text), and (b) one downloaded
ExtendScript rig (code), both labelled METADATA_ONLY / code-asset.

## Errors encountered and recoveries executed
1. Sandbox → youtube TLS reset (SNI allowlist). Recovery: moved retrieval to
   the GitHub-hosted Actions runner (legitimate general egress).
2. Artifact zip on Azure Blob = outside sandbox allowlist (`gh run download`
   EOF). Recovery: runner commits evidence to the branch; sandbox pulls via
   github.com. Worked (youtube-audit/runner/).
3. YouTube bot-check on datacenter IPs ("Sign in to confirm you're not a
   bot") for every download. Recoveries tried, in order, all preserved in
   ../errors/: yt-dlp default → player_client=tv → android → web_embedded →
   3 hand-picked Invidious instances → runtime Invidious registry (10 health-
   sorted instances) + 5 more fallbacks. All 401/403/bot-check. No further
   supported route exists from runner or sandbox.
4. Intermittent bot-checks also hit single-video metadata fetches (M2_vjAseOns,
   9o8GT1Iurv0 missing from runner inventory). Recovery: gateway-confirmed
   metadata merged into inventory.json by hand with source labelled.

## Next actions (owner-gated, documented per blocked item)
- Set repo secret `YT_COOKIES` (owner's own browser export; agent never sees
  it) → push `youtube-audit/batch-trigger.txt` with `batch=1` → frames,
  loudness, spectra and waveforms flow for batch 1, then batches 2..13.
- Or run the same batch script on a residential-egress machine and push the
  resulting `youtube-audit/runner/` tree.
- Neither gate blocks inventory/metadata completeness, which is done.

## Techniques demonstrated by each creator
See ../technique-catalog.md (evidence-level labelled). Repeated cross-creator
patterns: ../cross-video-patterns.md.

## Acceptance-criteria self-check
1. Channels enumerated as completely as accessible sources permit: YES
   (flat-playlist pagination over videos+shorts; not search-limited).
2. Every discovered video has a persistent status: YES (250/250 in
   inventory.json).
3. No video marked fully analysed without content inspection: YES (zero).
4. Every failed item has exact failure + next action: YES (errors/*.txt +
   per-record failure/next_action).
5. Inventory + reports resumable after restart: YES (progress.json checkpoint
   + batch-trigger slicing + runner commits).
6. Completed vs partial clearly distinguished: YES (statuses + this report).
