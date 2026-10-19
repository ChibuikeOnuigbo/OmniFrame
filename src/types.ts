import type { RecolorBlend } from './lib/recolor'
// OmniFrame — core data model.
// The editor document is a small, serializable graph:
//   assets -> clips (placed on tracks) -> sequence (timeline) -> project.

export type MediaKind = 'video' | 'image' | 'audio' | 'text' | 'threed' | 'compound' | 'adjustment' | 'drawing'

export interface Sequence {
  id: string
  name: string
  duration: number
  tracks: Track[]
  clips: Clip[]
  parentSequenceId?: string | null
  compoundClipId?: string | null
}

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

export type LayeredArtworkFormat = 'psd' | 'ora'

/** Pixel-backed source data imported from a layered-art interchange document. */
export interface LayeredArtworkAssetInfo {
  sourceFormat: LayeredArtworkFormat
  documentId: string
  documentName: string
  layerName: string
  /** Flattened visible raster order, as exposed by the source layer tree. */
  order: number
  documentWidth: number
  documentHeight: number
  left: number
  top: number
  width: number
  height: number
  /** Effective source layer/group opacity normalized to 0..1. */
  opacity: number
  /** PSD raster importer bakes the source opacity into the PNG; ORA does not. */
  opacityBaked?: boolean
  /** Optional group path; hierarchy is flattened into independent raster assets. */
  groupPath?: string[]
  /** Normalized Canvas compositing operation when supported. */
  blendMode?: string
}

/** @deprecated Use LayeredArtworkAssetInfo; retained for already-saved PSD assets. */
export interface PsdLayerAssetInfo extends Omit<LayeredArtworkAssetInfo, 'sourceFormat'> {
  sourceFormat?: 'psd'
}

/** Original source file retained alongside a converted artwork import. */
export interface SourceDocument {
  id: string
  fileName: string
  format: string
  mimeType: string
  size: number
  /** Session object URL; `.omni` bundles embed the bytes instead of persisting this URL. */
  url: string
  importedAt: number
}

export interface ImageSequenceFrame {
  /** Source-relative time in seconds; the frame is held until the next entry. */
  time: number
  url: string
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
  /** Frame-addressable raster sequence used by temporal patch/inpaint results. */
  imageSequence?: { fps: number; frames: ImageSequenceFrame[] }
  waveform?: number[] // normalized source peaks for real timeline visualization
  extractedFromClipId?: string
  /** Optional semantic label for generated multi-stem audio assets. */
  audioStemRole?: 'vocals' | 'drums' | 'bass' | 'other' | 'instrumental' | 'patched-mix'
  audioStemGroupId?: string
  /** Generic source-layer metadata for imported PSD/OpenRaster artwork. */
  layeredArtwork?: LayeredArtworkAssetInfo
  /** @deprecated Legacy field kept for PSD projects created by older builds. */
  psdLayer?: PsdLayerAssetInfo
}

export type TrackType = 'video' | 'audio'

export type MarkerColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'

/** The five marker purposes (CapCut-style colour coding): every marker is
 * FOR one thing — a beat, a section, a note, a fix, or a cue. */
export type MarkerKind = 'beat' | 'section' | 'note' | 'fix' | 'cue'

export interface TimelineMarker {
  id: string
  time: number // Timeline time in seconds (for clip markers: resolved = clip.start + clipOffset)
  duration?: number // Optional duration span for range markers (0 for single-point)
  label: string
  notes?: string
  /** Hex colour. Legacy saves may hold a MarkerColor name — normalized on read. */
  color: string
  kind?: MarkerKind | 'custom'
  /** When set, the marker lives on that clip's top edge and moves with it. */
  clipId?: string
  /** Seconds from the clip's start (clip markers only). */
  clipOffset?: number
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
  /** Anchor (pivot) the clip rotates/scales about, as a fraction of its
   * drawn rect (0..1; 0.5/0.5 = centre). Krita armature technique: park it
   * on a joint/linkage and rotations hinge there. May be keyframed via the
   * pivot_x/pivot_y curves; outside 0..1 is allowed for off-clip anchors. */
  pivotX?: number
  pivotY?: number
  z?: number
  rotationX?: number
  rotationY?: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
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
  // Per-pixel grades (Nova-style effects CSS filters cannot express):
  vibrance?: number // 0..2 smart saturation (default 1)
  solarize?: number // 0..1 invert-above-midpoint blend (default 0)
  posterize?: number // 0..1 colour-level reduction (default 0)
  grain?: number // 0..1 animated film grain (default 0)
  pixelate?: number // mosaic block size in px, 0 = off
  // Light layer (Gold Motion-style Point/Spot light, composited with 'screen').
  // Honoured on adjustment layers (lights everything beneath) and in audition previews.
  lightType?: 'point' | 'spot' // default 'point' (spot = elliptical falloff cone)
  lightColor?: string // default '#ffd9a0'
  lightIntensity?: number // 0..1.5 (default 0 = off)
  lightFalloff?: number // radius as a fraction of the frame's long edge, 0.1..1 (default 0.45)
  lightX?: number // 0..1 horizontal center (default 0.5)
  lightY?: number // 0..1 vertical center (default 0.4)
}

