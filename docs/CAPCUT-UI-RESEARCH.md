# CapCut Desktop UI Research

**Purpose:** reference study of how CapCut desktop displays its UI and effects,
to keep OmniFrame's editor converging on the same ease-of-use. Compiled from
CapCut's own resources, icon-level documentation, and 26 saved reference
screenshots (see the [screenshot index](#screenshot-index)).

**Method note:** the screenshots were collected via image search and saved to
`docs/research/capcut/` for visual reference (open them side by side with this
doc). Captions come from the source pages. The structural analysis below is
from written documentation of the app, cross-checked across five independent
sources.

Sources:
- TechPP — "What Do Various Icons and Symbols Mean in CapCut Desktop" (icon-level walkthrough of every toolbar, panel and symbol)
- Filmora/Wondershare — "CapCut Timeline Guide" (timeline anatomy + shortcuts)
- eMotion Video — "The 2025 CapCut Desktop Guide" (PDF training manual: four-panel model, effect application)
- CapCut official resources (capcut.com/resource pages)
- CapCut Guide, Tuts+, ContentCreatorTemplates, Primal Video, Cursa (effects browsing, workflow, workspace comparison)
- LC Editing — "CapCut 101: How to use Graphs Function" (transcript; keyframe graphs)

---

## 1. Workspace anatomy — the four-panel model

CapCut desktop is a strict four-panel layout:

| Panel | Location | Contents |
|---|---|---|
| **Media Library** | top-left | import, stock, and the eight asset tabs (below) |
| **Player** | top-center | preview with playback controls under it |
| **Adjustment / Inspector** | top-right | context-sensitive properties of the selection |
| **Timeline** | bottom | multi-track edit area with its own toolbar |

Additional chrome: a top-right bar (window layouts, shortcuts, share, export)
and an optional status/footer strip. The player can be resized by dragging;
panels can be **detached into separate windows** (see §7).

Key mental model (Cursa's phrasing, worth copying in our empty-states):
- Media bin = *what you have*
- Timeline = *what you use, in order*
- Inspector = *how the selected thing behaves*
- Export = *final delivery settings*

## 2. Left rail & media panel — the eight tabs

Exact tab order (confirmed by the r/CapCut screenshot `10-left-rail-tabs-and-categories.png`):

> **Text · Media · Audio · Stickers · Effects · Transitions · Captions · Filters**

…plus **Favorites** and **Light** (stock/"light" library) entries in some builds.
Each tab is an icon in a narrow left rail; the selected tab fills the wider
panel next to the rail with a thumbnail grid.

Panel behaviors:
- **Search bar** across the top; a loading indicator while library loads.
- **Grid / list view toggle** + sort (by type, date, size).
- **Hover a video thumbnail → live scrub preview** of the clip inside the
  thumbnail ("Preview Axis" behavior in the media panel too).
- Effects and transitions render as **animated thumbnails** — hovering shows
  the effect in motion; some require a cloud download (download badge on the
  thumbnail) and land in a local library.
- Clicking the **+** on a thumbnail appends to the timeline; **dragging**
  places it precisely (also to a specific track/layer).

Effects tab subcategories (the category chip row inside the Effects panel,
from the same screenshot): *Trending, New Year, Lumin, Flash, Glare II,
Classic, Hits, Overlay, Dark, Camera Glow, Camera Blur, Scorched, Dynamic,
Smear, Basic, Mask, Slide* — i.e. **mood/name-based chips, not technical
taxonomy**. On desktop the first split is **Video effects / Body effects /
AI effects / Photo effects**; the gallery defaults to **Trending**.

Filters tab: photo-app style filter presets (mood/look names). Adjustments
tab: brightness/contrast/saturation/hue etc. as its own library item that can
be dropped on a clip.

## 3. Player (preview) controls

Under/beside the preview, CapCut shows a compact control row:
- **Sound on/off** for preview playback
- **Play / Pause**
- **Fit-to-screen** (zoom preview to window)
- **Aspect-ratio switcher** (16:9 / 9:16 / 1:1 …)
- **Full-screen preview**
- **⋯ More menu** — including "take a picture of the current frame" (snapshot
  to still) and frame-paint options

The preview window is resizable by dragging its edge.

## 4. Right panel — context-sensitive inspector

Appears when a clip/text/audio/effect is selected. Top of the Video tab, in
order (TechPP's icon breakdown, `15-right-panel-video-tab.jpg`):
1. **Alignment tools** (left/center/right, top/middle/bottom)
2. **Reset** — one-click restore of that section's defaults
3. **Keyframe diamond** — per animatable property (position, scale, rotation,
   opacity, …); adds start/end points for that property at the playhead
4. **Distribute horizontally / vertically** (multi-select)

Then the property groups: **Video** (crop/cutout, mask, transform, speed,
animation…), **Audio** (volume, fade in/out, voice effects/Synth, noise
reduction), **Text** (font, styling, animation) — switching tabs by clip type.

Inspector behaviors worth copying:
- Property rows pair **label + numeric input + keyframe diamond + reset**.
- Changing selection swaps the whole panel content (no manual switching).

## 5. Timeline

Toolbar — left side (icon-only, no labels):
- **Select tool** (with modes: default select, split-mode select,
  select-left, select-right)
- **Undo / Redo**
- **Split** (Ctrl+B) · **Split & delete left** · **Split & delete right**
- **Delete**
- **Add marker**
- **Freeze** (inserts a frozen still at the playhead)
- **Reverse · Mirror · Rotate · Crop ratio**
- **Transcript** (speech→captions), **Split scenes** (AI scene split),
  **Remove background**, **Extract audio**, **Voiceover mic**

Toolbar — right side (toggle cluster):
- **Main-track magnet** (no gaps allowed on the main track)
- **Auto-snapping** (all other clips/layers snap)
- **Linkage** (effects/captions stick to the clip below them — move/delete
  together)
- **Preview axis** (hover over a timeline clip → scrub its thumbnails live)
- **Zoom: fit / in / out**

Track headers (left of each track): type icon (video / 🎵 audio / "T" text /
effect), **Lock**, **Eye** (hide), mute for audio. Compound clips via
**Alt+G** (group selected into one nestable clip).

Timeline body behaviors:
- Clips show **filmstrip thumbnails that scrub on hover**
- Waveforms on audio clips (used to spot silence)
- Effect segments sit on **their own effect track** above the clip, with
  handles to trim the affected range

## 6. Effects & transitions — how they're actually applied

Two application models (eMotion guide):
1. **Drag onto a clip** — effect applies to the whole clip.
2. **Drag onto a layer/track above the clip** — the effect becomes its own
   timed segment you trim and position; *Linkage* keeps it glued to the
   clip below.

Transitions: drag between two clips (drop zone appears), or click the
transition chip between clips; **Apply to all** propagates the chosen
transition to every cut. Transition categories (Sheetly cheat sheet): Basic,
Zoom, Slide, 3D, Blur, Glitch, Light, Mask, Distort, Trending.

## 7. Window & layout management (top-right bar)

The Windows icon opens layout presets: **Default, Media, Attributes** — plus
**reset layout**. Critically: *"you can… replace any windows in CapCut and
resize them, and also make the window a separate window. You can grab the
window and place it anywhere on the screen."* — i.e. every panel is
**dockable/floatable/tear-off**, matching the poppable-docker direction we
already built (SlideDock/−/+, FloatingWindow, CapCut Studio preset).

## 8. Export screen

Deliberately text-labelled (no icon soup): project name, folder picker,
**resolution, frame rate, format (MP4 default), codec (H.264 default),
bit rate** (quality/size), **AI Ultra HD** upscale toggle, and **sync to
CapCut cloud**. Duration readout on the left. Frame export: PNG/JPEG with
compression + transparency options.

## 9. Keyframes & the Graph panel

- Keyframes are added from the **inspector's per-property diamond** (and
  appear as diamonds on the clip in the timeline).
- The **Graph** panel (per the LC Editing tutorial) shows: **X = time from
  keyframe 1 → keyframe 2, Y = value/distance of the motion**, with **four
  presets + Custom** (draggable points; a point's height = progress toward
  the destination at that time; points above the end value = overshoot).
- Graph button lives in the inspector's Animation section; the panel stays
  empty until **two keyframes** exist on the property.

---

## 10. OmniFrame mapping — where we match, where we differ

### Already matching (validate, don't rework)
| CapCut behavior | OmniFrame today |
|---|---|
| Four-panel workspace | LeftDock · Preview · RightPanel · Timeline |
| Eight-tab left rail | 11 categorized tabs incl. Media/Text/Transitions/Effects/Audio |
| Per-property keyframe diamonds in inspector | `keyframe-diamond-*` rows in Transform section |
| Graph X/Y semantics + 4 presets + custom | GraphEditor (CapCut-style pass: diamonds, thumbnails, segment band) |
| Detachable/floatable windows | FloatingWindow + pop-out buttons + drag-out gestures on all docks |
| Layout presets + reset | Workspace presets incl. 'CapCut Studio' & 'Cinema' |
| Filmstrip thumbnails on clips | ClipFilmstrip (real decoded frames, compound composites) |
| Track lock/hide/mute | Track headers |
| Split/split-delete/marker tools | Timeline toolbar |

### Gaps (ranked by user-visible value)
1. **Hover-scrub everywhere** — CapCut scrubs clip thumbnails in the media
   panel AND on timeline clips ("Preview Axis" toggle). Our filmstrips are
   static; adding pointer-hover scrub to `clip-filmstrip-tile` rows and
   MediaPanel cards is the single most "CapCut-feel" item left.
2. **Effect tracks / layered application** — CapCut effects land on their own
   timed layer above a clip (trimmable), with **Linkage** to the clip below.
   Our effects are clip-attributes only; an effect-segment layer model would
   match user expectations coming from CapCut.
3. **Effects library presentation** — CapCut uses **animated thumbnails in a
   grid with mood-name category chips** (Trending/Classic/Glitch/…) and
   cloud-download badges. Our EffectsPanel is a parameter list; restructuring
   as a thumbnail gallery with category chips would match.
4. **Apply-to-all transitions** — one click propagates a transition to every
   cut; we have no bulk transition action.
5. **Inspector "Reset" per property group + alignment/distribute row** —
   CapCut puts alignment, reset, and distribute at the top of the Video tab;
   we have transform inputs but not the quick alignment row.
6. **Preview snapshot ("take a picture of the frame")** — export current
   frame as still, PNG/JPEG options. We export video only.
7. **Player sound toggle + aspect-ratio switcher in the preview control
   row** — we have zoom/safe/etc. but no mute-preview or ratio quick-switch
   in the cluster.
8. **Freeze frame + reverse/mirror/rotate as one-click timeline tools** —
   partially present (context menu), not surfaced as toolbar icons.
9. **Text captions workflow (Transcript)** — CapCut converts speech to
   caption tracks; we have text clips but no transcript pipeline.

### Design cautions
- CapCut keeps the timeline toolbar **icon-only with tooltips** — matches our
  declutter rule (icon+tooltip over verbose text).
- CapCut's effect names are **mood-based, not technical** ("Scorched",
  "Camera Glow") — copy the naming style, not internal jargon.
- The export screen is the one place CapCut **uses text labels instead of
  icons** — clarity over density for delivery settings.

---

## Screenshot index

All files in `docs/research/capcut/` (manifest: `manifest.json`):

| File | What it shows | Source |
|---|---|---|
| 01-full-layout.jpg | Full desktop editor layout | diyvideoeditor.com |
| 02-top-right-bar.jpg | Window layouts / shortcuts / export bar | techpp.com |
| 03-interface-top.png | Interface hero | diyvideoeditor.com |
| 04-fullscreen-button.png | Full-screen preview button | createthat.ai |
| 05-mobile-ui.jpg | Mobile UI (cross-platform reference) | diyvideoeditor.com |
| 06-transitions-tab.png | Transitions tab grid | contentcreatortemplates.com |
| 07-transition-on-clip.png | Transition on timeline | contentcreatortemplates.com |
| 08-apply-to-all.png | Apply-to-all button | contentcreatortemplates.com |
| 09-tv-noise-effect.png | TV-noise effect preview | capcut.com |
| 10-left-rail-tabs-and-categories.png | Left rail tabs + effect categories | reddit.com/r/CapCut |
| 11-keyframe-animations.png | Keyframes on a clip | createthat.ai |
| 12-graph-empty.png | Graph panel, empty state | videowizardtools.com |
| 13-graph-linear.png | Linear graph between keys | videowizardtools.com |
| 14-graph-button.png | Graph open button | videowizardtools.com |
| 15-right-panel-video-tab.jpg | Inspector Video tab icons | techpp.com |
| 16-right-panel-top.jpg | Right panel top bar | techpp.com |
| 17-transform-controls.png | Position/scale/rotation (official) | capcut.com |
| 18-crop-mobile.png | Crop controls (mobile) | createthat.ai |
| 19-timeline-toolbar.jpg | Timeline toolbar | filmora.wondershare.com |
| 20-shortcut-settings.png | Shortcut settings | createthat.ai |
| 21-timeline-zoom.jpg | Timeline zoom controls | tourboxtech.com |
| 22-zoom-effect-edit.jpg | Zoom effect on timeline | tourboxtech.com |
| 23-export-frame-dialog.webp | Frame export dialog | capcutguide.com |
| 24-shortcut-panel.png | Shortcut panel | createthat.ai |
| 25-frame-format-choices.webp | PNG/JPEG frame export | capcutguide.com |
| 26-frame-from-timeline.webp | Still from timeline moment | capcutguide.com |

*Captions are taken from the source pages; images are saved for the team's
visual reference (26 files, ~3.9 MB).*
