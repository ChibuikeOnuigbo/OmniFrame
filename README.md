# OmniFrame

OmniFrame is a local-first, cross-platform video editor workbench built around a platform-independent TypeScript engine with a Rust/Tauri desktop target.

> Edit every frame. Track anything. Build in 2D and 3D.

## Current implementation

The repository is an engine + web workbench, not a static dashboard:

- frame-addressed multi-track timeline with trim, split, ripple, roll, slip, slide, snapping, markers, adjustment tracks, keyframes and command undo/redo;
- explicit local video/audio/image/GLB import, browser-decoded canvas preview, correct source-frame stepping, playback, zoom/pan/guides, transforms, effect instances, mask-aware CPU preview and local `.vxproj` autosave/recovery;
- manual masking primitives, Krita-style modifiers, morphology, flood/similar colour, RLE masks, visible display modes and per-frame/range/all-frame correction data;
- separate Masking, Mask tracking, General tracking and Omniframe workspaces;
- hybrid tracker: pyramidal Lucas–Kanade, Shi–Tomasi, forward/backward verification, RANSAC camera motion, MAD outliers, occlusion state, non-rigid warp, boundary refinement and measured confidence;
- explicit SAM2 option with Apache-2.0 registry metadata, sparse keyframes, classical propagation and an honest fallback when ORT/model loading is unavailable;
- Omniframe data model and execution path: track, cut/move/duplicate/recolour/privacy, repair via Telea/diffusion/PatchMatch/temporal fallback, composite and non-destructive operation records;
- data-driven effects with CPU reference renderers and GLSL declarations; the same CPU effect definition is used by the canvas preview and browser export path;
- Three.js GLB/glTF viewport with orbit controls, PBR material loading, RoomEnvironment/PMREM lighting, parser error state and a real CPU lightmap/AO bake that reports a cache key and measured time;
- validated typed template slots, project migrations, `.vxproj` serialization, session-safe missing-media relink/proxy states, multiresolution waveform engine data and export presets;
- browser WebCodecs H.264 + AAC encoding and MIT `mp4-muxer` integration. The UI refuses to write an MP4 if the current browser cannot provide both encoders;
- Tauri 2/Rust command boundary for atomic project writes, recovery snapshots, project-envelope validation, media fingerprints/relink checks, FFmpeg capability probing and cooperative cancellation;
- responsive dense workbench with no page-level horizontal overflow, honest empty/error states, command palette, worker boundaries and explicit local-only processing.

## Run

```bash
npm install
npm run dev
# open the live Vite URL; click Open editor or use #editor
```

## Test and build

```bash
npm run typecheck
npm test
npm run build
npm run license:audit
```

The engine tests cover timeline operations, keyframes, masks, interpolation, tracking, Omniframe repair/compositing, IK, rigging, baking, effects, templates, project migrations, jobs, cache, models, audio and export capability handling.

## Desktop direction and current gate

Tauri 2 + Rust is the desktop shell. Rust is reserved for native media orchestration, filesystem/atomic saves, project serialization, job management, FFmpeg integration, native CV/AI adapters, caching and hardware-aware export. The shell now contains the native command boundary, but this sandbox does not include Cargo/rustc or FFmpeg, so native builds and real FFmpeg export have not been claimed as verified.

```bash
npm run desktop:dev
npm run desktop:build
cargo check -p omniframe-core
```

The browser workbench remains functional without a login or cloud service. See [`ARCHITECTURE.md`](ARCHITECTURE.md), [`moreresearch.md`](moreresearch.md), and [`research/references.json`](research/references.json) for decisions and release gates.
