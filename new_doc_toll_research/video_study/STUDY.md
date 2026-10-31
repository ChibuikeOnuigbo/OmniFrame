# Video-editor study — Drive folder 1KlxUlem-Qjyd61dLkqs9nk3Ob4bou1Kp (scanned 2026-10-29)

Research-only dump (NOT bundled into the app, per user directive: AM project media stays
user-imported; only CC/LUT/repeated material ships in-app).

## What the folder contains
- `new_study_vdieos` (Google Doc) — y6richo/Jericho editor research: executive findings, the
  Earrings Short timeline reading, effect/tool inventory, implementation requirements, channel
  catalog (788 listed uploads: 557 videos / 167 shorts / 64 lives). **Honesty note:** the Drive
  API result-size limit truncated the doc's middle (sections after 4.2 "Color & Light" inventory);
  sections 1–4.2 and the tail were read; the rest is recorded as unavailable.
- `Timeline and tutorial video study - 40 downloads` (Google Doc) — read IN FULL. 40 additional
  videos (22 timeline Shorts + 18 tutorials) + the original Earrings Short; ~11 sampled frames per
  video (sampled review, not continuous watching; no audio review).
- `40_downloaded_video_index` (Sheet) — read in full via the Drive API (per-video "look around"
  timestamps + "what to look for" notes; sheet remains in Drive, id above — not duplicated here;
  the per-video observations that matter are summarized in this file and in the 40-doc findings).
- `y6richo_channel_video_index` (Sheet) — partial read (~345 of 788 rows; same API limit).
- `Downloaded videos - tutorials and timelines` (folder) — 41 MP4s listed with id/size/duration/
  resolution in `folder-index.json`. NOT downloaded (research reference only).

## Observed timeline/UI behaviors (evidence: sampled frames, [O]=observed)
- Layer rows: text (per-WORD staggered strips), shape, solid, media (png/mp4), audio (waveform
  strip), adjustment (named, e.g. "Adjustment Layer 2 (Particular)"), null (red), camera (yellow),
  groups. Visibility eye icons, colored bars, diamond keyframe markers, drag handles.
