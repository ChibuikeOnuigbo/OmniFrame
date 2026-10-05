/**
 * RotoMask engine — click-to-segment rotoscoping, modelled on the
 * Sammie-Roto 2 workflow:
 *
 *   1. pick a model (or the built-in Smart engine)
 *   2. click the subject (left-click / Add), right-click (or Remove) to
 *      carve background back out
 *   3. Track — the mask propagates across the chosen frame set
 *   4. apply: extract the subject as a movable OmniFrame layer, remove it
 *      with a patched background, or hand it to the Drawing mask system
 *
 * Two segmentation paths:
 *
 *   Smart (no model, instant): a colour model is fitted from the positive
 *   click disks, every pixel is scored positive-vs-negative, the winning
 *   component containing each positive click is kept, and negative clicks
 *   subtract their components. Works everywhere, no download.
 *
 *   Model (OmniRoto ONNX family or any imported saliency model): the model
 *   produces a subject-likelihood map; clicks then *pick* blobs from that
 *   map (positive) and veto them (negative) — the same click semantics as
 *   SAM-style tools, but the heavy lifting is a tiny bundled model that
 *   also runs in the browser.
 *
 * Frame propagation is a light MatAnyone: a grid of interior points is
 * block-matched between frames (reusing trackingEngine), the mask is warped
 * by the regularized displacement field, then re-anchored to the subject's
 * colours so edges don't drift.
 */

import type * as Ort from 'onnxruntime-web'
import { isDesktopApp } from './desktop'
import {
  colorDistance,
  featherMask,
  gradientMagnitude,
  maskToDataUrl,
  type MaskBitmap,
  maskCoverage,
} from './rotoBrush'
import {
  getRotoSamSessions,
  getRotoSession,
  postprocessSaliency,
  preprocessSaliency,
  probToMask,
  type RotoModelDescriptor,
} from './rotoModels'
import { computeFrameMaps, matchPatch, DEFAULT_TRACK_OPTIONS } from './trackingEngine'

export interface RotoClick {
  /** Normalised 0..1 frame coordinates. */
  x: number
  y: number
  /** true = Add (subject), false = Remove (background). */
  positive: boolean
  /** Frame index the click was placed on. */
  frame: number
}

export interface RotoSegmentOptions {
  /** Cache key for the SAM image embedding (e.g. `asset|frame|model`). Same
   * key reuses the encoder pass, so extra clicks only run the fast decoder. */
  samCacheKey?: string
  /** 0..100 tolerance for the Smart engine colour scoring. Default 26. */
  tolerance?: number
  /** Feather in working px. Default 2. */
  feather?: number
  /** Longest working edge. Default 720. */
  maxWorkingEdge?: number
}

export interface RotoSegmentResult {
  width: number
  height: number
  mask: MaskBitmap
  /** White-on-alpha PNG matte (guidedMatting convention). */
  maskDataUrl: string
  coverage: number
  engine: 'smart' | string
  timings: { total: number; model?: number }
}

// ---------------------------------------------------------------------------
// Frame rasterisation at working resolution
// ---------------------------------------------------------------------------

export interface WorkingFrame {
  source: CanvasImageSource
  sourceWidth: number
  sourceHeight: number
  /** Working-resolution raster of the frame. */
  imageData: ImageData
  width: number
  height: number
  scale: number
}

