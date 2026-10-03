# OmniFrame Research Failures & Abandoned Approaches

This document logs architectural approaches, research assumptions, and candidate implementations investigated during development that were rejected or abandoned due to platform limitations, mathematical failure, or UX degradation.

---

| Failure ID | Investigated Approach | Tested Domain | Outcome & Root Cause | Architectural Pivot / Resolution |
|---|---|---|---|---|
| RF-0001 | DOM Pixel-Based Timeline Intervals | Timeline Modeling | Storing `clip.leftPx` and `clip.widthPx` directly in state caused rounding drift and broken snap alignment when continuous zoom changed. | Pivoted to invariant temporal intervals (`startTime`, `duration` in seconds). Screen coordinates are strictly derived via `t * pixelsPerSecond`. |
| RF-0002 | Global Context Menu Action Registry | UI / Context System | Rendering a single generic context menu across the editor led to "Cross Dissolve" and "Cut" appearing when clicking empty track headers or canvas stages. | Replaced with centralized target-aware resolver mapping commands strictly to `(target, capabilities, selection)`. |
| RF-0003 | Native VST3 Audio Plugin Ingestion | Audio DSP | Attempted WebAssembly bridge for compiled native VST3 plugins; blocked by sandboxed browser security and memory limits. | Implemented pure Web Audio Float32Array DSP filters (SVF crossover, mid-side cancellation) and recorded boundary in `UNIMPLEMENTED_INTERNAL.md`. |
| RF-0004 | Client-Side ProRes 4444 Video Encoding | Video Pipeline | Chromium HTML5 `MediaRecorder` lacks native ProRes 4444 codec encoders. | Standardized on VP9/VP8 WebM for high-fidelity web export; documented native ProRes transcode for desktop platform. |
| RF-0005 | Single-Pole IIR Filter for Vocal Removal | Voice Isolation | Simple single-pole highpass/lowpass filters caused excessive phase smearing and stripped low-end bass kicks below 200Hz. | Replaced with 2nd-order Butterworth State Variable Filter (SVF) with dedicated 140Hz mono bass preservation. |
| RF-0006 | Direct GPL C++ Source Ingestion | Legal & Architecture | Directly porting C++ source from MLT/Kdenlive into TypeScript raised GPL license contamination concerns. | Implemented clean-room TypeScript algorithms authored strictly from mathematical specifications. |
