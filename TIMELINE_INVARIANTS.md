# OmniFrame Timeline Invariants & State Machine Specification
**Standard Document:** OF-SPEC-2026-TL-01  
**Author:** OmniFrame Core Architecture Team  
**Date:** 2026-09-25

---

## 1. Formal Mathematical Foundations

A timeline $\mathcal{T}$ is a tuple:
$$\mathcal{T} = (\text{Tracks}, \text{Clips}, \text{Transitions}, \text{SequenceSettings}, \tau)$$
where:
- $\text{Tracks} = \{T_1, T_2, \dots, T_m\}$, each track $T_k = (\text{id}, \text{type} \in \{\text{video}, \text{audio}\}, \text{height}, \text{locked}, \text{gapless})$.
- $\text{Clips} = \{C_1, C_2, \dots, C_n\}$, each clip $C_i = (\text{id}, T(C_i), s_i, d_i, p_i, \text{kind}, \mathbf{X}_i)$.
  - $s_i \in \mathbb{R}_{\ge 0}$ is the timeline start time (seconds).
  - $d_i \in \mathbb{R}_{> 0}$ is the timeline duration ($d_i \ge \epsilon = 0.05\,\text{s}$).
  - $p_i \in \mathbb{R}_{\ge 0}$ is the media source in-point offset.
  - Interval $I(C_i) = [s_i, s_i + d_i)$.
- $\tau \in \mathbb{R}_{\ge 0}$ is the project playhead cursor.

---

## 2. Canonical Timeline Invariants

### Invariant I-01: Same-Track Non-Overlap (Ordinary Collision Prohibition)
For any two distinct clips $C_a, C_b \in \text{Clips}$ residing on the same track ($T(C_a) = T(C_b)$):
$$\operatorname{Interior}(I(C_a)) \cap \operatorname{Interior}(I(C_b)) = \emptyset$$
Equivalently:
$$s_a + d_a \le s_b \quad \lor \quad s_b + d_b \le s_a$$

### Invariant I-02: Ripple Push Resolution (Insert Mode)
When a clip $C^*$ of duration $d^*$ is inserted or moved to track $T^*$ at target time $s^*$:
1. The incoming interval is $I^* = [s^*, s^* + d^*)$.
2. Any existing clip $C_j$ on $T^*$ whose interval overlaps $I^*$ ($s_j < s^* + d^* \land s_j + d_j > s^*$) or lies downstream ($s_j \ge s^*$) is shifted rightwards by:
   $$\Delta s_j = \max(0, (s^* + d^*) - s_j)$$
3. Downstream cascading: If moving $C_j$ causes a collision with subsequent clips, the shift cascades inductively such that for all subsequent clips $C_k$ on $T^*$:
   $$s_k \ge s_{k-1} + d_{k-1}$$

### Invariant I-03: Boundary Adjacency of First-Class Transitions
A transition $\operatorname{Tr}_{ab}$ between clips $C_a$ and $C_b$ on track $T$ requires:
$$T(C_a) = T(C_b) = T(\operatorname{Tr}_{ab})$$
$$| (s_a + d_a) - s_b | < \delta \quad (\delta \le 0.05\,\text{s})$$
$$\operatorname{start}(\operatorname{Tr}_{ab}) = (s_a + d_a) - \frac{d_{\operatorname{Tr}}}{2}, \quad \text{for centered alignment}$$

### Invariant I-04: Non-Negative Timeline Bounds
$$\forall C_i \in \text{Clips}: s_i \ge 0$$
$$\forall \operatorname{Tr} \in \text{Transitions}: \operatorname{startTime}(\operatorname{Tr}) \ge 0$$
$$\tau \ge 0$$

### Invariant I-05: Gapless Magnetic Ripple
When a track has `gapless: true`, removing a clip $C_r$ shifts all downstream clips on that track leftwards by exactly $d_r$:
$$\forall C_k \text{ with } T(C_k) = T(C_r) \land s_k \ge s_r + d_r: \quad s_k' = s_k - d_r$$

