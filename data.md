# UI Study Data — OmniFrame

How the interfaces people already love are built, measured, and what
OmniFrame took from them. Sources: the user's 85-screenshot Drive corpus,
fresh Krita and CapCut desktop screenshots, and the CapCut marker
documentation set. Everything personal in the corpus was replaced with
demo/test fields; only structural gist (layout, luminance, geometry) was
ever extracted — no OCR, no content.

## 1. The corpus (Drive folder, re-listed 2026-10-19)

- **85 files**, all PNG screenshots (`Screenshot (1..108).png` + 6 dated
  captures). Sizes 7.5 KB – 3.08 MB, most between 150 KB and 1 MB
  (~45 MB total, which is why the folder is studied by gist, not by
  bulk-downloading binaries into the editor repo).
- Device split (OpenCV structural pass, earlier wave): **82 desktop,
  3 ultrawide, 0 portrait/phone** — so a phone layout was designed
  synthetically for the pack, never copied.
- Theme split: **57 dark (67%) / 28 light (33%)**. Dark wins 2:1 in the
  wild, but one in three screens is light — a serious editor needs both,
  which is why the shipped set includes a true light style.
- Apps identified by layout fingerprint: File Explorer, Chrome/Edge,
  Spotify, Krita, CapCut, VS Code-class editors, Windows/macOS shells.
  Per-app UI-element packs were bisected from these (window chrome,
  title bars, cursors, player chrome) with demo fields only.

## 2. What repeats (element inventory)

| Element | Where it appears | Measured habit |
|---|---|---|
| Top app bar | every app | 40–56 px tall, actions right, brand left |
| Icon rail (left) | Krita, CapCut, VS Code, OmniFrame | 48–72 px, icon-first, label on hover/active |
| Card grid | CapCut, Spotify, Explorer | 10–14 px radius, 12–16 px gutters, thumb 16:9 or 1:1 |
| Dockers/panels | Krita, NLEs | context-following, tabbed, collapsible |
| Timeline bottom third | all editors | ruler on top, lanes below, transport above ruler |
| Accent colour | all | exactly ONE accent hue per screen; everything else neutral |
| Colour-as-meaning | CapCut markers, Krita layer colours | hue = job (beat/fix/cue), never decoration |

## 3. The math of why it reads "good"

- **Three-step luminance ladder.** Panels sit in 3 depth steps
  (≈ #0c → #16 → #23 in OmniFrame ink terms). Each step is a just-
  noticeable difference (~1.4× luminance ratio); a fourth step adds
  noise, two steps look flat. Krita and CapCut both use exactly 3.
- **Text contrast floor.** Secondary text must clear WCAG AA 4.5:1.
  OmniFrame's ink-300/400/500 ramp measures 9.59 / 6.67 / 4.57:1 at
  worst — the previous ramp (1.9–3.2:1) is what "horrible settings"
  usually is: pretty grey text nobody can read.
- **Accent sparsity.** P(accent pixel) < 2% of screen area in every
  reference. The Import/Export button is the loudest object on screen;
  if everything is violet, nothing is. Palettes therefore move ONE
  hue, never the neutrals.
- **Radius = audience signal.** Consumer tools (CapCut) cluster at
  10–18 px radius + pill buttons ("friendly, touchable"); pro tools
  (Krita, Premiere) at 0–4 px ("precise, engineering"). Same features,
  different promise — so radius is a *style* axis, not a preference.
- **Density = root size.** Krita fits ~15% more controls per panel by
  running an effective 15 px root and square corners; CapCut breathes
  at 16 px+. Density is shipped as a style property, not a zoom hack.
- **P(dark) = 0.67** in the corpus, but P(light) = 0.33 is far too big
  to ignore; the light style must invert the text ramp, not just the
  background (a naive invert leaves white-on-white headings).
- **Markers: hue carries the job.** CapCut's own guide maps colour →
  task (fixes red, structure purple, captions yellow…), and editors
  (Premiere/Shotcut/CapCut) converge on: M adds instantly, M again or
  double-click opens a *small* popup, right-click opens a menu,
  Shift+M navigates. OmniFrame's five purposes come straight from
  this table (see §5).

## 4. Ten UI look ideas generated from the study

1. **Clean Cut** (CapCut) — lifted charcoal, 10–18 px radii, pill
   buttons, card-grid grouping. **→ shipped as a style.**
2. **Workshop** (Krita) — warm neutral grays, 3 px corners, 15 px
   dense root, docker-first. **→ shipped as a style.**
3. **Pro Blue** (Premiere/NLE) — blue-gray stack, 4 px corners,
   engineering blue. **→ shipped as a style.**
4. **Daylight** — paper light theme, inverted text ramp, soft borders.
   **→ shipped as a style (the light theme).**
5. **OmniFrame** — the house ink/violet look, kept as default.
   **→ shipped (default).**
6. *Broadcast* — darker than dark, tally-red accents, oversized
   transport for live switching. Deferred (niche).
7. *Paper Cut* — cream/paper panels, serif headings, print-proofing
   feel. Deferred (Daylight covers the light need).
8. *Glass* — translucent blurred panels over the preview. Deferred
   (GPU cost + readability risk at 4.5:1 floor).
9. *Mono* — pure grayscale, accent = white, for colour-blind-safe
   grading checks. Deferred (valuable; candidate next wave).
10. *Touch* — 20 px root, 44 px targets, bottom-sheet panels for
    tablets/phones. Deferred (needs layout work, not just CSS).

Shipped in Settings → Appearance: **5 styles × 3 palettes (Violet /
Amber / Teal)**, live-applied via `html[data-ui-style]` /
`html[data-ui-palette]`, persisted in localStorage
(`omniframe.uiStyle`, `omniframe.uiPalette`). Styles change corners,
density, and panel depth — no feature appears or disappears.

## 5. Marker colour semantics (drove the marker system)

| Purpose | Colour | Job |
|---|---|---|
| Beat | amber `#f59e0b` | cut points, shake hits, drops |
| Section | purple `#a855f7` | intro / verse / chorus / bridge structure |
| Note | sky `#38bdf8` | "come here" reminders with text |
| Fix-it | red `#ef4444` | mistakes, sync issues, caption fixes |
| Cue | green `#22c55e` | audio cues and entrances |

Coincident markers combine into one flag: ≤4 colours render as hard
slices (a 15-way split is unreadable, so beyond 4 it becomes a
gradient + count badge). Scope is explicit — main-timeline ruler or a
clip's top edge — and transfers are range-limited to the clip's span.
Beat marking is automated two ways: Auto Beat (onset-flux
autocorrelation grid, snapped to real hits, forgiving) and Custom
Auto Beat (one user-trimmed 0.5–2 s beat used as a normalized
cross-correlation template; matches anchor to the template's peak).

## 6. Honesty box

- The Drive binaries were listed and measured, not bulk-downloaded
  (≈45 MB of personal screenshots do not belong in a git repo or a
  model context); the device/theme statistics come from the earlier
  OpenCV gist pass over the same folder and are re-stated as such.
- Reference screenshots of other apps were viewed for structure only
  and are not committed; Krita is not installed in the sandbox.
- No screenshot content was OCR'd or reproduced; pack assets use
  demo/test fields throughout.
