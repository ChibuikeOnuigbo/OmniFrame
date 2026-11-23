/** Stable browsing paths. Catalog IDs and saved projects never depend on labels. */
export interface TaxonomyEntry {
  cat: string
  groupPath?: readonly string[]
  patch: Record<string, number | string>
}

const LABELS: Record<string, string> = {
  blur: 'Blur', shape: 'Shape Blur', box: 'Box', gaussian: 'Gaussian', aperture: 'Lens Bokeh',
  motion: 'Motion', directional: 'Directional', zoom: 'Zoom', temporal: 'Trails', focus: 'Focus',
  tilt: 'Tilt Shift', fractal: 'Fractal', color: 'Color', selective: 'Selective', hold: 'Color Hold',
  channels: 'Channels', mixer: 'Channel Mixer', mapping: 'Color Maps', correction: 'Correction', looks: 'Looks',
  key: 'Key & Matte', luminance: 'Luminance', range: 'Range', threshold: 'Threshold',
  chroma: 'Chroma', spill: 'Despill', green: 'Green', blue: 'Blue', graphic: 'Graphic',
  distort: 'Distort', warp: 'Warp', flow: 'Turbulence', liquify: 'Liquify', repeat: 'Repeat', geometry: 'Geometry',
  light: 'Light', glow: 'Glow', aura: 'Aura', rays: 'Rays', lighting: 'Lighting',
  shake: 'Shake', oscillate: 'Oscillate', transform: 'Transform', draw: 'Draw On',
  burst: 'Burst', fracture: 'Fracture', glass: 'Glass', crack: 'Crack', shatter: 'Shatter',
  particles: 'Particles', implosion: 'Implosion', explosion: 'Explosion', mixed: 'Mixed',
  retro: 'Retro', tape: 'Tape', film: 'Film', signal: 'Signal',
  glitch: 'Glitch', rgb: 'RGB Split', displacement: 'Displacement', noise: 'Noise',
  'Glitch NG': 'Glitch NG', recipes: 'Recipes',
  digital: 'Digital', card: 'Card Flip', slice: 'Slice', block: 'Blocks', sort: 'Pixel Sort',
  mosh: 'Datamosh', tear: 'Signal Tear', vhs: 'VHS', tiles: 'Tiles',
  shockwave: 'Shockwave', fireball: 'Fireball', smoke: 'Smoke', energy: 'Energy',
  'digital-slice': 'Digital Slice', 'rgb-shock': 'RGB Shock', 'vhs-tear': 'VHS Tear',
  'datamosh-inspired': 'Datamosh', 'scan-burst': 'Scan Burst', 'phantom-echo': 'Phantom Echo',
  'neon-corrupt': 'Neon Corrupt', 'pixel-collapse': 'Pixel Collapse', 'vector-edge': 'Vector Edge', 'spectral-logo': 'Spectral Logo',
}
export const effectGroupLabel = (id: string): string => LABELS[id] ?? id

const cachedPaths = new WeakMap<TaxonomyEntry, readonly string[]>()

