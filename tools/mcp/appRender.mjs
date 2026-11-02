import { blendAt } from '../../src/lib/blendModes.ts'
import { effectMaskRegions } from '../../src/lib/effectMask.ts'
// Headless renderer that speaks the APP's semantics, not the agent's style:
// transforms come from CurveEngine.evaluateClipAnimation (the app's own key
// evaluation), masks are ClipVisualMask shape mattes (centerX/Y, width/height,
// feather, inverted — same fields playback.ts applies), effects use ClipEffect
// fields (pixelate/chromaKey + the new fractalBlur/lumaKey/cardFlip), blends use
// clip.blendMode. The agent never draws answers by hand; recipes drive this.
import fs from 'fs'
import path from 'path'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { transform } from 'sucrase'
import { makeCanvas, CanvasImage } from './core.mjs'
import { PNG } from 'pngjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const _mods = new Map()
export async function loadAppTs(rel) {
  if (_mods.has(rel)) return _mods.get(rel)
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const { code } = transform(src, { transforms: ['typescript'] })
  const dir = mkdtempSync(join(tmpdir(), 'appmod-'))
  const f = join(dir, 'mod.mjs')
  writeFileSync(f, code.replace(/from '(\.\.?\/[^']+)'/g, (m, p) => `from './${path.basename(p)}.mjs'`))
  // ship the transitive closure of relative .ts deps, flattened next to mod.mjs
  // (types-only imports vanish in sucrase; the zustand store gets a stub since
  // react/zustand cannot resolve from tmpdir — preset builds only need the symbol).
  const STORE_STUB = "export const useEditor = { getState: () => ({ clips: [], sequences: [], breadcrumbs: [], activeSequenceId: 'main', set: () => {} }) }\n"
  const seen = new Set()
  const queue = [[path.dirname(path.join(ROOT, rel)), code]]
  while (queue.length) {
    const [baseDir, src] = queue.shift()
    for (const m of src.matchAll(/from '(\.\.?\/[^']+)'/g)) {
      const name = path.basename(m[1])
      if (seen.has(name)) continue
      seen.add(name)
      if (name === 'store') { writeFileSync(join(dir, 'store.mjs'), STORE_STUB); continue }
      const depTs = path.resolve(baseDir, m[1]) + '.ts'
      if (fs.existsSync(depTs)) {
        const raw = transform(fs.readFileSync(depTs, 'utf8'), { transforms: ['typescript'] }).code
        const d = raw.replace(/from '(\.\.?\/[^']+)'/g, (mm, pp) => `from './${path.basename(pp)}.mjs'`)
        writeFileSync(join(dir, name + '.mjs'), d)
        queue.push([path.dirname(depTs), raw])
      }
    }
  }
  const mod = await import(f)
  _mods.set(rel, mod)
  return mod
}

