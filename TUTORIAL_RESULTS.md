# Tutorial replication results

Every entry below is a real published tutorial for a named editor. Each was
replicated step by step inside OmniFrame by `qa/tutorials/runner.mjs`, which
records PASS / FAIL / BLOCKED per step. FAIL means OmniFrame cannot perform
that step — the point of the exercise is to surface those honestly.

Last run: 2026-10-01T23:40:50.657Z

## Scoreboard

| Tutorial | App | Verdict | PASS | FAIL | BLOCKED |
|:---|:---|:---|---:|---:|---:|
| Remove a background automatically (Cutout > Remove Background) | CapCut | **REPLICATED** | 16 | 0 | 0 |
| Chroma key a green/blue screen and key it over a new background | CapCut | **PARTIAL** | 6 | 2 | 0 |
| Ripple delete — remove a clip and close the gap (Shift+Delete) | Adobe Premiere Pro | **REPLICATED** | 10 | 0 | 0 |
| Add an edit at the playhead (Ctrl+K) | Adobe Premiere Pro | **REPLICATED** | 8 | 0 | 0 |
| Ripple trim to the playhead (Q removes before, W removes after) | Adobe Premiere Pro | **PARTIAL** | 5 | 2 | 0 |
| Track Motion — put a track point on a high-contrast feature and attach a layer | Adobe After Effects | **REPLICATED** | 16 | 0 | 0 |
| Select the subject, refine the edge, and output to a layer mask | Adobe Photoshop | **REPLICATED** | 13 | 0 | 0 |
| Add a transparency mask and paint on it non-destructively | Krita | **REPLICATED** | 13 | 0 | 0 |
| Primary grade with Lift / Gamma / Gain while watching the scopes | DaVinci Resolve | **PARTIAL** | 5 | 3 | 0 |

**6/9 fully replicated** · 3 partial · 0 not supported · steps 92 PASS / 7 FAIL / 0 BLOCKED

A tutorial is REPLICATED when every step passed, PARTIAL when some steps
failed but the core of the procedure works, and NOT SUPPORTED when the
procedure cannot be started at all.

## Per-tutorial detail

### CapCut — Remove a background automatically (Cutout > Remove Background)

- Verdict: **REPLICATED** (16 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/capcut-auto-remove-bg.json`

### CapCut — Chroma key a green/blue screen and key it over a new background

- Verdict: **PARTIAL** (6 PASS / 2 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/capcut-chroma-key.json`

### Adobe Premiere Pro — Ripple delete — remove a clip and close the gap (Shift+Delete)

- Verdict: **REPLICATED** (10 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/premiere-ripple-delete.json`

### Adobe Premiere Pro — Add an edit at the playhead (Ctrl+K)

- Verdict: **REPLICATED** (8 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/premiere-add-edit-split.json`

### Adobe Premiere Pro — Ripple trim to the playhead (Q removes before, W removes after)

- Verdict: **PARTIAL** (5 PASS / 2 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/premiere-ripple-trim-qw.json`

### Adobe After Effects — Track Motion — put a track point on a high-contrast feature and attach a layer

- Verdict: **REPLICATED** (16 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/aftereffects-track-motion.json`

### Adobe Photoshop — Select the subject, refine the edge, and output to a layer mask

- Verdict: **REPLICATED** (13 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/photoshop-select-and-mask.json`

### Krita — Add a transparency mask and paint on it non-destructively

- Verdict: **REPLICATED** (13 PASS / 0 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/krita-transparency-mask.json`

### DaVinci Resolve — Primary grade with Lift / Gamma / Gain while watching the scopes

- Verdict: **PARTIAL** (5 PASS / 3 FAIL / 0 BLOCKED)
- Result file: `qa/tutorials/results/davinci-lift-gamma-gain.json`

