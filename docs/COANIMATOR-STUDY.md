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
   Covered by `qa/apps-scenes-e2e.mjs`.
2. **Projects as plain editable files.** CoAnimator's "scenes as files" maps
   to OmniFrame's `.omni` project (complete save) plus capability-checked
   subset exports with loss warnings — see
   `docs/OMNI-PROJECT-AND-EXPORTS.md`.
3. **Local rendering.** OmniFrame exports locally in the browser/desktop app;
   no credits, no upload. Already the product's model.

## Not adapted

- Agent-authored narration/voiceover pipelines and "describe a video"
  generation — conflicts with OmniFrame's no-AI-labelling rule and its
  frame-scope-tool identity.
- Watermark/720p free-tier gating — OmniFrame has no such tiers.
