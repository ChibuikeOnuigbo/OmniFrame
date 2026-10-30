import type { ClipEffect } from '../types'

/**
 * The Effects catalog (board J): every entry maps to REAL engine params
 * (ClipEffect keys) so every listed effect actually renders — curated
 * presets traced to the scanned editor corpus (Alight Motion guide,
 * AE effects reference, MatttVfx one-framers, glitchology pillar taxonomy,
 * CapCut/Hancybox shorts, Wizzy course, Gold Motion) PLUS generative
 * combinatorial families (colour-pair ramps × angles). No dead entries.
 *
 * Counts are real: `getFxCatalog().length` is what the UI prints.
 */

export type FxCat = 'glitch' | 'motion' | 'color' | 'blur' | 'distort' | 'retro' | 'light' | 'key' | 'Glitch NG'


export const FX_CATS: { id: FxCat | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'motion', label: 'Motion' },
  { id: 'color', label: 'Color' },
  { id: 'blur', label: 'Blur' },
  { id: 'distort', label: 'Distort' },
  { id: 'retro', label: 'Retro' },
  { id: 'light', label: 'Light' },
  { id: 'key', label: 'Key' },
]

export interface FxParamDef {
  key: string
  label: string
  kind: 'number' | 'color' | 'select'
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export interface FxCatalogEntry {
  id: string
  name: string
  cat: FxCat
  /** where the effect name/technique was scanned from */
  trace: string
  /** concrete ClipEffect patch — the engine already renders these keys */
  patch: Record<string, number | string>
}

/** Schema for every catalogued property: all editable, all numerics keyframeable. */
const KEY_META: Record<string, Omit<FxParamDef, 'key'>> = {
  brightness: { label: 'Brightness', kind: 'number', min: 0, max: 2, step: 0.01 },
  contrast: { label: 'Contrast', kind: 'number', min: 0, max: 2, step: 0.01 },
  saturation: { label: 'Saturation', kind: 'number', min: 0, max: 2, step: 0.01 },
  blur: { label: 'Blur (px)', kind: 'number', min: 0, max: 20, step: 0.5 },
  grayscale: { label: 'Grayscale', kind: 'number', min: 0, max: 1, step: 0.01 },
  invert: { label: 'Invert', kind: 'number', min: 0, max: 1, step: 0.01 },
  sepia: { label: 'Sepia', kind: 'number', min: 0, max: 1, step: 0.01 },
  hueRotate: { label: 'Hue Rotate (°)', kind: 'number', min: 0, max: 360, step: 1 },
  vibrance: { label: 'Vibrance', kind: 'number', min: 0, max: 2, step: 0.01 },
  solarize: { label: 'Solarize', kind: 'number', min: 0, max: 1, step: 0.01 },
  posterize: { label: 'Posterize', kind: 'number', min: 0, max: 1, step: 0.01 },
  grain: { label: 'Grain', kind: 'number', min: 0, max: 1, step: 0.01 },
  pixelate: { label: 'Pixelate (px)', kind: 'number', min: 0, max: 24, step: 1 },
  chromatic: { label: 'Chromatic (px)', kind: 'number', min: 0, max: 24, step: 0.5 },
  pixelStretch: { label: 'Pixel Stretch', kind: 'number', min: 0, max: 1, step: 0.01 },
  waveWarp: { label: 'Wave Warp (px)', kind: 'number', min: 0, max: 40, step: 1 },
  chromaKey: { label: 'Chroma Key', kind: 'number', min: 0, max: 1, step: 0.01 },
  chromaColor: { label: 'Key Colour', kind: 'color' },
  fractalBlur: { label: 'Fractal Blur (px)', kind: 'number', min: 0, max: 20, step: 1 },
  lumaKey: { label: 'Luma Key', kind: 'number', min: 0, max: 1, step: 0.01 },
  bumpMap: { label: 'Bump Map', kind: 'number', min: 0, max: 1, step: 0.01 },
  colorBalanceR: { label: 'Color Balance R', kind: 'number', min: -1, max: 1, step: 0.01 },
  colorBalanceG: { label: 'Color Balance G', kind: 'number', min: -1, max: 1, step: 0.01 },
  colorBalanceB: { label: 'Color Balance B', kind: 'number', min: -1, max: 1, step: 0.01 },
  shadows: { label: 'Shadows Lift', kind: 'number', min: 0, max: 1, step: 0.01 },
  highlights: { label: 'Highlights Recover', kind: 'number', min: 0, max: 1, step: 0.01 },
  hotColor: { label: 'Hot Color', kind: 'number', min: 0, max: 1, step: 0.01 },
  radialShadow: { label: 'Radial Shadow', kind: 'number', min: 0, max: 1, step: 0.01 },
  fourColorGradient: { label: 'Four-color Gradient', kind: 'number', min: 0, max: 1, step: 0.01 },
  fcgColorA: { label: 'Gradient Colour A', kind: 'color' },
  fcgColorB: { label: 'Gradient Colour B', kind: 'color' },
  fcgColorC: { label: 'Gradient Colour C', kind: 'color' },
  fcgColorD: { label: 'Gradient Colour D', kind: 'color' },
  fcgPhase: { label: 'Gradient Phase (°)', kind: 'number', min: 0, max: 360, step: 1 },
  cardFlip: { label: 'Card Flip (half-turns)', kind: 'number', min: 0, max: 2, step: 0.05 },
  zoomBlur: { label: 'Zoom Blur', kind: 'number', min: 0, max: 1, step: 0.01 },
  directionalBlur: { label: 'Directional Blur', kind: 'number', min: 0, max: 1, step: 0.01 },
  directionalBlurAngle: { label: 'Blur Angle (°)', kind: 'number', min: 0, max: 360, step: 1 },
  glow: { label: 'Glow', kind: 'number', min: 0, max: 1, step: 0.01 },
  edgeGlow: { label: 'Edge Glow', kind: 'number', min: 0, max: 1, step: 0.01 },
  edgeGlowColor: { label: 'Edge Colour', kind: 'color' },
  tiltShift: { label: 'Tilt Shift', kind: 'number', min: 0, max: 1, step: 0.01 },
  vignette: { label: 'Vignette', kind: 'number', min: 0, max: 1, step: 0.01 },
  flicker: { label: 'Flicker', kind: 'number', min: 0, max: 1, step: 0.01 },
  tiles: { label: 'Tiles / Mirror', kind: 'number', min: 0, max: 6, step: 1 },
  pinchBulge: { label: 'Pinch / Bulge', kind: 'number', min: -1, max: 1, step: 0.05 },
  swirl: { label: 'Swirl (°)', kind: 'number', min: -720, max: 720, step: 5 },
  gradientMap: { label: 'Gradient Map', kind: 'number', min: 0, max: 1, step: 0.01 },
  gradientMapFrom: { label: 'Map From', kind: 'color' },
  gradientMapTo: { label: 'Map To', kind: 'color' },
  minimax: { label: 'Minimax (px)', kind: 'number', min: 0, max: 20, step: 1 },
  minimaxAngle: { label: 'Minimax Angle (°)', kind: 'number', min: 0, max: 360, step: 1 },
  minimaxMode: { label: 'Minimax Mode', kind: 'select', options: ['max', 'min'] },
  vhs: { label: 'VHS', kind: 'number', min: 0, max: 1, step: 0.01 },
  dirColorize: { label: 'Dir Colorize', kind: 'number', min: 0, max: 1, step: 0.01 },
  dirColorizeFrom: { label: 'Ramp From', kind: 'color' },
  dirColorizeTo: { label: 'Ramp To', kind: 'color' },
  dirColorizeAngle: { label: 'Ramp Angle (°)', kind: 'number', min: 0, max: 360, step: 1 },
  oscillate: { label: 'Magnitude (px)', kind: 'number', min: 0, max: 120, step: 1 },
  oscillateFreq: { label: 'Frequency (Hz)', kind: 'number', min: 0, max: 16, step: 0.1 },
  oscillateAngle: { label: 'Angle (°)', kind: 'number', min: -3600, max: 3600, step: 1 },
  oscillateWave: { label: 'Wave', kind: 'select', options: ['sine', 'triangle'] },
  oscillatePhase: { label: 'Phase', kind: 'number', min: 0, max: 1000, step: 1 },
  turbulent: { label: 'Turbulent Warp', kind: 'number', min: 0, max: 1, step: 0.01 },
  threshold: { label: 'Threshold', kind: 'number', min: 0, max: 1, step: 0.01 },
  sharpen: { label: 'Sharpen', kind: 'number', min: 0, max: 1, step: 0.01 },
  findEdges: { label: 'Find Edges', kind: 'number', min: 0, max: 1, step: 0.01 },
  echo: { label: 'Echo Ghosts', kind: 'number', min: 0, max: 6, step: 1 },
  echoDecay: { label: 'Echo Decay', kind: 'number', min: 0, max: 1, step: 0.01 },
  echoSpacing: { label: 'Echo Spacing (s)', kind: 'number', min: 0, max: 1, step: 0.01 },
  autoShake: { label: 'Shake (px)', kind: 'number', min: 0, max: 60, step: 1 },
  autoShakeFreq: { label: 'Shake Freq (Hz)', kind: 'number', min: 0, max: 40, step: 1 },
  timeQuantization: { label: 'Strobe Step (s)', kind: 'number', min: 0, max: 1, step: 0.01 },
  motionBlur: { label: 'Motion Blur', kind: 'number', min: 0, max: 1, step: 0.01 },
  reverse: { label: 'Reverse', kind: 'number', min: 0, max: 1, step: 1 },
  freezeHold: { label: 'Freeze Hold (s)', kind: 'number', min: 0, max: 10, step: 0.1 },
  freezeAt: { label: 'Freeze At (s)', kind: 'number', min: 0, max: 60, step: 0.1 },
  glitch: { label: 'Glitch Intensity', kind: 'number', min: 0, max: 1, step: 0.01 },
  glitchStyle: { label: 'Glitch Style', kind: 'select', options: ['slice', 'rgb', 'block', 'sort', 'vhs', 'mosh', 'tear', 'shake'] },
  glitchScan: { label: 'Scanlines', kind: 'number', min: 0, max: 1, step: 0.01 },
  glitchStatic: { label: 'Static', kind: 'number', min: 0, max: 1, step: 0.01 },
  glitchSeed: { label: 'Seed', kind: 'number', min: 1, max: 999, step: 1 },
  glitchSpeed: { label: 'Step Rate (Hz)', kind: 'number', min: 1, max: 30, step: 1 },
  overlayFx: { label: 'Overlay', kind: 'select', options: ['none', 'scanlines', 'halftone', 'spotlight', 'vignette', 'lightleak', 'frameglow'] },
  overlayStrength: { label: 'Overlay Strength', kind: 'number', min: 0, max: 1, step: 0.01 },
  particleFx: { label: 'Particles', kind: 'select', options: ['none', 'feathers', 'embers', 'dust', 'bokeh', 'sparkles', 'snow', 'rain', 'petals'] },
  particleDensity: { label: 'Particle Density', kind: 'number', min: 0, max: 1, step: 0.01 },
  lightType: { label: 'Light Type', kind: 'select', options: ['point', 'spot'] },
  lightColor: { label: 'Light Colour', kind: 'color' },
  lightIntensity: { label: 'Light Intensity', kind: 'number', min: 0, max: 1.5, step: 0.05 },
  lightFalloff: { label: 'Light Falloff', kind: 'number', min: 0.1, max: 1, step: 0.01 },
  kaleidoSegments: { label: 'Segments', kind: 'number', min: 0, max: 12, step: 1 },
  kaleidoRotate: { label: 'Wedge Rotate (°)', kind: 'number', min: 0, max: 360, step: 1 },
  flare: { label: 'Flare Intensity', kind: 'number', min: 0, max: 1, step: 0.01 },
  flareX: { label: 'Flare X (%)', kind: 'number', min: 0, max: 100, step: 1 },
  flareY: { label: 'Flare Y (%)', kind: 'number', min: 0, max: 100, step: 1 },
  flareStreak: { label: 'Anamorphic Streak', kind: 'number', min: 0, max: 1, step: 0.01 },
  flareGhosts: { label: 'Ghost Rings', kind: 'number', min: 0, max: 8, step: 1 },
  flareColor: { label: 'Flare Colour', kind: 'color' },
  colorTemp: { label: 'Temperature (K)', kind: 'number', min: 1500, max: 15000, step: 100 },
  voronoi: { label: 'Voronoi Overlay', kind: 'number', min: 0, max: 1, step: 0.01 },
  voronoiCells: { label: 'Cell Sites', kind: 'number', min: 4, max: 48, step: 2 },
  voronoiColor: { label: 'Cell Colour', kind: 'color' },
  spectralMap: { label: 'Spectral Map', kind: 'number', min: 0, max: 1, step: 0.01 },
  timecode: { label: 'Timecode Overlay', kind: 'number', min: 0, max: 1, step: 0.01 },
  timecodeSize: { label: 'Timecode Size (px)', kind: 'number', min: 8, max: 64, step: 1 },
  prism: { label: 'Prism Sweep', kind: 'number', min: 0, max: 1, step: 0.01 },
  exposure: { label: 'Exposure (stops)', kind: 'number', min: -2, max: 2, step: 0.01 },
  gamma: { label: 'Gamma', kind: 'number', min: 0.2, max: 3, step: 0.01 },
  extrude: { label: 'Raster Extrude (px)', kind: 'number', min: 0, max: 40, step: 1 },
  extrudeAngle: { label: 'Extrude Angle (°)', kind: 'number', min: 0, max: 360, step: 1 },
  extrudeColor: { label: 'Extrude Color', kind: 'color' },
  radialRepeat: { label: 'Radial Repeat (copies)', kind: 'number', min: 0, max: 24, step: 1 },
  radialRepeatRadius: { label: 'Radial Radius (px)', kind: 'number', min: 0, max: 400, step: 1 },
  longShadow: { label: 'Long Shadow (px)', kind: 'number', min: 0, max: 64, step: 1 },
  longShadowAngle: { label: 'Shadow Angle (°)', kind: 'number', min: 0, max: 360, step: 1 },
  longShadowColor: { label: 'Shadow Color', kind: 'color' },
  exposureOffset: { label: 'Exposure Offset', kind: 'number', min: -1, max: 1, step: 0.01 },
  radialRepeatOrientation: { label: 'Repeat Orientation (°)', kind: 'number', min: 0, max: 360, step: 1 },
  textTransformStart: { label: 'Text Transform Start (%)', kind: 'number', min: 0, max: 100, step: 1 },
  textTransformEnd: { label: 'Text Transform End (%)', kind: 'number', min: 0, max: 100, step: 1 },
  textTransformPhase: { label: 'Text Transform Phase (%)', kind: 'number', min: 0, max: 100, step: 1 },
  copyBackground: { label: 'Copy Background', kind: 'number', min: 0, max: 1, step: 0.01 },
}

/** Editable/keyframeable property schema for any catalog patch. */
export function paramsForPatch(patch: Record<string, number | string>): FxParamDef[] {
  const out: FxParamDef[] = []
  for (const key of Object.keys(patch)) {
    const meta = KEY_META[key]
    if (meta) out.push({ key, ...meta })
  }
  return out
}

export function fxParamMeta(key: string): FxParamDef | undefined {
  const meta = KEY_META[key]
  return meta ? { key, ...meta } : undefined
}

// ------------------------------------------------------------- generative families

const PALETTE: [string, string][] = [
  ['Ice', '#dff3ff'], ['Ember', '#ff6a2a'], ['Cobalt', '#2b53d6'], ['Crimson', '#d51f3f'],
  ['Gold', '#ffc93c'], ['Jade', '#1fd68f'], ['Violet', '#8b3cf6'], ['Rose', '#ff5d8f'],
  ['Cyan', '#22d3ee'], ['Amber', '#ff9f1c'], ['Lime', '#a3e635'], ['Magenta', '#e935c1'],
  ['Navy', '#152a63'], ['Coral', '#ff7f6e'], ['Teal', '#0f9b8e'], ['Plum', '#6d2077'],
  ['Sand', '#e7d3a1'], ['Sky', '#7cc4ff'], ['Wine', '#7a1330'], ['Mint', '#b8ffe3'],
  ['Rust', '#a4441d'], ['Indigo', '#4338ca'], ['Lemon', '#f7f06a'], ['Orchid', '#c77dff'],
  ['Slate', '#64748b'], ['Peach', '#ffcba4'], ['Forest', '#14532d'], ['Fuchsia', '#ff38d0'],
  ['Steel', '#9fb3c8'], ['Tangerine', '#ff8400'], ['Iris', '#5a5bd6'], ['Snow', '#ffffff'],
]

const GLITCH_TIERS: [string, number, number, number][] = [
  // name, intensity, scan, static — the glitchology taxonomy that used to
  // live under transitions; glitch is an EFFECT now (all props keyframeable).
  ['Mild', 0.35, 0.18, 0.25],
  ['Medium', 0.55, 0.18, 0.25],
  ['Heavy', 0.75, 0.2, 0.3],
  ['Extreme', 0.92, 0.22, 0.35],
  ['TV', 0.65, 0.5, 0.55],
]
const GLITCH_STYLES: [string, string, number][] = [
  ['slice', 'Slice', 237], ['rgb', 'RGB Split', 848], ['block', 'Block', 411],
  ['sort', 'Pixel Sort', 623], ['vhs', 'VHS Damage', 129], ['mosh', 'Datamosh', 977],
  ['tear', 'Signal Tear', 356], ['shake', 'Shake', 559],
]

function buildCatalog(): FxCatalogEntry[] {
  const out: FxCatalogEntry[] = []
  const add = (id: string, name: string, cat: FxCat, trace: string, patch: Record<string, number | string>) => {
    out.push({ id, name, cat, trace, patch })
  }

  // ---- Glitch (moved out of transitions: 8 styles × 5 tiers) ----
  for (const [style, styleName, seedBase] of GLITCH_STYLES) {
    GLITCH_TIERS.forEach(([tier, I, scan, stat], ti) => {
      add(`glitch-${style}-${tier.toLowerCase()}`, `Glitch ${styleName} ${tier}`, 'glitch',
        'glitchology taxonomy (transition pillars research) — now a keyframeable effect',
        { glitch: I, glitchStyle: style, glitchScan: scan, glitchStatic: stat, glitchSeed: seedBase + ti * 131, glitchSpeed: 12 })
    })
  }

  // ---- Motion: AM Oscillate matrix (official guide) + shake/echo/strobe ----
  for (const angle of [0, 45, 90, 135, 180, 270]) {
    for (const wave of ['sine', 'triangle'] as const) {
      for (const mag of [6, 16, 40]) {
        add(`osc-${angle}-${wave}-${mag}`, `Oscillate ${mag}px ${angle}° ${wave}`, 'motion',
          'AM Oscillate — guide.alightmotion.com/effects/oscillate (official props)',
          { oscillate: mag, oscillateFreq: 2, oscillateAngle: angle, oscillateWave: wave, oscillatePhase: 0 })
      }
    }
  }
  for (const mag of [4, 10, 22, 40]) {
    add(`shake-${mag}`, `Auto Shake ${mag}px`, 'motion', 'AM Auto-Shake (Hancybox rewatch corpus)',
      { autoShake: mag, autoShakeFreq: mag > 20 ? 22 : 14 })
  }
  ;[[2, 0.55, 0.12], [4, 0.4, 0.08], [3, 0.7, 0.2]].forEach(([n, decay, spacing], i) => {
    add(`echo-${i}`, `Echo Ghosts ×${n}`, 'motion', 'AM Echo Keyframes (Hancybox rewatch corpus)',
      { echo: n, echoDecay: decay, echoSpacing: spacing })
  })
  add('mblur-1', 'Motion Blur Soft', 'motion', 'AM Motion Blur (official guide)', { motionBlur: 0.4 })
  add('mblur-2', 'Motion Blur Strong', 'motion', 'AM Motion Blur (official guide)', { motionBlur: 0.85 })
  ;[0.5, 1, 1.5].forEach((f, i) => add(`cardflip-${i}`, `Card Flip ${f * 180}°`, 'motion', 'CapCut flip / pillar cardFold research', { cardFlip: f }))
  ;[1 / 12, 1 / 8, 1 / 4, 1 / 2].forEach((q, i) => add(`strobe-${i}`, `Strobe ${Math.round(1 / q)}fps`, 'motion', 'AM Time Quantization (Hancybox rewatch corpus)', { timeQuantization: q }))
  add('reverse-1', 'Reverse Motion', 'motion', 'AM Speed reverse (official guide)', { reverse: 1 })

  // ---- Color tiers + combo looks ----
  const colorTiers: [string, string, number][] = [
    ['brightness', 'Brightness', 0.7], ['brightness', 'Brightness', 1.35],
    ['contrast', 'Contrast', 0.75], ['contrast', 'Contrast', 1.4],
    ['saturation', 'Saturation', 0.4], ['saturation', 'Saturation', 1.6],
    ['vibrance', 'Vibrance', 0.5], ['vibrance', 'Vibrance', 1.6],
    ['hueRotate', 'Hue Shift', 90], ['hueRotate', 'Hue Shift', 180],
    ['grayscale', 'Grayscale', 1], ['invert', 'Invert', 1],
    ['sepia', 'Sepia', 0.6], ['sepia', 'Sepia', 1],
    ['solarize', 'Solarize', 0.5], ['solarize', 'Solarize', 0.9],
    ['posterize', 'Posterize', 0.4], ['posterize', 'Posterize', 0.75],
    ['threshold', 'Threshold', 0.5], ['threshold', 'Threshold', 0.8],
    ['sharpen', 'Sharpen', 0.5], ['findEdges', 'Find Edges', 0.8],
  ]
  colorTiers.forEach(([key, label, v], i) => {
    add(`c-${key}-${i}`, `${label} ${v}`, 'color', 'AE effects reference / CapCut Adjust (scanned docs)', { [key]: v })
  })
  const looks: [string, string, Record<string, number>][] = [
    ['Teal Print', 'teal-print', { contrast: 1.25, saturation: 1.1, vibrance: 1.2 }],
    ['Faded Film', 'faded-film', { contrast: 0.85, brightness: 1.1, saturation: 0.8 }],
    ['Noir', 'noir', { grayscale: 1, contrast: 1.45, brightness: 0.95 }],
    ['Sun Bleach', 'sun-bleach', { brightness: 1.3, saturation: 0.65, contrast: 1.05 }],
    ['Deep Night', 'deep-night', { brightness: 0.72, contrast: 1.3, saturation: 0.9 }],
    ['Candy Pop', 'candy-pop', { saturation: 1.55, vibrance: 1.4, contrast: 1.1 }],
    ['Muted Matte', 'muted-matte', { saturation: 0.7, contrast: 0.92, brightness: 1.06 }],
    ['Golden Hour', 'golden-hour', { brightness: 1.12, saturation: 1.2, sepia: 0.25 }],
  ]
  for (const [name, id, patch] of looks) add(`look-${id}`, name, 'color', 'Editor-corpus look presets (Hancybox/CapCut scans)', patch)

  // ---- Blur ----
  ;[2, 5, 10, 18].forEach((b, i) => add(`blur-${i}`, `Gaussian Blur ${b}px`, 'blur', 'AE Fast Box Blur / CapCut blur (scanned docs)', { blur: b }))
  ;[0.35, 0.6, 0.9].forEach((z, i) => add(`zblur-${i}`, `Zoom Blur ${Math.round(z * 100)}%`, 'blur', 'AM Zoom Blur (official guide)', { zoomBlur: z }))
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
    add(`dblur-${a}`, `Directional Blur ${a}°`, 'blur', 'AM Directional Blur (official guide)', { directionalBlur: 0.7, directionalBlurAngle: a })
  }
  add('tilt-1', 'Tilt Shift Mini', 'blur', 'AM Lens Blur tilt-shift (official guide)', { tiltShift: 0.55 })
  add('tilt-2', 'Tilt Shift Strong', 'blur', 'AM Lens Blur tilt-shift (official guide)', { tiltShift: 0.95 })
  ;[4, 8, 14].forEach((f, i) => add(`fblur-${i}`, `Fractal Blur ${f}px`, 'blur', 'AE Fractal Blur family (effects reference)', { fractalBlur: f }))

