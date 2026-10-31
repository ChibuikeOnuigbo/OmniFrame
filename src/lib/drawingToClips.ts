import type { DrawingStroke } from '../types'

/**
 * Drawing -> Clips conversion planner (pure model, no DOM / no store).
 *
 * The rules encoded here are deliberately strict (see qa fuzz suite):
 *  1. A generated clip covers exactly the frames its strokes cover — a
 *     drawing made on frames 1-15 and 123-126 becomes two clips, never one
 *     clip spanning the gap.
 *  2. Conversion changes placement only. Stroke payloads (tool, colour,
 *     size, opacity, points, scopes, paint-layer blend/opacity) are carried
 *     by reference; nothing is re-derived or "combined into effects".
 *  3. Only strokes stamped `layered` at draw time carry anchors. The
 *     planner never guesses anchors for unstamped strokes.
 *  4. Generated clips naturally share one track. The only exception is a
 *     real ordering conflict: two time-overlapping segments anchored to
 *     different layer strata (e.g. one drawn on a lower clip, one on the
 *     clip above it) — those are split onto stacked tracks so each drawing
 *     stays directly above the clip it was drawn on.
 */

export interface DrawingSegmentPlan {
  key: string
  layerId: string
  strokeIds: string[]
  startFrame: number
  endFrame: number // exclusive
  start: number // seconds
  duration: number // seconds
  anchorClipIds: string[]
  /** Bottom->top render stratum of the anchor stack; Infinity = unanchored (top). */
  stratum: number
  trackKey: string
}

export interface DrawingTrackPlan {
  key: string
  stratum: number
  slot: number
  /** Insert the new track directly above this track id; null = top of stack. */
  insertAboveTrackId: string | null
}

export interface DrawingConversionPlan {
  tracks: DrawingTrackPlan[]
  clips: DrawingSegmentPlan[]
  convertedStrokeIds: string[]
  skippedStrokeIds: string[]
}

/** Frame interval [start, end) a stroke covers, or null when it covers none. */
export function strokeFrameInterval(
  stroke: DrawingStroke,
  fps: number,
  projectEndFrame: number,
): [number, number] | null {
  const scope = stroke.temporalScope
  if (!scope || scope.type === 'global') {
    return projectEndFrame > 0 ? [0, projectEndFrame] : null
  }
  if (scope.type === 'span') {
    const start = Math.max(0, Math.floor((scope.startTime ?? 0) * fps))
    const end = Math.ceil(((scope.startTime ?? 0) + (scope.duration ?? 0)) * fps)
    return end > start ? [start, end] : null
  }
  // frame scope
  const start = Math.max(0, Math.floor(scope.frame ?? 0))
  const end = start + Math.max(1, Math.floor(scope.holdFrames ?? 1))
  return [start, end]
}

interface RawSegment {
  layerId: string
  anchorClipIds: string[]
  stratum: number
  startFrame: number
  endFrame: number
  strokeIds: string[]
}

