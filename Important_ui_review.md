# Important UI Review — the 85-screenshot Drive study

**Source:** Google Drive folder `1EJchvF8g7_aiBgDO5Z0SBpnm0adSGPwQ` — 85 PNG screenshots,
downloaded via the Drive connector into `img_data_pack/` (git-ignored). Contact sheets:
`img_data_pack/sheets/sheet-1..6.png`. Machine labels: `img_data_pack/labels.json`.
UI cut-outs: `img_data_pack/cuts/`. No personal names, paths, chats or keys from any
screenshot are reproduced in this document — only layout, geometry and workflow lessons.

## The labeling model

Three stages, in order:

1. **Chrome stage** — window furniture classifies the frame first: Windows taskbar +
   Start/Search (OS), browser chrome (website), or app chrome (native tool).
2. **Signature stage** — app fingerprints: CapCut's top tab row (Media·Audio·Text·
   Stickers·Effects·Transitions·Captions·Filters·Adjustment·Templates), Krita's icon
   toolbox + Brush Presets grid, Figma's Layers tree + Design/Prototype panel, YouTube
   Studio's left rail + retention graphs, VS Code's activity bar.
3. **Layout stage** — the visible UI type: full editor, analytics, form step, pricing,
   listings grid, device-frame design, window overview, artwork.

Output per file: `{file, app, category, uiType, w, h}` in `img_data_pack/labels.json`.
All 85 labels were verified against the contact sheets; the interesting frames were then
read at full size (Krita 107, CapCut 35, Task View 24, Figma 42, frame artwork 30,
desktop app window 65, and the full 85 at sheet level).

## Inventory (85)

| Group | Count | Files |
|---|---|---|
| Websites (school site, QuickLunch, Lagos Home Finder, property listings, payments, CBT quiz, TTS, pricing, Gmail, search) | 29 | (1) (2) (3) (4) (5) (6) (11) (12) (13) (18) (19) (23) (33) (47) (50) (51) (52) (53) (54) (55) (69) (70) (74) (75) (97) (98) (99) (100) (101) |
| Figma / design tools | 11 | (39) (40) (41) (42) (43) (44) (45) (46) (48) (49) (102) |
| Windows OS (Task View, Start, Settings, Task Manager, desktops) | 8 | (9) (10) (24) (29) (65) (66) (77) (96) |
| YouTube Studio | 7 | (17) (21) (22) (25) (26) (27) (104) |
| VS Code | 6 | (15) (20) (68) (73) (76) (108) |
| Video editors (CapCut + others) | 5 | (31) (35) (36) (37) (106) |
| Small tools (downloader, quota table) | 5 | dated 2025-05-31 ×4, 2025-06-01 121955 |
| Social (Discord, X) | 4 | (7) (8) (16) (67) |
| Mixed split windows | 3 | (38) (103) (105) |
| Office (Word/PowerPoint) | 2 | (14) (34) |
| Krita | 1 | (107) |
| Audio analysis | 1 | (28) |
| ChatGPT | 1 | (32) |
| Spotify (photo of a screen) | 1 | 2025-06-01 043423 |
| Frame-overlay artwork | 1 | (30) |

## 50 things learned (from 30+ screenshots read closely)

