# Reference study — full docs scan (Remotion, Jitter, Hyperframes, Krita)

Second-pass study, 2026-10-17, following the first pass in
`docs/REFERENCE-STUDY-MOTION.md`. This pass read the **documentation trees**
(not just landing pages) of all four reference sites and followed YouTube
links embedded in those docs.

## Method and honesty notes

- Pages were read as fetched HTML/text through the sandbox reader. Sandboxes
  here have no general internet shell access, so binary downloads
  (e.g. Krita's full-manual EPUB at `docs.krita.org/en/epub/KritaManual.epub`)
  could **not** be pulled — the manual was read page-by-page from the same
  HTML the EPUB is generated from. Nothing below claims otherwise.
- YouTube: only publicly readable metadata was used (title, channel,
  duration, view counts, full description text, caption track). No video
  frames were viewed and no "watched the video" claim is made anywhere.
  The one feature-length example linked from Krita's docs,
  *“Let’s Animate - Krita: Rocket Mechanic (10 days)”* by Ed Tadeo
  (8:57, 254K views, uploaded 2022-07-02), is a narration-free timelapse —
  its caption track is music cues only. Its description links a paid
  14-hour Gumroad tutorial and Patreon source files; those are paid
  third-party materials and were not acquired.
- Licences respected as in the first pass: concepts only, no copied code,
  assets, or branding from any of the four projects.

## Krita docs (docs.krita.org, Krita 5.3 manual)

### Documentation map
- **User Manual**: Getting Started; coming from Photoshop/SAI; tablets;
  loading/saving brushes and resources; mirror tools; **Painting with
  Assistants**; working with images; autosave/backups; templates
  (animation, comic, design, DSLR, texture); working with layers and masks;
  selections; Python scripting; tag management; soft proofing; vector
  graphics; **Animation with Krita** (guide chapter).
- **Tutorials and How-tos**: clipping masks / alpha inheritance; common
  workflows (speed painting, colorizing line art, preparing tiles/textures,
  pixel art); inking (stroke smoothing, bezier, presets); Krita brush tips
  (animated brushes, bokeh, bristle-from-heightmap, caustics, fur,
  gradient map, **hair**, outline, rainbow, sculpt-paint); SeExpr scripting.
- **Reference Manual**: tools, brush engines, blending modes, and the
  **dockers** — including Animation Timeline, **Onion Skin**,
  **Animation Curves**, and **Storyboard**.

### Animation with Krita (guide chapter) — workflow lessons
Krita's own professional pipeline is: script/outline → **storyboard**
(a few frames) → **animatic** (assembled in a video editor — Krita
explicitly says it lacks extensive video/audio montage) → split work into
small clips (advice: ≤10 s, sketch at 12 fps, low resolution such as
800×450) → Render Animation → compose clips in the editor. Frames live in
RAM, so the manual teaches memory discipline: merge layers, crop layers to
image size, convert B/W layers to grayscale, watch the status-bar memory
meter, and keep incremental backups at milestones.

OmniFrame reading: this validates OmniFrame's plan-first direction
(Scene Brief Builder + Scene Recipes feeding an editable timeline) and the
honest split of labour — Krita is the frame-by-frame drawing tool;
OmniFrame is the montage/motion tool. A storyboard surface remains the
biggest documented Krita workflow OmniFrame does not yet mirror (below).

### Onion Skin docker (reference) → implemented this pass
Krita's spec: toggle per layer via the lightbulb icon on animated layers;
master opacity slider + zero-offset visibility; **per-offset opacity**;
**tint strength** (100% = previous/next frames become solid silhouettes,
50% keeps half the original colors); distinct **Previous Frame** and
**Next Frame** tint colors.

OmniFrame already had: before/after frame counts, master opacity,
prev/next tint colors, and opacity falloff per offset. The missing Krita
control was **tint strength**. Implemented this pass:
`OnionSkinSettings.tintStrength` (default 1 = full silhouette, matching
previous behaviour), `blendGhostColor()` in `drawingEngine.ts` (blends
stroke color toward the tint; hex/rgb aware), and a **Tint Strength**
slider in the Drawing panel's onion-skin controls
(`onion-tint-strength-slider`). QA: `qa/onion-skin-cel-animation-e2e.mjs`
asserts slider → store and the blend math (50% mixes, 100% = silhouette).

### Animation Curves docker (reference) → already covered
Krita animates layer **opacity** and Transform Mask position / rotation /
scale / shear as scalar keyframes on a graph: transport controls, frame
counter, preview speed + drop-frames, add/remove scalar keyframe,
**interpolation mode** and **tangent mode** controls, numeric value box,
graph zoom; a channels list with per-channel color and visibility eye;
dragging keyframes vertically changes value, horizontally changes time,
with bezier handles on the selected keyframe. OmniFrame's Curve Engine +
Graph Editor (channels, presets, tangent handles, speed graph) already
cover this surface; the Krita reading confirms the model rather than
revealing a gap. Krita notes curve values change every frame and cost
cache — consistent with OmniFrame's deterministic `evaluateCurve(time)`.

### Also noted from Krita docs/features
- **Brush stabilizers** (3 modes: none/basic/stabilizer-weighted + dynamic
  brush tool): OmniFrame already ships three smoothing modes
  (`none`/`smooth`/`stabilizer`) with a stabilizer radius — parity kept.
- **Drawing assistants** (perspective, vanishing point, rulers) and
  **wrap-around mode** for seamless textures: genuine drawing-side gaps,
  documented below as future work.
- **Storyboard docker**: thumbnail grid of scenes with per-shot fields —
  the strongest "add later" candidate (see gap table).

## Jitter docs (help.jitter.video + changelog)

- **What is Jitter** (help article 12089209): ready-made **animation
  presets** (move, fade, scale, mask, blur elements), fully custom
  animations, **easing presets** (Slow down, Accelerate, Elastic, Bounce,
  Overshoot…) **customizable with intensity controls**, batch export,
  export to **MP4/MOV/WebM, GIF, Lottie**, up to **4K/120 fps**,
  transparent video (ProRes 4444/WebM), frame-by-frame export, looping
  options. ("Image to Video" AI prompting is Jitter marketing surface;
  OmniFrame does not adopt AI-labelled features.)
- **Export your work** (article 5369843): per-artboard export page;
  format/FPS/quality settings; plan-gated transparent, frame-by-frame,
  4K/120 fps, and batch exports.
- **Lottie exporter** (2024-10-30 changelog + articles): Lottie JSON export
  incl. mask animations and native SVG→Lottie shapes; Figma plugin import
  path (copy in Figma, paste into Jitter).
- **CSS Easing export** (2026-04-09 changelog): any easing — including
  custom, elastic, bounce — can be copied as CSS for developer handoff.
- **Displacement shaders** (2026-08-18): shader transitions with
  direction/duration/easing controls.

### Implemented this pass — easing intensity
Jitter's differentiating control is the **intensity slider** on easing
presets. OmniFrame now has it: `KeyframeNode.easingIntensity`
(1 = preset as-is, 0 = linear, up to 1.5 exaggerated) evaluated in
`evaluateCurve` as `progress = u + (raw − u) × intensity`, with an
**Intensity** slider in the Graph Editor keyframe controls
(`easing-intensity-slider`). QA: `qa/graph-capcut-e2e.mjs` §4b asserts the
slider writes the node field and the engine blends toward linear.
Deferred from Jitter's list: Lottie export (a large new exporter),
blur as an animatable channel (needs an effect-channel in the curve
engine), CSS-easing copy (small; possible quick follow-up), GIF export
options (OmniFrame already exports GIF; Jitter's is plan-gated hosting
behaviour, not a format gap).

## Hyperframes docs (llms.txt full-docs index)

The docs index (`/llms.txt`) is organised as a **Prompt Guide, Levels 1–6**:
- **Level 1 – what you can make**: product-launch videos, explainers and
  tutorials, code/PR videos, captions and talking-head recuts, music
  videos and slideshows, motion graphics and text animation.
- **Level 2 – prompt anatomy**: mapping plain vocabulary onto settings
  (aspect, duration, pacing, style words → concrete parameters).
- **Level 3 – motion that reads premium**: eight rules; named shader/CSS
  transition families.
- **Level 4 – building blocks**: code blocks, data-maps and overlays, a
  **caption-style catalog**, color grading and VFX blocks.
- **Level 5 – media & audio**: sourcing, timing and mixing guidance.
- **Level 6 – design systems**: variables and templating, reusable
  blocks, and **storyboards — “prompt the plan, not the scenes.”**

OmniFrame mapping: the Level-1 taxonomy matches OmniFrame's Scene Recipe
groups (Intros & Titles, Motion Presets, Studio & Podcast, Looks &
Teaching, Social Versions); the Level-6 storyboard-first rule matches the
Scene Brief Builder. The caption-style catalog idea reinforces keeping
caption/branding choices as named, reusable styles in recipes rather than
ad-hoc per-clip settings. (Hyperframes is agent-authored software;
OmniFrame adopts the taxonomy and planning ideas only — no AI-labelled
product copy, no copied text.)

## Remotion docs (remotion.dev/docs)

Creation paths documented: AI-assistant plugin (ChatGPT/Codex), CLI
scaffolding (`npx create-video@latest --yes --blank`), an interactive
wizard (package manager, template, agent skills), ESLint config, and
system requirements (Node 16+, macOS 15+, Linux libc 2.35). The docs tree
covers compositions, Studio (visual editing saved back to code), the
Player, templates, and server/client rendering. OmniFrame is not
code-based and Remotion's licence does not permit code reuse; the
transferable ideas — parameterization (one composition, many data sets)
and templates that stay editable after generation — are already embodied
in OmniFrame's Scene Recipes + Brief Builder (recipes write ordinary,
editable timeline keyframes).