export function rasterizeWorkingFrame(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxWorkingEdge = 720,
): WorkingFrame {
  const scale = Math.min(1, maxWorkingEdge / Math.max(sourceWidth, sourceHeight))
  const w = Math.max(8, Math.round(sourceWidth * scale))
  const h = Math.max(8, Math.round(sourceHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, w, h)
  return {
    source,
    sourceWidth,
    sourceHeight,
    imageData: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
    scale,
  }
}

// ---------------------------------------------------------------------------
// Connected components
// ---------------------------------------------------------------------------

interface Component {
  pixels: number[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function connectedComponents(mask: Uint8Array, w: number, h: number, minSize = 0): Component[] {
  const visited = new Uint8Array(w * h)
  const comps: Component[] = []
  const queue = new Int32Array(w * h)
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    const pixels: number[] = []
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    while (head < tail) {
      const idx = queue[head++]
      pixels.push(idx)
      const x = idx % w
      const y = (idx - x) / w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) {
        visited[idx - 1] = 1
        queue[tail++] = idx - 1
      }
      if (x < w - 1 && mask[idx + 1] && !visited[idx + 1]) {
        visited[idx + 1] = 1
        queue[tail++] = idx + 1
      }
      if (y > 0 && mask[idx - w] && !visited[idx - w]) {
        visited[idx - w] = 1
        queue[tail++] = idx - w
      }
      if (y < h - 1 && mask[idx + w] && !visited[idx + w]) {
        visited[idx + w] = 1
        queue[tail++] = idx + w
      }
    }
    if (pixels.length >= minSize) comps.push({ pixels, minX, minY, maxX, maxY })
  }
  return comps
}

function sampleDisk(img: ImageData, cx: number, cy: number, r: number): number[] {
  const out: number[] = []
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy
    if (y < 0 || y >= img.height) continue
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx
      if (x < 0 || x >= img.width) continue
      if (dx * dx + dy * dy > r * r) continue
      out.push((y * img.width + x) * 4)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Smart engine — colour-model click segmentation, no model required
// ---------------------------------------------------------------------------

function segmentSmart(frame: WorkingFrame, clicks: RotoClick[], tolerance: number): MaskBitmap {
  const { imageData: img, width: w, height: h } = frame
  const pos = clicks.filter((c) => c.positive)
  const neg = clicks.filter((c) => !c.positive)
  if (pos.length === 0) return { width: w, height: h, data: new Uint8Array(w * h) }

  const diskR = Math.max(3, Math.round(Math.min(w, h) * 0.012))
  const fit = (pts: RotoClick[]) => {
    let r = 0
    let g = 0
    let b = 0
    const all: number[] = []
    for (const p of pts) {
      for (const px of sampleDisk(img, Math.round(p.x * w), Math.round(p.y * h), diskR)) all.push(px)
    }
    for (const px of all) {
      r += img.data[px]
      g += img.data[px + 1]
      b += img.data[px + 2]
    }
    const n = Math.max(1, all.length)
    return { r: r / n, g: g / n, b: b / n }
  }
  const posModel = fit(pos)
  const negModel = neg.length ? fit(neg) : null
  const tol = tolerance * 0.95

  const score = new Float32Array(w * h)
  const grad = gradientMagnitude(img)
  for (let i = 0; i < w * h; i++) {
    const pix = i * 4
    const dPos = colorDistance(img.data, pix, posModel.r, posModel.g, posModel.b)
    const dNeg = negModel ? colorDistance(img.data, pix, negModel.r, negModel.g, negModel.b) : Infinity
    // Positive when closer to the subject clicks than background clicks and
    // inside tolerance; strong gradients slightly demote uncertain pixels.
    let s = dPos <= tol ? 1 - dPos / (tol * 1.6) : 0
    if (negModel && dNeg < dPos) s *= 0.25
    s *= 1 - grad[i] * 0.25
    score[i] = s
  }
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < score.length; i++) bin[i] = score[i] > 0.18 ? 255 : 0

  // Keep the component of each positive click, minus negative components.
  let mask = new Uint8Array(w * h)
  const minSize = Math.max(24, Math.floor((w * h) * 0.0004))
  const comps = connectedComponents(bin, w, h, minSize)
  const negSet = new Set<number>()
  if (neg.length) {
    for (const c of comps) {
      for (const p of neg) {
        const px = Math.round(p.x * w)
        const py = Math.round(p.y * h)
        if (px >= c.minX - 2 && px <= c.maxX + 2 && py >= c.minY - 2 && py <= c.maxY + 2) {
          const inside = c.pixels.some((idx) => {
            const x = idx % w
            const y = (idx - x) / w
            return Math.abs(x - px) <= 3 && Math.abs(y - py) <= 3
          })
          if (inside) {
            for (const idx of c.pixels) negSet.add(idx)
          }
        }
      }
    }
  }
  for (const p of pos) {
    const px = Math.round(p.x * w)
    const py = Math.round(p.y * h)
    // Prefer the component actually containing the click.
    let chosen = comps.find((c) =>
      c.pixels.some((idx) => {
        const x = idx % w
        const y = (idx - x) / w
        return Math.abs(x - px) <= 3 && Math.abs(y - py) <= 3
      }),
    )
    if (!chosen) {
      // Fall back to the component whose bbox is nearest the click.
      let bestD = Infinity
      for (const c of comps) {
        const cx = Math.max(c.minX, Math.min(px, c.maxX))
        const cy = Math.max(c.minY, Math.min(py, c.maxY))
        const d = Math.hypot(cx - px, cy - py)
        if (d < bestD) {
          bestD = d
          chosen = c
        }
      }
      if (chosen && bestD > Math.max(w, h) * 0.25) chosen = undefined
    }
    if (chosen) for (const idx of chosen.pixels) if (!negSet.has(idx)) mask[idx] = 255
  }

  // Relaxed grow from the picked components: a single click often lands on
  // one body part whose exact-colour component is small, so widen the
  // tolerance and let the mask spread across the whole subject (still
  // connectivity-bound and still stopped by negative clicks' colours).
  const relaxTol = tol * 1.8
  const maxDist = Math.round(Math.min(w, h) * 0.32)
  const dist = new Int32Array(w * h).fill(-1)
  const growQueue: number[] = []
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      dist[i] = 0
      growQueue.push(i)
    }
  }
  let head = 0
  while (head < growQueue.length) {
    const idx = growQueue[head++]
    const d = dist[idx]
    if (d >= maxDist) continue
    const x = idx % w
    const y = (idx - x) / w
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const nIdx = ny * w + nx
      if (mask[nIdx] || dist[nIdx] >= 0) continue
      if (negModel && colorDistance(img.data, nIdx * 4, negModel.r, negModel.g, negModel.b) < tol) continue
      if (colorDistance(img.data, nIdx * 4, posModel.r, posModel.g, posModel.b) > relaxTol) continue
      mask[nIdx] = 255
      dist[nIdx] = d + 1
      growQueue.push(nIdx)
    }
  }
  return { width: w, height: h, data: mask }
}

