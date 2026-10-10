/**
 * Bakes the 25 built-in LUTs to public/luts/*.cube + manifest.json.
 *
 * Each look is an ASC-CDL-style recipe (slope/offset/power per channel,
 * saturation, optional master S-curve and split-toning) — the same mental
 * model as the grading craft documented in vibe-editing's TECHNIQUES.md
 * (out = (in*slope + offset)^power, then global saturation), plus the
 * anime-edit "CC" conventions (deep blue/teal shadows, neon separation,
 * crushed blacks) from the AMV genre the reference edits belong to.
 *
 * The recipes bake to standard 33-point 3D .cube files (Adobe/Iridas
 * format) so they are REAL LUTs: users can download them, use them in
 * Premiere/AE/CapCut, and upload their own .cube files back.
 *
 *   node scripts/generate-luts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'public/luts')
mkdirSync(OUT, { recursive: true })

const SIZE = 33

/** @typedef {{ slope:[number,number,number], offset:[number,number,number], power:[number,number,number], sat:number, sCurve?:number, splitShadow?:[number,number,number], splitHighlight?:[number,number,number], splitStrength?:number, desc:string, category:string }} Recipe */

const clamp01 = (x) => Math.min(1, Math.max(0, x))

/** master S-curve around 0.5: amount>0 pushes contrast, <0 flattens */
const sCurve = (x, amount) => {
  if (!amount) return x
  // smoothstep-style blend between x and its squared-contrast version
  const curved = x * x * (3 - 2 * x)
  return x + (curved - x) * amount
}

