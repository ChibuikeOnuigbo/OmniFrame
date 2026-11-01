import type { FxCatalogEntry, FxCat } from './effectCatalog'

/** Original combinations of shared engine operations; not new shader algorithms. */
const palettes = [
  ['Ember', '#29172b', '#ffba71'], ['Lagoon', '#072c45', '#8de9cb'],
  ['Orchid', '#321447', '#eab7f5'], ['Copper', '#271a12', '#e9b785'],
  ['Arctic', '#112748', '#d0efff'], ['Rose', '#39172a', '#ffd0ca'],
  ['Olive', '#202818', '#e2dfa8'], ['Cobalt', '#141f57', '#abbfff'],
  ['Coral', '#422323', '#ffad8f'], ['Moonlight', '#20283e', '#d8d9ec'],
  ['Mint', '#15382f', '#c0ffe1'], ['Amber', '#352618', '#ffe28c'],
] as const
const families: { name: string; cat: FxCat; patch: Record<string, number | string> }[] = [
  { name: 'Cinema', cat: 'color', patch: { contrast: 1.15, saturation: .85, vignette: .22 } },
  { name: 'Soft Bloom', cat: 'light', patch: { glow: .3, contrast: .95 } },
  { name: 'Print Grain', cat: 'retro', patch: { grain: .16, saturation: .75, vignette: .15 } },
  { name: 'Crisp Detail', cat: 'color', patch: { sharpen: .55, contrast: 1.08 } },
  { name: 'Neon Edge', cat: 'light', patch: { edgeGlow: .55, edgeGlowColor: '#94e8ff', contrast: 1.12 } },
  { name: 'Prism Glass', cat: 'distort', patch: { chromatic: 4, prism: .22 } },
  { name: 'Poster Ink', cat: 'retro', patch: { posterize: .45, contrast: 1.2 } },
  { name: 'Solar Print', cat: 'color', patch: { solarize: .35, saturation: .8 } },
  { name: 'Dream Diffusion', cat: 'blur', patch: { fractalBlur: 3, glow: .18 } },
  { name: 'Tape Memory', cat: 'retro', patch: { vhs: .3, chromatic: 2, grain: .08 } },
  { name: 'Ripple Lens', cat: 'distort', patch: { waveWarp: 8, chromatic: 1 } },
  { name: 'Emboss Study', cat: 'light', patch: { bumpMap: .5, contrast: 1.05 } },
]
const strengths = ['Whisper', 'Soft', 'Gentle', 'Balanced', 'Rich', 'Bold', 'Deep', 'Intense']
export function buildStudioLooks(): FxCatalogEntry[] {
  return families.flatMap((family, f) => palettes.flatMap(([palette, from, to], p) => strengths.map((strength, s) => ({
    id: `studio-${f}-${p}-${s}`,
    name: `${family.name} · ${palette} · ${strength}`,
    cat: family.cat,
    trace: 'Studio Looks · original OmniFrame recipe · 12 families × 12 palettes × 8 tonal mixes; editable shared-engine parameters',
    patch: { ...family.patch, gradientMap: Number((.16 + s * .1).toFixed(2)), gradientMapFrom: from, gradientMapTo: to },
  }))))
}
