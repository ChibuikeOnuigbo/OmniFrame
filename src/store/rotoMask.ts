/**
 * RotoMask store slice — click-to-segment rotoscoping (Sammie-Roto 2 style).
 *
 * Everything the RotoMask sub-tool needs lives here: the model registry
 * selection + load state, the click session on the current frame, frame-scope
 * tracking (current / a chosen range / all frames), and the apply actions:
 *
 *   - Extract to OmniFrame object — the subject becomes a movable cutout
 *     layer (existing character system: transform + scope + keyframes)
 *   - Cut Out + Patch BG — the same cutout layer plus a background-patched
 *     still placed under it, i.e. "remove object, paste character back as a
 *     new layer on top of the patched video"
 *   - Remove from video — patch + hide the extracted layer
 *   - To Drawing mask / Export luma matte — handoff to the existing mask
 *     pipeline (only Drawing masks affect final export)
 *
 * Follows the slice pattern of ./omniframeCharacters.ts.
 */

import {
  BUILTIN_ROTO_MODELS,
  getRotoSamSessions,
  getRotoSession,
  importRotoModelFromFile,
  rotoModelFromUrl,
  ROTO_MODEL_CATALOG,
  type RotoModelDescriptor,
} from '../lib/rotoModels'
import {
  autoBrushMaskFromStroke,
  combineMasks,
  cutoutToDataUrl,
  lumaMatteToDataUrl,
  maskBounds,
  maskCentroid,
  maskCoverage,
  dilateMaskBitmap,
  maskToDataUrl,
  type MaskBitmap,
} from '../lib/rotoBrush'
import {
  inpaintMaskedHole,
  inpaintMaskedHoleWithDonor,
  propagateMaskToFrame,
  rasterizeWorkingFrame,
  runRotoSegmentation,
  type RotoClick,
  type RotoSegmentResult,
} from '../lib/rotoMaskEngine'
import type {
  Clip,
  MediaAsset,
  OmniframeCharacter,
  OmniframeScopeType,
  PaintLayer,
} from '../types'
import { uid } from '../lib/time'

export type RotoFrameScopeMode = 'current' | 'range' | 'all'
export type RotoToolMode = 'click' | 'brush-add' | 'brush-remove' | null

export interface RotoFrameScope {
  mode: RotoFrameScopeMode
  /** Range bounds in seconds (used when mode === 'range'). */
  start: number
  end: number
  /** Frame step when propagating over a range (1 = every frame). */
  step: number
}

export interface RotoMaskFrameResult {
  frame: number
  time: number
  maskDataUrl: string
  coverage: number
}

export interface RotoInpaintCandidate {
  frame: number
  time: number
  score: number
  overlap: number
  thumbnail: string
}

export interface RotoInpaintState {
  phase: 'idle' | 'analyzing' | 'ready' | 'applying' | 'done' | 'error'
  done: number
  total: number
  message: string
  candidates: RotoInpaintCandidate[]
  selectedDonorFrame: number | null
  targetFrames: number[]
  donorByTarget: { targetFrame: number; donorFrame: number | null; score: number }[]
  patchClipId?: string
  /** ProPainter-style propagation controls (see docs/PROPAINTER-STUDY.md). */
  maskGrow: number
  donorDirection: 'both' | 'earlier' | 'later'
  donorWindow: number
}

export interface RotoMaskRecord extends RotoSegmentResult {
  /** Absolute frame index of the frame the mask was made on. */
  frame: number
  /** RGBA cutout of the subject (premultiplied by the matte). */
  cutoutDataUrl?: string
}

export interface RotoStatus {
  state: 'idle' | 'loading' | 'ready' | 'error'
  message: string
}

/**
 * The store fields this slice reads and writes. Declared narrow (like
 * OmniframeStoreState) so the coupling stays visible instead of hiding
 * behind `any`.
 */
export interface RotoStoreState extends RotoMaskSlice {
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

  clips: Clip[]
  assets: MediaAsset[]
  selectedClipId: string | null
  playhead: number
  projectFps: number
  paintLayers: PaintLayer[]
  activePaintLayerId: string
  omniframeCharacters: OmniframeCharacter[]
  selectedCharacterId: string | null
  addAsset: (a: MediaAsset) => void
  createTrack: (type?: 'video' | 'audio', position?: 'above' | 'below', ref?: string) => string
}

export interface RotoMaskSlice {
  setRotoModel: (id: string) => void
  loadRotoModel: () => Promise<void>
  importRotoModelFile: (file: File) => Promise<RotoModelDescriptor | null>
  addRotoModelFromCatalog: (catalogId: string) => RotoModelDescriptor | null
  armRotoTool: (mode: RotoToolMode) => void
  addRotoClick: (x: number, y: number, positive: boolean) => Promise<void>
  undoRotoClick: () => Promise<void>
  clearRoto: () => void
  setRotoScope: (patch: Partial<RotoFrameScope>) => void
  setRotoTolerance: (n: number) => void
  setRotoBrushRadius: (n: number) => void
  trackRotoMask: () => Promise<void>
  analyzeRotoInpaint: () => Promise<void>
  applyRotoInpaint: () => Promise<string | null>
  selectRotoInpaintDonor: (frame: number | null) => void
  setRotoInpaintOptions: (patch: Partial<Pick<RotoInpaintState, 'maskGrow' | 'donorDirection' | 'donorWindow'>>) => void
  rotoExtractToObject: (opts?: {
    patch?: boolean
    hideAfter?: boolean
  }) => Promise<{ charId: string; patchAssetId?: string; patchClipId?: string } | null>
  rotoToDrawingMask: () => void
  rotoExportLumaMatte: () => { url: string; frame: number } | null
  rotoBrushApply: (points: { x: number; y: number }[], mode: 'add' | 'subtract') => Promise<void>
}