- Bulk selection: "117 layers selected" [O], "228 layers selected" (Akaneee #13) [O],
  "183 selected" (Just My Type #17) [O]. Select-all menu + multiselection toolbar.
- Ruler: numbered seconds, playhead, turquoise triangular MARKERS + bookmark/marker button
  (beat-marking tutorial #25: manual markers on waveform; peak ≠ beat, auto beat detection is [P]).
- Work area / pre-export flow: In, Out, Full, Go In, Go Out, "Pre-export (no audio)" [O: S2,S3].
- Creation tray: Media, Text, Solid, Adjustment, Null, Shape [O].
- Camera parented to null with animated X/Y movement [T: creator transcript].
- Easing graphs + custom curves (shake tutorials #32/#34/#40), rotation keyframes, movement path
  (#33), graph editor, Oscillate settings.

## Observed effect/tool names (labels seen in frames — NOT proven recipes)
Noise, Threshold (#04); Luma Key, RGB Split (#28); Text Transform, Time Quantization (#30);
Raster Extrude (#39); Linear Streaks (#36/BCC Lens Blur); radial repeat controls (#27 3D Swirl
Text); shape picker + four-point star (#23); gradient/noise texture (#26); VHS tracking preset
(#31); Exposure/Gamma panel showing Exposure 0.42, Gamma 1.000 (#01); Oscillate (#32/#34);
Particular/particles (#00/S2), 3D Tracker label (S2, internals not shown), "Edge Sc…" truncated
label (preserve partial), scanline/horizontal-band looks, audio visualizer-like bar [P].
Color & Light browser names [S]: Brightness/Contrast, Bump Map, Color Balance, Color Temperature,
Color Tune, Colorize, Dark Glow, Exposure/Gamma, Four-color Gradient, Gradient Map, Gradient
Overlay, Highlights and Shadows, Hot Color, Hue Shift, Invert, Light Glow, Long Shadow,
Palette Map, Posterize, RGB Split, Radial Shadow.

## Gap analysis vs OmniFrame (verified in src, 2026-10-29)
Already covered (grep-verified): markers incl. bulk + move + SNAP to markers (store.ts addMarker/
addMarkersBulk/moveMarkersToClip; Timeline snapTime "clip edges, markers, and the playhead");
work area (exportRange set/clear, Timeline shade UI, export.ts honors range); parenting
(createParentRelationship — camera→null possible); star shape ('star' kind); multi-select +
selectAllClipsInScope; oscillate (+freq/angle/wave/phase); timeQuantization; threshold; lumaKey;
chromatic (=RGB Split); grain (=Noise); vhs; particleFx/particleDensity; gradientMap; findEdges;
flare (+streaks/ghosts = Linear-Streaks-like); echo; freezeHold; motionBlur; tiltShift;
kaleidoSegments; swirl; pixelStretch; turbulent; posterize; invert; hueRotate (=Hue Shift);
colorTemp; dirColorize (=Colorize); edgeGlow (=Light/Dark Glow family); scanlines via vhs/glitchScan.

GAPS implemented this turn (new engine keys, real renders):
1. `exposure` + `gamma` (Exposure/Gamma panel parity).
2. `extrude` + `extrudeAngle` + `extrudeColor` (Raster Extrude — 3D-looking text via offset
   silhouette stack; NOT true 3D geometry, stated honestly).
3. `radialRepeat` + `radialRepeatRadius` (3D Swirl Text / radial repeat copies around center).
4. `longShadow` + `longShadowAngle` + `longShadowColor` (Long Shadow from Color & Light list).

Not available / not faked (honest): Bump Map, Color Balance (3-way), Four-color Gradient,
Highlights and Shadows, Hot Color, Palette Map (≈gradientMap), Radial Shadow (≈longShadow
radial variant), 3D Tracker (no tracking algorithm), true 3D mesh text, audio visualizer,
auto beat detection (manual markers exist; peaks≠beats).

## Recommended editor acceptance tests (from the study doc) → qa/video-study-e2e.mjs
1. ≥250 visible layers (mixed text/video/shape/group/adjustment): select all, shift on timeline,
   duplicate, undo, reopen — ordering/timing/selection preserved.
2. Four staggered transparent image clips: layer order, playhead boundary, frame-accurate seek.
3. Noise→Threshold stack: reorder/bypass/keyframe; stable after save/reopen (XML round-trip).
4. Audio markers: add/move/delete + snap; distinct from auto beat detection (not claimed).
5. Easing graph + keyframes on null/transform/effect: scrub, frame-step, undo, export agreement.
6. Layer-type/visibility/selection states at zoom (UI-level, covered by existing timeline e2e).

## Download method (2026-10-30, user mandate: download the videos)
- Sandbox bash egress CANNOT reach Drive/googleapis (TLS blocked by the egress allowlist) — probed and recorded.
- NO proxy trickery used. The legitimate path: the Arena **google_drive connector's download_file**
  stages each MP4 into the workspace (`google_drive/` at repo root); all 41 moved to
  `videos/` and verified **byte-exact** against the Drive index (folder-index.json).
  Videos are gitignored (re-downloadable via the connector); extracted study frames
  (`frames/`, 122 jpgs at the documented look-around timestamps) ARE committed as evidence.

## Wave-2 findings read directly off the downloaded-video frames (frames/NN_tTT.T.jpg)
- 01_t019.5: Exposure / Gamma panel = **Exposure 0.26 / Gamma 1.000 / Offset 0.00** → third
  param `exposureOffset` implemented; left rail = keyframe diamond + curve-graph icons.
- 04_t003.5: checkerboard transparency + black hand cutout + staircase staggered strips (confirms T2 test shape).
- 27_t060: Radial Repeat panel = **Count 21 / Radius 0 / Orientation 0°** → `radialRepeatOrientation` implemented.
- 28_t055: effect stack list = **Luma Key (on) + Copy Background + "+ Add Effect"** → `copyBackground`
  implemented as pre-key snapshot composited (blurred, 1.06×) UNDER the keyed result; catalog stack
  'vs2-rgb-vignette' = lumaKey + copyBackground + chromatic per the chromatic-aberration tutorial.
- 30_t075: Text Transform panel = **Start 0.0% / End 100.0% / Phase 0.0%** → per-char reveal sweep
  (textTransformStart/End/Phase) implemented in the per-glyph text path.
- 36_t070: BCC lens-blur shape/matte picker grid (circle, square, plus, C, triangle, hexagon,
  4-star, 6-star, slash, bowtie) — shape variety noted, NOT yet implemented (honest).
- 39_t090: AM effect browser taxonomy: Color & Light, Drawing & Edge, Distortion/Warp, Procedural,
  3D, Move/Transform, Repeat, Matte/Mask/Key, Opacity/Visibility, Text, Other (our FX_CATS capped at 9
  by standing constraint, so new entries slot into existing cats).
- 32_t030: Move & Transform rotation dial (0° knob) — rotation control parity already present.

## Wave-3 close-out (2026-10-30, later same day)
- The Color & Light browser gaps listed above are now ALL faked in-app: Bump Map, Color Balance,
  Four-color Gradient, Highlights and Shadows, Hot Color, Radial Shadow (+ bokeh shape beds from
  frame 36_t070: square/plus/triangle/hexagon/star/bowtie/slash kinds). Acceptance e2e T9 pixel-verifies them.
- HONESTY note: rollback #9 wiped the gitignored videos/ cache (231MB) between turns; the study is
  complete (122 frames + findings committed), and every MP4 remains re-downloadable by id from
  folder-index.json via the Drive connector. The frames/ stills were NOT affected.

## Device-3D reference scan (2026-10-31)
- 8 green-screen device mockups scanned via web image search (image-search/): phone = titanium
  rounded slab ~12% corner radius, thin bezel, notch/punch-hole; monitor/TV = thin black bezel +
  aluminium chin + tapered pedestal or feet, diagonal glass glare. Those measurements set the
  procedural SPECS in src/lib/device3d.ts; AI plates (public/devices/) regenerate the look at a
  perfect straight-on angle for chroma keying.
- Blender/3D MCP: NOT available on Arena (connector unsupported; blender.org outside egress) —
  documented, model moulded in code instead.
