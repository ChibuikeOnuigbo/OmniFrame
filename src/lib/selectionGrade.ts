import type { ClipEffect } from '../types'

const finite = (value: number | undefined, fallback: number, low = 0, high = 1): number =>
  Math.min(high, Math.max(low, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
const smooth = (low: number, high: number, value: number): number => {
  if (high <= low) return value >= high ? 1 : 0
  const t = finite((value - low) / (high - low), 0)
  return t * t * (3 - 2 * t)
}

export function hasSelectionGrade(effect: ClipEffect): boolean {
  return !!(effect.colorHold || effect.lumaRange || effect.despill || effect.channelMixer)
}

/** Original RGB/alpha math shared by browser preview, export and headless rendering. */
export function applySelectionGrade(image: { data: Uint8ClampedArray }, effect: ClipEffect): void {
  const hold = finite(effect.colorHold, 0)
  const key = typeof effect.holdColor === 'string' && /^#[0-9a-f]{6}$/i.test(effect.holdColor) ? effect.holdColor : '#ff0000'
  const rgb = Number.parseInt(key.slice(1), 16)
  const kr = (rgb >> 16) & 255, kg = (rgb >> 8) & 255, kb = rgb & 255
  const similarity = finite(effect.holdSimilarity, .12), softness = finite(effect.holdSoftness, .15)
  const rgbDistanceScale = 1 / Math.sqrt(3 * 255 * 255)
  const luma = finite(effect.lumaRange, 0), feather = finite(effect.lumaFeather, .05)
  const a = finite(effect.lumaLow, .15), b = finite(effect.lumaHigh, .85)
  const low = Math.min(a, b), high = Math.max(a, b), invert = finite(effect.lumaInvert, 0)
  const spill = finite(effect.despill, 0), balance = finite(effect.despillBalance, .5), preserve = finite(effect.despillLuma, .5)
  const blue = effect.despillChannel === 'blue'
  const mixer = finite(effect.channelMixer, 0)
  const rr = finite(effect.mixRR, 1, -2, 2), rg = finite(effect.mixRG, 0, -2, 2), rb = finite(effect.mixRB, 0, -2, 2)
  const gr = finite(effect.mixGR, 0, -2, 2), gg = finite(effect.mixGG, 1, -2, 2), gb = finite(effect.mixGB, 0, -2, 2)
  const br = finite(effect.mixBR, 0, -2, 2), bg = finite(effect.mixBG, 0, -2, 2), bb = finite(effect.mixBB, 1, -2, 2)
  if (!hold && !luma && !spill && !mixer) return
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const originalAlpha = data[i + 3]
    if (!originalAlpha) continue
    let r = data[i], g = data[i + 1], blueValue = data[i + 2]
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * blueValue) / 255
    if (hold) {
      const distance = Math.hypot(r - kr, g - kg, blueValue - kb) * rgbDistanceScale
      const grayMix = distance <= similarity ? 0 : hold * smooth(similarity, similarity + softness, distance)
      const gray = luminance * 255
      r += (gray - r) * grayMix; g += (gray - g) * grayMix; blueValue += (gray - blueValue) * grayMix
    }
    if (luma) {
      // Full [0,1] is identity even with feather; inversion never revives transparent pixels.
      const below = low === 0 ? 1 : smooth(low - feather, low + feather, luminance)
      const above = high === 1 ? 1 : 1 - smooth(high - feather, high + feather, luminance)
      const selected = below * above
      const matte = selected * (1 - invert) + (1 - selected) * invert
      data[i + 3] = originalAlpha * (1 - luma + luma * matte)
    }
    if (spill) {
      const other = blue ? g : blueValue
      const ceiling = (r + other) * .5 * (1 - balance) + Math.max(r, other) * balance
      const removed = Math.max(0, (blue ? blueValue : g) - ceiling) * spill
      if (blue) blueValue -= removed
      else g -= removed
      const compensation = removed * (blue ? .0722 : .7152) * preserve
      r += compensation; g += compensation; blueValue += compensation
    }
    if (mixer) {
      const nextR = rr * r + rg * g + rb * blueValue
      const nextG = gr * r + gg * g + gb * blueValue
      const nextB = br * r + bg * g + bb * blueValue
      r += (nextR - r) * mixer; g += (nextG - g) * mixer; blueValue += (nextB - blueValue) * mixer
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = blueValue
  }
}
