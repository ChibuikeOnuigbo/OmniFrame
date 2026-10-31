# Roto / mask accuracy benchmark (measured, headless app render)

Ground truth: analytic circle r=120px centred in 480×480. White clip masked three ways; shape_detect on a known circle png.

| case | mean |edge err| px | max px | IoU vs analytic | extra |
|---|---|---|---|---|
| roto_mask polygon 64 pts, feather 0 | 0.63 | 1.5 | 0.9924 | exported matte IoU n/a |
| mask_draw ellipse, feather 0 | 0.59 | 1.5 | 0.9923 | |
| roto feather 8 | – | – | – | 10→90% band 69.5 px |
| shape_detect on circle png | – | – | – | class=circle, centre err 0 px, radius err 0 px, fill−π/4 -0.001 |

Verdict: hard edges are sub-pixel accurate (mean ≤0.63 px, IoU ≥0.992, shape_detect exact) → no roto rewrite warranted (master prompt P0: measure first).
Flagged for calibration, NOT rewrite: the feather control is coarse/non-linear — feather 0 = hard edge, but any small feather value already yields a ~60-70 px 10→90% band (measured 8→69.5 px, 8/W→59.75 px). Feather→band curve needs a calibration table before px-accurate soft mattes can be promised.
