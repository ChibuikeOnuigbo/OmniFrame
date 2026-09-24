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
} from './types'
import { uid, clamp } from './lib/time'

export type Tool = 'select' | 'blade'
export type PreviewQuality = 'low' | 'medium' | 'high'
export type LeftTab =
  | 'media'
  | 'audio'
  | 'text'
  | 'effects'
  | 'transitions'
  | 'templates'
  | 'masks'
  | 'drawing'
  | 'tracking'
  | 'omniframe'
  | 'threed'

interface Doc {
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  drawingStrokes: DrawingStroke[]
  paintLayers: PaintLayer[]
}

const MIN_CLIP = 0.05 // seconds

function cloneDoc(s: EditorState): Doc {
  return {
    tracks: structuredClone(s.tracks),
    clips: structuredClone(s.clips),
    transitions: structuredClone(s.transitions || []),
    drawingStrokes: structuredClone(s.drawingStrokes || []),
    paintLayers: structuredClone(s.paintLayers || []),
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

  // ---- workspace layout & focus mode ----
  workspacePreset: WorkspacePreset
  focusMode: FocusMode
  timelineHeight: number
  leftDockWidth: number
  rightPanelWidth: number

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

  // ---- layout actions ----
  setWorkspacePreset: (preset: WorkspacePreset) => void
  setFocusMode: (mode: FocusMode) => void
  setTimelineHeight: (height: number) => void
  setLeftDockWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void

  // ---- transport ----
  setPlayhead: (t: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setSpeed: (s: number) => void
  setProjectFps: (fps: number) => void
  setDropFrameTimecode: (enabled: boolean) => void
  setPreviewQuality: (quality: PreviewQuality) => void
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
    assets: [],
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

    // ---- layout initial state ----
    workspacePreset: 'default',
    focusMode: 'none',
    timelineHeight: 280,
    leftDockWidth: 320,
    rightPanelWidth: 280,

    addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),

    importFiles: async (files) => {
      const list = Array.from(files as ArrayLike<File>)
      for (const file of list) {
        const asset = await readMediaFile(file)
        if (!asset) continue
        get().addAsset(asset)
        // Place imported media on a matching track automatically so the
        // timeline is immediately usable (CapCut-like convenience).
        const type: TrackType = asset.kind === 'audio' ? 'audio' : 'video'
        const trackId = get().ensureTrack(type)
        get().addClipToTrack(trackId, asset.id)
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
      // Append to the target track, not to the project duration. An empty
      // project starts with a nominal 10s viewport; using that value placed the
      // first imported clip at 10s and made both preview and timeline look empty.
      const trackEnd = get().clips
        .filter((c) => c.trackId === trackId)
        .reduce((end, c) => Math.max(end, c.start + c.duration), 0)
      const start = atTime ?? trackEnd
      const duration = asset.kind === 'image' ? 5 : asset.duration || 5
      const clip: Clip = {
        id: uid('clip'),
        trackId,
        assetId,
        start: Math.max(0, start),
        duration,
        inPoint: 0,
        name: asset.name,
        kind: asset.kind,
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }
      set((s) => {
        const clips = [...s.clips, clip]
        return { clips, selectedClipId: clip.id, duration: recompute(clips) }
      })
    },

    moveClip: (id, newStart, newTrackId) => {
      const current = get().clips.find((c) => c.id === id)
      if (!current || get().tracks.find((t) => t.id === current.trackId)?.locked) return
      if (newTrackId && get().tracks.find((t) => t.id === newTrackId)?.locked) return
      set((s) => {
        const clips = s.clips.map((c) =>
          c.id === id
            ? { ...c, start: Math.max(0, newStart), trackId: newTrackId ?? c.trackId }
            : c,
        )
        return { clips, duration: recompute(clips) }
      })
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
        const track = s.tracks.find((item) => item.id === current.trackId)
        const removedEnd = current.start + current.duration
        const clips = s.clips
          .filter((c) => c.id !== id)
          .map((clip) => track?.gapless && clip.trackId === current.trackId && clip.start >= removedEnd
            ? { ...clip, start: Math.max(current.start, clip.start - current.duration) }
            : clip)
        const transitions = (s.transitions || []).filter(
          (tr) => tr.fromClipId !== id && tr.toClipId !== id,
        )
        return {
          clips,
          transitions,
          selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
          duration: recompute(clips),
        }
      })
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
        future: future.slice(0, -1),
        past: [...past.slice(-49), current],
        duration: recompute(next.clips),
        selectedClipId: null,
        selectedTransitionId: null,
      })
    },

    newProject: () => {
      for (const asset of get().assets) URL.revokeObjectURL(asset.url)
      set({
        assets: [],
        tracks: [],
        clips: [],
        transitions: [],
        drawingStrokes: [],
        paintLayers: [{ id: 'default-paint-layer', name: 'Paint 1', visible: true, locked: false, opacity: 1 }],
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
    if (!video.videoWidth || !video.videoHeight) return undefined
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.68)
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