### Invariant I-06: Explicit "Close Gaps" Determinism
Invoking `closeTrackGaps(T_k)` on track $T_k$ sorts all clips on $T_k$ by start time:
$$s_{(1)} \le s_{(2)} \le \dots \le s_{(p)}$$
and transforms their start times sequentially:
$$s_{(1)}' = 0$$
$$s_{(m)}' = s_{(m-1)}' + d_{(m-1)} \quad \text{for } m = 2, \dots, p$$
Zero empty time gaps remain between adjacent clips on $T_k$.

### Invariant I-07: Safe Ephemeral Track Cleanup
Any user-created track $T_u \notin \{V_1, A_1\}$ that becomes empty (0 clips and 0 transitions) upon clip deletion or clip relocation to another track is automatically pruned from the track list, preventing phantom empty tracks.

### Invariant I-08: Target-Aware Context Menu Exclusivity
Context menu activation routes through a centralized resolver:
1. `TRANSITION`: Clicked directly within transition bounding box.
2. `CLIP`: Clicked directly within clip bounding box.
3. `EMPTY_TRACK`: Clicked in empty lane space of a track. Generic transition commands are strictly forbidden in this state.
4. `CANVAS`: Clicked within preview monitor viewport.
5. `MEDIA_PANEL`: Clicked within media library assets rail.

### Invariant I-09: Drag & Drop Domain Typing (Download Bug Immunity)
All internal drag operations (clips, library assets) must use proprietary MIME types:
- `application/x-omniframe-timeline-item`
- `application/x-omniframe-asset`
Generic browser file drop listeners ignore these MIME types. Browser default action (`dragover`/`drop`) is intercepted with `e.preventDefault()`, eliminating the `download.jpg` phantom file artifact.

### Invariant I-10: Media Import & Source Preview Isolation
Importing or uploading media files registers assets into the project Media Library ONLY. Zero automatic insertions to the timeline are permitted upon ingest. The asset is loaded into the isolated `SourceMonitor` state for non-destructive inspection, in/out trimming, and deliberate timeline placement.

### Invariant I-11: Authoritative Sequence Dimensions
The project sequence settings $(\text{width}, \text{height}, \text{fps}, \text{aspectRatio})$ govern:
1. The Preview compositor canvas dimensions.
2. Layer transform normalized coordinates.
3. The offline export recording pipeline (`targetW`, `targetH`).
Changing the sequence aspect ratio immediately reframes the canvas and enforces exact pixel dimensions during final video rendering.

### Invariant I-12: Threshold-Based Pointer Interaction State Machine
Pointer interaction on timeline clips follows a strict 3-state transition:
$$\text{HOVER} \xrightarrow{\text{pointerdown}} \text{PENDING\_CLICK} \xrightarrow{\|\Delta \mathbf{x}\| > 5\text{px}} \text{DRAGGING}$$
$$\text{PENDING\_CLICK} \xrightarrow{\text{pointerup}} \text{SELECTED}$$
If the pointer is released before moving beyond the 5px threshold, the clip is selected without mutating timeline time, eliminating accidental micro-shifts.

---

## 3. Algorithm: Ripple Push Collision Resolution

```typescript
export function resolveSameTrackRipple(
  clips: Clip[],
  movingClipId: string | null,
  targetTrackId: string,
  targetStart: number,
  duration: number,
  mode: 'insert' | 'overwrite' = 'insert'
): Clip[] {
  if (mode === 'overwrite') return clips

  const targetEnd = targetStart + duration
  const trackClips = clips
    .filter((c) => c.trackId === targetTrackId && c.id !== movingClipId)
    .sort((a, b) => a.start - b.start)

  let cursor = targetEnd
  const shifts = new Map<string, number>()

  for (const c of trackClips) {
    const cEnd = c.start + c.duration
    // Check overlap or placement after targetStart
    if (c.start < targetEnd && cEnd > targetStart) {
      shifts.set(c.id, cursor)
      cursor += c.duration
    } else if (c.start >= targetStart && c.start < cursor) {
      shifts.set(c.id, cursor)
      cursor += c.duration
    }
  }

  return clips.map((c) =>
    shifts.has(c.id) ? { ...c, start: shifts.get(c.id)! } : c
  )
}
```