/** @type {Record<string, Recipe>} */
const RECIPES = {
  'teal-orange': {
    desc: 'The cinematic classic: teal shadows, warm highlights.',
    category: 'Cinematic',
    slope: [1.06, 1.0, 1.04], offset: [-0.015, -0.005, 0.03], power: [0.96, 1.0, 0.94],
    sat: 1.08, sCurve: 0.25,
    splitShadow: [0.0, 0.10, 0.12], splitHighlight: [0.10, 0.04, -0.04], splitStrength: 0.5,
  },
  'gojo-blue': {
    desc: 'Anime-edit CC: infinite-void blues, cyan highlights, crushed blacks.',
    category: 'Anime CC',
    slope: [0.98, 1.02, 1.12], offset: [-0.03, -0.01, 0.04], power: [1.05, 0.98, 0.90],
    sat: 1.18, sCurve: 0.35,
    splitShadow: [-0.04, 0.02, 0.14], splitHighlight: [0.0, 0.08, 0.10], splitStrength: 0.7,
  },
  'toji-noir': {
    desc: 'Dark, restrained, slightly warm monochrome-leaning grade.',
    category: 'Anime CC',
    slope: [1.10, 1.06, 1.02], offset: [-0.05, -0.05, -0.04], power: [0.94, 0.96, 1.0],
    sat: 0.55, sCurve: 0.45,
    splitShadow: [0.01, 0.005, -0.01], splitHighlight: [0.06, 0.03, 0.0], splitStrength: 0.35,
  },
  'sukuna-crimson': {
    desc: 'Menacing red/magenta push with hard contrast.',
    category: 'Anime CC',
    slope: [1.14, 0.98, 1.02], offset: [0.02, -0.03, -0.01], power: [0.90, 1.02, 1.02],
    sat: 1.22, sCurve: 0.4,
    splitShadow: [0.10, -0.02, 0.02], splitHighlight: [0.10, -0.02, 0.02], splitStrength: 0.6,
  },
  'neon-tokyo': {
    desc: 'Cyberpunk magenta + cyan, saturated for night-city and glow edits.',
    category: 'Anime CC',
    slope: [1.08, 0.96, 1.10], offset: [0.01, -0.02, 0.03], power: [0.95, 1.05, 0.92],
    sat: 1.28, sCurve: 0.3,
    splitShadow: [0.10, -0.04, 0.14], splitHighlight: [0.08, 0.02, 0.06], splitStrength: 0.75,
  },
  'golden-hour': {
    desc: 'Warm sunset light, gently lifted shadows.',
    category: 'Warm',
    slope: [1.10, 1.03, 0.94], offset: [0.025, 0.01, -0.01], power: [0.94, 0.98, 1.06],
    sat: 1.06, sCurve: 0.12,
    splitShadow: [0.02, 0.01, -0.02], splitHighlight: [0.08, 0.04, -0.04], splitStrength: 0.45,
  },
  'cold-winter': {
    desc: 'Icy, desaturated blue wash.',
    category: 'Cool',
    slope: [0.98, 1.0, 1.06], offset: [0.0, 0.005, 0.03], power: [1.02, 1.0, 0.94],
    sat: 0.88, sCurve: 0.15,
    splitShadow: [-0.02, 0.0, 0.08], splitHighlight: [0.0, 0.01, 0.05], splitStrength: 0.55,
  },
  'film-noir': {
    desc: 'High-contrast black & white with silver highlights.',
    category: 'Mono',
    slope: [1.08, 1.08, 1.08], offset: [-0.03, -0.03, -0.03], power: [0.96, 0.96, 0.96],
    sat: 0.0, sCurve: 0.5,
  },
  'vintage-fade': {
    desc: 'Faded film: lifted blacks, muted warmth.',
    category: 'Vintage',
    slope: [1.02, 1.0, 0.98], offset: [0.045, 0.035, 0.03], power: [1.04, 1.04, 1.06],
    sat: 0.82, sCurve: -0.2,
    splitShadow: [0.03, 0.02, 0.01], splitHighlight: [0.04, 0.02, 0.0], splitStrength: 0.4,
  },
  'dreamy-pastel': {
    desc: 'Soft, low-contrast, airy pastel wash.',
    category: 'Soft',
    slope: [0.98, 0.99, 1.0], offset: [0.05, 0.04, 0.05], power: [1.06, 1.05, 1.04],
    sat: 0.9, sCurve: -0.3,
    splitShadow: [0.04, 0.02, 0.04], splitHighlight: [0.03, 0.02, 0.03], splitStrength: 0.5,
  },
  'bleach-bypass': {
    desc: 'Silver, harsh contrast, near-mono.',
    category: 'Cinematic',
    slope: [1.16, 1.14, 1.10], offset: [-0.02, -0.02, -0.02], power: [0.92, 0.92, 0.94],
    sat: 0.35, sCurve: 0.55,
  },
  'sepia-tone': {
    desc: 'Classic warm monochrome.',
    category: 'Mono',
    slope: [1.06, 1.0, 0.92], offset: [0.03, 0.015, -0.02], power: [0.94, 1.0, 1.1],
    sat: 0.0, sCurve: 0.15,
    splitShadow: [0.06, 0.03, -0.02], splitHighlight: [0.08, 0.04, -0.02], splitStrength: 0.85,
  },
  'autumn-warmth': {
    desc: 'Amber and rust, rich midtones.',
    category: 'Warm',
    slope: [1.08, 1.02, 0.92], offset: [0.02, 0.005, -0.025], power: [0.95, 0.98, 1.08],
    sat: 1.12, sCurve: 0.2,
    splitShadow: [0.04, 0.01, -0.03], splitHighlight: [0.07, 0.03, -0.04], splitStrength: 0.5,
  },
  'moody-dark': {
    desc: 'Crushed blacks, muted, heavy mood.',
    category: 'Cinematic',
    slope: [1.06, 1.04, 1.04], offset: [-0.06, -0.055, -0.05], power: [0.98, 1.0, 1.0],
    sat: 0.78, sCurve: 0.3,
    splitShadow: [-0.01, 0.0, 0.03], splitHighlight: [0.02, 0.01, 0.0], splitStrength: 0.4,
  },
  'bright-airy': {
    desc: 'High-key lift, clean and open.',
    category: 'Bright',
    slope: [1.0, 1.0, 1.0], offset: [0.07, 0.07, 0.07], power: [1.02, 1.02, 1.02],
    sat: 0.95, sCurve: -0.15,
  },
  'vhs-2000s': {
    desc: 'Consumer-camcorder wash: green shift, faded blacks.',
    category: 'Vintage',
    slope: [1.0, 1.02, 0.98], offset: [0.03, 0.04, 0.02], power: [1.04, 1.0, 1.06],
    sat: 0.85, sCurve: -0.1,
    splitShadow: [0.0, 0.05, 0.0], splitHighlight: [0.03, 0.04, 0.0], splitStrength: 0.55,
  },
  'y2k-digicam': {
    desc: 'Harsh early-2000s point-and-shoot: cool, contrasty, clinical.',
    category: 'Vintage',
    slope: [1.05, 1.04, 1.08], offset: [0.01, 0.01, 0.03], power: [1.0, 1.0, 0.96],
    sat: 0.92, sCurve: 0.35,
    splitShadow: [-0.01, 0.0, 0.04], splitHighlight: [0.0, 0.0, 0.03], splitStrength: 0.4,
  },
  'purple-haze': {
    desc: 'Lavender shadows, soft magenta air.',
    category: 'Cool',
    slope: [1.02, 0.99, 1.06], offset: [0.015, 0.0, 0.03], power: [0.98, 1.02, 0.96],
    sat: 1.05, sCurve: 0.1,
    splitShadow: [0.06, 0.0, 0.10], splitHighlight: [0.04, 0.0, 0.05], splitStrength: 0.6,
  },
  'ocean-deep': {
    desc: 'Dark teal dive: cold shadows, restrained highlights.',
    category: 'Cool',
    slope: [0.96, 1.0, 1.05], offset: [-0.03, -0.01, 0.02], power: [1.06, 1.0, 0.92],
    sat: 1.0, sCurve: 0.3,
    splitShadow: [-0.03, 0.03, 0.09], splitHighlight: [0.0, 0.04, 0.05], splitStrength: 0.65,
  },
  'forest-emerald': {
    desc: 'Rich green midtones, earthy shadows.',
    category: 'Warm',
    slope: [0.98, 1.06, 0.98], offset: [-0.01, 0.015, -0.01], power: [1.02, 0.94, 1.04],
    sat: 1.1, sCurve: 0.2,
    splitShadow: [-0.01, 0.04, 0.0], splitHighlight: [0.02, 0.05, 0.0], splitStrength: 0.5,
  },
  'desert-dust': {
    desc: 'Sandy, dry warmth with soft contrast.',
    category: 'Warm',
    slope: [1.05, 1.0, 0.94], offset: [0.03, 0.02, 0.0], power: [0.98, 1.0, 1.06],
    sat: 0.9, sCurve: 0.05,
    splitShadow: [0.04, 0.03, 0.01], splitHighlight: [0.06, 0.04, 0.0], splitStrength: 0.5,
  },
  'cinematic-contrast': {
    desc: 'Neutral S-curve punch — color untouched, contrast only.',
    category: 'Cinematic',
    slope: [1.04, 1.04, 1.04], offset: [-0.015, -0.015, -0.015], power: [1.0, 1.0, 1.0],
    sat: 1.02, sCurve: 0.45,
  },
  'soft-bloom': {
    desc: 'Raised blacks, gentle desaturation — glow-edit base.',
    category: 'Soft',
    slope: [0.98, 0.98, 1.0], offset: [0.055, 0.05, 0.06], power: [1.05, 1.05, 1.03],
    sat: 0.88, sCurve: -0.25,
    splitShadow: [0.02, 0.02, 0.05], splitHighlight: [0.02, 0.02, 0.04], splitStrength: 0.4,
  },
  'clean-brighten': {
    desc: 'The honest auto-grade: a gentle +EV lift, nothing creative.',
    category: 'Bright',
    slope: [1.0, 1.0, 1.0], offset: [0.035, 0.035, 0.035], power: [1.0, 1.0, 1.0],
    sat: 0.99, sCurve: 0.05,
  },
  'midnight-blue': {
    desc: 'Blue hour: deep, cool, quiet.',
    category: 'Cool',
    slope: [0.96, 0.99, 1.08], offset: [-0.045, -0.035, -0.01], power: [1.08, 1.04, 0.92],
    sat: 0.95, sCurve: 0.35,
    splitShadow: [-0.04, 0.0, 0.12], splitHighlight: [0.0, 0.02, 0.06], splitStrength: 0.7,
  },
  'honored-gold': {
    desc: 'The honorary finish: warm gold highlights over cool shadows.',
    category: 'Anime CC',
    slope: [1.08, 1.02, 0.96], offset: [-0.02, -0.01, 0.02], power: [0.94, 0.98, 1.04],
    sat: 1.14, sCurve: 0.4,
    splitShadow: [-0.02, 0.02, 0.10], splitHighlight: [0.12, 0.06, -0.03], splitStrength: 0.65,
  },
}

