/**
 * Per-pixel grade pass (Nova-style effects CSS filters cannot express):
 * Vibrance (smart saturation that protects already-saturated pixels),
 * Solarize, Posterize, Grain (animated, frame-seeded), Pixelate/Mosaic.
 * Runs on the composited canvas wherever LUT stacks run.
 */
import type { ClipEffect } from '../types'

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
    (effect.chromaKey && effect.chromaKey > 0),
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
  if (vibrance === 1 && !solarize && !posterize && !grain && !chromatic && !chromaKey && !lumaKey) return
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
}