/** One LUT inside an adjustment layer (or a clip's own grade). */
export interface ClipLut {
  id: string
  name: string
  /** builtin manifest id (file under /luts) or the raw .cube text for uploads */
  builtin?: string
  cubeText?: string
  intensity: number // 0..1
  enabled: boolean
}

/**
 * A user-created custom effect (Gold Motion-style "Custom Effects" in
 * OmniFrame form): a named snapshot of a clip's effect settings + optional
 * LUT stack + thumbnail, listed beside the built-ins, applicable to any
 * clip or placeable as an adjustment layer, and shareable as a small
 * `.json` file (see src/lib/customEffects.ts). Plain data only, so it
 * persists in localStorage and inside `.omni` projects automatically.
 */
export interface CustomEffect {
  id: string
  name: string
  effect: ClipEffect
  luts?: ClipLut[]
  /** Small JPEG data URL captured from the preview frame when saved. */
  thumbnail?: string
  createdAt: number
}

/** LUT-stack grading carried by adjustment layers AND normal clips. */
export interface ClipAdjustment {
  luts: ClipLut[]
}

/** Spatial matte for an adjustment clip, in normalized sequence coordinates. */
export interface ClipAdjustmentMask {
  shape: 'ellipse' | 'rectangle'
  centerX: number // 0..1, left to right
  centerY: number // 0..1, top to bottom
  width: number // 0..1 of sequence width
  height: number // 0..1 of sequence height
  feather: number // blur radius in sequence pixels
  inverted: boolean
}

/**
 * Clip Mask — the CapCut/After Effects-style visibility mask (NOT the
 * selection/roto "masking" workflow and NOT the effect-region matte above).
 * It hides part of the clip itself: in normal ("Inside") mode only the
 * masked region of the clip stays visible; with `inverted` ("Outside")
 * the clip is visible everywhere EXCEPT the masked region (frame − mask).
 * Coordinates are normalized to the sequence frame; the mask is applied
 * after the clip's own filters/LUTs, so it hides graded pixels too.
 */
export interface MaskViewKeyframe {
  time: number // seconds, clip-local
  centerX: number
  centerY: number
  width: number
  height: number
  rotation: number
  splitPos?: number
  easing: 'linear' | 'smooth' | 'ease-in' | 'ease-out'
}

export interface ClipVisualMask {
  shape: 'ellipse' | 'rectangle'
  /** Video Mask View kind. Absent = legacy shape mask (rect/ellipse). */
  kind?: 'shape' | 'split' | 'custom' | 'text'
  /** Split mask: angle of the dividing line in degrees (0 = vertical line). */
  splitAngle?: number
  /** Split mask: line position 0..1 along its normal. */
  splitPos?: number
  /** Custom shape: normalized points; `curved` smooths through them. */
  points?: { x: number; y: number }[]
  curved?: boolean
  /** Text mask content + font (fontFamily may be an uploaded custom font). */
  text?: string
  fontFamily?: string
  fontSize?: number // 0..1 of frame height
  /** Optional animation of the view window over the clip. */
  keyframes?: MaskViewKeyframe[]
  centerX: number // 0..1, left to right
  centerY: number // 0..1, top to bottom
  width: number // 0..1 of sequence width
  height: number // 0..1 of sequence height
  rotation: number // degrees, clockwise
  feather: number // edge softness, sequence pixels
  expansion: number // grow (+) / shrink (−) the shape, sequence pixels
  opacity: number // 0..1 mask strength (1 = full hide/show)
  inverted: boolean // false = Inside (keep region), true = Outside (frame − region)
  enabled: boolean
}

