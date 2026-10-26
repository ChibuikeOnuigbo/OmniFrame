# Board P deep-scan (2026-10-26): AM Timecode + Krita Multibrush Translate + Krita Gradient repeat
- guide.alightmotion.com/effects/timecode — tags Auto/Property Adjust/Text/Utility: "Replaces the text in the
  layer with a running timecode." OmniFrame engine: HH:MM:SS:FF burn-in overlay drawn per frame (24 fps frame
  index from the render seed), white mono + dark outline, opacity + size keyframeable. Proof P-timecode-burnin.png
  (shows 00:00:01:00 at t=1.0).
- Krita Multibrush Translate mode (docs.krita.org multibrush, scanned Board M): "paint the set number of
  instances around the cursor at the radius distance" → OmniFrame draw_stroke translateCopies 2..12 +
  translateRadius px: constant ring offsets, every copy traces the same path shifted. Proof P-translate-ring4.png.
- Krita Gradient repeat modes (docs.krita.org gradient_draw, scanned Board M): Repeat None / Forward /
  Alternating → OmniFrame gradientRepeat none|forward (saw, hard jump per cycle)|alternating (triangle).
  Proofs P-gradient-repeat-none/forward/alternating.png (pairwise diffs asserted).
- Text ref (image hits were off-topic product thumbs, discarded per house rule):
  store.hollyland.com/blogs/creator-hub/add-timecode-in-davinci-resolve (Resolve timecode burn-in workflow).
Catalog: timecode-1 (18px), timecode-2 (32px) under retro. Backlog honest: AM timecode custom format strings /
font families; Krita copy-translate-at-interval grid; gradient antialias-threshold + dither.
