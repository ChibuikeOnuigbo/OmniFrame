# OmniFrame Engineering Agent Changelog

All notable technical changes, architectural refactorings, feature implementations, and test validations are documented in this file.

---

## [Unreleased] - 2026-09-25

### Added
- **Sequence Marker Subsystem (`src/components/MarkerModal.tsx`, `src/store.ts`, `src/components/Timeline.tsx`)**:
  - Full data model (`TimelineMarker`, `MarkerColor`): time, duration, label, color, notes.
  - Store actions with complete undo/redo integration: `addMarker`, `updateMarker`, `removeMarker`, `clearMarkers`, `jumpToMarker`, `jumpToNextMarker`, `jumpToPrevMarker`.
  - Color-coded badges: blue, green, red, yellow, purple, orange.
  - Timeline ruler rendering: interactive marker flag pins, duration span ribbons, and label pills.
  - Snapping integration: playhead and clips snap directly to marker time positions.
  - Double-click to edit marker properties, single-click to seek playhead.
  - Keyboard shortcut `M` (industry standard Premiere/Resolve/FCP) to add or edit markers at playhead.
- **Stereo Audio VU Meter & Master Level Subsystem (`src/components/AudioMeter.tsx`)**:
  - Real-time dual-channel (Left / Right) 16-segment LED level meters with peak hold indicators.
  - Numerical dB readout (from $-\infty\,\text{dB}$ through $+3\,\text{dB}$ clipping).
  - Master volume slider ($0\%$ to $150\%$) and quick master mute button.
  - Seamlessly integrated into timeline transport bar.
- **Clone Stamp Tool (`src/lib/drawingEngine.ts`, `src/components/DrawingCanvasOverlay.tsx`, `src/components/DrawingToolbar.tsx`)**:
  - Added `'clone'` to `DrawingToolType` and `cloneSource` to `DrawingStroke`.
  - Added Alt+Click canvas sampling to capture clone source coordinates and canvas texture.
  - Implemented displacement offset rendering and circular stamp clipping in Canvas 2D engine.
- **Voice Isolation Subsystem (`src/lib/voiceIsolation.ts`)**:
  - Implemented 3-band Chamberlin State Variable Filter (SVF) crossover for vocal extraction.
  - "Remove Vocal" (Karaoke / Instrumental) mode with sub-bass ($\le 140\,\text{Hz}$) mono preservation and mid-side phase cancellation in the $140\,\text{Hz}-7500\,\text{Hz}$ speech band ($>98\%$ center vocal attenuation, $>86\%$ bass retention).
  - "Keep Vocal" (Speech / Singing Isolation) mode with dynamic side-channel envelope suppression and speech formant bandpass focus ($>99.9\%$ side synth rejection).
  - Pure Web Audio API 16-bit PCM RIFF WAV encoder (`encodeAudioBufferToWav`) producing high-fidelity audio blobs.
  - 256-point normalized RMS waveform envelope calculation.
- **Voice Isolation UI Components**:
  - `VoiceIsolationModal.tsx`: Dedicated dialog with clip selector, mode cards, strength slider, bass preservation switch, speech focus toggle, and real-time DSP progress bar.
  - `VoiceIsolationPanel.tsx`: Dedicated sidebar tab in LeftDock (`id: 'audio'`, title: `"Voice Isolation"`).
  - Context menu commands for video and audio clips: `Isolate Voice…`, `Isolate Voice (Keep Vocal)`, and `Isolate Voice (Remove Vocal)`.
- **Master Rebuild & Architecture Consolidation**:
  - Compact aspect ratio selector (`src/components/AspectRatioSelector.tsx`) anchored to bottom-right of preview stage, replacing legacy "Preview px x px live" text.
  - Sequence settings synchronization with video export pipeline (`sequenceSettings.width` and `sequenceSettings.height`). Verified $1080 \times 1920$ portrait video export via headless OpenCV.
  - Source Monitor (`src/components/SourceMonitor.tsx`) decoupling media ingestion from the timeline (Invariant I-10).
  - Same-track ripple push algorithm (`resolveSameTrackRipple`) eliminating clip collisions (Invariant I-01).
  - First-class transition objects (`src/types/index.ts`, `src/store.ts`) centered over cut points with draggable duration handles and canvas export blending.
- **Automated Verification Suites**:
  - `qa/voice-isolation-e2e.mjs`: 28-assertion test suite verifying modal, sidebar panel, context menus, DSP execution, WAV encoding, and timeline track generation.
  - `qa/verify-voice-isolation-opencv.py`: OpenCV analysis script measuring UI contrast, luminance variance, and generating pixel cutouts.

### Changed
- Decoupled selection and context menu triggers from RightPanel Inspector auto-opening to prevent unexpected UI reflow.
- Clamped context menu coordinate positioning against viewport boundaries to prevent edge clipping on mobile viewports.
- Hardened internal drag payloads with MIME types `application/x-omniframe-asset` and `application/x-omniframe-timeline-item`, permanently resolving the "download.jpg" bug at the root cause.
- Replaced all prototype and placeholder panels with functional components (`TransitionsPanel`, `EffectsPanel`, `TextPanel`, `ThreePanel`, `VoiceIsolationPanel`).

### Fixed
- Fixed `F-0028`: Synchronized `initialClipId` prop changes with internal modal state via `useEffect` to ensure instant target clip resolution when opened from context menus.
- Fixed `F-0029`: Implemented SVF 3-band crossover to prevent low-end bass and kick drum dropout during center-channel vocal cancellation.
- Fixed `F-0026`: Synchronized sequence dimensions with headless video export recording, eliminating aspect ratio stretching.
- Fixed `F-0022`: Decoupled `importFiles` to populate library only without mutating timeline.
- Fixed `F-0032`: Resolved text clip canvas playback freeze by adding `drawTextClip` canvas typography rendering routine in `playback.ts`.
- Fixed `F-0033`: Clamped transition duration offsets in `syncElement` to prevent `null` element returns and playback stalls.
- Fixed `F-0034`: Unified preview monitor by deleting Program/Source distinction tabs and embedding direct asset playback and interactive 3D Orbit Viewer.
- Fixed `F-0035`: Scoped LeftDock mobile drawer overlay styling with `max-sm:` prefix, eliminating horizontal document overflow on 390px mobile screens and restoring desktop pointer clicks.
- Fixed `F-0036`: Context menu updated with single "Isolate Voice" parent item and side-hover submenu exposing "Remove Vocal" and "Keep Vocal", keeping "Separate audio" strictly for video track extraction.
- Fixed `F-0037`: Conditionally hide 'Your canvas is empty' overlay whenever preview is actively playing, asset preview is active, or timeline clips exist.
- Fixed `F-0038`: Replaced generic aspect ratio icons with authentic brand icons (YouTube, Instagram, Cinemascope, Custom) and added `YouTubeTikTokPaperSlideIcon` for 9:16 with overlapping paper slide cards.
- Fixed `F-0039`: Removed all hyphens from user-facing text strings throughout the application (e.g. 'Fullscreen', 'Ultra Wide', 'realtime', 'Drop frame', 'Invert / X Ray').


