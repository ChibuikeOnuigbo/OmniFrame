# Professional tracking

General tracking is not the same as mask tracking. The engine supports point/object/mask/plane concepts and a hybrid implementation for point/mask propagation.

Representation includes position, velocity, optional acceleration, patch/gradient identity, confidence, forward/backward error, occlusion state, neighbour/boundary context and latent state. Camera motion is estimated separately with translation/affine/homography choices and robust inliers.

Quality presets:

- Fast: fewer points, smaller windows, fewer pyramid levels;
- Balanced: default hybrid stack;
- Quality: denser features, larger windows, more levels and boundary refinement;
- All: explicit advanced stress path, not “run every model at once”.
