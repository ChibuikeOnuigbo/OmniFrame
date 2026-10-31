# MatttVfx — "3 Advanced ONE FRAMERS in After Effects" (youtube.com/watch?v=j3Lt0dU1Lok)

- Channel: MatttVfx (+ NovaVisionHub) · 18,180 views · 1,473 likes · Jun 27 2026 · #novavision #novavisionlibrary
- Fetched via r.jina.ai proxy (frames un-downloadable in sandbox; chapters + metadata harvested).
- Chapters: 0:00 Directional minimax blur · 2:49 VHS aesthetic effect · 4:41 Directional colorize effect · 6:34 Nova Vis library overview (asset-library promo, not a tool).

## Techniques → OmniFrame universal tools shipped (non-AI)
| video chapter | AE technique | OmniFrame implementation | proof |
|---|---|---|---|
| Directional minimax blur | Minimax morphological luminance grow/shrink along an angle = smear/streak of bright regions | pixelGrade `minimax` + `minimaxAngle` + `minimaxMode` (applyOneFramer) | H_oneframer/oneframer-minimax-colorize.mp4, evidence/H-oneframer-minicolor.png |
| VHS aesthetic effect | scanlines + tape noise + chroma bleed + horizontal band wobble | pixelGrade `vhs` (single-pass: scan every 4th row, seeded noise, ±2px R/B bleed, sin band wobble per frame) | H_oneframer/oneframer-vhs.mp4, evidence/H-oneframer-vhs.png |
| Directional colorize effect | two-colour ramp mixed along a direction vector | pixelGrade `dirColorize` + From/To/Angle | same minicolor mp4 |
| all three stacked | the "one-framer" grade | recipe board_H_oneframer.json variant `all` | H_oneframer/oneframer-all.mp4, evidence/H-oneframer-all.png |

Rack entries: "Minimax smear (AE)", "VHS aesthetic (AE)", "Directional colorize (AE)" (RightPanel pixel group).
Pixel probes: minimax 129→136 (max-mode grow), vhs 129→94 (scan+noise), dirColorize [#2a29c6 → #d53939] across the 45° ramp.
AI note: nothing AI in this video; Nova Vision Library is a paid asset library — logged, not implemented, not redistributed.
