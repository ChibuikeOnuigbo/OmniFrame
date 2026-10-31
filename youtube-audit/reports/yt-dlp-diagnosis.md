# Report — Why yt-dlp works where it works (per-environment diagnosis)

Date: 2026-10-21. All claims below cite logs in `youtube-audit/errors/`.

## Bottom line
yt-dlp **the software** works fine in every environment where it is allowed to
run. What differs per environment is the *network path* and *YouTube's trust
decision about the IP the request comes from*:

| Environment | DNS | TCP:443 | TLS/HTTP | yt-dlp metadata | yt-dlp media download | Blocking reason |
|---|---|---|---|---|---|---|
| Arena sandbox | ok | ok | **RESET** | impossible | impossible | egress SNI allowlist (youtube.com not permitted) — nothing to do with yt-dlp |
| Arena text gateway | n/a | n/a | 200 (text proxy) | watch pages only | impossible | renders HTML as text; channel pages behind sign-in wall |
| **GitHub Actions runner** | ok | ok | **200, 1.3 MB probe** | **WORKS** (248 videos enumerated) | **BLOCKED** | YouTube bot-check vs datacenter IP: "Sign in to confirm you're not a bot" |
| Runner → sandbox artifact return | n/a | n/a | EOF | n/a | n/a | artifact zips live on Azure Blob (`productionresultssa17.blob.core.windows.net`), outside sandbox allowlist — solved by runner git-committing evidence instead |

## The key distinction: enumeration vs download
yt-dlp does two different jobs against YouTube, with different trust rules:

1. **Enumeration/metadata (works from the runner).** Flat-playlist extraction
   reads public watch/playlist page HTML+JSON. Abuse checks here are light —
   that is how the runner inventoried all 248 channel videos with zero
   errors (`youtube-audit/runner/inventory.json`).
2. **Stream download (blocked from the runner).** Getting actual media requires
   the InnerTube *player* API to issue signed stream URLs. YouTube gates this
   on **IP reputation**: requests from cloud/datacenter ASNs (GitHub-hosted
   runners are Azure datacenter ranges) without an authenticated session are
   refused with the bot-check, on *every* player client we tried
   (default, `tv`, `android`, `web_embedded` — verbatim errors in
   `errors/bpUZkFVX6NY.txt` and the other per-video ladders). Since 2024 the
   `web` client additionally wants a PO (proof-of-origin) token that only a
   real browser session on a trusted IP produces, so client-switching alone
   cannot fix it.

## Why the mirrors failed too
Public Invidious instances proxy the same player API *from their own
datacenter IPs*, and YouTube has blacklisted most of them; the instances
themselves also rate-limit or reject cloud callers. Observed from the runner:
403 (f5.si, nadeko, yewtu.be), 401 (nerdvpn), unreachable (melmac,
tux.pizza timeout), TLS alert (artemislena) — full list in the per-video
error logs. So both the direct route and every public proxy route die on the
same root cause: **datacenter-IP distrust**.

## Why the sandbox can't even try
The sandbox resolves youtube.com (AAAA records returned) and completes TCP to
port 443, but the TLS handshake is reset because the sandbox's outbound proxy
only allows an SNI allowlist (github.com, npm, pypi…). This is infrastructure
policy, not a yt-dlp bug, and no yt-dlp flag (`--impersonate`, proxies,
`--no-check-certificates`) can bypass it — the reset happens before HTTP.

## What makes yt-dlp actually download here
1. **Owner-set repo secret `YT_COOKIES`** (already wired into
   `.github/workflows/video-audit.yml`): an authenticated session cookie makes
   the runner's requests pass the bot-check; the agent never reads the secret.
2. **Residential-egress worker**: the same batch script run from a home
   internet IP — YouTube does not bot-check residential ranges for
   unauthenticated streams.
3. **Self-hosted Invidious/Piped on a non-blacklisted IP** — not available in
   this setup.

Until one of those gates opens, the honest state is: inventory complete (250),
downloads blocked (5 attempted, all logged), watched = 0.
