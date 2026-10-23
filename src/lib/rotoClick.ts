/**
 * Click-segment rotoscoping maths (Sammie-Roto-2 Smart-engine shape, ported
 * and improved): colour models fitted around positive/negative clicks,
 * gradient-demoted scoring, connected-component keep, and — the improvement
 * over the old hard binarisation — a SOFT matting band so edges carry
 * partial alpha (strand/feather detail) instead of a cut-out stair step.
 * Pure pixel maths, no imports: shared by rotoMaskEngine.ts (booted app),
 * tools/mcp (headless) so both segment identically.
 */
export interface ClickPt { x: number; y: number } // normalized 0..1 in raster
export interface RotoClickResult {
  alpha: Uint8ClampedArray
  pixels: number
  bbox: { x0: number; y0: number; x1: number; y1: number } | null
}

const dist = (p: Uint8ClampedArray, i: number, r: number, g: number, b: number) => {
  const dr = p[i] - r, dg = p[i + 1] - g, db = p[i + 2] - b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function gradientMagnitude(p: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const gx = (p[i + 4] + p[i + 8]) / 2 - (p[i - 4] + p[i - 8]) / 2
      const gy = (p[i + w * 4] + p[i + w * 8]) / 2 - (p[i - w * 4] + p[i - w * 8]) / 2
      g[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 255)
    }
  }
  return g
}

export function clickSegment(
  px: Uint8ClampedArray, w: number, h: number,
  add: ClickPt[], sub: ClickPt[], tolerance = 26, soft = true,
): RotoClickResult {
  const alpha = new Uint8ClampedArray(w * h)
  if (!add.length) return { alpha, pixels: 0, bbox: null }
  const diskR = Math.max(3, Math.round(Math.min(w, h) * 0.012))
  const fit = (pts: ClickPt[]) => {
    let r = 0, g = 0, b = 0, n = 0
    for (const pt of pts) {
      const cx = Math.round(pt.x * w), cy = Math.round(pt.y * h)
      for (let dy = -diskR; dy <= diskR; dy++) {
        for (let dx = -diskR; dx <= diskR; dx++) {
          if (dx * dx + dy * dy > diskR * diskR) continue
          const x = cx + dx, y = cy + dy
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const i = (y * w + x) * 4
          r += px[i]; g += px[i + 1]; b += px[i + 2]; n++
        }
      }
    }
    n = Math.max(1, n)
    return { r: r / n, g: g / n, b: b / n }
  }
  // one colour model PER positive click (multi-cluster union): a character
  // spans hair + skin + cloth, and averaging those into one model segments
  // nothing. Sammie-Roto-2 behaves the same way: every add click contributes.
  const posModels = add.map((pt) => fit([pt]))
  const negM = sub.length ? fit(sub) : null
  const tol = tolerance * 0.95
  const grad = gradientMagnitude(px, w, h)
  const score = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const pix = i * 4
    let dPos = Infinity
    for (const m of posModels) {
      const d = dist(px, pix, m.r, m.g, m.b)
      if (d < dPos) dPos = d
    }
    let s = dPos <= tol ? 1 - dPos / (tol * 1.6) : 0
    if (negM) {
      const dNeg = dist(px, pix, negM.r, negM.g, negM.b)
      if (dNeg < dPos) s *= 0.25
    }
    score[i] = s * (1 - grad[i] * 0.25)
  }
  // binary core for component keeping
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < bin.length; i++) bin[i] = score[i] > 0.18 ? 1 : 0
  // connected components (BFS), keep those carrying a positive click,
  // drop those carrying a negative click
  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  const minSize = Math.max(24, Math.floor(w * h * 0.0004))
  const keep = new Uint8Array(w * h)
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || seen[start]) continue
    let head = 0, tail = 0
    queue[tail++] = start; seen[start] = 1
    const pixels: number[] = []
    while (head < tail) {
      const idx = queue[head++]
      pixels.push(idx)
      const x = idx % w, y = (idx - x) / w
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (bin[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j }
      }
    }
    if (pixels.length < minSize) continue
    const hit = (pt: ClickPt) => {
      const cx = Math.round(pt.x * w), cy = Math.round(pt.y * h)
      return pixels.some((idx) => {
        const x = idx % w, y = (idx - x) / w
        return Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3
      })
    }
    const hasPos = add.some(hit)
    const hasNeg = sub.some(hit)
    if (hasPos && !hasNeg) for (const idx of pixels) keep[idx] = 1
  }
  // fill holes: kept components often wrap dark details (text, eyes, logos)
  // that the colour model scores 0 — flood the outside, whatever was never
  // reached is a hole and belongs to the subject at full alpha
  const outside = new Uint8Array(w * h)
  const fq = new Int32Array(w * h)
  let fh = 0, ft = 0
  const seed = (idx: number) => { if (!keep[idx] && !outside[idx]) { outside[idx] = 1; fq[ft++] = idx } }
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1) }
  while (fh < ft) {
    const idx = fq[fh++]
    const x = idx % w, y = (idx - x) / w
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (!keep[j] && !outside[j]) { outside[j] = 1; fq[ft++] = j }
    }
  }
  for (let i = 0; i < keep.length; i++) if (!keep[i] && !outside[i]) { keep[i] = 1; score[i] = 1 }

  // soft matting band: inside kept components alpha follows the score ramp,
  // so uncertain edge pixels carry partial alpha instead of a hard step
  let pixelsOut = 0
  let bbox: RotoClickResult['bbox'] = null
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) continue
    let a = 255
    if (soft) {
      const s = score[i]
      a = s >= 0.55 ? 255 : s <= 0.18 ? 40 : Math.round(40 + ((s - 0.18) / 0.37) * 215)
    }
    alpha[i] = a
    if (a > 8) {
      pixelsOut++
      const x = i % w, y = (i - x) / w
      if (!bbox) bbox = { x0: x, y0: y, x1: x, y1: y }
      else {
        bbox.x0 = Math.min(bbox.x0, x); bbox.y0 = Math.min(bbox.y0, y)
        bbox.x1 = Math.max(bbox.x1, x); bbox.y1 = Math.max(bbox.y1, y)
      }
    }
  }
  return { alpha, pixels: pixelsOut, bbox }
}

/** White-on-black luma matte (Sammie export convention, AE-ready). */
export function lumaMatteBytes(alpha: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length * 4)
  for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
    out[j] = out[j + 1] = out[j + 2] = alpha[i]
    out[j + 3] = 255
  }
  return out
}
