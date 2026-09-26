# OmniFrame Media Preview & Dual-Monitor Architecture

## 1. Architectural Philosophy & Dual-Monitor Paradigm
In professional Non-Linear Editors (such as Adobe Premiere Pro, DaVinci Resolve, and Kdenlive), media inspection is strictly separated from sequence composition. A fundamental design flaw of primitive web editors is conflating clicking a media item in the project bin with inserting it into the timeline. 

OmniFrame enforces **Invariant I-10**:
> **Invariant I-10**: Media ingestion and media bin clicks MUST load the asset into the isolated Source Monitor (`SOURCE_PREVIEW_STATE`) for non-destructive inspection. They MUST NOT mutate the timeline, displace the playhead, create clips, or modify sequence duration. Timeline insertion requires an explicit, deliberate user action (e.g. clicking "Add to Timeline", drag-and-drop, or keyboard insertion shortcut).

---

## 2. State Model Separation
The Zustand editor store (`src/store.ts`) strictly isolates the two playback and viewport subsystems:

```typescript
// 1. Isolated Source Monitor State (Asset Inspection)
export interface SourcePreviewState {
  assetId: string | null;     // Selected media asset in project bin
  currentTime: number;        // Local playback position within source asset (0..duration)
  playing: boolean;           // Local play/pause state of source monitor
  inPoint: number;            // Mark In boundary for subclip insertion
  outPoint: number;           // Mark Out boundary for subclip insertion
  volume: number;             // Source preview gain
  zoom: number;               // 2D Pan/Zoom level (1.0 = Fit)
  pan: { x: number; y: number };
}

// 2. Authoritative Program Monitor & Sequence State (Timeline Playback)
export interface TimelinePlaybackState {
  playhead: number;           // Global sequence playhead time in seconds
  playing: boolean;           // Sequence playback loop active
  duration: number;           // Calculated sequence boundary (recompute(clips))
  loop: boolean;              // Playback loop setting
  fps: number;                // Sequence frame rate timebase
  monitorMode: 'program' | 'source'; // Active viewport display
}
```

### Event Flow & Decoupling
```
+-------------------------------------------------------------+
|                       Media Library                         |
+-------------------------------------------------------------+
         |                                           |
         | Click Asset Item                          | Explicit Drag or
         v                                           | "Add to Timeline"
+---------------------------+                        v
|   SOURCE_PREVIEW_STATE    |            +-----------------------+
|  - Local currentTime      |            |  TIMELINE / SEQUENCE  |
|  - Independent Play/Pause |            |  - Global Playhead    |
|  - In/Out Marks           |            |  - Track Placement    |
|  - Source Aspect Ratio    |            |  - Ripple Enforcement |
+---------------------------+            +-----------------------+
         |                                           |
         v                                           v
+---------------------------+            +-----------------------+
|   Source Monitor View     |            |  Program Monitor View |
| (Canvas / Video / WebGL)  |            |  (Authoritative Seq)  |
+---------------------------+            +-----------------------+
```

---

## 3. Media-Specific Source Preview Engines

### 3.1 Video Source Preview (`HTMLVideoElement` + Canvas)
- **Controls**: Play, Pause, Scrubbing Bar, Frame Step Backward (`-1 / fps`), Frame Step Forward (`+1 / fps`), Jump to In/Out marks.
- **Timecode Display**: Exact SMPTE timecode format (`HH:MM:SS:FF`) reflecting the asset's native duration and frame rate.
- **Frame-Accurate Seeking**: Utilizes fast seek gating to avoid race conditions during continuous slider scrub.

### 3.2 Image Source Preview
- **Modes**: Fit to Viewport, 100% Native Resolution, 200% Zoom.
- **Checkerboard Background**: Displays alpha channel transparency for transparent PNG, WebP, and SVG assets.
- **Pan & Zoom**: Interactive mouse drag panning when zoomed in beyond viewport bounds.

### 3.3 Audio Source Preview & Voice Isolation
- **Waveform Rendering**: High-density 256-point RMS amplitude envelope extracted during ingest via Web Audio `decodeAudioData`.
- **Scrubbing & Transport**: Real-time Web Audio API / HTML5 Audio playback synchronized with cursor position.
- **Voice Isolation Subsystem**: Integrated Mid/Side crossover DSP engine allowing real-time auditioning of "Keep Vocal" (Speech isolation) vs "Remove Vocal" (Karaoke instrumental) before committing to timeline.

### 3.4 3D Model & Scene Preview (Three.js WebGL Engine)
- **Viewport Controls**: Orbit (Left-click drag), Pan (Right-click drag), Dolly/Zoom (Wheel scroll).
- **Navigation Gizmo**: Interactive 3D XYZ axis orientation cube in top-right corner.
- **Display Modes**: Shaded PBR lighting, Wireframe mesh overlay, Grid plane ground projection.
- **Camera Presets**: Front, Top, Right, Perspective, and Camera Reset (`[0, 2, 5]`, target `[0, 0, 0]`).

---

## 4. Timeline Insertion Workflows
Assets from the Media Library can only enter the sequence through verified, non-accidental pathways:
1. **"Add to Timeline" Button (`[data-testid="add-to-timeline-btn"]`)**: Inserts the asset onto the primary compatible track (V1 for visual assets, A1 for audio assets) using non-overlapping ripple placement (Invariant I-01).
2. **Drag and Drop from Media Bin (`application/x-omniframe-asset`)**:
   - Evaluates vertical drop coordinate to identify target track row or dynamic track insertion zone.
   - Calculates horizontal drop coordinate converted to exact timeline seconds via `pixelsToTime()`.
   - Executes ripple push or explicit overwrite based on active editor insertion mode.
3. **Context Menu "Insert at Playhead"**: Places the clip aligned with the global playhead time on the active track.

---

## 5. Verification Matrix
| Requirement | Implementation Component | Test Suite Verification |
|---|---|---|
| Ingest does not insert to timeline | `src/store.ts` (`importFiles`) | `qa/master-rebuild-e2e.mjs` (Phase 3) |
| Bin click updates Source Monitor only | `src/components/MediaPanel.tsx` | `qa/media-library-e2e.mjs` |
| Video transport & frame stepping | `src/components/SourceMonitor.tsx` | `qa/master-rebuild-e2e.mjs` |
| Audio waveform extraction (256 bins) | `src/lib/voiceIsolation.ts` | `qa/voice-isolation-e2e.mjs` |
| 3D scene orbit & camera reset | `src/components/ThreeCanvas.tsx` | `qa/master-rebuild-e2e.mjs` |
