# OmniFrame Architectural Research Sources (`RESEARCH_SOURCES.md`)

## Policy & Scope
Per OmniFrame Code Research Policy, we systematically examine open-source and professional video editing architectures (including GPL, LGPL, MIT, and Apache licensed engines) to understand industry-standard algorithms, mathematical formulations, user interaction models, and performance optimizations. All code in OmniFrame is clean-room authored in modern TypeScript, React, and WebGL, adopting established timeline paradigms and compositing mathematics without source code copying.

## Studied Reference Implementations

### 1. Kdenlive (KDE / MLT)
- **Repository / Upstream**: `invent.kde.org/multimedia/kdenlive`
- **License**: GPL-3.0-or-later
- **Core Architecture Analyzed**:
  - Discrete `TimelineModel` with multi-track composition hierarchy.
  - Mix transitions: same-track overlapping regions creating automatic affine blending transitions.
  - Composition track routing: explicit A/B track linking vs implicit downward compositing.
  - Invariant time representation: rational time base `GenTime` preventing cumulative floating-point drift.
- **OmniFrame Takeaway**: Implemented discrete `Transition` objects anchored to cut points with configurable duration, alignment, and WebGL/Canvas blend functions.

### 2. Shotcut (MLT Engine)
- **Repository / Upstream**: `github.com/mltframework/shotcut`
- **License**: GPL-3.0-or-later
- **Core Architecture Analyzed**:
  - Clip snapping mathematics: threshold-based magnetic snapping to playhead, markers, in/out points, and track bounds.
  - Multi-track ripple editing: ripple all tracks vs ripple single track modes.
  - Audio waveform peak generation: multi-resolution peak files (.dat) cached alongside video proxies.
- **OmniFrame Takeaway**: Implemented dynamic magnetic snap points with visual guide lines and cached 256-point audio peak arrays.

### 3. OpenShot Video Editor (libopenshot)
- **Repository / Upstream**: `github.com/OpenShot/openshot-qt` & `libopenshot`
- **License**: GPL-3.0-or-later
- **Core Architecture Analyzed**:
  - Keyframe curve mathematics: Bézier, linear, and constant interpolation for every transform parameter.
  - Timeline scale factor: logarithmic zooming with continuous timecode ruler subdivisions.
  - Transition grayscale wipes: luma-matte masks driving dissolve patterns.
- **OmniFrame Takeaway**: Supported wipe left/right shaders and keyframe interpolation curves for clip transform properties.

### 4. Olive Video Editor
- **Repository / Upstream**: `github.com/olive-editor/olive`
- **License**: GPL-3.0-or-later
- **Core Architecture Analyzed**:
  - Node-based compositing graph integrated underneath a traditional NLE track timeline.
  - Color management pipeline: OpenColorIO (OCIO) linear color workflow.
  - Frame-accurate video preview cache using ring buffer textures.
- **OmniFrame Takeaway**: Clean separation between temporal interval representation and spatial compositing shaders.

### 5. Blender VSE (Video Sequence Editor)
- **Repository / Upstream**: `projects.blender.org/blender/blender`
- **License**: GPL-2.0-or-later
- **Core Architecture Analyzed**:
  - Channel strip model: strips can occupy arbitrary vertical integer channels without strict video/audio track segregation.
  - Strip modifiers and adjustment layers: applying grading and transitions hierarchically across multiple strips.
- **OmniFrame Takeaway**: Flexible track layering model supporting overlay tracks and multi-clip adjustment scopes.

### 6. CapCut Desktop (Commercial Reference)
- **Observed Paradigms**:
  - Primary magnetic track with secondary overlay tracks.
  - Dragging a clip vertically out of its track dynamically opens a new track insertion zone above or below.
  - Cut-point transition glyph buttons and intuitive right-click context menus for transition presets.
- **OmniFrame Takeaway**: Implemented track creation above/below, transition glyph pills, and target-aware context menus.

