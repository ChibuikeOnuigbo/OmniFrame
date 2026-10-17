# Motion & Animation Reference Study — Remotion, Jitter, Hyperframes, Krita

Studied 2026-10-17 from the public sites and docs of four tools the
project owner pointed at. Method matches the earlier ProPainter and
CoAnimator studies: read the public material, collect feature/UI/data
points, map them honestly onto OmniFrame, implement only what connects
to real editor functions, and say plainly what was *not* adopted.
Licences: Remotion uses a custom licence (free for individuals/small
teams, paid company licence beyond that), Jitter is a proprietary web
product, Hyperframes is Apache-2.0, Krita is GPL. In every case only
workflow *ideas* were adapted — no code, assets, templates or artwork
were copied from any of them.

## Remotion (remotion.dev)

What it is: "Make videos programmatically" — videos and motion graphics
authored as React code, rendered locally, on servers, or in bulk.

Collected data points:

- **Compositions** are the unit of video: width, height, fps and
  duration-in-frames declared up front.
- **Parameterization**: compositions take data/props; the same
  composition renders many videos from connected data ("motion design
  systems").
- **Studio**: an interactive editor — drag and drop, then *save back to
  code*; "code is always the source of truth".
- **Player / Editor Starter**: embeddable player and a starter video
  editor built on the framework.
- **Batch rendering**: server-side and client-side rendering pipelines
  for rendering at scale.
- **Templates & agent skills**: 35+ templates; "Make videos agentically"
  — coding agents drive composition authoring through skills/plugins.
- Known API staples used across their examples: `spring()` physics
  animation, `interpolate()` with easing curves, frame-driven (seekable,
  deterministic) evaluation.

OmniFrame mapping:

- Compositions ↔ sequences (aspect/fps/size are sequence settings).
- Parameterization ↔ the Scene Brief Builder + brief JSON: fields are
  the parameters, the build is the "render", and an external agent can
  author the brief file today.
- `spring()` ↔ the Curve Engine's physical easings (`back`, `bounce`,
  `elastic` — the Graph Editor already exposes them with thumbnails and
  an "Elastic — damped spring oscillation" preset). This study surfaced
  them as one-click Motion Presets (below).
- Frame-driven deterministic evaluation ↔ our curves evaluate purely
  from time (`evaluateCurve`), so preview and export agree.
