# Architecture

## Package boundaries

```text
apps/web                 React + TypeScript workbench / browser adapters
packages/engine          pure TypeScript engine, no DOM imports
crates/omniframe-core    reserved Tauri/Rust native core boundary
research                 research records and licence decisions
```

The engine is intentionally usable from Node tests, web workers, a browser main thread for small interactions, and a future Rust/WASM/native adapter. UI state never owns decoded frame buffers or tensors.

## Data flow

```text
asset probe -> project bin -> sequence/timeline -> render graph -> preview/export
                                      |              |
                                      +-> masks -----+
                                      +-> tracks ----+
                                      +-> Omniframe +
                                      +-> 3D scene -+
```

Expensive work is submitted to `JobManager`, with cancellation, progress, priority and measured history. LRU cache keys are stable and byte-budgeted.

## Render parity

Effects/transitions expose a CPU reference path and GLSL declaration. The CPU path is used for tests, thumbnails, fallback and reference output. The browser GPU path must be parity-tested before a definition is marked `parityVerified`. Export is not permitted to implement a separate, silently divergent effect.

## Desktop boundary

The future Tauri/Rust adapter owns native media and filesystem concerns. The project schema is versioned in TypeScript now so web persistence and desktop files share the same contract. Rust migrations must implement the same version transitions.

## Security

Projects/templates/effects are data. Untrusted shaders, project code, downloaded plugins and arbitrary native commands are not executed. Custom effect manifests are validated, licence-checked and sandboxed before registration.

## Web workers

`apps/web/src/workers/tracking.worker.ts` and `processing.worker.ts` are transferable-buffer boundaries for expensive browser work. The current deterministic demo inspector calls the same engine directly so it can show an immediate test path; production media adapters should dispatch decoded planes to these workers and terminate them on cancellation.
