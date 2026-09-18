# Media, colour and export research

**Checked:** 2026-09-18. Sources: FFmpeg, WebCodecs, MP4Box.js, mp4-muxer, Media Capabilities, Web Audio, Streams, Web Workers and IndexedDB.

## Browser path

- demux with a container adapter;
- decode to `VideoFrame`;
- transfer frames to workers where possible;
- use WebGPU/WebGL/Canvas2D for preview;
- encode with a probed `VideoEncoder` configuration;
- mux separately;
- close VideoFrame/ImageBitmap/GPU resources promptly.

WASM is a fallback. It is not silently chosen when a native/browser encoder is available.

## Desktop path

Tauri 2 provides the shell and scoped filesystem permissions. Rust owns atomic project writes, job lifecycle, native decode/encode orchestration, cache and recovery. FFmpeg/native libraries are capability/licence-audited components, not a UI dependency.

## Colour and alpha

The engine CPU reference uses non-premultiplied RGBA and documents that buffers are linear-light for calculations where appropriate. Native/browser boundaries must state transfer function, range, pixel format and alpha mode. Creative brightness, exposure, tone mapping and display conversion are separate operations.

## Export

Presets currently include YouTube 1080p/4K, Shorts, TikTok, Instagram 1:1/4:5, HEVC where supported, and AV1 WebM where supported. The UI must show actual codec probe results. Export progress reports stage, frame, elapsed, ETA only when measurable, output and cancel.
