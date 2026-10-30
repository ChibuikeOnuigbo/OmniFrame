import type { ClipEffect, ClipLut, CustomEffect } from '../types'
import { OVERLAY_KINDS, PARTICLE_KINDS, REPLACE_BG_KINDS } from './particleFx'

/**
 * Custom effects — OmniFrame's take on Gold Motion's "Custom Effects"
 * update (user-built effects shared as files, imported into the effects
 * library, given a thumbnail, applied like built-ins). OmniFrame's file
 * form is a small JSON document; unknown keys and out-of-range values are
 * dropped/clamped on import so shared files can't smuggle broken state.
 */

export const CUSTOM_EFFECT_KIND = 'omniframe-custom-effect'
export const CUSTOM_EFFECT_BUNDLE_KIND = 'omniframe-custom-effects'
export const CUSTOM_EFFECT_VERSION = 1
export const MAX_CUSTOM_LUT_BYTES = 2 * 1024 * 1024

/** Defaults mirror the Effects panel so "unset" values serialize away. */
export const EFFECT_DEFAULTS: Required<Omit<ClipEffect, never>> = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
  grayscale: 0,
  invert: 0,
  sepia: 0,
  hueRotate: 0,
  vibrance: 1,
  solarize: 0,
  posterize: 0,
  grain: 0,
  pixelate: 0,
  chromatic: 0,
  pixelStretch: 0,
  waveWarp: 0,
  chromaKey: 0,
  fractalBlur: 0,
  lumaKey: 0,
  cardFlip: 0,
  chromaColor: '#00ff00',
  lightType: 'point',
  lightColor: '#ffd9a0',
  lightIntensity: 0,
  lightFalloff: 0.45,
  lightX: 0.5,
  lightY: 0.4,
  particleFx: 'none',
  particleDensity: 0.5,
  particleTint: '#ffffff',
  overlayFx: 'none',
  overlayStrength: 0.5,
  replaceBg: 'none',
  zoomBlur: 0, directionalBlur: 0, directionalBlurAngle: 0, glow: 0, edgeGlow: 0,
  edgeGlowColor: '#ffdc78', tiltShift: 0, vignette: 0, flicker: 0, tiles: 0,
  pinchBulge: 0, swirl: 0, gradientMap: 0, gradientMapFrom: '#0a0a28', gradientMapTo: '#ffbe5a',
  threshold: 0, sharpen: 0, findEdges: 0, echo: 0, echoDecay: 0.5, echoSpacing: 0.08,
  autoShake: 0, autoShakeFreq: 8, timeQuantization: 0, motionBlur: 0, reverse: 0,
  freezeHold: 0, freezeAt: 0,
  minimax: 0, minimaxAngle: 0, minimaxMode: 'max', vhs: 0,
  dirColorize: 0, dirColorizeFrom: '#0028ff', dirColorizeTo: '#ff2800', dirColorizeAngle: 45,
  oscillate: 0, oscillateFreq: 2, oscillateAngle: 45, oscillateWave: 'sine', oscillatePhase: 0, turbulent: 0,
  kaleidoSegments: 0, kaleidoRotate: 0, flare: 0, flareX: 72, flareY: 28, flareStreak: 0.6, flareGhosts: 4, flareColor: '#ffd9a0',
  colorTemp: 6500,
  voronoi: 0, voronoiCells: 16, voronoiColor: '#22d3ee', spectralMap: 0,
  timecode: 0, timecodeSize: 18,
  prism: 0,
  glitch: 0, glitchStyle: 'slice', glitchScan: 0.18, glitchStatic: 0.25, glitchSeed: 1, glitchSpeed: 12,
  exposure: 0, gamma: 1,
  extrude: 0, extrudeAngle: 45, extrudeColor: '#22223a',
  radialRepeat: 0, radialRepeatRadius: 0,
  longShadow: 0, longShadowAngle: 45, longShadowColor: '#000000',
  exposureOffset: 0, radialRepeatOrientation: 0,
  textTransformStart: 0, textTransformEnd: 100, textTransformPhase: 100,
  copyBackground: 0,
}