type SetState = (
  partial:
    | Partial<RotoStoreState & Record<string, unknown>>
    | ((s: RotoStoreState) => Partial<RotoStoreState & Record<string, unknown>>),
) => void

/** Dependencies the slice needs from the surrounding store. */
export interface RotoMaskDeps {
  pushSnapshot: () => void
}

/** All models the picker shows (built-ins first, then user imports). */
export function allRotoModels(s: Pick<RotoStoreState, 'rotoImportedModels'>): RotoModelDescriptor[] {
  return [...BUILTIN_ROTO_MODELS, ...s.rotoImportedModels]
}

export function findRotoModel(
  s: Pick<RotoStoreState, 'rotoImportedModels'> & { rotoModelId: string },
  id: string,
): RotoModelDescriptor | null {
  if (id === 'smart') return null
  return allRotoModels(s).find((m) => m.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Frame source loading (seek video to arbitrary time, then rasterise)
// ---------------------------------------------------------------------------

interface FrameSource {
  source: HTMLImageElement | HTMLCanvasElement
  width: number
  height: number
}

const sourceVideoCache = new Map<string, HTMLVideoElement>()
const sourceImageCache = new Map<string, HTMLImageElement>()

/** Load a source-relative video/image-sequence frame for temporal tools. */
export async function loadRotoFrame(asset: MediaAsset, timeSec: number): Promise<FrameSource | null> {
  if (typeof document === 'undefined') return null
  if (asset.kind === 'image') {
    const sequence = asset.imageSequence
    let url = asset.url
    if (sequence?.frames?.length) {
      let frame = sequence.frames[0]
      for (const candidate of sequence.frames) {
        if (candidate.time > timeSec) break
        frame = candidate
      }
      url = frame.url
    }
    let img = sourceImageCache.get(url)
    if (!img) {
      img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      sourceImageCache.set(url, img)
    }
    if (!(img.complete && img.naturalWidth > 0)) {
      const ready = await new Promise<boolean>((resolve) => {
        img!.onload = () => resolve(true)
        img!.onerror = () => resolve(false)
        setTimeout(() => resolve(false), 4000)
      })
      if (!ready) return null
    }
    if (!img.naturalWidth) return null
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  }

  let video = sourceVideoCache.get(asset.id)
  if (!video) {
    video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.src = asset.url
    sourceVideoCache.set(asset.id, video)
  }
  if (video.readyState < 2) {
    const ready = await new Promise<boolean>((resolve) => {
      const cleanup = () => {
        window.clearTimeout(timeout)
        video!.removeEventListener('loadeddata', onReady)
        video!.removeEventListener('error', onError)
      }
      const onReady = () => { cleanup(); resolve(true) }
      const onError = () => { cleanup(); resolve(false) }
      const timeout = window.setTimeout(() => { cleanup(); resolve(false) }, 4000)
      video!.addEventListener('loadeddata', onReady, { once: true })
      video!.addEventListener('error', onError, { once: true })
    })
    if (!ready) return null
  }
  const target = Math.max(0, Math.min(Math.max(0, (video.duration || 0) - 0.05), timeSec))
  if (Math.abs(video.currentTime - target) > 0.001) {
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        video!.removeEventListener('seeked', finish)
        resolve()
      }
      const timeout = window.setTimeout(finish, 1500)
      video!.addEventListener('seeked', finish, { once: true })
      try { video!.currentTime = target } catch { finish() }
    })
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || asset.width || 1920
  canvas.height = video.videoHeight || asset.height || 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { source: canvas, width: canvas.width, height: canvas.height }
}

/** Resolve the frame the RotoMask is working on (selected/under-playhead clip). */
function rotoContext(get: () => RotoStoreState) {
  const st = get()
  const clip =
    st.clips.find((c) => c.id === st.selectedClipId) ||
    st.clips.find((c) => st.playhead >= c.start && st.playhead <= c.start + c.duration) ||
    st.clips[0]
  const asset = clip ? st.assets.find((a) => a.id === clip.assetId) : undefined
  const fps = st.projectFps || 30
  const frame = Math.max(0, Math.round((st.playhead - (clip?.start ?? 0)) * fps))
  return { clip, asset, fps, frame }
}

interface TrackedRotoFrame {
  record: RotoMaskFrameResult
  mask: MaskBitmap
  image: ImageData
}

function isStillImage(asset: MediaAsset): boolean {
  return asset.kind === 'image' && !asset.imageSequence?.frames?.length
}

function frameIndicesForScope(scope: RotoFrameScope, clip: Clip, asset: MediaAsset, fps: number, baseFrame: number): number[] {
  if (isStillImage(asset) || scope.mode === 'current') return [baseFrame]
  const clipFrames = Math.max(1, Math.round(clip.duration * fps))
  const frames: number[] = []
  if (scope.mode === 'range') {
    const first = Math.max(0, Math.round(scope.start * fps))
    const last = Math.min(clipFrames - 1, Math.round(scope.end * fps))
    for (let frame = first; frame <= last; frame += Math.max(1, scope.step)) frames.push(frame)
  } else {
    for (let frame = 0; frame < clipFrames; frame += Math.max(1, scope.step)) frames.push(frame)
  }
  if (!frames.includes(baseFrame) && baseFrame < clipFrames) frames.push(baseFrame)
  return [...new Set(frames)].sort((a, b) => a - b)
}