## YouTube links found in the docs

| Link | Source | What was read |
| --- | --- | --- |
| `youtube.com/watch?v=CY5XppRTpBY` — “Let’s Animate - Krita: Rocket Mechanic (10 days)”, Ed Tadeo | Linked from Krita's docs/features material | Metadata + description only (8:57, 254K views, 2022-07-02). Narration-free timelapse: caption track is music cues. Description links a paid Gumroad tutorial and Patreon files (not acquired). Takeaway for OmniFrame: hand-drawn frame animation at production quality is a multi-day, layer-disciplined craft — reinforcing honest scope notes for OmniFrame's drawing tools rather than any feature copy. |

No other playable YouTube links were present in the fetched docs pages;
where sites reference video showcases without direct links in the docs
text, nothing could be followed, and nothing was inferred from them.

## Follow-up scan — "Gold Motion Is Literally Insane! Full Course" (YouTube)

`youtube.com/watch?v=uTnlenQj964`, **Vault Tube**, uploaded 2026-10-12,
5:30, 36,273 views, 1,045 likes, Science & Technology. Supplied by the user
on 2026-10-17. Unlike the Krita timelapse above, this video is fully
narrated, so its **caption transcript was read in full**; no video frames
were viewed and no frame-level claim is made. The narrator walks through
**Gold Motion**, a gold-reskinned Alight Motion-style mobile editor, and
himself asks whether it is "actually useful or just a copy of Alight
Motion", concluding that of its marketed "AI" tools only **Upscale** and
**DFR** look like genuine AI features, with a slight performance
deficiency noted. Description links route to a Telegram channel
(software + "FREE XML PACK"); nothing was downloaded from it.