const RANGES: Partial<Record<keyof ClipEffect, [number, number]>> = {
  exposure: [-2, 2], gamma: [0.2, 3], extrude: [0, 40], extrudeAngle: [0, 360],
  radialRepeat: [0, 24], radialRepeatRadius: [0, 400], longShadow: [0, 64], longShadowAngle: [0, 360],
  exposureOffset: [-1, 1], radialRepeatOrientation: [0, 360], textTransformStart: [0, 100], textTransformEnd: [0, 100], textTransformPhase: [0, 100], copyBackground: [0, 1],
  glitch: [0, 1], glitchScan: [0, 1], glitchStatic: [0, 1], glitchSeed: [1, 999], glitchSpeed: [1, 30],
  kaleidoSegments: [0, 12], kaleidoRotate: [0, 360], flare: [0, 1], flareX: [0, 100], flareY: [0, 100],
  flareStreak: [0, 1], flareGhosts: [0, 8], colorTemp: [1500, 15000],
  particleDensity: [0, 1],
  overlayStrength: [0, 1],
  brightness: [0, 2],
  contrast: [0, 2],
  saturation: [0, 2],
  blur: [0, 20],
  grayscale: [0, 1],
  invert: [0, 1],
  sepia: [0, 1],
  hueRotate: [0, 360],
  vibrance: [0, 2],
  solarize: [0, 1],
  posterize: [0, 1],
  grain: [0, 1],
  pixelate: [0, 24],
  chromatic: [0, 24],
  pixelStretch: [0, 60],
  waveWarp: [0, 24],
  chromaKey: [0, 1],
  fractalBlur: [0, 24],
  lumaKey: [0, 1],
  cardFlip: [0, 2],
  lightIntensity: [0, 1.5],
  lightFalloff: [0.1, 1],
  lightX: [0, 1],
  lightY: [0, 1],
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v))

/** Keep only known keys, clamp numbers, validate the light fields. */
export function sanitizeEffect(input: unknown): ClipEffect {
  if (!input || typeof input !== 'object') return {}
  const raw = input as Record<string, unknown>
  const out: ClipEffect = {}
  for (const [key, range] of Object.entries(RANGES) as Array<[keyof ClipEffect, [number, number]]>) {
    const v = raw[key as string]
    if (typeof v === 'number' && Number.isFinite(v)) {
      ;(out as Record<string, number>)[key as string] = clamp(v, range)
    }
  }
  if (raw.lightType === 'point' || raw.lightType === 'spot') out.lightType = raw.lightType
  if (typeof raw.lightColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.lightColor)) out.lightColor = raw.lightColor
  if (typeof raw.particleFx === 'string' && (PARTICLE_KINDS as readonly string[]).includes(raw.particleFx)) out.particleFx = raw.particleFx as ClipEffect['particleFx']
  if (typeof raw.overlayFx === 'string' && (OVERLAY_KINDS as readonly string[]).includes(raw.overlayFx)) out.overlayFx = raw.overlayFx as ClipEffect['overlayFx']
  if (typeof raw.replaceBg === 'string' && (REPLACE_BG_KINDS as readonly string[]).includes(raw.replaceBg)) out.replaceBg = raw.replaceBg as ClipEffect['replaceBg']
  if (typeof raw.particleTint === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.particleTint)) out.particleTint = raw.particleTint
  return out
}

export function sanitizeLuts(input: unknown): ClipLut[] {
  if (!Array.isArray(input)) return []
  const out: ClipLut[] = []
  for (const item of input.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'LUT'
    const cubeText = typeof raw.cubeText === 'string' && raw.cubeText.length <= MAX_CUSTOM_LUT_BYTES ? raw.cubeText : undefined
    const builtin = typeof raw.builtin === 'string' && raw.builtin ? raw.builtin.slice(0, 120) : undefined
    if (!cubeText && !builtin) continue
    out.push({
      id: `lut-${Math.random().toString(36).slice(2, 9)}`,
      name,
      ...(builtin ? { builtin } : {}),
      ...(cubeText ? { cubeText } : {}),
      intensity: typeof raw.intensity === 'number' && Number.isFinite(raw.intensity) ? clamp(raw.intensity, [0, 1]) : 1,
      enabled: raw.enabled !== false,
    })
  }
  return out
}