function maskToWorking(mask: MaskBitmap, width: number, height: number): MaskBitmap {
  if (mask.width === width && mask.height === height) return mask
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(mask.height - 1, Math.floor((y / height) * mask.height))
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(mask.width - 1, Math.floor((x / width) * mask.width))
      data[y * width + x] = mask.data[sourceY * mask.width + sourceX]
    }
  }
  return { width, height, data }
}

async function trackRotoFrames(
  asset: MediaAsset,
  clip: Clip,
  base: RotoMaskRecord,
  fps: number,
  frameIndices: number[],
  tolerance: number,
  onProgress: (done: number, total: number) => void,
): Promise<Map<number, TrackedRotoFrame>> {
  const indices = [...new Set([...frameIndices, base.frame])].sort((a, b) => Math.abs(a - base.frame) - Math.abs(b - base.frame))
  const working = new Map<number, { img: ImageData; mask: MaskBitmap }>()
  const tracked = new Map<number, TrackedRotoFrame>()
  const maxEdge = 480
  const baseFs = await loadRotoFrame(asset, clip.inPoint + base.frame / fps)
  if (!baseFs) throw new Error('Could not load the selected frame')
  const baseWorking = rasterizeWorkingFrame(baseFs.source, baseFs.width, baseFs.height, maxEdge)
  const baseMask = maskToWorking(base.mask, baseWorking.width, baseWorking.height)
  working.set(base.frame, { img: baseWorking.imageData, mask: baseMask })
  tracked.set(base.frame, {
    record: {
      frame: base.frame,
      time: clip.start + base.frame / fps,
      maskDataUrl: maskToDataUrl(baseMask),
      coverage: maskCoverage(baseMask),
    },
    mask: baseMask,
    image: baseWorking.imageData,
  })
  onProgress(1, indices.length)

  for (const frame of indices) {
    if (frame === base.frame) continue
    let nearestDistance = Infinity
    let sourceFrame = -1
    for (const readyFrame of working.keys()) {
      const distance = Math.abs(readyFrame - frame)
      if (distance < nearestDistance) {
        nearestDistance = distance
        sourceFrame = readyFrame
      }
    }
    if (sourceFrame < 0) continue
    const source = working.get(sourceFrame)!
    const fs = await loadRotoFrame(asset, clip.inPoint + frame / fps)
    if (!fs) continue
    const next = rasterizeWorkingFrame(fs.source, fs.width, fs.height, maxEdge)
    const mask = propagateMaskToFrame(source.img, source.mask, next.imageData, { tolerance: tolerance + 4 })
    working.set(frame, { img: next.imageData, mask })
    tracked.set(frame, {
      record: {
        frame,
        time: clip.start + frame / fps,
        maskDataUrl: maskToDataUrl(mask),
        coverage: maskCoverage(mask),
      },
      mask,
      image: next.imageData,
    })
    onProgress(tracked.size, indices.length)
  }
  return new Map([...tracked.entries()].sort(([a], [b]) => a - b))
}

function maskOverlap(target: MaskBitmap, candidate: MaskBitmap): number {
  let selected = 0
  let overlap = 0
  for (let y = 0; y < target.height; y++) {
    const cy = Math.min(candidate.height - 1, Math.floor((y / target.height) * candidate.height))
    for (let x = 0; x < target.width; x++) {
      if (target.data[y * target.width + x] < 128) continue
      selected++
      const cx = Math.min(candidate.width - 1, Math.floor((x / target.width) * candidate.width))
      if (candidate.data[cy * candidate.width + cx] >= 128) overlap++
    }
  }
  return selected ? overlap / selected : 1
}

function boundaryIndices(mask: MaskBitmap): number[] {
  const edge = new Set<number>()
  const { width, height, data } = mask
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (data[i] < 128) continue
      if (x > 0 && data[i - 1] < 128) edge.add(i - 1)
      if (x + 1 < width && data[i + 1] < 128) edge.add(i + 1)
      if (y > 0 && data[i - width] < 128) edge.add(i - width)
      if (y + 1 < height && data[i + width] < 128) edge.add(i + width)
    }
  }
  return [...edge]
}

function boundaryColorDifference(target: TrackedRotoFrame, candidate: TrackedRotoFrame, edge: number[]): number {
  if (!edge.length) return 1
  const { width, height } = target.mask
  let sum = 0
  let count = 0
  for (const i of edge) {
    const x = i % width
    const y = Math.floor(i / width)
    const targetIndex = (y * target.image.width + x) * 4
    const candidateX = Math.min(candidate.image.width - 1, Math.floor((x / width) * candidate.image.width))
    const candidateY = Math.min(candidate.image.height - 1, Math.floor((y / height) * candidate.image.height))
    const candidateIndex = (candidateY * candidate.image.width + candidateX) * 4
    const dr = target.image.data[targetIndex] - candidate.image.data[candidateIndex]
    const dg = target.image.data[targetIndex + 1] - candidate.image.data[candidateIndex + 1]
    const db = target.image.data[targetIndex + 2] - candidate.image.data[candidateIndex + 2]
    sum += Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9)
    count++
  }
  return count ? Math.min(1, sum / count / 180) : 1
}