export const DEFAULT_CLIP_MASK: ClipVisualMask = {
  shape: 'ellipse',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.5,
  height: 0.5,
  rotation: 0,
  feather: 24,
  expansion: 0,
  opacity: 1,
  inverted: false,
  enabled: true,
}

export interface TextTitleStyle {
  text: string
  fontSize?: number
  color?: string
  backgroundColor?: string
  fontFamily?: string
  bold?: boolean
  italic?: boolean
}

export type TextStyle = TextTitleStyle

/**
 * A user-imported font file (TTF/OTF/WOFF/WOFF2). The binary travels as a
 * data URL inside project state, so Save .omni embeds it as a bundle
 * attachment and reopening the project restores the exact font — no
 * dependency on the machine's installed fonts.
 */
export interface CustomFont {
  id: string
  /** CSS font-family name used by canvas + DOM rendering. */
  name: string
  fileName: string
  format: 'ttf' | 'otf' | 'woff' | 'woff2' | 'font'
  sizeBytes: number
  dataUrl: string
  importedAt: number
}

/** A colour palette imported from a .gpl/.pal/.json file for drawing. */
export interface ImportedPalette {
  id: string
  name: string
  colors: string[]
  source: string
  importedAt: number
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
  platformIcon?: 'youtube' | 'tiktok' | 'youtube-tiktok' | 'instagram' | 'pinterest' | 'tv' | 'camera' | 'source' | 'film' | 'custom' | 'generic'
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
export type SelectionToolType =
  | 'select-rect'
  | 'select-ellipse'
  | 'select-lasso'
  | 'select-polygon'
  | 'select-brush'
  | 'select-magic-wand'
  | 'select-character'

export type SelectionModeType =
  | 'rect'
  | 'ellipse'
  | 'freeform'
  | 'polygon'
  | 'painting'
  | 'magic-wand'
  | 'character'

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
  | 'polygon'
  | 'polyline'
  | 'bezier'
  | 'gradient'
  | 'fill'
  | 'clone'
  | 'smart-patch'
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

export interface SmartPatchScope {
  mode: 'current' | 'range' | 'all' | 'omniframe'
  /** Clip-relative seconds when mode === 'range'; OmniFrame mode reads the shared RotoFrameScope. */
  start: number
  end: number
  /** Frame stride; 1 applies to every frame. */
  step: number
}

export interface OnionSkinSettings {
  enabled: boolean
  beforeFrames: number // default 1
  afterFrames: number // default 1
  opacity: number // default 0.35
  tintBefore?: string // default #ef4444
  tintAfter?: string // default #10b981
  /** Krita-style tint strength: 1 = full silhouette tint, lower keeps original stroke colors (default 1) */
  tintStrength?: number
}

export interface ActiveSelection {
  type: 'rectangle' | 'ellipse' | 'lasso' | 'polygon' | 'magic-wand' | 'character' | 'brush'
  bounds: { x: number; y: number; width: number; height: number } // normalized [0, 1]
  points?: StrokePoint[]
  maskDataUrl?: string
  inverted?: boolean
  feather?: number // px
  fillMode?: 'outline' | 'filled'
  characterName?: string
  fillColor?: string
  showMaskOnly?: boolean
  maskDisplayMode?: 'rubylith' | 'matte' | 'cutout'
}

export interface DrawingStroke {
  id: string
  layerId: string
  maskId?: string // If present, stroke belongs to transparency mask attached to layerId
  tool: DrawingToolType
  color: string
  size: number // base size in stage pixels
  opacity: number // 0..1
  points: StrokePoint[]
  temporalScope: TemporalScope
  polygonSides?: number // 3..12 for the Krita Polygon Tool
  gradientColor?: string // end colour of the linear gradient ramp
  filled?: boolean // shape tools fill as well as stroke
  fillTolerance?: number // threshold 1..100 for flood fill
  preserveLuminance?: boolean // true for hair / clothing recolor preserving shading
  maskDataUrl?: string // raster patch for flood fill
  cloneSource?: { x: number; y: number; sampleDataUrl?: string } // normalized source anchor for clone stamp
  /** Frame-addressed transparent patches generated by Smart Patch. */
  smartPatchFrames?: { time: number; dataUrl: string }[]
  /** View-as-layers stamp: true when the stroke was drawn while
   *  "View videos as layers" was on. Only stamped strokes take part in
   *  layered compositing / drawing-to-clips ordering — nothing is ever
   *  inferred retroactively for unstamped strokes. */
  layered?: boolean
  /** Clips selected at draw time (the stroke passes through exactly these). */
  anchorClipIds?: string[]
  /** Set when the stroke has been converted into a drawing clip; the
   *  top-of-frame paint pass then skips it (the clip renders it in-track). */
  convertedClipId?: string
}

export interface TransparencyMask {
  id: string
  parentLayerId: string
  name: string
  enabled: boolean // whether mask is active or bypassed
  inverted: boolean // if true, mask values are inverted (black <-> white)
  opacity: number // 0..1 mask strength
  dataUrl?: string // raster 1-channel / grayscale mask buffer
}

export interface BrushDynamics {
  pressureSize: boolean // Stylus pressure scales brush diameter
  pressureOpacity: boolean // Stylus pressure scales opacity
  pressureFlow: boolean // Stylus pressure scales flow
  smoothingMode: 'none' | 'smooth' | 'stabilizer' // Krita smoothing algorithms
  stabilizerRadius: number // Leash delay radius in px (10..100)
}

export interface PaintLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode?: GlobalCompositeOperation
  blur?: number // Gaussian blur radius in px
  maskDataUrl?: string // raster restriction / legacy mask
  transparencyMask?: TransparencyMask // Krita-style non-destructive child transparency mask
}

