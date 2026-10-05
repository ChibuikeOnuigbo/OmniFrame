/**
 * Auto Brush & Magic Wand engines — the "smart" half of the Selection &
 * Masking sub-tool, studied from Sammie-Roto 2 / After Effects Roto Brush
 * behaviour: you paint loosely over a subject and the brush snaps out to the
 * subject's real edges instead of staying a hard circle.
 *
 * Pipeline (browser-safe, deterministic, no model required):
 *   Auto Brush:
 *     1. Rasterise the painted stroke into a seed band (radius px).
 *     2. Fit a colour model (mean + per-channel std) from the stroke's
 *        inner core.
 *     3. Region-grow from the seeds outward, up to `maxGrow` px, stopping at
 *        colour discontinuities (tolerance) and strong gradients (edges).
 *     4. Keep only pixels connected back to the stroke (no leakage islands).
 *     5. Feather the alpha and emit a white-on-alpha PNG matte.
 *
 *   Magic Wand:
 *     Real colour-region selection from the clicked pixel (the previous
 *     implementation produced a fixed 0.2x0.2 rectangle regardless of the
 *     pixels under it). Contiguous flood or global colour-range mode,
 *     plus a radius cap so a mis-click cannot select the entire frame.
 *
 * All functions take ImageData at whatever working resolution the caller
 * chose; masks are returned in the same resolution grid.
 */

export interface MaskBitmap {
  width: number
  height: number
  /** 0..255 coverage per pixel. */
  data: Uint8Array
}

export interface Pt {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Sobel gradient magnitude, normalised 0..1-ish. */
export function gradientMagnitude(img: ImageData): Float32Array {
  const { width: w, height: h, data } = img
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const lum = (p: number) => 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
      const tl = lum(i - w * 4 - 4)
      const t = lum(i - w * 4)
      const tr = lum(i - w * 4 + 4)
      const l = lum(i - 4)
      const r = lum(i + 4)
      const bl = lum(i + w * 4 - 4)
      const b = lum(i + w * 4)
      const br = lum(i + w * 4 + 4)
      const gx = tr + 2 * r + br - (tl + 2 * l + bl)
      const gy = bl + 2 * b + br - (tl + 2 * t + tr)
      out[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 4)
    }
  }
  return out
}

/** Perceptual-ish weighted RGB distance (2-4-3 luma weighting). */
export function colorDistance(
  data: Uint8ClampedArray,
  a: number,
  br: number,
  bg: number,
  bb: number,
): number {
  const dr = data[a] - br
  const dg = data[a + 1] - bg
  const db = data[a + 2] - bb
  return Math.sqrt((dr * dr * 2 + dg * dg * 4 + db * db * 3) / 9)
}

/** Colour model sampled from a set of pixels. */
interface ColorModel {
  r: number
  g: number
  b: number
  /** Mean deviation — grows the tolerance for textured subjects. */
  spread: number
}

function fitColorModel(img: ImageData, pixels: number[]): ColorModel {
  let r = 0
  let g = 0
  let b = 0
  const n = Math.max(1, pixels.length)
  for (const p of pixels) {
    r += img.data[p]
    g += img.data[p + 1]
    b += img.data[p + 2]
  }
  r /= n
  g /= n
  b /= n
  let dev = 0
  for (const p of pixels) {
    dev += Math.abs(img.data[p] - r) + Math.abs(img.data[p + 1] - g) + Math.abs(img.data[p + 2] - b)
  }
  return { r, g, b, spread: Math.min(44, (dev / n) * 0.35) }
}

/** Separable box blur over a coverage mask (feather). */
export function featherMask(mask: MaskBitmap, radius: number): MaskBitmap {
  if (radius < 1) return mask
  const { width: w, height: h } = mask
  const r = Math.min(24, Math.round(radius))
  const tmp = new Float32Array(w * h)
  const out = new Uint8Array(w * h)
  const span = r * 2 + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += mask.data[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / span
      acc -= mask.data[y * w + Math.min(w - 1, Math.max(0, x - r))]
      acc += mask.data[y * w + Math.min(w - 1, Math.max(0, x + r + 1))]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / span
      acc -= tmp[Math.min(h - 1, Math.max(0, y - r)) * w + x]
      acc += tmp[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x]
    }
  }
  return { width: w, height: h, data: out }
}

export function erodeMask(mask: MaskBitmap, radius: number): MaskBitmap {
  return morphMask(mask, radius, false)
}

