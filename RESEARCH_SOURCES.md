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


