import type { ClipEffect } from '../types'

export type GeneratedFxCat = 'glitch' | 'motion' | 'color' | 'blur' | 'distort' | 'burst' | 'retro' | 'light' | 'key' | 'Glitch NG'

export interface GeneratedFxEntry {
  id: string
  name: string
  cat: GeneratedFxCat
  trace: string
  patch: Record<string, number | string>
}

/**
 * Compact, deterministic parameter-space recipes. These are indexed instead
 * of retained as 139k objects: browser search creates only the visible page,
 * while ID lookup reconstructs the exact same editable engine patch.
 */
export const GENERATED_RECIPE_COUNT = 139_425
export const GENERATED_RECIPE_PREFIX = 'ofx-'

const PALETTE = ['#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff2d92', '#f5f5f7', '#111827']
const BOKEH_SHAPES = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'octagon', 'diamond', 'star'] as const
const BURSTS = ['glass', 'crack', 'shatter', 'tiles', 'slice', 'shockwave', 'fireball', 'smoke', 'energy', 'implosion'] as const
const WAVES = ['sine', 'triangle'] as const

const hash = (value: number): number => {
  let x = value | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return (x ^ (x >>> 16)) >>> 0
}
const unit = (value: number, salt: number): number => hash(value * 97 + salt * 104729) / 0xffffffff
const between = (value: number, salt: number, min: number, max: number, digits = 3): number =>
  Number((min + unit(value, salt) * (max - min)).toFixed(digits))
const integer = (value: number, salt: number, min: number, max: number): number =>
  Math.floor(between(value, salt, min, max + 0.999, 4))
const pick = <T,>(items: readonly T[], value: number, salt: number): T => items[hash(value * 131 + salt) % items.length]

interface Family {
  key: string
  label: string
  cat: GeneratedFxCat
  terms: string
  describe: (variant: number) => string
  patch: (variant: number) => ClipEffect
}

