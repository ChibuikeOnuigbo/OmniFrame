# Board L engine research (kaleidoscope / lens flare / color temperature) — 2026-10-26
Backlog names converted to REAL OmniFrame engines this batch; every claim below is sourced.

## Kaleidoscope
- filmmakingelements.com/davinci-resolve-kaleidoscope-effect/ (studied tutorial, chunk 0 fetched): Resolve FX Stylize **Mirrors** effect, Mirror Placement **Rosette** = kaleidoscope; controls **Position / Angle / Wedge Width** → OmniFrame params `kaleidoSegments` (wedge count) + `kaleidoRotate` (wedge rotation deg); mirror-fold per wedge = true rosette symmetry (verified in L-kaleido-6.png).
- Method 2 (Fusion Transform, Edges=Mirror + Size/Angle) and Method 3 (Fusion Mirrors node) = same wedge-fold family.
- Images: images/boardL-resolve-kaleidoscope-methods.png, images/boardL-resolve-mirror-methods.png.
- AM index relatives (chunk 2): Tiles, Tile Rotate, Tile Shift → crosswalk rows in am-effects-s-z.html.

## Lens flare (optical family)
- petapixel.com anamorphic lens coverage (2024-12): anamorphic optics = horizontal blue/gold streak + oval bokeh → OmniFrame `flareStreak` (horizontal streak length) rendered as scaled radial gradient under `screen`.
- Ghost rings + halo = classic optical flare anatomy (ghosts along the axis through frame centre) → `flareGhosts`, core bloom → `flare`, position `flareX/flareY` (%), tint `flareColor`.
- Image: images/boardL-anamorphic-flare-reference.jpg. AM index relative: Soft Glow (bloom family).

## Color temperature (Kelvin white balance)
- diyvideostudio.com kelvin-color-temperature-scale-chart + iphotography.com White-Balance-Chart-Kelvin-Scale: candle ≈1900-2500K, tungsten ≈3200K, daylight ≈5600-6500K, overcast ≈6500-8000K, shade/sky ≈9000-10000K → OmniFrame `colorTemp` range 1500-15000K, 6500 = neutral, per-pixel R/G/B gain cast (warm: +R −B, cool: −R +B).
- Images: images/boardL-kelvin-scale-chart.webp, images/boardL-white-balance-chart.jpg.
- Catalog presets: kelvin-2500 Candle / kelvin-3200 Tungsten / kelvin-4500 Warm White / kelvin-8000 Overcast / kelvin-10000 Deep Shade.

## Proofs (app-made only)
test_ans_result/evidence/L-base.png, L-kaleido-6.png, L-flare-anamorphic.png, L-kelvin-3200.png, L-kelvin-10000.png, L-kelvin-ramp-warm.png, L-kelvin-ramp-cool.png — all from data_dump data:img (the app renderer), never python/ffmpeg authoring.