export function planDrawingToClips(input: {
  strokes: DrawingStroke[]
  clips: { id: string; trackId: string }[]
  /** Track ids ordered TOP -> BOTTOM, as stored (index 0 is the top track). */
  trackIdsTopToBottom: string[]
  fps: number
  projectDuration: number // seconds
}): DrawingConversionPlan {
  const fps = Math.max(1, input.fps || 30)
  const projectEndFrame = Math.max(0, Math.round(input.projectDuration * fps))
  const trackCount = input.trackIdsTopToBottom.length
  const topness = new Map(input.trackIdsTopToBottom.map((id, i) => [id, trackCount - i]))
  const clipTrack = new Map(input.clips.map((c) => [c.id, c.trackId]))

  const skippedStrokeIds: string[] = []
  const bySignature = new Map<string, RawSegment[]>()

  for (const stroke of input.strokes) {
    if (stroke.convertedClipId) {
      skippedStrokeIds.push(stroke.id)
      continue
    }
    const interval = strokeFrameInterval(stroke, fps, projectEndFrame)
    if (!interval) {
      skippedStrokeIds.push(stroke.id)
      continue
    }
    const anchorClipIds = stroke.layered ? [...(stroke.anchorClipIds || [])].sort() : []
    let stratum = Number.POSITIVE_INFINITY
    if (anchorClipIds.length > 0) {
      stratum = Math.max(
        ...anchorClipIds.map((id) => topness.get(clipTrack.get(id) || '') ?? 0),
      )
    }
    const signature = `${stroke.layerId}|${anchorClipIds.join(',')}`
    const seg: RawSegment = {
      layerId: stroke.layerId,
      anchorClipIds,
      stratum,
      startFrame: interval[0],
      endFrame: interval[1],
      strokeIds: [stroke.id],
    }
    const list = bySignature.get(signature) || []
    list.push(seg)
    bySignature.set(signature, list)
  }

  // Merge contiguous / overlapping coverage per signature: frames 1-15 and
  // 123-126 stay two segments; touching runs become one.
  const merged: RawSegment[] = []
  for (const list of bySignature.values()) {
    const sorted = [...list].sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame)
    let cur: RawSegment | null = null
    for (const seg of sorted) {
      if (cur && seg.startFrame <= cur.endFrame) {
        cur.endFrame = Math.max(cur.endFrame, seg.endFrame)
        cur.strokeIds.push(...seg.strokeIds)
      } else {
        cur = { ...seg, strokeIds: [...seg.strokeIds] }
        merged.push(cur)
      }
    }
  }

  // Track assignment: natural case = one track per stratum. Interval
  // colouring adds a stacked slot only when same-stratum segments overlap
  // in time (e.g. two paint layers anchored to the same clip).
  const strata = [...new Set(merged.map((m) => m.stratum))].sort((a, b) => a - b)
  const tracks: DrawingTrackPlan[] = []
  const trackKeyFor = (stratum: number, slot: number) => `dt-${stratum === Infinity ? 'top' : stratum}-${slot}`
  for (const stratum of strata) {
    const segs = merged.filter((m) => m.stratum === stratum).sort((a, b) => a.startFrame - b.startFrame)
    const slotEnds: number[] = []
    for (const seg of segs) {
      let slot = slotEnds.findIndex((end) => seg.startFrame >= end)
      if (slot === -1) {
        slot = slotEnds.length
        slotEnds.push(seg.endFrame)
        const anchorTrackId =
          stratum === Number.POSITIVE_INFINITY
            ? null
            : seg.anchorClipIds
                .map((id) => clipTrack.get(id))
                .filter(Boolean)
                .sort((a, b) => (topness.get(b!) ?? 0) - (topness.get(a!) ?? 0))[0] || null
        tracks.push({ key: trackKeyFor(stratum, slot), stratum, slot, insertAboveTrackId: anchorTrackId })
      } else {
        slotEnds[slot] = seg.endFrame
      }
      ;(seg as RawSegment & { trackKey?: string }).trackKey = trackKeyFor(stratum, slot)
    }
  }
  tracks.sort((a, b) => a.stratum - b.stratum || a.slot - b.slot)

  const clips: DrawingSegmentPlan[] = merged
    .map((m, i) => ({
      key: `dc-${i + 1}`,
      layerId: m.layerId,
      strokeIds: [...m.strokeIds].sort(),
      startFrame: m.startFrame,
      endFrame: m.endFrame,
      start: m.startFrame / fps,
      duration: (m.endFrame - m.startFrame) / fps,
      anchorClipIds: [...m.anchorClipIds],
      stratum: m.stratum,
      trackKey: (m as RawSegment & { trackKey?: string }).trackKey || trackKeyFor(m.stratum, 0),
    }))
    .sort((a, b) => a.startFrame - b.startFrame || a.stratum - b.stratum)

  return {
    tracks,
    clips,
    convertedStrokeIds: clips.flatMap((c) => c.strokeIds),
    skippedStrokeIds,
  }
}