### 7. Audacity Vocal Reduction and Isolation
- **Repository / Upstream**: `github.com/audacity/audacity` (Nyquist vocal isolation plugin & C++ audio DSP)
- **License**: GPL-2.0-or-later / GPL-3.0
- **Core Architecture Analyzed**:
  - Center-Channel Cancellation & Mid/Side phase extraction ($M = (L+R)/2$, $S = (L-R)/2$).
  - 3-band crossover filter isolating human vocal formant frequencies (140Hz–7500Hz) while leaving bass kicks/sub-frequencies (<140Hz) and high-frequency sparkle intact.
  - Dynamic envelope tracking and bandpass filtering for speech intelligibility.
- **OmniFrame Takeaway**: Clean-room implementation in TypeScript/Web Audio (`src/lib/voiceIsolation.ts`) with zero dependency on GPL binaries, implementing time-domain Chamberlin SVF crossover filters and canonical 16-bit WAV PCM encoding.

### 8. DaVinci Resolve Studio Fairlight Voice Isolation & Dialogue Leveler
- **Vendor / Upstream**: Blackmagic Design Fairlight Audio Core
- **License**: Proprietary Commercial
- **Core Architecture Analyzed**:
  - Neural-network accelerated Voice Isolation algorithm running real-time on Fairlight Audio Accelerator / DaVinci Neural Engine.
  - Separates dialogue from ambient background noise, air conditioning rumble, traffic, and room reverberation.
  - Provides a single continuous wet/dry isolation percentage slider (0% to 100%) paired with dialogue leveler and gate controls.
- **OmniFrame Takeaway**: OmniFrame's Voice Isolation panel features an isolation intensity slider (0-100%), high-pass cutoff (rumble removal), and formant Q factor, allowing progressive real-time suppression of non-vocal audio without phase artifacts.

### 9. Demucs v4 (Hybrid Transformer) & MDX-Net
- **Repository / Upstream**: `github.com/facebookresearch/demucs` (Meta AI Research)
- **License**: MIT License
- **Core Architecture Analyzed**:
  - HTDemucs (Hybrid Transformer Demucs) operates in both time domain (raw waveform) and frequency domain (complex STFT spectrogram).
  - Cross-domain self-attention mechanisms between spectrogram bins and convolutional waveform branches enable artifact-free source separation into Vocals, Drums, Bass, and Other.
  - MDX-Net architecture optimizes for low latency and ONNX runtime export for browser-based inference.
- **OmniFrame Takeaway**: OmniFrame's Voice Isolation architecture implements client-side Web Audio DSP with progressive enhancement hooks for ONNX WebAssembly execution, ensuring immediate zero-latency processing in standard browsers without server round-trips.

### 10. CapCut AI Vocal Remover & Dialogue Enhancer
- **Vendor / Upstream**: Bytedance CapCut Desktop
- **License**: Proprietary Commercial
- **Core Architecture Analyzed**:
  - Right-click context menu clip action: "Isolate Voice" with secondary flyout submenu exposing "Keep Vocal" (acapella) and "Remove Vocal" (karaoke/instrumental).
  - Automatically demuxes audio from video clips when required, creates dedicated audio tracks, and replaces or mutes non-isolated stems.
- **OmniFrame Takeaway**: OmniFrame adopts this exact interaction hierarchy: a single clean "Isolate Voice" item in the timeline context menu with a side-hover submenu offering "Remove Vocal" and "Keep Vocal", completely distinguished from simple "Separate Audio" (demuxing).

### 11. LumaCut Motion Tracking & Multi-Signal Patch Engine
- **Upstream / Reference**: LumaCut Optical Tracking Architecture
- **License**: Clean-room technical research analysis
- **Core Architecture Analyzed**:
  - Multi-signal optical flow combining 3x3 Sobel edge convolution tensors ($G_x$, $G_y$, gradient magnitude) with normalized cross-correlation (NCC) luminance matching.
  - Bidirectional consistency validation (forward-backward error check) detecting rapid occlusion and spatial boundary drift.
  - Dual tracking modes: Mask Tracking (tracking user-drawn shape contours through time) vs Main Tracking (rigid/affine transform estimation).
