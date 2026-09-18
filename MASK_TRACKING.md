# Mask tracking

Workflow:

1. draw a mask;
2. choose forward/backward/both, quality and range;
3. analyze in a cancelable job;
4. inspect confidence, camera motion, inlier ratio, area drift, jitter and reinitialisations;
5. correct a frame/anchor and rerun only the affected segment.

The classical engine is always available. SAM2 is an explicit Apache-2.0 registry option using sparse keyframe inference plus classical propagation. If the runtime/model is unavailable, the result says so and falls back; it never reports fake masks or fake model progress.
