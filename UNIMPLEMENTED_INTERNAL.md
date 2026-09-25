# OmniFrame Internal Architecture Ledger: Platform Boundaries & Native Roadmap
**Status:** Canonical Engineering Record  
**Visibility:** Internal Only (Zero user-facing placeholder stubs permitted in production UI)  
**Date:** 2026-09-25

---

## 1. Executive Directive & Architectural Principles

OmniFrame adheres to the **Zero-Placeholder Guarantee**:
1. No user-facing control may exist that yields "will be implemented next", "coming soon", or dummy mock responses.
2. If a feature cannot run with production-grade fidelity within the browser's sandbox, it is:
   - Excluded from the web client;
   - Architected as a native capability in the Tauri desktop environment (`src-tauri`); or
   - Recorded in this internal ledger with its exact mathematical, memory, and API requirements.

---

## 2. Web vs. Desktop Platform Capability Matrix

| Subsystem | Web Client (Wasm / WebGL2 / Web Audio) | Desktop Native (Tauri / Rust / FFmpeg / Vulkan) | Architectural Reason |
|---|---|---|---|
| **Video Decoding** | Hardware `<video>` element + MediaCapabilities API (H.264, VP9, AV1, WebM) | Direct libavcodec / FFmpeg C bindings (ProRes 422/4444, DNxHR, CinemaDNG, RAW) | Browser cannot decode proprietary 10-bit/12-bit intermediate codecs without licensing and memory-mapped native decoding buffers. |
| **Color Pipeline** | sRGB 8-bit Canvas 2D + WebGL2 32-bit float texture compositing | ACEScc / Rec.2020 16-bit half-float linear pipeline via Vulkan / Metal | Web canvas display buffers clamp to browser compositing color space (sRGB or Display P3 where supported). |
| **Audio DSP** | Web Audio API AudioWorklet (biquad filters, dynamics compressor, gain, gain nodes) | VST3 / AU / CLAP native plugin hosting + 64-bit double precision summing bus | Native VST3 plugins require OS-level dynamic library loading (`dlopen`/`LoadLibrary`), unavailable in browser sandboxes. |
| **Export Engine** | Client-side MediaRecorder API + WebCodecs / Canvas Capture Stream (WebM, MP4) | Hardware NVENC / VideoToolbox / QuickSync accelerated multi-pass MP4/ProRes rendering | Browser MediaRecorder lacks CRF rate control and multi-threaded CPU encoders (x264/x265). |
| **File I/O** | Origin Private File System (OPFS) + File System Access API handles | Direct OS POSIX / Win32 memory-mapped file streams (`mmap`) | Instant zero-copy scrubbing of 50GB 4K media files requires direct kernel paging. |
| **3D Rendering** | Three.js WebGL2 rasterizer with spherical camera orbital transport | Native wgpu / Vulkan raymarching and physical path tracer | WebGL context memory limits (typically 2GB–4GB per tab) restrict polycount and texture memory. |

---

## 3. Deep Technical Analysis: Platform Boundaries

### 3.1 Codec Licensing & Multi-Track Scrubbing Latency
- **Limitation:** In the browser, seeking `<video>` elements incurs asynchronous decoder queue latency (typically 30ms–150ms per keyframe interval / GOP). Multi-track simultaneous playback of 4+ 4K H.264 streams causes frame dropping due to hardware decoder session limits (typically 2–4 concurrent decoders on mobile and consumer GPUs).
- **Internal Resolution:** OmniFrame employs a single authoritative Compositor Canvas (`#of-canvas`) driven by `PreviewEngine`. Audio waveforms are pre-decoded into 256-bin RMS arrays upon ingest. For the desktop build, libavcodec handles packet extraction in background worker threads with frame caching.

### 3.2 True Non-Destructive Layer Mask Rasterization
- **Limitation:** Running full CPU-based flood-fill segmentation (e.g. hair recoloring or rotoscoping) across 60 frames per second on 4K resolutions exceeds the 16.6ms frame budget on web single threads.
- **Internal Resolution:** Feature-Slice 04 operates on offscreen canvas buffers with dual-phase marching ants overlays, rasterizing masks at export time through synchronous multi-pass compositing.

### 3.3 Hardware-Synchronized Broadcast Monitoring
- **Limitation:** Blackmagic DeckLink / AJA Kona SDI output cards cannot be addressed via WebUSB or WebHID due to kernel driver DMA requirements.
- **Internal Resolution:** Reserved for Tauri Native Desktop Build (`omni-desktop`).

---

## 4. Audit Checklist: Zero-Stub Verification

- [x] All planned stub panels in `src/components/LeftDock.tsx` replaced with real components (`TransitionsPanel`, `EffectsPanel`, `TextPanel`, `ThreePanel`).
- [x] Aspect ratio dropdown contains real mathematical presets (`16:9`, `9:16`, `1:1`, `4:5`, `3:4`, `4:3`, `3:2`, `2:3`, `5:4`, `21:9`, `custom`) and enforces authoritative sequence dimensions during export.
- [x] Media import decoupled: assets load strictly into Media Library and Source Monitor; zero unintended timeline insertion.
- [x] Context menus completely target-aware: empty track right-clicks show track operations only, never clip or transition commands.
- [x] All E2E test suites pass with real file exports analyzed by headless OpenCV.
