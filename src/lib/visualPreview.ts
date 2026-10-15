import type { Clip, ClipEffect, ClipLut, Transition } from '../types'

export interface VisualPreviewWindow {
  label: string
  /** Timeline time at which the temporary audition starts. */
  startTime: number
  /** Timeline time at which the audition pauses. */
  endTime: number
}

export type VisualPreviewInput = VisualPreviewWindow & (
  | { kind: 'clip-playback'; clipId: string }
  | { kind: 'range-playback' }
  | { kind: 'clip-effect'; clipId: string; effect: ClipEffect }
  | { kind: 'clip-lut'; clipId: string; lut: Omit<ClipLut, 'id'> }
  | { kind: 'adjustment-layer'; anchorClipId: string; afterTrackId: string; effect?: ClipEffect; lut?: Omit<ClipLut, 'id'> }
  | { kind: 'transition'; transition: Transition }
  | { kind: 'text-clip'; clip: Clip }
)

/** Temporary audition state. This is intentionally excluded from project and undo documents. */
export type VisualPreview = VisualPreviewInput & {
  id: string
  returnPlayhead: number
  returnSpeed: number
}
