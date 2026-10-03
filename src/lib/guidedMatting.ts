/**
 * Guided Rect Matting — coordinate-seeded foreground extraction.
 *
 * OmniFrame's own "draw a box, click Remove Background" mode.
 *
 * Pipeline (browser-safe, deterministic, no model download):
 *   1. Rasterise the source frame at a capped working resolution.
 *   2. Seed models from the user's rectangle geometry:
 *        - background seeds  = the ring OUTSIDE the rectangle (or the image
 *          border band when the rectangle touches the frame edge)
 *        - foreground seeds  = the eroded core of the rectangle (inner ~55%)
 *   3. Fit two Gaussian Mixture Models (k components, diagonal covariance) in
 *      RGB + weak position feature space using k-means init followed by EM.
 *   4. Classify every pixel in the rectangle neighbourhood by comparing the
 *      minimum Mahalanobis+log-determinant cost of each model, then re-estimate
 *      (this is the GrabCut alternation, with a Bayesian classifier standing in
 *      for the graph cut so it stays dependency-free and fast enough for the web).
 *   5. Border matting: pixels within `borderBand` of the decision boundary get a
 *      soft alpha from the cost difference through a logistic ramp.
 *   6. Keep only the connected component containing the rectangle centre.
 *   7. Feather the alpha with a separable box blur and encode as a PNG matte.
 *
 * The result is a non-destructive matte — the source pixels are never modified.
 */

export interface GuidedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface GuidedMattingOptions {
  source: CanvasImageSource
  sourceWidth: number
  sourceHeight: number
  /** Normalised rectangle the user dragged (0..1). */
  rect: GuidedRect
  /** EM alternation count. Default 4. */
  iterations?: number
  /** Soft border width in working pixels. Default 10. */
  borderBand?: number
  /** Alpha feather radius in working pixels. Default 2. */
  feather?: number
  /** Gaussian mixture components per model. Default 5. */
  components?: number
  /** Longest working-resolution edge. Default 900. */
  maxWorkingEdge?: number
  /**
   * Optional click hint inside the subject ("click on the towel"). Pixels inside
   * this radius are forced into the foreground seed set, which disambiguates a
   * rectangle that also catches similarly-coloured background.
   */
  hint?: { x: number; y: number; radius?: number }
}

export interface GuidedMattingResult {
  /** PNG data URL, white = foreground, alpha carries the matte. */
  maskDataUrl: string
  /** RGBA cutout of the foreground (premultiplied by the matte). */
  cutoutDataUrl: string
  width: number
  height: number
  /** Fraction of the rectangle classified as foreground (0..1). */
  coverage: number
  iterations: number
  seedStats: { foreground: number; background: number }
  /** Mean confidence of the retained component (0..1). */
  confidence: number
  timings: { seed: number; gmm: number; classify: number; refine: number; encode: number; total: number }
}

// --------------------------------------------------------------------- helpers

type Vec = Float32Array // length 5: r, g, b, x, y

interface Gmm {
  k: number
  weight: Float64Array
  mean: Float64Array // k * 5
  var_: Float64Array // k * 5
}

const FEAT = 5

