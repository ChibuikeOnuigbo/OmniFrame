import { BLEND_MODES, putBlendKey } from './lib/blendModes'
import { regroupFor, expandGroupSelection } from './lib/parentChain'
import { recolorImage } from './lib/recolor'
import { planDrawingToClips } from './lib/drawingToClips'
import { importPsdDocument } from './lib/psdImport'
import { getLayeredArtworkInfo } from './lib/layeredArtworkMetadata'
import type { RecolorBlend } from './lib/recolor'
import { create } from 'zustand'
import type {
  Clip,
  MediaAsset,
  SourceDocument,
  Track,
  TrackType,
  ClipTransform,
  Transition,
  DrawingToolType,
  StrokePoint,
  TemporalScope,
  DrawingStroke,
  PaintLayer,
  WorkspacePreset,
  FocusMode,
  OnionSkinSettings,
  ActiveSelection,
  CustomWorkspace,
  SequenceSettings,
  AspectRatioType,
  SourcePreviewState,
  MonitorMode,
  TimelineInsertionMode,
  ClipEffect,
  CustomEffect,
  ClipLut,
  TimelineMarker,
  MarkerColor,
  LinkRuleType,
  LinkSet,
  ParentRelationship,
  GroupInstance,
  TrackPoint,
  CursorConfig,
  TrackingSession,
  TextureAsset,
  MaterialInstance,
  BgRemovalJob,
  BlenderMode,
  Primitive3D,
  Scene3DObject,
  ThreeMaskMode,
  ThreeMaskTargetKind,
  ThreeMaskSelection,
  OmniframeCharacter,
  OmniframeScopeType,
  SelectionModeType,
  ClipMask,
  ClipVisualMask,
  Sequence,
  TransparencyMask,
  BrushDynamics,
  GuidedMatteRecord,
  SidebarSectionMode,
  CustomFont,
  ImportedPalette,
} from './types'
import { captureClipTemplate, replaceVideoPatch, templatePatch, type ClipTemplate } from './lib/replaceVideo'
import { parseAlightXml, alightToImport, exportAlightXml as buildAlightXml, exportTemplateXml as buildTemplateXml, importTemplateXml, type AlightExportClip, type AlightExportKey } from './lib/alightXml'
import { shakePresetById } from './lib/shakePresets'
import { DEFAULT_CLIP_MASK } from './types'
import { fontFamilyFromFileName, fontFormatFromFileName, readFileAsDataUrl, dataUrlByteSize, registerCustomFont, registerAllCustomFonts, unregisterCustomFont } from './lib/fonts'
import { parseSubtitles, parsePalette } from './lib/importUtils'
import { guidedRectMatting, type GuidedMattingResult } from './lib/guidedMatting'
import { uid, clamp } from './lib/time'
import { clampFxToClip, splitFxInstances, FX_MIN_DUR } from './lib/fxInstances'
import { fxCatalogById } from './lib/effectCatalog'
import type { FxInstance } from './types'
import { createSelectionMask } from './lib/drawingEngine'
import { RATIO_PRESETS } from './lib/aspectRatios'
import { parseCubeLUT } from './lib/lutEngine'
import { TimelineController } from './lib/oop/TimelineController'
import type { VoiceIsolationModel } from './lib/voiceIsolation'
import {
  InterpolationType,
  ExtrapolationMode,
  TangentHandleMode,
  KeyframeNode,
  PropertyCurve,
  ClipAnimation,
  createDefaultClipAnimation,
  addOrUpdateKeyframe,
  removeKeyframe,
  applyEasingPreset,
  evaluateCurve,
  evaluateClipAnimation,
} from './lib/animation/CurveEngine'

export type Tool = 'select' | 'blade'
export type PreviewQuality = 'low' | 'medium' | 'high' | 'full'
export type LeftTab =
  | 'media'
  | 'omniframe'
  | 'audio'
  | 'tracking'
  | 'relationships'
  | 'drawing'
  | 'transitions'
  | 'effects'
  | 'text'
  | 'threed'
  | 'rigging'
  | 'pack'
  | 'storyboard'