// ---------------------------------------------------------------------------
// Model engine — saliency map + click blob picking
// ---------------------------------------------------------------------------

async function segmentWithModel(
  frame: WorkingFrame,
  clicks: RotoClick[],
  model: RotoModelDescriptor,
): Promise<{ mask: MaskBitmap; modelMs: number }> {
  const t0 = performance.now()
  const { width: w, height: h } = frame

  let prob: Float32Array
  let probSize: number

  const desktop = isDesktopApp()
  if (desktop) {
    // Desktop: run the model through the native sidecar when possible.
    try {
      const res = await runModelDesktop(frame, model)
      prob = res.prob
      probSize = res.size
    } catch {
      const r = await runModelWeb(frame, model)
      prob = r.prob
      probSize = r.size
    }
  } else {
    const r = await runModelWeb(frame, model)
    prob = r.prob
    probSize = r.size
  }

  // Adaptive threshold: half-way between the map's low and high quartiles
  // keeps subjects usable even when the model is under-confident.
  const sorted = Float32Array.from(prob).sort()
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  const threshold = Math.min(0.85, Math.max(0.18, q(0.35) + (q(0.95) - q(0.35)) * 0.5))
  let bitmap = probToMask(prob, probSize, w, h, threshold)

  const pos = clicks.filter((c) => c.positive)
  const neg = clicks.filter((c) => !c.positive)

  // Blob picking: keep components containing/near positive clicks, veto
  // components containing negative clicks.
  const minSize = Math.max(16, Math.floor(w * h * 0.0002))
  const comps = connectedComponents(bitmap.data, w, h, minSize)
  const picks = new Set<number>()
  const vetoes = new Set<number>()
  for (const [ci, c] of comps.entries()) {
    for (const p of clicks) {
      const px = Math.round(p.x * w)
      const py = Math.round(p.y * h)
      const inside = px >= c.minX && px <= c.maxX && py >= c.minY && py <= c.maxY &&
        c.pixels.some((idx) => {
          const x = idx % w
          const y = (idx - x) / w
          return Math.abs(x - px) <= Math.max(3, w * 0.01) && Math.abs(y - py) <= Math.max(3, h * 0.01)
        })
      if (inside) (p.positive ? picks : vetoes).add(ci)
    }
  }
  // A negative click inside a picked blob must subtract the background
  // region it points at, not veto the whole component (the model often
  // over-covers, making subject + surroundings one blob — a whole-component
  // veto would erase the subject too, Sammie semantics are "this pixel is
  // background"). Whole-component vetoes stay for blobs the negative owns
  // outright (background blobs that were not picked).
  for (const ci of picks) vetoes.delete(ci)
  if (picks.size > 0 || pos.length === 0) {
    const out = new Uint8Array(w * h)
    for (const [ci, c] of comps.entries()) {
      if (picks.has(ci) && !vetoes.has(ci)) for (const idx of c.pixels) out[idx] = 255
    }
    if (picks.size > 0) {
      const data = frame.imageData.data
      const negTol = 26 * 1.15
      for (const n of neg) {
        const sx = Math.max(0, Math.min(w - 1, Math.round(n.x * w)))
        const sy = Math.max(0, Math.min(h - 1, Math.round(n.y * h)))
        const seed = sy * w + sx
        if (!out[seed]) continue
        const r0 = data[seed * 4]
        const g0 = data[seed * 4 + 1]
        const b0 = data[seed * 4 + 2]
        // Colour-seeded flood inside the mask: removes the clicked
        // background region, stops at the subject's colour boundary.
        const queue: number[] = [seed]
        out[seed] = 0
        let head = 0
        while (head < queue.length) {
          const idx = queue[head++]
          const x = idx % w
          const y = (idx - x) / w
          for (let k = 0; k < 4; k++) {
            const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
            const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const nIdx = ny * w + nx
            if (!out[nIdx]) continue
            if (colorDistance(data, nIdx * 4, r0, g0, b0) > negTol) continue
            out[nIdx] = 0
            queue.push(nIdx)
          }
        }
      }
    }
    if (picks.size > 0) bitmap = { width: w, height: h, data: out }
  }
  if (vetoes.size > 0 && picks.size === 0) {
    // No positive picked (e.g. all clicks removed a false blob) — drop vetoed
    // components from the raw mask.
    const out = new Uint8Array(bitmap.data)
    for (const ci of vetoes) for (const idx of comps[ci].pixels) out[idx] = 0
    bitmap = { width: w, height: h, data: out }
  }
  return { mask: bitmap, modelMs: performance.now() - t0 }
}

