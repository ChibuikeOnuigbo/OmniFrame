# Paper-cut transition motion research

Retrieved 2026-09-21. Behavioral/visual research only; no stock imagery, video, texture, or third-party implementation is shipped.

## References inspected

- Envato Elements, “Realistic Paper Rip Transition Reveal”: https://elements.envato.com/ripped-paper-white-LPRYQEA
  - Useful visual principles: a narrow irregular edge, subtle shadow beneath the lifted edge, and underlying content revealed immediately behind the moving boundary.
- Envato Elements, “Dynamic Page Tear Reveal Transition”: https://elements.envato.com/ripping-paper-animation-3S6PARW
  - Useful motion principles: a top layer peels away while the next scene already exists below it; crisp edge and restrained depth sell the physical metaphor.
- CSS3Shapes, “How to Animate clip-path for Smooth Transitions”: https://css3shapes.com/how-to-animate-clip-path-for-smooth-transitions/
  - Compatible polygon point counts interpolate smoothly; `will-change: clip-path` should remain narrowly scoped.
- CSS Tools, “CSS Clip Path Animations”: https://csstools.io/blog/clip-path-animations
  - Polygon reveal can remain compositor-friendly and should respect reduced-motion preferences.
- Stack Overflow, “Ripped Paper CSS Effect using Polygon”: https://stackoverflow.com/questions/50874419/ripped-paper-css-effect-using-polygon
  - Alternating polygon points create a torn/ripple edge without bitmap assets.

Image-search thumbnails were inspected only to understand proportions and edge layering. They were not copied into the application or repository.

## Independent OmniFrame implementation

1. Keep Studio mounted below Landing before motion starts.
2. Clip Landing away with a percentage-based sixteen-point polygon.
3. Keep the transition wrapper narrow: at most 80 CSS pixels on the measured desktop viewport.
4. Use a nearly black fold side, restrained violet inner reflection, and a narrow illuminated seam—not a large solid-color block.
5. Add asymmetric shadow on both sides to imply lifted paper and separation between scenes.
6. Use one synchronized 980ms duration for route timer, landing mask, and paper-cut edge.
7. Preserve the 60ms reduced-motion path.
8. Use generated CSS gradients and vectors only; ship no third-party transition media.
