# Hancybox click-scan (what he CLICKS, not what he makes)

Method: frames of his editing shorts (watched waves 0-1) inspected for editor
UI actions/effects; each checked against OmniFrame; missing basics created
with their maths, then results reproduced THROUGH the tools (recipes).

| clicked / used in short | OmniFrame status | action taken |
|---|---|---|
| fill composition area (scale-to-fill) | MISSING | created: fill_composition_area tool + bridge + headless |
| fractal blur | MISSING | created: ClipEffect.fractalBlur (3-octave stacked blur) in pixelGrade + rack |
| card flip effect | MISSING | created: ClipEffect.cardFlip (cos-fold squash + shade) in pixelGrade + rack |
| bg removal / luma key | partial (chroma only) | created: ClipEffect.lumaKey + remove_background tool |
| roto masking | HAVE (RotoMaskSubTool) | exposed: roto_mask universal tool |
| rectangle masking | HAVE (ClipVisualMask) | exposed: mask_draw universal tool |
| speed ramp / curves | HAVE (15 speed curves) | used in recipes |
| green screen insert | HAVE (chromaKey) | — |
| prism light-leak / flash burst | HAVE (overlayFx lightleak) | — |
| sticker/logo glow | HAVE (overlayFx frameglow) | — |
| stair-step duplicate timeline | HAVE (duplicate/paste) | exposed: duplicate_paste copy flag |
| AE settings dialog combos | HAVE (AE Tool Rack) | — |
| wedge wipe / gold card / dual typo / wire glow beds | HAVE (scene recreations 23-27) | — |
| invisible cut | partial (grammar reproduced in scene family) | logged for preset naming |

Reproduction order honoured: scan clicks → check app → create basic with maths
→ rewatch → reproduce via universal tools (tools/mcp/recipes/*.json).
