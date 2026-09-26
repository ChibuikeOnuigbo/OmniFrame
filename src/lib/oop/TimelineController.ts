/**
 * OmniFrame Object-Oriented Timeline Architecture
 * Encapsulates timeline editing operations, track height computation,
 * clip geometry, edge auto-scrolling, and track lifecycle management.
 */

import type { Clip, Track, MediaKind, TrackType } from '../../types'

export class ClipModel {
  readonly id: string
  readonly trackId: string
  readonly assetId: string
  readonly start: number
  readonly duration: number
  readonly inPoint: number
  readonly name: string
  readonly kind: MediaKind
  readonly volume: number
  readonly hidden: boolean

  constructor(clip: Clip) {
    this.id = clip.id
    this.trackId = clip.trackId
    this.assetId = clip.assetId
    this.start = clip.start
    this.duration = clip.duration
    this.inPoint = clip.inPoint
    this.name = clip.name
    this.kind = clip.kind
    this.volume = clip.volume ?? 1
    this.hidden = clip.hidden ?? false
  }

  get end(): number {
    return this.start + this.duration
  }

  get isText(): boolean {
    return this.kind === 'text' || this.name.toLowerCase().includes('title')
  }

  get isAudio(): boolean {
    return this.kind === 'audio'
  }

  get isVideo(): boolean {
    return this.kind === 'video'
  }

  containsTime(time: number): boolean {
    return time >= this.start && time < this.end
  }
}

export class TrackModel {
  readonly id: string
  readonly type: TrackType
  readonly name: string
  readonly muted: boolean
  readonly hidden: boolean
  readonly locked: boolean
  readonly baseHeight: number

  constructor(track: Track) {
    this.id = track.id
    this.type = track.type
    this.name = track.name
    this.muted = track.muted
    this.hidden = track.hidden
    this.locked = track.locked
    this.baseHeight = track.height || (track.type === 'video' ? 64 : 48)
  }

  /**
   * Computes CapCut-style responsive track height:
   * - Pure text/subtitle track: reduced by 40% (64 * 0.6 = ~38px)
   * - Mixed video/image track: standard full video height (64px)
   * - Audio track: 48px
   */
  getEffectiveHeight(clips: Clip[]): number {
    if (this.type === 'audio') {
      return 48
    }
    const trackClips = clips.filter((c) => c.trackId === this.id)
    const hasVideoOrImage = trackClips.some((c) => c.kind === 'video' || c.kind === 'image')
    if (hasVideoOrImage) {
      return Math.max(this.baseHeight, 64)
    }
    const hasText = trackClips.some((c) => c.kind === 'text' || (c as any).textStyle)
    if (hasText) {
      // 40% reduction from standard 64px video track
      return Math.round(64 * 0.6) // 38px
    }
    return this.baseHeight
  }

  isEmpty(clips: Clip[]): boolean {
    return !clips.some((c) => c.trackId === this.id)
  }
}

export interface EdgeAutoScrollResult {
  shouldScroll: boolean
  direction: 'left' | 'right' | 'none'
  deltaX: number
}

export class TimelineController {
  /**
   * Calculates auto-scrolling speed when user drags near left/right timeline boundary.
   * If dragging towards 0:00 or past view window, automatically scrolls the view.
   */
  static calculateAutoScroll(
    clientX: number,
    scrollContainerRect: DOMRect,
    headerWidth = 168,
    edgeThreshold = 70,
  ): EdgeAutoScrollResult {
    const leftVisibleEdge = scrollContainerRect.left + headerWidth
    const rightVisibleEdge = scrollContainerRect.right

    // Left edge proximity (dragging towards 0:00)
    if (clientX < leftVisibleEdge + edgeThreshold) {
      const distance = Math.max(0, leftVisibleEdge + edgeThreshold - clientX)
      // Velocity proportional to push force (clamped between 3px and 28px per tick)
      const speed = Math.max(3, Math.min(28, Math.round(distance * 0.45)))
      return { shouldScroll: true, direction: 'left', deltaX: -speed }
    }

    // Right edge proximity (dragging past visible duration)
    if (clientX > rightVisibleEdge - edgeThreshold) {
      const distance = Math.max(0, clientX - (rightVisibleEdge - edgeThreshold))
      const speed = Math.max(3, Math.min(28, Math.round(distance * 0.45)))
      return { shouldScroll: true, direction: 'right', deltaX: speed }
    }

    return { shouldScroll: false, direction: 'none', deltaX: 0 }
  }

  /**
   * Determines effective track heights for all tracks in sequence
   */
  static getTrackHeights(tracks: Track[], clips: Clip[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const t of tracks) {
      const model = new TrackModel(t)
      map.set(t.id, model.getEffectiveHeight(clips))
    }
    return map
  }

  /**
   * Purges unused empty tracks while preserving at least one default video track
   */
  static purgeEmptyTracks(tracks: Track[], clips: Clip[]): Track[] {
    const occupiedTrackIds = new Set(clips.map((c) => c.trackId))
    const remaining = tracks.filter((t) => occupiedTrackIds.has(t.id) || t.locked)
    if (remaining.length === 0) {
      const first = tracks.find((t) => t.type === 'video') || tracks[0]
      return first ? [first] : tracks
    }
    return remaining
  }
}