// ---- Workspace Layout & Focus Mode Types ----
export type WorkspacePreset =
  | 'default'
  | 'edit'
  | 'timeline-focus'
  | 'preview-focus'
  | 'drawing'
  | 'color'
  | '3d'
  | 'minimal'
  | 'full-canvas'
  | 'audio'
  | 'vfx'
  | 'rig'
  | 'manga'
  | 'capcut'
  | 'alight'
  | 'cinema'

/** How side-panel sections are presented: tab panels or single-open accordion. */
export type SidebarSectionMode = 'tabs' | 'accordion'
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
  /** Storyboard shot note (plan-level annotation; never rendered into output). */
  notes?: string
  transform: ClipTransform
  effects?: ClipEffect
  /** LUT stack: adjustment layers grade everything below them; regular
   *  clips carrying this grade only their own output (effect placed "inside"). */
  adjustment?: ClipAdjustment
  /** Optional spatial matte that limits adjustment-layer grading. */
  adjustmentMask?: ClipAdjustmentMask
  /** Optional CapCut/AE-style visibility mask that hides part of the clip. */
  mask?: ClipVisualMask
  textStyle?: TextTitleStyle
  animation?: import('./lib/animation/CurveEngine').ClipAnimation
  /** Drawing clips (kind: 'drawing'): strokes baked into a timeline clip.
   *  The strokes keep their original payload (tool, colour, blend via their
   *  paint layer, scopes) — conversion changes placement, never appearance. */
  drawingStrokeIds?: string[]
  drawingLayerId?: string
  // Compound Clip / Nested Sequence references
  sourceSequenceId?: string
  originalChildClips?: Clip[]
  originalChildTracks?: Track[]
  nestedTrackCount?: number
  nestedClipCount?: number
}

// ---- 3D Scene Architecture & Blender Modes ----
export type BlenderMode = 'object' | 'camera' | 'texturing' | 'animation'
export type Primitive3D = 'wheel' | 'cube' | 'sphere' | 'torus' | 'diamond' | 'plane'

export interface Scene3DObject {
  id: string
  name: string
  type: Primitive3D
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  color: string
  wireframe?: boolean
  roughness?: number
  metalness?: number
  materialId?: string
  animation?: import('./lib/animation/CurveEngine').ClipAnimation
}

export type ThreeMaskMode = 'off' | 'scene' | 'viewport'
export type ThreeMaskTargetKind = 'geometry' | 'material'

