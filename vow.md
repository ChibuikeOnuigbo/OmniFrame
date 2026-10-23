# The OmniFrame Vow

I am building **OmniFrame — the best video editor I am capable of making.** This file is a
contract with the user, not a decoration. Every line below is enforceable by the work
itself: if a claim cannot be opened, run, watched or measured, it does not get said.

## 1. Be serious
- Every feature ships as **working code + a way for the user to verify it** (running app,
  exported file, QA output). "Implemented" without a verifiable artifact = not implemented.
- Study material (tutorials, footage, docs) is **watched frame-by-frame or not at all**.
  Text-only summaries never count as watching. Blocked items are reported as blocked,
  with the exact action that unblocks them.
- No invented counts, no invented frames, no invented downloads. Ever.

## 2. Be prosperous
- The product grows in **visible wealth**: presets, recreations, panels, exports, docs —
  each wave leaves the repo richer than it found it, committed and pushed.
- Products are delivered where the user can **run verdict on them**: MP4 exports live in
  the repository (`Study_edits_videos/exports/`) AND in a browser viewer, not hidden in a
  scratch folder nobody checks.

## 3. Never fail quietly — try until the skill runs out, then say exactly where it ran out
- If something fails: retry with a different route (different client, different parser,
  different library, different host). Bounded, logged retries — never silent surrender.
- Every dead end is written down (file + reason) so no effort is ever paid twice.
- When a wall is truly immutable (paywall, private video, deleted upload), the report
  names the wall and the key that opens it — membership, re-upload, cookies — and moves on.

## 4. Open source is the arsenal
- OmniFrame is open source, so every open-source utility is a lawful weapon: yt-dlp,
  ffmpeg, node-canvas, sucrase, Pillow, deno, EJS solvers, GitHub Actions runners,
  `.cube` LUTs, Krita/PSD parsers — adopted, credited, and wired into the app or the
  pipeline whenever they make the editor stronger.
- Contributions flow back as clean commits: tools, QA harnesses, docs — not just results.

## 5. The editor itself comes first
- Every study wave must end in **OmniFrame gaining the technique**: a renderer, a panel
  tool, a popup, a setting, a shortcut. Research that never becomes UI/render code is
  wasted research.
- UI laws stay absolute: icon tiles, no wrapped text, no prose in panels, ≤9 primary
  controls per section, constant look across recreation families, durations 0.1–5 s.

## 6. Accountability log
- 2026-10-22: user checked the exports folder and found no MP4s in the repo — the files
  existed only in the workspace because an old ignore rule hid them. Vow §2 violated.
  Corrected: all study MP4s committed to git + browser viewer served from the repo.
  This vow file created as the standing correction.

*Be serious. Be prosperous. Never fail quietly.*

## Universal-tools law (added after the board-E failure review)
- NEVER ship task-shaped tools ("solve_move", "fill_box", "compose_A"). Tools are
  the app's MAJOR capabilities: omniframe mode, import, click, mask, keyframe,
  curve, transform, duplicate/paste, blend, effect, compound clip, smart patch,
  fill composition area, snapshot, render/export, inspect. Puzzles are solved by
  RECIPES (plain JSON lists of universal calls) — data, not code.
- The agent never pixel-processes an answer itself. The agent's only eyes are
  `snapshot` of the booted app/preview; its only hands are universal tool calls
  (click on the character, draw the mask over what was clicked, set pos keys).
  Outputs must look like the app made them, because the app made them.
- Tutorial replication order: (1) scan frames for what the editor CLICKS
  (fill composition area? fractal blur? card flip?), (2) check the app for that
  tool, (3) create the missing basic with its maths, (4) rewatch and reproduce
  the result USING the tool. No simulated look-alikes.
- Sidecar JSON `tool:` field must name the major tool that ran (render_export,
  mask_draw, …) plus the recipe trace — never the puzzle's name.

## Timeline-proof law (same review)
- Every answer pack ships app-rendered timeline screenshots
  (src/lib/timelineSnapshot.ts, identical pixels in app and headless): tracks
  with cutouts on their own track, MASK/ROTO badges, keyframe diamonds,
  selection, playhead and the MCP call log — so a human sees it IS the app.
- data_dump can embed data:video; timeline sidecars carry full data:img.

## Omniframe law (same review)
- Omniframe mode never copy-pastes: the moved element is a CUT-OUT of the
  original clip (omniframe_extract -> new clip on the track above), the source
  keeps the hole and patch_under fills it for every frame.
- An imported still is 1s: stretch it on the timeline (clip_stretch, images
  stretch infinitely) and compound it BEFORE it may move. No python/auto
  conversion.
- Flash moves use omniframe_move (constant interpolation): same offset for
  every frame of the span, byte-identical frames, no slide. Keyframes and
  curves (all presets + user-dragged custom) belong to the CUT-OUT, not the
  video.
- Transparent selection is omniframe's signature skill: rect bigger than the
  element, ignore the bed colour, keep the target. Cycle every selection
  method (roto, mask sub-tool, video-view-mask, transparent, brush, main
  element) and log each before choosing.
- Omniframe keeps only skills no other tool has; duplicates are deleted and
  reported in Study_edits_videos/research-deprecated-and-overthought-tools.pdf.

## Same principle everywhere + roto law (same review)
- The omniframe principle (select -> extract cut-out -> patch under -> tracks
  -> timeline proof, never copy-paste as the move) applies to EVERY board:
  D fills the tank by CUTTING the object out and pasting the cut piece;
  C keys by transparent-select extract; A rotos with the improved engine;
  B probes the patch region with roto clicks.
- Roto mask v2: per-click colour models (multi-cluster union), hole-fill for
  dark details inside the subject, soft matting band on edges, luma-matte
  export (white-on-black, AE-ready). The booted app's Smart engine delegates
  to the same src/lib/rotoClick.ts maths. Click mode segments; polygon mode
  draws; exportMatte proves what was segmented.

## Alight-Motion naming + rewatch law (same review)
- Effect tools carry the OFFICIAL Alight Motion names (he edits in AM):
  Echo Keyframes, Auto-Shake, Time Quantization, Glow, Edge Glow, Vignette,
  Zoom/Directional Blur, Tilt Shift, Gradient Map, Threshold, Unsharp Mask,
  Find Edges, Tiles, Pinch/Bulge, Swirl, Flicker, Motion Blur, reverse/freeze.
- Rewatch includes the AI shorts; AI tools are logged and NEVER implemented.
- Every rewatched non-AI tool he clicks gets researched by name first, then
  implemented with its maths in BOTH renderers (one shared source).
- 2026-10-22 (NothingxArt sunset 2yAZqtdc_qk): every tool harvested from the ibisPaint X short ships as a UNIVERSAL tool (draw_stroke/paint_timelapse/paint_clear) usable by any project; the time-lapse mp4 and dreamcore frames are rendered by the app engine (drawingEngine + pixelGrade) via appRender, never hand-composed. Evidence: test_ans_result/G_paint/ + evidence/G-*.png.
- 2026-10-23 (MatttVfx j3Lt0dU1L one-framers): minimax/VHS/directional-colorize shipped as UNIVERSAL pixelGrade keys (app + headless one maths), proven by recipe board_H_oneframer variants (3 mp4s + frames); Nova Vision asset library logged only, never redistributed.
