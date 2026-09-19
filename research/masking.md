# Masking and background-removal research

**Checked:** 2026-09-19. Sources: [Krita brush engines](https://docs.krita.org/en/reference_manual/brushes/brush_engines.html), Krita selection behaviour, [Adobe mask modes](https://helpx.adobe.com/after-effects/desktop/work-with-transparency-and-compositing/work-with-alpha-channels-and-masks/alpha-channels-masks-mattes.html), OpenCV morphology/inpaint, BiRefNet Lite, MODNet, SAM2, browser worker APIs, and the feature/tutorial pointers in `research/youtube-features.json`.

## Manual masking

The engine retains the requested foundation: brush, rectangle, ellipse, line/stroke, polygon, lasso, magnetic edge walk, flood fill, similar colour, magic brush, path/Bezier, invert, add/subtract/intersect/replace, feather, grow/shrink, smooth, threshold, hole fill and small-component removal.

The brush research points to a deliberately staged roadmap rather than a wall of fake presets: pixel/paint, inking/stabilised stroke, clone/repair, smudge, deform, particle/texture, spray and shape/vector tools. Video masking should borrow the interaction language—size, hardness/flow, stabilisation, texture and pressure where available—while keeping the result as a serialisable mask, not an art-app-only raster canvas. Adobe's mask modes also reinforce that Add/Subtract/Intersect belong to masks on the same layer; layer blend modes belong to compositing between layers.

Krita-inspired modifiers are explicit:

- Shift: add;
- Alt: subtract;
- Ctrl: replace when not conflicting;
- Shift + Alt: intersect.

`THIS FRAME`, `RANGE`, and `ALL FRAMES` are first-class controls. They are not hidden under Advanced.

## Per-frame masks

A mask frame is a serialisable RLE mask with width/height metadata. The UI can move to next/previous frame, next unmasked frame, copy forward/backward, interpolate with signed-distance fields, duplicate, clear and correct only the affected range.

## Background removal pipeline

Preview path:

```text
low-resolution inference
  -> sparse keyframes
  -> temporal/classical propagation
  -> boundary refinement
  -> cache
```

Final path:

```text
full-resolution decode
  -> correction keyframes
  -> licensed model pass
  -> edge/hair cleanup
  -> alpha/color validation
  -> export
```

The model registry distinguishes code licence from weight licence. `ISNet-ONNX` is not a shipping model in this policy.

## Crop + AI fallback

The fallback is useful when a full-frame model is too expensive:

1. target mask;
2. mask bounds + padding;
3. fixed/tracked/adaptive ROI;
4. crop;
5. licensed model on crop;
6. map mask back to source coordinates;
7. refine and composite.

This is an optimisation/fallback, not a claim that all object boundaries can be solved by cropping.
