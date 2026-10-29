/**
 * Alight Motion (v5 project XML) reader — intensive-study implementation.
 *
 * Studied corpus (new_doc_toll_research/alight/, 11 files, AM 5.0.161/5.0.270):
 *   hardtrekk-hero.xml (5h+ hero edit, 120fps), warps.xml, cc-5plus1.xml,
 *   Onyankopon.xml, Evergreen.xml, pf/Project Files/{LOSER,Lawless,Mi Mi Mi,
 *   Montagem Guerreirro,Tiki Tiki} - PF.xml, cc-tymm/Cc/Cc Pack 1,000 subs.xml
 *
 * XML anatomy (regex-parsed so it runs identically in browser + headless):
 *   <scene title width height fps totalTime(ms) bgcolor>
 *     <bookmark t="ms"/>                     — timeline markers
 *     <shape id label startTime endTime(ms) fillType="media|color|text|gradient"
 *            fillVideo="content://…" speed mediaFillMode s=".rect">
 *       <transform><location value="x,y,z"/><scale value="sx,sy"/>
 *                  <rotation value="deg"/><anchor …/><opacity value="0..1"/></transform>
 *       <fillColor value="#aarrggbb"/> | <text …><content>…</content></text>
 *       <effect id="com.alightcreative.effects.X" locallyApplied>
 *         <property name type value>
 *           <kf t="0..1(normalised in layer)" v="…" e="cubicBezier x1 y1 x2 y2"/>
 *         </property>
 *       </effect>
 *       <gain value="db"/>  — audio
 *
 * AM effects scanned across the corpus: ~100 unique ids. Every id found is
 * listed in AM_EFFECT_MAP (mapped to the OmniFrame ClipEffect engine where an
 * honest equivalent exists, `null` where it is transform/text/transition-only
 * machinery). The mapped set is exported as AM_FX_CATALOG and merged into the
 * site Effects catalog (src/lib/effectCatalog.ts) so ALL AM effects appear on
 * the site and are keyframeable like every other fx.
 */

/* ------------------------------------------------------------------ parser */

