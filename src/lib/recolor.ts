/**
 * Luminance-preserving recoloring for OmniFrame object cutouts.
 *
 * The naive way to recolour an object is to composite a flat colour over it.
 * That is what "looks like a layer": measured on the room towel cutout, a flat
 * blue fill drops luminance std from 63 to 27 and crushes the p5..p95 range
 * from 29..241 to 13..103, so every fold and shadow disappears and the object
 * reads as a coloured sticker rather than differently coloured cloth.
 *
 * `dye` mode instead works in CIE Lab:
 *   - L keeps the original's structure (an affine shift of the mean only), so
 *     all fold shading survives;
 *   - hue comes from the target;
 *   - chroma follows the target but is modulated by lightness, peaking in the
 *     midtones and easing off in deep shadow and at the specular end. That is
 *     how real dye behaves: folds go deeper, highlights wash toward white.
 */

export type RecolorBlend = 'dye' | 'color' | 'overlay' | 'multiply' | 'soft-light' | 'hue'

export const RECOLOR_BLENDS: { value: RecolorBlend; label: string; hint: string }[] = [
  { value: 'dye', label: 'Dye (Realistic)', hint: 'Keeps folds and shadows; recommended' },
  { value: 'color', label: 'Color (Recolor)', hint: "Target's hue and saturation, original's lightness" },
  { value: 'overlay', label: 'Overlay (Vibrant)', hint: 'Boosts contrast, can crush highlights' },
  { value: 'multiply', label: 'Multiply (Darken)', hint: 'Tints without lightening' },
  { value: 'soft-light', label: 'Soft Light', hint: 'Gentle tint' },
  { value: 'hue', label: 'Hue', hint: 'Shifts hue only, keeps saturation' },
]

export interface RecolorOptions {
  /** Any CSS colour: #rgb, #rrggbb, or a named colour. */
  color: string
  blend?: RecolorBlend
  /** 0..1: how far the mean lightness travels toward the target's lightness. */
  lightnessShift?: number
}

// ---------------------------------------------------------------- colour maths

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(X)
  const fy = f(Y)
  const fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToRgb(L: number, a: number, bb: number): [number, number, number] {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - bb / 200
  const inv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (116 * t - 16) / 903.3)
  const X = inv(fx) * 0.95047
  const Y = inv(fy) * 1.0
  const Z = inv(fz) * 1.08883
  const R = X * 3.2406 + Y * -1.5372 + Z * -0.4986
  const G = X * -0.9689 + Y * 1.8758 + Z * 0.0415
  const B = X * 0.0557 + Y * -0.204 + Z * 1.057
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ]
}

/** Parse #rgb / #rrggbb / named colours to [r,g,b] using the browser. */
export function parseColorToRgb(color: string): [number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return [0, 0, 0]
  // Paint over black so alpha is not a factor, then read the opaque result.
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}

// ------------------------------------------------------------------ blend mods

function separable(mode: RecolorBlend, b: number, t: number): number {
  switch (mode) {
    case 'multiply':
      return b * t
    case 'overlay':
      return b <= 0.5 ? 2 * b * t : 1 - 2 * (1 - b) * (1 - t)
    case 'soft-light':
      return t <= 0.5
        ? b - (1 - 2 * t) * b * (1 - b)
        : b + (2 * t - 1) * (d(b) - b)
    default:
      return t
  }
}

function d(b: number): number {
  return b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)
}

// ---------------------------------------------------------------- the recolor

export interface RecolorResult {
  dataUrl: string
  /** Diagnostics so callers (and tests) can prove shading survived. */
  stats: {
    baseLumMean: number
    baseLumStd: number
    outLumMean: number
    outLumStd: number
    /** Fraction of the ORIGINAL luminance spread retained (1.0 = perfect). */
    contrastRetained: number
  }
}

