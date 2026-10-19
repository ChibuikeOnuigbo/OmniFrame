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
    (effect.pixelate && effect.pixelate > 0),
  )
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
  const vibrance = typeof effect.vibrance === 'number' ? effect.vibrance : 1
  const solarize = Math.min(1, Math.max(0, effect.solarize || 0))
  const posterize = Math.min(1, Math.max(0, effect.posterize || 0))
  const grain = Math.min(1, Math.max(0, effect.grain || 0))
  if (vibrance === 1 && !solarize && !posterize && !grain) return
  let image: ImageData
  try { image = ctx.getImageData(0, 0, canvas.width, canvas.height) } catch { return }
  const d = image.data
  const levels = posterize > 0 ? Math.max(2, Math.round(16 - posterize * 14)) : 0
  const vibAmt = vibrance - 1
  // deterministic per-frame grain (mulberry-ish hash of seed + index)
  let rngState = (seed * 2654435761) >>> 0 || 1
  const rand = () => {
    rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5
    return ((rngState >>> 0) / 4294967295) * 2 - 1
  }
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2]
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