- Deliberately not adopted: React/code authoring as the source of truth
  (OmniFrame's source of truth is the editable `.omni` project), and
  their batch-render service model (exports here are local).

## Jitter (jitter.video)

What it is: "A fast and simple motion design tool on the web" — a
preset/template-first animation editor used by creative teams.

Collected data points (landing page, 2026-10-17):

- A large named-template gallery organised in families: **The Track**
  (Poster, Promo Reel, Session Complete), **The Edit** (Collection
  Teaser, Split Reveal), **The Stack** (Livestream, Sale), **Orbit**
  (Cards, Social Media Showreel), **Blend Modes** (Double Exposure,
  Circle Stack, Color Blocks), **Counter** (Halftone Poster), plus
  **Image Stretch Transition**, **Stretched Type Repeater** (text
  animation), **Ripple Effect**, **Pixelated Slideshow**, **Interactive
  Gallery**.
- The product pattern this shows: motion design sold as *named,
  one-click presets* (entrances, text animation, transitions, effects)
  applied to layers, rather than hand-built keyframes.
- Their site also advertises built-in "AI agents" ("Superagents").
  OmniFrame never labels features as AI, so only the preset workflow —
  not the agent branding — was adapted.

OmniFrame mapping — adapted in this pass:

- A new **Motion Presets** group in Scene Recipes: Fade + Rise In,
  Pop In (Spring), Slide In (Left), Spin In, Pulse Beat and Drop Out
  (Exit). Each writes ordinary keyframes (`opacity`, `position_x/y`,
  `scale_x/y`, `rotation_z`) onto the selected clip with the matching
  Curve Engine easing, so a preset is a starting point the user keeps
  editing in the Graph Editor — not a locked render.
- Template families ↔ our Scene Recipe groups (Intros & Titles,
  Motion Presets, Studio & Podcast, Looks & Teaching, Social Versions)
  and the Explorer-filed pack library.

Not adopted: Jitter's cloud files/collaboration and Lottie-oriented
export pipeline; OmniFrame exports video/stills locally.

## Hyperframes (github.com/heygen-com/hyperframes, Apache-2.0)

What it is: "Write HTML. Render video. Built for agents." HTML, CSS,
media and **seekable animations** compiled to deterministic MP4,
locally via CLI, from coding agents via skills, or behind hosted
authoring workflows.

Collected data points (README, 2026-10-17):

- **Deterministic, seekable animation model**: animations are wired so
  any time can be rendered exactly — the same property our curve engine
  has by construction.
- **Catalog of blocks** (e.g. a data-chart block): reusable composition
  pieces an author (human or agent) assembles.
- **Agent skills**: 21 published skills with a router skill
  (`/hyperframes`) that maps a "make me a…" request to a creation
  workflow — product-launch-video, faceless-explainer, pr-to-video,
  embedded-captions, talking-head-re-cut and more. The skills teach
  agents a production loop: plan, write, wire animations, lint,
  preview, render.
- Their Studio work includes per-keyframe ease presets and velocity
  fitting (repo commit history) — the same ease-preset idea as
  Remotion springs and our Graph Editor presets.

OmniFrame mapping:

- Blocks ↔ Desktop Pack assets and one-click bundles (the composable
  pieces), recipes/briefs ↔ the creation workflows (a brief names the
  intent; the builder assembles editable pieces).
- Agent-authored compositions ↔ brief JSON import: the file is the
  agent-facing surface, OmniFrame stays the editable source of truth.
- Per-keyframe ease presets ↔ Graph Editor easing presets, now also
  reachable in one click via Motion Presets.

Not adopted: HTML/CSS as the authoring surface (our composition model
is clips, curves and recipes), and their CLI renderer.

## Krita (krita.org features + docs.krita.org)

What it is: free/GPL professional painting with a full 2D animation
workspace. The owner asked for the same doc-level treatment as the
other studies.

Collected data points (features page, 2026-10-17):

- **Interface**: customizable dockers (30+) and saveable workspaces,
  dark/light themes, custom shortcuts.
- **Brushes**: 100+ bundled presets, 9+ brush engines (smudge, shape,
  particle, filter…), brush tagging/organisation, resource manager and
  shareable bundles; three stroke stabilizers plus a Dynamic Brush
  (drag/mass).
- **Vector & text**: SVG-based vector tools, comic panel/word-bubble
  libraries.
- **2D animation**: animation workspace and timeline with thousands of
  frames, multiple layers and audio, onion skinning, tweening
  (opacity/position), drag-and-drop frame timing, duplicate/pull frame
  shortcuts, drop-frame playback option, export to video or stills.
- **Productivity**: drawing assistants (vanishing point, ellipse,
  fisheye/curvilinear perspective), wrap-around mode for seamless
  textures, layer types (paint/vector/filter/group/file), selections
  with feather/invert and a global selection mask, full colour
  management (LCMS/OCIO), HDR painting, PSD load/save, Python
  scripting.

OmniFrame mapping:

- Dockers/workspaces ↔ OmniFrame's docker model: context-following
  panels, mode-aware but never mode-hidden sidebars, saveable
  workspace layouts.
- Onion skinning, frame timing and drawing-to-clip conversion already
  exist in the drawing workspace; Krita's opacity/position tweening ↔
  our Curve Engine channels on drawing clips.
- Assistants and wrap-around mode are **not** in OmniFrame today —
  recorded here as honest future candidates, not claimed features.
- PSD: Krita offers full PSD editing; OmniFrame claims only reliable
  extraction from `.psd`/`.kra` (flattened previews/partial parsers),
  per the owner's standing rule — this difference stays documented in
  `FEATURE-CATALOG-AND-SUPPORT.md`.
- Python scripting has no OmniFrame equivalent; the agent-facing
  surface here is the brief JSON instead.

## What changed in OmniFrame from this study

1. **Motion Presets** (Jitter + Remotion spring + Hyperframes ease
   presets): six one-click, fully editable keyframe presets in Scene
   Recipes, verified by `qa/apps-scenes-e2e.mjs`.
2. This document joins `PROPAINTER-STUDY.md` and `COANIMATOR-STUDY.md`
   as the standing reference-study set; feature truth stays in
   `FEATURE-CATALOG-AND-SUPPORT.md`.