const FAMILIES: Family[] = [
  {
    key: 'cinema', label: 'Cinema Grade', cat: 'color', terms: 'cinematic film grade exposure gamma contrast saturation vibrance temperature grain vignette',
    describe: (n) => `${Math.round(between(n, 1, 3200, 9000, 0))}K`,
    patch: (n) => ({ exposure: between(n, 2, -0.8, 0.8), gamma: between(n, 3, 0.72, 1.42), contrast: between(n, 4, 0.78, 1.42), saturation: between(n, 5, 0.52, 1.55), vibrance: between(n, 6, 0.72, 1.6), colorTemp: Math.round(between(n, 1, 3200, 9000, 0)), grain: between(n, 7, 0.02, 0.34), vignette: between(n, 8, 0.02, 0.42) }),
  },
  {
    key: 'gradient', label: 'Gradient Direction', cat: 'color', terms: 'gradient map directional colorize duotone palette angle color',
    describe: (n) => `${Math.round(between(n, 9, -180, 180, 0))}°`,
    patch: (n) => ({ gradientMap: between(n, 10, 0.35, 1), gradientMapFrom: pick(PALETTE, n, 11), gradientMapTo: pick(PALETTE, n, 12), dirColorize: between(n, 13, 0.2, 1), dirColorizeFrom: pick(PALETTE, n, 14), dirColorizeTo: pick(PALETTE, n, 15), dirColorizeAngle: Math.round(between(n, 9, -180, 180, 0)) }),
  },
  {
    key: 'bokeh', label: 'Lens Bokeh', cat: 'blur', terms: 'lens camera bokeh defocus iris aperture circle triangle square pentagon hexagon octagon diamond star highlight blur',
    describe: (n) => `${pick(BOKEH_SHAPES, n, 16)} ${integer(n, 17, 6, 54)}px`,
    patch: (n) => ({ lensBokeh: between(n, 18, 0.3, 1), bokehRadius: integer(n, 17, 6, 54), bokehThreshold: between(n, 19, 0.36, 0.84), bokehGain: between(n, 20, 0.55, 2.65), bokehShape: pick(BOKEH_SHAPES, n, 16), bokehRotation: Math.round(between(n, 21, -180, 180, 0)), bokehSoftness: between(n, 22, 0, 0.72) }),
  },
  {
    key: 'streak', label: 'Directional Streak', cat: 'blur', terms: 'directional horizontal vertical oblique light streak blur motion trail angle spread threshold',
    describe: (n) => `${Math.round(between(n, 23, -180, 180, 0))}°`,
    patch: (n) => ({ directionalBlur: between(n, 24, 0.25, 4.8), directionalBlurAngle: Math.round(between(n, 23, -180, 180, 0)), directionalBlurBias: between(n, 25, -1, 1), directionalBlurSpread: Math.round(between(n, 26, 0, 90, 0)), directionalBlurThreshold: between(n, 27, 0, 0.82), motionBlur: between(n, 28, 0, 0.8) }),
  },
  {
    key: 'flow', label: 'Turbulent Flow', cat: 'distort', terms: 'turbulent displacement fbm curl glass liquify wave warp swirl pinch bulge heat flow',
    describe: (n) => `${pick(['fbm', 'curl', 'glass'] as const, n, 29)} flow`,
    patch: (n) => ({ turbulent: between(n, 30, 0.18, 1), turbulentMode: pick(['fbm', 'curl', 'glass'] as const, n, 29), turbulentScale: integer(n, 31, 12, 220), turbulentSpeed: between(n, 32, 0.08, 5.6), turbulentAngle: Math.round(between(n, 33, -180, 180, 0)), turbulentSeed: hash(n + 34) % 10_000, waveWarp: between(n, 35, 0, 22), swirl: Math.round(between(n, 36, -240, 240, 0)), pinchBulge: between(n, 37, -0.8, 0.8) }),
  },
  {
    key: 'aura', label: 'Aura Light', cat: 'light', terms: 'aura glow bloom edge light neon outline radiance threshold rays',
    describe: (n) => `${integer(n, 38, 6, 58)} rays`,
    patch: (n) => ({ aura: between(n, 39, 0.2, 1), auraThreshold: between(n, 40, 0.18, 0.82), auraRadius: integer(n, 41, 5, 90), auraLines: integer(n, 38, 6, 58), auraSpeed: between(n, 42, -4, 4), auraRotation: Math.round(between(n, 43, -360, 360, 0)), auraColor: pick(PALETTE, n, 44), auraSecondary: pick(PALETTE, n, 45), glow: between(n, 46, 0.06, 0.8), edgeGlow: between(n, 47, 0, 0.7), edgeGlowColor: pick(PALETTE, n, 48) }),
  },
  {
    key: 'retro', label: 'Retro Signal', cat: 'retro', terms: 'retro vhs analog tape scanline chromatic grain noise flicker quantize crt signal',
    describe: (n) => `${integer(n, 49, 4, 28)}fps`,
    patch: (n) => ({ vhs: between(n, 50, 0.12, 1), chromatic: between(n, 51, 0.5, 18), grain: between(n, 52, 0.05, 0.62), flicker: between(n, 53, 0, 0.7), timeQuantization: integer(n, 49, 4, 28), glitchScan: between(n, 54, 0.04, 0.8), glitchStatic: between(n, 55, 0.02, 0.62), glitchSpeed: integer(n, 56, 2, 28) }),
  },
  {
    key: 'burst', label: 'Action Burst', cat: 'burst', terms: 'burst explosion implosion glass crack shatter slice shockwave fire smoke energy debris loop action',
    describe: (n) => `${pick(BURSTS, n, 57)} ×${integer(n, 58, 8, 58)}`,
    patch: (n) => ({ burstFx: pick(BURSTS, n, 57), burstIntensity: between(n, 59, 0.25, 1), burstSpeed: between(n, 60, 0.35, 4.5), burstInterval: between(n, 61, 0, 4), burstCycle: between(n, 62, 0.25, 4), burstLoop: integer(n, 63, 0, 1), burstOriginX: between(n, 64, 0.12, 0.88), burstOriginY: between(n, 65, 0.12, 0.88), burstSpread: between(n, 66, 0.18, 1.35), burstFragments: integer(n, 58, 8, 58), burstGravity: between(n, 67, -0.7, 0.85), burstRotation: Math.round(between(n, 68, 0, 680, 0)), burstColor: pick(PALETTE, n, 69), burstSeed: hash(n + 70) % 10_000 }),
  },
  {
    key: 'motion', label: 'Motion Pulse', cat: 'motion', terms: 'motion oscillate shake pulse swing rebound sine triangle square saw frequency angle blur',
    describe: (n) => `${pick(WAVES, n, 71)} ${between(n, 72, 0.4, 12, 1)}Hz`,
    patch: (n) => ({ oscillate: between(n, 73, 0.12, 1), oscillateFreq: between(n, 72, 0.4, 12, 2), oscillateAngle: Math.round(between(n, 74, -180, 180, 0)), oscillateWave: pick(WAVES, n, 71), oscillatePhase: Math.round(between(n, 75, 0, 360, 0)), autoShake: between(n, 76, 0, 0.72), autoShakeFreq: between(n, 77, 1, 24), motionBlur: between(n, 78, 0.08, 0.88) }),
  },
  {
    key: 'prism', label: 'Prism Repeat', cat: 'distort', terms: 'prism kaleidoscope kaleido radial repeat mirror tiles geometry tunnel symmetry',
    describe: (n) => `×${integer(n, 79, 3, 12)}`,
    patch: (n) => ({ kaleidoSegments: integer(n, 79, 3, 12), kaleidoRotate: Math.round(between(n, 80, 0, 360, 0)), prism: between(n, 81, 0.08, 1), radialRepeat: integer(n, 82, 2, 24), radialRepeatRadius: Math.round(between(n, 83, 0, 360, 0)), radialRepeatOrientation: Math.round(between(n, 84, 0, 360, 0)), tiles: integer(n, 85, 2, 6) }),
  },
  {
    key: 'graphic', label: 'Graphic Edge', cat: 'key', terms: 'graphic edge threshold posterize solarize minimax outline halftone stencil key',
    describe: (n) => `${integer(n, 86, 3, 10)} levels`,
    patch: (n) => ({ threshold: between(n, 87, 0.15, 0.88), posterize: between(n, 88, 0.2, 1), solarize: between(n, 89, 0, 0.82), findEdges: between(n, 90, 0.08, 1), minimax: integer(n, 91, 0, 8), minimaxAngle: Math.round(between(n, 92, 0, 360, 0)), minimaxMode: pick(['min', 'max'] as const, n, 93), gradientMap: between(n, 94, 0.15, 0.9), gradientMapFrom: pick(PALETTE, n, 95), gradientMapTo: pick(PALETTE, n, 96) }),
  },
  {
    key: 'studio-light', label: 'Studio Light', cat: 'light', terms: 'studio point spot directional light color intensity falloff angle width softness shadow',
    describe: (n) => `${pick(['point', 'spot', 'directional'] as const, n, 97)} ${Math.round(between(n, 98, -180, 180, 0))}°`,
    patch: (n) => ({ lightType: pick(['point', 'spot', 'directional'] as const, n, 97), lightColor: pick(PALETTE, n, 99), lightIntensity: between(n, 100, 0.18, 1.45), lightFalloff: between(n, 101, 0.12, 0.96), lightX: between(n, 102, 0.08, 0.92), lightY: between(n, 103, 0.08, 0.92), lightAngle: Math.round(between(n, 98, -180, 180, 0)), lightWidth: between(n, 104, 0.05, 0.9), lightSoftness: between(n, 105, 0, 1), longShadow: between(n, 106, 0, 52), longShadowAngle: Math.round(between(n, 107, 0, 360, 0)), longShadowColor: pick(PALETTE, n, 108) }),
  },
]

