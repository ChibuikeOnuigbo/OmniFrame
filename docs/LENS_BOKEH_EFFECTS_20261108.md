# Lens bokeh renderer and effect-source audit

## Delivered behavior

OmniFrame now has a real camera-style lens bokeh pass in the shared raster
engine. It blurs the source and re-projects pixels over an editable luminance
threshold as diaphragm-shaped highlights. The controls are:

- amount, aperture size, highlight threshold and highlight gain;
- circle, triangle, square, pentagon, hexagon, octagon, diamond and star
  aperture shapes;
- aperture rotation and edge softness.

Every numeric field appears in the dropped-effect stack and can be keyframed.
The aperture shape is selectable. Existing effect regions limit the pass to
ellipse, rectangle, circle, text or custom-drawn masks. The same
`src/lib/pixelGrade.ts` implementation is used by browser preview, recorder
export and `tools/mcp/appRender.mjs`.

Sixteen curated recipes cover portrait, city light, practical, geometric,
neon and hard-aperture looks. These are recipes over one parameterized render
family. At delivery this produced 10,575 materialized recipe IDs and 15,575
with the lazy authored pack. The later indexed catalog work in
`EFFECT_CATALOG_150K_20261108.md` supersedes those current totals while keeping
the same 16 curated bokeh recipes. Recipe totals do not mean independent
algorithms or fully watched motion renders.

The renderer reuses two scratch canvases, samples a bounded grid and caps the
brightest aperture stamps at 520 per frame. Blur radius is capped at 64 px.
This follows the performance controls described by Blender's Bokeh Blur and
Defocus documentation. A live browser test exposed and fixed a translated
3× clip-isolation bug: the bokeh pass now resets to canvas coordinates while
processing and restores the caller transform, so effect masks do not receive
shifted or black pixels.

## Documentation and licensed-source evidence

The targeted official scan covered Adobe Camera Lens Blur, Krita blur
families, Kdenlive blur/sharpen taxonomy, Blender Bokeh Blur and Defocus, and
MDN animation keyframes. Adobe documents iris shape and rotation plus
highlight threshold/gain. Blender documents pixel-sized blur, bokeh-image
shape input, masking/calculation bounds, bokeh angle and maximum blur radius.
Krita and Kdenlive were used to check family naming and discoverability.

The official MIT-licensed LibreCuts `v1.0-beta7` arm64 APK was downloaded from
its GitHub release. Its 52,994,349 bytes matched the publisher's SHA-256
`cabdf4356fef9df2a048f88db27a6009953b8e920787e956071e074ecc8b04ca`;
ZIP integrity passed. The exact tagged source was read for its non-destructive
operation list, serialized project model, overlay/mask keyframes, FFmpeg
progress and hardware-to-software encoder fallback. The APK was never run.
No code or visual assets were copied into OmniFrame.

Poly Haven's CC0 **Camera 01** by Rajil Jose Macatangay was downloaded at 1K
glTF quality as an optics-related 3D candidate. All 11 files (2,439,882 bytes)
matched the API-provided MD5 values. Blender 4.3.2 imported its 26,987
polygons, two meshes, four materials and nine textures, then produced the
review image. The model is not bundled or presented as a shipped library
asset in this increment.

Machine-readable sources, hashes and evidence limits are in
`research/effect-source-audit-20261108.json`.

## Verification

- `node qa/lens-bokeh-unit.mjs`: eight distinct deterministic aperture
  signatures, zero-strength identity, 16 presets, unique catalog IDs,
  parameter metadata and import clamping.
- `node qa/lens-bokeh-ui-e2e.mjs`: catalog search/apply, all controls, shape
  change, numeric keyframe, effect-region mask and live editor screenshots.
- `npm run typecheck`, `npm run build`, universal tool and required interaction
  regressions are part of the final increment gate.

Artifacts:

- `qa/artifacts/lens-bokeh-apertures.png`
- `qa-output/lens-bokeh/lens-bokeh-controls.png`
- `qa-output/lens-bokeh/lens-bokeh-controls-mask.png`
- `qa-output/lens-bokeh/polyhaven-camera-01.png`

This increment implements a uniform defocus and highlight diaphragm renderer.
It does not infer per-pixel depth, simulate chromatic diffraction, or claim a
physically exact lens model. Depth-map rack focus remains separate work.