- **OmniFrame Takeaway**: Implemented native TypeScript clean-room `TrackingEngine` (`src/lib/trackingEngine.ts`) and interactive `TrackingPanel` supporting point, multipoint, and planar patterns with real-time transform estimation.

### 12. BiRefNet & MODNet Neural Matting Architecture
- **Upstream / Reference**: Zheng et al. (BiRefNet) & Ke et al. (MODNet)
- **License**: Clean-room architectural analysis
- **Core Architecture Analyzed**:
  - Bilateral reference networks with localized boundary supervision for high-resolution hair and edge detail.
  - Tripartite decomposition separating semantic human estimation from detailed boundary matting.
  - Hardware acceleration pipeline with graceful fallback: WebGPU -> WebAssembly SIMD -> WebGL2.
- **OmniFrame Takeaway**: Implemented `bgRemovalEngine.ts` and `BackgroundRemovalModal.tsx` providing multi-model selection (BiRefNet, MODNet, ISNet, SlimSAM), solid color / bokeh blur / transparent modes, and morphological edge choke and feathering.

### 13. Blender 3D Data-Block Texture Architecture
- **Upstream / Reference**: Blender 3D (Blender Foundation)
- **License**: GPLv2 / Architectural research analysis
- **Core Architecture Analyzed**:
  - Objects reference shared data-blocks with real-time user-count tracking.
  - "Make Unique" operator clones shared texture/material blocks into isolated standalone instances, preventing unintended cross-object mutation during texture painting.
- **OmniFrame Takeaway**: Implemented data-block user count tracking in `src/store.ts` (`TextureAsset.usersCount`) and added prominent "Make Unique" button in `ThreePanel.tsx`.

### 14. After Effects & Premiere Pro LinkSet & Parenting Models
- **Upstream / Reference**: Adobe Premiere Pro & After Effects
- **License**: Proprietary Commercial
- **Core Architecture Analyzed**:
  - Policy-based multi-element linking: clips grouped into LinkSets with independent toggles for motion, duration, deletion, and selection sync.
  - Directional DAG parenting hierarchies with cycle prevention and apparent world-transform preservation during reparenting.
- **OmniFrame Takeaway**: Implemented Universal LinkSets, `arrangeLinkedElements` time-alignment algorithm, and DAG cycle detection in `src/store.ts` and `LinkPanel.tsx`.

### 15. DaVinci Resolve & Final Cut Pro Compound Clip / Nested Sequence Architecture
- **Upstream / Reference**: Blackmagic DaVinci Resolve & Apple Final Cut Pro X
- **License**: Proprietary Commercial Architectural Research
- **Core Architecture Analyzed**:
  - Compound clips collapse multiple multi-track items into a single container clip on the parent timeline.
  - Child start positions are rebased relative to compound start (t=0).
  - Double-clicking opens the internal nested sequence with breadcrumb navigation.
  - "Decompose in Place" / "Uncompound Clip" dissolves the container and restores child clips to the outer timeline with original track positions and absolute timing.
  - Compound clip has its own container-level transforms (scale, 3D rotation, opacity) applied to all children in unison.
- **OmniFrame Takeaway**: Implemented first-class `Sequence` model, `sourceSequenceId`, rebased child timing, breadcrumbs navigation bar with Back button, target-aware context menu, and atomic undo/redo in `src/store.ts`, `Timeline.tsx`, `RightPanel.tsx`, and `playback.ts`.

