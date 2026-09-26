# Architectural Decisions for OmniFrame Timeline Rebuild

This document records the design and engineering decisions made after cross-referencing Premiere Pro, DaVinci Resolve, CapCut Desktop, Kdenlive, and open-source NLEs.

---

### Decision 1: Separation of Rendered State from Transient Drag State
- **Problem:** Updating `store.clips` and `store.tracks` on every mouse move caused continuous re-renders of all track lanes, audio waveform canvases, and triggered unbounded undo history entries.
- **Decision:** Introduce a lightweight `timelineDragState` in the local component or transient store slice. During mouse drag, render an overlaid SVG/DOM ghost block and glowing drop-line indicators. Commit to the global store and push an undo snapshot only when the pointer releases.

### Decision 2: Dynamic Track Insertion (Vertical Drag & Drop)
- **Problem:** In prototype editors, dragging a clip vertically only snaps to existing tracks. Dropping between tracks or above/below does nothing or locks up.
- **Decision:** Implement vertical hit-testing with 3 distinct target zones per track:
  - Top 20% of track or inter-track gap: `insert-above` / `insert-between`
  - Middle 60% of track: `dock-into-track`
  - Bottom 20% of track or below bottom track: `insert-below`
- When dropped into an insertion zone, the engine executes `createTrack()` at that exact relative position and reassigns the clip in a single atomic transaction.

### Decision 3: Transitions as Independent Timeline Objects
- **Problem:** Treating transitions as clip properties (`clip.hasTransition = true`) prevented setting custom durations, selecting transition types, dragging transition boundaries, or inspecting transition properties.
- **Decision:** Add a first-class `Transition` entity to `src/types.ts` and store array `transitions: Transition[]`. Render interactive transition badges directly on the cut point in the timeline with resize handles for duration trimming.

### Decision 4: Deterministic Visual Compositing Order
- **Problem:** Disorganized layering where DOM order or random z-index dictated which video clip was visible on top.
- **Decision:** Visual tracks follow standard NLE hierarchy: higher visual tracks composite on top of lower visual tracks ($V_2$ composites over $V_1$). Canvas rendering in `playback.ts` iterates tracks from bottom to top so that upper layers naturally composite over background layers.

### Decision 5: Adaptive Continuous Zoom & Frame-Accurate Ruler
- **Problem:** Quantizing zoom to discrete steps or rounded seconds produced unreadable rulers or prevented frame-level edits.
- **Decision:** Continuous zoom ranging from $10\text{ px/sec}$ (macro sequence view) to $8000\text{ px/sec}$ (frame-level precision). The ruler dynamically chooses major/minor tick intervals ($0.033\text{s}$ at 30fps = 1 frame, $0.1\text{s}$, $0.5\text{s}$, $1\text{s}$, $5\text{s}$, $10\text{s}$) to maintain optimal visual density.