/* ---------- LUT pack parity: real .cube 3D LUTs, trilinear (same packs playback.ts grades with) ---------- */
const _lutCache = new Map()
function loadCubeLut(lut) {
  const key = lut.builtin || lut.id
  if (_lutCache.has(key)) return _lutCache.get(key)
  let text = lut.cubeText
  if (!text && lut.builtin) {
    const f = path.join(ROOT, 'public', 'luts', lut.builtin + '.cube')
    if (fs.existsSync(f)) text = fs.readFileSync(f, 'utf8')
  }
  let rec = null
  if (text) {
    const vals = []
    let n = 0
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim()
      if (!l || l.startsWith('#')) continue
      if (l.startsWith('LUT_3D_SIZE')) { n = parseInt(l.split(/\s+/)[1], 10); continue }
      if (!/^[-0-9.eE+ ]+$/.test(l)) continue
      const p = l.split(/\s+/).map(Number)
      if (p.length >= 3) vals.push(p[0], p[1], p[2])
    }
    if (n && vals.length >= n * n * n * 3) rec = { n, data: new Float32Array(vals) }
  }
  _lutCache.set(key, rec)
  return rec
}
export function applyClipLutsK(sx, w, h, luts) {
  for (const lut of luts || []) {
    if (lut.enabled === false) continue
    const inten = lut.intensity ?? 1
    if (inten <= 0) continue
    const rec = loadCubeLut(lut)
    if (!rec) continue
    const { n, data } = rec
    const m = n - 1
    // napi-rs getImageData/createImageData leak native memory with NO finalizer
    // (measured: ~4 MB/frame unreclaimable even under global.gc), so the
    // headless LUT grade round-trips through PNG instead: toBuffer('image/png')
    // and pngjs decode/encode are both fully GC-managed.
    const dec = PNG.sync.read(sx.canvas.toBuffer('image/png'))
    const d = dec.data
    for (let i = 0; i < d.length; i += 4) {
      const r = (d[i] / 255) * m, g = (d[i + 1] / 255) * m, b = (d[i + 2] / 255) * m
      const r0 = Math.min(m, r | 0), g0 = Math.min(m, g | 0), b0 = Math.min(m, b | 0)
      const r1 = Math.min(m, r0 + 1), g1 = Math.min(m, g0 + 1), b1 = Math.min(m, b0 + 1)
      const fr = r - r0, fg = g - g0, fb = b - b0
      for (let ch = 0; ch < 3; ch++) {
        // our .cube packs are blue-fastest (first lattice component = blue)
        const idx = (rr, gg, bb) => ((rr * n + gg) * n + bb) * 3 + ch
        const v = (data[idx(r0, g0, b0)] * (1 - fr) + data[idx(r1, g0, b0)] * fr) * (1 - fg) * (1 - fb)
          + (data[idx(r0, g1, b0)] * (1 - fr) + data[idx(r1, g1, b0)] * fr) * fg * (1 - fb)
          + (data[idx(r0, g0, b1)] * (1 - fr) + data[idx(r1, g0, b1)] * fr) * (1 - fg) * fb
          + (data[idx(r0, g1, b1)] * (1 - fr) + data[idx(r1, g1, b1)] * fr) * fg * fb
        const cl = Math.max(0, Math.min(1, v)) * 255
        d[i + ch] += (cl - d[i + ch]) * inten
      }
    }
    const enc = PNG.sync.write(Object.assign(dec, { width: w, height: h }))
    const back = new CanvasImage()
    back.src = enc
    sx.save()
    sx.globalCompositeOperation = 'copy'
    sx.drawImage(back, 0, 0)
    sx.restore()
  }
}

export const CE = await loadAppTs('src/lib/animation/CurveEngine.ts')
export const PG = await loadAppTs('src/lib/pixelGrade.ts')
const NG = await loadAppTs('src/lib/glitchNG.ts')
export const DE = await loadAppTs('src/lib/drawingEngine.ts')
// Paint-canvas parity hook: playback.ts composites paint layers via
// renderAllPaintLayers; the headless renderer must do the same or data_dump
// previews silently drop every drawn stroke.
let paintGetter = null
export function setPaintGetter(fn) { paintGetter = fn }
export const PFX = await loadAppTs('src/lib/proceduralFx.ts')
export const FXI = await loadAppTs('src/lib/fxInstances.ts')
export const PRT = await loadAppTs('src/lib/particleFx.ts')

const DF = await loadAppTs('src/lib/deformation.ts')
const SC = await loadAppTs('src/lib/speedCurves.ts')
export class Sequence {
  constructor({ w = 640, h = 360, fps = 24, duration = 2, bg = '#0d0f13' } = {}) {
    this.w = w; this.h = h; this.fps = fps; this.duration = duration; this.bg = bg
    this.clips = []
    this.tracks = [{ id: 0, name: 'track 1' }]
    this.mode = 'omniframe'
  }
  addClip(clip) { this.clips.push(clip); return clip }
  hitTest(x, y, t = 0) {
    for (let i = this.clips.length - 1; i >= 0; i--) {
      const r = this.clipRect(this.clips[i], t)
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { clip: this.clips[i], rect: r }
    }
    return null
  }
  clipRect(clip, t) {
    const ev = CE.evaluateClipAnimation(clip, t)
    const w = clip.natW * ev.scaleX
    const h = clip.natH * ev.scaleY
    const cx = this.w / 2 + ev.x
    const cy = this.h / 2 + ev.y
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  }
}