async function runModelWeb(frame: WorkingFrame, model: RotoModelDescriptor): Promise<{ prob: Float32Array; size: number }> {
  const session = await getRotoSession(model)
  const ort = await import('onnxruntime-web')
  const input = await preprocessSaliency(frame.source, frame.sourceWidth, frame.sourceHeight, model.inputSize)
  const feeds: Record<string, Ort.Tensor> = {}
  feeds[session.inputNames[0]] = new ort.Tensor('float32', input, [1, 3, model.inputSize, model.inputSize])
  const output = await session.run(feeds)
  const { prob, size } = postprocessSaliency(output as unknown as Record<string, unknown>, model.inputSize)
  return { prob, size }
}

/** Desktop sidecar path (src-tauri command roto_segment). */
async function runModelDesktop(frame: WorkingFrame, model: RotoModelDescriptor): Promise<{ prob: Float32Array; size: number }> {
  const { invoke } = await import('@tauri-apps/api/core')
  const c = document.createElement('canvas')
  c.width = frame.width
  c.height = frame.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.putImageData(frame.imageData, 0, 0)
  const dataUrl: string = await new Promise((resolve) => c.toBlob((b) => {
    if (!b) return resolve('')
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.readAsDataURL(b)
  }, 'image/png'))
  const b64 = dataUrl.split(',')[1] || ''
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
  const res = await invoke<string>('roto_segment', {
    framePng: Array.from(bytes),
    modelFile: model.url.replace('/models/', ''),
  })
  // Sidecar returns an 8-bit grayscale PNG (base64) at the frame resolution.
  const bin = Uint8Array.from(atob(res.split(',')[1] ?? res), (ch) => ch.charCodeAt(0))
  const blob = new Blob([bin], { type: 'image/png' })
  const bmp = await createImageBitmap(blob)
  const bc = document.createElement('canvas')
  bc.width = bmp.width
  bc.height = bmp.height
  const bctx = bc.getContext('2d', { willReadFrequently: true })
  if (!bctx) throw new Error('2d context unavailable')
  bctx.drawImage(bmp, 0, 0)
  const img = bctx.getImageData(0, 0, bmp.width, bmp.height)
  const prob = new Float32Array(bmp.width * bmp.height)
  for (let i = 0; i < prob.length; i++) prob[i] = img.data[i * 4] / 255
  return { prob, size: bmp.width }
}

// ---------------------------------------------------------------------------
// SAM engine — promptable encoder/decoder (MobileSAM)
// ---------------------------------------------------------------------------

/** SAM pixel normalisation (ImageNet mean/std, applied before padding). */
const SAM_MEAN = [123.675, 116.28, 103.53]
const SAM_STD = [58.395, 57.12, 57.375]

/** Encoder-embedding cache: clicks after the first only run the decoder. */
const samEmbeddingCache = new Map<string, Ort.Tensor>()

