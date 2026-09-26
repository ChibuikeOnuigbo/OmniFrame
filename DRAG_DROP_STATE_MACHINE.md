# OmniFrame Timeline Drag-and-Drop State Machine Specification

## 1. Overview & Root Architectural Principles
Timeline editing requires deterministic, frame-accurate pointer interactions. Primitive timeline implementations suffer from four major classes of interaction bugs:
1. **Click vs Drag Ambiguity**: Clicking a clip to select it accidentally triggers a sub-pixel displacement.
2. **DataTransfer Contamination ("download.jpg" bug)**: Internal HTML5 drag events leaking default image payloads into document-level file upload listeners, resulting in ghost media files appearing in the project bin.
3. **Same-Track Collision Overlap**: Dragging a clip on top of another clip overwrites or stacks them without shifting downstream content.
4. **DOM Coordinate Reliance**: Using CSS pixel coordinates as canonical time, leading to floating-point drift and timeline zoom distortions.

OmniFrame eliminates these issues through an explicit, formal state machine with strict drag deadzones, domain-typed payloads, and temporal interval projections.

---

## 2. Formal Interaction State Machine

```
              +-----------------------------------------+
              |                  IDLE                   |
              +-----------------------------------------+
                                   |
                  pointerdown      |
                                   v
              +-----------------------------------------+
              |              PENDING_CLICK              |
              |  - Record initial clientX, clientY      |
              |  - Record initial clip start & trackId  |
              |  - Arm 6px displacement deadzone        |
              +-----------------------------------------+
                    /                       \
   pointerup within deadzone           pointermove > 6px threshold
                  /                           \
                 v                             v
+-----------------------------+   +------------------------------------+
|         SELECT_CLIP         |   |              DRAGGING              |
|  - Commit clip selection    |   |  - Capture pointer via setPointer  |
|  - Transition to IDLE       |   |  - Render ghost clip & timing line |
+-----------------------------+   |  - Calculate target track & ripple |
                                  +------------------------------------+
                                       /                     \
                              Escape key or pointercancel    pointerup on valid drop
                                     /                         \
                                    v                           v
                      +---------------------------+   +-------------------------+
                      |         CANCELLED         |   |      COMMIT_MOVE        |
                      |  - Revert to initial time |   |  - Atomic store update  |
                      |  - Dismiss ghost overlays |   |  - Ripple downstream    |
                      |  - Transition to IDLE     |   |  - Transition to IDLE   |
                      +---------------------------+   +-------------------------+
```

### Complete State Enumeration
- `IDLE`: No pointer button depressed; hover outlines active.
- `POINTER_DOWN`: Pointer pressed down; initial event coordinates captured.
- `PENDING_CLICK`: Awaiting displacement threshold confirmation (6 CSS pixels).
- `DRAGGING`: Threshold exceeded; active horizontal/vertical clip translation with live drop guide.
- `TRIMMING`: Pointer engaged with left or right edge trim bracket; adjusting `inPoint` or `duration`.
- `RESIZING`: Adjusting first-class transition span handles.
- `SCRUBBING`: Direct dragging of timeline playhead ruler head.
- `PANNING`: Middle-mouse or Space+drag viewport canvas translation.
- `CAMERA_NAVIGATION`: 3D viewport OrbitControls active (left/right mouse drag).
- `CANCELLED`: User pressed `Escape` or pointer capture lost; state immediately rolled back.

---

## 3. The "download.jpg" Bug Root Cause & Permanent Fix

### Problem Analysis
In default HTML5 Drag and Drop API implementations, dragging an `<img>` tag or element containing background images causes Chromium/WebKit to initiate a synthetic OS file drag containing the image data named `download.jpg`, `download.png`, or `image.png`. When dropped anywhere on the window, document-level `onDrop` listeners receive a synthetic `FileList` containing `download.jpg` and pass it to `importFiles()`, corrupting the user's project library.

### Architectural Solution
OmniFrame enforces domain-specific MIME types and strict drop isolation:

1. **Domain-Typed Drag Payloads**:
   ```typescript
   // Internal Asset Drag from Media Library to Timeline
   event.dataTransfer.setData('application/x-omniframe-asset', asset.id);

   // Internal Timeline Clip Reordering
   event.dataTransfer.setData('application/x-omniframe-timeline-item', clip.id);
   ```

2. **Drop Target Guarding (`src/Studio.tsx` & `src/components/MediaPanel.tsx`)**:
   ```typescript
   const handleSafeDrop = (event: React.DragEvent) => {
     event.preventDefault();
     // Invariant: Internal timeline/asset drags must NEVER be treated as external files
     if (
       event.dataTransfer.types.includes('application/x-omniframe-asset') ||
       event.dataTransfer.types.includes('application/x-omniframe-timeline-item')
     ) {
       return; // Reject internal drag payloads at file upload boundaries
     }
     if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
       importFiles(event.dataTransfer.files);
     }
   };
   ```

---

## 4. Vertical Track Dragging & Dynamic Track Insertion
When dragging a clip vertically across the timeline, OmniFrame evaluates the vertical coordinate against track boundaries:

1. **Dock to Existing Track (`target.mode === 'dock'`)**:
   Pointer is within the vertical bounds of an existing compatible track. Highlights the track row and renders ghost clip at projected time.
2. **Insert Track Between Tracks (`target.mode === 'between'`)**:
   Pointer is hovering over the 8px divider zone between two tracks. Renders a glowing horizontal insertion guide line. Dropping triggers `createTrack(type, 'below', upperTrackId)` and places the clip on the newly created track with stable UUIDs.
3. **Insert Track Above Top (`target.mode === 'above_top'`)**:
   Pointer dragged above the uppermost track. Creates a new track at the top of the stack.
4. **Insert Track Below Bottom (`target.mode === 'below_bottom'`)**:
   Pointer dragged below the lowermost track. Creates a new track at the bottom of the stack.

---

## 5. Temporal Mapping Functions
DOM pixel measurements are strictly treated as view transformations, never as canonical sequence time:

$$\text{timeToPixels}(t) = t \cdot \text{pixelsPerSecond}$$
$$\text{pixelsToTime}(px) = \frac{px}{\text{pixelsPerSecond}}$$
$$\text{timeToFrame}(t, \text{fps}) = \operatorname{round}(t \cdot \text{fps})$$
$$\text{frameToTime}(\text{frame}, \text{fps}) = \frac{\text{frame}}{\text{fps}}$$

Quantization occurs exclusively at user-configured snap boundaries or export timebases.