/** Classify the dominant operation, not incidental words in a preset title. */
export function effectGroupPath(entry: TaxonomyEntry): readonly string[] {
  if (entry.groupPath) return entry.groupPath
  const cached = cachedPaths.get(entry)
  if (cached) return cached
  const p = entry.patch
  const has = (...keys: string[]) => keys.some(key => typeof p[key] === 'number' ? p[key] !== 0 : !!p[key])
  let sub: string[]
  switch (entry.cat) {
    case 'blur':
      sub = has('boxBlur') ? ['shape', 'box'] : has('lensBokeh') ? ['shape', 'aperture']
        : has('directionalBlur') ? ['motion', 'directional'] : has('zoomBlur') ? ['motion', 'zoom']
        : has('tiltShift') ? ['focus', 'tilt'] : has('fractalBlur') ? ['shape', 'fractal']
        : has('blur') ? ['shape', 'gaussian'] : ['motion', 'temporal']; break
    case 'color':
      sub = has('colorHold') ? ['selective', 'hold'] : has('channelMixer') ? ['channels', 'mixer']
        : has('gradientMap', 'dirColorize', 'colorize') ? ['mapping']
        : has('exposure', 'gamma', 'colorTemp', 'levelsBlack', 'levelsWhite') ? ['correction'] : ['looks']; break
    case 'key':
      sub = has('despill') ? ['chroma', 'spill', p.despillChannel === 'blue' ? 'blue' : 'green']
        : has('chromaKey') ? ['chroma'] : has('lumaRange') ? ['luminance', 'range']
        : has('lumaKey') ? ['luminance', 'threshold'] : ['graphic']; break
    case 'distort':
      sub = has('turbulent') ? ['warp', 'flow'] : has('liquifyAmount') ? ['warp', 'liquify']
        : has('kaleidoSegments', 'radialRepeat', 'tiles', 'prism') ? ['repeat']
        : has('waveWarp', 'swirl', 'pinchBulge', 'pixelStretch') ? ['warp'] : ['geometry']; break
    case 'light':
      sub = has('aura') ? ['glow', 'aura'] : has('glow', 'edgeGlow') ? ['glow']
        : has('lightRays', 'radialRays', 'directionalLight') ? ['rays'] : ['lighting']; break
    case 'motion':
      sub = has('oscillate') ? ['oscillate'] : has('autoShake') ? ['shake']
        : has('motionBlur', 'echo') ? ['temporal'] : has('drawReveal') ? ['draw']
        : has('cardFlip') ? ['transform', 'card'] : ['transform']; break
    case 'burst':
      sub = ['glass', 'crack', 'shatter', 'tiles', 'slice'].includes(String(p.burstFx)) ? ['fracture', String(p.burstFx)]
        : p.burstFx === 'implosion' ? ['implosion'] : ['explosion', String(p.burstFx || 'mixed')]; break
    case 'retro': sub = has('vhs') ? ['tape'] : has('grain', 'flicker') ? ['film'] : ['signal']; break
    case 'glitch': sub = ['slice', 'block', 'sort', 'mosh', 'tear'].includes(String(p.glitchStyle)) ? ['displacement', String(p.glitchStyle)]
      : p.glitchStyle === 'rgb' ? ['rgb'] : p.glitchStyle === 'vhs' ? ['signal', 'vhs'] : p.glitchStyle === 'shake' ? ['motion', 'shake']
      : has('pixelStretch') ? ['displacement']
      : has('chromatic') ? ['rgb'] : ['noise']; break
    case 'Glitch NG': {
      const family = String(p.ngFamily || 'recipes')
      sub = ['digital-slice', 'datamosh-inspired', 'pixel-collapse'].includes(family) ? ['digital', family]
        : ['vhs-tear', 'scan-burst'].includes(family) ? ['signal', family]
        : family === 'phantom-echo' ? ['motion', family] : ['graphic', family]
      break
    }
    default: sub = ['recipes']
  }
  const path = Object.freeze([entry.cat, ...sub])
  cachedPaths.set(entry, path)
  return path
}

/** Indexed families keep a single stable path across their parameter variations. */
export const GENERATED_GROUPS: Record<string, readonly string[]> = {
  cinema: ['color', 'correction'], gradient: ['color', 'mapping'], bokeh: ['blur', 'shape', 'aperture'],
  streak: ['blur', 'motion', 'directional'], flow: ['distort', 'warp', 'flow'], aura: ['light', 'glow', 'aura'],
  retro: ['retro', 'tape'], burst: ['burst', 'mixed'], motion: ['motion', 'oscillate'],
  prism: ['distort', 'repeat'], graphic: ['key', 'graphic'], 'studio-light': ['light', 'lighting'],
}

export function isInEffectGroup(path: readonly string[], parent: readonly string[] = []): boolean {
  return parent.every((part, index) => path[index] === part)
}

export function effectTags(entry: TaxonomyEntry): string[] {
  return effectGroupPath(entry).map(effectGroupLabel)
}
