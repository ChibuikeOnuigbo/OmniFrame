# NothingxArt — "sunset . . . ?" (youtube.com/shorts/2yAZqtdc_qk)

- Channel: **NothingxArt** (@Nothingxart/shorts) · audio "Jane! (Hoodtrap)" Qura & pipenpodol
- Title tags: #art #illustration #ibispaintx #painting #surrealism #dreamcore
- Stats at fetch (via r.jina.ai, 2026-10-22): 12K likes · 427K views · published Oct 6 2026 · 737 comments
- Kind: **ibisPaint X painting time-lapse** of a surreal/dreamcore sunset (video frames unobtainable in
  this sandbox — YouTube 401 wall; metadata + genre conventions harvested instead; refs in image-search/).

## What the video's workflow demonstrates → OmniFrame universal tools shipped

| ibisPaint X capability in the short | OmniFrame implementation | proof |
|---|---|---|
| recording / time-lapse export of the painting process | `paint_timelapse` (strokes appear in draw order → mp4 + final png) | test_ans_result/G_paint/*-timelapse.mp4, evidence/G-timelapse-{early,mid}.png |
| brush & gradient sky ramps | `draw_stroke` tool=gradient/brush (normalized engine) | G_paint/paint-timelapse-final.png |
| radial / symmetry ruler (sun rays, mandala skies) | `radialCopies` + `radialCenter` on any stroke | recipe board_G_sunset.json (12-ray sun) |
| smudge / blur blending of clouds | `draw_stroke` tool=smudge (pixel drag re-stamp) | recipe smudge strokes 4-5 |
| filled shapes (sun disc) | `filled` honoured on circle/ellipse | G_paint final pngs |
| dreamcore / surrealism grade | dreamcore preset (glow+grain+chromatic+vignette+dusk gradientMap) in paint_timelapse grade + AE rack | G_paint/dreamcore-timelapse.mp4 |

## Not implemented (out of scope / AI-free rule not implicated)
- ibisPaint X itself is a raster painting app; no AI generators appear in the short, so the whole
  harvest is non-AI and shipped. Audio ("Jane! (Hoodtrap)") is not redistributed.

Recipe: tools/mcp/recipes/board_G_sunset.json (18 universal calls). QA: qa/universal-tools-unit.mjs paint section.
