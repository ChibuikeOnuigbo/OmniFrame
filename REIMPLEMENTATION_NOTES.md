# OmniFrame Clean-Room Reimplementation Notes (`REIMPLEMENTATION_NOTES.md`)

## Overview
This document records technical architecture formulations developed by analyzing industry standards and open-source video editors, translating theoretical principles into OmniFrame's modern TypeScript and React canvas architecture.

---

### 1. Invariant Temporal Interval Model vs Coordinate Pixels
- **Industry Reference**: MLT Framework (`GenTime`), Kdenlive `TimelineItemModel`.
- **Observed Problem**: Storing clip position as DOM pixel coordinates (`left: 240px`) or integer pixel offsets causes rounding drift during continuous zooming, leading to unintended gaps or overlaps between adjacent clips.
- **Clean-Room TypeScript Implementation**:
  - Clips store invariant rational time values: `start: number` (in seconds), `duration: number` (in seconds).
  - Track assignments are explicit string IDs (`trackId: string`).
  - View layout is purely a derived projection:
    $$\text{leftPx} = \text{clip.start} \times \text{pixelsPerSecond}$$
    $$\text{widthPx} = \text{clip.duration} \times \text{pixelsPerSecond}$$
  - Zoom operates by scaling `pixelsPerSecond` continuously while keeping model timestamps unchanged.

---

### 2. Multi-Track Compositing & Dynamic Track Creation
- **Industry Reference**: CapCut Desktop & Kdenlive multi-track compositing.
- **Observed Problem**: Rigid hardcoded tracks limit creative multi-layer editing, picture-in-picture, and adjustment layers.
- **Clean-Room TypeScript Implementation**:
  - `Track` entity:
    ```typescript
    export interface Track {
      id: string
      name: string
      kind: 'video' | 'audio'
      visible: boolean
      locked: boolean
      muted?: boolean
      volume?: number
    }
    ```
  - Tracks can be dynamically inserted above or below any existing track via store actions `addTrackAbove(targetTrackId, kind)` and `addTrackBelow(targetTrackId, kind)`.
  - Preview canvas renders tracks bottom-to-top according to their index in `tracks`, ensuring overlay clips composite seamlessly over background clips.

---

### 3. First-Class Discrete Transition Objects
- **Industry Reference**: Adobe Premiere Pro transition handles & Kdenlive Mixes.
- **Observed Problem**: Applying transitions as simple CSS animations on individual clips prevents cross-clip media blending, duration dragging, and export frame interpolation.
- **Clean-Room TypeScript Implementation**:
  - Transition data structure:
    ```typescript
    export interface Transition {
      id: string
      type: 'cross_dissolve' | 'dip_to_black' | 'dip_to_white' | 'wipe_left' | 'wipe_right' | 'slide_left' | 'slide_right' | 'zoom'
      fromClipId: string
      toClipId: string
      trackId: string
      startTime: number
      duration: number
      alignment: 'centered' | 'start_on_cut' | 'end_on_cut'
      enabled: boolean
    }
    ```
  - Rendered as an interactive amber striped block (`repeating-linear-gradient`) centered over the cut point.
  - Trim handles on left and right allow dragging transition duration in real-time.
  - Context menu allows instant switching of transition algorithms (Cross Dissolve, Dip to Black, Dip to White, Wipe, Slide, Zoom).
  - Video export engine computes the normalized transition progress $t \in [0, 1]$ and renders mathematical blends between incoming and outgoing video frames.

---

### 4. Adaptive Ruler Subdivisions
- **Industry Reference**: OpenShot & Blender VSE time rulers.
- **Clean-Room Implementation**:
  - Dynamic step calculation based on `pixelsPerSecond`:
    - $\ge 60$ px/s: 1-frame tick subdivisions with frame counter labels.
    - $\ge 20$ px/s: 0.5-second subdivisions.
    - $\ge 8$ px/s: 1-second subdivisions.
    - $< 8$ px/s: 5-second to 60-second subdivisions.
  - Renders crisp SVG/HTML tick marks with accurate timecode formatting (`HH:MM:SS:FF`).