/** bakes one recipe to RGB for an input color */
function bakePixel(recipe, r, g, b) {
  const ch = (x, i) => {
    let v = x * recipe.slope[i] + recipe.offset[i]
    v = Math.pow(clamp01(v), recipe.power[i])
    v = sCurve(clamp01(v), recipe.sCurve)
    return v
  }
  let R = ch(r, 0), G = ch(g, 1), B = ch(b, 2)
  // split-toning: tint by luma
  if (recipe.splitStrength && (recipe.splitShadow || recipe.splitHighlight)) {
    const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const s = recipe.splitShadow || [0, 0, 0]
    const h = recipe.splitHighlight || [0, 0, 0]
    const k = recipe.splitStrength
    const t = (idx) => (s[idx] * (1 - luma) + h[idx] * luma) * k
    R = clamp01(R + t(0) * (1 - Math.abs(2 * R - 1)) * 0.5 + t(0) * 0.5)
    G = clamp01(G + t(1) * (1 - Math.abs(2 * G - 1)) * 0.5 + t(1) * 0.5)
    B = clamp01(B + t(2) * (1 - Math.abs(2 * B - 1)) * 0.5 + t(2) * 0.5)
  }
  // global saturation
  const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const mix = (x) => clamp01(luma + (x - luma) * recipe.sat)
  R = mix(R); G = mix(G); B = mix(B)
  return [R, G, B]
}