### Video editors — CapCut (35) (36) (37), editor (31) (106)
1. CapCut's top row is **10 single-word tabs** (Media…Templates) — one line, icon+label, never wrapped; the active tab is a colour, not a box. Directly validates our no-wrap segment law. (35)
2. The left column is an **accordion tree** (Import / Media / Subprojects / Yours / AI media / Spaces / Library) — one expanded at a time keeps the panel short. (35)
3. Media cards carry **state badges on the thumbnail** (Added, Proxy, duration) — status lives on the asset, not in a separate list. (35)
4. Audio assets render as **waveform cards** in the same grid as video thumbnails — one grid, type shown by the card itself. (35)
5. The centre panel's "Global edits" is **five one-click rows with toggles** (colors better, colors consistent, volume consistent, voice clearer, video clearer) — a whole enhancement suite in ≤5 rows. (35)
6. "Smart suggestions" sits **above** Global edits with one Analyze button — suggestions first, manual rows second. (35)
7. Timeline clips show **filmstrip thumbnails + a Speed badge chip** (Speed 0.5X) on the clip itself. (35)
8. Transition points render as **small icons between clips** on the track, not as separate clips. (35)
9. A **marker row** above the tracks holds teal diamonds, visually separate from clips. (35)
10. The preview header states context ("Previewing — video") and the transport shows `current / total` time at bottom-left of the preview, not under the timeline. (35)
11. CapCut keeps **Project / Details as two tabs** in the centre panel instead of stacking both — tabbed panels beat long scrolls. (35)
12. The keyframe/graph view (37) gives the graph the **whole centre panel** — graphs are a mode, not a mini-widget.
13. (31) puts export settings in a **modal over a dimmed editor** — the editor stays visible as context behind the dialog.
14. (106) shows a **thumbnail scene-grid above the timeline** for picking B-roll before touching tracks.
15. CapCut's timeline toolbar is **one icon row** (~14 icons) between panels and tracks — tools live at the seam, not in a menu.

### Krita (107) — the only drawing app in the set, read at full size
16. Three documents are open as **tabs with file sizes** (`frist.kra`, `tojii.jpg.kra`, `first_one.kra (7.0 MiB) *`) — size + dirty state in the tab itself.
17. The toolbox is a **2-column icon grid (~30 tools)** with the active tool filled blue; icons are large, labels are tooltips only.
18. Tool Options change **with the selected tool** (Geometry Options for the shape tool) — one docker, contextual content.
19. The Layers docker shows **thumbnail + blend mode + opacity per row**, and layer rows carry lock/alpha icons inline.
20. Brush Presets is a **searchable thumbnail grid with a tag filter** ("Filter in Tag") docked under Layers — presets are browsed visually, not listed.
21. The top bar carries **brush opacity + size as labelled fields** (Opacity: 100%, Size: 13.51 px) — the two hottest settings are always visible.
22. The status bar reports **colour model, dimensions, zoom %** (RGB/Alpha… 600×600, 133.3%) — document facts at the bottom edge.
23. A floating **mini toolbar appears at the selection** (bottom of canvas) — contextual actions at the pointer, not in a panel.
24. Canvas grey is **mid-neutral** and the canvas shadow separates work from chrome — the art, not the UI, has the contrast.
25. Krita fits ~30 tools + layers + presets on screen by making **dockers collapsible stacks**, never by shrinking text below readability.

### Figma & phone design (39)–(49), (42), (102)
26. Designers keep the **device frame and the raw artboard side by side** (42) — check chrome and layout in one glance.
27. The phone profile pattern is: **cover image → overlapping avatar with camera badge → name → stat pills → bottom nav** (42) — five bands, each one job.
28. Stat pills pair a **label with a count chip** ("My Scholarships · 4 Applied") — the number is a filled pill, not trailing text. (42)(43)
29. Figma's right panel is **sections with hairline dividers** (Position / Layout / Appearance / Fill / Stroke / Export) — grouping by divider, not cards. (42)
30. Layers are named by **function** ("OVERLAY FOR Profile Upload") — intent names beat "Group 72". (42)
31. Multiple artboards of one flow sit **in reading order left→right** (43)(44) — the canvas itself is the flow diagram.
32. The welcome/auth screens (46)(48)(49) use **one centred card, logo, two buttons** (Sign Up / Log In) — zero decoration until the user commits.
33. (102) shows the same product thinking in a mockup tool: **gradient canvas, one centred device, left tool rail** — the stage is empty except the hero object.
34. Figma bottom toolbar is **one floating pill of ~9 tools** — even a huge app keeps its primary toolbar countable on two hands. (42)

