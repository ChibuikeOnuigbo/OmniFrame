# OmniFrame Empty Track Cleanup & Resource Disposal Specification

## 1. Architectural Definition of Track Lifecycle
In professional NLEs, tracks represent ordered compositing layers (for video/graphics) and mixing channels (for audio). As users split, delete, or rearrange clips, empty user-created tracks can proliferate, wasting vertical timeline space.

OmniFrame defines formal policies for track creation, empty track detection, safe automatic cleanup, and underlying resource disposal.

---

## 2. Invariant Rules for Track Preservation & Deletion

### Rule 1: Mandatory Base Track Preservation
Tracks designated as base sequence infrastructure must never be deleted:
- **Base Video Track (`V1` / index 0)**: The primary storyline anchor.
- **Base Audio Track (`A1` / index 0)**: The primary audio mixing bus.
Even when all clips are deleted from V1 or A1, the base tracks remain present.

### Rule 2: Safe User-Created Track Cleanup
A user-created track (`V2`, `V3`, `A2`, etc.) is eligible for automatic or manual cleanup when:
1. It contains zero clip instances (`state.clips.filter(c => c.trackId === track.id).length === 0`).
2. It contains zero active transitions (`state.transitions.filter(t => t.trackId === track.id).length === 0`).
3. It is not currently locked (`!track.locked`).
4. It is not the target of an active, uncommitted drag-and-drop operation (`state.activeDragTrackId !== track.id`).

---

## 3. Resource Disposal Protocol
Removing a track from the timeline must cleanly dispose of all associated hardware and memory resources to prevent GPU/Audio memory leaks:

1. **Audio Node Disposal**:
   - Any Web Audio API gain nodes, pan nodes, or filter nodes associated with the track are disconnected:
     ```typescript
     trackGainNode.disconnect();
     trackPanNode.disconnect();
     ```
2. **WebGL & Canvas Texture Cleanup**:
   - Compositing canvas buffers and offscreen layers allocated for the track are cleared.
3. **Event Listener Cleanup**:
   - Pointer listeners, resize observers, and drop targets on the track DOM lane are unmounted.
4. **Stable Identity Maintenance**:
   - Deleting a track does NOT renumber the unique UUIDs (`trk_...`) of remaining tracks. Only the visual track ordering array (`trackOrder`) is updated.

---

## 4. Undo/Redo Atomicity
All track deletions and cleanups are committed as single atomic undoable transactions:
- When a track is deleted, a full immutable state snapshot is pushed to `past`.
- Invoking `undo` (`Ctrl+Z`) restores the exact track row, its original UUID, height, locked/muted status, and all clip associations.
