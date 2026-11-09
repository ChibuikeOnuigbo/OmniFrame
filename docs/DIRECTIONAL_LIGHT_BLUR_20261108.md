# Directional light and professional blur controls

This increment closes a concrete gap found while comparing the requested blur
and light families with the editor's shared render path.

## Product behavior

- Directional light is a real screen-blended beam with editable angle, center,
  width, softness, intensity and colour. Point and Spot remain available; Spot
  also gains rotation.
- Directional Blur now supports centered or one-sided sampling, angle spread
  and a luma threshold for bright-pixel streaks. Existing Horizontal, Oblique,
  Vertical, Radial, Zoom, Gaussian and Motion Blur entries remain available.
- Zoom/directional blur reuse their source and bright-pass canvases across
  frames, avoiding two native backing-store allocations per rendered frame.
- Four focused blur recipes and six directional-light colour recipes were
  added. Recipe controls are generated from the same parameter schema used by
  effect instances, so numeric values can use the existing effect-keyframe
  path.
- Browser preview, desktop preview/export and universal MCP rendering call the
  same `src/lib/lightFx.ts` light compositor. Directional blur continues to use
  the shared `pixelGrade.ts` engine.
- The adjustment-layer panel uses compact Point, Spot and Beam icon controls.
  Missing particle/overlay values now display their real defaults instead of
  `NaN`.

## Verification

- `node qa/directional-light-blur-unit.mjs`: six changed-pixel and distinct
  fixture renders, catalog parameter exposure and imported-value clamping.
- `qa/artifacts/directional-light-blur-contact-sheet.png`: inspected Point,
  rotated Spot, two beam angles, one-sided blur and thresholded fan blur.
- `node qa/directional-light-blur-ui-e2e.mjs`: selected the Beam icon, changed
  angle/width/softness, confirmed stored values and no `NaN`, and captured the
  real canvas/UI under `qa-output/directional-light-blur/`.
- TypeScript, production Vite build, 63-step universal tool regression and the
  existing 50-Burst/action regression pass.

These checks establish the implemented controls and shared-render behavior.
They do not certify visual parity with every commercial blur or light plug-in,
or realtime 4K performance on untested hardware.