function fitGmm(samples: Vec[], k: number, iters: number): Gmm {
  const n = samples.length
  const dim = FEAT
  const gmm: Gmm = {
    k,
    weight: new Float64Array(k),
    mean: new Float64Array(k * dim),
    var_: new Float64Array(k * dim),
  }
  if (n === 0) {
    gmm.weight.fill(1 / k)
    gmm.var_.fill(1)
    return gmm
  }

  const kk = Math.max(1, Math.min(k, n))

  // k-means init: deterministic stride sampling then Lloyd iterations
  const centroids = new Float64Array(kk * dim)
  for (let c = 0; c < kk; c++) {
    const s = samples[Math.floor((c * n) / kk)]
    for (let d = 0; d < dim; d++) centroids[c * dim + d] = s[d]
  }
  const assign = new Int32Array(n)
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < n; i++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < kk; c++) {
        let d2 = 0
        for (let d = 0; d < dim; d++) {
          const diff = samples[i][d] - centroids[c * dim + d]
          d2 += diff * diff
        }
        if (d2 < bestD) {
          bestD = d2
          best = c
        }
      }
      assign[i] = best
    }
    const sums = new Float64Array(kk * dim)
    const counts = new Int32Array(kk)
    for (let i = 0; i < n; i++) {
      const c = assign[i]
      counts[c]++
      for (let d = 0; d < dim; d++) sums[c * dim + d] += samples[i][d]
    }
    for (let c = 0; c < kk; c++) {
      if (counts[c] === 0) continue
      for (let d = 0; d < dim; d++) centroids[c * dim + d] = sums[c * dim + d] / counts[c]
    }
  }

  // EM with diagonal covariance
  const counts = new Float64Array(kk)
  for (let i = 0; i < n; i++) counts[assign[i]]++
  for (let c = 0; c < kk; c++) {
    gmm.weight[c] = counts[c] / n
    for (let d = 0; d < dim; d++) gmm.mean[c * dim + d] = centroids[c * dim + d]
  }
  // initial variance from assignments
  const varSum = new Float64Array(kk * dim)
  for (let i = 0; i < n; i++) {
    const c = assign[i]
    for (let d = 0; d < dim; d++) {
      const diff = samples[i][d] - gmm.mean[c * dim + d]
      varSum[c * dim + d] += diff * diff
    }
  }
  for (let c = 0; c < kk; c++) {
    for (let d = 0; d < dim; d++) {
      gmm.var_[c * dim + d] = Math.max(1e-4, counts[c] > 1 ? varSum[c * dim + d] / counts[c] : 1e-2)
    }
  }

  const resp = new Float64Array(n * kk)
  const logDet = new Float64Array(kk)
  for (let it = 0; it < iters; it++) {
    // E step
    for (let c = 0; c < kk; c++) {
      let ld = 0
      for (let d = 0; d < dim; d++) ld += Math.log(Math.max(1e-6, gmm.var_[c * dim + d]))
      logDet[c] = ld
    }
    for (let i = 0; i < n; i++) {
      let total = 0
      for (let c = 0; c < kk; c++) {
        let d2 = 0
        for (let d = 0; d < dim; d++) {
          const diff = samples[i][d] - gmm.mean[c * dim + d]
          d2 += (diff * diff) / gmm.var_[c * dim + d]
        }
        const p = Math.max(1e-300, gmm.weight[c]) * Math.exp(-0.5 * (d2 + logDet[c]))
        resp[i * kk + c] = p
        total += p
      }
      if (total > 0) for (let c = 0; c < kk; c++) resp[i * kk + c] /= total
    }
    // M step — accumulate responsibilities, then recompute weights & means
    const nk = new Float64Array(kk)
    const meanSum = new Float64Array(kk * dim)
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < kk; c++) {
        const r = resp[i * kk + c]
        nk[c] += r
        for (let d = 0; d < dim; d++) meanSum[c * dim + d] += r * samples[i][d]
      }
    }
    for (let c = 0; c < kk; c++) {
      if (nk[c] > 1e-6) {
        gmm.weight[c] = nk[c] / n
        for (let d = 0; d < dim; d++) gmm.mean[c * dim + d] = meanSum[c * dim + d] / nk[c]
      }
    }
    const varSum2 = new Float64Array(kk * dim)
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < kk; c++) {
        const r = resp[i * kk + c]
        for (let d = 0; d < dim; d++) {
          const diff = samples[i][d] - gmm.mean[c * dim + d]
          varSum2[c * dim + d] += r * diff * diff
        }
      }
    }
    for (let c = 0; c < kk; c++) {
      if (nk[c] > 1e-6) {
        for (let d = 0; d < dim; d++) {
          gmm.var_[c * dim + d] = Math.max(1e-4, varSum2[c * dim + d] / nk[c])
        }
      }
    }
  }
  gmm.k = kk
  return gmm
}

function gmmCost(g: Gmm, v: Vec): number {
  let best = Infinity
  for (let c = 0; c < g.k; c++) {
    let d2 = 0
    let ld = 0
    for (let d = 0; d < FEAT; d++) {
      const diff = v[d] - g.mean[c * FEAT + d]
      d2 += (diff * diff) / g.var_[c * FEAT + d]
      ld += Math.log(Math.max(1e-6, g.var_[c * FEAT + d]))
    }
    const cost = 0.5 * (d2 + ld) - Math.log(Math.max(1e-300, g.weight[c]))
    if (cost < best) best = cost
  }
  return best
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  // horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1)
      const add = Math.min(w - 1, x + r + 1)
      const sub = Math.max(0, x - r)
      sum += src[y * w + add] - src[y * w + sub]
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1)
      const add = Math.min(h - 1, y + r + 1)
      const sub = Math.max(0, y - r)
      sum += tmp[add * w + x] - tmp[sub * w + x]
    }
  }
  return out
}

// ---------------------------------------------------------------- main routine