const idFor = (index: number): string => `${GENERATED_RECIPE_PREFIX}${String(index + 1).padStart(6, '0')}`

export function generatedRecipeAt(index: number): GeneratedFxEntry | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= GENERATED_RECIPE_COUNT) return undefined
  const family = FAMILIES[index % FAMILIES.length]
  const variant = Math.floor(index / FAMILIES.length) + 1
  return {
    id: idFor(index),
    name: `${family.label} · ${family.describe(variant)} · ${String(variant).padStart(4, '0')}`,
    cat: family.cat,
    trace: `OmniFrame ${family.label} recipe`,
    patch: family.patch(variant) as Record<string, number | string>,
  }
}

export function generatedRecipeById(id: string): GeneratedFxEntry | undefined {
  if (!id.startsWith(GENERATED_RECIPE_PREFIX)) return undefined
  const value = Number(id.slice(GENERATED_RECIPE_PREFIX.length))
  return Number.isInteger(value) ? generatedRecipeAt(value - 1) : undefined
}

export function queryGeneratedRecipes(options: { cat?: GeneratedFxCat | 'all'; q?: string; offset?: number; limit?: number } = {}): { total: number; entries: GeneratedFxEntry[] } {
  const cat = options.cat ?? 'all'
  const q = (options.q ?? '').trim().toLowerCase()
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.max(0, Math.floor(options.limit ?? 60))
  const entries: GeneratedFxEntry[] = []
  if (!q && cat === 'all') {
    const end = Math.min(GENERATED_RECIPE_COUNT, offset + limit)
    for (let index = offset; index < end; index++) {
      const entry = generatedRecipeAt(index)
      if (entry) entries.push(entry)
    }
    return { total: GENERATED_RECIPE_COUNT, entries }
  }
  let total = 0
  for (let index = 0; index < GENERATED_RECIPE_COUNT; index++) {
    const family = FAMILIES[index % FAMILIES.length]
    if (cat !== 'all' && family.cat !== cat) continue
    const id = idFor(index)
    if (q) {
      const staticText = `${family.label} ${family.key} ${family.cat} ${family.terms} ${id}`.toLowerCase()
      const variant = Math.floor(index / FAMILIES.length) + 1
      const dynamicText = /\d|°/.test(q) ? `${family.describe(variant)} ${String(variant).padStart(4, '0')}`.toLowerCase() : ''
      if (!staticText.includes(q) && !dynamicText.includes(q)) continue
    }
    if (total >= offset && entries.length < limit) {
      const entry = generatedRecipeAt(index)
      if (entry) entries.push(entry)
    }
    total++
  }
  return { total, entries }
}

const CATEGORY_COUNTS = FAMILIES.reduce((counts, family, familyIndex) => {
  const count = familyIndex >= GENERATED_RECIPE_COUNT ? 0 : Math.floor((GENERATED_RECIPE_COUNT - 1 - familyIndex) / FAMILIES.length) + 1
  counts.set(family.cat, (counts.get(family.cat) ?? 0) + count)
  return counts
}, new Map<GeneratedFxCat, number>())

export function generatedRecipeCount(cat: GeneratedFxCat | 'all' = 'all'): number {
  return cat === 'all' ? GENERATED_RECIPE_COUNT : CATEGORY_COUNTS.get(cat) ?? 0
}

export const GENERATED_RECIPE_FAMILIES = FAMILIES.map(({ key, label, cat, terms }) => ({ key, label, cat, terms }))
