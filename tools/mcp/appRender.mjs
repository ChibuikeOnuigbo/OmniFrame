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

export class Sequence {
  constructor({ w = 640, h = 360, fps = 24, duration = 2, bg = '#0d0f13' } = {}) {
    this.w = w; this.h = h; this.fps = fps; this.duration = duration; this.bg = bg
    this.clips = []
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
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, pivotX: 0.5, pivotY: 0.5 },
    animation: CE.createDefaultClipAnimation({ x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, pivotX: 0.5, pivotY: 0.5 }),
    effects: {}, blendMode: 'source-over', opacity: 1, draw,
  }
}

/* effect maths — mirrored 1:1 into playback.ts as app features */
export function applyEffects(x, clip, w, h) {
  const e = clip.effects || {}
  if (e.pixelate > 0) {
    const t = makeCanvas(Math.max(2, Math.round(w / e.pixelate)), Math.max(2, Math.round(h / e.pixelate)))
    t.getContext('2d').drawImage(x.canvas, 0, 0, t.width, t.height)
    x.imageSmoothingEnabled = false
    x.clearRect(0, 0, w, h); x.drawImage(t, 0, 0, w, h)
    x.imageSmoothingEnabled = true
  }
  if (e.fractalBlur > 0) {
    // fractal blur: stacked self-similar blur passes (3 octaves, halving radius)
    const src = makeCanvas(w, h); src.getContext('2d').drawImage(x.canvas, 0, 0)
    x.clearRect(0, 0, w, h)
    let r = e.fractalBlur
    for (let o = 0; o < 3; o++) {
      x.save(); x.filter = `blur(${Math.max(0.5, r).toFixed(1)}px)`; x.globalAlpha = o === 0 ? 1 : 0.55
      x.drawImage(src, 0, 0); x.restore(); r /= 2
    }
    x.filter = 'none'
  }
  if (e.lumaKey > 0 || e.chromaKey > 0) {
    const d = x.getImageData(0, 0, w, h), p = d.data
    for (let i = 0; i < p.length; i += 4) {
      if (e.lumaKey > 0) {
        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
        const a = lum < 26 ? 0 : lum > 26 + 30 * (1 - e.lumaKey) ? 255 : ((lum - 26) / (30 * (1 - e.lumaKey))) * 255
        p[i + 3] = Math.min(p[i + 3], Math.max(0, a))
      } else {
        const g = p[i + 1] - Math.max(p[i], p[i + 2])
        if (g > 40 * (1 - e.chromaKey)) p[i + 3] = 0
      }
    }
    x.putImageData(d, 0, 0)
  }
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

export function applySmartPatchMatte(x, patch, r, seq) {
  // SmartPatchSlice semantics headless: donor-sample clone / blur / gradient
  // fill of the region, feathered edge (smartPatchFeather).
  const X0 = ((patch.x0 / seq.w) - r.x / seq.w) * x.canvas.width, X1 = ((patch.x1 / seq.w) - r.x / seq.w) * x.canvas.width
  const Y0 = ((patch.y0 / seq.h) - r.y / seq.h) * x.canvas.height, Y1 = ((patch.y1 / seq.h) - r.y / seq.h) * x.canvas.height
  const W = X1 - X0, H = Y1 - Y0
  if (W <= 0 || H <= 0) return
  const src = makeCanvas(x.canvas.width, x.canvas.height); src.getContext('2d').drawImage(x.canvas, 0, 0)
  const p = makeCanvas(Math.max(2, Math.round(W)), Math.max(2, Math.round(H))), px = p.getContext('2d')
  const strat = patch.strategy || 'clone'
  if (strat === 'blur') { px.drawImage(src, X0, Y0, W, H, 0, 0, 12, 8); px.drawImage(px.canvas, 0, 0, 12, 8, 0, 0, W, H) }
  else if (strat === 'gradient') { const g = px.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sampleAt(src, X0 + W / 2, Math.max(0, Y0 - 6))); g.addColorStop(1, sampleAt(src, X0 + W / 2, Math.min(src.height - 1, Y1 + 6))); px.fillStyle = g; px.fillRect(0, 0, W, H) }
  else { const d = patch.donor ? [((patch.donor[0] / seq.w) - r.x / seq.w) * x.canvas.width, ((patch.donor[1] / seq.h) - r.y / seq.h) * x.canvas.height] : [0, 0]; px.drawImage(src, d[0], d[1], W, H, 0, 0, W, H) }
  const feather = (patch.feather ?? 5) * (x.canvas.width / seq.w)
  const mm = makeCanvas(p.width, p.height), mx = mm.getContext('2d')
  mx.filter = feather > 0 ? `blur(${feather}px)` : 'none'; mx.fillStyle = '#fff'; mx.fillRect(0, 0, W, H); mx.filter = 'none'
  px.globalCompositeOperation = 'destination-in'; px.drawImage(mm, 0, 0); px.globalCompositeOperation = 'source-over'
  x.drawImage(p, X0, Y0)
}
function sampleAt(canvas, x, y) {
  const d = canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data
  return `rgb(${d[0]},${d[1]},${d[2]})`
}

export function renderFrame(seq, t) {
  const c = makeCanvas(seq.w, seq.h), x = c.getContext('2d')
  x.fillStyle = seq.bg; x.fillRect(0, 0, seq.w, seq.h)
  for (const clip of seq.clips) {
    if (t < clip.start || t >= clip.start + clip.duration) continue
    const ev = CE.evaluateClipAnimation(clip, t)
    const r = seq.clipRect(clip, t)
    const s = makeCanvas(Math.max(2, Math.round(r.w)), Math.max(2, Math.round(r.h)))
    const sx = s.getContext('2d')
    const flip = cardFlipFactor(clip, t)
    sx.save()
    sx.translate(s.width / 2, s.height / 2); sx.scale(flip.sx, 1); sx.translate(-s.width / 2, -s.height / 2)
    clip.draw(sx, s.width, s.height, t - clip.start)
    sx.restore()
    if (flip.shade > 0) { sx.fillStyle = `rgba(0,0,0,${flip.shade})`; sx.fillRect(0, 0, s.width, s.height) }
    applyEffects(sx, clip, s.width, s.height)
    if (clip.mask?.enabled) {
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
  }
  return c
}
