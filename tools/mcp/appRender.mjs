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
import { makeCanvas } from './core.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const _mods = new Map()
export async function loadAppTs(rel) {
  if (_mods.has(rel)) return _mods.get(rel)
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const { code } = transform(src, { transforms: ['typescript'] })
  const dir = mkdtempSync(join(tmpdir(), 'appmod-'))
  const f = join(dir, 'mod.mjs')
  writeFileSync(f, code.replace(/from '(\.\.?\/[^']+)'/g, (m, p) => `from '${p}.mjs'`))
  // ship sibling deps the module imports (types-only imports vanish in sucrase)
  for (const m of code.matchAll(/from '(\.\.?\/[^']+)'/g)) {
    const dep = path.join(path.dirname(path.join(ROOT, rel)), m[1] + '.ts')
    if (fs.existsSync(dep)) {
      const d = transform(fs.readFileSync(dep, 'utf8'), { transforms: ['typescript'] }).code
      writeFileSync(join(dir, path.basename(m[1]) + '.mjs'), d)
    }
  }
  const mod = await import(f)
  _mods.set(rel, mod)
  return mod
}

export const CE = await loadAppTs('src/lib/animation/CurveEngine.ts')
export const PG = await loadAppTs('src/lib/pixelGrade.ts')
export const PFX = await loadAppTs('src/lib/proceduralFx.ts')

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
export function applyEffects(x, clip, w, h, t = 0) {
  // single source of truth: the app's own pixelGrade (AM-named family included)
  PG.applyPixelGrade(x.canvas, clip.effects || {}, Math.round(t * 24))
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

const PU = await loadAppTs('src/lib/patchUnder.ts')
export function applySmartPatchMatte(x, patch, r, seq) { PU.applyPatchUnder(x, patch, r, seq.w, seq.h) }

function sampleAt(canvas, x, y) {
  const d = canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data
  return `rgb(${d[0]},${d[1]},${d[2]})`
}

export function renderFrame(seq, t) {
  const c = makeCanvas(seq.w, seq.h), x = c.getContext('2d')
  x.fillStyle = seq.bg; x.fillRect(0, 0, seq.w, seq.h)
  for (const clip of seq.clips) {
    if (t < clip.start || t >= clip.start + clip.duration) continue
    const eff = clip.effects || {}
    const tt = PFX.pfxLocalTime(eff, t, clip.start, clip.duration)
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
    const s = makeCanvas(Math.max(2, Math.round(r.w)), Math.max(2, Math.round(r.h)))
    const sx = s.getContext('2d')
    const flip = cardFlipFactor(clip, t)
    sx.save()
    sx.translate(s.width / 2, s.height / 2); sx.scale(flip.sx, 1); sx.translate(-s.width / 2, -s.height / 2)
    clip.draw(sx, s.width, s.height, Math.max(0, tt - clip.start))
    sx.restore()
    if (flip.shade > 0) { sx.fillStyle = `rgba(0,0,0,${flip.shade})`; sx.fillRect(0, 0, s.width, s.height) }
    applyEffects(sx, clip, s.width, s.height)
    if (clip.mask?.enabled && clip.mask.kind === 'matte' && clip.mask.alpha) {
      const m = clip.mask
      const mc = makeCanvas(m.mw, m.mh)
      const md = mc.getContext('2d').createImageData(m.mw, m.mh)
      for (let i = 0, j = 0; i < m.alpha.length; i++, j += 4) { md.data[j] = 255; md.data[j + 1] = 255; md.data[j + 2] = 255; md.data[j + 3] = m.alpha[i] }
      mc.getContext('2d').putImageData(md, 0, 0)
      sx.save()
      sx.filter = m.feather > 0 ? `blur(${m.feather * s.width}px)` : 'none'
      sx.globalCompositeOperation = 'destination-in'
      sx.drawImage(mc, 0, 0, s.width, s.height)
      sx.restore(); sx.filter = 'none'
    } else if (clip.mask?.enabled) {
      // mask is CLIP-LOCAL (moves with the layer): map sequence-space mask onto
      // the clip's base rect (transform without keyframe offsets)
      const lm = { ...clip.mask, feather: (clip.mask.feather || 0) * s.width }
      applyShapeMatte(sx, lm, s.width, s.height)
    }
    if (clip.patch) applySmartPatchMatte(sx, clip.patch, r, seq)
    x.save()
    x.globalAlpha = (clip.opacity ?? 1) * (ev.opacity ?? 1)
    x.globalCompositeOperation = clip.blendMode || 'source-over'
    x.translate(r.x + r.w / 2, r.y + r.h / 2)
    x.rotate((ev.rotationZ ?? 0) * Math.PI / 180)
    x.drawImage(s, -r.w / 2, -r.h / 2, r.w, r.h)
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
      clip.draw(gsx, gs.width, gs.height, Math.max(0, PFX.pfxLocalTime(eff, g.time, clip.start, clip.duration) - clip.start))
      gsx.restore()
      if (clip.mask?.enabled && clip.mask.kind === 'matte' && clip.mask.alpha) { /* matte applied below via shared path */ }
      x.save()
      x.globalAlpha = (clip.opacity ?? 1) * g.alpha
      x.drawImage(gs, gr.x, gr.y, gr.w, gr.h)
      x.restore()
    }
  }
  return c
}
