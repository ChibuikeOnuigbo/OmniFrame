/**
 * Selection mattes for omniframe mode. Pure pixel maths, no imports, so the
 * headless MCP layer, the booted app (store actions) and window.omniMCP all
 * evaluate identical mattes.
 *
 *  - transparentMatte: transparent-selection — draw a rect BIGGER than the
 *    element; pixels near the ignore colour (e.g. white bg) are skipped and
 *    only the target (e.g. the black box) is selected.
 *  - brushMatte: painted strokes unioned into a matte.
 *  - mainElementMatte: 'mind main element' — flood from the rect border so the
 *    background dies and the salient element inside survives.
 */
export interface MatteRect { x0: number; y0: number; x1: number; y1: number }
export interface MatteResult {
  alpha: Uint8ClampedArray // full-canvas alpha, 0 outside rect
  pixels: number
  bbox: MatteRect | null // tight bbox of selected pixels
}

const lum = (p: Uint8ClampedArray, i: number) => 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]

function finish(alpha: Uint8ClampedArray, w: number, h: number): MatteResult {
  let pixels = 0
  let bbox: MatteRect | null = null
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 8) {
        pixels++
        if (!bbox) bbox = { x0: x, y0: y, x1: x, y1: y }
        else {
          bbox.x0 = Math.min(bbox.x0, x); bbox.y0 = Math.min(bbox.y0, y)
          bbox.x1 = Math.max(bbox.x1, x); bbox.y1 = Math.max(bbox.y1, y)
        }
      }
    }
  }
  return { alpha, pixels, bbox }
}

/** Transparent selection: ignore `ignore` colour, keep `target` inside rect. */
export function transparentMatte(
  px: Uint8ClampedArray, w: number, h: number, rect: MatteRect,
  opts: { ignore?: [number, number, number]; ignoreTol?: number; target?: 'dark' | 'light' | [number, number, number]; targetTol?: number } = {},
): MatteResult {
  const ignore = opts.ignore ?? [255, 255, 255]
  const ignoreTol = opts.ignoreTol ?? 40
  const target = opts.target ?? 'dark'
  const targetTol = opts.targetTol ?? 90
  const alpha = new Uint8ClampedArray(w * h)
  const x0 = Math.max(0, Math.floor(rect.x0)), x1 = Math.min(w - 1, Math.ceil(rect.x1))
  const y0 = Math.max(0, Math.floor(rect.y0)), y1 = Math.min(h - 1, Math.ceil(rect.y1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4
      const dr = px[i] - ignore[0], dg = px[i + 1] - ignore[1], db = px[i + 2] - ignore[2]
      if (Math.sqrt(dr * dr + dg * dg + db * db) <= ignoreTol) continue // ignored bg
      let hit = false
      if (target === 'dark') hit = lum(px, i) < 128
      else if (target === 'light') hit = lum(px, i) >= 128
      else {
        const tr = px[i] - target[0], tg = px[i + 1] - target[1], tb = px[i + 2] - target[2]
        hit = Math.sqrt(tr * tr + tg * tg + tb * tb) <= targetTol
      }
      if (hit && px[i + 3] > 8) alpha[y * w + x] = 255
    }
  }
  return finish(alpha, w, h)
}

/** Brush selection: union of stroke discs. */
export function brushMatte(
  w: number, h: number, strokes: { points: [number, number][]; radius?: number }[],
): MatteResult {
  const alpha = new Uint8ClampedArray(w * h)
  for (const st of strokes) {
    const r = st.radius ?? 8
    const pts = st.points
    const disc = (cx: number, cy: number) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) alpha[y * w + x] = 255
        }
      }
    }
    pts.forEach((p, i) => {
      disc(p[0], p[1])
      if (i) { // bridge consecutive points so fast strokes stay connected
        const [ax, ay] = pts[i - 1]; const [bx, by] = p
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2))
        for (let s = 1; s < steps; s++) disc(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps)
      }
    })
  }
  return finish(alpha, w, h)
}

/** Mind-main-element: flood background from the rect border, keep the rest. */
export function mainElementMatte(
  px: Uint8ClampedArray, w: number, h: number, rect: MatteRect, tol = 48,
): MatteResult {
  const alpha = new Uint8ClampedArray(w * h)
  const x0 = Math.max(0, Math.floor(rect.x0)), x1 = Math.min(w - 1, Math.ceil(rect.x1))
  const y0 = Math.max(0, Math.floor(rect.y0)), y1 = Math.min(h - 1, Math.ceil(rect.y1))
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1
  const bg = new Uint8Array(bw * bh) // 1 = background reached from border
  const stack: number[] = []
  const seed = (x: number, y: number) => { const idx = (y - y0) * bw + (x - x0); if (!bg[idx]) { bg[idx] = 1; stack.push(idx) } }
  for (let x = x0; x <= x1; x++) { seed(x, y0); seed(x, y1) }
  for (let y = y0; y <= y1; y++) { seed(x0, y); seed(x1, y) }
  const near = (idx: number, jdx: number) => {
    const i = (y0 + Math.floor(idx / bw)) * w * 4 + (x0 + (idx % bw)) * 4
    const j = (y0 + Math.floor(jdx / bw)) * w * 4 + (x0 + (jdx % bw)) * 4
    const dr = px[i] - px[j], dg = px[i + 1] - px[j + 1], db = px[i + 2] - px[j + 2]
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tol
  }
  while (stack.length) {
    const idx = stack.pop()!
    const cx = idx % bw, cy = Math.floor(idx / bw)
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
      const jdx = ny * bw + nx
      if (!bg[jdx] && near(idx, jdx)) { bg[jdx] = 1; stack.push(jdx) }
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!bg[(y - y0) * bw + (x - x0)] && px[(y * w + x) * 4 + 3] > 8) alpha[y * w + x] = 255
    }
  }
  return finish(alpha, w, h)
}