Feature inventory from the narration, mapped to OmniFrame:

| Gold Motion feature (as narrated) | OmniFrame status |
| --- | --- |
| Upscale Quality (photo 2X/4X enhance) | Not present; no AI-labelled features by product rule — not adopted |
| Project Doctor (project/device compatibility scan) | Partial: export capability checks + subset loss warnings exist; no single diagnostics view — future candidate |
| Reverse (selected video) | Preview playback clamps to `Math.abs(speed)` (negative `playbackRate` unreliable); a true reverse render is not offered — documented limit |
| Twister (slow motion) | Covered differently: clip speed + pitch/tempo tools and speed in the curve engine |
| DFR (detect & correct dead/frozen frames) | Not present — classical frame-difference detection is feasible later |
| Audio Converter (MP3↔WAV/M4A/AAC) | Partial: audio export exists; no general converter panel |
| New shapes + Edit Shape | Covered: drawing shapes with parameters |
| **Light elements** — Objects/Elements → Light: Point/Spot light styles, Light Color, **Intensity**, **Falloff** as timeline light layers | Not present as a light layer — good next candidate (gradient light overlay fits the effects/overlay stack) |
| **3-axis rotation** — Rotation X/Y/Z (Y = horizontal 3D flip, X = vertical flip) | **Gap found and fixed this pass** (below) |
| Expanded effects categories with per-effect detail | Covered: effects panel with adjustable parameters |
| Project setup: canvas ratio, up to 2K, up to 99 fps, preview quality | Covered: sequence settings, export FPS/resolution, preview quality modes |

