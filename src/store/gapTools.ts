/**
 * Universal gap tools, extracted from the monolithic store.
 *
 * Everything here is about the empty spans BETWEEN clips on a track, and
 * about which tracks a "universal" tool should touch. It is deliberately
 * separated from the ~3.6k-line store so the rules can be read and tested in
 * one place.
 *
 * Two rules are load-bearing and were settled with the user:
 *
 *  1. The space BEFORE the first clip is not a gap. Closing gaps preserves
 *     where a track starts, so a deliberately placed leading offset stays
 *     exactly where the user put it.
 *
 *  2. No target means apply to ALL tracks. Targeting is opt-in per track, and
 *     an empty target list must not silently do nothing.
 */

import type { Clip, Track } from '../types'

/** How widely a gap/track tool should apply. */
export type GapScope = 'track' | 'all' | 'targeted'

export interface TimelineGap {
  trackId: string
  /** Index of the clip BEFORE the gap, in that track's left-to-right order. */
  index: number
  start: number
  end: number
  duration: number
}

/**
 * Empty spans BETWEEN consecutive clips on one track. The leading space is
 * excluded by construction: we only ever look at the seam between clip i and
 * clip i+1.
 */
export function gapsOnTrack(clips: Clip[], trackId: string): TimelineGap[] {
  const own = clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start)
  const out: TimelineGap[] = []
  for (let i = 0; i < own.length - 1; i++) {
    const gapStart = own[i].start + own[i].duration
    const gapEnd = own[i + 1].start
    if (gapEnd - gapStart > 0.001) {
      out.push({ trackId, index: i, start: gapStart, end: gapEnd, duration: gapEnd - gapStart })
    }
  }
  return out
}

/** Which tracks a universal tool should touch. Empty targeting means "all". */
export function resolveTargetTracks(
  s: { tracks: Track[]; targetedTrackIds: string[] },
  scope: GapScope,
  trackId?: string,
): string[] {
  if (scope === 'track') return trackId ? [trackId] : []
  if (scope === 'targeted' && s.targetedTrackIds.length > 0) return s.targetedTrackIds
  return s.tracks.map((t) => t.id)
}

/**
 * Collapse each affected track so its clips butt end-to-end, anchored on the
 * FIRST clip's existing start (rule 1). Pure: returns the moved clips, or
 * null when there is nothing to do, so the caller can skip pushing an undo
 * snapshot for a no-op.
 */
export function packTracks(clips: Clip[], trackIds: string[]): Clip[] | null {
  const moves = new Map<string, number>()
  for (const tid of trackIds) {
    const own = clips.filter((c) => c.trackId === tid).sort((a, b) => a.start - b.start)
    if (own.length < 2) continue
    let cursor = own[0].start
    for (const c of own) {
      if (Math.abs(c.start - cursor) > 0.0001) moves.set(c.id, cursor)
      cursor += c.duration
    }
  }
  if (moves.size === 0) return null
  return clips.map((c) => (moves.has(c.id) ? { ...c, start: moves.get(c.id)! } : c))
}

/** Shift everything after one specific gap leftwards by that gap's duration. */
export function collapseGapAt(clips: Clip[], trackId: string, gap: TimelineGap): Clip[] {
  return clips.map((c) =>
    c.trackId === trackId && c.start >= gap.end - 0.0001
      ? { ...c, start: Math.max(0, c.start - gap.duration) }
      : c,
  )
}

export interface GapToolsSlice {
  targetedTrackIds: string[]
  gapSelectMode: boolean
  toggleTrackTarget: (trackId: string) => void
  targetTrackOnly: (trackId: string) => void
  setTrackTargets: (ids: string[]) => void
  removeGaps: (scope?: GapScope, trackId?: string) => number
  removeGapAt: (trackId: string, gapIndex: number) => void
  setGapSelectMode: (on: boolean) => void
  selectAllClipsInScope: (scope?: GapScope, trackId?: string) => void
}

/** Dependencies the slice needs from the surrounding store. */
export interface GapToolsDeps {
  pushSnapshot: () => void
  recompute: (clips: Clip[]) => number
}

type SetState = (partial: (s: any) => any) => void

export function createGapToolsSlice(
  set: SetState,
  get: () => any,
  deps: GapToolsDeps,
): GapToolsSlice {
  return {
    targetedTrackIds: [],
    gapSelectMode: false,

    toggleTrackTarget: (trackId) =>
      set((s: any) => ({
        targetedTrackIds: s.targetedTrackIds.includes(trackId)
          ? s.targetedTrackIds.filter((id: string) => id !== trackId)
          : [...s.targetedTrackIds, trackId],
      })),

    targetTrackOnly: (trackId) => set(() => ({ targetedTrackIds: [trackId] })),

    setTrackTargets: (ids) => set(() => ({ targetedTrackIds: ids })),

    removeGaps: (scope = 'all', trackId) => {
      const s0 = get()
      const ids = resolveTargetTracks(s0, scope, trackId)
      const gaps = ids.flatMap((id) => gapsOnTrack(s0.clips, id))
      // Nothing to close: bail BEFORE pushing a snapshot, so the undo stack
      // never collects a step that did nothing.
      if (gaps.length === 0) return 0

      deps.pushSnapshot()
      set((s: any) => {
        const clips = packTracks(s.clips, ids)
        if (!clips) return {}
        return { clips, duration: deps.recompute(clips) }
      })
      return gaps.length
    },

    removeGapAt: (trackId, gapIndex) => {
      const s0 = get()
      const gap = gapsOnTrack(s0.clips, trackId).find((g) => g.index === gapIndex)
      if (!gap) return
      deps.pushSnapshot()
      set((s: any) => {
        const clips = collapseGapAt(s.clips, trackId, gap)
        return { clips, duration: deps.recompute(clips) }
      })
    },

    setGapSelectMode: (on) => set(() => ({ gapSelectMode: on })),

    selectAllClipsInScope: (scope = 'all', trackId) => {
      const s0 = get()
      const ids = new Set(resolveTargetTracks(s0, scope, trackId))
      const inScope = s0.clips.filter((c: Clip) => ids.has(c.trackId)).map((c: Clip) => c.id)
      set(() => ({ selectedClipIds: inScope, selectedClipId: inScope[0] ?? null }))
    },
  }
}
