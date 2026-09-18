# Tracking research and implementation record

**Checked:** 2026-09-18. Sources: OpenCV, Lucas–Kanade, Shi–Tomasi, RANSAC, TAPIR/TAPNet, supervision, SAM2, COLMAP/OpenMVG research.

## Hybrid stack

1. analysis-resolution frame and Gaussian pyramid;
2. Shi–Tomasi features, with adaptive density and boundary bias;
3. pyramidal Lucas–Kanade with gradient structure tensor;
4. forward/backward re-projection check;
5. affine/translation camera estimate with RANSAC;
6. robust median/MAD residual rejection;
7. velocity/occlusion state and reinitialisation;
8. inverse-distance non-rigid displacement field;
9. boundary profile refinement;
10. measured confidence and correction keyframes.

The persistent identity is a local feature/patch neighbourhood, not an RGB value at a fixed coordinate. This addresses colour changes, lighting changes, background invasion and articulated motion.

## Confidence

Stored metrics:

- forward/backward error;
- inlier ratio;
- mask area drift;
- boundary jitter;
- displacement;
- reinitialisation count;
- aggregate confidence and quality bucket.

The UI must display `Excellent`, `Good`, `Uncertain`, or `Lost` only from those measurements.

## 2D vs 3D camera motion

An affine/homography estimate can explain camera translation, rotation, scale and perspective on a plane. It is not a full metric 3D solve. OmniFrame therefore offers 2D/2.5D attachment first and keeps a full solve behind an explicit advanced job with parallax/track-count diagnostics.

## SAM2 option

SAM2 is an opt-in segmentation assist. It is not the default tracker and it is not executed from the React render loop. `trackMaskWithSam2()` uses sparse keyframes and classical propagation, measures the actual encoder/propagation times, and returns a real fallback reason when runtime/model loading fails.