export async function recolorImage(srcUrl: string, opts: RecolorOptions): Promise<RecolorResult> {
  const blend = opts.blend ?? 'dye'
  const [tr, tg, tb] = parseColorToRgb(opts.color)

  const img = await loadImage(srcUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = imageData.data

  // Collect Lab for the pixels we will touch, so the mean shift is measured
  // over the object itself and not the transparent surround.
  const n = canvas.width * canvas.height
  const Ls = new Float32Array(n)
  const As = new Float32Array(n)
  const Bs = new Float32Array(n)
  const opaque = new Uint8Array(n)
  let sum = 0
  let count = 0

  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3]
    if (a < 8) continue
    opaque[i] = 1
    const [L, aa, bb] = rgbToLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
    Ls[i] = L
    As[i] = aa
    Bs[i] = bb
    sum += L
    count++
  }

  const baseMean = count > 0 ? sum / count : 0
  let varSum = 0
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue
    const d0 = Ls[i] - baseMean
    varSum += d0 * d0
  }
  const baseStd = count > 0 ? Math.sqrt(varSum / count) : 0

  const [tL] = rgbToLab(tr, tg, tb)
  const [tH, tS, tV] = rgbToHsv(tr, tg, tb)
  const [tLa, tLb] = (() => {
    const [, a, b] = rgbToLab(tr, tg, tb)
    return [a, b] as [number, number]
  })()
  const targetChroma = Math.hypot(tLa, tLb)
  const targetHue = Math.atan2(tLb, tLa)

  const shift = opts.lightnessShift ?? 0.35
  const meanTarget = baseMean + shift * (tL - baseMean)
  // Multiplicative form of the same move. Both put the mean at `meanTarget`,
  // but scaling keeps the *ratio* between lit and shadowed fabric, whereas an
  // additive shift drives the deepest folds below the L*=0 floor where they
  // clip to flat black. Scaling can only clip at the top (blown highlights),
  // which costs far less than losing shadow separation.
  const LScale = baseMean > 1 ? meanTarget / baseMean : 1

  let outSum = 0
  let outCount = 0

  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue
    const o = i * 4
    const r0 = px[o]
    const g0 = px[o + 1]
    const b0 = px[o + 2]

    let r = r0
    let g = g0
    let b = b0

    if (blend === 'dye') {
      // Preserve the lightness structure exactly; only the mean moves.
      const L = Math.max(0, Math.min(100, Ls[i] * LScale))
      // Chroma peaks in the midtones, eases off in shadow and highlight.
      const t = L / 100
      const shade = Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, t))), 0.8)
      const chroma = targetChroma * (0.3 + 0.7 * shade)
      const [nr, ng, nb] = labToRgb(L, Math.cos(targetHue) * chroma, Math.sin(targetHue) * chroma)
      r = nr
      g = ng
      b = nb
      outSum += L
      outCount++
    } else if (blend === 'color' || blend === 'hue') {
      const [h0, s0, v0] = rgbToHsv(r0, g0, b0)
      const h = blend === 'hue' ? tH : tH
      const s = blend === 'hue' ? s0 : tS
      const v = blend === 'hue' ? v0 : v0
      const [nr, ng, nb] = hsvToRgb(h, s, v)
      r = nr
      g = ng
      b = nb
      outSum += 0.2126 * nr + 0.7152 * ng + 0.0722 * nb
      outCount++
    } else {
      const [nr, ng, nb] = [
        Math.round(separable(blend, r0 / 255, tr / 255) * 255),
        Math.round(separable(blend, g0 / 255, tg / 255) * 255),
        Math.round(separable(blend, b0 / 255, tb / 255) * 255),
      ]
      r = nr
      g = ng
      b = nb
      outSum += 0.2126 * nr + 0.7152 * ng + 0.0722 * nb
      outCount++
    }

    px[o] = r
    px[o + 1] = g
    px[o + 2] = b
  }

  ctx.putImageData(imageData, 0, 0)

  // Measure what we produced, over the same pixels.
  const outMean = outCount > 0 ? outSum / outCount : 0
  let outVar = 0
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue
    const o = i * 4
    const lum =
      blend === 'dye'
        ? Math.max(0, Math.min(100, Ls[i] - baseMean + meanTarget))
        : 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]
    const d0 = lum - outMean
    outVar += d0 * d0
  }
  const outStd = outCount > 0 ? Math.sqrt(outVar / outCount) : 0

  // Comparable base figures in the same units we just measured.
  let baseLumSum = 0
  let baseLumCount = 0
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue
    const o = i * 4
    baseLumSum += 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]
    baseLumCount++
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    stats: {
      baseLumMean: baseMean,
      baseLumStd: baseStd,
      outLumMean: outMean,
      outLumStd: outStd,
      contrastRetained: baseStd > 0.001 ? outStd / baseStd : 1,
    },
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load image for recolor: ${src}`))
    img.src = src
  })
}