export function dilateMask(mask: MaskBitmap, radius: number): MaskBitmap {
  return morphMask(mask, radius, true)
}

function morphMask(mask: MaskBitmap, radius: number, dilate: boolean): MaskBitmap {
  if (radius < 1) return mask
  const { width: w, height: h, data } = mask
  const out = new Uint8Array(w * h)
  const r = Math.min(16, Math.round(radius))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 255
      for (let dy = -r; dy <= r && (dilate ? v < 128 : v > 127); dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy))
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx))
          const s = data[yy * w + xx]
          if (dilate) {
            if (s > 127) {
              v = s
              break
            }
          } else if (s < 128) {
            v = s
            break
          }
        }
      }
      out[y * w + x] = v
    }
  }
  return { width: w, height: h, data: out }
}

/** Bounds of the >=128 region, in pixels. */
export function maskBounds(mask: MaskBitmap): { x: number; y: number; width: number; height: number } {
  const { width: w, height: h, data } = mask
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] >= 128) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function maskCoverage(mask: MaskBitmap): number {
  let n = 0
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i] >= 128) n++
  return n / mask.data.length
}

/** White-on-alpha PNG matte (matches guidedMatting's convention). */
export function maskToDataUrl(mask: MaskBitmap): string {
  const c = document.createElement('canvas')
  c.width = mask.width
  c.height = mask.height
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(mask.width, mask.height)
  for (let i = 0; i < mask.data.length; i++) {
    img.data[i * 4] = 255
    img.data[i * 4 + 1] = 255
    img.data[i * 4 + 2] = 255
    img.data[i * 4 + 3] = mask.data[i]
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

/** RGBA cutout of the source premultiplied by the matte. */
export function cutoutToDataUrl(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, mask: MaskBitmap): string {
  const c = document.createElement('canvas')
  c.width = sourceWidth
  c.height = sourceHeight
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight)
  const frame = ctx.getImageData(0, 0, sourceWidth, sourceHeight)
  // Mask may be at a lower working resolution — nearest-sample it up.
  for (let y = 0; y < sourceHeight; y++) {
    const my = Math.min(mask.height - 1, Math.floor((y / sourceHeight) * mask.height))
    for (let x = 0; x < sourceWidth; x++) {
      const mx = Math.min(mask.width - 1, Math.floor((x / sourceWidth) * mask.width))
      frame.data[(y * sourceWidth + x) * 4 + 3] = mask.data[my * mask.width + mx]
    }
  }
  ctx.putImageData(frame, 0, 0)
  return c.toDataURL('image/png')
}

/** Luma matte export: white subject on black, opaque (After Effects style). */
export function lumaMatteToDataUrl(mask: MaskBitmap): string {
  const c = document.createElement('canvas')
  c.width = mask.width
  c.height = mask.height
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(mask.width, mask.height)
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i]
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Auto Brush
// ---------------------------------------------------------------------------

export interface AutoBrushOptions {
  /** Working-resolution image data of the current frame. */
  source: ImageData
  /** Painted stroke, in working-resolution pixels. */
  stroke: Pt[]
  /** Brush radius in working pixels. */
  radius: number
  /** 0..100 — colour tolerance for the grow step. */
  tolerance?: number
  /** Max outward growth beyond the painted band, in px. Default 48. */
  maxGrow?: number
  /** 0..1 — how strongly strong gradients block growth. Default 0.6. */
  edgeStop?: number
  /** Feather radius in working px. Default 1.5. */
  feather?: number
  /** Snap the boundary to the strongest nearby edge (0 = off, default 2 px search). */
  snap?: number
}

export interface AutoBrushResult {
  mask: MaskBitmap
  coverage: number
  /** Working pixels the auto-grow added beyond the painted band. */
  grownPixels: number
}

/**
 * Edge-snapping auto brush. The painted band is the seed; the mask grows to
 * real object boundaries guided by the stroke's colour model and the frame's
 * gradient field. Setting tolerance=0 + maxGrow=0 degenerates to the classic
 * hard round brush.
 */
export function autoBrushMaskFromStroke(opts: AutoBrushOptions): AutoBrushResult {
  const {
    source,
    stroke,
    radius,
    tolerance = 24,
    maxGrow = 48,
    edgeStop = 0.6,
    feather = 1.5,
    snap = 2,
  } = opts
  const { width: w, height: h } = source
  if (stroke.length === 0 || w === 0 || h === 0) {
    return { mask: { width: w, height: h, data: new Uint8Array(w * h) }, coverage: 0, grownPixels: 0 }
  }

  const grad = gradientMagnitude(source)
  const mask = new Uint8Array(w * h) // 255 = in
  const queue: number[] = []

  // 1. Rasterise the stroke band.
  const r = Math.max(1, Math.round(radius))
  for (const p of stroke) {
    const cx = Math.round(p.x)
    const cy = Math.round(p.y)
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy
      if (y < 0 || y >= h) continue
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx
        if (x < 0 || x >= w) continue
        if (dx * dx + dy * dy > r * r) continue
        const idx = y * w + x
        if (!mask[idx]) {
          mask[idx] = 255
          queue.push(idx)
        }
      }
    }
  }
  const seedCount = queue.length

  // 2. Colour model from the stroke's inner core.
  const core: number[] = []
  const coreR = Math.max(1, Math.round(radius * 0.5))
  for (const p of stroke) {
    const cx = Math.round(p.x)
    const cy = Math.round(p.y)
    for (let dy = -coreR; dy <= coreR; dy += 2) {
      const y = cy + dy
      if (y < 0 || y >= h) continue
      for (let dx = -coreR; dx <= coreR; dx += 2) {
        const x = cx + dx
        if (x < 0 || x >= w) continue
        if (dx * dx + dy * dy > coreR * coreR) continue
        core.push((y * w + x) * 4)
      }
    }
  }
  const model = fitColorModel(source, core.length ? core : [ (Math.round(stroke[0].y) * w + Math.round(stroke[0].x)) * 4 ])
  const tol = tolerance * 0.9 + model.spread

  // 3. Region grow (BFS with a growth-distance cap).
  const dist = new Int32Array(w * h).fill(-1)
  let head = 0
  for (const idx of queue) dist[idx] = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const d = dist[idx]
    if (d >= maxGrow) continue
    const x = idx % w
    const y = (idx - x) / w
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const nIdx = ny * w + nx
      if (mask[nIdx]) continue
      const pix = nIdx * 4
      const cd = colorDistance(source.data, pix, model.r, model.g, model.b)
      if (cd > tol) continue
      if (grad[nIdx] > 0.25 + edgeStop * 0.55) continue
      mask[nIdx] = 255
      dist[nIdx] = d + 1
      queue.push(nIdx)
    }
  }
  const grownPixels = queue.length - seedCount

  let bitmap: MaskBitmap = { width: w, height: h, data: mask }

  // 4. Edge snap — pull the boundary toward the strongest local gradient.
  if (snap > 0 && tolerance > 0) {
    bitmap = snapToEdges(bitmap, grad, snap)
  }

  // 5. Feather.
  if (feather > 0) bitmap = featherMask(bitmap, feather)

  let n = 0
  for (let i = 0; i < bitmap.data.length; i++) if (bitmap.data[i] >= 128) n++
  return { mask: bitmap, coverage: n / (w * h), grownPixels }
}

