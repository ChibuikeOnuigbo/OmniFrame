# CoAnimator study — ideas adapted into OmniFrame, without the AI framing

Source studied: https://coanimator.com — an agentic animation studio where an
external coding agent assembles scenes, timeline, narration and effects as
plain editable files, then renders MP4 locally. OmniFrame is explicitly
**not** an AI product (no AI-labelled buttons or copy, per product rule), so
nothing here copies that framing. What transfers is the *workflow design*:

## Adapted

1. **Scene recipes (templates as editable scenes).** CoAnimator ships effect
   templates an agent applies wholesale. OmniFrame's Desktop Pack →
   **Scene Recipes** section does the same thing with real editor functions:
   each recipe builds ordinary, editable clips at the playhead — nothing is
   baked in or hidden.
   - Freeze-Pop Intro — capture the frame at the playhead
     (`captureClipFrameDataUrl`), add it as a still, stack the PiP sticker
     frame and a name title.
   - Cinematic Cast Intro — letterbox bars + warm grade on the selected clip
     + title card.
   - Spotlight Tutorial — spotlight dim + highlight box + screen-clean grade.
   - Punch-In Cut — split all tracks at the playhead, scale the next clip to
     118%.
   - Caption Burst — four editable caption titles across the selected clip.
   - Vertical 9:16 Version — switch the sequence to 1080×1920 for
     Shorts/Reels.
   - Ken Burns Drift — real `scale_x`/`scale_y` keyframes (100% → 125%)
     across the selected clip.
   - On-Air Backdrop — post-card layer plus an editable “ON AIR” title.
   Covered by `qa/apps-scenes-e2e.mjs`.
2. **Scene Brief Builder (structured brief → editable scene).** CoAnimator's
   central workflow is “describe the video and watch scenes appear.” OmniFrame
   adapts that as a visible form — title, caption beats, format, duration,
   backdrop/device and look — then calls only real store actions
   (`setSequenceAspectRatio`, pack-asset placement, `trimClip`,
   `addTextTitleClip`, `setClipKeyframe`) to build ordinary clips. The user
   can immediately move, trim, restyle or delete every piece; there is no
   prompt box, no locked generation and no AI-labelled control.
3. **Projects as plain editable files.** CoAnimator's "scenes as files" maps
   to OmniFrame's `.omni` project (complete save) plus capability-checked
   subset exports with loss warnings — see
   `docs/OMNI-PROJECT-AND-EXPORTS.md`.
4. **Local rendering.** OmniFrame exports locally in the browser/desktop app;
   no credits, no upload. Already the product's model.

## Not adapted

- Agent-authored narration/voiceover pipelines and free-form "describe a
  video" generation — conflicts with OmniFrame's no-AI-labelling rule and its
  frame-scope-tool identity. The Scene Brief Builder is the deliberate,
  inspectable substitute: structured fields in, editable clips out.
- CoAnimator's proprietary desktop binary was not copied or bundled; only
  its public workflow ideas were studied and reimplemented with OmniFrame's
  own editor functions.
- Watermark/720p free-tier gating — OmniFrame has no such tiers.
