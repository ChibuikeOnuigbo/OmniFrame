// OmniFrame — core data model.
// The editor document is a small, serializable graph:
//   assets -> clips (placed on tracks) -> sequence (timeline) -> project.

export type MediaKind = 'video' | 'image' | 'audio'

export interface MediaAsset {
  id: string
  name: string
  kind: MediaKind
  url: string
  duration: number // seconds (images: still, treated as a long clip by default)
  width: number
  height: number
  size: number // bytes
  thumbnail?: string // optional dataURL preview
}

export type TrackType = 'video' | 'audio'

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  hidden: boolean
  locked: boolean
  height: number // px in the timeline
}

export interface ClipTransform {
  x: number // translation in project px (0 = centered)
  y: number
  scale: number
  rotation: number // degrees
  opacity: number // 0..1
}

export interface Clip {
  id: string
  trackId: string
  assetId: string
  start: number // timeline position, seconds
  duration: number // timeline duration, seconds
  inPoint: number // source offset, seconds
  name: string
  kind: MediaKind
  volume: number // 0..1 (audio)
  transform: ClipTransform
}

export interface ProjectSettings {
  width: number
  height: number
  fps: number
  sampleRate: number
}

export const DEFAULT_PROJECT: ProjectSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  sampleRate: 48000,
}