export const INITIAL_DEATH_NOTE_CHARACTERS: OmniframeCharacter[] = [
  {
    id: 'char_light',
    name: 'Light Yagami',
    label: 'Character 1 (Far Left)',
    bounds: { x: 0.016, y: 0.078, width: 0.190, height: 0.866 },
    cutoutUrl: '/assets/death_note/char_light.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_l',
    name: 'L Lawliet',
    label: 'Character 2 (Crouching)',
    bounds: { x: 0.203, y: 0.384, width: 0.194, height: 0.523 },
    cutoutUrl: '/assets/death_note/char_l.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_mello',
    name: 'Mello',
    label: 'Character 3 (Leather Jacket)',
    bounds: { x: 0.406, y: 0.126, width: 0.153, height: 0.817 },
    cutoutUrl: '/assets/death_note/char_mello.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_near',
    name: 'Near (Nate River)',
    label: 'Character 4 (Stacking Dice)',
    bounds: { x: 0.557, y: 0.436, width: 0.235, height: 0.519 },
    cutoutUrl: '/assets/death_note/char_near.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_ryuk',
    name: 'Ryuk Shinigami',
    label: 'Character 5 (Far Right Shinigami)',
    bounds: { x: 0.723, y: 0.016, width: 0.263, height: 0.944 },
    cutoutUrl: '/assets/death_note/char_ryuk.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
]

export const INITIAL_ROOM_OBJECTS: OmniframeCharacter[] = [
  {
    id: 'char_chair',
    name: 'Leather Armchair',
    label: 'Detected Object (Chair)',
    bounds: { x: 0.120, y: 0.180, width: 0.360, height: 0.820 },
    cutoutUrl: '/assets/room/obj_chair.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_towel',
    name: 'Draped Armchair Towel',
    label: 'Real Object 1 (White Towel on Armrest)',
    bounds: { x: 0.000, y: 0.1492, width: 0.5497, height: 0.8508 },
    cutoutUrl: '/assets/room/obj_towel.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
  {
    id: 'char_curtain',
    name: 'Gold Pleated Curtain',
    label: 'Real Object 2 (Right Window Curtain)',
    bounds: { x: 0.58, y: 0.00, width: 0.42, height: 1.00 },
    cutoutUrl: '/assets/room/obj_curtain.png',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    scope: 'all',
  },
]

interface Doc {
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  drawingStrokes: DrawingStroke[]
  paintLayers: PaintLayer[]
  markers: TimelineMarker[]
  linkSets: LinkSet[]
  parentRelationships: ParentRelationship[]
  groups: GroupInstance[]
  omniframeCharacters?: OmniframeCharacter[]
  attachDirectlyToVideo?: boolean
  sequences?: Sequence[]
  activeSequenceId?: string
  breadcrumbs?: { id: string; name: string }[]
}

const MIN_CLIP = 0.05 // seconds

function cloneDoc(s: EditorState): Doc {
  return {
    tracks: structuredClone(s.tracks),
    clips: structuredClone(s.clips),
    transitions: structuredClone(s.transitions || []),
    drawingStrokes: structuredClone(s.drawingStrokes || []),
    paintLayers: structuredClone(s.paintLayers || []),
    markers: structuredClone(s.markers || []),
    linkSets: structuredClone(s.linkSets || []),
    parentRelationships: structuredClone(s.parentRelationships || []),
    groups: structuredClone(s.groups || []),
    omniframeCharacters: structuredClone(s.omniframeCharacters || []),
    attachDirectlyToVideo: s.attachDirectlyToVideo ?? true,
    sequences: structuredClone(s.sequences || []),
    activeSequenceId: s.activeSequenceId ?? 'main',
    breadcrumbs: structuredClone(s.breadcrumbs || [{ id: 'main', name: 'Main Timeline' }]),
  }
}

export const DEFAULT_CONTEXT_COMMANDS: Record<string, boolean> = {
  cut: true,
  copy: true,
  paste: true,
  duplicate: true,
  split: true,
  marker: true,
  'add-transition': true,
  'separate-audio': true,
  'isolate-voice': true,
  'remove-bg-modal': true,
  'compound-clip': true,
  'open-compound-clip': true,
  'uncompound-clip': true,
  'hide-toggle': true,
  delete: true,
}

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  split: 'B',
  marker: 'M',
  hide: 'H',
  selectTool: 'V',
  bladeTool: 'B',
  delete: 'Delete',
  duplicate: 'Ctrl+D',
  cut: 'Ctrl+X',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y / Ctrl+Shift+Z',
  playPause: 'Space',
  omniframe: 'Alt+O',
  threed: '3',
  speed: 'Ctrl+R',
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  enabled: true,
  pack: 'pro-precision',
  theme: 'pro-precision',
  size: 'standard', // native-feeling cursor size (see CustomCursor scale map)
  renderMode: 'follower',
  showClickBurst: false, // ripple on every click is visual noise for pro editing
  showBadges: true, // + for drag, ? for help as requested by user
  showDragPill: true, // ghost pill with info when dragging
  showDropReticle: true, // magnetized drop target when over timeline tracks
  showTrail: false,
}

/**
 * How far a universal timeline tool reaches.
 *  - track    : just the one track that was right-clicked
 *  - all      : every track in the sequence
 *  - targeted : only the tracks the user has targeted (falls back to all)
 */
// Gap tooling lives in ./store/gapTools.ts now. Re-exported because
// Timeline.tsx imports gapsOnTrack from here.
export { gapsOnTrack, resolveTargetTracks, type GapScope, type TimelineGap } from './store/gapTools'
import {
  createGapToolsSlice,
  gapsOnTrack,
  type GapScope,
  type TimelineGap,
} from './store/gapTools'
import { createOmniframeCharacterSlice } from './store/omniframeCharacters'
import { createOmniExtractSlice, type OmniExtractSlice, type OmniExtractState } from './store/omniExtract'
import { createRotoMaskSlice } from './store/rotoMask'
import { createSmartPatchSlice } from './store/smartPatch'
import type { SmartPatchSlice } from './store/smartPatch'
import type {
  RotoMaskSlice,
  RotoMaskFrameResult,
  RotoMaskRecord,
  RotoStatus,
  RotoFrameScope,
  RotoInpaintState,
  RotoToolMode,
} from './store/rotoMask'
import type { RotoModelDescriptor } from './lib/rotoModels'
import type { RotoClick } from './lib/rotoMaskEngine'
import { createRiggingSlice, type RiggingSlice } from './store/rigging'
// Statically imported (not dynamically in the test hook below): RightPanel
// already pulls this 4 KB module into the main bundle, so a dynamic import
// here only triggered rolldown's INEFFECTIVE_DYNAMIC_IMPORT warning.
import { measureIntegratedLufs } from './lib/loudness'
// Statically imported (not dynamically at the use sites): rotoBrush and
// aiDenoise are already statically imported by rotoMaskEngine/omniUnified/
// voiceIsolation, so dynamic imports here only triggered rolldown's
// INEFFECTIVE_DYNAMIC_IMPORT warnings without moving any chunk.
import { autoBrushMaskFromStroke, magicWandMask, maskBounds, maskToDataUrl } from './lib/rotoBrush'
import { denoiseAudioBuffer } from './lib/aiDenoise'
import { buildOmniProjectBundle, parseOmniProjectBundle } from './lib/omniProject'
import { sanitizeEffect, sanitizeLuts } from './lib/customEffects'
import { markerColorHex, MARKER_KINDS } from './lib/markers'
import type { VisualPreview, VisualPreviewInput } from './lib/visualPreview'

interface EditorState extends RiggingSlice, RotoMaskSlice, SmartPatchSlice, OmniExtractSlice {
  selectionBrushAuto: boolean
  selectionBrushTolerance: number
  selectionWandTolerance: number
  // ---- RotoMask (click-to-segment rotoscoping) state ----
  rotoModelId: string
  rotoImportedModels: RotoModelDescriptor[]
  rotoStatus: RotoStatus
  rotoClicks: RotoClick[]
  rotoResult: RotoMaskRecord | null
  rotoBusy: boolean
  rotoScope: RotoFrameScope
  rotoFrames: RotoMaskFrameResult[]
  rotoTracking: { running: boolean; done: number; total: number }
  rotoInpaint: RotoInpaintState
  rotoTool: RotoToolMode
  rotoTolerance: number
  rotoBrushRadius: number
  rotoLumaExport: { url: string; frame: number; at: number } | null
  assets: MediaAsset[]
  sourceDocuments: SourceDocument[]
  projectName: string
  saveOmniProject: (name?: string) => Promise<Blob>
  setProjectName: (name: string) => void
  loadOmniProject: (file: File) => Promise<void>
  mediaImportNotice: string | null
  clearMediaImportNotice: () => void
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  selectedTransitionId: string | null
  /** Transient visual audition state; excluded from Doc/project serialization. */
  visualPreview: VisualPreview | null
  startVisualPreview: (preview: VisualPreviewInput) => void
  stopVisualPreview: () => void
  applyVisualPreview: () => void
  /** Clip whose Mask outline is drawn/edited on the monitor (transient). */
  maskEditClipId: string | null
  setMaskEditClip: (id: string | null) => void
  addClipMask: (clipId: string) => void
  updateClipMask: (clipId: string, patch: Partial<ClipVisualMask>) => void
  removeClipMask: (clipId: string) => void
  playhead: number
  duration: number
  pxPerSec: number
  playing: boolean
  speed: number
  projectFps: number
  /** AE-style composition background colour painted under every frame. */
  sequenceBackground: string
  setSequenceBackground: (color: string) => void
  dropFrameTimecode: boolean
  previewQuality: PreviewQuality
  /** Hide horizontal overflow app-wide (default on): strips use hover arrows / wheel / drag instead of visible scrollbars. */
  hideOverflowX: boolean
  transformToolMode: 'free' | 'perspective' | 'liquify' | 'marquee' | 'roto'
  liquifyTool: import('./lib/deformation').LiquifyMode
  liquifyRadius: number
  liquifyStrength: number
  uiStyle: string
  uiPalette: string
  setUiStyle: (v: string) => void
  setUiPalette: (v: string) => void
  // Provider connection (BYOK). The API key lives in memory ONLY — never
  // persisted, never in .omni files. Provider/model/endpoint persist.
  aiProvider: string
  aiModel: string
  aiEndpoint: string
  aiApiKey: string
  aiCapabilityModels: Record<string, string>
  aiConnection: { status: 'idle' | 'testing' | 'connected' | 'error'; message: string; latencyMs: number | null; modelAvailable: boolean | null; at: number }
  setAiProvider: (v: string) => void
  setAiModel: (v: string) => void
  setAiEndpoint: (v: string) => void
  setAiApiKey: (v: string) => void
  setAiCapabilityModel: (capability: string, model: string) => void
  setAiConnection: (c: { status: 'idle' | 'testing' | 'connected' | 'error'; message: string; latencyMs: number | null; modelAvailable?: boolean | null }) => void
  // Saved watermarks (Watermark Studio presets, from the CapCut study).
  watermarks: { id: string; name: string; level: number; color: string; characterAssetId?: string; voiceAssetId?: string; seed: number }[]
  addWatermark: (w: { name: string; level: number; color: string; characterAssetId?: string; voiceAssetId?: string; seed: number }) => string
  removeWatermark: (id: string) => void
  // Library taste: the pack learns from likes + what you actually place.
  /** Drawing: treat selected video clips as paint layers (drawing sits in
   *  the clip stack) instead of always compositing on top of everything. */
  viewVideosAsLayers: boolean
  setViewVideosAsLayers: (v: boolean) => void
  /** Convert all unconverted drawing strokes into timeline drawing clips. */
  convertDrawingToClips: () => { clips: number; tracks: number; strokes: number }
  /** Docker customization (Settings > Dockers): which left tabs and right
   *  sub-tools the user keeps on their rails. Persisted per user. */
  dockerPrefs: { leftTabs: Record<string, boolean>; rightSubtools: Record<string, boolean> }
  setDockerPref: (kind: 'leftTabs' | 'rightSubtools', id: string, visible: boolean) => void
  /** One-shot request for a panel to bring a section forward (rail flyouts). */
  drawingSectionRequest: string | null
  /** When inside a compound clip: the parent clip's visible window into
   *  this sequence (trimmed head/tail show as cut voids in the timeline). */
  compoundWindow: { in: number; out: number; total: number } | null
  /** CapCut-style In/Out export range: exports render only this slice. */
  exportRange: { in: number; out: number } | null
  setExportIn: () => void
  setExportOut: () => void
  clearExportRange: () => void
  requestDrawingSection: (section: string | null) => void
  setHideOverflowX: (v: boolean) => void
  audioIsolationModel: VoiceIsolationModel
  selectedClipId: string | null
  tool: Tool
  leftTab: LeftTab
  leftOpen: boolean
  rightOpen: boolean
  activeSubMode: string | null
  activeCategory: 'video' | '2d' | '3d' | 'all'
  contextualSubModes: { id: string; parentTab: LeftTab; label: string; icon: string }[]
  setActiveCategory: (cat: 'video' | '2d' | '3d' | 'all') => void
  openSubMode: (parentTab: LeftTab, subModeId: string, label: string, icon?: string) => void
  closeSubMode: () => void
  past: Doc[]
  future: Doc[]
  inInteraction: boolean
  snapping: boolean
  scrubbing: boolean

  // ---- drawing & paint subsystem ----
  paintLayers: PaintLayer[]
  activePaintLayerId: string
  drawingStrokes: DrawingStroke[]
  drawingTool: DrawingToolType
  drawingColor: string
  drawingSize: number
  drawingOpacity: number
  drawingScope: TemporalScope
  drawingEnabled: boolean
  pivotEditEnabled: boolean
  drawingFillTolerance: number
  drawingPreserveLuminance: boolean
  /** Number of sides for the Krita Polygon Tool, 3..12. */
  drawingPolygonSides: number
  /** Shape tools (polygon / star) fill as well as stroke. */
  drawingShapeFilled: boolean
  /** End colour of the linear gradient ramp. */
  drawingGradientColor: string
  drawingHoldFrames: number
  onionSkin: OnionSkinSettings
  activeSelection: ActiveSelection | null
  selectionMode: SelectionModeType
  setSelectionMode: (mode: SelectionModeType) => void
  recolorActiveSelection: (color: string, blend?: RecolorBlend) => void
  convertSelectionToOmniframeObject: (name?: string) => string
  setSelectionMaskDisplayMode: (mode: 'rubylith' | 'matte' | 'cutout') => void
  toggleSelectionMaskView: (showOnly?: boolean) => void
  loadAssetObjects: (assetId: string) => void

  // ---- workspace layout & focus mode ----
  workspacePreset: WorkspacePreset
  focusMode: FocusMode
  timelineHeight: number
  leftDockWidth: number
  rightPanelWidth: number
  rightPanelFloating: boolean
  rightPanelFloat: { x: number; y: number; w: number; h: number }
  leftPanelFloating: boolean
  leftPanelFloat: { x: number; y: number; w: number; h: number }
  /** Timeline folded to a thin strip (−) — + restores the previous height. */
  timelineCollapsed: boolean
  timelineFloating: boolean
  timelineFloat: { x: number; y: number; w: number; h: number }
  /** Rising z-index allocator so popped-out windows stack in click order. */
  floatZ: number
  bumpFloatZ: () => number
  sidebarSectionMode: SidebarSectionMode
  customWorkspaces: CustomWorkspace[]

  // ---- sequence & aspect ratio ----
  sequenceSettings: SequenceSettings
  setSequenceAspectRatio: (ratio: AspectRatioType, customW?: number, customH?: number) => void
  setCustomSequenceDimensions: (width: number, height: number) => void

  // ---- source vs program monitor ----
  monitorMode: MonitorMode
  sourcePreview: SourcePreviewState
  setMonitorMode: (mode: MonitorMode) => void
  setSourcePreviewAsset: (assetId: string | null) => void
  updateSourcePreview: (patch: Partial<SourcePreviewState>) => void

  // ---- insertion mode & track cleanup ----
  insertionMode: TimelineInsertionMode
  setInsertionMode: (mode: TimelineInsertionMode) => void
  closeTrackGaps: (trackId: string) => void
  cleanupEmptyTracks: () => void

  // ---- track targeting & universal gap tools ----
  /**
   * Bumped the moment a rubber-band lasso actually engages (the pointer moved
   * past the click threshold). Context menus listen for it and close, so a
   * right-drag never leaves a menu sitting over the timeline.
   */
  lassoEngagedAt: number
  markLassoEngaged: () => void
  /** Empty = every track behaves as targeted, so tools keep working universally. */
  targetedTrackIds: string[]
  toggleTrackTarget: (trackId: string) => void
  targetTrackOnly: (trackId: string) => void
  setTrackTargets: (ids: string[]) => void
  /** Returns how many gaps were closed, so callers can tell "nothing to do". */
  removeGaps: (scope?: GapScope, trackId?: string) => number
  removeGapAt: (trackId: string, gapIndex: number) => void
  gapSelectMode: boolean
  setGapSelectMode: (on: boolean) => void
  selectAllClipsInScope: (scope?: GapScope, trackId?: string) => void

  // ---- clip effects & titles ----
  setClipEffect: (id: string, effect: Partial<ClipEffect>) => void
  setClipSpeedCurve: (id: string, curve: import('./lib/speedCurves').SpeedCurveId | undefined) => void
  setClipNotes: (id: string, notes: string) => void
  customFonts: CustomFont[]
  customPalettes: ImportedPalette[]
  importCustomFontFile: (file: File) => Promise<CustomFont>
  removeCustomFont: (id: string) => void
  importPaletteFile: (file: File) => Promise<ImportedPalette>
  removeCustomPalette: (id: string) => void
  importSubtitleFile: (file: File, fontFamily?: string) => Promise<{ cues: number; trackId: string }>
  addTextTitleClip: (text?: string, duration?: number) => void

  // ---- adjustment layers & LUTs ----
  /** Built-in LUT library (public/luts/manifest.json). */
  lutLibrary: { loaded: boolean; luts: Array<{ id: string; name: string; file: string; description: string; category: string; swatch: string; tags?: string[] }> }
  /** TEMPLATE MODE: captured full processing chains (replace-video replays them). */
  templates: ClipTemplate[]
  replaceDialog: { clipId: string; assetId: string } | null
  openReplaceDialog: (clipId: string, assetId: string) => void
  closeReplaceDialog: () => void
  commitReplaceVideo: (windowStart: number, carryEffects: boolean) => void
  captureTemplate: (clipId: string, name?: string) => string | null
  applyTemplate: (templateId: string, clipId: string) => boolean
  /** Alight Motion v5 XML import (src/lib/alightXml.ts study). Also accepts
   *  OmniFrame TEMPLATE xml exports (registers the template instead). */
  importAlightXml: (xmlText: string) => { title: string; layers: number; mapped: number; unmapped: number; keyframed: number; templateId?: string }
  /** Export the whole project as Alight Motion v5 dialect XML (round-trips losslessly). */
  exportAlightXml: () => string
  /** Export a captured template as XML (full chain JSON in marked comment + AM skeleton). */
  exportTemplateXml: (templateId: string) => string | null
  /** Built-in shake pack (Shakes.xml corpus): applies the preset's fx-instance
   *  stack + keys (and transform keys) to a clip. Returns instances added. */
  applyShakePreset: (clipId: string, presetId: string) => number
  /** User-uploaded .cube LUTs (persisted to localStorage when they fit). */
  userLuts: Array<{ id: string; name: string; cubeText: string }>
  loadLutLibrary: () => Promise<void>
  addUserLut: (name: string, cubeText: string) => string | null
  removeUserLut: (id: string) => void
  clearUserLuts: () => void
  /** User-created custom effects (Gold Motion-style): named effect+LUT
   * snapshots, persisted to localStorage and inside .omni projects. */
  customEffects: CustomEffect[]
  /** Snapshot the selected clip's effect settings + LUT stack as a custom effect. Returns its id, or null when the clip has nothing to save. */
  saveCustomEffect: (name: string, clipId: string, thumbnail?: string) => string | null
  /** Replace a clip's effect settings + LUT stack with the custom effect's. */
  applyCustomEffect: (id: string, clipId?: string) => boolean
  /** Place the custom effect as an adjustment layer (grades what's below). */
  placeCustomEffectAsLayer: (id: string) => string | null
  deleteCustomEffect: (id: string) => void
  importCustomEffects: (items: CustomEffect[]) => number
  /**
   * Creates a timeline adjustment clip that grades content below its track.
   * With a visual clip selected it is placed immediately above that clip,
   * matches its time range, and stays below any higher title/overlay tracks.
   * With no visual selection it is placed above the lowest active video clip
   * at the playhead and spans the remaining content.
   */
  addAdjustmentLayer: (partial?: {
    name?: string
    start?: number
    duration?: number
    trackId?: string
    effects?: ClipEffect
    luts?: ClipLut[]
  }) => string
  /** Append a LUT to a clip's adjustment stack (creates it if needed). */
  addLutToClip: (clipId: string, lut: Omit<ClipLut, 'id'> & { id?: string }) => string
  removeLutFromClip: (clipId: string, lutId: string) => void
  setLutIntensity: (clipId: string, lutId: string, intensity: number) => void
  toggleLutEnabled: (clipId: string, lutId: string) => void
  /**
   * Universal placement: if a clip is selected, the LUT goes INSIDE that
   * clip (per-clip grade). Otherwise an adjustment layer is created on the
   * timeline at the playhead, affecting everything below it.
   */
  placeLut: (lut: { name: string; builtin?: string; cubeText?: string }) => string
  /**
   * Same layer semantics for filter effects (blur, B&W, ...): merges the
   * effect into the selected/active adjustment layer, or creates one.
   */
  placeEffectAsLayer: (name: string, effect: ClipEffect) => string

  // ---- media ----
  addAsset: (a: MediaAsset) => void
  /** Demo fixtures (test/demo loaders). Library starts EMPTY for users;
   *  fixtures seed only inside automated test rigs, or on explicit load. */
  ensureDemoAssets: () => void
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  panelMaximized: boolean
  setPanelMaximized: (v: boolean) => void
  importFiles: (files: FileList | File[]) => Promise<void>
  /** Adds one undoable generated-audio operation: assets, synchronized audio
   * tracks/clips, and optional source/stem mute changes. */
  addGeneratedAudioTracks: (
    entries: { asset: MediaAsset; clip: Omit<Clip, 'trackId'>; trackName: string }[],
    options?: { extraAssets?: MediaAsset[]; muteClipIds?: string[]; selectedClipId?: string },
  ) => { trackIds: string[]; clipIds: string[] }

  // ---- tracks / clips ----
  ensureTrack: (type: TrackType) => string
  createTrack: (type?: TrackType, position?: 'above' | 'below', referenceTrackId?: string) => string
  deleteTrack: (id: string) => void
  moveTrack: (sourceId: string, targetId: string, position: 'above' | 'below') => void
  setTrackHeight: (id: string, height: number) => void
  setTrackName: (id: string, name: string) => void
  addClipToTrack: (trackId: string, assetId: string, atTime?: number) => void
  /** Place visible raster layers from imported layered artwork as aligned still clips. */
  placeLayeredArtworkOnTimeline: (documentId: string, atTime?: number) => string[]
  /** @deprecated PSD-specific alias retained for older callers. */
  placePsdDocumentOnTimeline: (documentId: string, atTime?: number) => string[]
  moveClip: (id: string, newStart: number, newTrackId?: string) => void
  moveClipToNewTrack: (
    clipId: string,
    newStart: number,
    trackType: TrackType,
    position: 'above' | 'below',
    referenceTrackId: string,
  ) => string
  trimClip: (id: string, edge: 'left' | 'right', value: number) => void
  splitAt: (time: number) => void
  removeClip: (id: string) => void
  /** Remove every clip currently in the multi-selection (Windows-style lasso). */
  removeSelectedClips: () => number
  /** Shift the whole multi-selection in time, preserving relative offsets. */
  moveSelectedClips: (deltaTime: number, trackId?: string | null) => number
  /** Shorten/lengthen every clip in the multi-selection from one edge. */
  trimSelectedClips: (edge: 'left' | 'right', deltaSeconds: number) => number
  toggleClipHidden: (id: string) => void
  insertClipCopy: (clip: Clip, start: number) => void
  extractAudio: (id: string) => Promise<void>
  selectClip: (id: string | null) => void
  setClipProp: (id: string, partial: Partial<Clip>) => void
  setClipTransform: (id: string, partial: Partial<ClipTransform>) => void
  setClipBlend: (id: string, mode: string, time?: number) => void
  toggleTrackMute: (id: string) => void
  toggleTrackHidden: (id: string) => void
  toggleTrackLock: (id: string) => void
  toggleTrackGapless: (id: string) => void

  // ---- transitions ----
  addTransition: (params: Omit<Transition, 'id'>) => string
  updateTransition: (id: string, patch: Partial<Transition>) => void
  removeTransition: (id: string) => void
  selectTransition: (id: string | null) => void

  // ---- drawing actions ----
  addDrawingStroke: (stroke: DrawingStroke) => void
  clearDrawingStrokes: (layerId?: string) => void
  setDrawingTool: (tool: DrawingToolType) => void
  setDrawingColor: (color: string) => void
  setDrawingSize: (size: number) => void
  setDrawingOpacity: (opacity: number) => void
  setDrawingScope: (scope: TemporalScope) => void
  setDrawingEnabled: (enabled: boolean) => void
  toggleDrawingEnabled: () => void
  setPivotEditEnabled: (enabled: boolean) => void
  setDrawingFillTolerance: (tolerance: number) => void
  setDrawingPolygonSides: (sides: number) => void
  setDrawingShapeFilled: (filled: boolean) => void
  setDrawingGradientColor: (color: string) => void
  setDrawingPreserveLuminance: (preserve: boolean) => void
  createPaintLayer: (name?: string) => string
  togglePaintLayerVisibility: (layerId: string) => void
  setPaintLayerBlendMode: (layerId: string, blendMode: GlobalCompositeOperation) => void
  setPaintLayerBlur: (layerId: string, blur: number) => void
  setPaintLayerOpacity: (layerId: string, opacity: number) => void
  clearPaintLayerRasterMask: (layerId: string) => void
  setOnionSkin: (partial: Partial<OnionSkinSettings>) => void
  toggleOnionSkin: () => void
  setDrawingHoldFrames: (frames: number) => void
  stepFrame: (delta: number) => void
  setActiveSelection: (selection: ActiveSelection | null) => void
  clearSelection: () => void
  convertSelectionToMask: (layerId?: string) => void
  invertSelection: () => void
  /** Auto-brush: compute a real edge-snapped mask for the painted selection. */
  refineBrushSelectionMask: (points: { x: number; y: number }[]) => Promise<void>
  /** Real magic wand: colour-region selection from the clicked pixel. */
  setWandSelectionAt: (point: { x: number; y: number }) => Promise<void>
  setSelectionBrushAuto: (v: boolean) => void
  setSelectionBrushTolerance: (n: number) => void
  setSelectionWandTolerance: (n: number) => void
  growSelection: (pixels?: number) => void
  shrinkSelection: (pixels?: number) => void
  setSelectionFeather: (feather: number) => void

  // ---- Krita-Style Transparency Masks & Brush Dynamics ----
  activeMaskId: string | null
  brushDynamics: BrushDynamics
  addTransparencyMask: (layerId: string) => string
  removeTransparencyMask: (layerId: string) => void
  toggleTransparencyMask: (layerId: string) => void
  invertTransparencyMask: (layerId: string) => void
  setTransparencyMaskOpacity: (layerId: string, opacity: number) => void
  applyTransparencyMask: (layerId: string) => void
  setActiveMask: (maskId: string | null) => void
  /**
   * Clip masks live in the store, not in component state: they must survive
   * panel unmount, participate in undo/redo, and be readable by the renderer
   * and by tests. Keeping them in the panel meant every mask was lost as soon
   * as the tab changed.
   */
  clipMasks: ClipMask[]
  setClipMasks: (next: ClipMask[] | ((prev: ClipMask[]) => ClipMask[])) => void
  setBrushDynamics: (dynamics: Partial<BrushDynamics>) => void

  // ---- OmniFrame & Character Manipulation ----
  omniframeMode: boolean
  omniframeCharacters: OmniframeCharacter[]
  omniSelection: OmniExtractState['omniSelection']
  selectedCharacterId: string | null
  attachDirectlyToVideo: boolean
  attachedVideoClipId: string | null

  setOmniframeMode: (v: boolean) => void
  setSelectedCharacterId: (id: string | null) => void
  setOmniframeCharacterTransform: (
    charId: string,
    transform: Partial<ClipTransform>,
    scope?: OmniframeScopeType,
    sectionRange?: { start: number; end: number },
    frame?: number
  ) => void
  evaluateCharacterTransformAtTime: (charId: string, time: number) => ClipTransform
  cutCharacterToNewTrack: (charId: string) => string
  duplicateCharacter: (charId: string) => string
  removeCharacterInfill: (charId: string) => void
  deleteCharacter: (charId: string) => void
  restoreCharacter: (charId: string) => void
  resetCharacterPosition: (charId: string) => void

  setAttachDirectlyToVideo: (attach: boolean, targetClipId?: string) => void
  convertDrawingToMask: (clipId?: string, layerId?: string) => string | null
  convertMaskToSelection: (maskId: string, mode?: 'shape' | 'filled') => void

  // ---- layout actions ----
  setWorkspacePreset: (preset: WorkspacePreset) => void
  setFocusMode: (mode: FocusMode) => void
  setTimelineHeight: (height: number) => void
  setLeftDockWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setRightPanelFloating: (v: boolean) => void
  setRightPanelFloat: (patch: Partial<{ x: number; y: number; w: number; h: number }>) => void
  setLeftPanelFloating: (v: boolean) => void
  setLeftPanelFloat: (patch: Partial<{ x: number; y: number; w: number; h: number }>) => void
  setTimelineCollapsed: (v: boolean) => void
  setTimelineFloating: (v: boolean) => void
  setTimelineFloat: (patch: Partial<{ x: number; y: number; w: number; h: number }>) => void
  setSidebarSectionMode: (mode: SidebarSectionMode) => void
  saveCustomWorkspace: (name: string) => string
  applyCustomWorkspace: (id: string) => void
  deleteCustomWorkspace: (id: string) => void
  resetLayoutToDefault: () => void

  // ---- transport ----
  setPlayhead: (t: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setSpeed: (s: number) => void
  setProjectFps: (fps: number) => void
  setDropFrameTimecode: (enabled: boolean) => void
  setPreviewQuality: (quality: PreviewQuality) => void
  setAudioIsolationModel: (model: VoiceIsolationModel) => void
  setZoom: (px: number) => void
  zoomBy: (factor: number) => void
  toggleSnapping: () => void
  setScrubbing: (active: boolean) => void

  // ---- ui ----
  setTool: (t: Tool) => void
  setLeftTab: (t: LeftTab) => void
  setLeftOpen: (v: boolean) => void
  setRightOpen: (v: boolean) => void

  // Voice isolation settings modal. Lifted into the store so any surface can
  // open it; the context submenu deliberately stays a zero-popup flyout.
  voiceModal: { open: boolean; clipId?: string }
  openVoiceModal: (clipId?: string) => void
  closeVoiceModal: () => void

  // ---- settings: context menu, shortcuts, unclustering ----
  customShortcuts: Record<string, string>
  contextMenuEnabledCommands: Record<string, boolean>
  unclusterInspector: boolean
  cursorConfig: CursorConfig
  setCustomShortcut: (id: string, key: string) => void
  resetCustomShortcuts: () => void
  toggleContextMenuCommand: (id: string) => void
  setContextMenuCommand: (id: string, enabled: boolean) => void
  resetContextMenuCommands: () => void
  setUnclusterInspector: (enabled: boolean) => void
  setCursorConfig: (patch: Partial<CursorConfig>) => void
  resetCursorConfig: () => void

  // ---- CapCut-style effect instances on clips (board J) ----
  /** Currently active effect instance (selected via bar, menu or on add). */
  activeFx: { clipId: string; fxId: string } | null
  setActiveFx: (sel: { clipId: string; fxId: string } | null) => void
  /** Ask the right panel to focus a section (auto-open on effect add/select). */
  rightFocus: { id: string; nonce: number } | null
  requestRightSection: (id: string) => void
  addFxInstance: (clipId: string, catalogId: string, opts?: { inP?: number; duration?: number }) => string | null
  addFxAdjustment: (catalogId: string, opts?: { trackId?: string; start?: number; duration?: number }) => string | null
  updateFxParams: (clipId: string, fxId: string, patch: Record<string, number | string>) => void
  setFxRange: (clipId: string, fxId: string, inP?: number, duration?: number) => void
  setFxKey: (clipId: string, fxId: string, param: string, t: number, v: number) => void
  removeFxKey: (clipId: string, fxId: string, param: string, t?: number) => void
  toggleFxEnabled: (clipId: string, fxId: string) => void
  duplicateFxInstance: (clipId: string, fxId: string) => string | null
  moveFxInstance: (clipId: string, fxId: string, direction: -1 | 1) => void
  removeFxInstance: (clipId: string, fxId: string) => void
  removeActiveFx: () => void

  // ---- history ----
  beginHistory: () => void
  endHistory: () => void
  undo: () => void
  redo: () => void

  // ---- markers ----
  markers: TimelineMarker[]
  activeMarkerModalId: string | null
  setActiveMarkerModalId: (id: string | null) => void
  addMarker: (marker: Omit<TimelineMarker, 'id'>) => string
  updateMarker: (id: string, patch: Partial<TimelineMarker>) => void
  removeMarker: (id: string) => void
  clearMarkers: () => void
  jumpToMarker: (id: string) => void
  jumpToNextMarker: () => void
  jumpToPrevMarker: () => void
  /** User-saved custom marker colours (persisted), beyond the 5 kind colours. */
  markerCustomColors: string[]
  addCustomMarkerColor: (hex: string) => void
  /** Last-used marker kind, remembered so M stays one-keystroke fast. */
  lastMarkerKind: string
  setLastMarkerKind: (kind: string) => void
  addMarkersBulk: (items: Array<Omit<TimelineMarker, 'id'>>) => string[]
  /** Move timeline markers inside the clip's range ONTO the clip (range-limited, CapCut-style). Returns how many moved. */
  moveMarkersToClip: (clipId: string) => number
  /** Move a clip's markers back to the main timeline at their resolved positions. */
  moveMarkersToTimeline: (clipId: string) => number

  // ---- link sets, parenting & groups ----
  linkSets: LinkSet[]
  parentRelationships: ParentRelationship[]
  groups: GroupInstance[]
  createLinkSet: (memberIds: string[], rules?: Partial<Record<LinkRuleType, boolean>>, name?: string) => string
  removeLinkSet: (id: string) => void
  toggleLinkRule: (linkSetId: string, rule: LinkRuleType) => void
  arrangeLinkedElements: (linkSetId: string) => void
  createParentRelationship: (parentId: string, childId: string) => void
  removeParentRelationship: (childId: string) => void
  createGroup: (memberIds: string[], name?: string) => string
  removeGroup: (groupId: string) => void
  /** CapCut-style: group the current multi-selection (Ctrl+G). */
  groupSelection: () => string | null
  /** CapCut-style: dissolve every group touching the selection (Ctrl+Shift+G). */
  ungroupSelection: () => void
  /** AE Layer > New > Null Object: invisible transform-controller clip. */
  addNullObject: () => string
  /** AE motion-track workflow: bake tracker points into a NULL's position curves,
   *  then parent the art to the null (graphic keyframes stay clean). */
  bakeTrackingToNull: (sessionId?: string) => string | null

  // ---- tracking subsystem ----
  trackingSessions: TrackingSession[]
  addTrackingSession: (session: TrackingSession) => void
  updateTrackingSession: (id: string, patch: Partial<TrackingSession>) => void

  // ---- 3D materials & textures ----
  textures: TextureAsset[]
  materials: MaterialInstance[]
  shareTexture: (sourceMatId: string, targetMatId: string) => void
  makeTextureUnique: (matId: string) => void

  // ---- background removal ----
  activeBgRemovalJob: BgRemovalJob | null
  setActiveBgRemovalJob: (job: BgRemovalJob | null) => void

  // ---- guided rect background removal (draw a box → coordinate-seeded matte) ----
  guidedMatte: GuidedMatteRecord | null
  guidedMatteBusy: boolean
  runGuidedRectBackgroundRemoval: (
    rect?: { x: number; y: number; width: number; height: number },
    hint?: { x: number; y: number; radius?: number },
    destination?: 'omniframe' | 'drawing',
  ) => Promise<GuidedMatteRecord | null>
  applyGuidedMatteToDrawingLayer: (layerId?: string) => void
  clearGuidedMatte: () => void


  // ---- master audio ----
  masterVolume: number
  setMasterVolume: (vol: number) => void
  masterMuted: boolean
  setMasterMuted: (muted: boolean) => void

  // ---- clone stamp ----
  cloneSourcePoint: { x: number; y: number; sampleDataUrl?: string } | null
  setCloneSourcePoint: (pt: { x: number; y: number; sampleDataUrl?: string } | null) => void

  // ---- 3D Scene Architecture & Blender Modes ----
  is3DMode: boolean
  setIs3DMode: (active: boolean) => void
  activeBlenderMode: BlenderMode
  setActiveBlenderMode: (mode: BlenderMode) => void
  scene3DObjects: Scene3DObject[]
  selected3DObjectId: string | null
  setSelected3DObjectId: (id: string | null) => void
  addScene3DObject: (object: Scene3DObject) => void
  updateScene3DObject: (id: string, updates: Partial<Scene3DObject>) => void
  removeScene3DObject: (id: string) => void
  threeMaskMode: ThreeMaskMode
  setThreeMaskMode: (mode: ThreeMaskMode) => void
  threeMaskTargetKind: ThreeMaskTargetKind
  setThreeMaskTargetKind: (kind: ThreeMaskTargetKind) => void
  threeMaskSelection: ThreeMaskSelection | null
  setThreeMaskSelection: (selection: ThreeMaskSelection | null) => void
  clearThreeMaskSelection: () => void
  useThreeMaskSelectionInDrawing: () => void

  // ---- Graph Editor & Keyframing System ----
  graphEditorOpen: boolean
  setGraphEditorOpen: (open: boolean) => void
  graphEditorMode: 'value' | 'speed'
  setGraphEditorMode: (mode: 'value' | 'speed') => void
  activeCurveProperty: string
  setActiveCurveProperty: (propId: string) => void
  setClipKeyframe: (clipId: string, propertyId: string, time: number, value: number, interpolation?: InterpolationType) => void
  removeClipKeyframe: (clipId: string, propertyId: string, keyframeId: string) => void
  updateClipKeyframe: (clipId: string, propertyId: string, keyframeId: string, updates: Partial<KeyframeNode>) => void
  setCurveExtrapolation: (clipId: string, propertyId: string, before: ExtrapolationMode, after: ExtrapolationMode) => void

  // ---- compound clips & sequence hierarchy ----
  sequences: Sequence[]
  activeSequenceId: string
  breadcrumbs: { id: string; name: string }[]
  selectedClipIds: string[]
  createCompoundClip: (clipIds?: string[], name?: string) => string | null
  uncompoundClip: (compoundClipId: string) => boolean
  openSequence: (sequenceId: string) => void
  navigateBreadcrumb: (sequenceId: string) => void
  selectClips: (ids: string[]) => void
  toggleClipSelection: (id: string, multi?: boolean) => void

  // ---- project ----
  newProject: () => void
  recomputeDuration: () => void
}

function makeTrack(type: TrackType, name: string): Track {
  return {
    id: uid('trk'),
    type,
    name,
    muted: false,
    hidden: false,
    locked: false,
    gapless: false,
    height: type === 'video' ? 64 : 48,
  }
}

/**
 * Invariant I-01: Ordinary clips on the same track must NEVER overlap in time.
 * In INSERT mode (default): Any clip on targetTrack that overlaps or starts after insertStart is pushed right.
 */
function resolveSameTrackRipple(
  allClips: Clip[],
  movingClipId: string | null,
  targetTrackId: string,
  insertStart: number,
  insertDuration: number,
  mode: TimelineInsertionMode = 'insert',
): Clip[] {
  const insertEnd = insertStart + insertDuration
  if (mode === 'overwrite') {
    return allClips.flatMap((c) => {
      if (c.trackId !== targetTrackId || c.id === movingClipId) return [c]
      const cEnd = c.start + c.duration
      if (cEnd <= insertStart || c.start >= insertEnd) return [c]
      if (c.start >= insertStart && cEnd <= insertEnd) return []
      if (c.start < insertStart && cEnd > insertEnd) {
        const left: Clip = { ...c, duration: insertStart - c.start }
        const right: Clip = {
          ...c,
          id: uid('clip'),
          start: insertEnd,
          duration: cEnd - insertEnd,
          inPoint: c.inPoint + (insertEnd - c.start),
        }
        return [left, right]
      }
      if (c.start < insertStart) {
        return [{ ...c, duration: insertStart - c.start }]
      }
      return [{
        ...c,
        start: insertEnd,
        duration: cEnd - insertEnd,
        inPoint: c.inPoint + (insertEnd - c.start),
      }]
    })
  }

  // INSERT mode (default):
  return allClips.map((c) => {
    if (c.trackId !== targetTrackId || c.id === movingClipId) return c
    // If the clip overlaps with or starts at/after insertStart:
    if (c.start + c.duration > insertStart + 0.0001) {
      if (c.start >= insertStart) {
        return { ...c, start: c.start + insertDuration }
      } else {
        // Starts before insertStart and spans across insertStart
        return { ...c, start: insertEnd }
      }
    }
    return c
  })
}

/**
 * Resolves a media asset into something drawable on a canvas.
 * Images decode directly; video draws the frame at the current playhead.
 */
async function loadDrawableSource(
  asset: MediaAsset,
): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null
  if (asset.kind === 'image') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = asset.url
    if (img.complete && img.naturalWidth > 0) return img
    return await new Promise((resolve) => {
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
    })
  }
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  video.src = asset.url
  const ready = await new Promise<boolean>((resolve) => {
    video.onloadeddata = () => resolve(true)
    video.onerror = () => resolve(false)
    setTimeout(() => resolve(false), 2500)
  })
  if (!ready) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || asset.width || 1920
  canvas.height = video.videoHeight || asset.height || 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const st = useEditor.getState()
  const clip = st.clips.find((c) => c.assetId === asset.id)
  const target = Math.max(0, Math.min((video.duration || 0) - 0.05, clip ? st.playhead - clip.start + clip.inPoint : 0))
  try {
    video.currentTime = target
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      setTimeout(() => resolve(), 1200)
    })
  } catch {
    /* seek unsupported — use the first decoded frame */
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

export const DEMO_ASSETS = [
  {
    id: 'asset-death-note-vid',
    name: 'Death Note Chibi - 5 Characters.mp4',
    kind: 'video',
    url: '/death_note_video.mp4',
    duration: 8.0,
    width: 1672,
    height: 940,
    fps: 30,
    size: 1548200,
  },
  {
    id: 'asset-death-note-img',
    name: 'Death Note Chibi - 5 Characters.jfif',
    kind: 'image',
    url: '/death_note_composite.jfif',
    duration: 5.0,
    width: 1672,
    height: 941,
    size: 158400,
  },
  {
    id: 'asset-room-chair-towel',
    name: 'Room Leather Chair & Towel (Real Photo).jpg',
    kind: 'image',
    url: '/room_chair_towel.jpg',
    duration: 5.0,
    width: 1448,
    height: 1086,
    size: 384000,
  },
] as MediaAsset[]

export const useEditor = create<EditorState>((set, get) => {
  let maskUndoAt = 0
  let maskUndoClipId = ''
  const pushSnapshot = () => {
    const snap = cloneDoc(get())
    set((s) => ({ past: [...s.past.slice(-49), snap], future: [] }))
  }

  const recompute = (clips: Clip[]) => {
    let d = 0
    for (const c of clips) d = Math.max(d, c.start + c.duration)
    return Math.max(d, 5)
  }

  return {
    // Library starts empty. The three demo fixtures below exist for the
    // OmniFrame region-edit demo loaders and the automated QA rigs
    // (navigator.webdriver); real users import their own media.
    assets: typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver ? DEMO_ASSETS : [],
    sourceDocuments: [],
    customFonts: [],
    customPalettes: [],
    projectName: 'Untitled',
    saveOmniProject: async (name) => buildOmniProjectBundle(get(), name || get().projectName),
    setProjectName: (name) => set({ projectName: name.trim() || 'Untitled' }),
    loadOmniProject: async (file) => {
      const loaded = await parseOmniProjectBundle(file)
      set({
        ...loaded.state as Partial<EditorState>,
        projectName: loaded.projectName,
        playing: false,
        visualPreview: null,
        scrubbing: false,
        inInteraction: false,
        rotoBusy: false,
        guidedMatteBusy: false,
        mediaImportNotice: null,
        past: [],
        future: [],
      })
      // Fonts travel inside the bundle; re-register them with the document.
      void registerAllCustomFonts(get().customFonts || [])
    },
    mediaImportNotice: null,
    tracks: [],
    clips: [],
    transitions: [],
    lutLibrary: { loaded: false, luts: [] },
    templates: [],
    replaceDialog: null,
    customEffects: (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('omniframe.customEffects') : null
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
          .filter((fx) => fx && typeof fx.id === 'string' && typeof fx.name === 'string')
          .map((fx) => ({ ...fx, effect: sanitizeEffect(fx.effect), luts: sanitizeLuts(fx.luts) }))
      } catch {
        return []
      }
    })(),
    userLuts: (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('omniframe.userLuts') : null
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.cubeText === 'string') : []
      } catch {
        return []
      }
    })(),
    selectedTransitionId: null,
    visualPreview: null,
    maskEditClipId: null,
    playhead: 0,
    duration: 10,
    pxPerSec: 100,
    playing: false,
    speed: 1,
    projectFps: 30,
    sequenceBackground: '#000000',
    dropFrameTimecode: false,
    previewQuality: typeof localStorage !== 'undefined' && ['low', 'medium', 'high', 'full'].includes(localStorage.getItem('omniframe.previewQuality') ?? '') ? localStorage.getItem('omniframe.previewQuality') as PreviewQuality : 'high',
    hideOverflowX: typeof localStorage === 'undefined' ? true : localStorage.getItem('omniframe.hideOverflowX') !== 'no',
    transformToolMode: 'free', liquifyTool: 'push', liquifyRadius: .15, liquifyStrength: .65,
    uiStyle: typeof localStorage === 'undefined' ? 'omniframe' : (localStorage.getItem('omniframe.uiStyle') || 'omniframe'),
    uiPalette: typeof localStorage === 'undefined' ? 'flame' : (localStorage.getItem('omniframe.uiPalette') || 'flame'),
    aiProvider: typeof localStorage === 'undefined' ? 'openrouter' : (localStorage.getItem('omniframe.aiProvider') || 'openrouter'),
    aiModel: typeof localStorage === 'undefined' ? 'openai/gpt-4o-mini' : (localStorage.getItem('omniframe.aiModel') || 'openai/gpt-4o-mini'),
    aiEndpoint: typeof localStorage === 'undefined' ? '' : (localStorage.getItem('omniframe.aiEndpoint') || ''),
    aiApiKey: '',
    aiCapabilityModels: (() => { try { return JSON.parse(localStorage.getItem('omniframe.aiCapabilityModels') || '{}') } catch { return {} } })(),
    aiConnection: { status: 'idle', message: '', latencyMs: null, modelAvailable: null, at: 0 },
    watermarks: (() => { try { return JSON.parse(localStorage.getItem('omniframe.watermarks') || '[]') } catch { return [] } })(),
    viewVideosAsLayers: false,
    dockerPrefs: (() => {
      try {
        const raw = localStorage.getItem('omniframe.dockerPrefs')
        if (raw) {
          const parsed = JSON.parse(raw)
          return { leftTabs: parsed.leftTabs || {}, rightSubtools: parsed.rightSubtools || {} }
        }
      } catch { /* private mode / bad json */ }
      return { leftTabs: {}, rightSubtools: {} }
    })(),
    drawingSectionRequest: null,
    compoundWindow: null,
    exportRange: null,
    audioIsolationModel: 'omni-voicetarget',
    selectedClipId: null,
    selectedClipIds: [],
    activeFx: null,
    rightFocus: null,
    sequences: [],
    activeSequenceId: 'main',
    breadcrumbs: [{ id: 'main', name: 'Main Timeline' }],
    tool: 'select',
    leftTab: 'media',
    leftOpen: true,
    rightOpen: true,
    activeSubMode: null,
    activeCategory: 'all',
    contextualSubModes: [],
    past: [],
    future: [],
    inInteraction: false,
    snapping: true,
    scrubbing: false,

    // ---- settings: context menu, shortcuts, unclustering initial state ----
    customShortcuts: { ...DEFAULT_SHORTCUTS },
    contextMenuEnabledCommands: { ...DEFAULT_CONTEXT_COMMANDS },
    unclusterInspector: false,
    cursorConfig: { ...DEFAULT_CURSOR_CONFIG },

    // ---- OmniFrame & Character Manipulation initial state ----
    omniframeMode: false,
    omniframeCharacters: INITIAL_DEATH_NOTE_CHARACTERS,
    omniSelection: null,
    selectedCharacterId: 'char_light',
    attachDirectlyToVideo: true,
    attachedVideoClipId: null,

    // ---- link sets, parenting & groups initial state ----
    linkSets: [],
    parentRelationships: [],
    groups: [],

    // ---- tracking subsystem initial state ----
    trackingSessions: [],

    // ---- 3D materials & textures initial state ----
    textures: [
      {
        id: 'tex-default-grid',
        name: 'UV Grid 2K',
        width: 2048,
        height: 2048,
        usersCount: 1,
        colorSpace: 'srgb',
      },
    ],
    materials: [
      {
        id: 'mat-default',
        name: 'Default Studio Material',
        textureId: 'tex-default-grid',
        color: '#f59e0b',
        roughness: 0.3,
        metalness: 0.1,
        usersCount: 1,
      },
    ],

    // ---- background removal initial state ----
    activeBgRemovalJob: null,
    guidedMatte: null,
    guidedMatteBusy: false,

    // ---- 3D scene & Blender modes initial state ----
    is3DMode: false,
    setIs3DMode: (active) => set({ is3DMode: active }),
    activeBlenderMode: 'object',
    setActiveBlenderMode: (mode) => set({ activeBlenderMode: mode }),
    scene3DObjects: [
      {
        id: '3d-wheel-1',
        name: '3D Wheel',
        type: 'wheel',
        position: { x: 2.5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#8b5cf6',
        wireframe: false,
        roughness: 0.25,
        metalness: 0.8,
      },
    ],
    selected3DObjectId: '3d-wheel-1',
    setSelected3DObjectId: (id) => set({ selected3DObjectId: id }),
    addScene3DObject: (obj) => {
      pushSnapshot()
      set((s) => ({ scene3DObjects: [...s.scene3DObjects, obj], selected3DObjectId: obj.id }))
    },
    updateScene3DObject: (id, updates) => {
      set((s) => ({
        scene3DObjects: s.scene3DObjects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      }))
    },
    removeScene3DObject: (id) => {
      pushSnapshot()
      set((s) => ({
        scene3DObjects: s.scene3DObjects.filter((o) => o.id !== id),
        selected3DObjectId: s.selected3DObjectId === id ? (s.scene3DObjects[0]?.id || null) : s.selected3DObjectId,
      }))
    },
    threeMaskMode: 'off',
    setThreeMaskMode: (mode) => set({ threeMaskMode: mode }),
    threeMaskTargetKind: 'geometry',
    setThreeMaskTargetKind: (kind) => set({ threeMaskTargetKind: kind }),
    threeMaskSelection: null,
    setThreeMaskSelection: (selection) => set({ threeMaskSelection: selection }),
    clearThreeMaskSelection: () => set({ threeMaskSelection: null }),
    useThreeMaskSelectionInDrawing: () => {
      const selection = get().threeMaskSelection
      if (!selection) return
      const x = clamp(selection.bounds.x, 0, 1)
      const y = clamp(selection.bounds.y, 0, 1)
      const width = clamp(selection.bounds.width, 0, 1 - x)
      const height = clamp(selection.bounds.height, 0, 1 - y)
      if (width < 0.005 || height < 0.005) return

      set({
        activeSelection: {
          type: 'rectangle',
          bounds: { x, y, width, height },
          characterName: selection.targetName,
          showMaskOnly: false,
          maskDisplayMode: 'cutout',
        },
        selectionMode: 'rect',
        drawingTool: 'select-rect',
        drawingEnabled: true,
        leftTab: 'drawing',
        leftOpen: true,
        activeSubMode: null,
        is3DMode: false,
        threeMaskMode: 'off',
      })
    },

    // ---- Graph Editor & Keyframing System ----
    graphEditorOpen: false,
    setGraphEditorOpen: (open) => set({ graphEditorOpen: open }),
    graphEditorMode: 'value',
    setGraphEditorMode: (mode) => set({ graphEditorMode: mode }),
    activeCurveProperty: 'rotation_z',
    setActiveCurveProperty: (propId) => set({ activeCurveProperty: propId }),

    setClipKeyframe: (clipId, propertyId, time, value, interpolation = 'bezier') => {
      pushSnapshot()
      set((s) => {
        const clips = s.clips.map((clip) => {
          if (clip.id !== clipId) return clip
          const anim = clip.animation || createDefaultClipAnimation(clip.transform, clip.duration)
          const curve = anim.curves[propertyId] || {
            id: propertyId,
            property: propertyId,
            channel: 'Scalar',
            label: propertyId,
            color: '#38bdf8',
            defaultValue: value,
            keyframes: [],
            extrapolationBefore: 'constant',
            extrapolationAfter: 'constant',
          }
          const { curve: updatedCurve } = addOrUpdateKeyframe(curve, time, value, interpolation)
          return {
            ...clip,
            animation: {
              ...anim,
              curves: {
                ...anim.curves,
                [propertyId]: updatedCurve,
              },
            },
          }
        })
        return { clips }
      })
    },

    removeClipKeyframe: (clipId, propertyId, keyframeId) => {
      pushSnapshot()
      set((s) => {
        const clips = s.clips.map((clip) => {
          if (clip.id !== clipId || !clip.animation) return clip
          const curve = clip.animation.curves[propertyId]
          if (!curve) return clip
          const updatedCurve = removeKeyframe(curve, keyframeId)
          return {
            ...clip,
            animation: {
              ...clip.animation,
              curves: {
                ...clip.animation.curves,
                [propertyId]: updatedCurve,
              },
            },
          }
        })
        return { clips }
      })
    },

    updateClipKeyframe: (clipId, propertyId, keyframeId, updates) => {
      set((s) => {
        const clips = s.clips.map((clip) => {
          if (clip.id !== clipId || !clip.animation) return clip
          const curve = clip.animation.curves[propertyId]
          if (!curve) return clip
          const keys = curve.keyframes.map((k) => (k.id === keyframeId ? { ...k, ...updates } : k))
          keys.sort((a, b) => a.time - b.time)
          return {
            ...clip,
            animation: {
              ...clip.animation,
              curves: {
                ...clip.animation.curves,
                [propertyId]: { ...curve, keyframes: keys },
              },
            },
          }
        })
        return { clips }
      })
    },

    setCurveExtrapolation: (clipId, propertyId, before, after) => {
      set((s) => {
        const clips = s.clips.map((clip) => {
          if (clip.id !== clipId || !clip.animation) return clip
          const curve = clip.animation.curves[propertyId]
          if (!curve) return clip
          return {
            ...clip,
            animation: {
              ...clip.animation,
              curves: {
                ...clip.animation.curves,
                [propertyId]: { ...curve, extrapolationBefore: before, extrapolationAfter: after },
              },
            },
          }
        })
        return { clips }
      })
    },

    // ---- sequence & aspect ratio state ----
    sequenceSettings: {
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      label: '16:9 Landscape (1920×1080)',
      isCustom: false,
    },

    // ---- source vs program monitor state ----
    monitorMode: 'program',
    sourcePreview: {
      assetId: null,
      playing: false,
      currentTime: 0,
      volume: 1,
      muted: false,
      playbackRate: 1,
      zoom: 1,
      pan: { x: 0, y: 0 },
    },

    // ---- insertion mode ----
    insertionMode: 'insert',
    // Universal gap tools + track targeting (see ./store/gapTools.ts).
    ...createGapToolsSlice(set, get, { pushSnapshot, recompute }),
    ...createOmniframeCharacterSlice(set, get, { pushSnapshot }),
    ...createOmniExtractSlice(set, get, { pushSnapshot }),
    // RotoMask: click-to-segment rotoscoping (see ./store/rotoMask.ts).
    ...createRotoMaskSlice(set, get, { pushSnapshot }),
    ...createSmartPatchSlice(set, get, pushSnapshot),
    rotoModelId: 'smart',
    rotoImportedModels: [],
    rotoStatus: { state: 'idle', message: 'Smart engine ready - no model needed' },
    rotoClicks: [],
    rotoResult: null,
    rotoBusy: false,
    rotoScope: { mode: 'current', start: 0, end: 2, step: 1 },
    rotoFrames: [],
    rotoTracking: { running: false, done: 0, total: 0 },
    rotoInpaint: {
      phase: 'idle',
      done: 0,
      total: 0,
      message: '',
      candidates: [],
      selectedDonorFrame: null,
      targetFrames: [],
      donorByTarget: [],
      maskGrow: 4,
      donorDirection: 'both',
      donorWindow: 0,
    },
    rotoTool: null,
    rotoTolerance: 26,
    rotoBrushRadius: 24,
    rotoLumaExport: null,
    // Character rigging: named parts joined by a parent/child skeleton.
    ...createRiggingSlice(set, get, { pushSnapshot }),
    lassoEngagedAt: 0,

    // ---- drawing initial state ----
    paintLayers: [
      { id: 'default-paint-layer', name: 'Paint 1', visible: true, locked: false, opacity: 1 },
    ],
    activePaintLayerId: 'default-paint-layer',
    drawingStrokes: [],
    drawingTool: 'brush',
    drawingColor: '#f59e0b',
    drawingSize: 6,
    drawingOpacity: 1,
    drawingScope: { type: 'global' },
    drawingEnabled: false,
    pivotEditEnabled: false,
    drawingFillTolerance: 32,
    drawingPreserveLuminance: false,
    drawingPolygonSides: 5,
    drawingShapeFilled: false,
    drawingGradientColor: '#00000000',
    drawingHoldFrames: 1,
    onionSkin: {
      enabled: false,
      beforeFrames: 1,
      afterFrames: 1,
      opacity: 0.35,
      tintBefore: '#ef4444',
      tintAfter: '#10b981',
      tintStrength: 1,
    },
    activeSelection: null,
    selectionMode: 'rect',
    selectionBrushAuto: true,
    selectionBrushTolerance: 26,
    selectionWandTolerance: 24,
    activeMaskId: null,
    clipMasks: [
      {
        id: 'mask-1',
        clipId: '',
        name: 'Mask 1 (Subject)',
        shapeType: 'rectangle',
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.75, y: 0.25 },
          { x: 0.75, y: 0.75 },
          { x: 0.25, y: 0.75 },
        ],
        inverted: false,
        feather: 4,
        expansion: 0,
        opacity: 1,
        applyToAllFrames: true,
      },
    ],
    brushDynamics: {
      pressureSize: true,
      pressureOpacity: false,
      pressureFlow: false,
      smoothingMode: 'smooth',
      stabilizerRadius: 30,
    },

    // ---- layout initial state ----
    workspacePreset: 'default',
    focusMode: 'none',
    timelineHeight: 280,
    leftDockWidth: 320,
    rightPanelWidth: 280,
    rightPanelFloating: false,
    rightPanelFloat: { x: 0, y: 0, w: 340, h: 560 },
    leftPanelFloating: false,
    leftPanelFloat: { x: 0, y: 0, w: 380, h: 560 },
    timelineCollapsed: false,
    timelineFloating: false,
    timelineFloat: { x: 0, y: 0, w: 900, h: 380 },
    floatZ: 70,
    sidebarSectionMode: 'tabs',
    customWorkspaces: (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('omniframe.customWorkspaces') : null
        return raw ? JSON.parse(raw) : []
      } catch {
        return []
      }
    })(),

    // ---- sequence aspect ratio actions ----
    setSequenceAspectRatio: (ratio, customW, customH) => {
      const preset = RATIO_PRESETS.find((p) => p.id === ratio)
      if (preset && ratio !== 'custom' && ratio !== 'source') {
        set({
          sequenceSettings: {
            aspectRatio: ratio,
            width: preset.width,
            height: preset.height,
            fps: 30,
            label: `${preset.label} (${preset.width}×${preset.height})`,
            isCustom: false,
          },
        })
      } else if (ratio === 'source') {
        const primaryAsset = get().assets.find((a) => a.width && a.height)
        const w = primaryAsset?.width || 1920
        const h = primaryAsset?.height || 1080
        set({
          sequenceSettings: {
            aspectRatio: 'source',
            width: w,
            height: h,
            fps: 30,
            label: `Source (${w}×${h})`,
            isCustom: false,
          },
        })
      } else if (ratio === 'custom') {
        const w = Math.max(64, Math.min(7680, customW || get().sequenceSettings.width || 1920))
        const h = Math.max(64, Math.min(7680, customH || get().sequenceSettings.height || 1080))
        set({
          sequenceSettings: {
            aspectRatio: 'custom',
            width: w,
            height: h,
            fps: 30,
            label: `Custom (${w}×${h})`,
            isCustom: true,
          },
        })
      }
    },

    setCustomSequenceDimensions: (width, height) => {
      const w = Math.max(64, Math.min(7680, width))
      const h = Math.max(64, Math.min(7680, height))
      set({
        sequenceSettings: {
          aspectRatio: 'custom',
          width: w,
          height: h,
          fps: 30,
          label: `Custom (${w}×${h})`,
          isCustom: true,
        },
      })
    },

    // ---- monitor mode actions ----
    setMonitorMode: (mode) => set({ monitorMode: mode }),

    setSourcePreviewAsset: (assetId) => {
      set((s) => ({
        monitorMode: 'source',
        sourcePreview: {
          ...s.sourcePreview,
          assetId,
          currentTime: 0,
          playing: false,
        },
      }))
    },

    updateSourcePreview: (patch) => {
      set((s) => ({
        sourcePreview: { ...s.sourcePreview, ...patch },
      }))
    },

    // ---- timeline insertion mode & track cleanup ----
    setInsertionMode: (mode) => set({ insertionMode: mode }),

    closeTrackGaps: (trackId) => {
      pushSnapshot()
      set((s) => {
        const trackClips = s.clips
          .filter((c) => c.trackId === trackId)
          .sort((a, b) => a.start - b.start)
        if (trackClips.length === 0) return {}

        let currentCursor = 0
        const updatedMap = new Map<string, number>()
        for (const c of trackClips) {
          updatedMap.set(c.id, currentCursor)
          currentCursor += c.duration
        }

        const newClips = s.clips.map((c) =>
          updatedMap.has(c.id) ? { ...c, start: updatedMap.get(c.id)! } : c,
        )

        return {
          clips: newClips,
          duration: recompute(newClips),
        }
      })
    },

    markLassoEngaged: () => set((s) => ({ lassoEngagedAt: s.lassoEngagedAt + 1 })),

    cleanupEmptyTracks: () => {
      set((s) => {
        const remainingTracks = TimelineController.purgeEmptyTracks(s.tracks, s.clips)
        if (remainingTracks.length === s.tracks.length) return {}
        return { tracks: remainingTracks }
      })
    },

    setClipSpeedCurve: (id, curve) => {
      set(st => ({
        clips: st.clips.map(c => (c.id === id ? { ...c, speedCurve: curve } : c)),
      }))
    },
    setClipEffect: (id, effect) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, effects: { ...c.effects, ...effect } } : c,
        ),
      }))
    },

    setClipNotes: (id: string, notes: string) => {
      set((s) => ({
        clips: s.clips.map((c) => (c.id === id ? { ...c, notes } : c)),
      }))
    },
    importCustomFontFile: async (file) => {
      const format = fontFormatFromFileName(file.name)
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
        throw new Error('That file is not a font - pick a .ttf, .otf, .woff or .woff2 file.')
      }
      const MAX_FONT_BYTES = 16 * 1024 * 1024
      if (file.size > MAX_FONT_BYTES) {
        throw new Error(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB - fonts up to 16 MB can be embedded in a project.`)
      }
      const dataUrl = await readFileAsDataUrl(file)
      const font: CustomFont = {
        id: uid('font'),
        name: fontFamilyFromFileName(file.name),
        fileName: file.name,
        format,
        sizeBytes: dataUrlByteSize(dataUrl) || file.size,
        dataUrl,
        importedAt: Date.now(),
      }
      const registered = await registerCustomFont(font)
      if (!registered) {
        throw new Error(`"${file.name}" could not be loaded as a font - the file may be corrupt or an unsupported variant.`)
      }
      set((s) => ({ customFonts: [...s.customFonts.filter((f) => f.name !== font.name), font] }))
      try {
        const list = JSON.parse(localStorage.getItem('omniframe.customFonts') || '[]') as { name: string; dataUrl: string }[]
        localStorage.setItem('omniframe.customFonts', JSON.stringify([...list.filter((f) => f.name !== font.name), { name: font.name, dataUrl }]))
      } catch { /* storage full/blocked: project save still embeds the font */ }
      return font
    },
    removeCustomFont: (id) => {
      const font = get().customFonts.find((f) => f.id === id)
      if (font) unregisterCustomFont(font.name)
      set((s) => ({ customFonts: s.customFonts.filter((f) => f.id !== id) }))
    },
    importPaletteFile: async (file) => {
      const text = await file.text()
      const parsed = parsePalette(text, file.name)
      if (!parsed) {
        throw new Error('No colours could be read - use a GIMP .gpl, JASC .pal, or JSON palette file.')
      }
      const palette: ImportedPalette = {
        id: uid('palette'),
        name: parsed.name,
        colors: parsed.colors.slice(0, 512),
        source: file.name,
        importedAt: Date.now(),
      }
      set((s) => ({ customPalettes: [...s.customPalettes.filter((pl) => pl.name !== palette.name), palette] }))
      return palette
    },
    removeCustomPalette: (id) => {
      set((s) => ({ customPalettes: s.customPalettes.filter((pl) => pl.id !== id) }))
    },
    importSubtitleFile: async (file, fontFamily) => {
      const text = await file.text()
      const cues = parseSubtitles(text, file.name).slice(0, 1000)
      if (cues.length === 0) {
        throw new Error('No subtitle cues found - use a SubRip .srt or WebVTT .vtt file.')
      }
      pushSnapshot()
      const trackName = `${file.name.replace(/\.(srt|vtt)$/i, '').trim() || 'Captions'} - Captions`
      const track = { ...makeTrack('video', trackName), height: 44 }
      const newClips: Clip[] = cues.map((cue, idx) => ({
        id: uid('clip-caption'),
        trackId: track.id,
        assetId: '',
        start: cue.start,
        duration: Math.max(0.4, cue.end - cue.start),
        inPoint: 0,
        name: cue.text.split('\n')[0].slice(0, 60) || `Caption ${idx + 1}`,
        kind: 'text',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 250, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
        textStyle: {
          text: cue.text,
          fontSize: 30,
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.65)',
          fontFamily: fontFamily || 'sans-serif',
          bold: false,
          italic: false,
        },
      }))
      set((s) => ({
        tracks: [track, ...s.tracks],
        clips: [...s.clips, ...newClips],
        selectedClipId: newClips[0].id,
        selectedClipIds: [newClips[0].id],
      }))
      return { cues: newClips.length, trackId: track.id }
    },

    // ---- custom effects (user-built, shareable) ----------------------
    saveCustomEffect: (name, clipId, thumbnail) => {
      const clip = get().clips.find((c) => c.id === clipId)
      if (!clip) return null
      const effect = sanitizeEffect(clip.effects)
      const luts = sanitizeLuts(clip.adjustment?.luts)
      const hasEffect = Object.keys(effect).length > 0
      if (!hasEffect && !luts.length) return null
      const fx: CustomEffect = {
        id: `fx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim().slice(0, 80) || 'My effect',
        effect,
        ...(luts.length ? { luts } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        createdAt: Date.now(),
      }
      const next = [fx, ...get().customEffects]
      set({ customEffects: next })
      try {
        localStorage.setItem('omniframe.customEffects', JSON.stringify(next))
      } catch { /* quota: still kept in memory + .omni */ }
      return fx.id
    },

    applyCustomEffect: (id, clipId) => {
      const fx = get().customEffects.find((f) => f.id === id)
      const targetId = clipId ?? get().selectedClipId
      if (!fx || !targetId) return false
      const clip = get().clips.find((c) => c.id === targetId)
      if (!clip) return false
      const luts = sanitizeLuts(fx.luts)
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === targetId
            ? { ...c, effects: sanitizeEffect(fx.effect), adjustment: { ...(c.adjustment ?? { luts: [] }), luts } }
            : c,
        ),
      }))
      return true
    },

    placeCustomEffectAsLayer: (id) => {
      const fx = get().customEffects.find((f) => f.id === id)
      if (!fx) return null
      return get().addAdjustmentLayer({
        name: fx.name,
        effects: sanitizeEffect(fx.effect),
        luts: sanitizeLuts(fx.luts),
      })
    },

    deleteCustomEffect: (id) => {
      const next = get().customEffects.filter((f) => f.id !== id)
      set({ customEffects: next })
      try {
        localStorage.setItem('omniframe.customEffects', JSON.stringify(next))
      } catch { /* ignore */ }
    },

    importCustomEffects: (items) => {
      if (!items.length) return 0
      const next = [...items, ...get().customEffects]
      set({ customEffects: next })
      try {
        localStorage.setItem('omniframe.customEffects', JSON.stringify(next))
      } catch { /* quota: kept in memory */ }
      return items.length
    },

    // ---- adjustment layers & LUTs ------------------------------------
    openReplaceDialog: (clipId, assetId) => set({ replaceDialog: { clipId, assetId } }),
    closeReplaceDialog: () => set({ replaceDialog: null }),
    commitReplaceVideo: (windowStart, carryEffects) => {
      const dlg = get().replaceDialog
      if (!dlg) return
      const clip = get().clips.find((c) => c.id === dlg.clipId)
      const asset = get().assets.find((a) => a.id === dlg.assetId)
      if (!clip || !asset) { set({ replaceDialog: null }); return }
      const patch = replaceVideoPatch(clip, asset.id, asset.duration || clip.duration, windowStart, carryEffects)
      const partial: Partial<Clip> = { assetId: patch.assetId, inPoint: patch.inPoint, duration: patch.duration, name: asset.name }
      for (const k of patch.cleared) (partial as Record<string, unknown>)[k] = undefined
      get().setClipProp(clip.id, partial)
      set({ replaceDialog: null })
    },
    captureTemplate: (clipId, name) => {
      const clip = get().clips.find((c) => c.id === clipId)
      if (!clip) return null
      const t = captureClipTemplate(clip, name || `Template ${clip.name}`)
      set((st) => ({ templates: [...st.templates, t] }))
      return t.id
    },
    applyTemplate: (templateId, clipId) => {
      const t = get().templates.find((x) => x.id === templateId || x.name === templateId)
      const clip = get().clips.find((c) => c.id === clipId)
      if (!t || !clip) return false
      get().setClipProp(clip.id, templatePatch(t, clip.duration) as Partial<Clip>)
      return true
    },
    importAlightXml: (xmlText) => {
      const tmpl = importTemplateXml(xmlText)
      if (tmpl) {
        set((st) => ({ templates: st.templates.some((x) => x.id === tmpl.id) ? st.templates : [...st.templates, tmpl as ClipTemplate] }))
        return { title: tmpl.name, layers: 0, mapped: 0, unmapped: 0, keyframed: 0, templateId: tmpl.id }
      }
      const imp = alightToImport(parseAlightXml(xmlText))
      get().setProjectName(imp.project.title)
      get().setCustomSequenceDimensions(imp.project.w, imp.project.h)
      get().setProjectFps(imp.project.fps)
      const trackId = get().ensureTrack('video')
      let layers = 0
      for (const c of imp.clips) {
        if (c.kind === 'null') continue
        // rasterise the AM layer to an image asset (solid/text/media placeholder);
        // AM media refs are content:// device uris — re-link by replacing the
        // clip footage afterwards (replace_video carries the whole AM chain).
        const cv = document.createElement('canvas')
        cv.width = Math.max(2, Math.round(imp.project.w))
        cv.height = Math.max(2, Math.round(imp.project.h))
        const x = cv.getContext('2d')
        if (!x) continue
        if (c.kind === 'text') {
          x.fillStyle = c.fillColor || '#ffffff'
          x.font = `700 ${Math.round(cv.height * 0.12)}px sans-serif`
          x.textAlign = 'center'; x.textBaseline = 'middle'
          x.fillText(c.text || c.name, cv.width / 2, cv.height / 2, cv.width * 0.9)
        } else if (c.kind === 'solid') {
          x.fillStyle = c.fillColor || '#333344'
          x.fillRect(0, 0, cv.width, cv.height)
        } else {
          x.fillStyle = '#1b1b26'; x.fillRect(0, 0, cv.width, cv.height)
          x.strokeStyle = '#4a4a63'; x.strokeRect(4, 4, cv.width - 8, cv.height - 8)
          x.fillStyle = '#9999bb'; x.font = `${Math.round(cv.height * 0.05)}px sans-serif`; x.textAlign = 'center'
          x.fillText('AM media (re-link)', cv.width / 2, cv.height / 2 - 10)
          x.font = `${Math.round(cv.height * 0.035)}px sans-serif`
          x.fillText(c.name.slice(0, 60), cv.width / 2, cv.height / 2 + 14, cv.width * 0.9)
        }
        const url = cv.toDataURL('image/png')
        const asset: MediaAsset = { id: uid('am'), name: c.name, kind: 'image', url, duration: c.duration, width: cv.width, height: cv.height, size: url.length }
        get().addAsset(asset)
        get().addClipToTrack(trackId, asset.id, c.start)
        const clipId = get().selectedClipId
        if (!clipId) continue
        layers++
        const patch: Partial<Clip> = {
          start: c.start, duration: c.duration, name: c.name, volume: c.volume,
          transform: { x: c.x, y: c.y, scale: c.scale || 1, rotation: c.rotation, opacity: c.opacity },
        }
        if (Object.keys(c.effects).length) patch.effects = c.effects as Clip['effects']
        get().setClipProp(clipId, patch)
        // keyframed transform channels → app CurveEngine (cubicBezier → custom points)
        const chans: Array<[string, Array<{ time: number; value: number; points?: Array<[number, number]> }>]> = [
          ['position_x', c.keys.positionX], ['position_y', c.keys.positionY],
          ['scale_x', c.keys.scale], ['scale_y', c.keys.scale],
          ['rotation_z', c.keys.rotation], ['opacity', c.keys.opacity],
        ]
        const clip = get().clips.find((cc) => cc.id === clipId)
        const anim = clip?.animation ? JSON.parse(JSON.stringify(clip.animation)) as ClipAnimation : createDefaultClipAnimation({ x: c.x, y: c.y, z: 0, scale: c.scale || 1, rotation: c.rotation, opacity: c.opacity, pivotX: 0.5, pivotY: 0.5 }, c.duration)
        let touched = false
        for (const [curveId, keys] of chans) {
          if (!keys || keys.length < 2 || !anim.curves[curveId]) continue
          let curve = anim.curves[curveId]
          for (const k of keys) {
            const r = addOrUpdateKeyframe(curve, +k.time.toFixed(3), k.value, k.points ? 'custom' : 'linear')
            if (k.points) r.keyframe.points = [[0, 0], ...k.points, [1, 1]].map(([px, py]) => ({ x: px, y: py }))
            curve = r.curve; touched = true
          }
          anim.curves[curveId] = curve
        }
        if (touched) get().setClipProp(clipId, { animation: anim })
      }
      return { title: imp.project.title, layers, mapped: imp.stats.mapped, unmapped: imp.stats.unmapped, keyframed: imp.stats.keyframed }
    },
    exportAlightXml: () => {
      const st = get()
      const w = st.sequenceSettings.width
      const h = st.sequenceSettings.height
      const clips: AlightExportClip[] = st.clips
        .filter((c) => c.kind !== 'audio' && c.kind !== 'adjustment')
        .map((c) => {
          const asset = st.assets.find((a) => a.id === c.assetId)
          const curves: Record<string, AlightExportKey[]> = {}
          if (c.animation) {
            for (const id of ['position_x', 'position_y', 'scale_x', 'rotation_z', 'opacity'] as const) {
              const cv = c.animation.curves[id]
              if (cv && cv.keyframes.length > 1) {
                curves[id] = cv.keyframes.map((k) => ({ time: k.time, value: k.value, points: k.points ? k.points.map((p) => ({ x: p.x, y: p.y })) : undefined }))
              }
            }
          }
          const kind: AlightExportClip['kind'] = c.kind === 'text' || c.textStyle?.text ? 'text' : c.kind === 'video' || asset?.kind === 'video' ? 'video' : asset?.kind === 'image' ? 'image' : 'solid'
          return {
            name: c.name, kind, start: c.start, duration: c.duration, inPoint: c.inPoint,
            x: c.transform.x, y: c.transform.y, scale: c.transform.scale, rotation: c.transform.rotation,
            opacity: c.transform.opacity, volume: c.volume,
            text: c.textStyle?.text, fontFamily: c.textStyle?.fontFamily, fontSize: c.textStyle?.fontSize, color: c.textStyle?.color,
            fillColor: kind === 'solid' ? '#334455' : undefined,
            mediaRef: asset?.url || asset?.name,
            effects: c.effects as Record<string, number | string> | undefined,
            luts: c.adjustment?.luts?.map((l) => ({ builtin: l.builtin, id: l.id, intensity: l.intensity })),
            fxInstances: c.fxInstances?.map((f) => ({ catalogId: f.catalogId, inP: f.inP, duration: f.duration, params: f.params, keys: f.keys })),
            curves,
          }
        })
      return buildAlightXml({ title: st.projectName, w, h, fps: st.sequenceSettings.fps, duration: Math.max(st.duration, 1) }, clips)
    },
    exportTemplateXml: (templateId) => {
      const t = get().templates.find((x) => x.id === templateId || x.name === templateId)
      if (!t) return null
      const ss = get().sequenceSettings
      return buildTemplateXml(t, { w: ss.width, h: ss.height, fps: ss.fps })
    },
    applyShakePreset: (clipId, presetId) => {
      const p = shakePresetById(presetId)
      const clip = get().clips.find((c) => c.id === clipId)
      if (!p || !clip) return 0
      let added = 0
      for (const inst of p.instances) {
        const fxId = get().addFxInstance(clipId, inst.catalogId, { inP: 0, duration: Math.min(p.duration, clip.duration) })
        if (!fxId) continue
        added++
        if (Object.keys(inst.params).length) get().updateFxParams(clipId, fxId, inst.params)
        for (const [param, keys] of Object.entries(inst.keys || {})) {
          for (const k of keys) get().setFxKey(clipId, fxId, param, Math.min(k.t, p.duration), k.v)
        }
      }
      for (const [prop, keys] of Object.entries(p.transformKeys || {})) {
        const curveId = prop === 'scale' ? 'scale_x' : 'rotation_z'
        for (const k of keys || []) get().setClipKeyframe(clipId, curveId, Math.min(k.t, clip.duration), k.v, 'linear')
        if (prop === 'scale') for (const k of keys || []) get().setClipKeyframe(clipId, 'scale_y', Math.min(k.t, clip.duration), k.v, 'linear')
      }
      return added
    },
    loadLutLibrary: async () => {
      if (get().lutLibrary.loaded) return
      try {
        const res = await fetch('/luts/manifest.json')
        if (!res.ok) throw new Error(String(res.status))
        const manifest = await res.json()
        set({ lutLibrary: { loaded: true, luts: manifest.luts || [] } })
      } catch {
        // keep loaded=false so panels can show an honest error
      }
    },

    addUserLut: (name, cubeText) => {
      // validate before storing (throws -> null for invalid .cube files)
      try {
        parseCubeLUT(cubeText)
      } catch {
        return null
      }
      const entry = { id: `user-lut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name, cubeText }
      set((s) => ({ userLuts: [...s.userLuts, entry] }))
      try {
        localStorage.setItem('omniframe.userLuts', JSON.stringify(get().userLuts))
      } catch {
        // quota exceeded — LUT stays in memory for this session only
      }
      return entry.id
    },

    removeUserLut: (id) => {
      set((s) => ({ userLuts: s.userLuts.filter((l) => l.id !== id) }))
      try {
        localStorage.setItem('omniframe.userLuts', JSON.stringify(get().userLuts))
      } catch { /* ignore */ }
    },

    clearUserLuts: () => {
      set({ userLuts: [] })
      try {
        localStorage.removeItem('omniframe.userLuts')
      } catch { /* ignore */ }
    },

    addAdjustmentLayer: (partial = {}) => {
      pushSnapshot()
      const s = get()
      const contentEnd = s.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      const selected = s.clips.find((c) => c.id === s.selectedClipId)
      const selectedIsVisual =
        !!selected &&
        selected.kind !== 'adjustment' &&
        selected.kind !== 'audio' &&
        selected.kind !== 'text' &&
        !selected.textStyle
      const selectedAnchor = selectedIsVisual ? selected : undefined
      const start = Math.max(0, partial.start ?? selectedAnchor?.start ?? s.playhead)
      const duration = Math.max(
        0.5,
        partial.duration ?? selectedAnchor?.duration ?? Math.max(2, contentEnd - start),
      )

      // Tracks are stored top-to-bottom; the compositor draws them bottom-up.
      // Put the new adjustment immediately above its target base clip. That
      // makes it affect that clip and tracks below, while titles/overlays on
      // higher tracks stay clean. Without a selected base clip, choose the
      // lowest active non-adjustment visual at the playhead.
      const trackIndex = (trackId: string) => s.tracks.findIndex((t) => t.id === trackId)
      const activeVideoClips = s.clips.filter((c) => {
        const track = s.tracks.find((t) => t.id === c.trackId)
        return (
          track?.type === 'video' &&
          !track.hidden &&
          !c.hidden &&
          c.kind !== 'adjustment' &&
          s.playhead >= c.start &&
          s.playhead < c.start + c.duration
        )
      })
      const activeBaseClip = activeVideoClips
        .filter((c) => c.kind !== 'text' && !c.textStyle)
        .sort((a, b) => trackIndex(b.trackId) - trackIndex(a.trackId))[0]
      const activeTextClip = activeVideoClips
        .filter((c) => c.kind === 'text' || !!c.textStyle)
        .sort((a, b) => trackIndex(b.trackId) - trackIndex(a.trackId))[0]
      const anchor = selectedAnchor || activeBaseClip

      let tracks = s.tracks
      let targetTrackId = partial.trackId || ''
      if (!targetTrackId) {
        const anchorIndex = anchor ? trackIndex(anchor.trackId) : -1
        const textTrackIndex = activeTextClip ? trackIndex(activeTextClip.trackId) + 1 : -1
        const bottomVideoIndex = s.tracks.reduce(
          (last, track, index) => (track.type === 'video' ? index : last),
          -1,
        )
        // If there is only a title at the playhead, place the layer underneath
        // it rather than grading the title itself.
        const insertAt = anchorIndex >= 0
          ? anchorIndex
          : textTrackIndex >= 0
            ? textTrackIndex
            : bottomVideoIndex >= 0
              ? bottomVideoIndex
              : 0
        const videoCount = s.tracks.filter((t) => t.type === 'video').length
        const layerTrack = makeTrack('video', `V${videoCount + 1}`)
        tracks = [...s.tracks]
        tracks.splice(insertAt, 0, layerTrack)
        targetTrackId = layerTrack.id
      }

      const id = `clip-adjustment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const lutCount = partial.luts?.length || 0
      const clip: Clip = {
        id,
        trackId: targetTrackId,
        assetId: '',
        start,
        duration,
        inPoint: 0,
        name:
          partial.name ||
          (lutCount ? `Adjustment: ${partial.luts!.map((l) => l.name).join(' + ')}` : 'Adjustment Layer'),
        kind: 'adjustment',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
        effects: partial.effects,
        adjustment: partial.luts?.length ? { luts: partial.luts } : undefined,
      }
      set((st) => {
        const clips = [...st.clips, clip]
        return {
          tracks,
          clips,
          selectedClipId: id,
          selectedClipIds: [id],
          duration: recompute(clips),
        }
      })
      return id
    },

    addLutToClip: (clipId, lut) => {
      pushSnapshot()
      const lutId = lut.id || `clip-lut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      set((s) => ({
        clips: s.clips.map((c) => {
          if (c.id !== clipId) return c
          const luts = [...(c.adjustment?.luts || []), { ...lut, id: lutId }]
          const renamed =
            c.kind === 'adjustment' && (!c.name || c.name === 'Adjustment Layer')
              ? { name: `Adjustment: ${luts.map((l) => l.name).join(' + ')}` }
              : {}
          return { ...c, ...renamed, adjustment: { luts } }
        }),
      }))
      return lutId
    },

    removeLutFromClip: (clipId, lutId) => {
      pushSnapshot()
      set((s) => ({
        clips: s.clips.map((c) => {
          if (c.id !== clipId || !c.adjustment) return c
          const luts = c.adjustment.luts.filter((l) => l.id !== lutId)
          return { ...c, adjustment: luts.length ? { luts } : undefined }
        }),
      }))
    },

    setLutIntensity: (clipId, lutId, intensity) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId && c.adjustment
            ? {
                ...c,
                adjustment: {
                  luts: c.adjustment.luts.map((l) =>
                    l.id === lutId ? { ...l, intensity: Math.max(0, Math.min(1, intensity)) } : l,
                  ),
                },
              }
            : c,
        ),
      }))
    },

    toggleLutEnabled: (clipId, lutId) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId && c.adjustment
            ? {
                ...c,
                adjustment: {
                  luts: c.adjustment.luts.map((l) => (l.id === lutId ? { ...l, enabled: !l.enabled } : l)),
                },
              }
            : c,
        ),
      }))
    },

    placeLut: (lut) => {
      const s = get()
      const selected = s.clips.find((c) => c.id === s.selectedClipId)
      const clipLut: Omit<ClipLut, 'id'> = {
        name: lut.name,
        builtin: lut.builtin,
        cubeText: lut.cubeText,
        intensity: 1,
        enabled: true,
      }
      // Selected clip (any visual kind, incl. compound): LUT goes INSIDE it.
      if (selected && selected.kind !== 'audio' && selected.kind !== 'adjustment') {
        const clipId = selected.id
        get().addLutToClip(clipId, clipLut)
        get().selectClip(clipId)
        return clipId
      }
      // Selected adjustment layer: stack onto it.
      if (selected && selected.kind === 'adjustment') {
        get().addLutToClip(selected.id, clipLut)
        return selected.id
      }
      // Nothing selected: reuse an adjustment layer already active at the
      // playhead (topmost), else create one.
      const playhead = s.playhead
      const active = s.clips
        .filter(
          (c) =>
            c.kind === 'adjustment' &&
            playhead >= c.start &&
            playhead < c.start + c.duration &&
            !c.hidden,
        )
        .sort((a, b) => {
          const ai = s.tracks.findIndex((t) => t.id === a.trackId)
          const bi = s.tracks.findIndex((t) => t.id === b.trackId)
          return ai - bi
        })[0]
      if (active) {
        get().addLutToClip(active.id, clipLut)
        get().selectClip(active.id)
        return active.id
      }
      const layerId = get().addAdjustmentLayer({ luts: [{ ...clipLut, id: `clip-lut-${Date.now().toString(36)}` }] })
      return layerId
    },

    placeEffectAsLayer: (name, effect) => {
      const s = get()
      const selected = s.clips.find((c) => c.id === s.selectedClipId)
      // Explicitly selecting an adjustment clip means "add to this layer".
      // With no selection, reuse the layer already covering the playhead.
      // Selecting ordinary media instead creates a separate timeline layer
      // above that clip (and below any existing titles or overlays).
      const activeAdjustment = selected
        ? undefined
        : s.clips
            .filter(
              (c) =>
                c.kind === 'adjustment' &&
                s.playhead >= c.start &&
                s.playhead < c.start + c.duration &&
                !c.hidden,
            )
            .sort((a, b) => {
              const ai = s.tracks.findIndex((t) => t.id === a.trackId)
              const bi = s.tracks.findIndex((t) => t.id === b.trackId)
              return ai - bi
            })[0]
      const target = selected?.kind === 'adjustment' ? selected : activeAdjustment
      if (target) {
        pushSnapshot()
        set((st) => ({
          clips: st.clips.map((c) =>
            c.id === target.id
              ? {
                  ...c,
                  name: c.name === 'Adjustment Layer' ? `Adjustment: ${name}` : c.name,
                  effects: { ...c.effects, ...effect },
                }
              : c,
          ),
          selectedClipId: target.id,
          selectedClipIds: [target.id],
        }))
        return target.id
      }
      return get().addAdjustmentLayer({ name: `Adjustment: ${name}`, effects: effect })
    },

    addTextTitleClip: (text = 'Title', duration = 4.0) => {
      pushSnapshot()
      const existingVideoTracks = get().tracks.filter((t) => t.type === 'video')
      const baseTrackId = existingVideoTracks[0]?.id || get().ensureTrack('video')
      const start = Math.max(0, get().playhead)

      // If base track already has a clip overlapping at playhead, overlay on a separate track
      let targetTrackId = baseTrackId
      const hasBaseOverlap = get().clips.some(
        (c) => c.trackId === baseTrackId && !(c.start + c.duration <= start || c.start >= start + duration),
      )

      if (hasBaseOverlap) {
        const availableTrack = existingVideoTracks.find(
          (t) =>
            t.id !== baseTrackId &&
            !get().clips.some(
              (c) => c.trackId === t.id && !(c.start + c.duration <= start || c.start >= start + duration),
            ),
        )
        if (availableTrack) {
          targetTrackId = availableTrack.id
        } else {
          targetTrackId = get().createTrack('video', 'above', baseTrackId)
        }
      }

      const clipId = uid('text')
      const clip: Clip = {
        id: clipId,
        trackId: targetTrackId,
        assetId: 'text-asset',
        start,
        duration,
        inPoint: 0,
        name: text,
        kind: 'text',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        textStyle: {
          text,
          fontSize: 48,
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          fontFamily: 'sans-serif',
          bold: true,
        },
      }
      set((s) => {
        const clips = [...s.clips, clip]
        return { clips, selectedClipId: clip.id, duration: recompute(clips) }
      })
    },

    addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),
    ensureDemoAssets: () => set((s) => ({ assets: [...s.assets, ...DEMO_ASSETS.filter((d) => !s.assets.some((a) => a.id === d.id))] })),
    helpOpen: false,
    setHelpOpen: (v) => set({ helpOpen: v }),
    panelMaximized: false,
    setPanelMaximized: (v) => set({ panelMaximized: v }),
    clearMediaImportNotice: () => set({ mediaImportNotice: null }),

    addGeneratedAudioTracks: (entries, options = {}) => {
      if (entries.length === 0 && !(options.extraAssets?.length)) {
        return { trackIds: [], clipIds: [] }
      }
      pushSnapshot()
      const tracks = entries.map((entry) => makeTrack('audio', entry.trackName))
      const newClips = entries.map((entry, index): Clip => ({
        ...entry.clip,
        trackId: tracks[index].id,
      }))
      const mutedIds = new Set(options.muteClipIds || [])
      set((s) => {
        const clips = [
          ...s.clips.map((clip) => mutedIds.has(clip.id) ? { ...clip, volume: 0 } : clip),
          ...newClips,
        ]
        return {
          assets: [...s.assets, ...(options.extraAssets || []), ...entries.map((entry) => entry.asset)],
          tracks: [...s.tracks, ...tracks],
          clips,
          selectedClipId: options.selectedClipId ?? newClips[newClips.length - 1]?.id ?? s.selectedClipId,
          duration: recompute(clips),
        }
      })
      return { trackIds: tracks.map((track) => track.id), clipIds: newClips.map((clip) => clip.id) }
    },

    importFiles: async (files) => {
      const list = Array.from(files as ArrayLike<File>)
      set({ mediaImportNotice: null })
      for (const file of list) {
        try {
          if (/\.omni$/i.test(file.name)) {
            await get().loadOmniProject(file)
            set({ mediaImportNotice: `Opened OmniFrame project “${file.name}”; project state and embedded media were restored.` })
            continue
          }

          if (/\.psd$/i.test(file.name) || (!/\.psb$/i.test(file.name) && file.type === 'image/vnd.adobe.photoshop')) {
            const result = await importPsdDocument(file)
            const sourceDocument = sourceDocumentFromFile(file, result.sourceDocumentId)
            set((s) => ({
              assets: [...s.assets, ...result.assets],
              sourceDocuments: [...s.sourceDocuments, sourceDocument],
            }))
            set({ mediaImportNotice: result.notice })
            // PSD import adds either its supported raster layers or one saved
            // flattened composite to the library only; the user explicitly
            // chooses which artwork to place/rig next.
            if (result.assets[0]) get().setSourcePreviewAsset(result.assets[0].id)
            continue
          }

          if (/\.(?:ora|kra)$/i.test(file.name)) {
            const { importArtworkArchive } = await import('./lib/layeredArtworkImport')
            const result = await importArtworkArchive(file)
            const sourceDocument = sourceDocumentFromFile(file, result.sourceDocumentId)
            set((s) => ({
              assets: [...s.assets, ...result.assets],
              sourceDocuments: [...s.sourceDocuments, sourceDocument],
            }))
            set({ mediaImportNotice: result.notice })
            if (result.assets[0]) get().setSourcePreviewAsset(result.assets[0].id)
            continue
          }

          if (/\.(?:psb|xcf|clip|cmc|procreate|afphoto|afdesign|pdn|mdp|rif|ai)$/i.test(file.name)) {
            const extension = file.name.split('.').pop()?.toLowerCase() || ''
            const sourceApp: Record<string, string> = {
              psb: 'Photoshop PSB', xcf: 'GIMP', clip: 'Clip Studio Paint', cmc: 'Clip Studio Paint',
              procreate: 'Procreate', afphoto: 'Affinity Photo', afdesign: 'Affinity Designer',
              pdn: 'Paint.NET', mdp: 'FireAlpaca/MediBang', rif: 'Corel Painter', ai: 'Adobe Illustrator',
            }
            const conversion = extension === 'xcf'
              ? 'Export as OpenRaster (.ora) for its supported raster subset, or PNG for a flat render.'
              : extension === 'ai'
                ? 'Export a checked PDF, SVG, or PNG from Illustrator; fonts, links, live effects, and native editability are not transferred.'
                : 'Export PNG for a flat render, or PSD/ORA only when the source app offers it; verify that export in the source application before relying on its layers.'
            throw new Error(`${sourceApp[extension] || 'This application'} native files are not safely decoded as complete projects. ${conversion}`)
          }

          const asset = await readMediaFile(file)
          if (!asset) continue
          get().addAsset(asset)
          // Invariant I-10: Media import adds to project library ONLY.
          // It does NOT insert into timeline. Loads into Source Monitor for preview.
          get().setSourcePreviewAsset(asset.id)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set({ mediaImportNotice: `Could not import “${file.name}”: ${message}` })
        }
      }
    },

    ensureTrack: (type) => {
      const existing = get().tracks.find((t) => t.type === type && !t.locked)
      if (existing) return existing.id
      return get().createTrack(type)
    },

    createTrack: (type = 'video', position = 'above', referenceTrackId) => {
      pushSnapshot()
      const existing = get().tracks
      const sameTypeCount = existing.filter((t) => t.type === type).length + 1
      const prefix = type === 'video' ? 'V' : 'A'
      const newTrack = makeTrack(type, `${prefix}${sameTypeCount}`)

      if (!referenceTrackId) {
        if (type === 'video') {
          // New video track created above existing video tracks
          set((s) => ({ tracks: [newTrack, ...s.tracks] }))
        } else {
          // Audio tracks append to bottom
          set((s) => ({ tracks: [...s.tracks, newTrack] }))
        }
        return newTrack.id
      }

      const refIdx = existing.findIndex((t) => t.id === referenceTrackId)
      if (refIdx === -1) {
        set((s) => ({ tracks: [...s.tracks, newTrack] }))
        return newTrack.id
      }

      const insertIdx = position === 'above' ? refIdx : refIdx + 1
      const updated = [...existing]
      updated.splice(insertIdx, 0, newTrack)
      set({ tracks: updated })
      return newTrack.id
    },

    deleteTrack: (id) => {
      pushSnapshot()
      set((s) => {
        const tracks = s.tracks.filter((t) => t.id !== id)
        const clips = s.clips.filter((c) => c.trackId !== id)
        const transitions = (s.transitions || []).filter((tr) => tr.trackId !== id)
        return {
          tracks,
          clips,
          transitions,
          selectedClipId: s.selectedClipId && clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : null,
          duration: recompute(clips),
        }
      })
    },

    moveTrack: (sourceId, targetId, position) => {
      if (sourceId === targetId) return
      pushSnapshot()
      const list = [...get().tracks]
      const srcIdx = list.findIndex((t) => t.id === sourceId)
      const tgtIdx = list.findIndex((t) => t.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) return
      const [item] = list.splice(srcIdx, 1)
      const newTgtIdx = list.findIndex((t) => t.id === targetId)
      const insIdx = position === 'above' ? newTgtIdx : newTgtIdx + 1
      list.splice(insIdx, 0, item)
      set({ tracks: list })
    },

    setTrackHeight: (id, height) => {
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === id ? { ...t, height: clamp(height, 28, 160) } : t)),
      }))
    },

    setTrackName: (id, name) => {
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === id ? { ...t, name } : t)),
      }))
    },

    moveClipToNewTrack: (clipId, newStart, trackType, position, referenceTrackId) => {
      pushSnapshot()
      const existing = get().tracks
      const sameTypeCount = existing.filter((t) => t.type === trackType).length + 1
      const prefix = trackType === 'video' ? 'V' : 'A'
      const newTrack = makeTrack(trackType, `${prefix}${sameTypeCount}`)

      const refIdx = existing.findIndex((t) => t.id === referenceTrackId)
      const insertIdx = refIdx === -1
        ? (trackType === 'video' ? 0 : existing.length)
        : (position === 'above' ? refIdx : refIdx + 1)

      const updatedTracks = [...existing]
      updatedTracks.splice(insertIdx, 0, newTrack)

      const updatedClips = get().clips.map((c) =>
        c.id === clipId ? { ...c, trackId: newTrack.id, start: Math.max(0, newStart) } : c,
      )

      set({
        tracks: updatedTracks,
        clips: updatedClips,
        selectedClipId: clipId,
        duration: recompute(updatedClips),
      })
      return newTrack.id
    },

    addTransition: (params) => {
      pushSnapshot()
      const id = uid('trans')
      const newTrans: Transition = { ...params, id }
      set((s) => ({
        transitions: [...(s.transitions || []), newTrans],
        selectedTransitionId: id, selectedClipId: null, selectedClipIds: [],
        ...(params.type.startsWith('device_') ? { rightOpen: true } : {}),
      }))
      return id
    },

    updateTransition: (id, patch) => {
      if (!get().transitions.some(t => t.id === id)) return
      if (!get().inInteraction) pushSnapshot()
      set((s) => ({
        transitions: (s.transitions || []).map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)),
      }))
    },

    removeTransition: (id) => {
      pushSnapshot()
      set((s) => ({
        transitions: (s.transitions || []).filter((tr) => tr.id !== id),
        selectedTransitionId: s.selectedTransitionId === id ? null : s.selectedTransitionId,
      }))
    },

    selectTransition: (id) => {
      set({ selectedTransitionId: id, selectedClipId: id ? null : get().selectedClipId, ...(id ? {rightOpen:true} : {}) })
    },

    addClipToTrack: (trackId, assetId, atTime) => {
      const asset = get().assets.find((a) => a.id === assetId)
      const track = get().tracks.find((t) => t.id === trackId)
      if (!asset || !track || track.locked) return
      const expectedType: TrackType = asset.kind === 'audio' ? 'audio' : 'video'
      if (track.type !== expectedType) return
      pushSnapshot()

      const start = Math.max(0, atTime ?? get().playhead)
      const duration = asset.kind === 'image' ? 5 : asset.duration || 5
      const clip: Clip = {
        id: uid('clip'),
        trackId,
        assetId,
        start,
        duration,
        inPoint: 0,
        name: asset.name,
        kind: asset.kind,
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }

      // Ripple shift any overlapping/downstream clips on target track (Invariant I-01)
      const rippled = resolveSameTrackRipple(
        get().clips,
        null,
        trackId,
        start,
        duration,
        get().insertionMode,
      )

      set((s) => {
        const clips = [...rippled, clip]
        return { clips, selectedClipId: clip.id, duration: recompute(clips) }
      })
    },

    placeLayeredArtworkOnTimeline: (documentId, atTime) => {
      const state = get()
      const layers = state.assets
        .map((asset) => ({ asset, meta: getLayeredArtworkInfo(asset) }))
        .filter((entry) => entry.asset.kind === 'image' && entry.meta?.documentId === documentId)
        .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0))
      if (layers.length === 0) return []

      const start = Math.max(0, atTime ?? state.playhead)
      // Keep the still layers synchronized as a single static composite.
      const duration = Math.max(...layers.map(({ asset }) => asset.duration || 5))
      const tracks = layers.map(({ asset, meta }) => {
        const layerName = meta?.layerName || asset.name
        return makeTrack('video', `${(meta?.sourceFormat || 'artwork').toUpperCase()} · ${layerName}`)
      })
      const clips: Clip[] = layers.map(({ asset, meta }, index) => ({
        id: uid('clip'),
        trackId: tracks[index].id,
        assetId: asset.id,
        start,
        duration,
        inPoint: 0,
        name: meta?.layerName || asset.name,
        kind: asset.kind,
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }))

      // Source layer order is front-to-back. New tracks keep that order at the
      // top; playback reverses tracks so the front layer composites last.
      pushSnapshot()
      set((s) => {
        const nextClips = [...s.clips, ...clips]
        return {
          tracks: [...tracks, ...s.tracks],
          clips: nextClips,
          selectedClipId: clips[0].id,
          selectedClipIds: clips.map((clip) => clip.id),
          monitorMode: 'program',
          duration: recompute(nextClips),
        }
      })
      return clips.map((clip) => clip.id)
    },

    placePsdDocumentOnTimeline: (documentId, atTime) =>
      get().placeLayeredArtworkOnTimeline(documentId, atTime),

    moveClip: (id, newStart, newTrackId) => {
      const current = get().clips.find((c) => c.id === id)
      if (!current || get().tracks.find((t) => t.id === current.trackId)?.locked) return
      const targetTrackId = newTrackId ?? current.trackId
      if (get().tracks.find((t) => t.id === targetTrackId)?.locked) return

      const safeStart = Math.max(0, newStart)
      const delta = safeStart - current.start

      const activeLinkSet = get().linkSets?.find((ls) => ls.memberIds.includes(id) && ls.rules.motion)
      const linkedIds = activeLinkSet ? new Set(activeLinkSet.memberIds) : null

      // Ripple shift any overlapping/downstream clips on target track (Invariant I-01)
      const rippled = resolveSameTrackRipple(
        get().clips,
        id,
        targetTrackId,
        safeStart,
        current.duration,
        get().insertionMode,
      )

      set((s) => {
        const clips = rippled.map((c) => {
          if (c.id === id) {
            return { ...c, start: safeStart, trackId: targetTrackId }
          }
          if (linkedIds && linkedIds.has(c.id)) {
            return { ...c, start: Math.max(0, c.start + delta) }
          }
          return c
        })
        return { clips, duration: recompute(clips) }
      })

      if (newTrackId && newTrackId !== current.trackId) {
        get().cleanupEmptyTracks()
      }
    },

    trimClip: (id, edge, value) => {
      const current = get().clips.find((c) => c.id === id)
      if (!current || get().tracks.find((t) => t.id === current.trackId)?.locked) return
      set((s) => {
        const clips = s.clips.map((c) => {
          if (c.id !== id) return c
          const asset = s.assets.find((a) => a.id === c.assetId)
          const srcMax = asset ? asset.duration : c.duration
          // The fx container closes on trim: instances shift/re-clamp with it.
          const reclampFx = (shift: number, dur: number) =>
            (c.fxInstances || [])
              .map((f) => {
                const r = clampFxToClip(f.inP + shift, f.duration, dur)
                return { ...f, inP: r.inP, duration: r.duration }
              })
              .filter((f) => f.duration >= FX_MIN_DUR - 1e-9)
          if (edge === 'left') {
            const maxStart = c.start + c.duration - MIN_CLIP
            const newStart = Math.min(maxStart, Math.max(0, value))
            const delta = newStart - c.start
            const newIn = Math.max(0, c.inPoint + delta)
            const newDur = c.duration - (newIn - c.inPoint)
            if (newDur < MIN_CLIP) return c
            return { ...c, start: newStart, inPoint: newIn, duration: newDur, fxInstances: c.fxInstances ? reclampFx(-delta, newDur) : c.fxInstances }
          } else {
            const newDur = clamp(value - c.start, MIN_CLIP, (srcMax || c.duration) - c.inPoint)
            return { ...c, duration: newDur, fxInstances: c.fxInstances ? reclampFx(0, newDur) : c.fxInstances }
          }
        })
        return { clips, duration: recompute(clips) }
      })
    },

    splitAt: (time) => {
      const clips = get().clips
      const toSplit = clips.filter((c) =>
        !get().tracks.find((t) => t.id === c.trackId)?.locked &&
        time > c.start + 0.001 && time < c.start + c.duration - 0.001,
      )
      if (toSplit.length === 0) return
      pushSnapshot()
      const newClips: Clip[] = []
      for (const c of clips) {
        if (!toSplit.find((s) => s.id === c.id)) {
          newClips.push(c)
          continue
        }
        const offset = time - c.start
        const fx = c.fxInstances?.length ? splitFxInstances(c.fxInstances, offset) : null
        const left: Clip = { ...c, duration: offset, fxInstances: fx ? fx.left : c.fxInstances }
        const right: Clip = {
          ...c,
          id: uid('clip'),
          start: time,
          duration: c.duration - offset,
          inPoint: c.inPoint + offset,
          fxInstances: fx ? fx.right : c.fxInstances,
        }
        newClips.push(left, right)
      }
      set((s) => ({ clips: newClips, duration: recompute(newClips) }))
    },

    removeClip: (id) => {
      const current = get().clips.find((c) => c.id === id)
      if (!current || get().tracks.find((t) => t.id === current.trackId)?.locked) return
      pushSnapshot()
      set((s) => {
        const activeLinkSet = s.linkSets?.find((ls) => ls.memberIds.includes(id) && ls.rules.delete)
        const targetIds = new Set(activeLinkSet ? activeLinkSet.memberIds : [id])

        const track = s.tracks.find((item) => item.id === current.trackId)
        const removedEnd = current.start + current.duration
        const clips = s.clips
          .filter((c) => !targetIds.has(c.id))
          .map((clip) => track?.gapless && clip.trackId === current.trackId && clip.start >= removedEnd
            ? { ...clip, start: Math.max(current.start, clip.start - current.duration) }
            : clip)
        const transitions = (s.transitions || []).filter(
          (tr) => !targetIds.has(tr.fromClipId) && !targetIds.has(tr.toClipId),
        )

        const linkSets = (s.linkSets || [])
          .map((ls) => ({ ...ls, memberIds: ls.memberIds.filter((m) => !targetIds.has(m)) }))
          .filter((ls) => ls.memberIds.length > 1)

        const parentRelationships = (s.parentRelationships || []).filter(
          (pr) => !targetIds.has(pr.childId) && !targetIds.has(pr.parentId),
        )

        const groups = (s.groups || [])
          .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => !targetIds.has(m)) }))
          .filter((g) => g.memberIds.length > 0)

        const selectedClipId =
          s.selectedClipId && targetIds.has(s.selectedClipId) ? null : s.selectedClipId

        // Deleting a converted drawing clip returns its strokes to the
        // live drawing pass (they were never destroyed by conversion).
        const drawingStrokes = s.drawingStrokes.some((st) => st.convertedClipId && targetIds.has(st.convertedClipId))
          ? s.drawingStrokes.map((st) => (st.convertedClipId && targetIds.has(st.convertedClipId) ? { ...st, convertedClipId: undefined } : st))
          : s.drawingStrokes

        return {
          clips,
          drawingStrokes,
          transitions,
          linkSets,
          parentRelationships,
          groups,
          selectedClipId,
          duration: recompute(clips),
        }
      })
      // Safely cleanup user-created tracks that became empty
      get().cleanupEmptyTracks()
    },

    removeSelectedClips: () => {
      const s = get()
      const ids = (s.selectedClipIds.length ? s.selectedClipIds : s.selectedClipId ? [s.selectedClipId] : []).filter(
        (id) => s.clips.some((c) => c.id === id),
      )
      if (ids.length === 0) return 0

      pushSnapshot()
      const lockedTrackIds = new Set(s.tracks.filter((t) => t.locked).map((t) => t.id))
      const targetIds = new Set(ids.filter((id) => {
        const c = s.clips.find((cl) => cl.id === id)
        return c && !lockedTrackIds.has(c.trackId)
      }))
      if (targetIds.size === 0) return 0

      set((st) => {
        const clips = st.clips.filter((c) => !targetIds.has(c.id))
        const transitions = (st.transitions || []).filter(
          (tr) => !targetIds.has(tr.fromClipId) && !targetIds.has(tr.toClipId),
        )
        const linkSets = (st.linkSets || [])
          .map((ls) => ({ ...ls, memberIds: ls.memberIds.filter((m) => !targetIds.has(m)) }))
          .filter((ls) => ls.memberIds.length > 1)
        const parentRelationships = (st.parentRelationships || []).filter(
          (pr) => !targetIds.has(pr.childId) && !targetIds.has(pr.parentId),
        )
        const groups = (st.groups || [])
          .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => !targetIds.has(m)) }))
          .filter((g) => g.memberIds.length > 0)
        return {
          clips,
          transitions,
          linkSets,
          parentRelationships,
          groups,
          selectedClipId: null,
          selectedClipIds: [],
          duration: recompute(clips),
        }
      })
      get().cleanupEmptyTracks()
      return targetIds.size
    },

    moveSelectedClips: (deltaTime, trackId) => {
      const s = get()
      const ids = (s.selectedClipIds.length ? s.selectedClipIds : s.selectedClipId ? [s.selectedClipId] : [])
      if (ids.length === 0 || Math.abs(deltaTime) < 1e-6) return 0

      const lockedTrackIds = new Set(s.tracks.filter((t) => t.locked).map((t) => t.id))
      const movable = new Set(
        ids.filter((id) => {
          const c = s.clips.find((cl) => cl.id === id)
          return c && !lockedTrackIds.has(c.trackId)
        }),
      )
      if (movable.size === 0) return 0

      pushSnapshot()
      // Preserve relative offsets: the earliest clip is clamped to 0 and every
      // other clip keeps its distance from it.
      const selected = s.clips.filter((c) => movable.has(c.id))
      const minStart = Math.min(...selected.map((c) => c.start))
      const effectiveDelta = Math.max(-minStart, deltaTime)

      set((st) => {
        const clips = st.clips.map((c) =>
          movable.has(c.id)
            ? { ...c, start: Math.max(0, c.start + effectiveDelta), trackId: trackId || c.trackId }
            : c,
        )
        return { clips, duration: recompute(clips) }
      })
      return movable.size
    },

    trimSelectedClips: (edge, deltaSeconds) => {
      const s = get()
      const ids = (s.selectedClipIds.length ? s.selectedClipIds : s.selectedClipId ? [s.selectedClipId] : [])
      if (ids.length === 0 || Math.abs(deltaSeconds) < 1e-6) return 0

      const lockedTrackIds = new Set(s.tracks.filter((t) => t.locked).map((t) => t.id))
      const trimIds = new Set(
        ids.filter((id) => {
          const c = s.clips.find((cl) => cl.id === id)
          return c && !lockedTrackIds.has(c.trackId)
        }),
      )
      if (trimIds.size === 0) return 0

      pushSnapshot()
      set((st) => {
        const clips = st.clips.map((c) => {
          if (!trimIds.has(c.id)) return c
          if (edge === 'left') {
            // Moving the left edge right shortens, left lengthens (consuming in-point).
            const maxDelta = c.duration - 0.05
            const d = Math.min(Math.max(deltaSeconds, -c.inPoint), maxDelta)
            return { ...c, start: c.start + d, duration: c.duration - d, inPoint: Math.max(0, c.inPoint + d) }
          }
          const d = Math.max(deltaSeconds, -(c.duration - 0.05))
          return { ...c, duration: c.duration + d }
        })
        return { clips, duration: recompute(clips) }
      })
      return trimIds.size
    },


    toggleClipHidden: (id) => {
      const clip = get().clips.find((item) => item.id === id)
      if (!clip || get().tracks.find((track) => track.id === clip.trackId)?.locked) return
      pushSnapshot()
      set((state) => ({
        clips: state.clips.map((item) => item.id === id ? { ...item, hidden: !item.hidden } : item),
      }))
    },

    insertClipCopy: (source, start) => {
      if (!get().assets.some((asset) => asset.id === source.assetId)) return
      const track = get().tracks.find((item) => item.id === source.trackId)
      if (!track || track.locked) return
      pushSnapshot()
      const clip: Clip = {
        ...structuredClone(source),
        id: uid('clip'),
        start: Math.max(0, start),
        transform: { ...source.transform },
      }
      set((state) => {
        const clips = [...state.clips, clip]
        return { clips, selectedClipId: clip.id, duration: recompute(clips) }
      })
    },

    extractAudio: async (id) => {
      const state = get()
      const sourceClip = state.clips.find((clip) => clip.id === id && clip.kind === 'video')
      if (!sourceClip) return
      const sourceAsset = state.assets.find((asset) => asset.id === sourceClip.assetId)
      if (!sourceAsset || state.assets.some((asset) => asset.extractedFromClipId === id)) return
      const audioTrackId = get().ensureTrack('audio')
      let waveform: number[] | undefined
      try {
        const blob = await (await fetch(sourceAsset.url)).blob()
        waveform = await decodeWaveform(new File([blob], sourceAsset.name, { type: blob.type }))
      } catch {
        waveform = undefined
      }
      const assetId = uid('asset')
      const audioAsset: MediaAsset = {
        ...sourceAsset,
        id: assetId,
        name: `${sourceAsset.name} — audio`,
        kind: 'audio',
        width: 0,
        height: 0,
        thumbnail: undefined,
        waveform,
        extractedFromClipId: id,
      }
      const extracted: Clip = {
        ...sourceClip,
        id: uid('clip'),
        assetId,
        trackId: audioTrackId,
        name: audioAsset.name,
        kind: 'audio',
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }
      pushSnapshot()
      set((s) => {
        const clips = [
          ...s.clips.map((clip) => clip.id === id ? { ...clip, volume: 0 } : clip),
          extracted,
        ]
        return { assets: [...s.assets, audioAsset], clips, selectedClipId: extracted.id, duration: recompute(clips) }
      })
    },

    selectClip: (id) => {
      // CapCut/Shotcut rule: clicking any group member selects the whole group.
      const ids = id ? expandGroupSelection(get().groups, [id]) : []
      set({ selectedClipId: id, selectedClipIds: ids, selectedTransitionId: null })
    },
    selectClips: (ids) => {
      const exp = expandGroupSelection(get().groups, ids)
      set({ selectedClipIds: exp, selectedClipId: exp[0] || null, selectedTransitionId: null })
    },
    toggleClipSelection: (id, multi = false) => {
      const s = get()
      if (!multi) {
        const ids = id ? expandGroupSelection(get().groups, [id]) : []
        set({ selectedClipId: id, selectedClipIds: ids, selectedTransitionId: null })
        return
      }
      const exists = s.selectedClipIds.includes(id)
      const newIds = exists ? s.selectedClipIds.filter((x) => x !== id) : [...s.selectedClipIds, id]
      set({ selectedClipIds: newIds, selectedClipId: newIds[newIds.length - 1] || null })
    },

    setClipProp: (id, partial) => {
      set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)) }))
    },

    // ---- Clip Mask (CapCut/AE-style visibility mask; undoable) ----
    // Slider/drag updates coalesce: at most one undo snapshot per burst.
    setMaskEditClip: (id) => set({ maskEditClipId: id }),
    addClipMask: (clipId) => {
      pushSnapshot()
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, mask: { ...DEFAULT_CLIP_MASK } } : c)),
        maskEditClipId: clipId,
      }))
    },
    updateClipMask: (clipId, patch) => {
      const now = Date.now()
      if (maskUndoClipId !== clipId || now - maskUndoAt > 1200) {
        pushSnapshot()
        maskUndoClipId = clipId
      }
      maskUndoAt = now
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, mask: { ...DEFAULT_CLIP_MASK, ...c.mask, ...patch } } : c,
        ),
      }))
    },
    removeClipMask: (clipId) => {
      pushSnapshot()
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, mask: undefined } : c)),
        maskEditClipId: s.maskEditClipId === clipId ? null : s.maskEditClipId,
      }))
    },

    setClipTransform: (id, partial) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, transform: { ...c.transform, ...partial } } : c,
        ),
      }))
    },
    setClipBlend: (id, mode, time) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip || !BLEND_MODES.has(mode)) return
      const keys = time === undefined ? undefined : putBlendKey(clip.blendKeys || [], time, mode)
      pushSnapshot()
      set(s => ({ clips: s.clips.map(c => c.id !== id ? c : keys ? {...c, blendKeys: keys} : {...c, blendMode: mode as Clip['blendMode']}) }))
    },

    toggleTrackMute: (id) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) })),
    toggleTrackHidden: (id) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)) })),
    toggleTrackLock: (id) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)) })),
    toggleTrackGapless: (id) => {
      pushSnapshot()
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, gapless: !t.gapless } : t)) }))
    },

    // ---- Compound Clip & Sequence Actions ----
    createCompoundClip: (clipIds, customName) => {
      const s = get()
      const targetIds = clipIds && clipIds.length > 0
        ? clipIds
        : (s.selectedClipIds.length > 0 ? s.selectedClipIds : (s.selectedClipId ? [s.selectedClipId] : []))

      if (targetIds.length === 0) return null
      const targetClips = s.clips.filter((c) => targetIds.includes(c.id))
      if (targetClips.length === 0) return null

      pushSnapshot()

      const minStart = Math.min(...targetClips.map((c) => c.start))
      const maxEnd = Math.max(...targetClips.map((c) => c.start + c.duration))
      const compoundDuration = Math.max(0.1, maxEnd - minStart)
      const baseTrackId = targetClips[0].trackId

      const childSequenceId = `seq-compound-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const compoundClipId = `clip-compound-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const compoundName = customName || (targetClips.length === 1 ? `Compound: ${targetClips[0].name}` : `Compound Clip (${targetClips.length} Clips)`)

      // Rebase child clips: child start relative to compound start (0)
      const childClips: Clip[] = targetClips.map((child) => ({
        ...structuredClone(child),
        start: Math.max(0, child.start - minStart),
      }))

      // Collect child tracks used by these clips
      const childTrackIds = new Set(targetClips.map((c) => c.trackId))
      const childTracks: Track[] = s.tracks
        .filter((t) => childTrackIds.has(t.id))
        .map((t) => structuredClone(t))

      const childSequence: Sequence = {
        id: childSequenceId,
        name: compoundName,
        duration: compoundDuration,
        tracks: childTracks,
        clips: childClips,
        parentSequenceId: s.activeSequenceId,
        compoundClipId,
      }

      // Create outer compound clip
      const compoundClip: Clip = {
        id: compoundClipId,
        trackId: baseTrackId,
        assetId: '',
        start: minStart,
        duration: compoundDuration,
        inPoint: 0,
        name: compoundName,
        kind: 'compound',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
        sourceSequenceId: childSequenceId,
        originalChildClips: structuredClone(targetClips),
        originalChildTracks: structuredClone(childTracks),
        nestedTrackCount: childTracks.length,
        nestedClipCount: targetClips.length,
      }

      const remainingClips = s.clips.filter((c) => !targetIds.includes(c.id))
      const newClips = [...remainingClips, compoundClip]

      // Update sequences registry
      const updatedSequences = [...s.sequences.filter((seq) => seq.id !== childSequenceId), childSequence]

      set({
        clips: newClips,
        sequences: updatedSequences,
        selectedClipId: compoundClipId,
        selectedClipIds: [compoundClipId],
        duration: recompute(newClips),
      })

      return compoundClipId
    },

    uncompoundClip: (compoundClipId: string) => {
      const s = get()
      const compoundClip = s.clips.find((c) => c.id === compoundClipId && c.kind === 'compound')
      if (!compoundClip) return false

      pushSnapshot()

      const childSeq = s.sequences.find((seq) => seq.id === compoundClip.sourceSequenceId)
      const rawChildren = childSeq ? childSeq.clips : (compoundClip.originalChildClips || [])
      const rawTracks = childSeq ? childSeq.tracks : (compoundClip.originalChildTracks || [])

      const activeTrackIds = new Set(s.tracks.map((t) => t.id))
      const tracksToAdd: Track[] = []
      for (const t of rawTracks) {
        if (!activeTrackIds.has(t.id)) {
          tracksToAdd.push(structuredClone(t))
          activeTrackIds.add(t.id)
        }
      }

      const unfoldedClips: Clip[] = rawChildren.map((child) => ({
        ...structuredClone(child),
        start: compoundClip.start + child.start,
      }))

      const remainingClips = s.clips.filter((c) => c.id !== compoundClipId)
      const newClips = [...remainingClips, ...unfoldedClips]
      const newTracks = [...s.tracks, ...tracksToAdd]

      const unfoldedIds = unfoldedClips.map((c) => c.id)

      set({
        tracks: newTracks,
        clips: newClips,
        selectedClipId: unfoldedIds[0] || null,
        selectedClipIds: unfoldedIds,
        duration: recompute(newClips),
      })

      return true
    },

    openSequence: (sequenceId: string) => {
      const s = get()
      if (s.activeSequenceId === sequenceId) return

      // Save current state into current sequence in sequences list
      const currentSeqIndex = s.sequences.findIndex((seq) => seq.id === s.activeSequenceId)
      let updatedSequences = [...s.sequences]
      const currentSnapshot: Sequence = {
        id: s.activeSequenceId,
        name: s.breadcrumbs.find((b) => b.id === s.activeSequenceId)?.name || (s.activeSequenceId === 'main' ? 'Main Timeline' : 'Sequence'),
        duration: s.duration,
        tracks: structuredClone(s.tracks),
        clips: structuredClone(s.clips),
      }
      if (currentSeqIndex >= 0) {
        updatedSequences[currentSeqIndex] = currentSnapshot
      } else {
        updatedSequences.push(currentSnapshot)
      }

      if (sequenceId === 'main') {
        const mainSeq = updatedSequences.find((seq) => seq.id === 'main')
        if (mainSeq) {
          set({
            activeSequenceId: 'main',
            compoundWindow: null,
            breadcrumbs: [{ id: 'main', name: 'Main Timeline' }],
            tracks: mainSeq.tracks,
            clips: mainSeq.clips,
            sequences: updatedSequences,
            selectedClipId: null,
            selectedClipIds: [],
            duration: recompute(mainSeq.clips),
            playhead: 0,
          })
        } else {
          set({
            activeSequenceId: 'main',
            breadcrumbs: [{ id: 'main', name: 'Main Timeline' }],
            sequences: updatedSequences,
            selectedClipId: null,
            selectedClipIds: [],
          })
        }
        return
      }

      const targetSeq = updatedSequences.find((seq) => seq.id === sequenceId)
      if (!targetSeq) return

      const newBreadcrumbs = [{ id: 'main', name: 'Main Timeline' }, { id: targetSeq.id, name: targetSeq.name }]

      // The parent compound clip's trim defines the visible window; the
      // trimmed head/tail render inside as faint cut voids.
      let compoundWindow: { in: number; out: number; total: number } | null = null
      if (targetSeq.compoundClipId) {
        const parentClip =
          currentSnapshot.clips.find((c) => c.id === targetSeq.compoundClipId) ||
          updatedSequences.flatMap((seq) => seq.clips).find((c) => c.id === targetSeq.compoundClipId)
        if (parentClip) {
          compoundWindow = {
            in: Math.max(0, parentClip.inPoint || 0),
            out: Math.max(0, (parentClip.inPoint || 0) + parentClip.duration),
            total: targetSeq.duration,
          }
        }
      }

      set({
        compoundWindow,
        activeSequenceId: targetSeq.id,
        breadcrumbs: newBreadcrumbs,
        tracks: structuredClone(targetSeq.tracks),
        clips: structuredClone(targetSeq.clips),
        sequences: updatedSequences,
        selectedClipId: null,
        selectedClipIds: [],
        duration: recompute(targetSeq.clips),
        playhead: 0,
      })
    },

    navigateBreadcrumb: (sequenceId: string) => {
      get().openSequence(sequenceId)
    },

    startVisualPreview: (input) => set((s) => {
      const minimumWindow = 0.05
      const start = clamp(input.startTime, 0, Math.max(0, s.duration - minimumWindow))
      const end = Math.min(Math.max(start + minimumWindow, input.endTime), Math.max(s.duration, start + minimumWindow))
      const previousPreview = s.visualPreview
      return {
        visualPreview: {
          ...input,
          startTime: start,
          endTime: end,
          id: uid('visual-preview'),
          // Replacing an audition still returns to the playhead/speed from
          // before the first audition, not the middle of the previous one.
          returnPlayhead: previousPreview?.returnPlayhead ?? s.playhead,
          returnSpeed: previousPreview?.returnSpeed ?? s.speed,
        },
        playhead: start,
        playing: true,
        speed: 1,
        monitorMode: 'program',
      }
    }),
    stopVisualPreview: () => {
      const preview = get().visualPreview
      if (!preview) return
      set((s) => ({
        visualPreview: null,
        playing: false,
        playhead: clamp(preview.returnPlayhead, 0, s.duration),
        speed: preview.returnSpeed,
      }))
    },
    applyVisualPreview: () => {
      const preview = get().visualPreview
      if (!preview || preview.kind === 'clip-playback' || preview.kind === 'range-playback') return
      if (preview.kind === 'clip-effect') {
        if (!get().clips.some((clip) => clip.id === preview.clipId)) return get().stopVisualPreview()
        pushSnapshot()
        set((s) => ({
          clips: s.clips.map((clip) => clip.id === preview.clipId
            ? { ...clip, effects: { ...clip.effects, ...preview.effect } }
            : clip),
        }))
      } else if (preview.kind === 'clip-lut') {
        if (!get().clips.some((clip) => clip.id === preview.clipId)) return get().stopVisualPreview()
        get().addLutToClip(preview.clipId, preview.lut)
      } else if (preview.kind === 'adjustment-layer') {
        const anchor = get().clips.find((clip) => clip.id === preview.anchorClipId)
        if (!anchor) return get().stopVisualPreview()
        get().selectClip(anchor.id)
        if (preview.effect) {
          get().placeEffectAsLayer(preview.label, preview.effect)
        } else if (preview.lut) {
          get().addAdjustmentLayer({
            name: `Adjustment: ${preview.lut.name}`,
            start: anchor.start,
            duration: anchor.duration,
            luts: [{ ...preview.lut, id: uid('clip-lut') }],
          })
        }
      } else if (preview.kind === 'transition') {
        const { id: _previewId, ...transition } = preview.transition
        get().addTransition(transition)
      } else if (preview.kind === 'text-clip') {
        const state = get()
        const clipData = structuredClone(preview.clip)
        let trackId = state.tracks.some((track) => track.id === clipData.trackId) ? clipData.trackId : ''
        if (!trackId) {
          const videoTracks = state.tracks.filter((track) => track.type === 'video')
          const overlaps = (candidateId: string) => state.clips.some(
            (clip) => clip.trackId === candidateId && !(clip.start + clip.duration <= clipData.start || clip.start >= clipData.start + clipData.duration),
          )
          const baseTrack = videoTracks[0]
          const availableTrack = baseTrack && !overlaps(baseTrack.id)
            ? baseTrack
            : videoTracks.find((track) => !overlaps(track.id))
          if (availableTrack) {
            trackId = availableTrack.id
            pushSnapshot()
          } else if (baseTrack) {
            // createTrack records the pre-commit snapshot itself.
            trackId = get().createTrack('video', 'above', baseTrack.id)
          } else {
            trackId = get().ensureTrack('video')
          }
        } else {
          pushSnapshot()
        }
        const clip: Clip = { ...clipData, id: uid('text'), trackId }
        set((s) => {
          const clips = [...s.clips, clip]
          return { clips, selectedClipId: clip.id, selectedClipIds: [clip.id], duration: recompute(clips) }
        })
      }
      get().stopVisualPreview()
    },
    setPlayhead: (t) => set((s) => ({ playhead: clamp(t, 0, s.duration) })),
    // Importing or clicking a media asset sets monitorMode to 'source', and the
    // preview then tears down the engine that owns the playhead clock. Playing
    // from that state left `playing: true` with a permanently frozen playhead
    // and no error. Returning the monitor to 'program' on play keeps the
    // transport alive; the source asset selection itself is untouched.
    play: () => set((s) => ({
      playhead: s.playhead >= s.duration - 0.001 ? 0 : s.playhead,
      playing: true,
      monitorMode: s.monitorMode === 'source' ? 'program' : s.monitorMode,
    })),
    pause: () => set({ playing: false }),
    togglePlay: () => set((s) => s.playing
      ? { playing: false }
      : {
          playing: true,
          playhead: s.playhead >= s.duration - 0.001 ? 0 : s.playhead,
          monitorMode: s.monitorMode === 'source' ? 'program' : s.monitorMode,
        },
    ),
    setSpeed: (s) => {
      const sign = s < 0 ? -1 : 1
      set({ speed: sign * clamp(Math.abs(s), 0.1, 4) })
    },

    setProjectFps: (value) => {
      const supported = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120]
      if (supported.includes(value)) set({ projectFps: value, dropFrameTimecode: false })
    },
    setSequenceBackground: (color) => {
      if (/^#[0-9a-fA-F]{6}$/.test(color)) set({ sequenceBackground: color })
    },
    setDropFrameTimecode: (enabled) => set((state) => ({
      dropFrameTimecode: enabled && (state.projectFps === 29.97 || state.projectFps === 59.94),
    })),
    setPreviewQuality: (previewQuality) => {
      localStorage.setItem('omniframe.previewQuality', previewQuality)
      set({ previewQuality })
    },
    setHideOverflowX: (v) => {
      try { localStorage.setItem('omniframe.hideOverflowX', v ? 'yes' : 'no') } catch { /* private mode */ }
      set({ hideOverflowX: v })
    },
    setUiStyle: (v: string) => {
      try { localStorage.setItem('omniframe.uiStyle', v) } catch { /* private mode */ }
      set({ uiStyle: v })
    },
    setUiPalette: (v: string) => {
      try { localStorage.setItem('omniframe.uiPalette', v) } catch { /* private mode */ }
      set({ uiPalette: v })
    },
    setAiProvider: (v: string) => {
      try { localStorage.setItem('omniframe.aiProvider', v) } catch { /* private mode */ }
      set({ aiProvider: v, aiConnection: { status: 'idle', message: '', latencyMs: null, modelAvailable: null, at: 0 } })
    },
    setAiModel: (v: string) => {
      try { localStorage.setItem('omniframe.aiModel', v) } catch { /* private mode */ }
      set({ aiModel: v })
    },
    setAiEndpoint: (v: string) => {
      try { localStorage.setItem('omniframe.aiEndpoint', v) } catch { /* private mode */ }
      set({ aiEndpoint: v })
    },
    setAiApiKey: (v: string) => set({ aiApiKey: v }), // memory only, by design
    setAiCapabilityModel: (capability: string, model: string) => {
      const next = { ...get().aiCapabilityModels, [capability]: model }
      try { localStorage.setItem('omniframe.aiCapabilityModels', JSON.stringify(next)) } catch { /* private mode */ }
      set({ aiCapabilityModels: next })
    },
    setAiConnection: (c) => set({ aiConnection: { status: c.status, message: c.message, latencyMs: c.latencyMs, modelAvailable: c.modelAvailable ?? null, at: Date.now() } }),
    addWatermark: (w) => {
      const id = `wm_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
      const next = [...get().watermarks, { id, ...w }]
      try { localStorage.setItem('omniframe.watermarks', JSON.stringify(next)) } catch { /* private mode */ }
      set({ watermarks: next })
      return id
    },
    removeWatermark: (id: string) => {
      const next = get().watermarks.filter((w) => w.id !== id)
      try { localStorage.setItem('omniframe.watermarks', JSON.stringify(next)) } catch { /* private mode */ }
      set({ watermarks: next })
    },
    setAudioIsolationModel: (model) => set({ audioIsolationModel: model }),

    setZoom: (px) => set({ pxPerSec: clamp(px, 8, 8000) }),
    zoomBy: (factor) => set((s) => ({ pxPerSec: clamp(s.pxPerSec * factor, 8, 8000) })),
    toggleSnapping: () => set((state) => ({ snapping: !state.snapping })),
    setScrubbing: (scrubbing) => set({ scrubbing }),

    setTool: (t) => set({ tool: t }),
    setLeftTab: (t) => set({ leftTab: t, leftOpen: true, activeSubMode: null, ...(typeof window!=='undefined'&&window.innerWidth<640?{rightOpen:false}:{}) }),
    setLeftOpen: (v) => set({ leftOpen: v, ...(v&&typeof window!=='undefined'&&window.innerWidth<640?{rightOpen:false}:{}) }),
    setRightOpen: (v) => set({ rightOpen: v, ...(v&&typeof window!=='undefined'&&window.innerWidth<640?{leftOpen:false}:{}) }),
    setActiveCategory: (cat) => set({ activeCategory: cat }),
    voiceModal: { open: false, clipId: undefined },
    openVoiceModal: (clipId) => set({ voiceModal: { open: true, clipId } }),
    closeVoiceModal: () => set({ voiceModal: { open: false, clipId: undefined } }),
    openSubMode: (parentTab, subModeId, label, icon = 'Layers') => {
      set((s) => {
        const filtered = s.contextualSubModes.filter((m) => m.id !== subModeId)
        return {
          leftTab: parentTab,
          leftOpen: true,
          activeSubMode: subModeId,
          contextualSubModes: [...filtered, { id: subModeId, parentTab, label, icon }],
        }
      })
    },
    closeSubMode: () => set({ activeSubMode: null }),

    // ---- settings actions ----
    setCustomShortcut: (id, key) =>
      set((s) => ({ customShortcuts: { ...s.customShortcuts, [id]: key } })),
    resetCustomShortcuts: () => set({ customShortcuts: { ...DEFAULT_SHORTCUTS } }),
    toggleContextMenuCommand: (id) =>
      set((s) => ({
        contextMenuEnabledCommands: {
          ...s.contextMenuEnabledCommands,
          [id]: !s.contextMenuEnabledCommands[id],
        },
      })),
    setContextMenuCommand: (id, enabled) =>
      set((s) => ({
        contextMenuEnabledCommands: {
          ...s.contextMenuEnabledCommands,
          [id]: enabled,
        },
      })),
    resetContextMenuCommands: () =>
      set({ contextMenuEnabledCommands: { ...DEFAULT_CONTEXT_COMMANDS } }),
    setUnclusterInspector: (unclusterInspector) => set({ unclusterInspector }),
    setCursorConfig: (patch) =>
      set((s) => ({ cursorConfig: { ...s.cursorConfig, ...patch } })),
    resetCursorConfig: () =>
      set({ cursorConfig: { ...DEFAULT_CURSOR_CONFIG } }),

    // ---- drawing actions ----
    addDrawingStroke: (stroke) => {
      pushSnapshot()
      set((s) => {
        // Strict layered stamping: a stroke joins the layer stack only when
        // "View videos as layers" was ON at the moment it was drawn, and it
        // passes through exactly the clips selected at that moment.
        const stamped: DrawingStroke = s.viewVideosAsLayers
          ? {
              ...stroke,
              layered: true,
              anchorClipIds: (s.selectedClipIds.length > 0
                ? s.selectedClipIds
                : s.selectedClipId
                  ? [s.selectedClipId]
                  : []
              ).filter((id) => s.clips.some((c) => c.id === id)),
            }
          : { ...stroke, layered: false }
        return { drawingStrokes: [...s.drawingStrokes, stamped] }
      })
    },
    clearDrawingStrokes: (layerId) => {
      pushSnapshot()
      set((s) => ({
        drawingStrokes: layerId
          ? s.drawingStrokes.filter((st) => st.layerId !== layerId)
          : [],
      }))
    },
    setDrawingTool: (tool) => set({ drawingTool: tool }),
    setDrawingColor: (color) => set({ drawingColor: color }),
    setDrawingSize: (size) => set({ drawingSize: Math.max(1, Math.min(100, size)) }),
    setDrawingOpacity: (opacity) => set({ drawingOpacity: Math.max(0, Math.min(1, opacity)) }),
    setDrawingScope: (scope) => set({ drawingScope: scope }),
    setDrawingEnabled: (enabled) => set({ drawingEnabled: enabled }),
    setViewVideosAsLayers: (v) => set({ viewVideosAsLayers: v }),
    setDockerPref: (kind, id, visible) => {
      set((s) => ({ dockerPrefs: { ...s.dockerPrefs, [kind]: { ...s.dockerPrefs[kind], [id]: visible } } }))
      try {
        localStorage.setItem('omniframe.dockerPrefs', JSON.stringify(get().dockerPrefs))
      } catch { /* private mode */ }
    },
    requestDrawingSection: (section) => set({ drawingSectionRequest: section }),
    setExportIn: () =>
      set((s) => ({
        exportRange: { in: Math.max(0, s.playhead), out: Math.max(Math.max(0, s.playhead) + 0.1, s.exportRange?.out ?? s.duration) },
      })),
    setExportOut: () =>
      set((s) => ({
        exportRange: { in: Math.max(0, Math.min(s.exportRange?.in ?? 0, s.playhead)), out: Math.max((s.exportRange?.in ?? 0) + 0.1, s.playhead) },
      })),
    clearExportRange: () => set({ exportRange: null }),
    convertDrawingToClips: () => {
      const s = get()
      const plan = planDrawingToClips({
        strokes: s.drawingStrokes,
        clips: s.clips,
        trackIdsTopToBottom: s.tracks.map((t) => t.id),
        fps: s.projectFps || 30,
        projectDuration: s.duration || 10,
      })
      if (plan.clips.length === 0) return { clips: 0, tracks: 0, strokes: 0 }
      pushSnapshot()
      // Materialize tracks bottom-stratum first so each insert lands
      // directly above its anchor (or at the very top for unanchored art).
      const tracks = [...s.tracks]
      const trackIdByKey = new Map<string, string>()
      const insertedByStratum = new Map<string, string>()
      for (const tp of [...plan.tracks].sort((a, b) => a.stratum - b.stratum || a.slot - b.slot)) {
        const id = uid('track-drawing')
        trackIdByKey.set(tp.key, id)
        const newTrack: Track = {
          id,
          name: tp.stratum === Number.POSITIVE_INFINITY ? 'Drawing Clips' : 'Drawing Clips (layered)',
          type: 'video',
          height: 44,
        } as Track
        const stratumKey = String(tp.stratum)
        const previous = insertedByStratum.get(stratumKey)
        if (previous) {
          const at = tracks.findIndex((t) => t.id === previous)
          tracks.splice(Math.max(0, at), 0, newTrack)
        } else if (tp.insertAboveTrackId) {
          const at = tracks.findIndex((t) => t.id === tp.insertAboveTrackId)
          tracks.splice(at >= 0 ? at : 0, 0, newTrack)
        } else {
          tracks.splice(0, 0, newTrack)
        }
        insertedByStratum.set(stratumKey, id)
      }
      const layerName = new Map(s.paintLayers.map((l) => [l.id, l.name]))
      const newClips: Clip[] = plan.clips.map((pc) => ({
        id: uid('clip-drawing'),
        trackId: trackIdByKey.get(pc.trackKey) || tracks[0].id,
        assetId: '',
        start: pc.start,
        duration: pc.duration,
        inPoint: 0,
        name: `Drawing · ${layerName.get(pc.layerId) || 'Paint'} · f${pc.startFrame}-${pc.endFrame - 1}`,
        kind: 'drawing',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
        drawingStrokeIds: pc.strokeIds,
        drawingLayerId: pc.layerId,
      }))
      const clipIdByStroke = new Map<string, string>()
      for (const c of newClips) for (const sid of c.drawingStrokeIds || []) clipIdByStroke.set(sid, c.id)
      set({
        tracks,
        clips: [...s.clips, ...newClips],
        drawingStrokes: s.drawingStrokes.map((st) =>
          clipIdByStroke.has(st.id) ? { ...st, convertedClipId: clipIdByStroke.get(st.id) } : st,
        ),
        selectedClipId: newClips[0]?.id || s.selectedClipId,
        selectedClipIds: newClips[0] ? [newClips[0].id] : s.selectedClipIds,
      })
      return { clips: newClips.length, tracks: trackIdByKey.size, strokes: plan.convertedStrokeIds.length }
    },
    toggleDrawingEnabled: () => set((s) => ({ drawingEnabled: !s.drawingEnabled })),
    setPivotEditEnabled: (enabled) => set({ pivotEditEnabled: enabled }),
    createPaintLayer: (name) => {
      const id = uid('layer')
      const newLayer: PaintLayer = {
        id,
        name: name || `Paint ${get().paintLayers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
      }
      pushSnapshot()
      set((s) => ({
        paintLayers: [...s.paintLayers, newLayer],
        activePaintLayerId: id,
      }))
      return id
    },
    togglePaintLayerVisibility: (layerId) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === layerId ? { ...l, visible: !l.visible } : l,
        ),
      }))
    },
    setDrawingFillTolerance: (tolerance) => set({ drawingFillTolerance: Math.max(1, Math.min(100, tolerance)) }),
    setDrawingPolygonSides: (sides) => set({ drawingPolygonSides: Math.max(3, Math.min(12, Math.round(sides))) }),
    setDrawingShapeFilled: (filled) => set({ drawingShapeFilled: filled }),
    setDrawingGradientColor: (color) => set({ drawingGradientColor: color }),
    setDrawingPreserveLuminance: (preserve) => set({ drawingPreserveLuminance: preserve }),
    setPaintLayerBlendMode: (layerId, blendMode) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === layerId ? { ...l, blendMode } : l,
        ),
      }))
    },
    setPaintLayerBlur: (layerId, blur) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === layerId ? { ...l, blur: Math.max(0, Math.min(50, blur)) } : l,
        ),
      }))
    },
    setPaintLayerOpacity: (layerId, opacity) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l,
        ),
      }))
    },
    clearPaintLayerRasterMask: (layerId) => {
      const layer = get().paintLayers.find((item) => item.id === layerId)
      if (!layer?.maskDataUrl) return
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((item) =>
          item.id === layerId ? { ...item, maskDataUrl: undefined } : item,
        ),
        guidedMatte:
          s.guidedMatte?.maskLayerId === layerId && s.guidedMatte.maskDataUrl === layer.maskDataUrl
            ? { ...s.guidedMatte, maskLayerId: undefined }
            : s.guidedMatte,
      }))
    },
    setOnionSkin: (partial) => set((s) => ({ onionSkin: { ...s.onionSkin, ...partial } })),
    toggleOnionSkin: () => set((s) => ({ onionSkin: { ...s.onionSkin, enabled: !s.onionSkin.enabled } })),
    setDrawingHoldFrames: (frames) => set({ drawingHoldFrames: Math.max(1, Math.min(120, frames)) }),
    stepFrame: (delta) => {
      const fps = get().projectFps || 30
      const dur = get().duration || 10
      const newTime = Math.max(0, Math.min(dur, get().playhead + delta / fps))
      get().setPlayhead(newTime)
    },
    setActiveSelection: (selection) => set({ activeSelection: selection }),
    clearSelection: () => set({ activeSelection: null }),
    convertSelectionToMask: (layerId) => {
      const targetLayerId = layerId || get().activePaintLayerId
      const sel = get().activeSelection
      if (!sel) return
      const maskUrl = sel.maskDataUrl || createSelectionMask(sel, 1920, 1080)
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === targetLayerId ? { ...l, maskDataUrl: maskUrl } : l,
        ),
        activeSelection: null,
      }))
    },
    invertSelection: () => {
      set((s) => ({
        activeSelection: s.activeSelection ? { ...s.activeSelection, inverted: !s.activeSelection.inverted } : null,
      }))
    },
    growSelection: (pixels = 10) => {
      set((s) => {
        if (!s.activeSelection) return {}
        const b = s.activeSelection.bounds
        const deltaX = pixels / 1920
        const deltaY = pixels / 1080
        const newX = Math.max(0, b.x - deltaX)
        const newY = Math.max(0, b.y - deltaY)
        const newW = Math.min(1 - newX, b.width + deltaX * 2)
        const newH = Math.min(1 - newY, b.height + deltaY * 2)
        return {
          activeSelection: {
            ...s.activeSelection,
            bounds: { x: newX, y: newY, width: newW, height: newH },
          },
        }
      })
    },
    shrinkSelection: (pixels = 10) => {
      set((s) => {
        if (!s.activeSelection) return {}
        const b = s.activeSelection.bounds
        const deltaX = pixels / 1920
        const deltaY = pixels / 1080
        if (b.width <= deltaX * 2 || b.height <= deltaY * 2) return {}
        return {
          activeSelection: {
            ...s.activeSelection,
            bounds: {
              x: b.x + deltaX,
              y: b.y + deltaY,
              width: b.width - deltaX * 2,
              height: b.height - deltaY * 2,
            },
          },
        }
      })
    },
    setSelectionFeather: (feather: number) => {
      set((s) => ({
        activeSelection: s.activeSelection
          ? { ...s.activeSelection, feather: Math.max(0, Math.min(64, feather)) }
          : null,
      }))
    },
    // ---- Auto Brush & real Magic Wand (Selection & Masking sub-tool) ----
    setSelectionBrushAuto: (v) => set({ selectionBrushAuto: v }),
    setSelectionBrushTolerance: (n) => set({ selectionBrushTolerance: Math.max(1, Math.min(100, n)) }),
    setSelectionWandTolerance: (n) => set({ selectionWandTolerance: Math.max(1, Math.min(100, n)) }),

    /**
     * Auto Brush: after the user paints a selection stroke, grow the painted
     * band to the subject's real edges (colour model + gradient stop) using
     * the pixels of the live preview canvas. Replaces the old hard-circle
     * brush that ignored what was under it.
     */
    refineBrushSelectionMask: async (points) => {
      const sel = get().activeSelection
      if (!sel || sel.type !== 'brush' || points.length < 2) return
      if (typeof document === 'undefined') return
      const preview = document.getElementById('of-canvas') as HTMLCanvasElement | null
      if (!preview) return
      const ctx = preview.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      const img = ctx.getImageData(0, 0, preview.width, preview.height)
      const radiusPx = Math.max(4, (get().drawingSize / 2) * (preview.width / Math.max(1, preview.clientWidth || preview.width)))
      const auto = autoBrushMaskFromStroke({
        source: img,
        stroke: points.map((p) => ({ x: p.x * img.width, y: p.y * img.height })),
        radius: radiusPx,
        tolerance: get().selectionBrushTolerance,
        maxGrow: Math.round(radiusPx * 3),
        feather: 1.5,
      })
      set((s) =>
        s.activeSelection
          ? { activeSelection: { ...s.activeSelection, maskDataUrl: maskToDataUrl(auto.mask) } }
          : {},
      )
    },

    /**
     * Real Magic Wand: flood the clicked colour region from the preview
     * canvas pixels (the old implementation faked a fixed 0.2x0.2 rectangle).
     */
    setWandSelectionAt: async (point) => {
      if (typeof document === 'undefined') return
      const preview = document.getElementById('of-canvas') as HTMLCanvasElement | null
      if (!preview) return
      const ctx = preview.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      const img = ctx.getImageData(0, 0, preview.width, preview.height)
      const wand = magicWandMask({
        source: img,
        seed: { x: point.x * img.width, y: point.y * img.height },
        tolerance: get().selectionWandTolerance,
        contiguous: true,
        feather: 1,
      })
      const b = maskBounds(wand.mask)
      // Keep the bounds visible even for tiny selections (min 6% box).
      const nb = {
        x: b.width ? Math.max(0, b.x / img.width) : Math.max(0, point.x - 0.03),
        y: b.height ? Math.max(0, b.y / img.height) : Math.max(0, point.y - 0.03),
        width: b.width ? Math.max(0.06, b.width / img.width) : 0.06,
        height: b.height ? Math.max(0.06, b.height / img.height) : 0.06,
      }
      set({
        activeSelection: {
          type: 'magic-wand',
          bounds: nb,
          points: [{ ...point, timestamp: 0 }],
          maskDataUrl: maskToDataUrl(wand.mask),
        },
      })
    },

    setSelectionMode: (mode) => {
      set({ selectionMode: mode })
      const toolMap: Record<SelectionModeType, DrawingToolType> = {
        rect: 'select-rect',
        ellipse: 'select-ellipse',
        freeform: 'select-lasso',
        polygon: 'select-polygon',
        painting: 'select-brush',
        'magic-wand': 'select-magic-wand',
        character: 'select-character',
      }
      if (toolMap[mode]) {
        set({ drawingTool: toolMap[mode], drawingEnabled: true })
      }
    },
    setSelectionMaskDisplayMode: (mode) => {
      set((s) => {
        const char = s.omniframeCharacters?.find((c) => c.id === s.selectedCharacterId)
        const currentSel = s.activeSelection || (char ? {
          type: 'character' as const,
          bounds: { ...char.bounds },
          characterName: char.name,
          showMaskOnly: true,
          maskDisplayMode: mode,
        } : null)
        if (!currentSel) return {}
        return {
          activeSelection: {
            ...currentSel,
            maskDisplayMode: mode,
            showMaskOnly: mode !== 'cutout',
          },
        }
      })
    },
    toggleSelectionMaskView: (showOnly) => {
      set((s) => {
        const char = s.omniframeCharacters?.find((c) => c.id === s.selectedCharacterId)
        const currentSel = s.activeSelection || (char ? {
          type: 'character' as const,
          bounds: { ...char.bounds },
          characterName: char.name,
          showMaskOnly: false,
          maskDisplayMode: 'rubylith' as const,
        } : null)
        if (!currentSel) return {}
        const next = showOnly !== undefined ? showOnly : !currentSel.showMaskOnly
        return {
          activeSelection: {
            ...currentSel,
            showMaskOnly: next,
            maskDisplayMode: next ? (currentSel.maskDisplayMode || 'rubylith') : 'cutout',
          },
        }
      })
    },
    recolorActiveSelection: (color, blend = 'dye') => {
      pushSnapshot()
      const sel = get().activeSelection
      const selectedCharId = get().selectedCharacterId
      const char = get().omniframeCharacters.find((c) => c.id === selectedCharId)

      // 1. If an OmniFrame character/object is active, recolor it for real.
      //
      // This used to swap in one of five pre-baked PNGs matched by colour
      // name, so any other colour silently did nothing. Worse, those PNGs
      // were flat composites: measured on the towel, a flat blue fill drops
      // luminance std from 63 to 27 and crushes the p5..p95 range from
      // 29..241 to 13..103, destroying every fold — which is exactly the
      // "looks like a layer" effect. We now compute the recolor from the
      // object's own cutout, preserving its lightness structure.
      if (char) {
        // "Original" / clearing: drop the dye and fall back to the cutout.
        if (!color) {
          set((s) => ({
            omniframeCharacters: s.omniframeCharacters.map((c) =>
              c.id === selectedCharId
                ? { ...c, recolorColor: undefined, recolorUrl: undefined, recolorBlend: undefined }
                : c,
            ),
          }))
        } else {
        set((s) => ({
          omniframeCharacters: s.omniframeCharacters.map((c) =>
            c.id === selectedCharId ? { ...c, recolorColor: color, recolorBlend: blend } : c,
          ),
        }))

        const charId = char.id
        // Always re-dye the pristine cutout, never the previous result, so
        // repeated recolors don't compound into mud.
        void recolorImage(char.cutoutUrl, { color, blend })
          .then(({ dataUrl }) => {
            set((s) => ({
              omniframeCharacters: s.omniframeCharacters.map((c) =>
                c.id === charId ? { ...c, recolorColor: color, recolorBlend: blend, recolorUrl: dataUrl } : c,
              ),
            }))
          })
          .catch(() => {
            // Keep the requested colour recorded even if the pixel pass fails.
            set((s) => ({
              omniframeCharacters: s.omniframeCharacters.map((c) =>
                c.id === charId ? { ...c, recolorColor: color, recolorBlend: blend } : c,
              ),
            }))
          })
        }
      }

      // 2. Also tint active selection buffer
      if (sel) {
        set((s) => ({
          activeSelection: s.activeSelection ? { ...s.activeSelection, fillColor: color } : null,
        }))
      }
    },
    convertSelectionToOmniframeObject: (customName) => {
      const sel = get().activeSelection
      if (!sel) return ''
      pushSnapshot()
      const newId = `obj_sel_${Date.now()}`
      const b = sel.bounds
      const name = customName || sel.characterName || `Object ${get().omniframeCharacters.length + 1}`

      const cutoutUrl = sel.maskDataUrl || createSelectionMask(sel, 1920, 1080)

      const newChar: OmniframeCharacter = {
        id: newId,
        name,
        label: `Selection Cutout (${sel.type})`,
        bounds: { ...b },
        cutoutUrl,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        scope: 'all',
        recolorColor: sel.fillColor,
      }

      set((s) => ({
        omniframeCharacters: [...s.omniframeCharacters, newChar],
        selectedCharacterId: newId,
        activeSelection: null,
      }))
      return newId
    },
    loadAssetObjects: (assetId) => {
      pushSnapshot()
      if (assetId === 'asset-room-chair-towel' || assetId.includes('room') || assetId.includes('chair')) {
        set({
          omniframeCharacters: INITIAL_ROOM_OBJECTS,
          selectedCharacterId: 'char_towel',
        })
      } else {
        set({
          omniframeCharacters: INITIAL_DEATH_NOTE_CHARACTERS,
          selectedCharacterId: 'char_light',
        })
      }
    },

    // ---- Krita-Style Transparency Mask Actions ----
    addTransparencyMask: (layerId) => {
      const maskId = uid('mask')
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) => {
          if (l.id !== layerId) return l
          return {
            ...l,
            transparencyMask: {
              id: maskId,
              parentLayerId: layerId,
              name: 'Transparency Mask',
              enabled: true,
              inverted: false,
              opacity: 1,
            },
          }
        }),
        activeMaskId: maskId,
        drawingColor: '#000000', // Default to black (erase / hide in Krita)
      }))
      return maskId
    },
    removeTransparencyMask: (layerId) => {
      pushSnapshot()
      set((s) => {
        const mask = s.paintLayers.find((l) => l.id === layerId)?.transparencyMask
        return {
          paintLayers: s.paintLayers.map((l) => {
            if (l.id !== layerId) return l
            const { transparencyMask, ...rest } = l
            return rest
          }),
          drawingStrokes: s.drawingStrokes.filter((st) => !(st.layerId === layerId && st.maskId)),
          activeMaskId: s.activeMaskId && mask && mask.id === s.activeMaskId ? null : s.activeMaskId,
        }
      })
    },
    toggleTransparencyMask: (layerId) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) => {
          if (l.id !== layerId || !l.transparencyMask) return l
          return {
            ...l,
            transparencyMask: {
              ...l.transparencyMask,
              enabled: !l.transparencyMask.enabled,
            },
          }
        }),
      }))
    },
    invertTransparencyMask: (layerId) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) => {
          if (l.id !== layerId || !l.transparencyMask) return l
          return {
            ...l,
            transparencyMask: {
              ...l.transparencyMask,
              inverted: !l.transparencyMask.inverted,
            },
          }
        }),
      }))
    },
    setTransparencyMaskOpacity: (layerId, opacity) => {
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) => {
          if (l.id !== layerId || !l.transparencyMask) return l
          return {
            ...l,
            transparencyMask: {
              ...l.transparencyMask,
              opacity: Math.max(0, Math.min(1, opacity)),
            },
          }
        }),
      }))
    },
    applyTransparencyMask: (layerId) => {
      pushSnapshot()
      set((s) => {
        const mask = s.paintLayers.find((l) => l.id === layerId)?.transparencyMask
        return {
          paintLayers: s.paintLayers.map((l) => {
            if (l.id !== layerId) return l
            const { transparencyMask, ...rest } = l
            return rest
          }),
          activeMaskId: s.activeMaskId && mask && mask.id === s.activeMaskId ? null : s.activeMaskId,
        }
      })
    },
    setActiveMask: (maskId) => set({ activeMaskId: maskId }),
    setClipMasks: (next) =>
      set((s) => ({ clipMasks: typeof next === 'function' ? next(s.clipMasks) : next })),
    setBrushDynamics: (dynamics) => set((s) => ({ brushDynamics: { ...s.brushDynamics, ...dynamics } })),

    // ---- layout actions ----
    setWorkspacePreset: (preset) => {
      // Applying a preset is a full layout reset: every popped-out panel
      // returns to its dock and the timeline strip expands.
      set({
        leftPanelFloating: false,
        rightPanelFloating: false,
        timelineFloating: false,
        timelineCollapsed: false,
      })
      switch (preset) {
        case 'default':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            rightOpen: true,
            leftDockWidth: 320,
            timelineHeight: 280,
            rightPanelWidth: 280,
            drawingEnabled: false,
          })
          break
        case 'edit':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            rightOpen: false,
            leftDockWidth: 300,
            timelineHeight: 340,
            drawingEnabled: false,
          })
          break
        case 'timeline-focus':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: false,
            rightOpen: false,
            timelineHeight: 460,
            drawingEnabled: false,
          })
          break
        case 'preview-focus':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: false,
            rightOpen: false,
            timelineHeight: 160,
            drawingEnabled: false,
          })
          break
        case 'drawing':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'drawing',
            rightOpen: false,
            leftDockWidth: 280,
            timelineHeight: 180,
            drawingEnabled: true,
          })
          break
        case 'color':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: false,
            rightOpen: true,
            rightPanelWidth: 320,
            timelineHeight: 220,
            drawingEnabled: false,
          })
          break
        case '3d':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            rightOpen: true,
            leftTab: 'threed',
            leftDockWidth: 300,
            rightPanelWidth: 280,
            timelineHeight: 180,
            drawingEnabled: false,
          })
          break
        case 'minimal':
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: false,
            rightOpen: false,
            timelineHeight: 140,
            drawingEnabled: false,
          })
          break
        case 'full-canvas':
          set({
            workspacePreset: preset,
            focusMode: 'canvas-only',
            leftOpen: false,
            rightOpen: false,
            timelineHeight: 0,
            drawingEnabled: false,
          })
          break
        case 'audio':
          // Audio Suite: stems panel open, tall timeline for waveforms.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'audio',
            rightOpen: false,
            leftDockWidth: 300,
            timelineHeight: 460,
            drawingEnabled: false,
          })
          break
        case 'vfx':
          // VFX & Tracking: tracking panel + wide inspector for matte params.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'tracking',
            leftDockWidth: 320,
            rightOpen: true,
            rightPanelWidth: 320,
            timelineHeight: 200,
            drawingEnabled: false,
          })
          break
        case 'rig':
          // Rig & Animate: rigging panel, inspector, graph editor open.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'rigging',
            leftDockWidth: 320,
            rightOpen: true,
            rightPanelWidth: 300,
            timelineHeight: 240,
            graphEditorOpen: true,
            drawingEnabled: false,
          })
          break
        case 'manga':
          // Manga / MMV edit: drawing canvas + wide media dock, clean sides.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'drawing',
            leftDockWidth: 340,
            rightOpen: false,
            timelineHeight: 300,
            drawingEnabled: true,
          })
          break
        case 'alight':
          // Alight Motion-style (from the Nova study): phone-editor DNA —
          // layer stack first, big timeline, inspector on the right.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'media',
            leftDockWidth: 264,
            rightOpen: true,
            rightPanelWidth: 288,
            timelineHeight: 380,
            drawingEnabled: false,
            leftPanelFloating: false,
            rightPanelFloating: false,
            timelineFloating: false,
            timelineCollapsed: false,
          })
          break
        case 'capcut':
          // CapCut-style: media-first left dock, right inspector, tall timeline.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: true,
            leftTab: 'media',
            leftDockWidth: 300,
            rightOpen: true,
            rightPanelWidth: 300,
            timelineHeight: 320,
            drawingEnabled: false,
            leftPanelFloating: false,
            rightPanelFloating: false,
          })
          break
        case 'cinema':
          // Cinema: everything docked away for a pure clean-screen review pass.
          set({
            workspacePreset: preset,
            focusMode: 'none',
            leftOpen: false,
            rightOpen: false,
            timelineHeight: 180,
            drawingEnabled: false,
            leftPanelFloating: false,
            rightPanelFloating: false,
          })
          break
      }
    },
    setFocusMode: (mode) => {
      if (mode === 'none') {
        const currentPreset = get().workspacePreset
        get().setWorkspacePreset(currentPreset)
        return
      }
      set({ focusMode: mode, timelineCollapsed: false, timelineFloating: false })
      if (mode === 'canvas-only') {
        set({ leftOpen: false, rightOpen: false, timelineHeight: 0 })
      } else if (mode === 'preview') {
        set({ leftOpen: false, rightOpen: false, timelineHeight: 140 })
      } else if (mode === 'timeline') {
        set({ leftOpen: false, rightOpen: false, timelineHeight: 520 })
      } else if (mode === 'one-panel') {
        set({ leftOpen: false, rightOpen: true, timelineHeight: 160 })
      }
    },
    setTimelineHeight: (height) =>
      set({ timelineHeight: Math.max(120, Math.min(600, height)), timelineCollapsed: false }),
    setLeftDockWidth: (width) => set({ leftDockWidth: Math.max(220, Math.min(600, width)) }),
    setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(220, Math.min(500, width)) }),
    setRightPanelFloating: (v) => {
      if (!v) {
        set({ rightPanelFloating: false })
        return
      }
      // First float: place the window over the right side of the preview.
      const cur = get().rightPanelFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(cur.w || 340, vw - 32)
      const h = Math.min(cur.h || 560, vh - 120)
      const x = cur.x > 0 ? cur.x : Math.max(16, vw - w - 64)
      const y = cur.y > 0 ? cur.y : 88
      set({ rightPanelFloating: true, rightPanelFloat: { x, y, w, h } })
    },
    setTimelineCollapsed: (v) => set({ timelineCollapsed: v }),
    setTimelineFloating: (v) => {
      if (!v) {
        set({ timelineFloating: false })
        return
      }
      // First float: a wide, timeline-shaped window over the lower half.
      const cur = get().timelineFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(cur.w || 900, vw - 32)
      const h = Math.min(cur.h || 380, vh - 160)
      const x = cur.x > 0 ? cur.x : Math.max(16, (vw - w) / 2)
      const y = cur.y > 0 ? cur.y : Math.max(64, vh - h - 48)
      set({ timelineFloating: true, timelineCollapsed: false, timelineFloat: { x, y, w, h } })
    },
    setTimelineFloat: (patch) => {
      const cur = get().timelineFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.max(420, Math.min(patch.w ?? cur.w, vw - 24))
      const h = Math.max(200, Math.min(patch.h ?? cur.h, vh - 96))
      const x = Math.max(0, Math.min(patch.x ?? cur.x, vw - w))
      const y = Math.max(40, Math.min(patch.y ?? cur.y, vh - 48))
      set({ timelineFloat: { x, y, w, h } })
    },
    bumpFloatZ: () => {
      const z = get().floatZ + 1
      set({ floatZ: z })
      return z
    },
    setLeftPanelFloating: (v) => {
      if (!v) {
        set({ leftPanelFloating: false })
        return
      }
      // First float: place the window over the left side of the preview.
      const cur = get().leftPanelFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(cur.w || 380, vw - 32)
      const h = Math.min(cur.h || 560, vh - 120)
      const x = cur.x > 0 ? cur.x : Math.max(16, (vw - w) / 2 - 120)
      const y = cur.y > 0 ? cur.y : 88
      set({ leftPanelFloating: true, leftPanelFloat: { x, y, w, h } })
    },
    setLeftPanelFloat: (patch) => {
      const cur = get().leftPanelFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.max(240, Math.min(patch.w ?? cur.w, vw - 24))
      const h = Math.max(280, Math.min(patch.h ?? cur.h, vh - 96))
      const x = Math.max(0, Math.min(patch.x ?? cur.x, vw - w))
      const y = Math.max(40, Math.min(patch.y ?? cur.y, vh - 48))
      set({ leftPanelFloat: { x, y, w, h } })
    },
    setSidebarSectionMode: (mode) => set({ sidebarSectionMode: mode }),
    setRightPanelFloat: (patch) => {
      const cur = get().rightPanelFloat
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.max(280, Math.min(patch.w ?? cur.w, vw - 24))
      const h = Math.max(320, Math.min(patch.h ?? cur.h, vh - 96))
      const x = Math.max(0, Math.min(patch.x ?? cur.x, vw - w))
      const y = Math.max(40, Math.min(patch.y ?? cur.y, vh - 48))
      set({ rightPanelFloat: { x, y, w, h } })
    },
    saveCustomWorkspace: (name) => {
      const s = get()
      const id = uid('ws')
      const newWs: CustomWorkspace = {
        id,
        name: name.trim() || `Workspace ${s.customWorkspaces.length + 1}`,
        createdAt: Date.now(),
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        leftDockWidth: s.leftDockWidth,
        rightPanelWidth: s.rightPanelWidth,
        timelineHeight: s.timelineHeight,
        focusMode: s.focusMode,
      }
      const updated = [...s.customWorkspaces, newWs]
      try {
        localStorage.setItem('omniframe.customWorkspaces', JSON.stringify(updated))
      } catch {}
      set({ customWorkspaces: updated })
      return id
    },
    applyCustomWorkspace: (id) => {
      const ws = get().customWorkspaces.find((w) => w.id === id)
      if (!ws) return
      set({
        leftOpen: ws.leftOpen,
        rightOpen: ws.rightOpen,
        leftDockWidth: ws.leftDockWidth,
        rightPanelWidth: ws.rightPanelWidth,
        timelineHeight: ws.timelineHeight,
        focusMode: ws.focusMode,
        leftPanelFloating: false,
        rightPanelFloating: false,
        timelineFloating: false,
        timelineCollapsed: false,
      })
    },
    deleteCustomWorkspace: (id) => {
      const updated = get().customWorkspaces.filter((w) => w.id !== id)
      try {
        localStorage.setItem('omniframe.customWorkspaces', JSON.stringify(updated))
      } catch {}
      set({ customWorkspaces: updated })
    },
    resetLayoutToDefault: () => {
      get().setWorkspacePreset('default')
    },

    // ---- CapCut-style effect instances on clips (board J) ----
    setActiveFx: (sel) => set({ activeFx: sel, ...(sel ? { selectedClipId: sel.clipId, selectedTransitionId: null } : {}) }),

    requestRightSection: (id) => set({ rightFocus: { id, nonce: Date.now() }, rightOpen: true }),

    addFxInstance: (clipId, catalogId, opts) => {
      const s = get()
      const clip = s.clips.find((c) => c.id === clipId)
      if (!clip) return null
      // Only image / video / compound clips accept dropped effects.
      const asset = s.assets.find((a) => a.id === clip.assetId)
      const allowed =
        clip.kind === 'compound' ||
        clip.kind === 'image' ||
        clip.kind === 'video' ||
        asset?.kind === 'image' ||
        asset?.kind === 'video'
      if (!allowed || clip.kind === 'adjustment' || clip.kind === 'audio' || clip.kind === 'text' || !!clip.textStyle) return null
      const entry = fxCatalogById(catalogId)
      if (!entry) return null
      pushSnapshot()
      const fxId = uid('fx')
      // A dropped effect spans the FULL clip length by default; the closed
      // container clamp keeps it inside the parent forever.
      const range = clampFxToClip(opts?.inP ?? 0, opts?.duration ?? clip.duration, clip.duration)
      const inst: FxInstance = {
        id: fxId,
        catalogId,
        name: entry.name,
        inP: range.inP,
        duration: range.duration,
        params: { ...entry.patch },
        keys: {},
        enabled: true,
      }
      set((st) => ({
        clips: st.clips.map((c) => (c.id === clipId ? { ...c, fxInstances: [...(c.fxInstances || []), inst] } : c)),
        selectedClipId: clipId,
        selectedTransitionId: null,
        activeFx: { clipId, fxId },
      }))
      // Auto-open the connected right-panel section for the settings.
      get().requestRightSection('fxstack')
      return fxId
    },

    addFxAdjustment: (catalogId, opts) => {
      const entry = fxCatalogById(catalogId)
      if (!entry) return null
      // Standalone effect clip: grades every track BELOW it (track 1 fx hits
      // tracks 2..5; track 2 fx never touches track 1).
      return get().addAdjustmentLayer({
        name: `FX: ${entry.name}`,
        effects: { ...(entry.patch as unknown as import('./types').ClipEffect) },
        start: opts?.start,
        duration: opts?.duration,
        trackId: opts?.trackId,
      })
    },

    updateFxParams: (clipId, fxId, patch) => {
      if (!get().inInteraction) pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : {
            ...c,
            fxInstances: (c.fxInstances || []).map((f) => (f.id !== fxId ? f : { ...f, params: { ...f.params, ...patch } })),
          },
        ),
      }))
    },

    setFxRange: (clipId, fxId, inP, duration) => {
      const s = get()
      const clip = s.clips.find((c) => c.id === clipId)
      const inst = clip?.fxInstances?.find((f) => f.id === fxId)
      if (!clip || !inst) return
      // The container is closed: every drag step re-clamps against the
      // parent's CURRENT length so handles can never leak outside.
      const range = clampFxToClip(inP ?? inst.inP, duration ?? inst.duration, clip.duration)
      if (range.inP === inst.inP && range.duration === inst.duration) return
      if (!s.inInteraction) pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : {
            ...c,
            fxInstances: (c.fxInstances || []).map((f) => (f.id !== fxId ? f : { ...f, inP: range.inP, duration: range.duration })),
          },
        ),
      }))
    },

    setFxKey: (clipId, fxId, param, t, v) => {
      pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : {
            ...c,
            fxInstances: (c.fxInstances || []).map((f) => {
              if (f.id !== fxId) return f
              const keys = { ...(f.keys || {}) }
              const list = [...(keys[param] || [])].filter((k) => Math.abs(k.t - t) > 1e-6)
              list.push({ t, v })
              list.sort((a, b) => a.t - b.t)
              keys[param] = list
              return { ...f, keys }
            }),
          },
        ),
      }))
    },

    removeFxKey: (clipId, fxId, param, t) => {
      pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : {
            ...c,
            fxInstances: (c.fxInstances || []).map((f) => {
              if (f.id !== fxId) return f
              const keys = { ...(f.keys || {}) }
              if (t === undefined) delete keys[param]
              else keys[param] = (keys[param] || []).filter((k) => Math.abs(k.t - t) > 1e-6)
              if (keys[param] && keys[param].length === 0) delete keys[param]
              return { ...f, keys }
            }),
          },
        ),
      }))
    },

    toggleFxEnabled: (clipId, fxId) => {
      pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : {
            ...c,
            fxInstances: (c.fxInstances || []).map((f) => (f.id !== fxId ? f : { ...f, enabled: !f.enabled })),
          },
        ),
      }))
    },

    duplicateFxInstance: (clipId, fxId) => {
      const s = get()
      const clip = s.clips.find((c) => c.id === clipId)
      const inst = clip?.fxInstances?.find((f) => f.id === fxId)
      if (!clip || !inst) return null
      pushSnapshot()
      const newId = uid('fx')
      // Offset the copy when it still fits inside the closed container.
      const wantIn = inst.inP + inst.duration <= clip.duration - FX_MIN_DUR ? inst.inP + inst.duration : inst.inP
      const range = clampFxToClip(wantIn, inst.duration, clip.duration)
      const copy: FxInstance = { ...inst, id: newId, inP: range.inP, duration: range.duration, keys: inst.keys ? structuredClone(inst.keys) : {} }
      set((st) => ({
        clips: st.clips.map((c) => (c.id === clipId ? { ...c, fxInstances: [...(c.fxInstances || []), copy] } : c)),
        activeFx: { clipId, fxId: newId },
      }))
      get().requestRightSection('fxstack')
      return newId
    },

    moveFxInstance: (clipId, fxId, direction) => {
      const clip = get().clips.find(c => c.id === clipId)
      const list = [...(clip?.fxInstances || [])]
      const from = list.findIndex(f => f.id === fxId), to = from + direction
      if (from < 0 || to < 0 || to >= list.length) return
      pushSnapshot()
      ;[list[from], list[to]] = [list[to], list[from]]
      set(st => ({ clips: st.clips.map(c => c.id === clipId ? { ...c, fxInstances: list } : c) }))
    },

    removeFxInstance: (clipId, fxId) => {
      const s = get()
      const clip = s.clips.find((c) => c.id === clipId)
      if (!clip?.fxInstances?.some((f) => f.id === fxId)) return
      pushSnapshot()
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id !== clipId ? c : { ...c, fxInstances: (c.fxInstances || []).filter((f) => f.id !== fxId) },
        ),
        activeFx: st.activeFx && st.activeFx.fxId === fxId ? null : st.activeFx,
      }))
    },

    removeActiveFx: () => {
      const a = get().activeFx
      if (a) get().removeFxInstance(a.clipId, a.fxId)
    },

    beginHistory: () => {
      if (!get().inInteraction) {
        pushSnapshot()
        set({ inInteraction: true })
      }
    },
    endHistory: () => set({ inInteraction: false }),

    undo: () => {
      const { past, future } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      const current = cloneDoc(get())
      set({
        tracks: prev.tracks,
        clips: prev.clips,
        transitions: prev.transitions || [],
        drawingStrokes: prev.drawingStrokes || [],
        paintLayers: prev.paintLayers || [{ id: 'default-paint-layer', name: 'Paint 1', visible: true, locked: false, opacity: 1 }],
        markers: prev.markers || [],
        linkSets: prev.linkSets || [],
        parentRelationships: prev.parentRelationships || [],
        groups: prev.groups || [],
        sequences: prev.sequences || [],
        activeSequenceId: prev.activeSequenceId || 'main',
        breadcrumbs: prev.breadcrumbs || [{ id: 'main', name: 'Main Timeline' }],
        past: past.slice(0, -1),
        future: [...future.slice(-49), current],
        duration: recompute(prev.clips),
        selectedClipId: prev.clips.some(c=>c.id===get().selectedClipId)?get().selectedClipId:null,
        selectedClipIds: get().selectedClipIds.filter(id=>prev.clips.some(c=>c.id===id)),
        selectedTransitionId: prev.transitions?.some(t=>t.id===get().selectedTransitionId)?get().selectedTransitionId:null,
      })
    },
    redo: () => {
      const { past, future } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      const current = cloneDoc(get())
      set({
        tracks: next.tracks,
        clips: next.clips,
        transitions: next.transitions || [],
        drawingStrokes: next.drawingStrokes || [],
        paintLayers: next.paintLayers || [{ id: 'default-paint-layer', name: 'Paint 1', visible: true, locked: false, opacity: 1 }],
        markers: next.markers || [],
        linkSets: next.linkSets || [],
        parentRelationships: next.parentRelationships || [],
        groups: next.groups || [],
        sequences: next.sequences || [],
        activeSequenceId: next.activeSequenceId || 'main',
        breadcrumbs: next.breadcrumbs || [{ id: 'main', name: 'Main Timeline' }],
        future: future.slice(0, -1),
        past: [...past.slice(-49), current],
        duration: recompute(next.clips),
        selectedClipId: next.clips.some(c=>c.id===get().selectedClipId)?get().selectedClipId:null,
        selectedClipIds: get().selectedClipIds.filter(id=>next.clips.some(c=>c.id===id)),
        selectedTransitionId: next.transitions?.some(t=>t.id===get().selectedTransitionId)?get().selectedTransitionId:null,
      })
    },

    // ---- markers initial state & actions ----
    markers: [],
    markerCustomColors: (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('omniframe.markerColors') : null
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 24) : []
      } catch { return [] }
    })(),
    lastMarkerKind: (() => {
      try {
        const k = typeof localStorage !== 'undefined' ? localStorage.getItem('omniframe.markerKind') : null
        return k && MARKER_KINDS.some((d) => d.id === k) ? k : 'beat'
      } catch { return 'beat' }
    })(),
    activeMarkerModalId: null,
    setActiveMarkerModalId: (id) => set({ activeMarkerModalId: id }),
    addMarker: (marker) => {
      const id = uid('marker')
      const newMarker: TimelineMarker = {
        id,
        time: Math.max(0, marker.time),
        duration: Math.max(0, marker.duration || 0),
        label: marker.label.trim() || 'Marker',
        notes: marker.notes || '',
        color: markerColorHex(marker.color, marker.kind),
        kind: marker.kind || 'custom',
        ...(marker.clipId ? { clipId: marker.clipId, clipOffset: Math.max(0, marker.clipOffset || 0) } : {}),
      }
      pushSnapshot()
      set((s) => ({
        markers: [...s.markers, newMarker].sort((a, b) => a.time - b.time),
      }))
      return id
    },
    updateMarker: (id, patch) => {
      pushSnapshot()
      set((s) => ({
        markers: s.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)).sort((a, b) => a.time - b.time),
      }))
    },
    removeMarker: (id) => {
      pushSnapshot()
      set((s) => ({
        markers: s.markers.filter((m) => m.id !== id),
        activeMarkerModalId: s.activeMarkerModalId === id ? null : s.activeMarkerModalId,
      }))
    },
    clearMarkers: () => {
      pushSnapshot()
      set({ markers: [], activeMarkerModalId: null })
    },
    jumpToMarker: (id) => {
      const marker = get().markers.find((m) => m.id === id)
      if (marker) get().setPlayhead(marker.time)
    },
    jumpToNextMarker: () => {
      const { markers, playhead } = get()
      const next = markers.find((m) => m.time > playhead + 0.05)
      if (next) get().setPlayhead(next.time)
    },
    jumpToPrevMarker: () => {
      const { markers, playhead } = get()
      const prev = [...markers].reverse().find((m) => m.time < playhead - 0.05)
      if (prev) get().setPlayhead(prev.time)
    },

    addCustomMarkerColor: (hex) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
      const next = [hex.toLowerCase(), ...get().markerCustomColors.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 24)
      set({ markerCustomColors: next })
      try { localStorage.setItem('omniframe.markerColors', JSON.stringify(next)) } catch { /* ignore */ }
    },

    setLastMarkerKind: (kind) => {
      set({ lastMarkerKind: kind })
      try { localStorage.setItem('omniframe.markerKind', kind) } catch { /* ignore */ }
    },

    addMarkersBulk: (items) => {
      if (!items.length) return []
      pushSnapshot()
      const created = items.map((item) => ({
        id: uid('marker'),
        time: Math.max(0, item.time),
        duration: Math.max(0, item.duration || 0),
        label: (item.label || 'Marker').trim() || 'Marker',
        notes: item.notes || '',
        color: markerColorHex(item.color, item.kind),
        kind: item.kind || 'custom',
        ...(item.clipId ? { clipId: item.clipId, clipOffset: Math.max(0, item.clipOffset || 0) } : {}),
      }))
      set((s) => ({ markers: [...s.markers, ...created].sort((a, b) => a.time - b.time) }))
      return created.map((m) => m.id)
    },

    moveMarkersToClip: (clipId) => {
      const clip = get().clips.find((c) => c.id === clipId)
      if (!clip) return 0
      const end = clip.start + clip.duration
      let moved = 0
      pushSnapshot()
      set((s) => ({
        markers: s.markers.map((m) => {
          if (m.clipId) return m
          if (m.time >= clip.start - 0.001 && m.time <= end + 0.001) {
            moved++
            return { ...m, clipId, clipOffset: Math.max(0, m.time - clip.start) }
          }
          return m
        }),
      }))
      return moved
    },

    moveMarkersToTimeline: (clipId) => {
      const clip = get().clips.find((c) => c.id === clipId)
      if (!clip) return 0
      let moved = 0
      pushSnapshot()
      set((s) => ({
        markers: s.markers.map((m) => {
          if (m.clipId !== clipId) return m
          moved++
          const { clipId: _drop, clipOffset, ...rest } = m
          void _drop
          return { ...rest, time: clip.start + (clipOffset ?? 0) }
        }),
      }))
      return moved
    },

    // ---- master audio ----
    masterVolume: 1.0,
    setMasterVolume: (vol) => set({ masterVolume: Math.max(0, Math.min(1.5, vol)) }),
    masterMuted: false,
    setMasterMuted: (muted) => set({ masterMuted: muted }),

    // ---- clone stamp ----
    cloneSourcePoint: null,
    setCloneSourcePoint: (pt) => set({ cloneSourcePoint: pt }),

    // ---- link sets, parenting & groups actions ----
    createLinkSet: (memberIds, customRules, name) => {
      const id = uid('linkset')
      const defaultRules: Record<LinkRuleType, boolean> = {
        motion: true,
        duration: true,
        delete: true,
        selection: true,
        property: false,
        visibility: false,
        lock: false,
      }
      const newSet: LinkSet = {
        id,
        name: name || `Link Set ${get().linkSets.length + 1}`,
        memberIds: [...new Set(memberIds)],
        rules: { ...defaultRules, ...customRules },
        createdAt: Date.now(),
      }
      pushSnapshot()
      set((s) => ({ linkSets: [...s.linkSets, newSet] }))
      return id
    },
    removeLinkSet: (id) => {
      pushSnapshot()
      set((s) => ({ linkSets: s.linkSets.filter((ls) => ls.id !== id) }))
    },
    toggleLinkRule: (linkSetId, rule) => {
      pushSnapshot()
      set((s) => ({
        linkSets: s.linkSets.map((ls) =>
          ls.id === linkSetId
            ? { ...ls, rules: { ...ls.rules, [rule]: !ls.rules[rule] } }
            : ls,
        ),
      }))
    },
    arrangeLinkedElements: (linkSetId) => {
      const linkSet = get().linkSets.find((ls) => ls.id === linkSetId)
      if (!linkSet || linkSet.memberIds.length === 0) return
      const memberClips = get().clips.filter((c) => linkSet.memberIds.includes(c.id))
      if (memberClips.length === 0) return

      pushSnapshot()
      const minStart = Math.min(...memberClips.map((c) => c.start))
      set((s) => {
        const clips = s.clips.map((c) => {
          if (linkSet.memberIds.includes(c.id)) {
            return { ...c, start: minStart }
          }
          return c
        })
        return { clips, duration: recompute(clips) }
      })
    },
    createParentRelationship: (parentId, childId) => {
      if (parentId === childId) return
      const currentRels = get().parentRelationships
      let curr: string | undefined = parentId
      while (curr) {
        if (curr === childId) return
        const nextRel = currentRels.find((r) => r.childId === curr)
        curr = nextRel?.parentId
      }
      pushSnapshot()
      set((s) => ({
        parentRelationships: [
          ...s.parentRelationships.filter((r) => r.childId !== childId),
          { parentId, childId, inheritPosition: true, inheritRotation: true, inheritScale: true, localOffset: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } },
        ],
      }))
    },
    removeParentRelationship: (childId) => {
      pushSnapshot()
      set((s) => ({
        parentRelationships: s.parentRelationships.filter((r) => r.childId !== childId),
      }))
    },
    createGroup: (memberIds, name) => {
      const id = uid('group')
      const newGroup: GroupInstance = {
        id,
        name: name || `Group ${get().groups.length + 1}`,
        memberIds: [...new Set(memberIds)],
        collapsed: false,
        locked: false,
        hidden: false,
      }
      pushSnapshot()
      set((s) => ({ groups: [...s.groups, newGroup] }))
      return id
    },
    groupSelection: () => {
      const ids = [...new Set(get().selectedClipIds || [])]
      if (ids.length < 2) return null
      pushSnapshot()
      const id = uid('group')
      const groups = regroupFor(get().groups, ids)
      const g: GroupInstance = { id, name: `Group ${get().groups.length + 1}`, memberIds: ids, collapsed: false, locked: false, hidden: false }
      set({ groups: [...groups, g] })
      return id
    },
    ungroupSelection: () => {
      const ids = new Set(get().selectedClipIds || [])
      if (!get().groups.some((g) => g.memberIds.some((m) => ids.has(m)))) return
      pushSnapshot()
      set((s) => ({ groups: s.groups.filter((g) => !g.memberIds.some((m) => ids.has(m))) }))
    },
    addNullObject: () => {
      const st = get()
      const track = st.tracks.find((t) => t.type === 'video') || makeTrack('video', 'Nulls')
      const id = uid('clip-null')
      const n = st.clips.filter((c) => c.kind === 'null').length + 1
      const clip: Clip = {
        id,
        trackId: track.id,
        assetId: '',
        start: st.playhead ?? 0,
        duration: 5,
        inPoint: 0,
        name: `Null ${n}`,
        kind: 'null',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
      }
      pushSnapshot()
      set((s) => ({
        tracks: s.tracks.some((t) => t.id === track.id) ? s.tracks : [track, ...s.tracks],
        clips: [...s.clips, clip],
        selectedClipId: id,
        selectedClipIds: [id],
      }))
      return id
    },
    bakeTrackingToNull: (sessionId) => {
      const st = get()
      const sessions = st.trackingSessions || []
      const session =
        (sessionId && sessions.find((t) => t.id === sessionId)) ||
        [...sessions].reverse().find((t) => (t.points || []).length > 1)
      if (!session || session.points.length < 2) return null
      const fps = st.projectFps || 30
      const target = st.clips.find((c) => c.id === session.targetClipId)
      const t0 = target?.start ?? 0
      const f0 = session.points[0].frame
      const span = (session.points[session.points.length - 1].frame - f0) / fps
      const duration = Math.max(0.5, Math.min(5, span + 0.4))
      // project space matches playback (PW/PH = 1280x720); transform x/y are px, 0 = centred
      const kf = (pt: TrackPoint, axis: 'x' | 'y'): KeyframeNode => ({
        id: uid(`kf-${axis}`),
        time: t0 + (pt.frame - f0) / fps,
        value: axis === 'x' ? (pt.x - 0.5) * 1280 : (pt.y - 0.5) * 720,
        interpolation: 'linear',
      })
      const curve = (pid: string, ch: 'X' | 'Y', label: string, color: string, pts: KeyframeNode[]) => ({
        id: pid, property: 'position', channel: ch, label, color, defaultValue: 0, unit: 'px', keyframes: pts,
        extrapolationBefore: 'constant' as const, extrapolationAfter: 'constant' as const,
      })
      const id = uid('clip-null')
      const n = st.clips.filter((c) => c.kind === 'null').length + 1
      const track = st.tracks.find((t) => t.type === 'video') || makeTrack('video', 'Nulls')
      const clip: Clip = {
        id,
        trackId: track.id,
        assetId: '',
        start: t0,
        duration,
        inPoint: 0,
        name: `Null Track ${n}`,
        kind: 'null',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
        animation: {
          curves: {
            position_x: curve('position_x', 'X', 'Position X', '#ef4444', session.points.map((pt) => kf(pt, 'x'))),
            position_y: curve('position_y', 'Y', 'Position Y', '#22c55e', session.points.map((pt) => kf(pt, 'y'))),
          },
        },
      }
      pushSnapshot()
      set((s2) => ({
        tracks: s2.tracks.some((t) => t.id === track.id) ? s2.tracks : [track, ...s2.tracks],
        clips: [...s2.clips, clip],
        selectedClipId: id,
        selectedClipIds: [id],
      }))
      return id
    },
    removeGroup: (groupId) => {
      pushSnapshot()
      set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }))
    },

    // ---- tracking subsystem actions ----
    addTrackingSession: (session) => {
      set((s) => ({ trackingSessions: [...s.trackingSessions, session] }))
    },
    updateTrackingSession: (id, patch) => {
      set((s) => ({
        trackingSessions: s.trackingSessions.map((ts) =>
          ts.id === id ? { ...ts, ...patch } : ts,
        ),
      }))
    },

    // ---- 3D materials & textures actions ----
    shareTexture: (sourceMatId, targetMatId) => {
      pushSnapshot()
      set((s) => {
        const srcMat = s.materials.find((m) => m.id === sourceMatId)
        if (!srcMat) return s
        const oldTexId = s.materials.find((m) => m.id === targetMatId)?.textureId
        const materials = s.materials.map((m) =>
          m.id === targetMatId ? { ...m, textureId: srcMat.textureId } : m,
        )
        const textures = s.textures.map((t) => {
          if (t.id === srcMat.textureId) return { ...t, usersCount: (t.usersCount ?? 1) + 1 }
          if (t.id === oldTexId) return { ...t, usersCount: Math.max(1, (t.usersCount ?? 1) - 1) }
          return t
        })
        return { materials, textures }
      })
    },
    makeTextureUnique: (matId) => {
      const mat = get().materials.find((m) => m.id === matId)
      if (!mat) return
      const tex = get().textures.find((t) => t.id === mat.textureId)
      if (!tex || (tex.usersCount ?? 1) <= 1) return

      pushSnapshot()
      const newTexId = uid('tex')
      const newTex: TextureAsset = {
        ...tex,
        id: newTexId,
        name: `${tex.name} (Unique)`,
        usersCount: 1,
      }
      set((s) => ({
        textures: [
          ...s.textures.map((t) => (t.id === tex.id ? { ...t, usersCount: (t.usersCount ?? 1) - 1 } : t)),
          newTex,
        ],
        materials: s.materials.map((m) => (m.id === matId ? { ...m, textureId: newTexId } : m)),
      }))
    },

    // ---- background removal actions ----
    setActiveBgRemovalJob: (job) => set({ activeBgRemovalJob: job }),

    runGuidedRectBackgroundRemoval: async (rectOverride, hint, destination = 'omniframe') => {
      const sel = get().activeSelection
      const rect = rectOverride || sel?.bounds
      if (!rect || rect.width <= 0.01 || rect.height <= 0.01) return null

      // Resolve the frame currently under the playhead as a drawable source.
      const clip =
        get().clips.find((c) => c.id === get().selectedClipId) ||
        get().clips.find((c) => get().playhead >= c.start && get().playhead <= c.start + c.duration) ||
        get().clips[0]
      const asset = clip ? get().assets.find((a) => a.id === clip.assetId) : undefined
      if (!asset) return null

      set({ guidedMatteBusy: true })
      try {
        const source = await loadDrawableSource(asset)
        if (!source) return null
        const sw = (source as HTMLImageElement).naturalWidth || asset.width || 1920
        const sh = (source as HTMLImageElement).naturalHeight || asset.height || 1080

        const result: GuidedMattingResult = guidedRectMatting({
          source,
          sourceWidth: sw,
          sourceHeight: sh,
          rect,
          iterations: 4,
          borderBand: 12,
          feather: 2,
          components: 5,
          maxWorkingEdge: 900,
          hint,
        })

        pushSnapshot()

        // A guided matte created in OmniFrame stays detached from Drawing paint
        // layers by default. Drawing mode may apply it directly to its active
        // layer; cross-mode application uses the explicit apply action.
        let layerId: string | undefined
        if (destination === 'drawing') {
          layerId = get().activePaintLayerId || get().paintLayers[0]?.id
          if (layerId) {
            set((st) => ({
              paintLayers: st.paintLayers.map((l) =>
                l.id === layerId ? { ...l, maskDataUrl: result.maskDataUrl } : l,
              ),
            }))
          }
        }

        // OmniFrame owns the movable cutout object. Drawing mode gets only a
        // Drawing-layer matte, rather than creating cross-mode content too.
        let objectId: string | undefined
        if (destination === 'omniframe') {
          objectId = `obj_guided_${Date.now()}`
          const newChar: OmniframeCharacter = {
            id: objectId,
            name: 'Guided Cutout',
            label: 'Guided Rect Background Removal',
            bounds: { ...rect },
            cutoutUrl: result.cutoutDataUrl,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            scope: 'all',
          }
          set((st) => ({
            omniframeCharacters: [...st.omniframeCharacters, newChar],
            selectedCharacterId: objectId,
          }))
        }

        const record: GuidedMatteRecord = {
          id: uid('guided'),
          rect: { ...rect },
          maskDataUrl: result.maskDataUrl,
          cutoutDataUrl: result.cutoutDataUrl,
          width: result.width,
          height: result.height,
          coverage: result.coverage,
          confidence: result.confidence,
          iterations: result.iterations,
          seedStats: result.seedStats,
          timings: result.timings,
          objectId,
          maskLayerId: layerId,
          createdAt: Date.now(),
        }
        set({ guidedMatte: record, guidedMatteBusy: false })
        return record
      } catch (err) {
        set({ guidedMatteBusy: false })
        return null
      }
    },

    applyGuidedMatteToDrawingLayer: (layerId) => {
      const matte = get().guidedMatte
      if (!matte) return
      const targetLayerId = layerId || get().activePaintLayerId || get().paintLayers[0]?.id
      if (!targetLayerId || !get().paintLayers.some((layer) => layer.id === targetLayerId)) return

      pushSnapshot()
      set((state) => ({
        paintLayers: state.paintLayers.map((layer) =>
          layer.id === targetLayerId ? { ...layer, maskDataUrl: matte.maskDataUrl } : layer,
        ),
        guidedMatte: state.guidedMatte
          ? { ...state.guidedMatte, maskLayerId: targetLayerId }
          : null,
      }))
    },
    clearGuidedMatte: () => set({ guidedMatte: null }),

    newProject: () => {
      for (const asset of get().assets) URL.revokeObjectURL(asset.url)
      set({
        assets: [],
        tracks: [],
        clips: [],
        transitions: [],
        drawingStrokes: [],
        paintLayers: [{ id: 'default-paint-layer', name: 'Paint 1', visible: true, locked: false, opacity: 1 }],
        markers: [],
        linkSets: [],
        parentRelationships: [],
        groups: [],
        trackingSessions: [],
        activeMarkerModalId: null,
        selectedTransitionId: null,
        playhead: 0,
        duration: 10,
        selectedClipId: null,
        selectedClipIds: [],
        sequences: [],
        activeSequenceId: 'main',
        breadcrumbs: [{ id: 'main', name: 'Main Timeline' }],
        past: [],
        future: [],
        playing: false,
      })
    },

    recomputeDuration: () => set((s) => ({ duration: recompute(s.clips) })),
  }
})

if (typeof window !== 'undefined') {
  ;(window as any).__omniframe_store = useEditor
  // Test hooks (qa/*.mjs): BS.1770 loudness measurement and the ONNX denoiser.
  ;(window as any).__omniframe_lufs = async (channels: Float32Array[], sampleRate: number) => {
    return measureIntegratedLufs(channels, sampleRate)
  }
  ;(window as any).__omniframe_denoise = {
    runBuffer: async (buffer: AudioBuffer, alpha = 1) => {
      return denoiseAudioBuffer(buffer, alpha)
    },
  }
}

async function decodeWaveform(file: File, bins = 256): Promise<number[] | undefined> {
  try {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return undefined
    const context = new Context()
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    const peaks = Array.from({ length: bins }, (_, bin) => {
      const from = Math.floor((bin / bins) * buffer.length)
      const to = Math.max(from + 1, Math.floor(((bin + 1) / bins) * buffer.length))
      let peak = 0
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel)
        const stride = Math.max(1, Math.floor((to - from) / 64))
        for (let i = from; i < to; i += stride) peak = Math.max(peak, Math.abs(data[i] || 0))
      }
      return peak
    })
    await context.close()
    const max = Math.max(...peaks, 0.001)
    return peaks.map((peak) => peak / max)
  } catch {
    return undefined
  }
}

async function captureVideoThumbnail(video: HTMLVideoElement): Promise<string | undefined> {
  try {
    video.currentTime = Math.min(Math.max(video.duration * 0.2, 0), 2)
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      video.onerror = () => resolve()
      setTimeout(resolve, 1500)
    })
    const vw = video.videoWidth || 160
    const vh = video.videoHeight || 90
    if (!vw || !vh) return undefined

    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    // Dark solid letterbox background
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Calculate aspect-ratio-preserving contain dimensions
    const videoAspect = vw / vh
    const canvasAspect = canvas.width / canvas.height
    let dw = canvas.width
    let dh = canvas.height
    if (videoAspect > canvasAspect) {
      dh = canvas.width / videoAspect
    } else {
      dw = canvas.height * videoAspect
    }
    const dx = (canvas.width - dw) / 2
    const dy = (canvas.height - dh) / 2

    ctx.drawImage(video, dx, dy, dw, dh)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return undefined
  }
}

function sourceDocumentFromFile(file: File, id: string): SourceDocument {
  return {
    id,
    fileName: file.name,
    format: file.name.split('.').pop()?.toLowerCase() || 'unknown',
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url: URL.createObjectURL(file),
    importedAt: Date.now(),
  }
}

// Read a File into a MediaAsset, probing real duration/dimensions and visual summaries.
async function readMediaFile(file: File): Promise<MediaAsset | null> {
  const url = URL.createObjectURL(file)
  const kind: MediaKindGuess = file.type.startsWith('video')
    ? 'video'
    : file.type.startsWith('audio')
      ? 'audio'
      : file.type.startsWith('image')
        ? 'image'
        : 'unknown'

  if (kind === 'unknown') {
    URL.revokeObjectURL(url)
    return null
  }

  try {
    if (kind === 'video' || kind === 'audio') {
      const el = document.createElement(kind === 'video' ? 'video' : 'audio') as HTMLVideoElement
      el.preload = 'metadata'
      el.src = url
      await new Promise<void>((res) => {
        el.onloadedmetadata = () => res()
        el.onerror = () => res()
        setTimeout(res, 4000)
      })
      const duration = isFinite(el.duration) ? el.duration : 5
      const width = (el as HTMLVideoElement).videoWidth || 0
      const height = (el as HTMLVideoElement).videoHeight || 0
      const thumbnail = kind === 'video' ? await captureVideoThumbnail(el as HTMLVideoElement) : undefined
      const waveform = kind === 'audio' ? await decodeWaveform(file) : undefined
      return {
        id: uid('asset'),
        name: file.name,
        kind,
        url,
        duration,
        width,
        height,
        size: file.size,
        thumbnail,
        waveform,
      }
    } else {
      const img = new Image()
      img.src = url
      await new Promise<void>((res) => {
        img.onload = () => res()
        img.onerror = () => res()
        setTimeout(res, 4000)
      })
      return {
        id: uid('asset'),
        name: file.name,
        kind: 'image',
        url,
        duration: 5,
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
      }
    }
  } catch {
    return {
      id: uid('asset'),
      name: file.name,
      kind,
      url,
      duration: 5,
      width: 0,
      height: 0,
      size: file.size,
    }
  }
}

type MediaKindGuess = 'video' | 'audio' | 'image' | 'unknown'
