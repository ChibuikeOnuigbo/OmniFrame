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
  maskCoverage,
  maskToDataUrl,
  type MaskBitmap,
} from '../lib/rotoBrush'
import {
  inpaintMaskedHole,
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

async function loadAssetFrame(asset: MediaAsset, timeSec: number): Promise<FrameSource | null> {
  if (typeof document === 'undefined') return null
  if (asset.kind === 'image') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = asset.url
    if (!(img.complete && img.naturalWidth > 0)) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    }
    if (!img.naturalWidth) return null
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  }
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  video.src = asset.url
  const ready = await new Promise<boolean>((resolve) => {
    video.onloadeddata = () => resolve(true)
    video.onerror = () => resolve(false)
    setTimeout(() => resolve(false), 4000)
  })
  if (!ready) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || asset.width || 1920
  canvas.height = video.videoHeight || asset.height || 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const target = Math.max(0, Math.min((video.duration || 0) - 0.05, timeSec))
  try {
    video.currentTime = target
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      setTimeout(() => resolve(), 1500)
    })
  } catch {
    /* first decoded frame */
  }
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

export function createRotoMaskSlice(
  set: SetState,
  get: () => RotoStoreState,
  deps: RotoMaskDeps,
): RotoMaskSlice {
  const { pushSnapshot } = deps

  /** Re-run segmentation for the given click set on the current frame. */
  const resegment = async (clicks: RotoClick[]): Promise<void> => {
    const { asset, frame } = rotoContext(get)
    if (!asset || clicks.filter((c) => c.positive).length === 0) {
      set({ rotoResult: null, rotoClicks: clicks })
      return
    }
    set({ rotoBusy: true })
    try {
      const fs = await loadAssetFrame(asset, get().playhead)
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
      set({ rotoClicks: [], rotoResult: null, rotoFrames: [], rotoLumaExport: null }),

    setRotoScope: (patch) => set({ rotoScope: { ...get().rotoScope, ...patch } }),
    setRotoTolerance: (n) => set({ rotoTolerance: Math.max(1, Math.min(100, n)) }),
    setRotoBrushRadius: (n) => set({ rotoBrushRadius: Math.max(2, Math.min(200, n)) }),

    trackRotoMask: async () => {
      const st = get()
      const { asset, clip, fps } = rotoContext(get)
      const base = st.rotoResult
      if (!asset || !clip || !base) return
      const scope = st.rotoScope
      const clipFrames = Math.max(1, Math.round(clip.duration * fps))
      let frameIdx: number[]
      if (asset.kind === 'image' || scope.mode === 'current') {
        frameIdx = [base.frame]
      } else if (scope.mode === 'range') {
        const f0 = Math.max(0, Math.round(scope.start * fps))
        const f1 = Math.min(clipFrames - 1, Math.round(scope.end * fps))
        frameIdx = []
        for (let f = f0; f <= f1; f += Math.max(1, scope.step)) frameIdx.push(f)
      } else {
        frameIdx = []
        for (let f = 0; f < clipFrames; f += Math.max(1, scope.step)) frameIdx.push(f)
      }
      const total = frameIdx.length + (frameIdx.includes(base.frame) ? 0 : 1)
      set({ rotoTracking: { running: true, done: 0, total }, rotoBusy: true })

      try {
        const frames: RotoMaskFrameResult[] = []
        const maxEdge = 480
        const maskToWorking = (mask: MaskBitmap, w: number, h: number): MaskBitmap => {
          if (mask.width === w && mask.height === h) return mask
          const out = new Uint8Array(w * h)
          for (let y = 0; y < h; y++) {
            const my = Math.min(mask.height - 1, Math.floor((y / h) * mask.height))
            for (let x = 0; x < w; x++) {
              const mx = Math.min(mask.width - 1, Math.floor((x / w) * mask.width))
              out[y * w + x] = mask.data[my * mask.width + mx]
            }
          }
          return { width: w, height: h, data: out }
        }

        // Sort so the base frame seeds its neighbours, then walk outward.
        const sorted = [...frameIdx].sort(
          (a, b) => Math.abs(a - base.frame) - Math.abs(b - base.frame),
        )
        const working = new Map<number, { img: ImageData; mask: MaskBitmap }>()
        const baseFs = await loadAssetFrame(asset, clip.start + base.frame / fps)
        if (!baseFs) throw new Error('could not load base frame')
        const baseW = rasterizeWorkingFrame(baseFs.source, baseFs.width, baseFs.height, maxEdge)
        working.set(base.frame, {
          img: baseW.imageData,
          mask: maskToWorking(base.mask, baseW.width, baseW.height),
        })
        frames.push({
          frame: base.frame,
          time: clip.start + base.frame / fps,
          maskDataUrl: base.maskDataUrl,
          coverage: base.coverage,
        })

        for (const f of sorted) {
          if (f === base.frame) continue
          // Propagate from the nearest already-computed frame.
          let nearest = Infinity
          let srcFrame = -1
          for (const k of working.keys()) {
            const d = Math.abs(k - f)
            if (d < nearest) {
              nearest = d
              srcFrame = k
            }
          }
          if (srcFrame < 0) break
          const src = working.get(srcFrame)!
          const t = clip.start + f / fps
          const fs = await loadAssetFrame(asset, t)
          if (!fs) continue
          const nextW = rasterizeWorkingFrame(fs.source, fs.width, fs.height, maxEdge)
          const nextMask = propagateMaskToFrame(src.img, src.mask, nextW.imageData, {
            tolerance: get().rotoTolerance + 4,
          })
          working.set(f, { img: nextW.imageData, mask: nextMask })
          frames.push({
            frame: f,
            time: t,
            maskDataUrl: maskToDataUrl(nextMask),
            coverage: maskCoverage(nextMask),
          })
          set({ rotoTracking: { running: true, done: frames.length, total } })
        }

        frames.sort((a, b) => a.frame - b.frame)
        set({
          rotoFrames: frames,
          rotoTracking: { running: false, done: frames.length, total },
          rotoBusy: false,
        })
      } catch (err) {
        set({
          rotoTracking: { running: false, done: 0, total: 0 },
          rotoBusy: false,
          rotoStatus: {
            state: 'error',
            message: err instanceof Error ? err.message : 'tracking failed',
          },
        })
      }
    },

    rotoExtractToObject: async (opts = {}) => {
      const { patch = false, hideAfter = false } = opts
      const st = get()
      const base = st.rotoResult
      if (!base) return null
      const { clip, asset } = rotoContext(get)
      if (!asset) return null
      const fs = await loadAssetFrame(asset, get().playhead)
      if (!fs) return null

      pushSnapshot()
      const b = maskBounds(base.mask)
      const nb = {
        x: b.width ? b.x / base.width : 0.25,
        y: b.height ? b.y / base.height : 0.25,
        width: b.width ? b.width / base.width : 0.5,
        height: b.height ? b.height / base.height : 0.5,
      }
      const scope: OmniframeScopeType =
        st.rotoScope.mode === 'all' && asset.kind !== 'image'
          ? 'all'
          : st.rotoScope.mode === 'range' && asset.kind !== 'image'
            ? 'section'
            : 'frame'
      const charId = `obj_roto_${Date.now().toString(36)}`
      const newChar: OmniframeCharacter = {
        id: charId,
        name: `RotoMask Cutout`,
        label: `RotoMask (${base.engine})`,
        bounds: nb,
        cutoutUrl: base.cutoutDataUrl || base.maskDataUrl,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: hideAfter ? 0 : 1 },
        scope,
        ...(scope === 'section'
          ? { sectionRange: { start: st.rotoScope.start, end: st.rotoScope.end } }
          : {}),
        ...(scope === 'frame' ? { frameNumber: base.frame } : {}),
      }

      set((s) => ({
        omniframeCharacters: [...s.omniframeCharacters, newChar],
        selectedCharacterId: charId,
      }))

      const patchOut: { patchAssetId?: string; patchClipId?: string } = {}
      if (patch) {
        // Background-patched still: the masked hole is inpainted and the
        // result becomes a transparent-except-hole PNG clip layered above
        // the source video, right under the extracted character layer.
        const patchedUrl = inpaintMaskedHole(fs.source, fs.width, fs.height, base.mask)
        const assetId = `asset-roto-patch-${Date.now().toString(36)}`
        get().addAsset({
          id: assetId,
          name: 'RotoMask BG Patch',
          kind: 'image',
          url: patchedUrl,
          duration: clip ? clip.duration : 5,
          width: fs.width,
          height: fs.height,
          size: patchedUrl.length,
        })
        const trkId = clip
          ? get().createTrack('video', 'above', clip.trackId)
          : get().createTrack('video', 'above')
        const patchClipId = uid('clip')
        set((s) => ({
          clips: [
            ...s.clips,
            {
              id: patchClipId,
              trackId: trkId,
              assetId,
              start: clip ? clip.start : 0,
              duration: clip ? clip.duration : 5,
              inPoint: 0,
              name: 'BG Patch (RotoMask)',
              kind: 'video',
              volume: 1,
              hidden: false,
              transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            },
          ],
        }))
        patchOut.patchAssetId = assetId
        patchOut.patchClipId = patchClipId
      }
      return { charId, ...patchOut }
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
      const { asset } = rotoContext(get)
      if (!base || !asset || points.length === 0) return
      set({ rotoBusy: true })
      try {
        const fs = await loadAssetFrame(asset, get().playhead)
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