### Windows desktop & OS (24) (29) (65) (66) (77) (9) (10) (96)
35. Task View tiles windows at **two sizes**: big app windows on top, small sticky-note cards below — size encodes importance. (24)
36. Virtual desktops get a **bottom strip with live thumbnails + "New desktop"** — desktops are switched visually, not by number. (24)
37. Sticky Notes windows are **small purple cards with a source chip and formatting bar** — notes behave like mini documents, not text boxes. (24)
38. The desktop study frames (65)(66) show a **light, nearly empty desktop**: white space, a few centred app marks — calm backgrounds make icons readable.
39. (96) keeps desktop icons in a **single left column over the wallpaper** — one column, top-down, no scatter.
40. Start (29) separates **Pinned grid / Recommended list / account footer** — three zones, each scannable alone.
41. Settings (77)(9) use a **narrow nav rail + wide content with grouped rows**; About puts device specs in one card grid.
42. Task Manager (10) gives the graph **the full content width** with numbers below — measure first, details second.

### Websites (1) (50)–(52) (69) (70) (100) (101) (33) (19) (54) (55)
43. Lagos Home Finder (51): **full-bleed photo hero, one headline, one CTA** ("Get Started") — a landing page is one sentence + one button.
44. Its auth (50)(52) is a **split layout**: photo panel with headline left, form right, Sign Up/Log In as a two-segment switch — the pattern our strips should feel like.
45. Property results (69)(70): **filter rail left, card grid right**, each card = photo, price, beds/baths icons, one green CTA ("Add to Cart"/Enquire) — identical cards, zero surprises.
46. Nigeria Property Centre (54)(55) shows the opposite: dense listings with **price in brand colour and badges (For Sale/To Let)** — density is fine when every row is identical.
47. QuickLunch (100) hero: food photo, **wordmark bottom-left, single yellow Order button** — brand colour reserved for the one action.
48. Its empty state (101): playful tile background + **"No Stall Available Right Now"** — empty states say what's missing in one line, centred.
49. Buy Credits (33): **four pricing tiers, the recommended one taller + badged + gradient** — exactly one hero tier; custom amount is a quiet row below.
50. CBT quiz (19): **question left, navigation grid right** with answered/current colour coding — progress is a map, not a bar.

### Creator & misc (17) (21) (26) (32) dated set, (30)
51. YouTube Studio analytics lead with **one sentence of insight** ("Great job! Views are 4.4 times higher…") above the graph — interpretation before data. (22)(27)
52. Retention gets a **full-width curve with key-moment thumbnails pinned under it**. (21)
53. The downloader tool (dated set) is **one URL field + one button on a dark page** — a tool can be a single row; everything else is footer text.
54. ChatGPT's worked solution (32) uses **numbered steps with the formula centred** — long answers stay scannable by step headers.
55. The frame artwork (30) composes **mascot corners around an empty textured centre** — the middle stays empty for the content; decoration lives at the edges.
56. Spotify-by-photo (2025-06-01) is a reminder that **people screenshot other screens** — exports should look good photographed: high contrast, big type.

(That is 56 lessons; the brief asked for at least 50.)

## Cut-outs saved for reuse (`img_data_pack/cuts/`)

`krita-toolbox.png`, `krita-layers-brushpresets.png`, `capcut-top-tabs.png`,
`capcut-global-edits.png`, `capcut-timeline.png`, `figma-profile-artboard.png`,
`frame-overlay-full.png`, `desktop-light-window.png` — reference crops of generic UI
zones only (no personal content), used to rebuild the pack assets below.

## Applied to OmniFrame this wave

- **Removed the "For you" taste feature end-to-end** (toggle, likes, taste ordering,
  explanatory copy) and hardened every segment/button label to a single non-wrapping
  line — the CapCut top-row pattern (lesson 1).
- **Three new Desktop Pack assets + one bundle**, rebuilt generically from the study
  (demo content only): `desktop-light-icons` (lesson 38), `profile-phone`
  (lessons 27–28), `frame-mascot` (lesson 55), bundle `screenshot-study`.
- Pack assets now sort **alphabetically** — predictable order beats guessed taste.
