# OmniFrame Predicted Failure Modes & Architectural Mitigations

This engineering ledger outlines 35 identified failure modes across temporal modeling, state machines, Web Audio DSP, WebGL, memory lifecycles, and responsive layouts, alongside their formal preventive mitigations and regression verifications.

---

## 1. Timeline & Temporal Interval Failures

### 1.1 Same-Track Overlap Collisions
- **Risk**: Inserting or moving a clip onto an occupied region on the same track results in visual overlapping or clip truncation.
- **Root Cause**: Naive placement logic assigning `clip.start` without evaluating downstream clip boundaries.
- **Mitigation**: Implemented `resolveSameTrackRipple(clips, trackId, movingClipId, requestedStart, duration)` enforcing Invariant I-01. Downstream clips are shifted right by the required delta in a single atomic transaction.
- **Verification**: `qa/master-rebuild-e2e.mjs` (Phase 4).

### 1.2 Floating-Point Sub-Frame Rounding Gaps
- **Risk**: Repeated splits or zoom recalculations introducing fractional millisecond gaps (e.g. `0.00000001s`), breaking playback continuity.
- **Mitigation**: Implemented temporal epsilon comparison (`Math.abs(t1 - t2) < 0.001`) and explicit frame quantization (`timeToFrame` / `frameToTime`).

### 1.3 Orphan Transitions Attached to Deleted Clips
- **Risk**: Deleting a clip leaves its attached transition object pointing to a non-existent UUID, causing renderer exceptions.
- **Mitigation**: `removeClip` automatically cascades to delete any transition where `fromClipId === id || toClipId === id`.
- **Verification**: `qa/timeline-rebuild-e2e.mjs`.

---

## 2. Pointer & Interaction State Failures

### 2.1 Click-to-Drag Micro-Displacements
- **Risk**: A user clicking a clip to select it or open its context menu accidentally moves it by a few sub-pixels.
- **Mitigation**: Strict 6px pointer displacement deadzone in `PENDING_CLICK` state. The drag state is entered only after the pointer crosses the threshold.

### 2.2 Internal Drag DataTransfer Contamination ("download.jpg" Bug)
- **Risk**: Dragging an internal clip or asset element causes Chromium to initiate a synthetic OS image download named `download.jpg`.
- **Mitigation**: Enforce custom domain MIME types (`application/x-omniframe-asset` and `application/x-omniframe-timeline-item`). Reject internal payloads at document file-drop boundaries.
- **Verification**: `qa/master-rebuild-e2e.mjs` & `qa/voice-isolation-e2e.mjs`.

### 2.3 3D Event Leakage into Timeline
- **Risk**: Dragging to orbit the Three.js camera leaks pointerdown events into timeline scrubbers or underlying tracks.
- **Mitigation**: Encapsulate Three.js pointer capture inside `ThreeCanvas.tsx` with explicit `stopPropagation()` on OrbitControls handlers.

---

## 3. Sequence Settings & Video Export

### 3.1 Timeline vs Export Aspect Ratio Mismatch
- **Risk**: Setting a 9:16 portrait ratio in preview exports as 16:9 landscape with severe pillarboxing or stretching.
- **Mitigation**: Centralized `SequenceSettings` in Zustand store controlling both canvas backing dimensions and the export recorder pipeline (`targetW`, `targetH`).
- **Verification**: Headless OpenCV video decoding verifying exact 1080x1920 portrait dimensions (`qa/master-rebuild-e2e.mjs`).

### 3.2 Absurd Custom Ratio Dimensions
- **Risk**: Users entering zero, negative, NaN, or 100,000px dimensions crashing canvas memory.
- **Mitigation**: Clamp custom dimensions to valid ranges ($128 \le w \le 4096$, $128 \le h \le 4096$) with numeric parsing regex and ratio-lock constraints.

---

## 4. Audio Subsystem & Voice Isolation

### 4.1 Voice Isolation Mono Cancellation
- **Risk**: Inverting and subtracting channels on a mono track ($L - R = 0$) results in absolute silence.
- **Mitigation**: `isolateVoiceFromAudioBuffer` checks channel correlation. If mono or near-mono, it applies spectral formant filtering rather than pure phase cancellation.

### 4.2 Web Audio Memory Exhaustion
- **Risk**: Decoding multi-hour audio files into memory exceeding browser 2GB ArrayBuffer limits.
- **Mitigation**: Restrict source preview decodes to active project media and close `AudioContext` immediately upon WAV export completion.

---

## 5. Responsive UI & Layout Boundary Failures

### 5.1 Mobile Viewport Context Menu Clipping
- **Risk**: Right-clicking or long-pressing near screen edges causes menus to overflow the viewport.
- **Mitigation**: Dynamic coordinate clamping against `window.innerWidth - width - margin` and `window.innerHeight - height - margin`.
- **Verification**: `qa/context-menu-e2e.mjs` (mobile 390x844 test).

### 5.2 Accidental Auto-Opening of Inspector
- **Risk**: Selecting a clip or right-clicking auto-expands the RightPanel, causing unwanted canvas reflow.
- **Mitigation**: Decouple selection and context menus from inspector drawer visibility.
