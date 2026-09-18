# Performance

## Principles

- main thread stays interactive;
- visible frame and interactive preview have priority over cache work;
- 4K preview uses analysis/preview/export resolutions separately;
- buffers, tensors, VideoFrames, ImageBitmaps, GPU textures and render targets are disposed;
- thumbnail/waveform/tensor work runs through jobs/workers;
- model downloads are explicit and cached;
- LRU caches have byte limits, not just entry counts.

## Measured targets (not promises)

The benchmark harness must record startup, first frame, scrub, frame-step, brush latency, model load, tracking time, export speed, memory and CPU/GPU use on the actual machine. The product must not invent numbers. `JobProgress.etaMs` is null when there is insufficient evidence.

## Current reference paths

The TypeScript tracker and inpainting/bake paths are correctness references. Native Rust and GPU paths should be benchmarked against them before replacing them.