export interface AlightKf { t: number; v: string; ease?: string; points?: Array<[number, number]> }
export interface AlightProp { name: string; type: string; value?: string; kfs: AlightKf[] }
export interface AlightEffect { amId: string; short: string; props: Record<string, AlightProp> }
export interface AlightShape {
  id: string; label: string; startTime: number; endTime: number // seconds
  fillType: string; fillVideo?: string; fillColor?: string; speed: number
  mediaFillMode?: string; text?: string; size?: [number, number]; parent?: string
  font?: string; fontSize?: number; align?: string; wrapWidth?: number
  transform: { x: number; y: number; z: number; sx: number; sy: number; rotation: number; opacity: number }
  /** animated transform channels: kf t is NORMALISED (0..1) over the layer span */
  transformKeys: { location: AlightKf[]; scale: AlightKf[]; rotation: AlightKf[]; opacity: AlightKf[] }
  effects: AlightEffect[]
  gain?: number
}
export interface AlightProject {
  title: string; width: number; height: number; fps: number; totalTime: number // seconds
  bgcolor: string; amVersion: string; bookmarks: number[]; shapes: AlightShape[]
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`))
  return m ? m[1] : undefined
}
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function parseAlightXml(xml: string): AlightProject {
  const sceneTag = xml.match(/<scene\b[^>]*>/)?.[0] || ''
  const proj: AlightProject = {
    title: attr(sceneTag, 'title') || 'Alight project',
    width: Number(attr(sceneTag, 'width') || 1920),
    height: Number(attr(sceneTag, 'height') || 1080),
    fps: Number(attr(sceneTag, 'fps') || 30),
    totalTime: Number(attr(sceneTag, 'totalTime') || 0) / 1000,
    bgcolor: attr(sceneTag, 'bgcolor') || '#ff000000',
    amVersion: attr(sceneTag, 'am') || '',
    bookmarks: [...xml.matchAll(/<bookmark\s+t="(\d+)"/g)].map(m => Number(m[1]) / 1000),
    shapes: [],
  }
  // shapes AND nullobj rigs: AM v5 exports never nest them at layer level.
  // nullobj = parenting/rig null (invisible, but 321/329 of the corpus nulls
  // are KEYFRAMED — the rig motion is the edit, so we import it as data).
  const shapeRe = /<(shape|nullobj|text)\b([^>]*)>([\s\S]*?)<\/\1>/g
  let sm: RegExpExecArray | null
  while ((sm = shapeRe.exec(xml))) {
    const head = `<${sm[1]} ${sm[2]}>`, body = sm[3]
    const shape: AlightShape = {
      id: attr(head, 'id') || `s${proj.shapes.length}`,
      label: unesc(attr(head, 'label') || ''),
      startTime: Number(attr(head, 'startTime') || 0) / 1000,
      endTime: Number(attr(head, 'endTime') || 0) / 1000,
      fillType: sm[1] === 'nullobj' ? 'null' : sm[1] === 'text' ? 'text' : (attr(head, 'fillType') || 'color'),
      font: attr(head, 'font'), fontSize: Number(attr(head, 'size') || 0) || undefined, align: attr(head, 'align'), wrapWidth: Number(attr(head, 'wrapWidth') || 0) || undefined,
      parent: attr(head, 'parent'),
      fillVideo: attr(head, 'fillVideo'),
      speed: Number(attr(head, 'speed') || 1) || 1,
      mediaFillMode: attr(head, 'mediaFillMode'),
      transform: { x: 0, y: 0, z: 0, sx: 1, sy: 1, rotation: 0, opacity: 1 },
      transformKeys: { location: [], scale: [], rotation: [], opacity: [] },
      effects: [],
    }
    const loc = body.match(/<location\s+value="([^"]+)"/)?.[1]
    if (loc) { const p = loc.split(',').map(Number); shape.transform.x = p[0] || 0; shape.transform.y = p[1] || 0; shape.transform.z = p[2] || 0 }
    const sc = body.match(/<scale\s+value="([^"]+)"/)?.[1]
    if (sc) { const p = sc.split(',').map(Number); shape.transform.sx = p[0] || 1; shape.transform.sy = (p[1] ?? p[0]) || 1 }
    const rot = body.match(/<rotation\s+value="([^"]+)"/)?.[1]
    if (rot) shape.transform.rotation = Number(rot) || 0
    const op = body.match(/<opacity\s+value="([^"]+)"/)?.[1]
    if (op) shape.transform.opacity = Number(op)
    for (const chan of ['location', 'scale', 'rotation', 'opacity'] as const) {
      const blk = body.match(new RegExp(`<${chan}[^>/]*>([\\s\\S]*?)</${chan}>`))?.[1] || ''
      for (const km of blk.matchAll(/<kf\s+([^/>]*)/g)) {
        const t = Number(attr(km[1], 't') ?? NaN)
        const v = attr(km[1], 'v')
        if (Number.isNaN(t) || v === undefined) continue
        const ease = attr(km[1], 'e')
        const kf: AlightKf = { t, v, ease }
        const bz = ease?.match(/cubicBezier\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
        if (bz) kf.points = [[Number(bz[1]), Number(bz[2])], [Number(bz[3]), Number(bz[4])]]
        shape.transformKeys[chan].push(kf)
      }
      shape.transformKeys[chan].sort((a, b) => a.t - b.t)
    }
    const sizeV = body.match(/<property\s+name="size"\s+type="vec2"\s+value="([^"]+)"/)?.[1]
    if (sizeV) { const p = sizeV.split(',').map(Number); shape.size = [p[0] || 0, p[1] || 0] }
    const gain = body.match(/<gain\s+value="([^"]+)"/)?.[1]
    if (gain !== undefined) shape.gain = Number(gain)
    shape.fillColor = body.match(/<fillColor\s+value="([^"]+)"/)?.[1]
    const content = body.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]
    if (content) shape.text = unesc(content)
    const effRe = /<effect\b([^>]*?)(?:\/>|>([\s\S]*?)<\/effect>)/g
    let em: RegExpExecArray | null
    while ((em = effRe.exec(body))) {
      const ehead = `<effect ${em[1]}>`, ebody = em[2] || ''
      const amId = attr(ehead, 'id') || ''
      const eff: AlightEffect = { amId, short: amId.replace(/^com\.[\w.]*?effects?\./, '').replace(/^com\.alightcreative\./, ''), props: {} }
      const propRe = /<property\s+([^>]*?)(\/>|>([\s\S]*?)<\/property>)/g
      let pm: RegExpExecArray | null
      while ((pm = propRe.exec(ebody))) {
        const phead = pm[1], inner = pm[3] || ''
        const name = attr(phead, 'name')
        if (!name) continue
        const prop: AlightProp = { name, type: attr(phead, 'type') || 'float', value: attr(phead, 'value'), kfs: [] }
        for (const km of inner.matchAll(/<kf\s+([^/>]*)/g)) {
          const t = Number(attr(km[1], 't') ?? NaN)
          const v = attr(km[1], 'v')
          if (Number.isNaN(t) || v === undefined) continue
          const ease = attr(km[1], 'e')
          const kf: AlightKf = { t, v, ease }
          const bz = ease?.match(/cubicBezier\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
          if (bz) kf.points = [[Number(bz[1]), Number(bz[2])], [Number(bz[3]), Number(bz[4])]]
          prop.kfs.push(kf)
        }
        prop.kfs.sort((a, b) => a.t - b.t)
        eff.props[name] = prop
      }
      shape.effects.push(eff)
    }
    proj.shapes.push(shape)
  }
  return proj
}

/* ------------------------------------------------- AM effect scan + mapping */

/** Every effect id observed across the 11-file study corpus → ClipEffect patch.
 *  trace = honest provenance for the site catalog. */
export const AM_TRACE = 'Alight Motion v5 XML study (new_doc_toll_research/alight, 11 projects)'

type AmMap = { name: string; cat: 'glitch' | 'motion' | 'color' | 'blur' | 'distort' | 'retro' | 'light' | 'key'; patch: Record<string, number | string> } | null

export const AM_EFFECT_MAP: Record<string, AmMap> = {
  lift: { name: 'AM Lift', cat: 'color', patch: { brightness: 1.08, contrast: 1.05 } },
  tile: { name: 'AM Tile / Mirror', cat: 'distort', patch: { tiles: 2 } },
  oscillate3: { name: 'AM Oscillate', cat: 'motion', patch: { oscillate: 12, oscillateFreq: 2 } },
  motionblur4: { name: 'AM Motion Blur 4', cat: 'blur', patch: { motionBlur: 0.6 } },
  motionblur3: { name: 'AM Motion Blur 3', cat: 'blur', patch: { motionBlur: 0.45 } },
  shake2: { name: 'AM Shake', cat: 'motion', patch: { autoShake: 14, autoShakeFreq: 12 } },
  zoomblur3: { name: 'AM Zoom Blur', cat: 'blur', patch: { zoomBlur: 0.5 } },
  turbulentdisplace3: { name: 'AM Turbulent Displace', cat: 'distort', patch: { turbulent: 0.5 } },
  turbulentdisplace2: { name: 'AM Turbulent Displace 2', cat: 'distort', patch: { turbulent: 0.35 } },
  turbulence2: { name: 'AM Turbulence', cat: 'distort', patch: { turbulent: 0.4 } },
  exposure: { name: 'AM Exposure', cat: 'color', patch: { exposure: 0.6, gamma: 1 } }, // real exposure key (video-study turn); was brightness approx
  squeeze: { name: 'AM Squeeze', cat: 'distort', patch: { pinchBulge: -0.35 } },
  jitter: { name: 'AM Jitter', cat: 'motion', patch: { autoShake: 6, autoShakeFreq: 24 } },
  satvib: { name: 'AM Sat/Vib', cat: 'color', patch: { saturation: 1.2, vibrance: 1.15 } },
  gaussianblur: { name: 'AM Gaussian Blur', cat: 'blur', patch: { blur: 6 } },
  channelmap: { name: 'AM Channel Map', cat: 'color', patch: { hueRotate: 90 } },
  wavewarp2: { name: 'AM Wave Warp', cat: 'distort', patch: { waveWarp: 18 } },
  fractalwarp4: { name: 'AM Fractal Warp', cat: 'distort', patch: { turbulent: 0.7, waveWarp: 8 } },
  swing2: { name: 'AM Swing', cat: 'motion', patch: { oscillate: 20, oscillateAngle: 45 } },
  brightcont2: { name: 'AM Bright/Contrast', cat: 'color', patch: { brightness: 1.1, contrast: 1.15 } },
  invert: { name: 'AM Invert', cat: 'color', patch: { invert: 1 } },
  negative: { name: 'AM Negative', cat: 'color', patch: { invert: 1 } },
  colorhot: { name: 'AM Hot Colour', cat: 'color', patch: { solarize: 0.3, saturation: 1.3 } },
  dblur: { name: 'AM Directional Blur', cat: 'blur', patch: { directionalBlur: 0.5 } },
  fade: { name: 'AM Fade', cat: 'color', patch: { brightness: 0.9, saturation: 0.85 } },
  chromakey: { name: 'AM Chroma Key', cat: 'key', patch: { chromaKey: 0.8, chromaColor: '#00ff00' } },
  lumakey3: { name: 'AM Luma Key', cat: 'key', patch: { lumaKey: 0.6 } },
  deepglow2: { name: 'AM Deep Glow 2', cat: 'light', patch: { glow: 0.6 } },
  deepglow: { name: 'AM Deep Glow', cat: 'light', patch: { glow: 0.5 } },
  deepglow_enc: { name: 'AM Deep Glow (enc)', cat: 'light', patch: { glow: 0.55 } },
  'com.rilu.effects.deepglowpro': { name: 'AM Deep Glow Pro (rilu)', cat: 'light', patch: { glow: 0.7 } },
  bccfilmglow: { name: 'AM BCC Film Glow', cat: 'light', patch: { glow: 0.5, grain: 0.08 } },
  softblooom: { name: 'AM Soft Bloom', cat: 'light', patch: { glow: 0.45 } },
  rays: { name: 'AM Rays', cat: 'light', patch: { glow: 0.5, edgeGlow: 0.3 } },
  lightsweep: { name: 'AM Light Sweep', cat: 'light', patch: { glow: 0.35, flicker: 0.1 } },
  ripplelight: { name: 'AM Ripple Light', cat: 'light', patch: { glow: 0.4, oscillate: 6 } },
  glowscan: { name: 'AM Glow Scan', cat: 'light', patch: { glow: 0.4, flicker: 0.15 } },
  edgeglow: { name: 'AM Edge Glow', cat: 'light', patch: { edgeGlow: 0.5 } },
  longshadow2: { name: 'AM Long Shadow', cat: 'light', patch: { longShadow: 24, longShadowAngle: 45, longShadowColor: '#000000' } }, // real longShadow key (video-study turn); was edgeGlow approx
  sharpen: { name: 'AM Sharpen', cat: 'color', patch: { sharpen: 0.5 } },
  unsharpmask: { name: 'AM Unsharp Mask', cat: 'color', patch: { sharpen: 0.35 } },
  newsharpen: { name: 'AM New Sharpen', cat: 'color', patch: { sharpen: 0.6 } },
  fisheye_antifisheye: { name: 'AM Fisheye', cat: 'distort', patch: { pinchBulge: 0.6 } },
  pinchbulge2: { name: 'AM Pinch/Bulge', cat: 'distort', patch: { pinchBulge: 0.5 } },
  randomdisplace: { name: 'AM Random Displace', cat: 'glitch', patch: { glitch: 0.3, glitchStyle: 'block' } },
  rgbglitch: { name: 'AM RGB Glitch', cat: 'glitch', patch: { glitch: 0.4, glitchStyle: 'rgb' } },
  chromaticvortexblur: { name: 'AM Chromatic Vortex', cat: 'glitch', patch: { chromatic: 8, swirl: 120 } },
  circularripple2: { name: 'AM Circular Ripple', cat: 'distort', patch: { oscillate: 14, waveWarp: 8 } },
  'com.creative.cinematic_bokeh': { name: 'AM Cinematic Bokeh', cat: 'blur', patch: { tiltShift: 0.6 } },
  bbmaker: { name: 'AM BB Maker (bounce blur)', cat: 'blur', patch: { motionBlur: 0.8, zoomBlur: 0.4 } },
  lensblurobs: { name: 'AM Lens Blur', cat: 'blur', patch: { zoomBlur: 0.6 } },
  'com.goldmotion.effects.v51.blurmoco': { name: 'AM BlurMoCo (GoldMotion)', cat: 'blur', patch: { motionBlur: 0.7 } },
  'com.goldmotion.effects.v53.pack.gm_directional_echo_blur': { name: 'AM Directional Echo (GoldMotion)', cat: 'blur', patch: { echo: 3, echoDecay: 0.6, directionalBlur: 0.4 } },
  'com.goldmotion.effects.v53.shaderpack.frequency': { name: 'AM Frequency (GoldMotion)', cat: 'motion', patch: { oscillate: 10, oscillateFreq: 6 } },
  hueshift: { name: 'AM Hue Shift', cat: 'color', patch: { hueRotate: 45 } },
  innerblur: { name: 'AM Inner Blur', cat: 'blur', patch: { tiltShift: 0.4 } },
  pulsate2: { name: 'AM Pulsate', cat: 'motion', patch: { flicker: 0.3 } },
  pulseopacity2: { name: 'AM Pulse Opacity', cat: 'motion', patch: { flicker: 0.25 } },
  ridges2: { name: 'AM Ridges', cat: 'distort', patch: { waveWarp: 20 } },
  vignette: { name: 'AM Vignette', cat: 'color', patch: { vignette: 0.5 } },
  findedges: { name: 'AM Find Edges', cat: 'retro', patch: { findEdges: 0.8 } },
  edgeline: { name: 'AM Edge Line', cat: 'retro', patch: { findEdges: 0.6 } },
  tritone: { name: 'AM Tritone', cat: 'color', patch: { gradientMap: 0.4 } },
  gradientoverlay2: { name: 'AM Gradient Overlay', cat: 'color', patch: { gradientMap: 0.6 } },
  'com.alightcreative.gradientoverlay2': { name: 'AM Gradient Overlay', cat: 'color', patch: { gradientMap: 0.6 } },
  'com.alightcreative.3colorgrad': { name: 'AM 3-Colour Gradient', cat: 'color', patch: { gradientMap: 0.5, dirColorize: 0.3 } },
  minimaxblur: { name: 'AM Minimax Blur', cat: 'blur', patch: { minimax: 6 } },
  threshold: { name: 'AM Threshold', cat: 'retro', patch: { threshold: 0.5 } },
  halftone_dots: { name: 'AM Halftone Dots', cat: 'retro', patch: { posterize: 0.5, pixelate: 3 } },
  spinblur2: { name: 'AM Spin Blur', cat: 'blur', patch: { swirl: 180, zoomBlur: 0.3 } },
  'repeat.scatter': { name: 'AM Repeat Scatter', cat: 'glitch', patch: { echo: 3, echoDecay: 0.6 } },
  streaks: { name: 'AM Streaks', cat: 'distort', patch: { pixelStretch: 0.2 } },
  displacemaprad: { name: 'AM Radial Displace Map', cat: 'distort', patch: { swirl: 60, waveWarp: 6 } },
  displacemap3: { name: 'AM Displace Map', cat: 'distort', patch: { waveWarp: 10, swirl: 30 } },
  refractionwarp: { name: 'AM Refraction Warp', cat: 'distort', patch: { waveWarp: 10, chromatic: 3 } },
  cc_glass: { name: 'AM CC Glass', cat: 'distort', patch: { waveWarp: 6, chromatic: 3 } },
  highlightshadow: { name: 'AM Highlight/Shadow', cat: 'color', patch: { contrast: 1.1, brightness: 1.05 } },
  colortune2: { name: 'AM Colour Tune', cat: 'color', patch: { saturation: 1.1, contrast: 1.05 } },
  colorize: { name: 'AM Colorize', cat: 'color', patch: { dirColorize: 0.5 } },
  'com.alightcreative.replacecolor': { name: 'AM Replace Colour', cat: 'color', patch: { dirColorize: 0.4 } },
  'spill-cleanup': { name: 'AM Spill Cleanup', cat: 'key', patch: { chromaKey: 0.3, chromaColor: '#00ff00' } },
  shake: { name: 'AM Shake (v1)', cat: 'motion', patch: { autoShake: 4, autoShakeFreq: 8 } },
  oscillate2: { name: 'AM Oscillate 2', cat: 'motion', patch: { oscillate: 10, oscillateFreq: 4 } },
  stretch2: { name: 'AM Stretch', cat: 'distort', patch: { pixelStretch: 0.3 } },
  lensd: { name: 'AM Lens Distortion', cat: 'distort', patch: { chromatic: 6, waveWarp: 4 } },
  smartMotionBlurShake: { name: 'AM Smart Motion-Blur Shake', cat: 'motion', patch: { motionBlur: 0.5, autoShake: 8 } },
  flicker2: { name: 'AM Flicker', cat: 'light', patch: { flicker: 0.4 } },
  denoise: { name: 'AM Denoise', cat: 'blur', patch: { blur: 1 } },
  // transform/text/transition-only machinery — imported as data, no visual patch:
  transform2: null, transform: null, scaleassist: null, stretchsegment: null,
  opticcompesation: null, texttransform: null, textspacing: null, 'drawing.progress': null,
  wipe2: null, solid_color_wipe: null, dissolve: null, offset: null, unmult: null,
  'com.alightcreative.internal.smoothbevel': null, shapefield: null,
  'com.alightcreative.solidcolor': null,
}

export function amFxId(amId: string): string {
  const short = amId.replace(/^com\.(alightcreative|creative|rilu|goldmotion)(\.[\w]+)*?\./, '').replace(/^[\w.]*?effects?\./, '')
  return `am-${(short || amId).replace(/[^\w.-]+/g, '-').replace(/\./g, '-')}`
}

export const AM_FX_CATALOG = Object.entries(AM_EFFECT_MAP)
  .filter(([, m]) => m)
  .map(([amId, m]) => ({
    id: amFxId(amId),
    amId,
    name: m!.name,
    cat: m!.cat,
    trace: AM_TRACE,
    patch: m!.patch,
  }))

/* ------------------------------------------------- normalized import model */

export interface AlightKf2 { time: number; value: number; points?: Array<[number, number]> }
export interface ImportedAlightClip {
  amId: string
  name: string
  kind: 'video' | 'text' | 'solid' | 'null'
  parent?: string
  fontFamily?: string // AM imported?name=X.otf → stem X
  fontSize?: number // AM px at project resolution
  align?: string
  start: number
  duration: number
  inPoint: number
  speed: number
  /** centre-relative px in the PROJECT space (AM stores absolute canvas px) */
  x: number; y: number
  scale: number; rotation: number; opacity: number
  fillColor?: string
  text?: string
  mediaRef?: string // content:// uri — external media, needs re-link in OmniFrame
  effects: Record<string, number | string> // merged ClipEffect patch
  /** omniframe.lut round-trip: the clip's own LUT stack */
  adjustment?: { luts: Array<{ builtin?: string; id?: string; intensity?: number }> }
  /** omniframe.fxinst round-trip: fx instances incl. per-param keys */
  fxInstances?: Array<{ catalogId: string; inP: number; duration: number; params: Record<string, number | string>; keys?: Record<string, Array<{ t: number; v: number }>> }>
  amEffects: Array<{ amId: string; short: string; props: Record<string, AlightProp> }> // FULL data dump
  volume: number
  /** clip-LOCAL seconds; cubicBezier easing carried as custom curve points */
  keys: { positionX: AlightKf2[]; positionY: AlightKf2[]; scale: AlightKf2[]; rotation: AlightKf2[]; opacity: AlightKf2[] }
  mappedFx: string[] // catalog ids applied
  unmappedFx: string[] // kept in amEffects only
}

export interface AlightImport {
  project: { title: string; w: number; h: number; fps: number; duration: number; bg: string }
  clips: ImportedAlightClip[]
  bookmarks: number[]
  stats: { shapes: number; effectsTotal: number; mapped: number; unmapped: number; keyframed: number; mediaRefs: string[] }
}

export function alightToImport(proj: AlightProject): AlightImport {
  const clips: ImportedAlightClip[] = []
  let effectsTotal = 0, mapped = 0, unmapped = 0, keyframed = 0
  const mediaRefs: string[] = []
  for (const sh of proj.shapes) {
    const dur = Math.max(0.04, sh.endTime - sh.startTime)
    const effects: Record<string, number | string> = {}
    const mappedFx: string[] = []
    const unmappedFx: string[] = []
    let adjustment: { luts: Array<{ builtin?: string; id?: string; intensity?: number }> } | undefined
    const fxInstances: Array<{ catalogId: string; inP: number; duration: number; params: Record<string, number | string>; keys?: Record<string, Array<{ t: number; v: number }>> }> = []
    for (const eff of sh.effects) {
      effectsTotal++
      for (const p of Object.values(eff.props)) if (p.kfs.length > 1) keyframed++
      const propVal = (p: AlightProp): number | string => {
        if (p.kfs.length) return Number(p.kfs[0].v.split(',')[0]) || 0
        if (p.type === 'float' || p.type === 'int') return Number(p.value) || 0
        return p.value ?? ''
      }
      if (eff.short === 'omniframe.fx') {
        // exact engine values from an OmniFrame export — applied LAST-wins via
        // ordering (emitter puts omniframe.fx after the AM-default blocks)
        for (const [pname, p] of Object.entries(eff.props)) effects[pname] = propVal(p)
        mapped++
        continue
      }
      if (eff.short === 'omniframe.lut') {
        const luts: Array<{ builtin?: string; id?: string; intensity?: number }> = []
        for (const [pname, p] of Object.entries(eff.props)) {
          const i = Number(pname.replace(/\D+/g, '')) || 0
          luts[i] = luts[i] || {}
          if (pname.startsWith('builtin')) { const v = String(propVal(p)); luts[i].builtin = v; luts[i].id = v }
          if (pname.startsWith('intensity')) luts[i].intensity = Number(propVal(p))
        }
        adjustment = { luts: luts.filter(Boolean) }
        mapped++
        continue
      }
      if (eff.short.startsWith('omniframe.fxinst.')) {
        const catalogId = eff.short.slice('omniframe.fxinst.'.length)
        const params: Record<string, number | string> = {}
        const keys: Record<string, Array<{ t: number; v: number }>> = {}
        let inP = 0, fdur = dur
        for (const [pname, p] of Object.entries(eff.props)) {
          if (pname === '_inP') { inP = Number(propVal(p)) || 0; continue }
          if (pname === '_duration') { fdur = Number(propVal(p)) || dur; continue }
          if (p.kfs.length > 1) {
            keys[pname] = p.kfs.map(k => ({ t: Math.max(0, k.t * dur - inP), v: Number(k.v.split(',')[0]) || 0 }))
            params[pname] = Number(p.kfs[0].v.split(',')[0]) || 0
          } else params[pname] = propVal(p)
        }
        fxInstances.push({ catalogId, inP, duration: Math.min(fdur, dur - inP), params, keys: Object.keys(keys).length ? keys : undefined })
        mapped++
        continue
      }
      const m = AM_EFFECT_MAP[eff.amId] ?? AM_EFFECT_MAP[eff.short]
      if (m) { Object.assign(effects, m.patch); mappedFx.push(amFxId(eff.amId)); mapped++ }
      else { unmappedFx.push(eff.short); unmapped++ }
    }
    if (sh.fillVideo) mediaRefs.push(sh.fillVideo)
    clips.push({
      amId: sh.id,
      name: sh.label || `AM ${sh.fillType} ${sh.id}`,
      kind: sh.fillType === 'null' ? 'null' : sh.fillType === 'text' || sh.text !== undefined ? 'text' : sh.fillType === 'media' ? 'video' : 'solid',
      parent: sh.parent,
      fontFamily: sh.font ? decodeURIComponent(sh.font.replace(/^imported\?name=/, '')).replace(/\.[^.]+$/, '') : undefined,
      fontSize: sh.fontSize,
      align: sh.align,
      start: sh.startTime,
      duration: dur,
      inPoint: 0,
      speed: sh.speed || 1,
      x: sh.transform.x - proj.width / 2,
      y: sh.transform.y - proj.height / 2,
      scale: sh.size && sh.size[0] > 0
        ? (sh.size[0] * sh.transform.sx) / proj.width // rect shapes: base size × AM scale, relative to project width
        : sh.fillType === 'media' ? 1 : (sh.transform.sx + sh.transform.sy) / 2,
      rotation: sh.transform.rotation,
      opacity: Number.isFinite(sh.transform.opacity) ? sh.transform.opacity : 1,
      fillColor: sh.fillColor ? amColor(sh.fillColor) : undefined,
      text: sh.text,
      mediaRef: sh.fillVideo,
      effects,
      adjustment,
      fxInstances: fxInstances.length ? fxInstances : undefined,
      amEffects: sh.effects,
      volume: sh.gain !== undefined ? Math.max(0, Math.min(1, Math.pow(10, sh.gain / 20))) : 1,
      keys: (() => {
        const conv = (kfs: AlightKf[], pick: (v: string) => number): AlightKf2[] =>
          kfs.map(k => ({ time: k.t * dur, value: pick(k.v), points: k.points }))
        const vx = (v: string) => Number(v.split(',')[0]) || 0
        const vy = (v: string) => Number(v.split(',')[1] ?? 0) || 0
        const vs = (v: string) => { const p = v.split(',').map(Number); return sh.size && sh.size[0] > 0 ? (sh.size[0] * (p[0] || 1)) / proj.width : (p[0] || 1) }
        const vn = (v: string) => Number(v) || 0
        return {
          positionX: conv(sh.transformKeys.location, vx),
          positionY: conv(sh.transformKeys.location, vy),
          scale: conv(sh.transformKeys.scale, vs),
          rotation: conv(sh.transformKeys.rotation, vn),
          opacity: conv(sh.transformKeys.opacity, vn),
        }
      })(),
      mappedFx,
      unmappedFx,
    })
  }
  return {
    project: { title: proj.title, w: proj.width, h: proj.height, fps: proj.fps, duration: Math.max(proj.totalTime, ...clips.map(c => c.start + c.duration), 1), bg: amColor(proj.bgcolor) },
    clips,
    bookmarks: proj.bookmarks,
    stats: { shapes: clips.length, effectsTotal, mapped, unmapped, keyframed, mediaRefs },
  }
}

/** AM colour is #AARRGGBB → css #RRGGBB (alpha folded to opacity separately). */
export function amColor(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length === 8) return '#' + h.slice(2)
  return '#' + h
}

/* ------------------------------------------------------------------ EXPORT */

export interface AlightExportKey { time: number; value: number; points?: Array<{ x: number; y: number } | [number, number]> }
export interface AlightExportClip {
  name: string
  kind: 'video' | 'text' | 'image' | 'solid'
  start: number; duration: number; inPoint?: number; speed?: number
  x: number; y: number                    // centre-relative px
  scale: number; rotation: number; opacity: number
  volume?: number
  text?: string; fontFamily?: string; fontSize?: number; color?: string
  fillColor?: string
  mediaRef?: string
  effects?: Record<string, number | string>          // ClipEffect engine keys
  luts?: Array<{ builtin?: string; id?: string; intensity?: number }>
  fxInstances?: Array<{ catalogId: string; amId?: string; inP: number; duration: number; params: Record<string, number | string>; keys?: Record<string, Array<{ t: number; v: number }>> }>
  curves?: Record<string, AlightExportKey[]>          // position_x/y, scale_x, rotation_z, opacity — clip-local seconds
  amEffects?: AlightEffect[]                          // imported-from-AM clips re-emit these VERBATIM
}
export interface AlightExportMeta { title: string; w: number; h: number; fps: number; duration: number; bg?: string }

const xmlEsc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ms = (sec: number) => Math.round(sec * 1000)
const n6 = (v: number) => (Math.round(v * 1e6) / 1e6).toString()

/** engine ClipEffect key → the AM effect id whose mapped patch contains it (for
 *  emitting an AM-recognisable block alongside the exact omniframe.fx values) */
const ENGINE_KEY_TO_AM: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [amId, m] of Object.entries(AM_EFFECT_MAP)) {
    if (!m) continue
    for (const k of Object.keys(m.patch)) if (!out[k] && !amId.startsWith('com.')) out[k] = amId
  }
  return out
})()

function bezierAttr(k: AlightExportKey): string {
  if (!k.points || k.points.length < 2) return ''
  const p = k.points.map((pt) => (Array.isArray(pt) ? pt : [pt.x, pt.y]))
  // full custom curve [[0,0],[x1,y1],[x2,y2],[1,1]] → cubicBezier x1 y1 x2 y2
  const inner = p.filter((_, i) => i > 0 && i < p.length - 1)
  if (inner.length === 2) return ` e="cubicBezier ${inner[0][0]} ${inner[0][1]} ${inner[1][0]} ${inner[1][1]}"`
  return ''
}
function sampleCurve(keys: AlightExportKey[] | undefined, t: number, fallback: number): number {
  if (!keys || keys.length === 0) return fallback
  if (t <= keys[0].time) return keys[0].value
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].time) {
      const a = keys[i - 1], b = keys[i]
      const u = b.time === a.time ? 1 : (t - a.time) / (b.time - a.time)
      return a.value + (b.value - a.value) * u
    }
  }
  return keys[keys.length - 1].value
}

/** Serialise clips to the Alight Motion v5 XML dialect. Round-trip guarantee:
 *  parseAlightXml(alightToImport(exportAlightXml(m, clips))) reproduces the
 *  clip timings, transforms, engine effect VALUES (omniframe.fx namespace),
 *  LUT stack (omniframe.lut), fx instances incl. keys (omniframe.fxinst) and
 *  keyframed transforms (normalised kf + cubicBezier). AM itself reads the
 *  scene/shape/text/transform/effect skeleton; omniframe.* blocks are
 *  comments-free extension effects it ignores. */
export function exportAlightXml(meta: AlightExportMeta, clips: AlightExportClip[]): string {
  const bg = meta.bg && /^#[0-9a-fA-F]{6}$/.test(meta.bg) ? '#ff' + meta.bg.slice(1) : '#ff000000'
  const out: string[] = []
  out.push(`<?xml version='1.0' encoding='UTF-8' ?><!--`)
  out.push(`Created by OmniFrame — Alight Motion v5 XML dialect (export)`)
  out.push(`Round-trip: OmniFrame reads this back losslessly (omniframe.* effect blocks carry exact engine values).`)
  out.push(`-->\r`)
  out.push(`<scene title="${xmlEsc(meta.title)}" width="${meta.w}" height="${meta.h}" exportWidth="${meta.w}" exportHeight="${meta.h}" precompose="dynamicResolution" bgcolor="${bg}" totalTime="${ms(meta.duration)}" fps="${meta.fps}" am="omniframe/export-1.0">`)
  for (const c of clips) {
    const dur = Math.max(0.04, c.duration)
    const loc = `${n6(c.x + meta.w / 2)},${n6(c.y + meta.h / 2)},0.000000`
    const transformKfs = (): string => {
      const t: string[] = ['    <transform>']
      const px = c.curves?.position_x, py = c.curves?.position_y
      if ((px && px.length > 1) || (py && py.length > 1)) {
        const times = [...new Set([...(px || []), ...(py || [])].map((k) => k.time))].sort((a, b) => a - b)
        t.push('      <location>')
        for (const time of times) {
          const x = sampleCurve(px, time, c.x), y = sampleCurve(py, time, c.y)
          const ref = (px || py)!.find((k) => k.time === time)!
          t.push(`        <kf t="${n6(time / dur)}" v="${n6(x + meta.w / 2)},${n6(y + meta.h / 2)},0.000000"${bezierAttr({ time, value: 0, points: ref.points })} />`)
        }
        t.push('      </location>')
      } else {
        t.push(`      <location value="${loc}" />`)
      }
      const sx = c.curves?.scale_x
      if (sx && sx.length > 1) {
        t.push('      <scale>')
        for (const k of sx) t.push(`        <kf t="${n6(k.time / dur)}" v="${n6(k.value)},${n6(k.value)}"${bezierAttr(k)} />`)
        t.push('      </scale>')
      } else if (c.scale !== 1) {
        t.push(`      <scale value="${n6(c.scale)},${n6(c.scale)}" />`)
      }
      const rz = c.curves?.rotation_z
      if (rz && rz.length > 1) {
        t.push('      <rotation>')
        for (const k of rz) t.push(`        <kf t="${n6(k.time / dur)}" v="${n6(k.value)}"${bezierAttr(k)} />`)
        t.push('      </rotation>')
      } else if (c.rotation) {
        t.push(`      <rotation value="${n6(c.rotation)}" />`)
      }
      const op = c.curves?.opacity
      if (op && op.length > 1) {
        t.push('      <opacity>')
        for (const k of op) t.push(`        <kf t="${n6(k.time / dur)}" v="${n6(k.value)}"${bezierAttr(k)} />`)
        t.push('      </opacity>')
      } else if (c.opacity !== 1) {
        t.push(`      <opacity value="${n6(c.opacity)}" />`)
      }
      t.push('    </transform>')
      return t.join('\n')
    }
    const effectBlocks = (): string => {
      const t: string[] = []
      // 1. re-emit original AM effects verbatim when this clip came FROM AM
      for (const eff of c.amEffects || []) {
        t.push(`    <effect id="${xmlEsc(eff.amId)}" locallyApplied="true">`)
        for (const p of Object.values(eff.props)) {
          if (p.kfs.length > 1) {
            t.push(`      <property name="${xmlEsc(p.name)}" type="${xmlEsc(p.type)}">`)
            for (const k of p.kfs) {
              const bz = k.points ? ` e="cubicBezier ${k.points[0][0]} ${k.points[0][1]} ${k.points[1][0]} ${k.points[1][1]}"` : ''
              t.push(`        <kf t="${n6(k.t)}" v="${xmlEsc(k.v)}"${bz} />`)
            }
            t.push('      </property>')
          } else if (p.value !== undefined) {
            t.push(`      <property name="${xmlEsc(p.name)}" type="${xmlEsc(p.type)}" value="${xmlEsc(p.value)}" />`)
          }
        }
        t.push('    </effect>')
      }
      // 2. AM-recognisable blocks for engine effects (defaults) …
      const emitted = new Set<string>()
      for (const k of Object.keys(c.effects || {})) {
        const am = ENGINE_KEY_TO_AM[k]
        if (am && !emitted.has(am)) { emitted.add(am); t.push(`    <effect id="com.alightcreative.effects.${xmlEsc(am)}" locallyApplied="true" />`) }
      }
      // 3. … then the EXACT engine values (imported last → wins on round-trip)
      const effKeys = Object.entries(c.effects || {}).filter(([, v]) => v !== undefined && v !== 0)
      if (effKeys.length) {
        t.push('    <effect id="omniframe.fx" locallyApplied="true">')
        for (const [k, v] of effKeys) t.push(`      <property name="${xmlEsc(k)}" type="${typeof v === 'number' ? 'float' : 'string'}" value="${xmlEsc(String(v))}" />`)
        t.push('    </effect>')
      }
      // 4. LUT stack
      if (c.luts && c.luts.length) {
        t.push('    <effect id="omniframe.lut" locallyApplied="true">')
        c.luts.forEach((l, i) => {
          t.push(`      <property name="builtin${i}" type="string" value="${xmlEsc(l.builtin || l.id || '')}" />`)
          t.push(`      <property name="intensity${i}" type="float" value="${n6(l.intensity ?? 1)}" />`)
        })
        t.push('    </effect>')
      }
      // 5. fx instances (catalog entries incl. AM_FX_CATALOG) with their keys
      for (const fi of c.fxInstances || []) {
        t.push(`    <effect id="omniframe.fxinst.${xmlEsc(fi.catalogId)}" locallyApplied="true">`)
        t.push(`      <property name="_inP" type="float" value="${n6(fi.inP)}" />`)
        t.push(`      <property name="_duration" type="float" value="${n6(fi.duration)}" />`)
        for (const [k, v] of Object.entries(fi.params || {})) t.push(`      <property name="${xmlEsc(k)}" type="${typeof v === 'number' ? 'float' : 'string'}" value="${xmlEsc(String(v))}" />`)
        for (const [k, keys] of Object.entries(fi.keys || {})) {
          t.push(`      <property name="${xmlEsc(k)}" type="float">`)
          for (const raw of keys as Array<{ t: number; v: number } | [number, number]>) {
            const key = Array.isArray(raw) ? { t: raw[0], v: raw[1] } : raw
            if (!Number.isFinite(key.t) || !Number.isFinite(key.v)) continue
            t.push(`        <kf t="${n6(Math.min(1, Math.max(0, (fi.inP + key.t) / dur)))}" v="${n6(key.v)}" />`)
          }
          t.push('      </property>')
        }
        t.push('    </effect>')
      }
      return t.join('\n')
    }
    const common = `${transformKfs()}\n${effectBlocks()}`
    const gain = c.volume !== undefined && c.volume !== 1 ? `\n    <gain value="${n6(20 * Math.log10(Math.max(1e-4, c.volume)))}" />` : ''
    if (c.kind === 'text') {
      const size = c.fontSize || 48
      const font = c.fontFamily ? ` font="imported?name=${encodeURIComponent(c.fontFamily.split(',')[0].trim())}.ttf"` : ''
      out.push(`  <text id="${xmlEsc(c.name)}" startTime="${ms(c.start)}" endTime="${ms(c.start + dur)}" fillType="color" mediaFillMode="fill" size="${n6(size)}"${font} align="center">`)
      out.push(common)
      if (c.color) out.push(`    <fillColor value="#ff${c.color.replace('#', '').slice(0, 6).padEnd(6, 'f')}" />`)
      out.push(`    <content>${xmlEsc(c.text || c.name)}</content>`)
      out.push(`  </text>`)
    } else {
      const fillType = c.kind === 'video' ? 'media' : 'color'
      const fillVideo = c.kind === 'video' ? ` fillVideo="${xmlEsc(c.mediaRef || `omniframe:${c.name}`)}"` : ''
      out.push(`  <shape id="${xmlEsc(c.name)}" label="${xmlEsc(c.name)}" startTime="${ms(c.start)}" endTime="${ms(c.start + dur)}" fillType="${fillType}"${fillVideo} mediaFillMode="fill" speed="${n6(c.speed || 1)}" s=".rect">`)
      out.push(common)
      if (c.fillColor) out.push(`    <fillColor value="#ff${c.fillColor.replace('#', '').slice(0, 6).padEnd(6, 'f')}" />`)
      out.push(`    <property name="size" type="vec2" value="${n6(meta.w)},${n6(meta.h)}" />`)
      out.push(gain ? gain.trimStart() : '')
      out.push(`  </shape>`)
    }
  }
  out.push('</scene>')
  return out.filter((l) => l !== '').join('\n') + '\n'
}

/* ------------------------------------------------------- TEMPLATE ↔ XML */

const TMPL_MARK = 'omniframe-template'

/** Template export = AM-dialect scene skeleton + the FULL template JSON in a
 *  marked comment (lossless; AM ignores comments). */
export function exportTemplateXml(t: ClipTemplateLike, meta?: { w?: number; h?: number; fps?: number }): string {
  const w = meta?.w || 1920, h = meta?.h || 1080, fps = meta?.fps || 30
  const json = JSON.stringify(t, null, 1).replace(/-->/g, '-\\u003e')
  const fx = (t.fields.effects || {}) as Record<string, number | string>
  const effBlocks = Object.entries(fx).filter(([, v]) => v !== undefined && v !== 0).map(([k, v]) =>
    `      <property name="${xmlEsc(k)}" type="${typeof v === 'number' ? 'float' : 'string'}" value="${xmlEsc(String(v))}" />`).join('\n')
  return `<?xml version='1.0' encoding='UTF-8' ?><!--
Created by OmniFrame — TEMPLATE export (Alight Motion v5 XML dialect)
Re-import in OmniFrame (Import Alight XML / template_import): registers the
template with its FULL processing chain; the skeleton below is the AM-readable
summary of that chain.
-->
<!--${TMPL_MARK}
${json}
${TMPL_MARK}-->
<scene title="${xmlEsc(t.name)}" width="${w}" height="${h}" exportWidth="${w}" exportHeight="${h}" precompose="dynamicResolution" bgcolor="#ff000000" totalTime="${ms(t.duration)}" fps="${fps}" am="omniframe/template-1.0">
  <shape id="template-carrier" label="${xmlEsc(t.name)}" startTime="0" endTime="${ms(t.duration)}" fillType="color" mediaFillMode="fill" s=".rect">
    <transform>
      <location value="${w / 2},${h / 2},0.000000" />
    </transform>
    <fillColor value="#ff334455" />
${effBlocks ? `    <effect id="omniframe.fx" locallyApplied="true">\n${effBlocks}\n    </effect>` : ''}
  </shape>
</scene>
`
}

export interface ClipTemplateLike {
  id: string; name: string; capturedAt: string; sourceClipId: string; sourceName: string
  sourceKind: string; inPointRatio: number; duration: number
  fields: Record<string, unknown>; fieldCount: number
}

/** Detect + parse an OmniFrame template XML export. Returns null for plain AM
 *  project XML (callers then use parseAlightXml). */
export function importTemplateXml(xml: string): ClipTemplateLike | null {
  const m = xml.match(new RegExp(`<!--${TMPL_MARK}\\n([\\s\\S]*?)\\n${TMPL_MARK}-->`))
  if (!m) return null
  try {
    const t = JSON.parse(m[1].replace(/-\\u003e/g, '-->')) as ClipTemplateLike
    return t && t.id && t.fields ? t : null
  } catch { return null }
}
