# OmniFrame Professional Timeline Data Model

This document defines the mathematical and data architecture governing clips, tracks, transitions, ghost dragging, and compositing within OmniFrame.

---

## 1. Core Principles & Coordinate Space Separation

1. **Temporal Coordinates are Authoritative:**
   - A clip is defined solely by its time interval:
     $$\text{Interval} = [\text{start}, \text{start} + \text{duration})$$
   - Coordinates are stored in continuous rational seconds (or integer frames mapped via project FPS).
   - Screen pixel positions ($\text{px}$) are **strictly derived projections**:
     $$\text{leftPx} = \text{start} \times \text{pxPerSec}$$
     $$\text{widthPx} = \text{duration} \times \text{pxPerSec}$$
   - When timeline zoom changes, only $\text{pxPerSec}$ changes; clip temporal intervals are invariant.

2. **Tracks as Ordered Collections:**
   - Tracks have persistent immutable IDs (`track_abc123`).
   - Track visual order is determined by a separate ordered array of track IDs (`trackOrder: string[]`), preventing ID churn when tracks are created, inserted, or rearranged.
   - Deterministic Compositing Rule:
     - For video tracks: Tracks at higher visual indices composite *over* tracks at lower indices (standard NLE convention: V2 composites above V1).
     - Audio tracks composite additively via Web Audio mixer nodes regardless of visual vertical index.

3. **Transitions as First-Class Entity Objects:**
   - A transition is **never** a boolean flag on a clip.
   - It is a discrete entity with identity, endpoints, duration, and alignment:
     ```typescript
     export interface Transition {
       id: string
       type: TransitionType
       fromClipId: string
       toClipId: string
       trackId: string
       startTime: number
       duration: number
       alignment: 'centered' | 'start_at_cut' | 'end_at_cut'
       parameters: Record<string, any>
       enabled: boolean
     }
     ```

4. **Atomic Transactional Drag & Drop:**
   - Pointer drag does **not** mutate the core timeline state on every pointer movement.
   - An active drag maintains a transient `dragState`:
     - `ghostClip`: Visual clone preserving dimensions, duration, and styling.
     - `candidateTrackId`: Evaluated target track.
     - `candidateTime`: Snapped timeline time.
     - `candidateInsertTarget`: 'above' | 'below' | 'between' | null (indicates when pointer is over an inter-track gap).
   - Only upon `pointerup` (drop) is a single, atomic transaction committed into the editor store and undo/redo history.
   - Pressing `Escape` or pointer cancellation immediately aborts the drag with zero side effects.

---

## 2. Transition Mathematical Evaluation Model

For any playback time $t$ falling within the interval $[\text{startTime}, \text{startTime} + \text{duration})$:
1. Normalized transition progress:
   $$p(t) = \frac{t - \text{startTime}}{\text{duration}}, \quad p \in [0.0, 1.0]$$
2. Outgoing frame $F_A(t)$ and incoming frame $F_B(t)$ are rendered at their respective source in-points.
3. Transition Shader Compositor:
   - **Cross Dissolve:** $\text{Result} = F_A \times (1 - p) + F_B \times p$
   - **Dip to Black:**
     - For $p < 0.5$: $\text{Result} = F_A \times (1 - 2p)$
     - For $p \ge 0.5$: $\text{Result} = F_B \times (2p - 1)$
   - **Wipe Left:** Horizontal boundary $X = W \times (1 - p)$. Left side renders $F_A$, right side renders $F_B$.
   - **Slide Left:** $F_A$ translated by $-p \times W$, $F_B$ translated by $(1 - p) \times W$.
   - **Zoom:** Scale expansion on $F_A$ from $1.0 \to 1.5$ with crossfade to $F_B$.
