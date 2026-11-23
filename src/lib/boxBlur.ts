/** Separable box kernel with clamped edges and premultiplied alpha. O(width × height). */
export function applyBoxBlur(image: { width: number; height: number; data: Uint8ClampedArray }, radius: number): void {
  if (!Number.isFinite(radius)) return
  const r = Math.max(0, Math.min(64, Math.round(radius)))
  const { width: w, height: h, data } = image
  if (!r || !w || !h) return
  const span = r * 2 + 1
  // Per-call storage avoids cross-render ownership races; no second RGBA copy.
  const horizontal = new Float32Array(data.length)
  for (let y = 0; y < h; y++) {
    let rr = 0, gg = 0, bb = 0, aa = 0
    const add = (x: number, sign: number) => {
      const i = (y * w + Math.max(0, Math.min(w - 1, x))) * 4
      const alpha = data[i + 3] * sign
      rr += data[i] * alpha; gg += data[i + 1] * alpha; bb += data[i + 2] * alpha; aa += alpha
    }
    for (let x = -r; x <= r; x++) add(x, 1)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      horizontal[i] = rr / span; horizontal[i + 1] = gg / span
      horizontal[i + 2] = bb / span; horizontal[i + 3] = aa / span
      add(x - r, -1); add(x + r + 1, 1)
    }
  }
  for (let x = 0; x < w; x++) {
    let rr = 0, gg = 0, bb = 0, aa = 0
    const add = (y: number, sign: number) => {
      const i = (Math.max(0, Math.min(h - 1, y)) * w + x) * 4
      rr += horizontal[i] * sign; gg += horizontal[i + 1] * sign
      bb += horizontal[i + 2] * sign; aa += horizontal[i + 3] * sign
    }
    for (let y = -r; y <= r; y++) add(y, 1)
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4
      data[i] = aa > 0 ? rr / aa : 0; data[i + 1] = aa > 0 ? gg / aa : 0
      data[i + 2] = aa > 0 ? bb / aa : 0; data[i + 3] = aa / span
      add(y - r, -1); add(y + r + 1, 1)
    }
  }
}