export function guidedRectMatting(opts: GuidedMattingOptions): GuidedMattingResult {
  const t0 = now()
  const iterations = opts.iterations ?? 4
  const borderBand = opts.borderBand ?? 10
  const feather = opts.feather ?? 2
  const k = opts.components ?? 5
  const maxEdge = opts.maxWorkingEdge ?? 900

  const sw = Math.max(1, Math.floor(opts.sourceWidth))
  const sh = Math.max(1, Math.floor(opts.sourceHeight))
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const w = Math.max(8, Math.round(sw * scale))
  const h = Math.max(8, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('guidedRectMatting: 2D context unavailable')
  ctx.drawImage(opts.source, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data

  // rectangle in working pixels
  const rx = Math.max(0, Math.min(w - 1, Math.round(opts.rect.x * w)))
  const ry = Math.max(0, Math.min(h - 1, Math.round(opts.rect.y * h)))
  const rw = Math.max(2, Math.min(w - rx, Math.round(opts.rect.width * w)))
  const rh = Math.max(2, Math.min(h - ry, Math.round(opts.rect.height * h)))

  // ---- seeds
  const tSeed = now()
  const fgSeeds: Vec[] = []
  const bgSeeds: Vec[] = []

  // foreground seeds: eroded core (inner 55%)
  const coreX0 = rx + Math.round(rw * 0.22)
  const coreX1 = rx + Math.round(rw * 0.78)
  const coreY0 = ry + Math.round(rh * 0.22)
  const coreY1 = ry + Math.round(rh * 0.78)
  // background seeds: ring outside the rectangle (or image border if clipped)
  const padX = Math.max(4, Math.round(rw * 0.14))
  const padY = Math.max(4, Math.round(rh * 0.14))
  const outX0 = Math.max(0, rx - padX)
  const outY0 = Math.max(0, ry - padY)
  const outX1 = Math.min(w - 1, rx + rw + padX)
  const outY1 = Math.min(h - 1, ry + rh + padY)

  const stride = Math.max(1, Math.floor(Math.min(w, h) / 220))
  const feat = (x: number, y: number): Vec => {
    const i = (y * w + x) * 4
    const v = new Float32Array(FEAT)
    v[0] = px[i] / 255
    v[1] = px[i + 1] / 255
    v[2] = px[i + 2] / 255
    v[3] = (x / w) * 0.35
    v[4] = (y / h) * 0.35
    return v
  }

  for (let y = coreY0; y < coreY1; y += stride) {
    for (let x = coreX0; x < coreX1; x += stride) fgSeeds.push(feat(x, y))
  }
  for (let y = outY0; y <= outY1; y += stride) {
    for (let x = outX0; x <= outX1; x += stride) {
      const insideRect = x >= rx && x < rx + rw && y >= ry && y < ry + rh
      if (insideRect) continue
      bgSeeds.push(feat(x, y))
    }
  }
  // If the rectangle touches the frame edge there is no outside ring — fall back
  // to the outer border band of the image, which is almost always background.
  if (bgSeeds.length < 64) {
    const band = Math.max(3, Math.round(Math.min(w, h) * 0.02))
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        if (x < band || y < band || x >= w - band || y >= h - band) bgSeeds.push(feat(x, y))
      }
    }
  }
  const tSeedEnd = now()

  // Optional explicit "this is the subject" click hint
  if (opts.hint) {
    const hx = opts.hint.x * w
    const hy = opts.hint.y * h
    const hr = Math.max(3, (opts.hint.radius ?? 0.03) * Math.min(w, h))
    for (let y = Math.max(0, Math.floor(hy - hr)); y <= Math.min(h - 1, Math.ceil(hy + hr)); y++) {
      for (let x = Math.max(0, Math.floor(hx - hr)); x <= Math.min(w - 1, Math.ceil(hx + hr)); x++) {
        const dx = x - hx
        const dy = y - hy
        if (dx * dx + dy * dy <= hr * hr) fgSeeds.push(feat(x, y))
      }
    }
  }

  // ---- GMMs + alternation
  const tGmm = now()
  let fgGmm = fitGmm(fgSeeds, k, 6)
  let bgGmm = fitGmm(bgSeeds, k, 6)
  const tGmmEnd = now()

  const x0 = Math.max(0, rx - borderBand)
  const y0 = Math.max(0, ry - borderBand)
  const x1 = Math.min(w - 1, rx + rw + borderBand)
  const y1 = Math.min(h - 1, ry + rh + borderBand)
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1

  const tClass = now()
  const costFg = new Float32Array(bw * bh)
  const costBg = new Float32Array(bw * bh)
  const label = new Uint8Array(bw * bh) // 1 = foreground

  const feats: Vec[] = new Array(bw * bh)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y - y0) * bw + (x - x0)
      feats[idx] = feat(x, y)
    }
  }

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < feats.length; i++) {
      const cf = gmmCost(fgGmm, feats[i])
      const cb = gmmCost(bgGmm, feats[i])
      costFg[i] = cf
      costBg[i] = cb
      label[i] = cf <= cb ? 1 : 0
    }
    // re-estimate from confident pixels only (keeps the seeds authoritative)
    const fgRe: Vec[] = []
    const bgRe: Vec[] = []
    for (let i = 0; i < feats.length; i++) {
      const margin = Math.abs(costBg[i] - costFg[i])
      if (label[i] === 1 && margin > 1.0) fgRe.push(feats[i])
      else if (label[i] === 0 && margin > 1.0) bgRe.push(feats[i])
    }
    if (fgRe.length > 64) fgGmm = fitGmm(fgRe, k, 3)
    if (bgRe.length > 64) bgGmm = fitGmm(bgRe, k, 3)
  }
  const tClassEnd = now()

  // ---- soft border matte
  const tRefine = now()
  const alphaWork = new Float32Array(w * h)
  const confWork = new Float32Array(w * h)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y - y0) * bw + (x - x0)
      const diff = costBg[i] - costFg[i] // >0 means foreground wins
      const a = 1 / (1 + Math.exp(-diff * 1.6))
      const inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh
      alphaWork[y * w + x] = inside ? a : label[i] === 1 && a > 0.85 ? a : 0
      confWork[y * w + x] = Math.min(1, Math.abs(diff) / 8)
    }
  }
  const alphaSmooth = boxBlur(alphaWork, w, h, feather)

  // ---- largest connected component containing the rectangle centre
  const cx = Math.floor(rx + rw / 2)
  const cy = Math.floor(ry + rh / 2)
  const hard = new Uint8Array(w * h)
  for (let i = 0; i < alphaSmooth.length; i++) hard[i] = alphaSmooth[i] > 0.5 ? 1 : 0
  // ensure seed is foreground: grow from the strongest pixel inside the core
  let seedIdx = cy * w + cx
  let bestA = -1
  for (let y = coreY0; y < coreY1; y++) {
    for (let x = coreX0; x < coreX1; x++) {
      const a = alphaSmooth[y * w + x]
      if (a > bestA) {
        bestA = a
        seedIdx = y * w + x
      }
    }
  }
  const visited = new Uint8Array(w * h)
  const keep = new Uint8Array(w * h)
  const stack = [seedIdx]
  visited[seedIdx] = 1
  let keptPixels = 0
  while (stack.length) {
    const p = stack.pop() as number
    keep[p] = 1
    keptPixels++
    const pxx = p % w
    const pyy = (p - pxx) / w
    if (pxx > 0 && !visited[p - 1] && hard[p - 1]) {
      visited[p - 1] = 1
      stack.push(p - 1)
    }
    if (pxx < w - 1 && !visited[p + 1] && hard[p + 1]) {
      visited[p + 1] = 1
      stack.push(p + 1)
    }
    if (pyy > 0 && !visited[p - w] && hard[p - w]) {
      visited[p - w] = 1
      stack.push(p - w)
    }
    if (pyy < h - 1 && !visited[p + w] && hard[p + w]) {
      visited[p + w] = 1
      stack.push(p + w)
    }
  }

  let confSum = 0
  let covered = 0
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const p = y * w + x
      if (keep[p]) {
        covered++
        confSum += confWork[p]
      }
    }
  }
  const coverage = covered / Math.max(1, rw * rh)

  // ---- encode matte + cutout
  const tEnc = now()
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mctx = maskCanvas.getContext('2d')
  const maskData = mctx!.createImageData(w, h)
  for (let p = 0; p < w * h; p++) {
    const on = keep[p] ? 1 : 0
    const a = on ? alphaSmooth[p] : 0
    maskData.data[p * 4] = 255
    maskData.data[p * 4 + 1] = 255
    maskData.data[p * 4 + 2] = 255
    maskData.data[p * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
  }
  mctx!.putImageData(maskData, 0, 0)

  const cutCanvas = document.createElement('canvas')
  cutCanvas.width = w
  cutCanvas.height = h
  const cctx = cutCanvas.getContext('2d')
  cctx!.drawImage(canvas, 0, 0)
  cctx!.globalCompositeOperation = 'destination-in'
  cctx!.drawImage(maskCanvas, 0, 0)
  cctx!.globalCompositeOperation = 'source-over'

  const tEnd = now()

  return {
    maskDataUrl: maskCanvas.toDataURL('image/png'),
    cutoutDataUrl: cutCanvas.toDataURL('image/png'),
    width: w,
    height: h,
    coverage,
    iterations,
    seedStats: { foreground: fgSeeds.length, background: bgSeeds.length },
    confidence: covered > 0 ? confSum / covered : 0,
    timings: {
      seed: tSeedEnd - tSeed,
      gmm: tGmmEnd - tGmm,
      classify: tClassEnd - tClass,
      refine: tEnc - tRefine,
      encode: tEnd - tEnc,
      total: tEnd - t0,
    },
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