/**
 * Boundary refinement: for pixels just inside the mask, look outward along
 * the 8 directions for a stronger gradient within `search` px; if found,
 * the intermediate pixels keep/lose membership based on a majority vote.
 * This is the "snap" that pulls a sloppy stroke onto the crisp object edge.
 */
function snapToEdges(mask: MaskBitmap, grad: Float32Array, search: number): MaskBitmap {
  const { width: w, height: h, data } = mask
  const out = new Uint8Array(data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (data[idx] < 128) continue
      // Only boundary pixels (has an empty 4-neighbour) are moved.
      const isBoundary =
        (x > 0 && data[idx - 1] < 128) ||
        (x < w - 1 && data[idx + 1] < 128) ||
        (y > 0 && data[idx - w] < 128) ||
        (y < h - 1 && data[idx + w] < 128)
      if (!isBoundary) continue
      let bestMag = grad[idx]
      let bestOff: Pt | null = null
      for (let dy = -search; dy <= search; dy++) {
        for (let dx = -search; dx <= search; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const nIdx = ny * w + nx
          if (data[nIdx] >= 128) continue
          if (grad[nIdx] > bestMag + 0.05) {
            bestMag = grad[nIdx]
            bestOff = { x: dx, y: dy }
          }
        }
      }
      if (bestOff) {
        // Carve/fill the straight line to the edge pixel.
        const steps = Math.max(Math.abs(bestOff.x), Math.abs(bestOff.y))
        for (let s = 1; s <= steps; s++) {
          const nx = Math.round(x + (bestOff.x * s) / steps)
          const ny = Math.round(y + (bestOff.y * s) / steps)
          out[ny * w + nx] = 255
        }
      }
    }
  }
  return { width: w, height: h, data: out }
}