/** Drop values equal to the defaults so shared files stay small and diffs are honest. */
export function compactEffect(effect: ClipEffect): ClipEffect {
  const out: ClipEffect = {}
  for (const [key, value] of Object.entries(effect) as Array<[keyof ClipEffect, unknown]>) {
    if (value === undefined) continue
    if ((EFFECT_DEFAULTS as Record<string, unknown>)[key as string] === value) continue
    ;(out as Record<string, unknown>)[key as string] = value
  }
  return out
}

const LABELS: Partial<Record<keyof ClipEffect, string>> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  blur: 'Blur',
  grayscale: 'B&W',
  invert: 'Invert',
  sepia: 'Sepia',
  hueRotate: 'Hue shift',
  lightIntensity: 'Light',
  particleFx: 'Particles',
  overlayFx: 'Overlay',
  replaceBg: 'BG bed',
}

/** Short human summary of what a custom effect does, e.g. "Sepia · Hue shift · LUT: Warm". */
export function customEffectSummary(fx: Pick<CustomEffect, 'effect' | 'luts'>): string {
  const parts: string[] = []
  const effect = sanitizeEffect(fx.effect)
  for (const [key, label] of Object.entries(LABELS) as Array<[keyof ClipEffect, string]>) {
    const v = effect[key]
    if (typeof v === 'number' && v !== (EFFECT_DEFAULTS as Record<string, unknown>)[key as string]) parts.push(label)
  }
  if ((effect.lightIntensity ?? 0) > 0) { /* already counted via LABELS */ }
  for (const lut of fx.luts ?? []) parts.push(`LUT: ${lut.name}`)
  return parts.length ? parts.join(' · ') : 'Neutral grade'
}

export function serializeCustomEffect(fx: CustomEffect): string {
  return JSON.stringify(
    {
      kind: CUSTOM_EFFECT_KIND,
      version: CUSTOM_EFFECT_VERSION,
      name: fx.name,
      effect: compactEffect(sanitizeEffect(fx.effect)),
      luts: sanitizeLuts(fx.luts).map(({ id: _id, ...rest }) => rest),
      ...(fx.thumbnail ? { thumbnail: fx.thumbnail } : {}),
    },
    null,
    2,
  )
}

export function customEffectFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'effect'
  return `${slug}.omniframe-effect.json`
}

function toCustomEffect(raw: Record<string, unknown>, index: number): CustomEffect | null {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : ''
  if (!name) return null
  const effect = sanitizeEffect(raw.effect)
  const luts = sanitizeLuts(raw.luts)
  if (!Object.keys(compactEffect(effect)).length && !luts.length) return null
  const thumbnail =
    typeof raw.thumbnail === 'string' && raw.thumbnail.startsWith('data:image/') && raw.thumbnail.length < 400_000
      ? raw.thumbnail
      : undefined
  return {
    id: `fx-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    effect,
    ...(luts.length ? { luts } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  }
}

/** Parse one file's text: a single custom effect or a bundle of them. */
export function parseCustomEffectFile(text: string): { effects: CustomEffect[]; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { effects: [], error: 'That file is not valid JSON — custom effects are shared as .omniframe-effect.json files.' }
  }
  if (!parsed || typeof parsed !== 'object') return { effects: [], error: 'That file does not contain a custom effect.' }
  const doc = parsed as Record<string, unknown>
  if (doc.kind === CUSTOM_EFFECT_BUNDLE_KIND && Array.isArray(doc.effects)) {
    const effects = doc.effects
      .map((item, i) => (item && typeof item === 'object' ? toCustomEffect(item as Record<string, unknown>, i) : null))
      .filter((x): x is CustomEffect => !!x)
    return effects.length ? { effects } : { effects: [], error: 'No usable effects were found in that bundle.' }
  }
  if (doc.kind !== CUSTOM_EFFECT_KIND) {
    return { effects: [], error: 'That JSON is not an OmniFrame custom effect (missing the omniframe-custom-effect header).' }
  }
  const fx = toCustomEffect(doc, 0)
  return fx ? { effects: [fx] } : { effects: [], error: 'That custom effect has no settings or LUTs to import.' }
}