function samPreprocess(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): { input: Float32Array; scale: number } {
  const scale = 1024 / Math.max(sourceWidth, sourceHeight)
  const rw = Math.max(1, Math.round(sourceWidth * scale))
  const rh = Math.max(1, Math.round(sourceHeight * scale))
  const c = document.createElement('canvas')
  c.width = rw
  c.height = rh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, rw, rh)
  const img = ctx.getImageData(0, 0, rw, rh)
  // NCHW 1x3x1024x1024, zero-padded right/bottom, ImageNet-normalised.
  const input = new Float32Array(3 * 1024 * 1024)
  const plane = 1024 * 1024
  for (let y = 0; y < rh; y++) {
    const rowIn = y * rw
    const rowOut = y * 1024
    for (let x = 0; x < rw; x++) {
      const i = (rowIn + x) * 4
      const o = rowOut + x
      input[o] = (img.data[i] - SAM_MEAN[0]) / SAM_STD[0]
      input[plane + o] = (img.data[i + 1] - SAM_MEAN[1]) / SAM_STD[1]
      input[2 * plane + o] = (img.data[i + 2] - SAM_MEAN[2]) / SAM_STD[2]
    }
  }
  return { input, scale }
}

async function segmentWithSAM(
  frame: WorkingFrame,
  clicks: RotoClick[],
  model: RotoModelDescriptor,
  cacheKey?: string,
): Promise<MaskBitmap> {
  const { encoder, decoder } = await getRotoSamSessions(model)
  const ort = await import('onnxruntime-web')
  const { width: w, height: h } = frame
  const scale = 1024 / Math.max(w, h)

  let embedding = cacheKey ? samEmbeddingCache.get(cacheKey) : undefined
  if (!embedding) {
    const { input } = samPreprocess(frame.source, frame.sourceWidth, frame.sourceHeight)
    const feeds: Record<string, Ort.Tensor> = {}
    feeds[encoder.inputNames[0]] = new ort.Tensor('float32', input, [1, 3, 1024, 1024])
    const encOut = await encoder.run(feeds)
    embedding = encOut[encoder.outputNames[0]]
    if (cacheKey) {
      samEmbeddingCache.set(cacheKey, embedding)
      while (samEmbeddingCache.size > 4) {
        const oldest = samEmbeddingCache.keys().next().value
        if (oldest === undefined) break
        samEmbeddingCache.delete(oldest)
      }
    }
  }

  // The user's clicks ARE the prompt: positive -> label 1, negative -> 0.
  const pos = clicks.filter((c) => c.positive)
  if (pos.length === 0) throw new Error('SAM needs at least one positive click')
  const coords = new Float32Array(clicks.length * 2)
  const labels = new Float32Array(clicks.length)
  clicks.forEach((c, i) => {
    coords[i * 2] = c.x * w * scale
    coords[i * 2 + 1] = c.y * h * scale
    labels[i] = c.positive ? 1 : 0
  })

  const runDecoder = (maskInput: Ort.Tensor | null) => {
    const feeds: Record<string, Ort.Tensor> = {
      image_embedding: embedding as unknown as Ort.Tensor,
      point_coords: new ort.Tensor('float32', coords, [1, clicks.length, 2]),
      point_labels: new ort.Tensor('float32', labels, [1, clicks.length]),
      mask_input: maskInput ?? new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', maskInput ? [1] : [0], [1]),
      orig_im_size: new ort.Tensor('float32', [h, w], [2]),
    }
    return decoder.run(feeds)
  }

  // First pass picks the object; the second feeds the logits back in
  // (SAM's iterative refinement) for cleaner boundaries.
  const out1 = await runDecoder(null)
  const logits1 = out1[decoder.outputNames[2]] ?? Object.values(out1)[2]
  const out = logits1
    ? await runDecoder(logits1 as Ort.Tensor)
    : out1
  const masks = (out[decoder.outputNames[0]] ?? Object.values(out)[0]) as { data: Float32Array }

  const data = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) data[i] = masks.data[i] > 0 ? 255 : 0
  return { width: w, height: h, data }
}

// ---------------------------------------------------------------------------
// Unified entry
// ---------------------------------------------------------------------------

