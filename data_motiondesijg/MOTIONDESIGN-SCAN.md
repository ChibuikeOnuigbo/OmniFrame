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
