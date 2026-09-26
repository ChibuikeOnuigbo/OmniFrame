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
  TrackingSession,
  TextureAsset,
  MaterialInstance,
  BgRemovalJob,
  BlenderMode,
  Primitive3D,
  Scene3DObject,
  OmniframeCharacter,
  OmniframeScopeType,
  ClipMask,
} from './types'
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
  }
}

export interface EditorState {
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
  drawingHoldFrames: number
  onionSkin: OnionSkinSettings
  activeSelection: ActiveSelection | null

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
        height: 941,
        fps: 30,
        size: 1548200,
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
    tool: 'select',
    leftTab: 'media',
    leftOpen: true,
    rightOpen: true,
    past: [],
    future: [],
    inInteraction: false,
    snapping: true,
    scrubbing: false,

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

    selectClip: (id) => set({ selectedClipId: id }),

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

    setPlayhead: (t) => set((s) => ({ playhead: clamp(t, 0, s.duration) })),
    play: () => set((s) => ({
      playhead: s.playhead >= s.duration - 0.001 ? 0 : s.playhead,
      playing: true,
    })),
    pause: () => set({ playing: false }),
    togglePlay: () => set((s) => s.playing
      ? { playing: false }
      : { playing: true, playhead: s.playhead >= s.duration - 0.001 ? 0 : s.playhead },
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
    setLeftTab: (t) => set({ leftTab: t, leftOpen: true }),
    setLeftOpen: (v) => set({ leftOpen: v }),
    setRightOpen: (v) => set({ rightOpen: v }),

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

    // ---- OmniFrame & Character Manipulation actions ----
    setOmniframeMode: (v) => set({ omniframeMode: v }),
    setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
    setOmniframeCharacterTransform: (charId, transform, scope, sectionRange, frame) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) => {
          if (c.id !== charId) return c
          return {
            ...c,
            transform: { ...c.transform, ...transform },
            scope: scope ?? c.scope,
            sectionRange: sectionRange !== undefined ? sectionRange : c.sectionRange,
            frameNumber: frame !== undefined ? frame : c.frameNumber,
          }
        }),
      }))
    },
    evaluateCharacterTransformAtTime: (charId, time) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      const fps = get().projectFps || 30
      const currentFrame = Math.round(time * fps)

      if (char.scope === 'all') {
        return char.transform
      } else if (char.scope === 'section') {
        const range = char.sectionRange || { start: 2.0, end: 5.0 }
        if (time >= range.start && time <= range.end) {
          return char.transform
        }
        return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      } else if (char.scope === 'frame') {
        const targetFrame = char.frameNumber ?? Math.round((char.sectionRange?.start || 0) * fps)
        if (Math.abs(currentFrame - targetFrame) <= 0.5) {
          return char.transform
        }
        return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      }
      return char.transform
    },
    cutCharacterToNewTrack: (charId) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return ''
      pushSnapshot()
      const activeClip = get().clips.find((c) => c.id === get().selectedClipId) || get().clips[0]
      const trkId = get().createTrack('video', 'above')
      const newClipId = uid('clip_char')
      const newClip: Clip = {
        id: newClipId,
        trackId: trkId,
        assetId: char.id,
        start: activeClip ? activeClip.start : 0,
        duration: activeClip ? activeClip.duration : 8.0,
        inPoint: 0,
        name: `${char.name} (Cut Track)`,
        kind: 'video',
        volume: 1,
        hidden: false,
        transform: { ...char.transform },
      }
      set((s) => ({
        clips: [...s.clips, newClip],
        selectedClipId: newClip.id,
      }))
      return newClipId
    },
    duplicateCharacter: (charId) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return ''
      pushSnapshot()
      const newId = `char_${char.id}_dup_${Date.now()}`
      const newChar: OmniframeCharacter = {
        ...structuredClone(char),
        id: newId,
        name: `${char.name} (Copy)`,
        label: `${char.label} Copy`,
        transform: {
          ...char.transform,
          x: char.transform.x + 40,
          y: char.transform.y + 20,
        },
      }
      set((s) => ({
        omniframeCharacters: [...s.omniframeCharacters, newChar],
        selectedCharacterId: newId,
      }))
      return newId
    },
    removeCharacterInfill: (charId) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) =>
          c.id === charId
            ? {
                ...c,
                transform: { ...c.transform, opacity: 0 },
              }
            : c
        ),
      }))
    },
    resetCharacterPosition: (charId) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) =>
          c.id === charId
            ? {
                ...c,
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                scope: 'all',
              }
            : c
        ),
      }))
    },

    setAttachDirectlyToVideo: (attach, targetClipId) => {
      pushSnapshot()
      if (!attach) {
        const trkId = get().createTrack('video', 'above')
        const videoClip = get().clips.find((c) => c.kind === 'video') || get().clips[0]
        const drawingClipId = uid('clip_drawing')
        const drawingClip: Clip = {
          id: drawingClipId,
          trackId: trkId,
          assetId: 'asset-drawing-overlay',
          start: videoClip ? videoClip.start : 0,
          duration: videoClip ? videoClip.duration : 8.0,
          inPoint: 0,
          name: 'Drawing Overlay (Separate Track)',
          kind: 'video',
          volume: 1,
          hidden: false,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        }
        set((s) => ({
          clips: [...s.clips, drawingClip],
          selectedClipId: drawingClip.id,
          attachDirectlyToVideo: false,
          attachedVideoClipId: videoClip?.id || null,
        }))
      } else {
        const targetClip = targetClipId
          ? get().clips.find((c) => c.id === targetClipId)
          : get().clips.find((c) => c.kind === 'video' && !c.name.includes('Drawing Overlay'))
        set((s) => ({
          clips: s.clips.filter((c) => !c.name.includes('Drawing Overlay')),
          attachDirectlyToVideo: true,
          attachedVideoClipId: targetClip?.id || null,
        }))
      }
    },

    convertDrawingToMask: (clipId, layerId) => {
      const activeClip = clipId
        ? get().clips.find((c) => c.id === clipId)
        : get().clips.find((c) => c.id === get().selectedClipId) || get().clips[0]
      if (!activeClip) return null
      const strokes = layerId
        ? get().drawingStrokes.filter((s) => s.layerId === layerId)
        : get().drawingStrokes

      const allPts = strokes.flatMap((st) => st.points || [])
      let pts = [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ]
      if (allPts.length > 0) {
        const xs = allPts.map((p) => p.x)
        const ys = allPts.map((p) => p.y)
        const minX = Math.max(0, Math.min(...xs))
        const maxX = Math.min(1, Math.max(...xs))
        const minY = Math.max(0, Math.min(...ys))
        const maxY = Math.min(1, Math.max(...ys))
        pts = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ]
      }

      const newMaskId = uid('mask_from_drawing')
      pushSnapshot()
      return newMaskId
    },

    convertMaskToSelection: (maskId, mode = 'shape') => {
      pushSnapshot()
      const b = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
      const newSel: ActiveSelection = {
        type: mode === 'shape' ? 'polygon' : 'rectangle',
        bounds: b,
        inverted: false,
        feather: 2,
        fillMode: mode === 'shape' ? 'outline' : 'filled',
      }
      set({ activeSelection: newSel })
    },

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
        past: past.slice(0, -1),
        future: [...future.slice(-49), current],
        duration: recompute(prev.clips),
        selectedClipId: null,
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
        future: future.slice(0, -1),
        past: [...past.slice(-49), current],
        duration: recompute(next.clips),
        selectedClipId: null,
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