export async function runRotoSegmentation(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  clicks: RotoClick[],
  model: RotoModelDescriptor | null,
  opts: RotoSegmentOptions = {},
): Promise<RotoSegmentResult> {
  const t0 = performance.now()
  const { tolerance = 26, feather = 2, maxWorkingEdge = 720, samCacheKey } = opts
  const frame = rasterizeWorkingFrame(source, sourceWidth, sourceHeight, maxWorkingEdge)

  let mask: MaskBitmap
  let engine: string
  let modelMs: number | undefined
  if (model?.kind === 'sam') {
    mask = await segmentWithSAM(frame, clicks, model, samCacheKey)
    engine = model.id
    if (maskCoverage(mask) < 0.0005) {
      // Nothing usable from the prompt — fall back to Smart so the click
      // still produces a mask the user can refine.
      mask = segmentSmart(frame, clicks, tolerance)
      engine = `${model.id}+smart-fallback`
    }
  } else if (model) {
    const r = await segmentWithModel(frame, clicks, model)
    mask = r.mask
    engine = model.id
    modelMs = r.modelMs
    if (maskCoverage(mask) < 0.0005) {
      // Model found nothing usable at this threshold — fall back to Smart so
      // the user still gets a mask from their click.
      mask = segmentSmart(frame, clicks, tolerance)
      engine = `${model.id}+smart-fallback`
    }
  } else {
    mask = segmentSmart(frame, clicks, tolerance)
    engine = 'smart'
  }

  const feathered = feather > 0 ? featherMask(mask, feather) : mask
  return {
    width: frame.width,
    height: frame.height,
    mask: feathered,
    maskDataUrl: maskToDataUrl(feathered),
    coverage: maskCoverage(feathered),
    engine,
    timings: { total: performance.now() - t0, model: modelMs },
  }
}

// ---------------------------------------------------------------------------
// Frame propagation (mini MatAnyone: block-match warp + colour re-anchor)
// ---------------------------------------------------------------------------

export interface PropagateOptions {
  /** Grid spacing in working px for the tracked points. Default 16. */
  gridStep?: number
  /** Colour tolerance 0..100 for the re-anchor step. Default 30. */
  tolerance?: number
  /** Working edge for both frames. Default 480 (propagation is iterative). */
  maxWorkingEdge?: number
}

/**
 * Propagate a mask one frame forward. `base` and `next` must be rasters at
 * the same working resolution (use rasterizeWorkingFrame with the same
 * maxWorkingEdge and source dimensions).
 */
export function propagateMaskToFrame(
  base: ImageData,
  baseMask: MaskBitmap,
  next: ImageData,
  opts: PropagateOptions = {},
): MaskBitmap {
  const { gridStep = 16, tolerance = 30 } = opts
  const w = base.width
  const h = base.height
  if (next.width !== w || next.height !== h || baseMask.width !== w || baseMask.height !== h) {
    return baseMask
  }

  const baseMaps = computeFrameMaps(base)
  const nextMaps = computeFrameMaps(next)
  const trackOpts = { ...DEFAULT_TRACK_OPTIONS, searchWindow: Math.max(12, gridStep), forwardBackwardCheck: true }

  // 1. Grid of tracked points inside the mask (erode slightly to avoid
  //    tracking boundary flicker).
  const interior = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (
        baseMask.data[i] >= 128 &&
        baseMask.data[i - 1] >= 128 &&
        baseMask.data[i + 1] >= 128 &&
        baseMask.data[i - w] >= 128 &&
        baseMask.data[i + w] >= 128
      ) {
        interior[i] = 1
      }
    }
  }
  const pts: { x: number; y: number }[] = []
  for (let y = gridStep >> 1; y < h; y += gridStep) {
    for (let x = gridStep >> 1; x < w; x += gridStep) {
      if (interior[y * w + x]) pts.push({ x, y })
    }
  }
  if (pts.length === 0) return baseMask

  // 2. Match each grid point forward.
  const disp = new Map<number, { dx: number; dy: number; conf: number }>()
  for (const p of pts) {
    const m = matchPatch(baseMaps, p, nextMaps, p, trackOpts)
    if (m.confidence > 0.35) {
      disp.set(p.y * w + p.x, { dx: m.point.x - p.x, dy: m.point.y - p.y, conf: m.confidence })
    }
  }
  if (disp.size === 0) return baseMask

  // 3. Splat-warp the mask by the (nearest-grid) displacement field.
  const warped = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (baseMask.data[i] < 128) continue
      // Nearest tracked grid point.
      const gx = Math.min(w - 1, Math.round((x / gridStep) * gridStep) + (gridStep >> 1))
      const gy = Math.min(h - 1, Math.round((y / gridStep) * gridStep) + (gridStep >> 1))
      let d = disp.get(gy * w + gx)
      if (!d) {
        // Search outward for the nearest tracked cell.
        let best: { dx: number; dy: number } | null = null
        let bestDist = Infinity
        for (let r = 1; r <= 2 && !best; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const cand = disp.get((gy + dy * gridStep) * w + (gx + dx * gridStep))
              if (cand) {
                const dist = dx * dx + dy * dy
                if (dist < bestDist) {
                  bestDist = dist
                  best = cand
                }
              }
            }
          }
        }
        if (!best) continue
        d = { ...best, conf: 0.5 }
      }
      const nx = Math.round(x + d.dx)
      const ny = Math.round(y + d.dy)
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      warped[ny * w + nx] = 255
    }
  }

  // 4. Colour re-anchor: fit a colour model from the base frame's masked
  //    pixels, then grow/trim the warped mask in the next frame.
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4096)))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = y * w + x
      if (baseMask.data[i] >= 128) {
        r += base.data[i * 4]
        g += base.data[i * 4 + 1]
        b += base.data[i * 4 + 2]
        n++
      }
    }
  }
  if (n === 0) return { width: w, height: h, data: warped }
  r /= n
  g /= n
  b /= n
  const tol = tolerance * 1.1
  const anchored = new Uint8Array(warped)
  const grow = (start: number) => {
    const queue = [start]
    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      const x = idx % w
      const y = (idx - x) / w
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
        const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const nIdx = ny * w + nx
        if (anchored[nIdx]) continue
        // Only grow within a small band of the warp (re-anchor, not re-seg).
        const bx = Math.min(w - 1, Math.max(0, nx))
        const by = Math.min(h - 1, Math.max(0, ny))
        if (!warped[by * w + bx] && !anchored[nIdx]) {
          // require a warped neighbour within 4px
          let near = false
          for (let dy2 = -4; dy2 <= 4 && !near; dy2 += 2) {
            for (let dx2 = -4; dx2 <= 4 && !near; dx2 += 2) {
              const cx = nx + dx2
              const cy = ny + dy2
              if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue
              if (warped[cy * w + cx]) near = true
            }
          }
          if (!near) continue
        }
        if (colorDistance(next.data, nIdx * 4, r, g, b) > tol) continue
        anchored[nIdx] = 255
        queue.push(nIdx)
      }
    }
  }
  for (let i = 0; i < anchored.length; i++) if (anchored[i]) grow(i)

  // 5. Keep the largest component to suppress drift islands.
  const comps = connectedComponents(anchored, w, h, Math.max(24, Math.floor(w * h * 0.0004)))
  if (comps.length > 1) {
    let best = comps[0]
    for (const c of comps) if (c.pixels.length > best.pixels.length) best = c
    const out = new Uint8Array(w * h)
    for (const idx of best.pixels) out[idx] = 255
    return { width: w, height: h, data: out }
  }
  return { width: w, height: h, data: anchored }
}

