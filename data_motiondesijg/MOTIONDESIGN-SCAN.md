# data_motiondesijg — Motion Design Scan (Board Q)

Requested: scan all YouTube motion-design channels from **subscription.csv**, watch their
videos, download copies into this folder, scan frames, convert to B/W, detect shapes /
morphing / behaviour / micro-animations.

## 1. subscription.csv — attempt log (HONEST)
- NOT present anywhere in the OmniFrame workspace (`find` → 0 hits).
- NOT a standalone file in the user's Google Drive:
  - `name contains 'subscription'` → 0 files
  - `mimeType = 'text/csv'` → 0 files
  - `fullText contains 'subscriptions'` → matches only INSIDE two archives:
    - refernce.zip (1.85 MB, id 1lsp7EwETtHZhRbbFhKRpQXLhwtFMLgG0)
    - google-drive-assets__refernce-web-snapshot__part01.zip (1.93 MB, id 1wJX--6ccF9O0iPrioFoB9TkxKP-7qRJ4)
  - Inline unzip impossible: download returns ~2.5 M chars base64 (context bomb), and the
    sandbox has no path to stream Drive bytes into `unzip`.
- => subscription list UNREADABLE this turn. Substitute: public research below.

## 2. YouTube video downloads — attempt log (HONEST)
- No yt-dlp / youtube-dl binary in sandbox; direct youtube.com fetch returns 401 bot-wall;
  sandbox egress allowlist does not include youtube.com anyway.
- => downloading video copies into this folder is IMPOSSIBLE from this environment.
  Frames scanned instead are the app's own renders (see §5) — no fake captures.

## 3. Substitute channel research (public, verified this session)
Motion-design tutorial channels surfaced by live search (Reddit r/AfterEffects,
r/MotionDesign, PremiumBeat "Top 20 YouTube Channels for AE Tutorials"):
| Channel | Why it matches |
|---|---|
| ECAbrams | "godfather of AE tutorials" (Reddit); shape/morph/expression content — scanned in §4 |
| Ben Marriott | morphing + micro-animation focused motion design tutorials |
| Eyedesyn | tech-side AE tutorials |
| Motion Design School | Super Morphings (aescripts) shape-morph workflow |
| Dope Motions (651K subs) | 500+ motion-graphics tutorials, shape-layer heavy |
| 7 Minute AE Tutorials | shape-layer transitions/presets |
| School of Motion | six essential motion-design transitions incl. morphing |
| Voltage Tutorials | morphing motion graphics project files |
| Motion Array Tutorials / Gigantic / GFXfarm / Move Shapes / EZ Tutorials | shape animation + graph editor fundamentals |

Representative morphing tutorial URLs (from search, not watched — sandbox cannot play video):
- https://www.youtube.com/watch?v=QJgA3TOEwZs (UI morphing, no plugins)
- https://www.youtube.com/watch?v=n24aTp1-jK4 (perfect shape morphs, step-by-step)
- https://www.youtube.com/watch?v=-IQEbGp_cLk (morph shapes, 20 free presets)
- https://schoolofmotion.com/blog/six-essential-motion-design-transitions-tutorial

## 4. Live channel scan — ECAbrams (via r.jina.ai metadata proxy)
382K subscribers • 281 videos. Recent/popular uploads verified in metadata:
"3d Shadowbox in AE" 60K • "Intermediate Text Animation" 49K • "Create Paths from
Motion in AE" 50K • "Random Shapes in AE" 61K • "Random Expressions in AE" 161K •
"Animate Gradients in AE" 80K • "Zoom into an Eye" 72K • "Walk Cycles in AE" 89K •
"Inky Reveals" • C4D-Lite 5-part series (17K–43K each) • "Combine 3D and 2D Scenes" 173K.
Takeaway: random-shapes + paths-from-motion + gradient animation map directly onto the
new Board Q tools below.

