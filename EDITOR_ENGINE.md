# Editor engine

The engine is organised by responsibility rather than by screen:

- `core`: geometry, matrices, pixel buffers, robust maths, IDs;
- `timeline`: clip/track/sequence schema, editing operations, keyframes, history;
- `mask`: tools, morphology, RLE, contours, interpolation;
- `tracking`: feature detection, pyramids, LK, camera motion, warp, driver, SAM2 adapter;
- `omniframe`: non-destructive operations and real repair algorithms;
- `three`: scenes, rigging, IK, baking;
- `effects`: effect/transition registries and CPU reference renderers;
- `templates`: typed slots and validator;
- `project`: `.vxproj` format and migrations;
- `jobs/cache/audio/export`: cross-cutting systems.

Every expensive path accepts `AbortSignal` or `JobContext.throwIfCancelled()`. Every model reports licence and capability metadata. Every confidence value is derived from measurements.
