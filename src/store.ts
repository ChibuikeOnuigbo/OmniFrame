import { recolorImage } from './lib/recolor'
import type { RecolorBlend } from './lib/recolor'
import { create } from 'zustand'
import type {
  Clip,
  MediaAsset,
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
  TimelineMarker,
  MarkerColor,
  LinkRuleType,
  LinkSet,
  ParentRelationship,
  GroupInstance,
  CursorConfig,
  TrackingSession,
  TextureAsset,
  MaterialInstance,
  BgRemovalJob,
  BlenderMode,
  Primitive3D,
  Scene3DObject,
  OmniframeCharacter,
  OmniframeScopeType,
  SelectionModeType,
  ClipMask,
  Sequence,
  TransparencyMask,
  BrushDynamics,
  GuidedMatteRecord,
} from './types'
import { guidedRectMatting, type GuidedMattingResult } from './lib/guidedMatting'
import { uid, clamp } from './lib/time'
import { createSelectionMask } from './lib/drawingEngine'
import { RATIO_PRESETS } from './lib/aspectRatios'
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
export type PreviewQuality = 'low' | 'medium' | 'high'
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
  redo: 'Ctrl+Shift+Z',
  playPause: 'Space',
  omniframe: 'Alt+O',
  threed: '3',
  speed: 'Ctrl+R',
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  enabled: true,
  pack: 'mac-gamified',
  theme: 'mac-gamified',
  size: 'bigger', // "bugger" enlarged as requested by user
  renderMode: 'follower',
  showClickBurst: true,
  showBadges: true, // + for drag, ? for help as requested by user
  showDragPill: true, // ghost pill with info when dragging
  showDropReticle: true, // magnetized drop target when over timeline tracks
  showTrail: true,
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
import { createRiggingSlice, type RiggingSlice } from './store/rigging'

interface EditorState extends RiggingSlice {
  assets: MediaAsset[]
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  selectedTransitionId: string | null
  playhead: number
  duration: number
  pxPerSec: number
  playing: boolean
  speed: number
  projectFps: number
  dropFrameTimecode: boolean
  previewQuality: PreviewQuality
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
  addTextTitleClip: (text?: string, duration?: number) => void

  // ---- media ----
  addAsset: (a: MediaAsset) => void
  importFiles: (files: FileList | File[]) => Promise<void>

  // ---- tracks / clips ----
  ensureTrack: (type: TrackType) => string
  createTrack: (type?: TrackType, position?: 'above' | 'below', referenceTrackId?: string) => string
  deleteTrack: (id: string) => void
  moveTrack: (sourceId: string, targetId: string, position: 'above' | 'below') => void
  setTrackHeight: (id: string, height: number) => void
  setTrackName: (id: string, name: string) => void
  addClipToTrack: (trackId: string, assetId: string, atTime?: number) => void
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
  setOnionSkin: (partial: Partial<OnionSkinSettings>) => void
  toggleOnionSkin: () => void
  setDrawingHoldFrames: (frames: number) => void
  stepFrame: (delta: number) => void
  setActiveSelection: (selection: ActiveSelection | null) => void
  clearSelection: () => void
  convertSelectionToMask: (layerId?: string) => void
  invertSelection: () => void
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
  ) => Promise<GuidedMatteRecord | null>
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

