/**
 * Per-pixel grade pass (Nova-style effects CSS filters cannot express):
 * Vibrance (smart saturation that protects already-saturated pixels),
 * Solarize, Posterize, Grain (animated, frame-seeded), Pixelate/Mosaic.
 * Runs on the composited canvas wherever LUT stacks run.
 */
import type { ClipEffect } from '../types'


/* ---- Alight-Motion-named pixel family (guide.alightmotion.com/effects) ---- */
const amHex = (v: string | undefined, d: [number, number, number]): [number, number, number] =>
  v && v[0] === '#' ? [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)] : d
const amRnd = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function amBlurStack(ctx: CanvasRenderingContext2D, w: number, h: number, passes: { dx: number; dy: number; sc?: number; al: number }[]) {
  const src = document.createElement('canvas')
  src.width = w; src.height = h
  src.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
  ctx.clearRect(0, 0, w, h)
  for (const p of passes) {
    ctx.save()
    ctx.globalAlpha = p.al
    const sc = p.sc ?? 1
    ctx.translate(w / 2 + p.dx, h / 2 + p.dy)
    ctx.scale(sc, sc)
    ctx.drawImage(src, -w / 2, -h / 2)
    ctx.restore()
  }
}

function applyAmFamily(ctx: CanvasRenderingContext2D, e: ClipEffect, w: number, h: number, seed: number): void {
  if (e.zoomBlur && e.zoomBlur > 0) {
    const n = 6
    const passes: { dx: number; dy: number; sc?: number; al: number }[] = []
    for (let i = 0; i < n; i++) passes.push({ dx: 0, dy: 0, sc: 1 + (i / n) * 0.12 * e.zoomBlur, al: 1 / n })
    amBlurStack(ctx, w, h, passes)
  }
  if (e.directionalBlur && e.directionalBlur > 0) {
    const a = ((e.directionalBlurAngle ?? 0) * Math.PI) / 180
    const len = e.directionalBlur * 24
    const n = 7
    const passes: { dx: number; dy: number; al: number }[] = []
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * len
      passes.push({ dx: Math.cos(a) * t, dy: Math.sin(a) * t, al: 1 / n })
    }
    amBlurStack(ctx, w, h, passes)
  }
  if (e.glow && e.glow > 0) {
    const bright = document.createElement('canvas')
    bright.width = w; bright.height = h
    const bx = bright.getContext('2d')!
    const dd = bx.createImageData(w, h)
    const s2 = document.createElement('canvas')
    s2.width = w; s2.height = h
    s2.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    const sd = s2.getContext('2d')!.getImageData(0, 0, w, h).data
    for (let i = 0; i < dd.data.length; i += 4) {
      const lum = 0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2]
      const k = lum < 140 ? 0 : Math.min(1, ((lum - 140) / 115) * e.glow)
      dd.data[i] = sd[i]; dd.data[i + 1] = sd[i + 1]; dd.data[i + 2] = sd[i + 2]
      dd.data[i + 3] = Math.min(sd[i + 3], k * 255)
    }
    bx.putImageData(dd, 0, 0)
    ctx.save()
    ctx.filter = `blur(${Math.max(2, 6 * e.glow)}px)`
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(bright, 0, 0)
    ctx.restore()
    ctx.filter = 'none'
  }
  if (e.edgeGlow && e.edgeGlow > 0) {
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    const sx = src.getContext('2d')!
    sx.drawImage(ctx.canvas, 0, 0)
    const d = sx.getImageData(0, 0, w, h)
    const edge = sx.createImageData(w, h)
    const [cr, cg, cb] = amHex(e.edgeGlowColor, [255, 220, 120])
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4
        const al = d.data[i + 3]
        const diff = Math.abs(al - d.data[i - 4]) + Math.abs(al - d.data[i + 4]) + Math.abs(al - d.data[i - w * 4]) + Math.abs(al - d.data[i + w * 4])
        if (diff > 40) {
          edge.data[i] = cr; edge.data[i + 1] = cg; edge.data[i + 2] = cb
          edge.data[i + 3] = Math.min(255, diff * e.edgeGlow)
        }
      }
    }
    const ec = document.createElement('canvas')
    ec.width = w; ec.height = h
    ec.getContext('2d')!.putImageData(edge, 0, 0)
    ctx.save()
    ctx.filter = `blur(${Math.max(1, 3 * e.edgeGlow)}px)`
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(ec, 0, 0)
    ctx.restore()
    ctx.filter = 'none'
  }
  if (e.tiltShift && e.tiltShift > 0) {
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    ctx.save()
    ctx.filter = `blur(${Math.max(2, 8 * e.tiltShift)}px)`
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(src, 0, 0)
    ctx.restore()
    ctx.filter = 'none'
    const band = h * 0.34
    const grad = ctx.createLinearGradient(0, h / 2 - band, 0, h / 2 + band)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.25, 'rgba(0,0,0,1)')
    grad.addColorStop(0.75, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    const mask = document.createElement('canvas')
    mask.width = w; mask.height = h
    const mx = mask.getContext('2d')!
    mx.fillStyle = grad
    mx.fillRect(0, 0, w, h)
    mx.globalCompositeOperation = 'source-in'
    mx.drawImage(src, 0, 0)
    ctx.drawImage(mask, 0, 0)
  }
  if (e.vignette && e.vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, 0.85 * e.vignette)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  if (e.flicker && e.flicker > 0) {
    const j = (amRnd(seed) - 0.5) * 0.5 * e.flicker
    ctx.save()
    ctx.globalCompositeOperation = j >= 0 ? 'screen' : 'multiply'
    ctx.fillStyle = `rgba(${j >= 0 ? '255,255,255' : '0,0,0'},${Math.abs(j)})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
  if (e.tiles && e.tiles >= 2) {
    const n = Math.min(6, Math.floor(e.tiles))
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const cw = w / n, ch = h / n
    for (let ty = 0; ty < n; ty++) {
      for (let tx = 0; tx < n; tx++) {
        ctx.save()
        ctx.translate(tx * cw + cw / 2, ty * ch + ch / 2)
        ctx.scale(tx % 2 ? -1 : 1, ty % 2 ? -1 : 1)
        ctx.drawImage(src, 0, 0, w, h, -cw / 2, -ch / 2, cw, ch)
        ctx.restore()
      }
    }
  }
  if (e.pinchBulge && Math.abs(e.pinchBulge) > 0.01) {
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
    const out = ctx.createImageData(w, h)
    const k = e.pinchBulge
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2)
        const r = Math.sqrt(nx * nx + ny * ny) || 1e-6
        const f = Math.pow(r, k > 0 ? 1 - k * 0.9 : 1 + Math.abs(k) * 1.4) / r
        const sxp = Math.round(w / 2 + nx * f * (w / 2))
        const syp = Math.round(h / 2 + ny * f * (h / 2))
        const si = (Math.min(h - 1, Math.max(0, syp)) * w + Math.min(w - 1, Math.max(0, sxp))) * 4
        const i = (y * w + x) * 4
        out.data[i] = sd[si]; out.data[i + 1] = sd[si + 1]; out.data[i + 2] = sd[si + 2]; out.data[i + 3] = sd[si + 3]
      }
    }
    ctx.putImageData(out, 0, 0)
  }
  if (e.swirl && Math.abs(e.swirl) > 1) {
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
    const out = ctx.createImageData(w, h)
    const maxA = (e.swirl * Math.PI) / 180
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2)
        const r = Math.min(1, Math.sqrt(nx * nx + ny * ny))
        const a = maxA * (1 - r)
        const ca = Math.cos(a), sa = Math.sin(a)
        const sxp = Math.round(w / 2 + (nx * ca - ny * sa) * (w / 2))
        const syp = Math.round(h / 2 + (nx * sa + ny * ca) * (h / 2))
        const si = (Math.min(h - 1, Math.max(0, syp)) * w + Math.min(w - 1, Math.max(0, sxp))) * 4
        const i = (y * w + x) * 4
        out.data[i] = sd[si]; out.data[i + 1] = sd[si + 1]; out.data[i + 2] = sd[si + 2]; out.data[i + 3] = sd[si + 3]
      }
    }
    ctx.putImageData(out, 0, 0)
  }
  if (e.gradientMap && e.gradientMap > 0) {
    const [fr, fg, fb] = amHex(e.gradientMapFrom, [10, 10, 40])
    const [tr, tg, tb] = amHex(e.gradientMapTo, [255, 190, 90])
    const d = ctx.getImageData(0, 0, w, h)
    const mix = e.gradientMap
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255
      d.data[i] = d.data[i] * (1 - mix) + (fr + (tr - fr) * lum) * mix
      d.data[i + 1] = d.data[i + 1] * (1 - mix) + (fg + (tg - fg) * lum) * mix
      d.data[i + 2] = d.data[i + 2] * (1 - mix) + (fb + (tb - fb) * lum) * mix
    }
    ctx.putImageData(d, 0, 0)
  }
  if (e.threshold && e.threshold > 0) {
    const d = ctx.getImageData(0, 0, w, h)
    const cut = e.threshold * 255
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]
      const v = lum >= cut ? 255 : 0
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v
    }
    ctx.putImageData(d, 0, 0)
  }
  if (e.sharpen && e.sharpen > 0) {
    const d = ctx.getImageData(0, 0, w, h)
    const src = new Uint8ClampedArray(d.data)
    const k = e.sharpen
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) {
          const lap = 4 * src[i + c] - src[i - 4 + c] - src[i + 4 + c] - src[i - w * 4 + c] - src[i + w * 4 + c]
          d.data[i + c] = Math.max(0, Math.min(255, src[i + c] + k * lap))
        }
      }
    }
    ctx.putImageData(d, 0, 0)
  }
  if (e.findEdges && e.findEdges > 0) {
    const d = ctx.getImageData(0, 0, w, h)
    const src = new Uint8ClampedArray(d.data)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) {
          const gx = src[i + 4 + c] - src[i - 4 + c]
          const gy = src[i + w * 4 + c] - src[i - w * 4 + c]
          d.data[i + c] = Math.min(255, Math.sqrt(gx * gx + gy * gy) * e.findEdges)
        }
      }
    }
    ctx.putImageData(d, 0, 0)
  }
  if (e.flicker === 0 && e.grain && e.grain > 0) void 0
}

export function hasPixelGrade(effect?: ClipEffect): boolean {
  if (!effect) return false
  return Boolean(
    (effect.vibrance && effect.vibrance !== 1) ||
    (effect.solarize && effect.solarize > 0) ||
    (effect.posterize && effect.posterize > 0) ||
    (effect.grain && effect.grain > 0) ||
    (effect.pixelate && effect.pixelate > 0) ||
    (effect.chromatic && effect.chromatic > 0) ||
    (effect.pixelStretch && effect.pixelStretch > 0) ||
    (effect.waveWarp && effect.waveWarp > 0) ||
    (effect.chromaKey && effect.chromaKey > 0) ||
    (effect.fractalBlur && effect.fractalBlur > 0) ||
    (effect.lumaKey && effect.lumaKey > 0) ||
    (effect.zoomBlur && effect.zoomBlur > 0) ||
    (effect.directionalBlur && effect.directionalBlur > 0) ||
    (effect.glow && effect.glow > 0) ||
    (effect.edgeGlow && effect.edgeGlow > 0) ||
    (effect.tiltShift && effect.tiltShift > 0) ||
    (effect.vignette && effect.vignette > 0) ||
    (effect.flicker && effect.flicker > 0) ||
    (effect.tiles && effect.tiles >= 2) ||
    (effect.pinchBulge && Math.abs(effect.pinchBulge) > 0.01) ||
    (effect.swirl && Math.abs(effect.swirl) > 1) ||
    (effect.gradientMap && effect.gradientMap > 0) ||
    (effect.threshold && effect.threshold > 0) ||
    (effect.sharpen && effect.sharpen > 0) ||
    (effect.findEdges && effect.findEdges > 0),
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(v || '00ff00', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function applyPixelGrade(canvas: HTMLCanvasElement, effect: ClipEffect, seed = 0): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.width || !canvas.height) return
  const pixelate = Math.min(24, Math.max(0, Math.floor(effect.pixelate || 0)))
  if (pixelate > 1) {
    const sw = Math.max(1, Math.floor(canvas.width / pixelate))
    const sh = Math.max(1, Math.floor(canvas.height / pixelate))
    const small = document.createElement('canvas')
    small.width = sw; small.height = sh
    const sctx = small.getContext('2d')!
    sctx.drawImage(canvas, 0, 0, sw, sh)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
  // Wave Warp: horizontal sine displacement in 4px bands (hair/cloth life).
  const warp = Math.min(24, Math.max(0, effect.waveWarp || 0))
  if (warp > 0) {
    const snap = document.createElement('canvas')
    snap.width = canvas.width; snap.height = canvas.height
    snap.getContext('2d')!.drawImage(canvas, 0, 0)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
    for (let y = 0; y < canvas.height; y += 4) {
      const dx = Math.sin(y * 0.045 + seed * 0.9) * warp
      ctx.drawImage(snap, 0, y, canvas.width, 4, dx, y, canvas.width, 4)
    }
    ctx.restore()
  }
  // Pixel Stretch: smear the centre column band outward (CapCut L3 look).
  const stretchPct = Math.min(60, Math.max(0, effect.pixelStretch || 0))
  if (stretchPct > 0) {
    const zone = (stretchPct / 100) * canvas.width
    const cx0 = canvas.width / 2
    const snap = document.createElement('canvas')
    snap.width = canvas.width; snap.height = canvas.height
    snap.getContext('2d')!.drawImage(canvas, 0, 0)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
    ctx.imageSmoothingEnabled = true
    // 2px centre slice stretched across the zone
    ctx.drawImage(snap, cx0 - 1, 0, 2, canvas.height, cx0 - zone / 2, 0, zone, canvas.height)
    ctx.restore()
  }

  const vibrance = typeof effect.vibrance === 'number' ? effect.vibrance : 1
  const solarize = Math.min(1, Math.max(0, effect.solarize || 0))
  const posterize = Math.min(1, Math.max(0, effect.posterize || 0))
  const grain = Math.min(1, Math.max(0, effect.grain || 0))
  const chromatic = Math.min(24, Math.max(0, Math.round(effect.chromatic || 0)))
  const chromaKey = Math.min(1, Math.max(0, effect.chromaKey || 0))
  const lumaKey = Math.min(1, Math.max(0, effect.lumaKey || 0))
  const fractalBlur = Math.min(24, Math.max(0, effect.fractalBlur || 0))
  const cardFlip = Math.min(2, Math.max(0, effect.cardFlip || 0))
  if (fractalBlur > 0) {
    const snap = document.createElement('canvas')
    snap.width = canvas.width; snap.height = canvas.height
    snap.getContext('2d')!.drawImage(canvas, 0, 0)
    const cx = canvas.getContext('2d')!
    cx.clearRect(0, 0, canvas.width, canvas.height)
    let r = fractalBlur
    for (let o = 0; o < 3; o++) {
      cx.save(); cx.filter = `blur(${Math.max(0.5, r).toFixed(1)}px)`; cx.globalAlpha = o === 0 ? 1 : 0.55
      cx.drawImage(snap, 0, 0); cx.restore(); r /= 2
    }
    cx.filter = 'none'
  }
  if (cardFlip > 0) {
    const sq = Math.max(0.04, Math.abs(Math.cos(Math.PI * cardFlip)))
    const snap = document.createElement('canvas')
    snap.width = canvas.width; snap.height = canvas.height
    snap.getContext('2d')!.drawImage(canvas, 0, 0)
    const cx = canvas.getContext('2d')!
    cx.clearRect(0, 0, canvas.width, canvas.height)
    cx.save(); cx.translate(canvas.width / 2, 0); cx.scale(sq, 1); cx.translate(-canvas.width / 2, 0)
    cx.drawImage(snap, 0, 0); cx.restore()
    cx.fillStyle = `rgba(0,0,0,${0.5 * (1 - sq)})`; cx.fillRect(0, 0, canvas.width, canvas.height)
  }
  if (!hasPixelGrade(effect)) return
  let image: ImageData
  try { image = ctx.getImageData(0, 0, canvas.width, canvas.height) } catch { return }
  const d = image.data
  const src = (chromatic || chromaKey || lumaKey) ? new Uint8ClampedArray(d) : d
  const W = canvas.width
  const [kr, kg, kb] = chromaKey ? hexToRgb(effect.chromaColor || '#00ff00') : [0, 255, 0]
  const levels = posterize > 0 ? Math.max(2, Math.round(16 - posterize * 14)) : 0
  const vibAmt = vibrance - 1
  // deterministic per-frame grain (mulberry-ish hash of seed + index)
  let rngState = (seed * 2654435761) >>> 0 || 1
  const rand = () => {
    rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5
    return ((rngState >>> 0) / 4294967295) * 2 - 1
  }
  for (let i = 0; i < d.length; i += 4) {
    let r = src[i], g = src[i + 1], b = src[i + 2]
    if (chromatic) {
      const px = (i / 4) % W
      const left = px >= chromatic ? i - chromatic * 4 : i
      const right = px + chromatic < W ? i + chromatic * 4 : i
      r = src[left]
      b = src[right + 2]
    }
    if (chromaKey) {
      const dist = Math.sqrt((r - kr) * (r - kr) + (g - kg) * (g - kg) + (b - kb) * (b - kb)) / 441
      const alphaK = Math.min(1, Math.max(0, (dist - (1 - chromaKey) * 0.45) / 0.18))
      d[i + 3] = Math.round(d[i + 3] * alphaK)
      // spill suppression: pull green toward the other channels on edges
      if (alphaK < 1 && g > Math.max(r, b)) g = Math.max(r, b) + (g - Math.max(r, b)) * alphaK
    }
    if (lumaKey) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const band = 30 * (1 - lumaKey)
      const la = lum < 26 ? 0 : lum > 26 + band ? 255 : ((lum - 26) / band) * 255
      d[i + 3] = Math.min(d[i + 3], Math.max(0, la))
    }
    if (vibAmt !== 0) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const sat = mx === 0 ? 0 : (mx - mn) / mx
      const boost = 1 + vibAmt * (1 - sat)
      const avg = (r + g + b) / 3
      r = avg + (r - avg) * boost; g = avg + (g - avg) * boost; b = avg + (b - avg) * boost
    }
    if (solarize > 0) {
      // classic solarize: invert everything above the midpoint, blended
      const t = 128
      r = r >= t ? (255 - r) * solarize + r * (1 - solarize) : r
      g = g >= t ? (255 - g) * solarize + g * (1 - solarize) : g
      b = b >= t ? (255 - b) * solarize + b * (1 - solarize) : b
    }
    if (levels) {
      const step = 255 / (levels - 1)
      r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step
    }
    if (grain > 0) {
      const n = rand() * grain * 38
      r += n; g += n; b += n
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
  }
  ctx.putImageData(image, 0, 0)
  applyAmFamily(ctx, effect, canvas.width, canvas.height, seed)

}