export function makeClip({ id, name, asset, natW, natH, start = 0, duration = 2, draw }) {
  return {
    id, name, asset, natW, natH, start, duration, inPoint: 0,
    track: 0,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, pivotX: 0.5, pivotY: 0.5 },
    animation: CE.createDefaultClipAnimation({ x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, pivotX: 0.5, pivotY: 0.5 }),
    effects: {}, blendMode: 'source-over', opacity: 1, draw,
  }
}

/* effect maths — mirrored 1:1 into playback.ts as app features */
function withAlphaK(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return `rgba(255,217,160,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
/** Headless mirror of playback.applyLightComposite (Gold Motion light layers). */
function applyLightCompositeK(ctx, width, height, effect) {
  const intensity = effect?.lightIntensity ?? 0
  if (!effect || intensity <= 0) return
  const cx = (effect.lightX ?? 0.5) * width
  const cy = (effect.lightY ?? 0.4) * height
  const radius = Math.max(24, (effect.lightFalloff ?? 0.45) * Math.max(width, height))
  const color = effect.lightColor || '#ffd9a0'
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  gradient.addColorStop(0, withAlphaK(color, Math.min(1, intensity)))
  gradient.addColorStop(1, withAlphaK(color, 0))
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  if (effect.lightType === 'spot') {
    ctx.translate(cx, cy); ctx.scale(1, 0.55); ctx.translate(-cx, -cy)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

export function applyEffects(x, clip, w, h, t = 0) {
  // single source of truth: the app's own pixelGrade (AM-named family included),
  // with dropped effect instances merged in (CapCut model, board J). Full parity
  // with playback: CSS-filter keys, particle/overlay fx layers and light layers
  // all apply here too — headless proofs must match what the app shows.
  const eff = FXI.mergeFxInstances(clip, t - clip.start) || {}
  const flt = cssFilterOf(eff)
  if (flt) {
    const tmp = makeCanvas(w, h)
    const tx = tmp.getContext('2d')
    tx.filter = flt
    tx.drawImage(x.canvas, 0, 0)
    const back = x.canvas.getContext('2d')
    back.save()
    back.setTransform(1, 0, 0, 1, 0, 0)
    back.filter = 'none'
    back.globalCompositeOperation = 'copy'
    back.drawImage(tmp, 0, 0)
    back.restore()
  }
  PG.applyPixelGrade(x.canvas, eff, Math.round(t * 24))
  NG.applyGlitchNG(x.canvas, eff, t)
  if (PRT.hasClipFxLayers(eff)) PRT.applyClipFxLayers(x.canvas, eff, t)
  applyLightCompositeK(x, w, h, eff)
}

export function cardFlipFactor(clip, t) {
  const f = clip.effects?.cardFlip || 0
  if (!f) return { sx: 1, shade: 0 }
  const u = Math.min(1, Math.max(0, (t - clip.start) / clip.duration)) * f * Math.PI
  return { sx: Math.max(0.04, Math.abs(Math.cos(u))), shade: 0.5 * (1 - Math.abs(Math.cos(u))) }
}

export function applyShapeMatte(x, mask, W, H) {
  // mirrors playback.applyShapeMatte semantics for kind 'shape'
  const m = makeCanvas(W, H), mx = m.getContext('2d')
  mx.filter = mask.feather > 0 ? `blur(${mask.feather}px)` : 'none'
  mx.fillStyle = '#fff'
  const cx = mask.centerX * W, cy = mask.centerY * H, mw = mask.width * W, mh = mask.height * H
  if (mask.kind === 'custom' && mask.points?.length) {
    mx.beginPath()
    mask.points.forEach((pt, i) => (i ? mx.lineTo(pt.x * W, pt.y * H) : mx.moveTo(pt.x * W, pt.y * H)))
    mx.closePath(); mx.fill()
  } else if (mask.shape === 'rectangle') mx.fillRect(cx - mw / 2, cy - mh / 2, mw, mh)
  else { mx.beginPath(); mx.ellipse(cx, cy, mw / 2, mh / 2, 0, 0, 7); mx.fill() }
  mx.filter = 'none'
  x.globalCompositeOperation = mask.inverted ? 'destination-out' : 'destination-in'
  x.drawImage(m, 0, 0)
  x.globalCompositeOperation = 'source-over'
}

/** Keep only the union of effect-mask regions on a processed layer. */
export function applyEffectMaskK(x, mask, W, H, ox = 0, oy = 0) {
  const regions = effectMaskRegions(mask)
  if (!regions.length) return
  const matte = makeCanvas(W, H)
  const mx = matte.getContext('2d')
  for (const region of regions) {
    const shape = makeCanvas(W, H)
    const sx = shape.getContext('2d')
    const cx = region.centerX * W, cy = region.centerY * H
    const rw = Math.max(1, region.width * W)
    const rh = Math.max(1, (region.shape === 'circle' ? region.width * W : region.height * H))
    sx.save(); sx.translate(cx, cy); sx.rotate((region.rotation || 0) * Math.PI / 180)
    sx.filter = (region.feather || 0) > 0 ? `blur(${region.feather}px)` : 'none'
    sx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, region.opacity ?? 1))})`
    if (region.shape === 'rectangle') sx.fillRect(-rw / 2, -rh / 2, rw, rh)
    else if (region.shape === 'text') {
      sx.font = `700 ${Math.max(8, rh)}px ${region.fontFamily || 'sans-serif'}`
      sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText(region.text || 'MASK', 0, 0, rw)
    } else if (region.shape === 'custom' && region.points?.length >= 3) {
      sx.restore(); sx.save(); sx.filter = (region.feather || 0) > 0 ? `blur(${region.feather}px)` : 'none'
      sx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, region.opacity ?? 1))})`
      sx.beginPath(); region.points.forEach((point, i) => (i ? sx.lineTo(point.x * W, point.y * H) : sx.moveTo(point.x * W, point.y * H))); sx.closePath(); sx.fill()
    } else { sx.beginPath(); sx.ellipse(0, 0, rw / 2, rh / 2, 0, 0, Math.PI * 2); sx.fill() }
    sx.restore(); mx.drawImage(shape, 0, 0)
  }
  if (mask.inverted) {
    mx.globalCompositeOperation = 'source-out'; mx.fillStyle = '#fff'; mx.fillRect(0, 0, matte.width, matte.height); mx.globalCompositeOperation = 'source-over'
  }
  x.save()
  if (x.canvas.width !== W || x.canvas.height !== H) {
    x.clearRect(0, 0, x.canvas.width, oy)
    x.clearRect(0, oy + H, x.canvas.width, x.canvas.height - oy - H)
    x.clearRect(0, oy, ox, H)
    x.clearRect(ox + W, oy, x.canvas.width - ox - W, H)
  }
  x.globalCompositeOperation = 'destination-in'; x.drawImage(matte, ox, oy); x.restore()
}

const PU = await loadAppTs('src/lib/patchUnder.ts')
export function applySmartPatchMatte(x, patch, r, seq) { PU.applyPatchUnder(x, patch, r, seq.w, seq.h) }

/** Headless mirror of playback's effectFilterString (CSS-filter keys). */
function cssFilterOf(eff) {
  const f = []
  if (eff.brightness != null && eff.brightness !== 1) f.push(`brightness(${eff.brightness})`)
  if (eff.contrast != null && eff.contrast !== 1) f.push(`contrast(${eff.contrast})`)
  if (eff.saturation != null && eff.saturation !== 1) f.push(`saturate(${eff.saturation})`)
  if (eff.grayscale) f.push(`grayscale(${eff.grayscale})`)
  if (eff.sepia) f.push(`sepia(${eff.sepia})`)
  if (eff.invert) f.push(`invert(${eff.invert})`)
  if (eff.hueRotate) f.push(`hue-rotate(${eff.hueRotate}deg)`)
  if (eff.blur) f.push(`blur(${eff.blur}px)`)
  return f.join(' ')
}

function sampleAt(canvas, x, y) {
  const d = canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data
  return `rgb(${d[0]},${d[1]},${d[2]})`
}

// Per-frame clip layers MUST be reused: napi-rs native surfaces are not
// GC-tracked, so any fresh makeCanvas per frame leaks forever (~4-30 MB).
// One fixed over-sized surface per seq per recursion depth covers animated
// scale/zoom without ever re-allocating mid-render.
const LAYER_POOL = []
function scratchLayer(w, h, depth, seq) {
  let e = LAYER_POOL[depth]
  // 2× covers keyframed scale/zoom heads (measured max ~1.22); 3× wasted 4×
  // the memory and re-allocating per project piled native garbage.
  const pw = Math.max(64, w, (seq ? seq.w : w) * 2), ph = Math.max(64, h, (seq ? seq.h : h) * 2)
  if (!e || e.c.width < pw || e.c.height < ph) {
    e = LAYER_POOL[depth] = { c: makeCanvas(pw, ph) }
  }
  const cx = e.c.getContext('2d')
  cx.setTransform(1, 0, 0, 1, 0, 0)
  cx.globalAlpha = 1
  cx.globalCompositeOperation = 'source-over'
  cx.filter = 'none'
  cx.clearRect(0, 0, w, h)
  return e.c
}
export function renderFrame(seq, t, target) {
  // `target` lets long exports reuse ONE output surface (native canvases are
  // not GC-tracked; a fresh one per frame leaks ~4 MB/frame).
  const c = target || makeCanvas(seq.w, seq.h), x = c.getContext('2d')
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalAlpha = 1
  x.globalCompositeOperation = 'source-over'
  x.filter = 'none'
  x.fillStyle = seq.bg; x.fillRect(0, 0, seq.w, seq.h)
  drawSeq(x, seq, t)
  return c
}
function drawSeq(x, seq, t, depth = 0) {
  const paint = paintGetter ? paintGetter() : null
  if (paint && paint.strokes && paint.strokes.length) {
    // paint underlay first? no — playback paints OVER clips; keep same order:
    // defer until after the clip loop below.
  }
  for (const clip of seq.clips) {
    if (t < clip.start || t >= clip.start + clip.duration) continue
    // Standalone effect clip (adjustment): grades everything already drawn —
    // clips earlier in the list are the tracks BELOW it. Same law as playback.
    if (clip.kind === 'adjustment') {
      const aEff = FXI.mergeFxInstances(clip, t - clip.start) || {}
      const flt = cssFilterOf(aEff)
      if (flt) {
        const tmp = makeCanvas(seq.w, seq.h)
        const tx = tmp.getContext('2d')
        tx.filter = flt
        tx.drawImage(x.canvas, 0, 0)
        x.canvas.getContext('2d').drawImage(tmp, 0, 0)
      }
      PG.applyPixelGrade(x.canvas, aEff, Math.round(t * 24))
      NG.applyGlitchNG(x.canvas, aEff, t)
      if (PRT.hasClipFxLayers(aEff)) PRT.applyClipFxLayers(x.canvas, aEff, t)
      applyLightCompositeK(x.canvas.getContext('2d'), seq.w, seq.h, aEff)
      continue
    }
    const eff = FXI.mergeFxInstances(clip, t - clip.start) || {}
    const tt = PFX.pfxLocalTime(eff, t, clip.start, clip.duration)
    // Same source clock as browser video playback. Animation/effect clocks
    // stay on the timeline; only media sampling and nested sequence time warp.
    const sourceTimeAt = time => Math.max(0, (clip.inPoint || 0) + SC.remapClipLocal(clip, Math.max(0, time - clip.start)))
    const mediaTime = sourceTimeAt(tt)
    const sh = PFX.pfxShake(eff, t)
  const osc = PFX.pfxOscillate(eff, t)
  sh.dx += osc.dx; sh.dy += osc.dy
    const evAt = (time) => {
      const e2 = CE.evaluateClipAnimation(clip, PFX.pfxLocalTime(eff, time, clip.start, clip.duration))
      const s2 = PFX.pfxShake(eff, time)
      const o2 = PFX.pfxOscillate(eff, time)
      s2.dx += o2.dx; s2.dy += o2.dy
      e2.x += s2.dx; e2.y += s2.dy
      return e2
    }
    const ev = evAt(t)
    const rBase = seq.clipRect(clip, tt)
    const bAnim = CE.evaluateClipAnimation(clip, PFX.pfxLocalTime(eff, t, clip.start, clip.duration))
    const r = { ...rBase, x: rBase.x + (ev.x - bAnim.x), y: rBase.y + (ev.y - bAnim.y) }
    if (clip.kind === 'compound' && clip.childSeq) {
      // Padded (3x frame) child render: children bigger than the view must NOT
      // be bitmap-clipped to the view — mirrors the playback.ts pad fix.
      const innerT = sourceTimeAt(t)
      const pad = scratchLayer(seq.w * 3, seq.h * 3, depth + 40, seq)
      const pxc = pad.getContext('2d')
      pxc.translate(seq.w, seq.h)
      drawSeq(pxc, clip.childSeq, innerT, depth + 1)
      pxc.setTransform(1, 0, 0, 1, 0, 0)
      let compoundOutput = pad
      let compoundBase = null
      if (clip.adjustmentMask) {
        compoundBase = makeCanvas(pad.width, pad.height)
        compoundBase.getContext('2d').drawImage(pad, 0, 0)
      }
      applyEffects(pxc, clip, pad.width, pad.height, t)
      if (clip.adjustment?.luts?.length) applyClipLutsK(pxc, pad.width, pad.height, clip.adjustment.luts)
      if (clip.adjustmentMask && compoundBase) {
        applyEffectMaskK(pxc, clip.adjustmentMask, seq.w, seq.h, seq.w, seq.h)
        applyEffectMaskK(compoundBase.getContext('2d'), { ...clip.adjustmentMask, inverted: !clip.adjustmentMask.inverted }, seq.w, seq.h, seq.w, seq.h)
        compoundBase.getContext('2d').drawImage(pad, 0, 0)
        compoundOutput = compoundBase
      }
      x.save()
      x.translate(r.x + r.w / 2, r.y + r.h / 2)
      x.rotate((ev.rotationZ ?? 0) * Math.PI / 180)
      x.scale(ev.scaleX || 1, ev.scaleY || 1)
      x.globalAlpha = (clip.opacity ?? 1) * (ev.opacity ?? 1)
      x.globalCompositeOperation = blendAt(clip, t)
      x.drawImage(compoundOutput, -1.5 * seq.w, -1.5 * seq.h)
      x.restore()
      continue
    }
    // FAST PATH: clips without mask/fx/chroma/ghosts/flip/luts draw straight
    // into the frame. Routing them through the over-sized layer scratch forces
    // a downscale blit every frame, and Skia rebuilds a ~8 MB mipmap per call
    // (measured) — the real cause of OOM-killed long renders.
    const flipF = cardFlipFactor(clip, t)
    const ghostsF = [...PFX.pfxEchoTimes(eff, t), ...PFX.pfxMotionBlurSamples(eff, t, seq.fps)]
    const tsPF = clip.textStyle
    const needLayer = DF.hasDeformation(clip.deformation) || !!clip.patch || !!(clip.mask && clip.mask.enabled) || Object.keys(eff).length > 0 || (tsPF && (tsPF.chroma || 0) > 0) || ghostsF.length > 0 || flipF.sx !== 1 || flipF.shade > 0 || !!(clip.adjustment && clip.adjustment.luts && clip.adjustment.luts.length)
    if (!needLayer) {
      const lw0 = Math.max(2, Math.round(r.w)), lh0 = Math.max(2, Math.round(r.h))
      x.save()
      x.translate(r.x + r.w / 2, r.y + r.h / 2)
      x.rotate((ev.rotationZ ?? 0) * Math.PI / 180)
      x.scale((ev.scaleX || 1) * flipF.sx, ev.scaleY || 1)
      x.translate(-lw0 / 2, -lh0 / 2)
      x.globalAlpha = (clip.opacity ?? 1) * (ev.opacity ?? 1)
      x.globalCompositeOperation = blendAt(clip, t)
      clip.draw(x, lw0, lh0, mediaTime)
      x.restore()
      continue
    }
    const lw = Math.max(2, Math.round(r.w)), lh = Math.max(2, Math.round(r.h))
    // Exact-size layer: position-dependent effects (timecode burn-in, vignette)
    // address canvas.height directly, so a pooled over-sized surface would crop
    // them. 1:1 blit means no Skia mipmap rebuild; the canvas itself is
    // ordinary reclaimable garbage (measured flat).
    let s = makeCanvas(lw, lh)
    let sx = s.getContext('2d')
    const flip = cardFlipFactor(clip, t)
    sx.save()
    sx.translate(lw / 2, lh / 2); sx.scale(flip.sx, 1); sx.translate(-lw / 2, -lh / 2)
    const tsP = clip.textStyle
    const pxScale = lw / 640
    if (tsP && (tsP.chroma || 0) > 0) {
      const off = tsP.chroma * pxScale
      for (const [dx, col] of [[-off, '#00ffff'], [off, '#ff005a']]) {
        const tc = makeCanvas(lw, lh), tx = tc.getContext('2d')
        clip.draw(tx, lw, lh, mediaTime)
        tx.globalCompositeOperation = 'source-in'
        tx.fillStyle = col
        tx.fillRect(0, 0, lw, lh)
        sx.save(); sx.globalAlpha = 0.8; sx.translate(dx, 0); sx.drawImage(tc, 0, 0); sx.restore()
      }
    }
    if (tsP && tsP.shadowMode === 'outer') {
      sx.save()
      sx.translate((tsP.shadowOffsetX || 0) * pxScale, (tsP.shadowOffsetY || 0) * pxScale)
      sx.shadowColor = tsP.shadowColor || 'rgba(0,0,0,0.85)'
      sx.shadowBlur = (tsP.shadowBlur || 6) * pxScale
      clip.draw(sx, lw, lh, mediaTime)
      sx.restore()
    }
    if (tsP && tsP.glowBlur && tsP.glowMode !== 'inward') {
      sx.shadowColor = tsP.glowColor || '#ffffff'
      sx.shadowBlur = tsP.glowBlur * pxScale
    }
    clip.draw(sx, lw, lh, mediaTime)
    sx.shadowBlur = 0
    sx.restore()
    if (flip.shade > 0) { sx.fillStyle = `rgba(0,0,0,${flip.shade})`; sx.fillRect(0, 0, lw, lh) }
    if (DF.hasDeformation(clip.deformation)) DF.applyCanvasDeformation(s,clip.deformation)
    let effectBase = null
    if (clip.adjustmentMask) {
      effectBase = makeCanvas(lw, lh)
      effectBase.getContext('2d').drawImage(s, 0, 0)
    }
    applyEffects(sx, clip, lw, lh, t)
    if (clip.adjustment?.luts?.length) applyClipLutsK(sx, lw, lh, clip.adjustment.luts)
    if (clip.adjustmentMask && effectBase) {
      applyEffectMaskK(sx, clip.adjustmentMask, lw, lh)
      applyEffectMaskK(effectBase.getContext('2d'), { ...clip.adjustmentMask, inverted: !clip.adjustmentMask.inverted }, lw, lh)
      effectBase.getContext('2d').drawImage(s, 0, 0)
      s = effectBase
      sx = s.getContext('2d')
    }
    if (clip.mask?.enabled && clip.mask.kind === 'matte' && clip.mask.alpha) {
      const m = clip.mask
      let mc = clip._matteCanvas
      if (!mc || mc._forMask !== m || mc.width !== m.mw || mc.height !== m.mh) {
        mc = clip._matteCanvas = makeCanvas(m.mw, m.mh)
        mc._forMask = m
        const md = mc.getContext('2d').createImageData(m.mw, m.mh)
        for (let i = 0, j = 0; i < m.alpha.length; i++, j += 4) { md.data[j] = 255; md.data[j + 1] = 255; md.data[j + 2] = 255; md.data[j + 3] = m.alpha[i] }
        mc.getContext('2d').putImageData(md, 0, 0)
      }
      sx.save()
      sx.filter = m.feather > 0 ? `blur(${m.feather * lw}px)` : 'none'
      sx.globalCompositeOperation = 'destination-in'
      sx.drawImage(mc, 0, 0, lw, lh)
      sx.restore(); sx.filter = 'none'
    } else if (clip.mask?.enabled) {
      // mask is CLIP-LOCAL (moves with the layer): map sequence-space mask onto
      // the clip's base rect (transform without keyframe offsets)
      const lm = { ...clip.mask, feather: (clip.mask.feather || 0) * lw }
      applyShapeMatte(sx, lm, lw, lh)
    }
    if (clip.patch) applySmartPatchMatte(sx, clip.patch, r, seq)
    x.save()
    x.globalAlpha = (clip.opacity ?? 1) * (ev.opacity ?? 1)
    x.globalCompositeOperation = blendAt(clip, t)
    x.translate(r.x + r.w / 2, r.y + r.h / 2)
    x.rotate((ev.rotationZ ?? 0) * Math.PI / 180)
    x.drawImage(s, 0, 0, lw, lh, -r.w / 2, -r.h / 2, r.w, r.h)
    x.restore()
    const ghosts = [...PFX.pfxEchoTimes(eff, t), ...PFX.pfxMotionBlurSamples(eff, t, seq.fps)]
    for (const g of ghosts) {
      if (g.time < clip.start) continue
      const gev = evAt(g.time)
      const gr = { x: seq.w / 2 + gev.x - (clip.natW * gev.scaleX) / 2, y: seq.h / 2 + gev.y - (clip.natH * gev.scaleY) / 2, w: clip.natW * gev.scaleX, h: clip.natH * gev.scaleY }
      const gs = makeCanvas(Math.max(2, Math.round(gr.w)), Math.max(2, Math.round(gr.h)))
      const gsx = gs.getContext('2d')
      gsx.save()
      gsx.translate(gs.width / 2, gs.height / 2); gsx.scale(1, 1); gsx.translate(-gs.width / 2, -gs.height / 2)
      clip.draw(gsx, gs.width, gs.height, sourceTimeAt(PFX.pfxLocalTime(eff, g.time, clip.start, clip.duration)))
      gsx.restore()
      if (clip.mask?.enabled && clip.mask.kind === 'matte' && clip.mask.alpha) { /* matte applied below via shared path */ }
      x.save()
      x.globalAlpha = (clip.opacity ?? 1) * g.alpha
      x.drawImage(gs, gr.x, gr.y, gr.w, gr.h)
      x.restore()
    }
  }
  if (paint && paint.strokes && paint.strokes.length) {
    DE.renderAllPaintLayers(x, seq.w, seq.h, paint.strokes, paint.layers && paint.layers.length ? paint.layers : [{ id: 'paint-1', visible: true }], t, seq.fps || 30)
  }

}