export const useEditor = create<EditorState>((set, get) => {
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
    assets: [
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
    ],
    tracks: [],
    clips: [],
    transitions: [],
    selectedTransitionId: null,
    playhead: 0,
    duration: 10,
    pxPerSec: 100,
    playing: false,
    speed: 1,
    projectFps: 30,
    dropFrameTimecode: false,
    previewQuality: typeof localStorage !== 'undefined' && ['low', 'medium', 'high'].includes(localStorage.getItem('omniframe.previewQuality') ?? '') ? localStorage.getItem('omniframe.previewQuality') as PreviewQuality : 'high',
    audioIsolationModel: 'omni-voicetarget',
    selectedClipId: null,
    selectedClipIds: [],
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
    },
    activeSelection: null,
    selectionMode: 'rect',
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

    setClipEffect: (id, effect) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, effects: { ...c.effects, ...effect } } : c,
        ),
      }))
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

    importFiles: async (files) => {
      const list = Array.from(files as ArrayLike<File>)
      for (const file of list) {
        const asset = await readMediaFile(file)
        if (!asset) continue
        get().addAsset(asset)
        // Invariant I-10: Media import adds to project library ONLY.
        // It does NOT insert into timeline. Loads into Source Monitor for preview.
        get().setSourcePreviewAsset(asset.id)
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
        selectedTransitionId: id,
      }))
      return id
    },

    updateTransition: (id, patch) => {
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
      set({ selectedTransitionId: id, selectedClipId: id ? null : get().selectedClipId })
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
          if (edge === 'left') {
            const maxStart = c.start + c.duration - MIN_CLIP
            const newStart = Math.min(maxStart, Math.max(0, value))
            const delta = newStart - c.start
            const newIn = Math.max(0, c.inPoint + delta)
            const newDur = c.duration - (newIn - c.inPoint)
            if (newDur < MIN_CLIP) return c
            return { ...c, start: newStart, inPoint: newIn, duration: newDur }
          } else {
            const newDur = clamp(value - c.start, MIN_CLIP, (srcMax || c.duration) - c.inPoint)
            return { ...c, duration: newDur }
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
        const left: Clip = { ...c, duration: offset }
        const right: Clip = {
          ...c,
          id: uid('clip'),
          start: time,
          duration: c.duration - offset,
          inPoint: c.inPoint + offset,
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

        return {
          clips,
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

    selectClip: (id) => set({ selectedClipId: id, selectedClipIds: id ? [id] : [] }),
    selectClips: (ids) => set({ selectedClipIds: ids, selectedClipId: ids[0] || null }),
    toggleClipSelection: (id, multi = false) => {
      const s = get()
      if (!multi) {
        set({ selectedClipId: id, selectedClipIds: id ? [id] : [] })
        return
      }
      const exists = s.selectedClipIds.includes(id)
      const newIds = exists ? s.selectedClipIds.filter((x) => x !== id) : [...s.selectedClipIds, id]
      set({ selectedClipIds: newIds, selectedClipId: newIds[newIds.length - 1] || null })
    },

    setClipProp: (id, partial) => {
      set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)) }))
    },

    setClipTransform: (id, partial) => {
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, transform: { ...c.transform, ...partial } } : c,
        ),
      }))
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

      set({
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
    setDropFrameTimecode: (enabled) => set((state) => ({
      dropFrameTimecode: enabled && (state.projectFps === 29.97 || state.projectFps === 59.94),
    })),
    setPreviewQuality: (previewQuality) => {
      localStorage.setItem('omniframe.previewQuality', previewQuality)
      set({ previewQuality })
    },
    setAudioIsolationModel: (model) => set({ audioIsolationModel: model }),

    setZoom: (px) => set({ pxPerSec: clamp(px, 8, 8000) }),
    zoomBy: (factor) => set((s) => ({ pxPerSec: clamp(s.pxPerSec * factor, 8, 8000) })),
    toggleSnapping: () => set((state) => ({ snapping: !state.snapping })),
    setScrubbing: (scrubbing) => set({ scrubbing }),

    setTool: (t) => set({ tool: t }),
    setLeftTab: (t) => set({ leftTab: t, leftOpen: true, activeSubMode: null }),
    setLeftOpen: (v) => set({ leftOpen: v }),
    setRightOpen: (v) => set({ rightOpen: v }),
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
      set((s) => ({ drawingStrokes: [...s.drawingStrokes, stroke] }))
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
    toggleDrawingEnabled: () => set((s) => ({ drawingEnabled: !s.drawingEnabled })),
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
      }
    },
    setFocusMode: (mode) => {
      if (mode === 'none') {
        const currentPreset = get().workspacePreset
        get().setWorkspacePreset(currentPreset)
        return
      }
      set({ focusMode: mode })
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
    setTimelineHeight: (height) => set({ timelineHeight: Math.max(120, Math.min(600, height)) }),
    setLeftDockWidth: (width) => set({ leftDockWidth: Math.max(220, Math.min(600, width)) }),
    setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(220, Math.min(500, width)) }),
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
        selectedClipId: null,
        selectedClipIds: [],
        selectedTransitionId: null,
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
        selectedClipId: null,
        selectedClipIds: [],
        selectedTransitionId: null,
      })
    },

    // ---- markers initial state & actions ----
    markers: [],
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
        color: marker.color || 'blue',
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

    runGuidedRectBackgroundRemoval: async (rectOverride, hint) => {
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

        // 1. Non-destructive mask layer on the active paint layer
        const layerId = get().activePaintLayerId || get().paintLayers[0]?.id
        if (layerId) {
          set((st) => ({
            paintLayers: st.paintLayers.map((l) =>
              l.id === layerId
                ? {
                    ...l,
                    maskDataUrl: result.maskDataUrl,
                    transparencyMask: {
                      id: l.transparencyMask?.id || uid('mask'),
                      parentLayerId: layerId,
                      name: 'Guided Rect Matte',
                      enabled: true,
                      inverted: false,
                      opacity: 1,
                      dataUrl: result.maskDataUrl,
                    },
                  }
                : l,
            ),
            activeMaskId: get().activeMaskId,
          }))
        }

        // 2. OmniFrame object layered from the matte (movable, recolorable)
        const objectId = `obj_guided_${Date.now()}`
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