// ---------------------------------------------------------------------------
// Background patch (inpaint the hole left by the extracted subject)
// ---------------------------------------------------------------------------

/**
 * Pyramid "push-pull" inpaint: downsample only the known (non-hole) pixels,
 * then pull the coarse levels back up to fill the hole, followed by a couple
 * of local smoothing passes over the seam. This is the cheap spatial
 * fallback of the ProPainter-style object removal in the reference tool —
 * deterministic, no model, and good for static-camera shots; the character
 * layer pasted on top hides the soft regions in motion shots.
 *
 * Returns a PNG data URL of the frame-sized image with ONLY the hole region
 * painted (patched background) and every other pixel transparent — so it
 * can be layered directly above the original video as a background patch.
 */
export function inpaintMaskedHole(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  mask: MaskBitmap,
): string {
  const c = document.createElement('canvas')
  c.width = sourceWidth
  c.height = sourceHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight)
  const w = sourceWidth
  const h = sourceHeight

  const sampleMask = (x: number, y: number): number => {
    const mx = Math.min(mask.width - 1, Math.floor((x / w) * mask.width))
    const my = Math.min(mask.height - 1, Math.floor((y / h) * mask.height))
    return mask.data[my * mask.width + mx]
  }
  const isHole = (x: number, y: number) => sampleMask(x, y) >= 100

  // Work at a capped resolution — the patch is smooth by construction.
  const scale = Math.min(1, 640 / Math.max(w, h))
  const ww = Math.max(8, Math.round(w * scale))
  const hh = Math.max(8, Math.round(h * scale))
  const dctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!dctx) return ''
  dctx.canvas.width = ww
  dctx.canvas.height = hh
  dctx.drawImage(c, 0, 0, w, h, 0, 0, ww, hh)
  const small = dctx.getImageData(0, 0, ww, hh)
  const px = (img: ImageData, x: number, y: number) => (y * img.width + x) * 4

  // Build the pyramid of known-color sums.
  type Level = { w: number; h: number; r: Float32Array; g: Float32Array; b: Float32Array; n: Float32Array }
  const levels: Level[] = []
  let curW = ww
  let curH = hh
  let curR = new Float32Array(curW * curH)
  let curG = new Float32Array(curW * curH)
  let curB = new Float32Array(curW * curH)
  let curN = new Float32Array(curW * curH)
  for (let y = 0; y < curH; y++) {
    for (let x = 0; x < curW; x++) {
      if (isHole(x, y)) continue
      const p = px(small, x, y)
      curR[y * curW + x] = small.data[p]
      curG[y * curW + x] = small.data[p + 1]
      curB[y * curW + x] = small.data[p + 2]
      curN[y * curW + x] = 1
    }
  }
  levels.push({ w: curW, h: curH, r: curR, g: curG, b: curB, n: curN })
  while (curW > 2 && curH > 2) {
    const nw = Math.max(1, curW >> 1)
    const nh = Math.max(1, curH >> 1)
    const nr = new Float32Array(nw * nh)
    const ng = new Float32Array(nw * nh)
    const nb = new Float32Array(nw * nh)
    const nn = new Float32Array(nw * nh)
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(curW - 1, x * 2 + dx)
            const sy = Math.min(curH - 1, y * 2 + dy)
            const si = sy * curW + sx
            const wi = y * nw + x
            nr[wi] += curR[si]
            ng[wi] += curG[si]
            nb[wi] += curB[si]
            nn[wi] += curN[si]
          }
        }
      }
    }
    curW = nw
    curH = nh
    curR = nr
    curG = ng
    curB = nb
    curN = nn
    levels.push({ w: curW, h: curH, r: curR, g: curG, b: curB, n: curN })
  }

  // Pull back up: fill hole pixels from the coarsest level that knows a color.
  const filled = new ImageData(ww, hh)
  filled.data.set(small.data)
  for (let li = levels.length - 2; li >= 0; li--) {
    const coarse = levels[li + 1]
    const fine = levels[li]
    for (let y = 0; y < fine.h; y++) {
      for (let x = 0; x < fine.w; x++) {
        const fi = y * fine.w + x
        if (fine.n[fi] > 0) continue
        const cx = Math.min(coarse.w - 1, x >> 1)
        const cy = Math.min(coarse.h - 1, y >> 1)
        const ci = cy * coarse.w + cx
        if (coarse.n[ci] > 0) {
          fine.r[fi] = coarse.r[ci] / coarse.n[ci]
          fine.g[fi] = coarse.g[ci] / coarse.n[ci]
          fine.b[fi] = coarse.b[ci] / coarse.n[ci]
          fine.n[fi] = 1
        }
      }
    }
    for (let y = 0; y < fine.h; y++) {
      for (let x = 0; x < fine.w; x++) {
        const fi = y * fine.w + x
        if (fine.n[fi] === 0) continue
        const p = px(filled, x, y)
        filled.data[p] = fine.r[fi]
        filled.data[p + 1] = fine.g[fi]
        filled.data[p + 2] = fine.b[fi]
        filled.data[p + 3] = 255
      }
    }
  }

  // Two smoothing passes over hole pixels to hide the pyramid seams.
  for (let pass = 0; pass < 2; pass++) {
    const copy = new Uint8ClampedArray(filled.data)
    for (let y = 1; y < hh - 1; y++) {
      for (let x = 1; x < ww - 1; x++) {
        if (!isHole(x, y)) continue
        const p = px(filled, x, y)
        for (let ch = 0; ch < 3; ch++) {
          let acc = 0
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              acc += copy[px(filled, Math.min(ww - 1, x + dx), Math.min(hh - 1, y + dy)) + ch]
            }
          }
          filled.data[p + ch] = acc / 9
        }
      }
    }
  }

  // Output: full-resolution, ONLY the hole region painted, rest transparent.
  const out = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(hh - 1, Math.floor((y / h) * hh))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(ww - 1, Math.floor((x / w) * ww))
      const o = (y * w + x) * 4
      if (!isHole(x, y)) {
        out.data[o + 3] = 0
        continue
      }
      const s = px(filled, sx, sy)
      out.data[o] = filled.data[s]
      out.data[o + 1] = filled.data[s + 1]
      out.data[o + 2] = filled.data[s + 2]
      out.data[o + 3] = 255
    }
  }
  ctx.clearRect(0, 0, w, h)
  ctx.putImageData(out, 0, 0)
  return c.toDataURL('image/png')
}
