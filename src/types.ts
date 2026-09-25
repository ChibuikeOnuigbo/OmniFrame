// OmniFrame — core data model.
// The editor document is a small, serializable graph:
//   assets -> clips (placed on tracks) -> sequence (timeline) -> project.

export type MediaKind = 'video' | 'image' | 'audio'

export type TransitionType =
  | 'cross_dissolve'
  | 'dip_to_black'
  | 'dip_to_white'
  | 'wipe_left'
  | 'wipe_right'
  | 'wipe_up'
  | 'wipe_down'
  | 'slide_left'
  | 'slide_right'
  | 'zoom'

export interface Transition {
  id: string
  type: TransitionType
  fromClipId: string
  toClipId: string
  trackId: string
  startTime: number // timeline start timestamp (seconds)
  duration: number // transition duration (seconds)
  alignment: 'centered' | 'start_at_cut' | 'end_at_cut'
  parameters?: Record<string, any>
  enabled: boolean
}

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
  waveform?: number[] // normalized source peaks for real timeline visualization
  extractedFromClipId?: string
}

export type TrackType = 'video' | 'audio'

export type MarkerColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'

export interface TimelineMarker {
  id: string
  time: number // Time in seconds
  duration?: number // Optional duration span for range markers (0 for single-point)
  label: string
  notes?: string
  color: MarkerColor
}

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  hidden: boolean
  locked: boolean
  gapless: boolean // ripple later clips on this track when a clip is removed
  height: number // px in the timeline
}

export interface ClipTransform {
  x: number // translation in project px (0 = centered)
  y: number
  scale: number
  rotation: number // degrees
  opacity: number // 0..1
}

export interface ClipEffect {
  brightness?: number // 0..2 (default 1)
  contrast?: number // 0..2 (default 1)
  saturation?: number // 0..2 (default 1)
  blur?: number // 0..20 px (default 0)
  grayscale?: number // 0..1 (default 0)
  invert?: number // 0..1 (default 0)
  sepia?: number // 0..1 (default 0)
  hueRotate?: number // 0..360 deg (default 0)
}

export interface TextTitleStyle {
  text: string
  fontSize: number
  color: string
  backgroundColor: string
  fontFamily: string
  bold?: boolean
  italic?: boolean
}

// ---- Aspect Ratio & Sequence Settings ----
export type AspectRatioType =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '3:4'
  | '4:3'
  | '3:2'
  | '2:3'
  | '5:4'
  | '21:9'
  | 'custom'
  | 'source'

export interface SequenceSettings {
  aspectRatio: AspectRatioType
  width: number
  height: number
  fps: number
  label: string
  pixelAspectRatio?: number
  isCustom?: boolean
}

export interface RatioPreset {
  id: AspectRatioType
  label: string
  aspectRatio: string
  width: number
  height: number
  platforms: string[]
  description: string
  platformIcon?: 'youtube' | 'tiktok' | 'instagram' | 'generic'
}

// ---- Source Monitor vs Program Monitor ----
export type MonitorMode = 'program' | 'source'

export interface SourcePreviewState {
  assetId: string | null
  playing: boolean
  currentTime: number
  volume: number
  muted: boolean
  playbackRate: number
  zoom: number
  pan: { x: number; y: number }
}

export type TimelineInsertionMode = 'insert' | 'overwrite'

// ---- Drawing & Paint Subsystem Types ----
export type SelectionToolType = 'select-rect' | 'select-ellipse' | 'select-lasso'
export type DrawingToolType =
  | 'brush'
  | 'pencil'
  | 'marker'
  | 'calligraphy'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'star'
  | 'fill'
  | 'clone'
  | 'eyedropper'
  | SelectionToolType

export interface StrokePoint {
  x: number // Normalized [0, 1] relative to stage width
  y: number // Normalized [0, 1] relative to stage height
  pressure?: number // 0..1
  timestamp: number // ms from stroke start
}

export type TemporalScopeType = 'global' | 'span' | 'frame'

export interface TemporalScope {
  type: TemporalScopeType
  startTime?: number // seconds
  duration?: number // seconds
  frame?: number // frame index
  holdFrames?: number // number of frames to hold/expose cel without duplicate data
}

export interface OnionSkinSettings {
  enabled: boolean
  beforeFrames: number // default 1
  afterFrames: number // default 1
  opacity: number // default 0.35
  tintBefore?: string // default #ef4444
  tintAfter?: string // default #10b981
}

export interface ActiveSelection {
  type: 'rectangle' | 'ellipse' | 'lasso'
  bounds: { x: number; y: number; width: number; height: number } // normalized [0, 1]
  points?: StrokePoint[]
  maskDataUrl?: string
  inverted?: boolean
  feather?: number // px
}

export interface DrawingStroke {
  id: string
  layerId: string
  tool: DrawingToolType
  color: string
  size: number // base size in stage pixels
  opacity: number // 0..1
  points: StrokePoint[]
  temporalScope: TemporalScope
  fillTolerance?: number // threshold 1..100 for flood fill
  preserveLuminance?: boolean // true for hair / clothing recolor preserving shading
  maskDataUrl?: string // raster patch for flood fill
  cloneSource?: { x: number; y: number } // normalized source anchor for clone stamp
}

export interface PaintLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode?: GlobalCompositeOperation
  blur?: number // Gaussian blur radius in px
  maskDataUrl?: string // raster restriction / transparency mask
}

// ---- Workspace Layout & Focus Mode Types ----
export type WorkspacePreset = 'default' | 'edit' | 'timeline-focus' | 'preview-focus' | 'drawing' | 'color' | '3d' | 'minimal' | 'full-canvas'
export type FocusMode = 'none' | 'preview' | 'timeline' | 'canvas-only' | 'one-panel'

export interface CustomWorkspace {
  id: string
  name: string
  createdAt: number
  leftOpen: boolean
  rightOpen: boolean
  leftDockWidth: number
  rightPanelWidth: number
  timelineHeight: number
  focusMode: FocusMode
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
  hidden: boolean // clip-level visibility; distinct from track visibility
  transform: ClipTransform
  effects?: ClipEffect
  textStyle?: TextTitleStyle
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
