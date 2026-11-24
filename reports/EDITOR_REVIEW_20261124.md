# Editor review — 24 November 2026

## Changes and evidence

Consolidated eleven direction-only blur cards into Directional Blur with angle,
spread, trail bias and threshold controls. Horizontal/Vertical/Diagonal buttons
are shortcuts to the angle property, including native auto-key behavior.
Old IDs and favorites remain compatible. Fan Blur, Highlight Streak, Box Blur
and other distinct operations remain visible. Counts measure visible recipes;
resolved legacy IDs are a separate compatibility surface.

MCP live tests pass selection, mask defaults, curves, effect masks, blend keys,
Undo, invalid input rejection, project round trips, previews and timeline images.
Native-keyframe browser/export proofs additionally cover cut/trim/move/overwrite,
locked tracks and atomic errors. The headless demo uses universal MCP operations.

The graph suite passes 37 assertions, including dragging diamonds, tangent
handles, easing intensity, custom points and visible Y-rotation foreshortening.
Two initial failures were obsolete punctuation expectations; they now assert
axis meaning independently of comma versus middot. The 35-family curve simulator,
deformation unit tests, 3D camera/keyframe/mask test, Motion Lab scene creation
and responsive corner-pin/liquify gestures all pass. Sculpting mesh quality,
complex multi-character rigs and long-form projects are NOT fully accepted by
these checks. The tests do not establish 4K real-time performance.

## Demo and reference review

`qa-output/motion-review/word-stagger.mp4` is an original three-word staggered
study with easing, opacity and Y rotation. Its timeline, tool trace, still and
OpenCV contact sheet are alongside the MP4. OpenCV 5.1.0 was installed into an
isolated temporary directory; the demo decodes 72 frames. The sheet was inspected.
This is a small functional motion study, not a professional template collection.

Re-inspected the archived 3-second source frame in
`research/new_study_vdieos/timeline-source/t003.png`: independently staggered word
clips, null/camera rows, tilted typography and diamond keys. This frame supports
those observations, not knowledge of the complete tutorial or its exact curves.
The supplied Drive folder returned HTTP 200, but no new playable media was
recovered from its page in this pass. The Kdenlive effects reference returned
200; a guessed Glaxnimate timeline URL returned 404. No new YouTube watching or
full-folder coverage is claimed.

## Competitor check and provisional ratings

The already downloaded, checksum-verified official Kdenlive 26.08.3 package
successfully ran its version command. Downloaded Glaxnimate rendered an original
SVG to a nonempty 320×180 PNG. Prior indexes compare reference capabilities in
`research/editor-capabilities/README.md`. These are package/render smoke checks,
not side-by-side editing benchmarks. After Effects and CapCut were not run.

My engineering judgment, not an independent benchmark:

| Area | Provisional rating | Reason and limitation |
| --- | --- | --- |
| MCP for the exercised workflows | 7/10 | Useful editable automation, previews, Undo and validation; live/headless coverage still differs and optional payload schemas remain incomplete. |
| OmniFrame overall readiness | 6/10 | Broad working controls and growing regression coverage; native effect easing graphs, sculpting acceptance, native OS packaging and performance profiling remain open. |
| Relative speed against competitors | Unrated | No identical-media, identical-effect, identical-hardware comparison was run. Faster-than-CapCut/AE claims would be unsupported. |

Next: profile matched proxy/4K workloads; exercise actual sculpt strokes and
mesh persistence; expand graph/instance trim coverage; retrieve playable Drive
sources and recreate a timecoded edit with an explicit mismatch ledger. Preserve
legacy project IDs while consolidating other genuine parameter-only variants.