/** Editing-only 3D selection, projected into the current viewport for optional Drawing transfer. */
export interface ThreeMaskSelection {
  id: string
  mode: Exclude<ThreeMaskMode, 'off'>
  bounds: { x: number; y: number; width: number; height: number }
  targetName: string
  targetKind?: ThreeMaskTargetKind
  targetIds?: string[]
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

// ---- Universal Link System, Parenting & Groups ----
export type LinkRuleType = 'motion' | 'duration' | 'delete' | 'selection' | 'visibility' | 'lock' | 'property'

export interface LinkSet {
  id: string
  name: string
  memberIds: string[] // Clip IDs
  rules: Record<LinkRuleType, boolean>
  propertyLinks?: Record<string, string> // e.g. { 'effects.blur': 'effects.blur' }
  createdAt?: number
}

export interface ParentRelationship {
  childId: string
  parentId: string
  inheritPosition: boolean
  inheritRotation: boolean
  inheritScale: boolean
  localOffset: ClipTransform
}

export interface GroupInstance {
  id: string
  name: string
  memberIds: string[]
  collapsed: boolean
  locked: boolean
  hidden: boolean
}

// ---- 3D Textures, Materials & Camera Paint ----
export type TextureMapType = 'baseColor' | 'normal' | 'roughness' | 'metallic' | 'emission' | 'opacity'

export interface TextureAsset {
  id: string
  name: string
  url?: string
  width: number
  height: number
  mapType?: TextureMapType
  sharedAssetIds?: string[] // 3D models or objects sharing this texture
  usersCount?: number
  colorSpace?: string
}

export interface MaterialInstance {
  id: string
  name: string
  textureId?: string
  color?: string
  normalMapId?: string
  roughnessMapId?: string
  roughness?: number
  metalness?: number
  metallic?: number
  emission?: string
  opacity?: number
  usersCount?: number
}

export type CameraPaintMode = 'CAMERA_LOCKED' | 'SURFACE_PROJECTED' | 'WORLD_ANCHORED' | 'TEXTURE_BAKED'

export interface CameraPaintPoint {
  x: number
  y: number
  z?: number
  surfaceU?: number
  surfaceV?: number
}

export interface CameraPaintStroke {
  id: string
  mode: CameraPaintMode
  points: CameraPaintPoint[]
  color: string
  size: number
  bakedTextureId?: string
}

// ---- Masking & Tracking Subsystem (LumaCut Multi-Signal Architecture) ----
export type TrackingMode = 'mask' | 'main'
export type MainTrackingType = 'point' | 'multipoint' | 'motion' | 'planar' | 'camera'
export type MaskShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'lasso' | 'brush'

export interface ClipMask {
  id: string
  clipId: string
  name: string
  shapeType: MaskShapeType
  points: { x: number; y: number }[] // normalized 0..1 coordinates
  inverted: boolean
  feather: number // pixels
  expansion: number // pixels
  opacity: number // 0..1
  applyToAllFrames: boolean
  trackingSessionId?: string
}

export interface TrackPoint {
  x: number // normalized 0..1
  y: number // normalized 0..1
  frame: number
  confidence: number
}

export interface TrackingFrameResult {
  frame: number
  points: TrackPoint[]
  maskDataUrl?: string
  transform?: ClipTransform
  confidence: number
}

export interface TrackingSession {
  id: string
  targetClipId: string
  mode: TrackingMode
  mainType?: MainTrackingType
  points: TrackPoint[]
  frameResults: TrackingFrameResult[]
  isTracking: boolean
  competitionEnabled: boolean // competing foreground vs background boundary analysis
}

// ---- Background Removal Multi-Model Subsystem ----
export type BgRemovalModelId =
  | 'birefnet-general'
  | 'modnet-photographic'
  | 'isnet-anime'
  | 'slimsam-fast'
  | 'birefnet-lite-512'
  | 'modnet'
  | 'isnet-onnx'
  | 'slimsam-77'

export interface BgRemovalOptions {
  modelId: BgRemovalModelId
  mode?: 'transparent' | 'solid' | 'blur'
  solidColor?: string
  blurRadius?: number
  chokeExpand?: number
  featherRadius?: number
  edgeFeather?: number
  threshold?: number
  temporalSmoothing?: boolean
}

export interface BgRemovalJob {
  id: string
  clipId: string
  modelId: BgRemovalModelId
  device: 'webgpu' | 'wasm'
  progress: number
  status: 'idle' | 'loading' | 'processing' | 'done' | 'error'
  error?: string
}

// ---- OmniFrame Edit Mode & Propagation ----
export type OmniframeOperationType =
  | 'move'
  | 'cut'
  | 'duplicate'
  | 'remove'
  | 'fill'
  | 'resize'
  | 'scale'
  | 'rotate'
  | 'translate'
  | 'recolor'
  | 'blur'
  | 'sharpen'
  | 'isolate'

export type OmniframeScopeType = 'all' | 'section' | 'frame'

export interface OmniframeCharacter {
  id: string
  name: string
  label: string
  bounds: { x: number; y: number; width: number; height: number } // normalized [0, 1]
  cutoutUrl: string
  /** Optional frame-addressed cutout sequence for tracked video subjects. */
  cutoutSequence?: { time: number; url: string }[]
  transform: ClipTransform
  scope: OmniframeScopeType
  sectionRange?: { start: number; end: number } // in seconds (e.g. 2.0s to 5.0s)
  frameNumber?: number // for 1-frame scope (e.g. frame 90)
  keyframeOffsets?: { frame: number; transform: ClipTransform }[]
  recolorColor?: string
  recolorUrl?: string
  /** Blend used to produce recolorUrl. Defaults to 'dye'. */
  recolorBlend?: RecolorBlend
}

export interface OmniframeOperation {
  id: string
  type: OmniframeOperationType
  referenceFrame: number
  targetRange: { start: number; end: number }
  selectionMaskUrl: string
  transformDelta: ClipTransform
  confidence: number
  applyToAllFrames: boolean
}

// ---- Templates Subsystem ----
export type TemplateSlotType = 'video' | 'image' | 'text' | 'audio' | '3d' | 'drawing' | 'background' | 'logo'

// ---- Settings Customization: Shortcuts, Context Menu & Cursors ----
export type CursorPack = 'pro-precision' | 'mac-sonoma-pro' | 'mac-gamified' | 'cyber-violet' | 'neo-stealth'
export type CursorTheme = 'pro-precision' | 'mac-sonoma-pro' | 'mac-gamified' | 'cyber-violet' | 'neo-stealth'
export type CursorSize = 'compact' | 'standard' | 'bigger' | 'mega'
export type CursorRenderMode = 'follower' | 'native-css'

export interface CursorConfig {
  enabled: boolean
  pack: CursorPack
  theme: CursorTheme
  size: CursorSize
  renderMode: CursorRenderMode
  showClickBurst: boolean
  showBadges: boolean // + for drag, ? for help
  showDragPill: boolean // ghost pill with clip/asset info when dragging
  showDropReticle: boolean // magnetized green reticle when over drop target
  showTrail: boolean
}

export interface ShortcutItem {
  id: string
  label: string
  key: string
  description: string
  defaultKey: string
}

export interface ContextMenuItemConfig {
  id: string
  label: string
  enabled: boolean
  shortcut?: string
  description: string
}

export interface TemplateSlot {
  id: string
  name: string
  type: TemplateSlotType
  clipId?: string
  required: boolean
  defaultContent?: string
  durationConstraint?: number
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  slots: TemplateSlot[]
  thumbnail?: string
}

export interface GuidedMatteRecord {
  id: string
  /** Rectangle the user dragged, normalised 0..1. */
  rect: { x: number; y: number; width: number; height: number }
  /** PNG matte (white = subject) produced by the coordinate-seeded matting pass. */
  maskDataUrl: string
  /** RGBA cutout premultiplied by the matte. */
  cutoutDataUrl: string
  width: number
  height: number
  /** Fraction of the rectangle that survived as foreground. */
  coverage: number
  confidence: number
  iterations: number
  seedStats: { foreground: number; background: number }
  timings: { seed: number; gmm: number; classify: number; refine: number; encode: number; total: number }
  /** OmniFrame cutout object created when the matte is run in OmniFrame context. */
  objectId?: string
  /** Drawing paint layer receiving this matte; absent until it is applied. */
  maskLayerId?: string
  createdAt: number
}

/* ---------------------------------------------------------------------------
 * Rigging
 * -------------------------------------------------------------------------
 * A rig turns one flat character cutout into a set of named parts joined by a
 * parent/child skeleton, so moving a shoulder carries the arm, forearm and
 * hand with it instead of the animator repositioning each piece.
 *
 * Modelled on the MangaCut pipeline (mask -> rig -> animate). See
 * qa/reports/rigging-research.md for the source material.
 */

/** Default part taxonomy, following the ten-part export of manga segmenters. */
export type RigPartKind =
  | 'hair'
  | 'face'
  | 'head'
  | 'neck'
  | 'torso'
  | 'armUpper'
  | 'armLower'
  | 'hand'
  | 'legUpper'
  | 'legLower'
  | 'foot'
  | 'clothing'
  | 'accessory'
  | 'custom'

export type RigSide = 'left' | 'right' | 'center'

/** A deformation pin, in the manner of After Effects' puppet tool. */
export interface RigPin {
  id: string
  /** Position within the part's own bounds, normalised 0..1. */
  x: number
  y: number
  /** Influence radius, normalised against the part's larger dimension. */
  radius: number
  /** Current displacement from the rest position, in part-local px. */
  dx: number
  dy: number
}

/** Bend deformation: curves a limb instead of hinging it at a joint. */
export interface RigBend {
  /** Rotation applied at the far end of the part, degrees. */
  angle: number
  /** Where along the part the bend starts, 0..1 from the pivot. */
  start: number
  /** How far along the part the bend reaches, 0..1 from the pivot. */
  end: number
}

/** Secondary motion — hair and cloth trailing behind the part that drives it. */
export interface RigWind {
  enabled: boolean
  /** Peak sway in degrees. */
  amplitude: number
  /** Oscillations per second. */
  frequency: number
  /** 0..1, how much of the motion lags the parent. Higher = floppier. */
  lag: number
  /** Constant directional push in degrees, for wind from one side. */
  bias: number
}

export interface RigSway {
  enabled: boolean
  /** Peak pin travel as a fraction of the part's width or height (0..0.5). */
  distance: number
  /** Sway cycles per second. */
  speed: number
  direction: 'horizontal' | 'vertical'
}

export interface RigPart {
  id: string
  name: string
  kind: RigPartKind
  side: RigSide
  /** Transparent cutout for this part. */
  cutoutUrl: string
  /** Bounds in character-normalised space, 0..1. */
  bounds: { x: number; y: number; width: number; height: number }
  /** Rotation origin, normalised within this part's own bounds. */
  pivot: { x: number; y: number }
  /** Parent part id. Moving the parent carries this part. Null = root. */
  parentId: string | null
  /** Paint order. Higher draws on top. */
  z: number
  /** Local transform, relative to the parent's world transform. */
  transform: ClipTransform
  bend?: RigBend
  wind?: RigWind
  /** Pin-driven secondary motion for PSD hair strands and cloth. */
  sway?: RigSway
  pins?: RigPin[]
  /** Source library asset when this part came from imported layered artwork. */
  sourceAssetId?: string
  /** Layer opacity when it is not baked into the source PNG. */
  sourceOpacity?: number
  /** Normalized Canvas/CSS blend operation from the source artwork. */
  sourceBlendMode?: string
  hidden?: boolean
  locked?: boolean
  sourceMaskId?: string
}

export interface Rig {
  id: string
  name: string
  /** The OmniFrame character this rig was built from, if any. */
  characterId?: string
  /** Imported layered artwork document used to seed this rig (new generic field). */
  sourceDocumentId?: string
  sourceFormat?: LayeredArtworkFormat
  /** @deprecated Legacy PSD document link for projects created by older builds. */
  psdDocumentId?: string
  /** Source design-space dimensions; part x/y transforms are stored in document pixels. */
  canvasWidth?: number
  canvasHeight?: number
  /** Source panel, kept so the rig can be rebuilt. */
  sourceUrl?: string
  parts: RigPart[]
  createdAt: number
  updatedAt: number
}

/** A resolved part position after walking the parent chain. */
export interface RigResolvedPart {
  part: RigPart
  /** Accumulated transform in character space. */
  world: ClipTransform
  /** Absolute pivot position in character-normalised space. */
  pivotWorld: { x: number; y: number }
  /** Chain of ancestor ids, root first. Used to detect cycles. */
  chain: string[]
}