### 16. Runway Gen-2, Adobe Photoshop Generative Fill & Meta SAM Temporal Video Inpainting
- **Upstream / Reference**: Runway Gen-2, Adobe Photoshop Generative Fill, Meta Segment Anything Model (SAM)
- **License**: Research & Industry Standards
- **Core Architecture Analyzed**:
  - When characters or foreground elements are displaced or erased in video editing, rendering a moved cutout directly over the raw original frame causes severe "double ghost" artifacts (the original character remains visible underneath).
  - Clean video manipulation mandates a two-pass compositing pipeline:
    1. Plate Inpainting: The background is reconstructed at the original character bounding box (or clean reference backdrop plate `clean_background.png` is composited) to erase the character's original presence.
    2. Dynamic Cutout Projection: The isolated foreground cutout is composited at its evaluated temporal position (`all`, `frame`, or `section` scope) with sub-pixel alignment and zero trace of the underlying silhouette.
  - Duplication workflows instantiate independent clone entities with decoupled transform states, allowing multiple identical characters to be animated concurrently without interfering with the inpainting layer.
- **OmniFrame Takeaway**: Integrated `clean_background.png` inpainting backdrop in `drawOmniframeCharacters` (`src/lib/playback.ts`), eliminated duplicate DOM overlay images, implemented `duplicateCharacter`, `removeCharacterInfill`, `deleteCharacter`, and `restoreCharacter` in `src/store.ts`, and built the 'Rearrange Clean' non-overlapping layout engine.

### 17. Krita Digital Painting Architecture, `KisTransparencyMask` & Desktop vs Web Porting
- **Upstream / Reference**: Krita (`invent.kde.org/graphics/krita`, `docs.krita.org`)
- **License**: GNU General Public License v3 (GPLv3) — Studied for clean-room engineering research in full compliance with the Code Research Policy.
- **Core Architecture Analyzed**:
  - **Node Tree Model (`KisNode`)**: Krita's image model is structured as a hierarchical node tree rooted at `KisImage::rootLayer()`. Layers (`KisLayer`) can host child masks (`KisMask`) that non-destructively modify the layer's projection without touching the original pixel device.
  - **Transparency Mask (`KisTransparencyMask`)**: A 1-channel / grayscale selection device attached as a child node to a paint layer.
    - Pixel semantics: Black ($0$) corresponds to complete transparency (hides pixels, letting lower layers show through); White ($255$) corresponds to complete opacity (reveals pixels); Grays represent continuous semi-transparency.
    - Applying an eraser on the mask restores original opacity by painting white ($255$).
    - Mask can be independently enabled/disabled (bypassed), inverted, or blended with variable opacity.
  - **Desktop High-Performance Engine**:
    - Tiled memory manager (`KisPaintDevice` using 64x64 pixel tiles with copy-on-write COW mementos for undo).
    - Multi-threaded asynchronous compositing pipeline (`KisAsyncMerger`).
    - GPU canvas rendering utilizing OpenGL/ANGLE and native hardware tablet drivers (Wintab, Windows Pointer, libinput, Apple Pencil) for high-frequency pressure, tilt, and barrel rotation.
  - **Web Porting Strategy for OmniFrame**:
    - **Local-First & Browser-Safe**: Avoid heavy C++ dependencies in web mode; utilize browser-native `PointerEvents` (`e.pressure`, `e.tiltX`, `e.tiltY`, `e.pointerType`), 2D Canvas / `OffscreenCanvas`, and WebGL2 shaders.
    - **Non-Destructive Mask Pipeline**: Compositing renders layer base strokes to an offscreen buffer, evaluates mask strokes on a white-initialized mask buffer, and multiplies perceptual luminance $(0.299R + 0.587G + 0.114B)$ into layer alpha before compositing into the master project stack.
    - **Desktop OmniFrame Profile**: Bridges deeper native settings, high-frequency tablet events, and multi-layer OpenRaster (ORA) / KRA exchange.
- **OmniFrame Takeaway**: Implemented `TransparencyMask` in `src/types.ts` and `src/store.ts`, added non-destructive luminance compositing in `src/lib/drawingEngine.ts`, created Krita-style indented mask child node UI in `DrawingPanel.tsx`, and added stylus pressure size dynamics and stabilizer leash smoothing.