function frameThumbnail(image: ImageData): string {
  const source = document.createElement('canvas')
  source.width = image.width
  source.height = image.height
  source.getContext('2d')?.putImageData(image, 0, 0)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 180 / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

async function maskFromDataUrl(dataUrl: string): Promise<MaskBitmap | null> {
  if (!dataUrl) return null
  const image = new Image()
  image.src = dataUrl
  const loaded = await new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
  })
  if (!loaded) return null
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const data = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3]
  return { width: canvas.width, height: canvas.height, data }
}

async function cropCutoutDataUrl(
  dataUrl: string,
  bounds: { x: number; y: number; width: number; height: number },
  maskWidth: number,
  maskHeight: number,
): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  const loaded = await new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
  })
  if (!loaded) return dataUrl
  const sx = Math.max(0, Math.floor((bounds.x / maskWidth) * image.naturalWidth))
  const sy = Math.max(0, Math.floor((bounds.y / maskHeight) * image.naturalHeight))
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.ceil((bounds.width / maskWidth) * image.naturalWidth)))
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.ceil((bounds.height / maskHeight) * image.naturalHeight)))
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvas.toDataURL('image/png')
}

export function createRotoMaskSlice(
  set: SetState,
  get: () => RotoStoreState,
  deps: RotoMaskDeps,
): RotoMaskSlice {
  const { pushSnapshot } = deps

  /** Re-run segmentation for the given click set on the current frame. */
  const resegment = async (clicks: RotoClick[]): Promise<void> => {
    const { asset, clip, frame } = rotoContext(get)
    if (!asset || clicks.filter((c) => c.positive).length === 0) {
      set({ rotoResult: null, rotoClicks: clicks })
      return
    }
    set({ rotoBusy: true })
    try {
      const now = get()
      const fs = await loadRotoFrame(asset, clip ? clip.inPoint + now.playhead - clip.start : now.playhead)
      if (!fs) {
        set({ rotoBusy: false })
        return
      }
      const model = findRotoModel(get(), get().rotoModelId)
      // SAM: same frame + model reuses the (expensive) encoder embedding, so
      // every click after the first only runs the fast decoder pass.
      const samCacheKey = model?.kind === 'sam'
        ? `${asset.id}|${frame}|${fs.width}x${fs.height}|${model.id}`
        : undefined
      const result = await runRotoSegmentation(fs.source, fs.width, fs.height, clicks, model, {
        tolerance: get().rotoTolerance,
        samCacheKey,
      })
      set({
        rotoResult: {
          ...result,
          frame,
          cutoutDataUrl: cutoutToDataUrl(fs.source, fs.width, fs.height, result.mask),
        },
        rotoClicks: clicks,
        rotoBusy: false,
        rotoStatus: {
          state: 'ready',
          message: `${result.engine} · ${result.timings.total.toFixed(0)}ms · cover ${(result.coverage * 100).toFixed(1)}%`,
        },
      })
    } catch (err) {
      set({
        rotoBusy: false,
        rotoStatus: {
          state: 'error',
          message: err instanceof Error ? err.message : 'segmentation failed',
        },
      })
    }
  }

  return {
    setRotoModel: (id) => set({ rotoModelId: id, rotoStatus: { state: 'idle', message: '' } }),

    loadRotoModel: async () => {
      const st = get()
      const model = findRotoModel(st, st.rotoModelId)
      if (!model) {
        set({ rotoStatus: { state: 'ready', message: 'Smart engine — no model needed' } })
        return
      }
      set({ rotoStatus: { state: 'loading', message: `Loading ${model.label}…` } })
      try {
        if (model.kind === 'sam') {
          await getRotoSamSessions(model)
          set({
            rotoStatus: {
              state: 'ready',
              message: `${model.label} loaded (1024px encoder · decoder — first click encodes, then it's fast)`,
            },
          })
        } else {
          await getRotoSession(model)
          set({
            rotoStatus: { state: 'ready', message: `${model.label} loaded (${model.inputSize}px)` },
          })
        }
      } catch (err) {
        set({
          rotoStatus: {
            state: 'error',
            message: `${model.label}: ${err instanceof Error ? err.message : 'load failed'} — Smart engine still available`,
          },
        })
      }
    },

    importRotoModelFile: async (file) => {
      try {
        set({ rotoStatus: { state: 'loading', message: `Importing ${file.name}…` } })
        const desc = await importRotoModelFromFile(file)
        set((s) => ({
          rotoImportedModels: [...s.rotoImportedModels, desc],
          rotoModelId: desc.id,
          rotoStatus: { state: 'ready', message: `Imported ${desc.label} (${desc.inputSize}px)` },
        }))
        return desc
      } catch (err) {
        set({
          rotoStatus: {
            state: 'error',
            message: `Import failed: ${err instanceof Error ? err.message : 'unknown'}`,
          },
        })
        return null
      }
    },

    addRotoModelFromCatalog: (catalogId) => {
      const entry = ROTO_MODEL_CATALOG.find((m) => m.id === catalogId)
      if (!entry) return null
      const desc = rotoModelFromUrl(
        entry.id,
        `${entry.label} (URL)`,
        entry.url,
        entry.inputSize,
        entry.domain,
      )
      set((s) => ({
        rotoImportedModels: [...s.rotoImportedModels, desc],
        rotoModelId: desc.id,
        rotoStatus: { state: 'idle', message: `Linked ${entry.label} — press Load to fetch it` },
      }))
      return desc
    },

    armRotoTool: (mode) => {
      const next = get().rotoTool === mode ? null : mode
      set({ rotoTool: next })
    },

    addRotoClick: async (x, y, positive) => {
      const { frame } = rotoContext(get)
      const clicks = [...get().rotoClicks, { x, y, positive, frame }]
      await resegment(clicks)
    },

    undoRotoClick: async () => {
      const clicks = get().rotoClicks.slice(0, -1)
      await resegment(clicks)
    },

    clearRoto: () =>
      set({
        rotoClicks: [],
        rotoResult: null,
        rotoFrames: [],
        rotoLumaExport: null,
        rotoInpaint: { phase: 'idle', done: 0, total: 0, message: '', candidates: [], selectedDonorFrame: null, targetFrames: [], donorByTarget: [], maskGrow: 4, donorDirection: 'both', donorWindow: 0 },
      }),

    setRotoScope: (patch) => {
      const st = get()
      set({
        rotoScope: { ...st.rotoScope, ...patch },
        rotoInpaint: {
          ...st.rotoInpaint,
          phase: 'idle',
          done: 0,
          total: 0,
          message: '',
          candidates: [],
          selectedDonorFrame: null,
          targetFrames: [],
          donorByTarget: [],
          patchClipId: undefined,
          maskGrow: 4,
          donorDirection: 'both' as const,
          donorWindow: 0,
        },
      })
    },
    setRotoTolerance: (n) => set({ rotoTolerance: Math.max(1, Math.min(100, n)) }),
    setRotoBrushRadius: (n) => set({ rotoBrushRadius: Math.max(2, Math.min(200, n)) }),

    trackRotoMask: async () => {
      const st = get()
      const { asset, clip, fps, frame } = rotoContext(get)
      const base = st.rotoResult
      if (!asset || !clip || !base) return
      const frameIdx = frameIndicesForScope(st.rotoScope, clip, asset, fps, base.frame)
      set({ rotoTracking: { running: true, done: 0, total: frameIdx.length }, rotoBusy: true })
      try {
        const tracked = await trackRotoFrames(
          asset,
          clip,
          base,
          fps,
          frameIdx,
          st.rotoTolerance,
          (done, total) => set({ rotoTracking: { running: true, done, total } }),
        )
        const frames = [...tracked.values()].map((entry) => entry.record)
        set({
          rotoFrames: frames,
          rotoTracking: { running: false, done: frames.length, total: frameIdx.length },
          rotoBusy: false,
        })
      } catch (err) {
        set({
          rotoTracking: { running: false, done: 0, total: 0 },
          rotoBusy: false,
          rotoStatus: { state: 'error', message: err instanceof Error ? err.message : 'tracking failed' },
        })
      }
    },

    analyzeRotoInpaint: async () => {
      const st = get()
      const { asset, clip, fps } = rotoContext(get)
      const base = st.rotoResult
      if (!asset || !clip || !base) return
      const targets = frameIndicesForScope(st.rotoScope, clip, asset, fps, base.frame)
      const clipFrames = Math.max(1, Math.round(clip.duration * fps))
      const candidateStep = Math.max(1, Math.ceil(clipFrames / 96))
      const candidates: number[] = []
      if (isStillImage(asset)) candidates.push(base.frame)
      else for (let frame = 0; frame < clipFrames; frame += candidateStep) candidates.push(frame)
      const indices = [...new Set([...targets, ...candidates, base.frame])].sort((a, b) => a - b)
      set({
        rotoBusy: true,
        rotoInpaint: {
          phase: 'analyzing',
          done: 0,
          total: indices.length,
          message: 'Scanning the clip for clean donor frames…',
          candidates: [],
          selectedDonorFrame: null,
          targetFrames: targets,
          donorByTarget: [],
          maskGrow: st.rotoInpaint.maskGrow,
          donorDirection: st.rotoInpaint.donorDirection,
          donorWindow: st.rotoInpaint.donorWindow,
        },
      })
      try {
        const tracked = await trackRotoFrames(
          asset,
          clip,
          base,
          fps,
          indices,
          st.rotoTolerance,
          (done, total) => set((current) => ({
            rotoInpaint: { ...current.rotoInpaint, phase: 'analyzing', done, total },
          })),
        )
        const targetRecords = targets
          .map((frame) => tracked.get(frame))
          .filter((entry): entry is TrackedRotoFrame => !!entry)
        const candidateRecords = [...tracked.values()]
        const assignments: RotoInpaintState['donorByTarget'] = []
        const perTargetRankings = new Map<number, { record: TrackedRotoFrame; score: number; overlap: number }[]>()
        for (const target of targetRecords) {
          const edge = boundaryIndices(target.mask)
          const ranked = candidateRecords
            .filter((candidate) => candidate.record.frame !== target.record.frame)
            .filter((candidate) => st.rotoInpaint.donorDirection === 'both' || (st.rotoInpaint.donorDirection === 'earlier' ? candidate.record.frame < target.record.frame : candidate.record.frame > target.record.frame))
            .filter((candidate) => st.rotoInpaint.donorWindow <= 0 || Math.abs(candidate.record.frame - target.record.frame) <= st.rotoInpaint.donorWindow)
            .map((candidate) => {
              const overlap = maskOverlap(target.mask, candidate.mask)
              const colorDiff = boundaryColorDifference(target, candidate, edge)
              const timePenalty = Math.min(0.1, Math.abs(candidate.record.frame - target.record.frame) / Math.max(1, clipFrames) * 0.1)
              const score = Math.max(0, Math.min(1, 0.68 * (1 - overlap) + 0.32 * (1 - colorDiff) - timePenalty))
              return { record: candidate, score, overlap }
            })
            .sort((a, b) => b.score - a.score)
          perTargetRankings.set(target.record.frame, ranked)
          const best = ranked.find((candidate) => candidate.overlap < 0.38)
          assignments.push({
            targetFrame: target.record.frame,
            donorFrame: best?.record.record.frame ?? null,
            score: best?.score ?? 0,
          })
        }
        const primaryFrame = base.frame
        const primaryRanked = perTargetRankings.get(primaryFrame) || []
        const topCandidates = primaryRanked.slice(0, 6).map((candidate) => ({
          frame: candidate.record.record.frame,
          time: candidate.record.record.time,
          score: candidate.score,
          overlap: candidate.overlap,
          thumbnail: frameThumbnail(candidate.record.image),
        }))
        const allRecords = [...tracked.values()].map((entry) => entry.record)
        set({
          rotoFrames: allRecords,
          rotoBusy: false,
          rotoInpaint: {
            phase: 'ready',
            done: indices.length,
            total: indices.length,
            message: `${targets.length} target frame${targets.length === 1 ? '' : 's'} · ${topCandidates.length} donor candidates reviewed`,
            candidates: topCandidates,
            selectedDonorFrame: null,
            targetFrames: targetRecords.map((entry) => entry.record.frame),
            donorByTarget: assignments,
            maskGrow: st.rotoInpaint.maskGrow,
            donorDirection: st.rotoInpaint.donorDirection,
            donorWindow: st.rotoInpaint.donorWindow,
          },
        })
      } catch (err) {
        set((current) => ({
          rotoBusy: false,
          rotoInpaint: {
            ...current.rotoInpaint,
            phase: 'error',
            message: err instanceof Error ? err.message : 'inpaint analysis failed',
          },
        }))
      }
    },

    selectRotoInpaintDonor: (frame) => set((st) => ({
      rotoInpaint: { ...st.rotoInpaint, selectedDonorFrame: frame },
    })),

    setRotoInpaintOptions: (patch) => set((st) => ({
      rotoInpaint: {
        ...st.rotoInpaint,
        ...(patch.maskGrow !== undefined ? { maskGrow: Math.max(0, Math.min(24, Math.round(patch.maskGrow))) } : {}),
        ...(patch.donorDirection !== undefined ? { donorDirection: patch.donorDirection } : {}),
        ...(patch.donorWindow !== undefined ? { donorWindow: Math.max(0, Math.round(patch.donorWindow)) } : {}),
      },
    })),

    applyRotoInpaint: async () => {
      const st = get()
      const { asset, clip, fps } = rotoContext(get)
      const base = st.rotoResult
      if (!asset || !clip || !base || st.rotoInpaint.phase !== 'ready') return null
      const trackedByFrame = new Map(st.rotoFrames.map((entry) => [entry.frame, entry]))
      const assignments = new Map(st.rotoInpaint.donorByTarget.map((entry) => [entry.targetFrame, entry.donorFrame]))
      const targetFrames = st.rotoInpaint.targetFrames
      set((current) => ({
        rotoBusy: true,
        rotoInpaint: { ...current.rotoInpaint, phase: 'applying', done: 0, total: targetFrames.length, message: 'Applying temporal patches…' },
      }))
      try {
        const outputFrames: { frame: number; url: string }[] = []
        for (const [index, frame] of targetFrames.entries()) {
          const record = trackedByFrame.get(frame)
          const mask = frame === base.frame ? base.mask : await maskFromDataUrl(record?.maskDataUrl || '')
          const target = await loadRotoFrame(asset, clip.inPoint + frame / fps)
          if (record && mask && target) {
            const donorFrame = st.rotoInpaint.selectedDonorFrame ?? assignments.get(frame) ?? null
            let patch = ''
            const grownMask = dilateMaskBitmap(mask, st.rotoInpaint.maskGrow)
            if (donorFrame !== null && donorFrame !== frame) {
              const donorRecord = trackedByFrame.get(donorFrame)
              const donorMask = donorRecord?.maskDataUrl ? await maskFromDataUrl(donorRecord.maskDataUrl) : null
              const donor = await loadRotoFrame(asset, clip.inPoint + donorFrame / fps)
              if (donor && (!donorMask || maskOverlap(grownMask, donorMask) < 0.38)) {
                // Flow alignment by mask-centroid delta (mask px -> source px).
                const tc = maskCentroid(grownMask)
                const dc = donorMask ? maskCentroid(donorMask) : null
                const offset = tc && dc
                  ? { dx: (tc.x - dc.x) * (target.width / grownMask.width), dy: (tc.y - dc.y) * (target.height / grownMask.height) }
                  : undefined
                patch = inpaintMaskedHoleWithDonor(donor.source, target.width, target.height, grownMask, 3, offset)
              }
            }
            if (!patch) patch = inpaintMaskedHole(target.source, target.width, target.height, grownMask)
            if (patch) outputFrames.push({ frame, url: patch })
          }
          set((current) => ({
            rotoInpaint: { ...current.rotoInpaint, done: index + 1, total: targetFrames.length },
          }))
        }
        if (!outputFrames.length) throw new Error('No frames were patched')
        outputFrames.sort((a, b) => a.frame - b.frame)
        const firstFrame = outputFrames[0].frame
        const lastFrame = outputFrames[outputFrames.length - 1].frame
        const duration = (lastFrame - firstFrame + 1) / fps
        const imageSequence = {
          fps,
          frames: outputFrames.map((entry) => ({ time: (entry.frame - firstFrame) / fps, url: entry.url })),
        }
        const assetId = `asset-roto-inpaint-${Date.now().toString(36)}`
        pushSnapshot()
        const trackId = get().createTrack('video', 'above', clip.trackId)
        const patchClipId = uid('clip')
        get().addAsset({
          id: assetId,
          name: 'Temporal Inpaint Patch',
          kind: 'image',
          url: outputFrames[0].url,
          duration,
          width: asset.width,
          height: asset.height,
          size: outputFrames.reduce((sum, entry) => sum + entry.url.length, 0),
          imageSequence,
        })
        set((current) => ({
          clips: [...current.clips, {
            id: patchClipId,
            trackId,
            assetId,
            start: clip.start + firstFrame / fps,
            duration,
            inPoint: 0,
            name: 'Temporal Inpaint (RotoMask)',
            kind: 'video',
            volume: 1,
            hidden: false,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          }],
          rotoBusy: false,
          rotoInpaint: { ...current.rotoInpaint, phase: 'done', done: outputFrames.length, total: targetFrames.length, message: `Patched ${outputFrames.length} frame${outputFrames.length === 1 ? '' : 's'}`, patchClipId },
        }))
        return patchClipId
      } catch (err) {
        set((current) => ({
          rotoBusy: false,
          rotoInpaint: { ...current.rotoInpaint, phase: 'error', message: err instanceof Error ? err.message : 'temporal inpaint failed' },
        }))
        return null
      }
    },

    rotoExtractToObject: async (opts = {}) => {
      const { patch = false, hideAfter = false } = opts
      let st = get()
      const base = st.rotoResult
      if (!base) return null
      let { clip, asset, fps } = rotoContext(get)
      if (!asset) return null
      const temporalAsset = asset.kind !== 'image' || !!asset.imageSequence?.frames?.length
      if (clip && temporalAsset && st.rotoScope.mode !== 'current') {
        const requested = frameIndicesForScope(st.rotoScope, clip, asset, fps, base.frame)
        const available = new Set(st.rotoFrames.map((frame) => frame.frame))
        if (!requested.every((frame) => available.has(frame))) await get().trackRotoMask()
        st = get()
        ;({ clip, asset, fps } = rotoContext(get))
      }
      if (!clip || !asset) return null
      const currentTime = get().playhead
      const currentSourceTime = clip.inPoint + currentTime - clip.start
      const currentSource = await loadRotoFrame(asset, currentSourceTime)
      if (!currentSource) return null
      set({ rotoBusy: true })
      try {
      const targetIndices = temporalAsset
        ? frameIndicesForScope(st.rotoScope, clip, asset, fps, base.frame)
        : [base.frame]
      const frameMap = new Map(st.rotoFrames.map((frame) => [frame.frame, frame]))
      if (!frameMap.has(base.frame)) {
        frameMap.set(base.frame, {
          frame: base.frame,
          time: clip.start + base.frame / fps,
          maskDataUrl: base.maskDataUrl,
          coverage: base.coverage,
        })
      }
      const outputFrames: { frame: number; time: number; url: string }[] = []
      const rawCutouts: { time: number; url: string }[] = []
      let union = { x: 1, y: 1, right: 0, bottom: 0 }
      for (const frame of targetIndices) {
        const record = frameMap.get(frame)
        if (!record) continue
        const mask = frame === base.frame ? base.mask : await maskFromDataUrl(record.maskDataUrl)
        const source = await loadRotoFrame(asset, clip.inPoint + frame / fps)
        if (!mask || !source) continue
        const maskBox = maskBounds(mask)
        if (maskBox.width && maskBox.height) {
          union.x = Math.min(union.x, maskBox.x / mask.width)
          union.y = Math.min(union.y, maskBox.y / mask.height)
          union.right = Math.max(union.right, (maskBox.x + maskBox.width) / mask.width)
          union.bottom = Math.max(union.bottom, (maskBox.y + maskBox.height) / mask.height)
        }
        const cutoutUrl = cutoutToDataUrl(source.source, source.width, source.height, mask)
        rawCutouts.push({ time: clip.start + frame / fps, url: cutoutUrl })
        if (patch) {
          const url = inpaintMaskedHole(source.source, source.width, source.height, mask)
          if (url) outputFrames.push({ frame, time: clip.start + frame / fps, url })
        }
      }
      if (!rawCutouts.length) {
        set({ rotoBusy: false })
        return null
      }
      const normalizedBounds = {
        x: Math.max(0, Math.min(1, union.x)),
        y: Math.max(0, Math.min(1, union.y)),
        width: Math.max(0.001, Math.min(1, union.right) - Math.max(0, union.x)),
        height: Math.max(0.001, Math.min(1, union.bottom) - Math.max(0, union.y)),
      }
      const cropBounds = {
        x: normalizedBounds.x * base.width,
        y: normalizedBounds.y * base.height,
        width: normalizedBounds.width * base.width,
        height: normalizedBounds.height * base.height,
      }
      const cutoutFrames = await Promise.all(rawCutouts
        .sort((a, b) => a.time - b.time)
        .map(async (frame) => ({
          time: frame.time,
          url: await cropCutoutDataUrl(frame.url, cropBounds, base.width, base.height),
        })))
      outputFrames.sort((a, b) => a.frame - b.frame)
      const scope: OmniframeScopeType = temporalAsset && st.rotoScope.mode === 'all'
        ? 'all'
        : temporalAsset && st.rotoScope.mode === 'range'
          ? 'section'
          : 'frame'
      const charId = `obj_roto_${Date.now().toString(36)}`
      const newChar: OmniframeCharacter = {
        id: charId,
        name: 'RotoMask Cutout',
        label: `RotoMask (${base.engine})`,
        bounds: normalizedBounds,
        cutoutUrl: cutoutFrames.find((frame) => Math.abs(frame.time - (clip.start + base.frame / fps)) < 0.5 / fps)?.url || cutoutFrames[0].url || base.maskDataUrl,
        ...(cutoutFrames.length > 1 ? { cutoutSequence: cutoutFrames } : {}),
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: hideAfter ? 0 : 1 },
        scope,
        ...(scope === 'section'
          ? { sectionRange: { start: clip.start + st.rotoScope.start, end: clip.start + st.rotoScope.end } }
          : {}),
        ...(scope === 'frame' ? { frameNumber: base.frame } : {}),
      }

      pushSnapshot()
      set((s) => ({ omniframeCharacters: [...s.omniframeCharacters, newChar], selectedCharacterId: charId }))
      const patchOut: { patchAssetId?: string; patchClipId?: string } = {}
      if (patch && outputFrames.length) {
        const firstFrame = outputFrames[0].frame
        const lastFrame = outputFrames[outputFrames.length - 1].frame
        const stillImage = isStillImage(asset)
        const duration = stillImage ? clip.duration : Math.max(1 / fps, (lastFrame - firstFrame + 1) / fps)
        const patchSequence = {
          fps,
          frames: outputFrames.map((entry) => ({ time: (entry.frame - firstFrame) / fps, url: entry.url })),
        }
        const assetId = `asset-roto-patch-${Date.now().toString(36)}`
        get().addAsset({
          id: assetId,
          name: 'RotoMask BG Patch',
          kind: 'image',
          url: outputFrames[0].url,
          duration,
          width: currentSource.width,
          height: currentSource.height,
          size: outputFrames.reduce((sum, entry) => sum + entry.url.length, 0),
          imageSequence: patchSequence,
        })
        const trackId = get().createTrack('video', 'above', clip.trackId)
        const patchClipId = uid('clip')
        set((s) => ({
          clips: [...s.clips, {
            id: patchClipId,
            trackId,
            assetId,
            start: stillImage ? clip.start : clip.start + firstFrame / fps,
            duration,
            inPoint: 0,
            name: 'BG Patch (RotoMask)',
            kind: 'video',
            volume: 1,
            hidden: false,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          }],
        }))
        patchOut.patchAssetId = assetId
        patchOut.patchClipId = patchClipId
      }
      set({ rotoBusy: false })
      return { charId, ...patchOut }
      } catch (err) {
        set({
          rotoBusy: false,
          rotoStatus: { state: 'error', message: err instanceof Error ? err.message : 'Roto apply failed' },
        })
        return null
      }
    },

    rotoToDrawingMask: () => {
      const st = get()
      const base = st.rotoResult
      if (!base) return
      const targetLayerId = st.activePaintLayerId || st.paintLayers[0]?.id
      if (!targetLayerId || !st.paintLayers.some((l) => l.id === targetLayerId)) return
      pushSnapshot()
      set((s) => ({
        paintLayers: s.paintLayers.map((l) =>
          l.id === targetLayerId ? { ...l, maskDataUrl: base.maskDataUrl } : l,
        ),
      }))
    },

    rotoExportLumaMatte: () => {
      const st = get()
      const base = st.rotoResult
      if (!base) return null
      const url = lumaMatteToDataUrl(base.mask)
      const rec = { url, frame: base.frame, at: Date.now() }
      set({ rotoLumaExport: rec })
      // Best-effort download (headless QA asserts on the store record).
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = `rotomask-luma-f${base.frame}.png`
        a.click()
      } catch {
        /* download blocked — data URL stays in the store record */
      }
      return { url, frame: base.frame }
    },

    rotoBrushApply: async (points, mode) => {
      const st = get()
      const base = st.rotoResult
      const { asset, clip } = rotoContext(get)
      if (!base || !asset || points.length === 0) return
      set({ rotoBusy: true })
      try {
        const now = get()
        const fs = await loadRotoFrame(asset, clip ? clip.inPoint + now.playhead - clip.start : now.playhead)
        if (!fs) {
          set({ rotoBusy: false })
          return
        }
        // Refine on the SAME working grid as the stored mask.
        const w = base.width
        const h = base.height
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('2d context unavailable')
        ctx.drawImage(fs.source, 0, 0, fs.width, fs.height, 0, 0, w, h)
        const img = ctx.getImageData(0, 0, w, h)
        const strokePx = points.map((p) => ({ x: p.x * w, y: p.y * h }))
        const radiusPx = Math.max(
          2,
          (st.rotoBrushRadius / Math.max(fs.width, fs.height)) * Math.max(w, h),
        )
        const auto = autoBrushMaskFromStroke({
          source: img,
          stroke: strokePx,
          radius: radiusPx,
          tolerance: st.rotoTolerance,
          maxGrow: Math.round(radiusPx * 2.5),
          feather: 1,
        })
        const combined = combineMasks(base.mask, auto.mask, mode)
        set({
          rotoResult: {
            ...base,
            mask: combined,
            maskDataUrl: maskToDataUrl(combined),
            coverage: maskCoverage(combined),
          },
          rotoBusy: false,
        })
      } catch (err) {
        set({
          rotoBusy: false,
          rotoStatus: {
            state: 'error',
            message: err instanceof Error ? err.message : 'brush refine failed',
          },
        })
      }
    },
  }
}
