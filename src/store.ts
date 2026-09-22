import { create } from 'zustand'
import type { Clip, MediaAsset, Track, TrackType, ClipTransform } from './types'
import { uid, clamp } from './lib/time'

export type Tool = 'select' | 'blade'
export type PreviewQuality = 'low' | 'medium' | 'high' | 'ultra'
export type LeftTab =
  | 'media'
  | 'audio'
  | 'text'
  | 'effects'
  | 'transitions'
  | 'templates'
  | 'masks'
  | 'tracking'
  | 'omniframe'
  | 'threed'

interface Doc {
  tracks: Track[]
  clips: Clip[]
}

const MIN_CLIP = 0.05 // seconds

function cloneDoc(s: EditorState): Doc {
  return {
    tracks: structuredClone(s.tracks),
    clips: structuredClone(s.clips),
  }
}

export interface EditorState {
  assets: MediaAsset[]
  tracks: Track[]
  clips: Clip[]
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

  // ---- media ----
  addAsset: (a: MediaAsset) => void
  importFiles: (files: FileList | File[]) => Promise<void>

  // ---- tracks / clips ----
  ensureTrack: (type: TrackType) => string
  addClipToTrack: (trackId: string, assetId: string, atTime?: number) => void
  moveClip: (id: string, newStart: number, newTrackId?: string) => void
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
    playhead: 0,
    duration: 10,
    pxPerSec: 100,
    playing: false,
    speed: 1,
    projectFps: 30,
    dropFrameTimecode: false,
    previewQuality: 'high',
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
      const count = get().tracks.filter((t) => t.type === type).length + 1
      const base = type === 'audio' ? 'Audio' : 'Video'
      const track = makeTrack(type, count === 1 ? base : `${base} ${count}`)
      set((s) => ({ tracks: [...s.tracks, track] }))
      return track.id
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
        const clips = s.clips.filter((c) => c.id !== id)
        return {
          clips,
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
    setPreviewQuality: (previewQuality) => set({ previewQuality }),

    setZoom: (px) => set({ pxPerSec: clamp(px, 8, 8000) }),
    zoomBy: (factor) => set((s) => ({ pxPerSec: clamp(s.pxPerSec * factor, 8, 8000) })),
    toggleSnapping: () => set((state) => ({ snapping: !state.snapping })),
    setScrubbing: (scrubbing) => set({ scrubbing }),

    setTool: (t) => set({ tool: t }),
    setLeftTab: (t) => set({ leftTab: t, leftOpen: true }),
    setLeftOpen: (v) => set({ leftOpen: v }),
    setRightOpen: (v) => set({ rightOpen: v }),

    beginHistory: () => {
      if (!get().inInteraction) {
        pushSnapshot()
        set({ inInteraction: true })
      }
    },
    endHistory: () => set({ inInteraction: false }),

    undo: () => {
      const { past, future, tracks, clips } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      set({
        tracks: prev.tracks,
        clips: prev.clips,
        past: past.slice(0, -1),
        future: [...future, cloneDoc({ tracks, clips } as EditorState)],
        duration: recompute(prev.clips),
        selectedClipId: null,
      })
    },
    redo: () => {
      const { past, future, tracks, clips } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      set({
        tracks: next.tracks,
        clips: next.clips,
        future: future.slice(0, -1),
        past: [...past, cloneDoc({ tracks, clips } as EditorState)],
        duration: recompute(next.clips),
        selectedClipId: null,
      })
    },

    newProject: () => {
      for (const asset of get().assets) URL.revokeObjectURL(asset.url)
      set({
        assets: [],
        tracks: [],
        clips: [],
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
