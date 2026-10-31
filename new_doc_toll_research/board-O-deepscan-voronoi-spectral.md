# Board O deep-scan: AM official detail pages (voronoi-cells, spectral-map) — 2026-10-26
- guide.alightmotion.com/effects/voronoi-cells — tags Procedural/Random/Raster: "Renders procedurally-generated
  pattern of Voronoi cells based on randomly placed points." (page body still 'under construction' — definition
  line is the official spec). OmniFrame engine: seeded random sites (4-48), per-pixel nearest/second-nearest
  distance → cell-edge glow line + faint cell-body tint, colour + intensity keyframeable. Proofs O-voronoi-16.png.
- guide.alightmotion.com/effects/spectral-map — tags Color/Color&Light/Fun/Luma Map/Raster: "Maps each color in
  the layer into a custom spectrum of colors based on the brightness of the original color." OmniFrame engine:
  per-pixel luma → hue sweep 0-300° (red→magenta) mixed by intensity. Proofs O-spectral-1.png (+ chroma-rise assert).
Refs: images/boardO-voronoi-pattern-ref.png (gorhyme voronoi art), images/boardO-voronoi-edges-ref.png
(r/proceduralgeneration distorted voronoi edges).
Catalog: voronoi-8/16/32 (light), spectral-0/1 (color). Backlog honest: voronoi site animation/motion, custom
multi-stop spectra for spectral map (AM 'custom spectrum'), cell fill modes.