### Implemented from this scan — Rotation X/Y now actually renders
OmniFrame already had Rotation X (Tilt) / Rotation Y (Pan) inspector
sliders, keyframe diamonds, and `rotation_x`/`rotation_y` curves, but the
preview compositor only ever applied `rotationZ` — the X/Y values were
sampled and then silently dropped, and `evaluateClipAnimation` also
discarded the static inspector values. Fixed:
- `rotationXYMatrix()` in `CurveEngine.ts`: orthographic Rx·Ry projection
  (cos foreshortening + combined-angle shear; 90° edge-on, 180° mirror
  flip). Canvas 2D has no true perspective; this is the standard honest
  orthographic model, not a fake-3D claim.
- `evaluateClipAnimation` now falls back to `clip.transform.rotationX/Y`
  (no-animation branch and per-curve fallbacks).
- `applyRotationXY()` applied in all three clip render paths of the
  preview compositor (`playback.ts`); video export records the preview
  canvas, so exports inherit the fix.
QA: `qa/graph-capcut-e2e.mjs` §4c asserts the matrix math (cos60 = 0.5,
180° = −1, X-90° edge-on), the static-value fallbacks, and that setting
Rotation Y = 70° visibly narrows the clip's span in the preview canvas.

## Gap table — what to add, honestly prioritized

| # | Idea (source) | OmniFrame status | Decision |
| --- | --- | --- | --- |
| 1 | Onion-skin **tint strength** (Krita) | **Implemented this pass** | Shipped + QA |
| 2 | Easing **intensity** control (Jitter) | **Implemented this pass** | Shipped + QA |
| 3 | **Storyboard** surface: scene cards + notes before timeline work (Krita Storyboard docker; Hyperframes L6) | Brief Builder exists; no visual storyboard | Next candidate; medium UI build |
| 4 | Copy easing as **CSS** (Jitter) | Graph Editor presets exist | Small follow-up; needs cubic-bezier mapping per preset |
| 5 | **Blur** as animatable channel (Jitter presets) | Effects exist; curves are transform/opacity only | Needs effect-channel in curve engine; larger |
| 6 | **Lottie** export (Jitter) | No Lottie exporter | Large; defer, note in catalog |
| 7 | Drawing **assistants** (vanishing point/perspective) + **wrap-around** (Krita) | Not present | Drawing-side roadmap items; defer |
| 8 | Frame-by-frame / sprocket export polish (Jitter, Krita RAM guidance) | Image-sequence export exists | Docs-only note; keep honest limits |
| 9 | Caption-style **catalog** (Hyperframes L4) | Recipes carry styles ad hoc | Fold into a future recipes pass |
| 10 | Parameterized templates (Remotion) | Covered by Recipes + Brief JSON import/export | No action |

## Files changed this pass
- `src/types.ts` (`tintStrength`), `src/store.ts` (default),
  `src/lib/drawingEngine.ts` (`blendGhostColor`, ghost rendering),
  `src/components/DrawingPanel.tsx` (Tint Strength slider)
- `src/lib/animation/CurveEngine.ts` (`easingIntensity`, evaluation),
  `src/components/GraphEditor.tsx` (Intensity slider)
- QA: `qa/onion-skin-cel-animation-e2e.mjs`, `qa/graph-capcut-e2e.mjs` (§4b)
- Follow-up (Gold Motion scan): `src/lib/animation/CurveEngine.ts`
  (`rotationXYMatrix`, Rotation X/Y fallbacks),
  `src/lib/playback.ts` (`applyRotationXY` in three clip render paths),
  `qa/graph-capcut-e2e.mjs` §4c + §7 (matrix math, evaluator fallbacks,
  screenshot-based preview pixel proof: span 385 → 131 at Rotation Y 70°)
