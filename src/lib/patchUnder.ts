/**
 * Patch-under fill for omniframe cut-outs: after the hole mask punches the
 * source clip, this fills the hole for EVERY frame so the cut-out's absence
 * never shows. 'smart' averages the ring around the hole (flat or graduated
 * beds fill seamlessly); 'clone'/'donor' copy a source region.
 * Shared by playback.ts (booted app) and tools/mcp/appRender.mjs (headless).
 */
export interface PatchUnderSpec {
  strategy?: 'smart' | 'clone' | 'donor'
  x0: number; y0: number; x1: number; y1: number // sequence-space hole rect
  feather?: number
  donor?: [number, number]
}

export function applyPatchUnder(
  x: CanvasRenderingContext2D, patch: PatchUnderSpec, r: { x: number; y: number; w: number; h: number }, seqW: number, seqH: number,
  donorCanvas?: HTMLCanvasElement | { width: number; height: number; getContext: (k: '2d') => CanvasRenderingContext2D },
): void {
  const W = x.canvas.width, H = x.canvas.height
  const X0 = ((patch.x0 / seqW) - r.x / seqW) * W, X1 = ((patch.x1 / seqW) - r.x / seqW) * W
  const Y0 = ((patch.y0 / seqH) - r.y / seqH) * H, Y1 = ((patch.y1 / seqH) - r.y / seqH) * H
  const hw = X1 - X0, hh = Y1 - Y0
  const feather = (patch.feather ?? 5) * (W / seqW)
  const strat = patch.strategy || 'clone'
  if (strat === 'smart') {
    const d = x.getImageData(0, 0, W, H).data
    let rr = 0, gg = 0, bb = 0, n = 0
    const ring = (px: number, py: number) => {
      const ix = Math.round(px), iy = Math.round(py)
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return
      const i = (iy * W + ix) * 4
      if (d[i + 3] < 8) return
      rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++
    }
    for (let X = X0 - 4; X <= X1 + 4; X += 2) { ring(X, Y0 - 4); ring(X, Y1 + 4) }
    for (let Y = Y0 - 4; Y <= Y1 + 4; Y += 2) { ring(X0 - 4, Y); ring(X1 + 4, Y) }
    const col = n ? `rgb(${(rr / n) | 0},${(gg / n) | 0},${(bb / n) | 0})` : 'rgb(255,255,255)'
    x.save()
    x.globalCompositeOperation = 'destination-over'
    x.filter = feather > 0 ? `blur(${feather}px)` : 'none'
    x.fillStyle = col
    x.fillRect(X0 - 1, Y0 - 1, hw + 2, hh + 2)
    x.restore()
    x.filter = 'none'
    return
  }
  const src = donorCanvas as HTMLCanvasElement | undefined
  if (src) {
    const dx = patch.donor ? ((patch.donor[0] / seqW) - r.x / seqW) * W : 0
    const dy = patch.donor ? ((patch.donor[1] / seqH) - r.y / seqH) * H : 0
    x.save()
    x.filter = feather > 0 ? `blur(${feather}px)` : 'none'
    x.drawImage(src, dx, dy, hw, hh, X0, Y0, hw, hh)
    x.restore()
    x.filter = 'none'
  }
}