// ---------------------------------------------------------------------------
// Magic Wand (real colour-region selection)
// ---------------------------------------------------------------------------

export interface MagicWandOptions {
  source: ImageData
  /** Seed point in working-resolution pixels. */
  seed: Pt
  /** 0..100 colour tolerance. Default 22. */
  tolerance?: number
  /** Flood only the connected region (default) or select every matching pixel. */
  contiguous?: boolean
  /** Hard radius cap around the seed in px (0 = uncapped). Default 0. */
  maxRadius?: number
  /** Feather radius in working px. Default 1. */
  feather?: number
}

/**
 * Colour-range wand. Flood-fills from the clicked pixel using the weighted
 * RGB distance against the seed colour, or globally selects every pixel
 * within tolerance when contiguous=false. Small islands are dropped so the
 * selection stays usable.
 */
export function magicWandMask(opts: MagicWandOptions): AutoBrushResult {
  const { source, seed, tolerance = 22, contiguous = true, maxRadius = 0, feather = 1 } = opts
  const { width: w, height: h } = source
  const sx = Math.min(w - 1, Math.max(0, Math.round(seed.x)))
  const sy = Math.min(h - 1, Math.max(0, Math.round(seed.y)))
  const seedIdx = (sy * w + sx) * 4
  const sr = source.data[seedIdx]
  const sg = source.data[seedIdx + 1]
  const sb = source.data[seedIdx + 2]
  const tol = tolerance * 0.95
  const mask = new Uint8Array(w * h)

  if (contiguous) {
    const queue: number[] = [sy * w + sx]
    mask[sy * w + sx] = 255
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
        if (mask[nIdx]) continue
        if (maxRadius > 0) {
          const ddx = nx - sx
          const ddy = ny - sy
          if (ddx * ddx + ddy * ddy > maxRadius * maxRadius) continue
        }
        if (colorDistance(source.data, nIdx * 4, sr, sg, sb) > tol) continue
        mask[nIdx] = 255
        queue.push(nIdx)
      }
    }
  } else {
    for (let i = 0; i < w * h; i++) {
      if (colorDistance(source.data, i * 4, sr, sg, sb) <= tol) mask[i] = 255
    }
  }

  // Drop islands smaller than 0.05% of the selection.
  let total = 0
  for (let i = 0; i < mask.length; i++) if (mask[i]) total++
  if (total > 400) {
    const minIsland = Math.max(8, Math.floor(total * 0.0005))
    const visited = new Uint8Array(w * h)
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || visited[i]) continue
      const comp: number[] = []
      const queue = [i]
      visited[i] = 1
      let head = 0
      while (head < queue.length) {
        const idx = queue[head++]
        comp.push(idx)
        const x = idx % w
        const y = (idx - x) / w
        for (let k = 0; k < 4; k++) {
          const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
          const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const nIdx = ny * w + nx
          if (mask[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1
            queue.push(nIdx)
          }
        }
      }
      if (comp.length < minIsland) for (const idx of comp) mask[idx] = 0
    }
  }

  let bitmap: MaskBitmap = { width: w, height: h, data: mask }
  if (feather > 0) bitmap = featherMask(bitmap, feather)
  let n = 0
  for (let i = 0; i < bitmap.data.length; i++) if (bitmap.data[i] >= 128) n++
  return { mask: bitmap, coverage: n / (w * h), grownPixels: 0 }
}

// ---------------------------------------------------------------------------
// Mask algebra (used by brush-refine add/remove on a RotoMask)
// ---------------------------------------------------------------------------

export function combineMasks(
  base: MaskBitmap,
  patch: MaskBitmap,
  mode: 'add' | 'subtract',
): MaskBitmap {
  const out = new Uint8Array(base.data.length)
  for (let i = 0; i < base.data.length; i++) {
    const b = base.data[i]
    // Patch may be at a different working resolution — caller ensures match
    // by always refining at the RotoMask's working grid.
    const p = patch.data[i] ?? 0
    out[i] = mode === 'add' ? Math.max(b, p) : Math.min(b, 255 - p)
  }
  return { width: base.width, height: base.height, data: out }
}