  // ---- Distort ----
  ;[4, 8, 14, 22].forEach((w, i) => add(`wave-${i}`, `Wave Warp ${w}px`, 'distort', 'AE Wave Warp / AM wave (scanned docs)', { waveWarp: w }))
  for (const sw of [-180, -90, 90, 180, 360]) add(`swirl-${sw}`, `Swirl ${sw}°`, 'distort', 'AM Swirl / AE Twirl (official guides)', { swirl: sw })
  ;[-0.6, -0.3, 0.3, 0.6].forEach((p, i) => add(`pinch-${i}`, p < 0 ? `Pinch ${Math.abs(p)}` : `Bulge ${p}`, 'distort', 'AM Pinch/Bulge (official guide)', { pinchBulge: p }))
  ;[0.35, 0.7, 1].forEach((t, i) => add(`turb-${i}`, `Turbulent Warp ${Math.round(t * 100)}%`, 'distort', 'AE Turbulent Displace / Wizzy course "Turbs"', { turbulent: t }))
  ;[0.25, 0.5].forEach((p, i) => add(`pstretch-${i}`, `Pixel Stretch ${Math.round(p * 100)}%`, 'distort', 'AM Pixel Stretch (Hancybox rewatch corpus)', { pixelStretch: p }))
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
    for (const mode of ['max', 'min'] as const) {
      add(`minimax-${a}-${mode}`, `Minimax ${mode.toUpperCase()} ${a}°`, 'distort',
        'AE one-framer Minimax — MatttVfx j3Lt0dU1Lok (watched corpus)', { minimax: 10, minimaxAngle: a, minimaxMode: mode })
    }
  }
  ;[3, 6, 12].forEach((c, i) => add(`chroma-${i}`, `RGB Fringe ${c}px`, 'distort', 'glitchology RGB split (pillar research)', { chromatic: c }))

  // ---- Retro ----
  ;[0.35, 0.6, 0.85, 1].forEach((v, i) => add(`vhs-${i}`, `VHS Tape ${Math.round(v * 100)}%`, 'retro', 'MatttVfx VHS one-framer j3Lt0dU1Lok (watched corpus)', { vhs: v }))
  ;[0.2, 0.4, 0.65].forEach((g, i) => add(`grain-${i}`, `Film Grain ${Math.round(g * 100)}%`, 'retro', 'AE Add Grain / CapCut noise (scanned docs)', { grain: g }))
  ;[4, 8, 14, 20].forEach((p, i) => add(`pixl-${i}`, `Mosaic ${p}px`, 'retro', 'AE Mosaic / CapCut pixelate (scanned docs)', { pixelate: p }))
  ;[['scanlines', 0.5], ['scanlines', 0.8], ['halftone', 0.5], ['halftone', 0.8], ['vignette', 0.6]].forEach(([fx, s], i) =>
    add(`ovl-${i}`, `Overlay ${String(fx)[0].toUpperCase()}${String(fx).slice(1)} ${Math.round(Number(s) * 100)}%`, 'retro', 'AE tutorial corpus scanlines/halftone beds', { overlayFx: fx as string, overlayStrength: s as number }))
  add('crt-1', 'CRT Look', 'retro', 'Gold Motion CRT recipe (custom-effects rack)', { posterize: 0.55, grain: 0.35, chromatic: 3 })
  add('retro-vignette', 'Vintage Vignette', 'retro', 'Resolve Color chapter (training docs)', { vignette: 0.55, sepia: 0.2, contrast: 1.08 })

  // ---- Light ----
  ;[0.4, 0.7, 1].forEach((g, i) => add(`glow-${i}`, `Glow ${Math.round(g * 100)}%`, 'light', 'AM Glow (official guide)', { glow: g }))
  for (const [name, hex] of PALETTE.slice(0, 8)) {
    add(`edgeglow-${name.toLowerCase()}`, `Edge Glow ${name}`, 'light', 'AM Edge Glow / Stroke Color (official guide)', { edgeGlow: 0.9, edgeGlowColor: hex })
  }
  for (const type of ['point', 'spot'] as const) {
    for (const [name, hex] of [['Warm', '#ffd9a0'], ['Gold', '#ffc93c'], ['Cool', '#a8d8ff'], ['Blue', '#4f7dff'], ['Magenta', '#ff5df0'], ['Green', '#7dff9b']] as [string, string][]) {
      add(`light-${type}-${name.toLowerCase()}`, `${type[0].toUpperCase()}${type.slice(1)} Light ${name}`, 'light', 'Gold Motion point/spot light layers (watched corpus)',
        { lightType: type, lightColor: hex, lightIntensity: 1.1, lightFalloff: 0.5 })
    }
  }
  ;[0.4, 0.8].forEach((v, i) => add(`vig-${i}`, `Vignette ${Math.round(v * 100)}%`, 'light', 'AM Vignette (official guide)', { vignette: v }))
  ;[0.3, 0.65].forEach((f, i) => add(`flicker-${i}`, `Flicker ${Math.round(f * 100)}%`, 'light', 'AM Flicker / pillar flicker family', { flicker: f }))
  ;[['lightleak', 0.6], ['frameglow', 0.6], ['spotlight', 0.7]].forEach(([fx, s], i) =>
    add(`lightovl-${i}`, `${String(fx)[0].toUpperCase()}${String(fx).slice(1)} Overlay`, 'light', 'AE tutorial corpus light overlays', { overlayFx: fx as string, overlayStrength: s as number }))
  ;[['feathers', 0.6], ['embers', 0.5], ['dust', 0.5], ['bokeh', 0.5], ['sparkles', 0.55], ['snow', 0.6], ['rain', 0.5], ['petals', 0.5]].forEach(([fx, d], i) =>
    add(`part-${i}`, `${String(fx)[0].toUpperCase()}${String(fx).slice(1)} Bed`, 'light', 'AE particle beds (deep-study corpus)', { particleFx: fx as string, particleDensity: d as number }))
  ;(['digital-slice', 'rgb-shock', 'vhs-tear', 'datamosh-inspired', 'scan-burst', 'phantom-echo', 'neon-corrupt', 'pixel-collapse', 'vector-edge', 'spectral-logo'] as const).forEach((fam) =>
    add(`ng-${fam}`, `NG ${fam}`, 'Glitch NG', 'OmniFrame_Glitch_Audit pack family (deterministic RGBA kernel glitchNG.ts)', {
      ngFamily: fam, ngSeed: 8156, ngPrimary: '#a568ff', ngSecondary: '#15e4f3',
      ngLead: 0.0, ngAttack: 0.15, ngHold: 1.2, ngDecay: 0.3,
      ngSliceAmp: 12, ngSliceDensity: 10, ngChroma: 4, ngScanOpacity: 0.18, ngScanSpacing: 3,
      ngNoise: 0.09, ngBlock: 18, ngBlockRate: 0.09,
    }))

  // ---- Board L: top backlog names converted into REAL engines ----
  for (const seg of [4, 6, 8, 12]) {
    add(`kaleido-${seg}`, `Kaleidoscope ${seg}-seg`, 'distort',
      'Board L backlog conversion: mirror-wedge kaleidoscope family (AE CC Kaleida / AM Tiles-mirror, effects reference scan)',
      { kaleidoSegments: seg, kaleidoRotate: 0 })
  }
  add('kaleido-6-rot30', 'Kaleidoscope 6-seg 30°', 'distort',
    'Board L backlog conversion: rotating-wedge kaleidoscope (CC Kaleida family)', { kaleidoSegments: 6, kaleidoRotate: 30 })
  ;[['Anamorphic Gold', '#ffd9a0', 0.9, 4], ['Sunburst Warm', '#ffc93c', 0.5, 6], ['Cool Optical', '#a8d8ff', 0.35, 3], ['Magenta Pulse', '#ff5df0', 0.75, 5]].forEach(([name, hex, st, gh], i) =>
    add(`flare-${i}`, `Lens Flare ${name}`, 'light',
      'Board L backlog conversion: optical lens-flare family (core bloom + anamorphic streak + ghost rings)',
      { flare: 0.85, flareX: 72, flareY: 28, flareStreak: st as number, flareGhosts: gh as number, flareColor: hex as string }))
  ;[[2500, 'Candle'], [3200, 'Tungsten'], [4500, 'Warm White'], [8000, 'Overcast'], [10000, 'Deep Shade']].forEach(([k, name]) =>
    add(`kelvin-${k}`, `Color Temp ${k}K ${name}`, 'color',
      'Board L backlog conversion: Kelvin white-balance scale (colour-science / Resolve color chapter docs)', { colorTemp: k as number }))

  // ---- Board O: next backlog names converted into REAL engines ----
  ;[[8, '#7dff9b'], [16, '#22d3ee'], [32, '#ff5df0']].forEach(([c, hex]) =>
    add(`voronoi-${c}`, `Voronoi Cells ${c}`, 'light',
      'Board O backlog conversion: AM Voronoi Cells (official guide deep-scan) — generative cell-edge overlay',
      { voronoi: 0.8, voronoiCells: c as number, voronoiColor: hex as string }))
  ;[0.5, 1].forEach((v, i) =>
    add(`spectral-${i}`, `Spectral Map ${v}`, 'color',
      'Board O backlog conversion: AM Spectral Map (official guide deep-scan) — luma→hue-spectrum remap',
      { spectralMap: v }))

  // ---- Board P: Timecode burn-in (AM official index S–Z) ----
  ;[[18, 'timecode-1'], [32, 'timecode-2']].forEach(([sz, id]) =>
    add(id as string, `Timecode Burn-In ${sz}px`, 'retro',
      'Board P backlog conversion: AM Timecode (official guide S–Z index) — HH:MM:SS:FF burn-in overlay',
      { timecode: 0.9, timecodeSize: sz as number }))

  // ---- Board Q: advanced effect ----
  ;[0.6, 1].forEach((v, i) =>
    add(`prism-${i}`, `Prism Sweep ${v}`, 'color',
      'Board Q advanced effect: hue-rotate sweep across X (spectral prism dispersion)', { prism: v }))

  // ---- Key ----
  for (const [name, hex] of [['Green', '#00ff00'], ['Blue', '#1b3fe0'], ['Red', '#e01b1b'], ['Magenta', '#e01be0']] as [string, string][]) {
    add(`ckey-${name.toLowerCase()}`, `Chroma Key ${name}`, 'key', 'CapCut/AM chroma key (scanned docs)', { chromaKey: 0.85, chromaColor: hex })
  }
  add('lkey-1', 'Luma Key Soft', 'key', 'AE Luma Key (effects reference)', { lumaKey: 0.5 })
  add('lkey-2', 'Luma Key Hard', 'key', 'AE Luma Key (effects reference)', { lumaKey: 0.85 })

  // ---- Generative colour-ramp families (every pair × angle is a real look) ----
  for (let i = 0; i < PALETTE.length; i++) {
    for (let j = 0; j < PALETTE.length; j++) {
      if (i === j) continue
      const [na, ha] = PALETTE[i]
      const [nb, hb] = PALETTE[j]
      add(`gmap-${i}-${j}`, `Gradient Map ${na}→${nb}`, 'color', 'AM Gradient Map (official guide) — combinatorial family',
        { gradientMap: 1, gradientMapFrom: ha, gradientMapTo: hb })
      for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
        add(`dirc-${i}-${j}-${a}`, `Dir Colorize ${na}→${nb} ${a}°`, 'color',
          'MatttVfx directional colorize one-framer j3Lt0dU1Lok — combinatorial family',
          { dirColorize: 1, dirColorizeFrom: ha, dirColorizeTo: hb, dirColorizeAngle: a })
      }
    }
  }
  // ---- y6richo video-study corpus (Drive 1KlxUlem-Qjyd61dLkqs9nk3Ob4bou1Kp, scanned 2026-10-29):
  //      effect NAMES observed in sampled frames of 40 timeline/tutorial videos; recipes NOT claimed. ----
  {
    const VS = 'y6richo video-study corpus (40 timeline/tutorial videos, sampled frames) — observed effect names; new real engine keys'
    add('vs-exposure-gamma', 'Exposure / Gamma', 'color', VS, { exposure: 0.42, gamma: 1 })
    add('vs-exposure-gamma-neg', 'Exposure / Gamma −0.6', 'color', VS, { exposure: -0.6, gamma: 1.2 })
    add('vs-noise-threshold', 'Noise + Threshold', 'key', VS, { grain: 0.35, threshold: 0.55 })
    add('vs-raster-extrude', 'Raster Extrude (3D text look)', 'light', VS, { extrude: 10, extrudeAngle: 45, extrudeColor: '#22223a' })
    add('vs-raster-extrude-deep', 'Raster Extrude Deep 135°', 'light', VS, { extrude: 22, extrudeAngle: 135, extrudeColor: '#3a1220' })
    for (const n of [4, 6, 8, 12]) {
      add(`vs-radial-repeat-${n}`, `Radial Repeat ×${n} (3D swirl)`, 'distort', VS, { radialRepeat: n })
    }
    for (const a of [30, 45, 90]) {
      add(`vs-long-shadow-${a}`, `Long Shadow ${a}°`, 'light', VS, { longShadow: 28, longShadowAngle: a, longShadowColor: '#000000' })
    }
    add('vs-linear-streaks', 'Linear Streaks', 'blur', VS, { directionalBlur: 6, directionalBlurAngle: 90, flare: 0.5, flareStreak: 4 })
    add('vs-scanlines', 'Scanlines', 'retro', VS, { vhs: 0.5, glitchScan: 0.4 })
    add('vs-gradient-noise', 'Gradient Noise Texture', 'color', VS, { gradientMap: 0.8, gradientMapFrom: '#0a2a2a', gradientMapTo: '#9fe8d8', grain: 0.5 })
    add('vs-flicker-text', 'Flicker Text (Time Quantization)', 'retro', VS, { flicker: 0.5, timeQuantization: 8 })
    add('vs-vhs-tracking', 'VHS Tracking Preset', 'retro', VS, { vhs: 0.8, turbulent: 0.3, chromatic: 8 })
    add('vs-rainbow-edges', 'Rainbow Find Edges', 'key', VS, { findEdges: 1, gradientMap: 0.7, gradientMapFrom: '#ff375f', gradientMapTo: '#25d7fb' })
    // ---- wave 2: parameters read directly off downloaded-video frames (2026-10-30) ----
    const VS2 = 'y6richo downloaded-video frames (new_doc_toll_research/video_study/frames/) — panel parameters read off the pixels'
    add('vs2-exposure-offset', 'Exposure / Gamma + Offset', 'color', VS2 + ' 01_t019.5 (Exposure 0.26 / Gamma 1.000 / Offset 0.00)', { exposure: 0.26, gamma: 1, exposureOffset: 0 })
    add('vs2-radial-orient', 'Radial Repeat oriented ×8 22°', 'distort', VS2 + ' 27_t060 (Count 21 / Radius 0 / Orientation 0°)', { radialRepeat: 8, radialRepeatOrientation: 22 })
    add('vs2-text-transform', 'Text Transform sweep', 'motion', VS2 + ' 30_t075 (Start 0% / End 100% / Phase 0%)', { textTransformStart: 0, textTransformEnd: 100, textTransformPhase: 100 })
    add('vs2-copy-background', 'Copy Background', 'key', VS2 + ' 28_t055 (stack: Luma Key + Copy Background)', { copyBackground: 0.8 })
    add('vs2-rgb-vignette', 'RGB Vignette (Luma Key + Copy Bg)', 'key', VS2 + ' 28_t040-59 (chromatic aberration tutorial stack)', { lumaKey: 0.6, copyBackground: 0.9, chromatic: 6 })
    // ---- wave 3: remaining Color & Light browser gaps from the corpus inventory (STUDY.md) ----
    const VS3 = 'y6richo downloaded-corpus study (new_doc_toll_research/video_study/STUDY.md inventory) — AM Color & Light browser names not yet faked'
    add('vs3-bump-map', 'Bump Map', 'light', VS3 + ' (Color & Light browser gap; luma-gradient emboss, light top-left)', { bumpMap: 0.6 })
    add('vs3-color-balance', 'Color Balance', 'color', VS3 + ' (Color & Light browser gap; per-channel R/G/B balance gain)', { colorBalanceR: 0.15, colorBalanceG: -0.1, colorBalanceB: 0.2 })
    add('vs3-highlights-shadows', 'Highlights and Shadows', 'color', VS3 + ' (Color & Light browser gap; lift darks + recover brights)', { shadows: 0.5, highlights: 0.4 })
    add('vs3-hot-color', 'Hot Color', 'color', VS3 + ' (Color & Light browser gap; brights pushed to hot magenta-red)', { hotColor: 0.7 })
    add('vs3-radial-shadow', 'Radial Shadow', 'light', VS3 + ' (Color & Light browser gap; centre-out radial darkening)', { radialShadow: 0.65 })
    add('vs3-four-color-gradient', 'Four-color Gradient', 'color', VS3 + ' (Color & Light browser gap; bilinear A/B/C/D blend, rotatable phase)', { fourColorGradient: 0.8 })
    add('vs3-bokeh-hexagon', 'Bokeh Bed hexagon (shape picker)', 'light', VS3 + ' 36_t070 (BCC lens-blur shape/matte picker: circle/square/plus/triangle/hexagon/star/slash/bowtie)', { particleFx: 'bokeh-hexagon', particleDensity: 0.6 })
  }

    // ---- Alight Motion study corpus: every mapped AM effect joins the site catalog ----
  for (const am of AM_FX_CATALOG) {
    out.push({ id: am.id, name: am.name, cat: am.cat as FxCat, trace: AM_TRACE, patch: am.patch })
  }
return out
}

import { AM_FX_CATALOG, AM_TRACE } from './alightXml'

let _catalog: FxCatalogEntry[] | null = null
export function getFxCatalog(): FxCatalogEntry[] {
  if (!_catalog) _catalog = buildCatalog()
  return _catalog
}

export function fxCatalogById(id: string): FxCatalogEntry | undefined {
  return getFxCatalog().find((e) => e.id === id)
}

export function fxCatalogCount(cat?: FxCat | 'all'): number {
  const all = getFxCatalog()
  return !cat || cat === 'all' ? all.length : all.filter((e) => e.cat === cat).length
}

/** Quick-add set for the timeline context menu (≤ 9 items, UI law). */
export const FX_QUICK_IDS = [
  'glitch-rgb-medium', 'glitch-slice-heavy', 'vhs-2', 'look-noir',
  'osc-90-sine-16', 'minimax-0-max', 'glow-1', 'dirc-2-3-45',
]

/** Build the ClipEffect patch an instance starts with (defaults for the entry). */
export function patchForEntry(entry: FxCatalogEntry): ClipEffect {
  return { ...(entry.patch as unknown as ClipEffect) }
}