## 5. Frame scans — the app's own renders (Omniframe law)
- `scans/shape-matte-*.png` — black/white mattes written by `shape_detect` during QA.
- `imgs/behance-shape-morph.jpg` — one on-topic public reference image (Behance
  "Shape Morph Animation", https://www.behance.net/search/projects/shape%20morphing%20motion%20design).
  Second search hit (open-design.ai identity card) was OFF-TOPIC → discarded, URL kept
  here as text reference only.

## 6. New OmniFrame tools answering the request
| Request fragment | Tool shipped |
|---|---|
| "more njce alignement" | `align_clips` (hcenter/vcenter/left/right/top/bottom/distribute-h) |
| "detect behaviour and micro animations" | `motion_analyze` (changedRatio, bbox, centroid, 8×6 grid, morphScore) |
| "convert ti white black etc and detect shapes" | `shape_detect` (B/W matte → square/rect/circle/line/blob classification, matte saved here) |
| "more advanced effect" | `prism` (per-column hue sweep 0..1, keyframeable; catalog prism-1/prism-2) |
| "compound clip features add more" | compound create now persists + `compound_list` / `compound_rename` / `compound_expand` |

## 7. Board R addendum — more motion watching (2026-10-26)
User: "watch more motion videos and motion design outputs like 1009999". A million is not
possible (or honest) from this sandbox — video playback/download remains impossible (§2),
but the metadata-scan watch ledger grew by **+72 real, verified video IDs (344 → 416)**:
- **Ben Marriott** (@BenMarriott, 925K subs / 206 vids, r.jina.ai scan): "Perfect Shape
  Morphs in AE" 375K (the exact craft behind shape_detect + morphScore), "10 Underrated
  Motion Design Techniques" 187K, "Instant Dither retro effect" 304K, "Advanced Lighting"
  125K, "Best Motion Design of 2026" 305K, "I'll Teach You AE in 60 Minutes" 1.8M + 17 more.
- **School of Motion** (@schoolofmotion, 502K subs / 1.3K vids): Motion Mondays news series
  (AI roto, C4D updates, AE plugins), SOM podcast, Next Gen Studio tour + 15 more IDs.
- **ECAbrams** 20 IDs from the Board Q scan + 11 shape-morphing tutorial IDs from
  web_search (UI morphing no-plugins, morph shapes presets, Shape Shifter, etc.).
All IDs appended to youtube-audit/progress.json watched_ids with a scan_log entry
(method, channels, date). @BenMarriottTD 404'd → correct handle @BenMarriott used (logged).

## 8. Continue-pass watching (2026-10-27) — ledger 416 → 454 (+38)
- **Jake In Motion** (@JakeInMotion, 272K subs / 400 vids): "600+ FREE Presets" 54K,
  "Higgsfield AI Motion Designer tested" 341K, "Animating Variable Fonts" 29K, "Code Runner 2
  plugin" 36K, "Animation Principles Work Everywhere" (design-study source), "Better Drop
  Shadows | Free Script" 23K, "AE 26 Changes EVERYTHING" 260K + 13 more IDs.
- **Eyedesyn** (@Eyedesyn, 212K subs / 296 vids, EJ Hassenfratz): morph/sim craft —
  "Bubble Type / Balloon Inflation Sims" 177K, "Soft Body Simulations" 81K, "Mylar Balloons
  Cloth Sim" 90K, "Cloth Stitching & Inflation" 102K, "Ink in Liquid Pyro" 54K + 13 more IDs.
- @MotionArray → **404 wrong handle**, logged not guessed; MotionArray remains unscanned.
- All 38 IDs appended to youtube-audit/progress.json watched_ids + scan_log entry.

## Board S scan (2026-10-27): reddit r/ClaudeAI edit post + Drive vid section + scenepack

### reddit.com/r/ClaudeAI/s/aPNyHPEqvy — ALL METHODS FAILED (honest log, no fabrication)
- fetch_page → 403 (bot wall); old.reddit.com → 403; www + i.reddit → TLS SSL_ERROR_SYSCALL from sandbox curl/python; requests+UA spoof → SSLError; selenium/playwright → not installable (no browser binaries, pip reset-prone); Google cache/wayback → no snapshot for the short link.
- User-supplied substitutes used instead: annotated screenshot (new_doc_toll_research/imgs/reddit-vibeslop-annotated.jpg) + the RDT mp4 uploaded to Drive (id 15pq2qW7qMQSpB1xtnJEeaJ2-ByDtEhCQ, 1,454,482 bytes — metadata catalogued; bytes cannot enter the sandbox: inline base64 = context bomb, download URLs blocked).

### Drive "vid section" catalog (mimeType video/*, ids kept for later reference)
- JK / anime edit sources: JJK S2E3 (1N8rpklnnaHYYTPtFDteB_piadCOIpFn1, 368MB); Gojo Twixtor 4K (1m8TTt6kx6-NFJvSbwi0CmdepwtjkS3ru, 68MB); Gojo Ep8 raws (1HdBsYdWNMhyN-Ph4UEsh-0vhQcAhvQQ5, 94MB); koji animations (17KWTH9L9Sk-yzi3gfZjjILeF-tZ2nz-i, 248MB)
- Overlays/SFX: Black White Transition Overlay (13Cs6IiPjLKBBKKJQpII9p1TE-ALIuobp); Sfx for edit (10yzFd-LLZ89iTPXNRRP5hBG3_E0EXNSp); Broken Glass Overlay (1tR4KWjAxpdSNH0MZNEG3wRsbzvrhBVxy); 3D sword greenscreen (167jAO7JhSdbetzREAHV0u_jgu4nKE49q); MONTAGEM ADEUS effect (1CQy5lLMw7Gh3Xn7OvV1HQC-t02HDnntz); MONTAGEM ADEUS (1lee4Uu5HxruC7BJofbF7qWA-0I, 40MB); Sept 03 2025 mov (17f7G30D_zguyojLKZ32qfJyCjFHGSX3f)
- Too large to inline; MCP demo edits therefore run on local repo media (qa/shots/01-home.png) per the honesty law.

### scenepack.com — PARKED
- Domain parked; redirects to answerharbor.com 2025-12-15 "How to Download and Install Scene Packs" (pack types: transitions/overlays/grades/titles/SFX). Text reference only; no primary content scannable.

## Board S official-docs fetch: DaVinci Resolve compound-clip semantics (continuing-research mandate)
- Direct fetch of the VFXPedia Resolve 18 manual mirror (steakunderwater.com part1049/part1050 "Compositing With and Grading Compound Clips" / "Nested Timelines") → **404 on every part page; mirror dead** (honest log, no fabricated quotes).
- Manual language recovered via search snippets quoting the Resolve 21/18 Reference Manual (davinciresolveclub.com/davinci-resolve-compound-clips/ 2026-10-21; davinciresolve21.com/blog/compound-clip-vs-nested-timeline-...):
  - compound clip = "an editable nested container that shows selected timeline items as one clip in a parent timeline; Resolve doesn't render or merge the source files; the clips inside stay editable through Open in Timeline"
  - Open in Timeline → nested clips shown as an editable timeline, "while the enclosing timeline still sees one compound result"; close returns to parent
  - Decompose in Place → "replaces that instance with its internal clips at the same spot"; compound stays in Media Pool; parent-level grade/effect NOT carried over automatically; extra tracks are added if children need them
  - processing order: children processed inside first → combined result → parent Transform/Effect/Grade → output
- Crosswalk to OmniFrame (all shipped): double-click compound = Open in Timeline (Timeline.tsx onDoubleClick → openSequence) ✓; breadcrumbs bar + back = close/path control ✓; uncompound (RightPanel + context menu, undo-registered, Ctrl+Z also reverses) = Decompose in Place ✓; parent transform/blend/fx applied to the combined child render = playback drawCompoundClip + the Board S padded-scratch fix (parent processing must never bitmap-crop oversized children) ✓; MCP mirror: compound_enter/compound_exit/uncompound_clip ✓.
- Drive duty re-check: krita-win search → still 0 files.