const manifest = []
for (const [id, recipe] of Object.entries(RECIPES)) {
  const lines = [
    `# OmniFrame built-in LUT — ${id}`,
    `# ${recipe.desc}`,
    `TITLE "${id}"`,
    'LUT_3D_SIZE 33',
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
    '',
  ]
  // .cube iteration order: B fastest, then G, then R
  for (let ri = 0; ri < SIZE; ri++) {
    for (let gi = 0; gi < SIZE; gi++) {
      for (let bi = 0; bi < SIZE; bi++) {
        const [R, G, B] = bakePixel(recipe, ri / (SIZE - 1), gi / (SIZE - 1), bi / (SIZE - 1))
        lines.push(`${R.toFixed(6)} ${G.toFixed(6)} ${B.toFixed(6)}`)
      }
    }
  }
  writeFileSync(join(OUT, `${id}.cube`), lines.join('\n') + '\n')
  // swatch: bake a neutral mid-grey + a warm/cool pair for the UI tile
  const mid = bakePixel(recipe, 0.5, 0.5, 0.5)
  const swatch = mid.map((v) => Math.round(v * 255))
  manifest.push({
    id,
    name: id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    file: `luts/${id}.cube`,
    description: recipe.desc,
    category: recipe.category,
    swatch: `rgb(${swatch[0]}, ${swatch[1]}, ${swatch[2]})`,
  })
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), count: manifest.length, luts: manifest }, null, 2))
console.log(`baked ${manifest.length} LUTs -> public/luts/`)
