# Masking

Masking is an editable cutout mode, distinct from Omniframe and general tracking.

The engine supports brush/stroke, rectangle, ellipse, polygon, flood fill, similar colour, magnetic edge walk, magic brush, edge-aware brush, invert, boolean operations, feather, dilate/erode, smooth, threshold, fill holes, connected components, small-component removal, bounds/centroid and contour tracing.

Masks are single-channel `[0,1]` buffers in memory and RLE frame records in projects. Manual edits can target this frame, a range, or all frames. Signed-distance interpolation avoids the ghosted silhouette common with alpha crossfades.

The web inspector keeps range and display controls visible. The current canvas interaction writes a real mask buffer; model-assisted operations are separate jobs.
