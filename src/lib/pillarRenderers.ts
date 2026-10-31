/**
 * Pillar family renderers — one parameterised renderer per pillar
 * (glitch / blur / dissolve / light / flicker / tv / overlay). The 350
 * catalogue presets in pillarPresets.ts are parameter sets into these
 * functions, so every named variant is a distinct look.
 *
 * Technique sources (see transition_pillars/ index headers): glitchology's
 * datamosh & glitch taxonomy (RGB split, slice displacement, block
 * corruption, pixel sort, VHS tear, static), Storyblocks' four flare types
 * (starburst, veiling, ghosting, anamorphic), ineedfx light-leak families
 * (leak, flicker, bokeh, film burn), CapCut's TV/overlay template families
 * (static burst, channel surf, retro interface, device frames), Alight
 * Motion camera-object overlays (viewfinder / device pull-out).
 */
import type { PillarParams } from './pillarPresets'
import { drawReplaceBg } from './particleFx'

export interface PillarDrawArgs {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  p: number
  params: PillarParams
  drawFrom: (c: CanvasRenderingContext2D) => void
  drawTo: (c: CanvasRenderingContext2D) => void
  hasFrom: boolean
  hasTo: boolean
  takeScratch: () => HTMLCanvasElement
  releaseScratch: (c: HTMLCanvasElement) => void
}

const num = (p: PillarParams, k: string, d = 0): number => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: PillarParams, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d)

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Deterministic per-step noise so glitch jitter steps like real signal loss. */
const stepRnd = (seed: number, p: number, steps = 14) => mulberry32(seed + Math.floor(p * steps) * 7919)

function snow(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, rnd: () => number) {
  if (alpha <= 0.01) return
  const n = Math.round(alpha * 700)
  for (let i = 0; i < n; i++) {
    const g = Math.floor(rnd() * 255)
    ctx.fillStyle = `rgba(${g},${g},${g},${(0.25 + rnd() * 0.6) * Math.min(1, alpha + 0.3)})`
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2)
  }
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.25})`
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
}

// --------------------------------------------------------------------- GLITCH
function renderGlitch(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const I = num(params, 'intensity', 0.6)
  const style = str(params, 'style', 'slice')
  const seed = num(params, 'seed', 1)
  const rnd = stepRnd(seed, p)
  const scr = a.takeScratch()
  const s = scr.getContext('2d')!
  const base = (c: CanvasRenderingContext2D) => {
    if (p < 0.5) { if (hasFrom) drawFrom(c); else if (hasTo) drawTo(c) }
    else { if (hasTo) drawTo(c); else if (hasFrom) drawFrom(c) }
  }
  if (style === 'poster') s.filter = 'saturate(1.8) contrast(1.35)'
  base(s)
  s.filter = 'none'
  if (style === 'mosh' && hasTo) {
    // datamosh melt: incoming motion vectors smear over the old frame
    s.globalAlpha = 0.25 + p * 0.6
    for (let i = 0; i < 6; i++) {
      const bw = W * (0.12 + rnd() * 0.3), bh = H * (0.08 + rnd() * 0.25)
      const bx = rnd() * (W - bw), by = rnd() * (H - bh)
      s.save(); s.beginPath(); s.rect(bx, by, bw, bh); s.clip()
      drawTo(s); s.restore()
    }
    s.globalAlpha = 1
  }
  let ox = 0, oy = 0
  if (style === 'shake') { ox = (rnd() - 0.5) * I * 46; oy = (rnd() - 0.5) * I * 22 }
  ctx.save()
  ctx.drawImage(scr, ox, oy)
  // slice displacement — big bands, not hairlines
  const slices = Math.round(3 + I * 11)
  for (let i = 0; i < slices; i++) {
    const sy = rnd() * H
    const sh = (0.035 + rnd() * 0.16) * H * (0.6 + I)
    const dx = (rnd() - 0.5) * 2 * I * 0.38 * W
    ctx.drawImage(scr, 0, sy, W, sh, dx + ox, sy + oy, W, sh)
  }
  // corrupted macroblocks
  if (style === 'block' || style === 'mosh' || I > 0.7) {
    const n = Math.round(4 + I * 16)
    for (let i = 0; i < n; i++) {
      const bw = (0.05 + rnd() * 0.16) * W, bh = (0.04 + rnd() * 0.12) * H
      const bx = rnd() * (W - bw), by = rnd() * (H - bh)
      const dx = (rnd() - 0.5) * I * 0.5 * W, dy = (rnd() - 0.5) * I * 0.2 * H
      ctx.drawImage(scr, bx, by, bw, bh, bx + dx, by + dy, bw, bh)
    }
  }
  // pixel-sort streaks
  if (style === 'sort') {
    const bands = Math.round(3 + I * 8)
    for (let i = 0; i < bands; i++) {
      const sy = rnd() * H, sh = 2 + rnd() * 7
      const off = (rnd() - 0.3) * I * W * 0.9
      ctx.globalAlpha = 0.5 + rnd() * 0.5
      ctx.drawImage(scr, 0, sy, W, sh, off, sy, W * (1 + rnd() * 0.3), sh)
    }
    ctx.globalAlpha = 1
  }
  // signal tears with white gap
  if (style === 'tear') {
    const tears = 1 + Math.round(I * 2)
    for (let i = 0; i < tears; i++) {
      const sy = rnd() * H, sh = (0.05 + rnd() * 0.12) * H
      const dx = (rnd() - 0.5) * I * 0.7 * W
      ctx.drawImage(scr, 0, sy, W, sh, dx, sy + (rnd() - 0.5) * 14, W, sh)
      ctx.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.4})`
      ctx.fillRect(0, sy - 2, W, 2 + rnd() * 3)
    }
  }
  // RGB split ghosts
  const rgb = I * (style === 'rgb' ? 44 : 16) * (0.35 + 0.65 * Math.sin(Math.PI * p))
  if (rgb > 1.5) {
    ctx.globalAlpha = 0.32
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'hue-rotate(115deg) saturate(2.4)'
    ctx.drawImage(scr, rgb + ox, oy)
    ctx.filter = 'hue-rotate(-115deg) saturate(2.4)'
    ctx.drawImage(scr, -rgb + ox, oy)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  // static patches + scanlines
  const st = num(params, 'static', 0.25)
  if (st > 0) {
    const n = Math.round(st * 130 * (0.4 + Math.sin(Math.PI * p)))
    for (let i = 0; i < n; i++) {
      const g = rnd() > 0.5 ? 255 : 0
      ctx.fillStyle = `rgba(${g},${g},${g},${0.12 + rnd() * 0.4})`
      ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 26, 1 + rnd() * 3)
    }
  }
  const sc = num(params, 'scan', 0.18)
  if (sc > 0) {
    ctx.fillStyle = `rgba(0,0,0,${sc * 0.4})`
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  }
  ctx.restore()
  a.releaseScratch(scr)
}

// ----------------------------------------------------------------------- BLUR
function renderBlur(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const mode = str(params, 'mode', 'cross')
  const amount = num(params, 'amount', 0.5)
  const b = amount * 46 * Math.sin(Math.PI * p) + 0.01
  const e = smooth(p)
  const blur = (v: number) => `blur(${v.toFixed(1)}px)`
  ctx.save()
  const draw = (which: 'from' | 'to', alpha: number, filter: string, tx = 0, ty = 0, scale = 1, rot = 0) => {
    if (alpha <= 0.004) return
    ctx.save()
    ctx.globalAlpha = clamp01(alpha)
    ctx.filter = filter
    if (tx || ty || scale !== 1 || rot) {
      ctx.translate(W / 2 + tx, H / 2 + ty)
      if (rot) ctx.rotate(rot)
      if (scale !== 1) ctx.scale(scale, scale)
      ctx.translate(-W / 2, -H / 2)
    }
    if (which === 'from' && hasFrom) drawFrom(ctx)
    else if (which === 'to' && hasTo) drawTo(ctx)
    ctx.restore()
  }
  if (mode === 'cross' || mode === 'tilt') {
    if (mode === 'cross') {
      draw('from', 1 - e, blur(b))
      draw('to', e, blur(b))
    } else {
      // tilt-shift: blurred band racks down over the sharp incoming frame
      draw('to', 1, 'none')
      const scr = a.takeScratch(); const s = scr.getContext('2d')!
      if (hasFrom) drawFrom(s)
      s.globalCompositeOperation = 'destination-in'
      const g = s.createLinearGradient(0, (e - 0.45) * H, 0, (e + 0.05) * H)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      s.fillStyle = g; s.fillRect(0, 0, W, H)
      s.globalCompositeOperation = 'source-over'
      ctx.save(); ctx.filter = blur(b * 0.8); ctx.drawImage(scr, 0, 0); ctx.restore()
      a.releaseScratch(scr)
    }
  } else if (mode.startsWith('push') || mode === 'whip') {
    const dir = mode === 'push_l' || mode === 'whip' ? -1 : mode === 'push_r' ? 1 : 0
    const vy = mode === 'push_u' ? -1 : mode === 'push_d' ? 1 : 0
    const bb = mode === 'whip' ? b * 1.6 : b
    draw('from', 1, blur(bb * (0.3 + e)), dir * e * W * 0.9, vy * e * H * 0.9)
    draw('to', 1, blur(bb * (1.3 - e)), dir * (e - 1) * W * 0.9, vy * (e - 1) * H * 0.9)
  } else if (mode === 'zoom_in' || mode === 'zoom_out') {
    const inn = mode === 'zoom_in'
    draw('from', 1 - e * 0.85, blur(b * e), 0, 0, inn ? 1 + e * 0.7 : 1.5 - e * 0.5)
    draw('to', e, blur(b * (1 - e)), 0, 0, inn ? 1.6 - e * 0.6 : 0.7 + e * 0.8)
  } else if (mode === 'spin') {
    draw('from', 1 - e, blur(b), 0, 0, 1 + e * 0.15, -e * 0.5)
    draw('to', e, blur(b), 0, 0, 1.15 - e * 0.15, (1 - e) * 0.5)
  }
  ctx.restore()
}

// ------------------------------------------------------------------- DISSOLVE
function renderDissolve(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const mode = str(params, 'mode', 'cross')
  const easeV = str(params, 'ease', 'smooth')
  const seed = num(params, 'seed', 1)
  let t = p
  if (easeV === 'fast') t = smooth(smooth(p))
  else if (easeV === 'slow') t = p * p * (3 - 2 * p) * 0.85 + p * 0.15
  else if (easeV === 'smooth') t = smooth(p)
  if (mode === 'dip_black' || mode === 'dip_white' || mode === 'dip_color') {
    const dip = mode === 'dip_black' ? '#000000' : mode === 'dip_white' ? '#ffffff' : 'hsl(265 60% 30%)'
    if (hasFrom) drawFrom(ctx)
    if (p < 0.5) { ctx.globalAlpha = smooth(p * 2); ctx.fillStyle = dip; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
    else {
      ctx.fillStyle = dip; ctx.fillRect(0, 0, W, H)
      if (hasTo) { ctx.globalAlpha = smooth((p - 0.5) * 2); drawTo(ctx); ctx.globalAlpha = 1 }
    }
    return
  }
  if (hasTo) drawTo(ctx)
  const scr = a.takeScratch(); const s = scr.getContext('2d')!
  if (hasFrom) drawFrom(s)
  s.globalCompositeOperation = 'destination-in'
  if (mode === 'luma') {
    const radial = easeV === 'radial'
    const g = radial
      ? s.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7 * t + 1)
      : s.createLinearGradient(0, 0, W, 0)
    if (radial) { g.addColorStop(0.98, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)') }
    else {
      const x = clamp01(t * 1.3 - 0.15)
      g.addColorStop(Math.max(0, x - 0.15), 'rgba(0,0,0,1)')
      g.addColorStop(Math.min(1, x + 0.15), 'rgba(0,0,0,0)')
    }
    s.fillStyle = g; s.fillRect(0, 0, W, H)
  } else if (mode === 'dither') {
    // Build the cell mask on its own scratch and composite ONCE: per-rect
    // destination-in would re-blend the whole surface per cell (0.5 fps on
    // software canvas).
    const mask = a.takeScratch()
    const m = mask.getContext('2d')!
    const rnd = mulberry32(seed)
    const cell = 10
    m.fillStyle = '#000'
    for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) { if (rnd() > t) m.fillRect(x, y, cell, cell) }
    s.drawImage(mask, 0, 0)
    a.releaseScratch(mask)
  } else {
    let alpha = t
    if (mode === 'film') alpha = Math.pow(t, 1.5)
    else if (mode === 'gamma') alpha = Math.pow(t, 0.55)
    s.fillStyle = `rgba(0,0,0,${clamp01(alpha)})`
    s.fillRect(0, 0, W, H)
  }
  s.globalCompositeOperation = 'source-over'
  if (mode === 'additive') ctx.globalCompositeOperation = 'lighter'
  else if (mode === 'subtract') ctx.globalCompositeOperation = 'difference'
  ctx.drawImage(scr, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  if (mode === 'film') {
    const rnd = stepRnd(seed, p, 24)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    for (let i = 0; i < 60; i++) ctx.fillRect(rnd() * W, rnd() * H, 1, 1)
  }
  a.releaseScratch(scr)
}

// ---------------------------------------------------------------------- LIGHT
function renderLight(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const mode = str(params, 'mode', 'leak_l')
  const hue = num(params, 'hue', 40)
  const seed = num(params, 'seed', 1)
  const e = smooth(p)
  if (hasFrom) drawFrom(ctx)
  if (hasTo) { ctx.globalAlpha = e; drawTo(ctx); ctx.globalAlpha = 1 }
  const sin = Math.sin(Math.PI * p)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const col = (al: number, l = 60) => `hsla(${hue} 92% ${l}% / ${clamp01(al)})`
  if (mode.startsWith('leak')) {
    const cx = mode === 'leak_l' ? W * (0.1 + e * 0.5) : mode === 'leak_r' ? W * (0.9 - e * 0.5) : W / 2
    const cy = mode === 'leak_top' ? H * (0.05 + e * 0.45) : H * 0.5
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75)
    g.addColorStop(0, col(sin * 0.95, 72)); g.addColorStop(0.4, col(sin * 0.5)); g.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (mode === 'flash_white' || mode === 'flash_color') {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = mode === 'flash_white' ? `rgba(255,255,255,${Math.pow(sin, 1.4) * 0.96})` : col(Math.pow(sin, 1.4) * 0.9, 70)
    ctx.fillRect(0, 0, W, H)
  } else if (mode === 'flare_ana') {
    const y = H * 0.44
    const g = ctx.createLinearGradient(0, y - H * 0.06, 0, y + H * 0.06)
    g.addColorStop(0, 'hsla(0 0% 0% / 0)'); g.addColorStop(0.5, col(sin * 0.95, 80)); g.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = g; ctx.fillRect(0, y - H * 0.06, W, H * 0.12)
    const g2 = ctx.createRadialGradient(W * (0.2 + e * 0.6), y, 0, W * (0.2 + e * 0.6), y, W * 0.2)
    g2.addColorStop(0, col(sin, 88)); g2.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)
  } else if (mode === 'flare_star') {
    const cx = W * 0.5, cy = H * 0.42
    ctx.strokeStyle = col(sin * 0.8, 82); ctx.lineWidth = 3
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 + 0.2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(ang) * W * 0.5 * sin, cy + Math.sin(ang) * W * 0.5 * sin); ctx.stroke()
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.3 * sin + 1)
    g.addColorStop(0, col(sin, 90)); g.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (mode === 'flare_ghost') {
    const rnd = mulberry32(seed)
    for (let i = 0; i < 6; i++) {
      const t = i / 5
      const cx = W * (0.15 + t * 0.7), cy = H * (0.62 - t * 0.3)
      const r = W * (0.03 + rnd() * 0.06)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, `hsla(${hue + i * 24} 90% 70% / ${sin * 0.55})`); g.addColorStop(1, 'hsla(0 0% 0% / 0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill()
    }
  } else if (mode === 'bokeh') {
    const rnd = mulberry32(seed)
    for (let i = 0; i < 14; i++) {
      const cx = rnd() * W, cy = rnd() * H, r = W * (0.02 + rnd() * 0.08)
      const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r)
      g.addColorStop(0, `hsla(${hue + rnd() * 40 - 20} 85% 72% / ${sin * (0.12 + rnd() * 0.3)})`)
      g.addColorStop(1, 'hsla(0 0% 0% / 0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill()
    }
  } else if (mode === 'filmburn') {
    const g = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, Math.max(W, H) * (0.3 + sin * 0.8))
    g.addColorStop(0, col(sin * 0.9, 68)); g.addColorStop(0.55, `hsla(${hue - 15} 90% 45% / ${sin * 0.5})`); g.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
}

// -------------------------------------------------------------------- FLICKER
function renderFlicker(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const mode = str(params, 'mode', 'film')
  const hz = num(params, 'hz', 10)
  const depth = num(params, 'depth', 0.45)
  const seed = num(params, 'seed', 1)
  const q = Math.floor(p * hz * 2)
  const rnd = mulberry32(seed + q * 104729)
  const v = rnd() * 2 - 1
  let held = p
  if (mode === 'frameskip') held = Math.floor(p * 7) / 7
  const cross = smooth(mode === 'frameskip' ? held : p)
  if (cross < 0.5) { if (hasFrom) drawFrom(ctx); else if (hasTo) drawTo(ctx) }
  else { if (hasTo) drawTo(ctx); else if (hasFrom) drawFrom(ctx) }
  ctx.save()
  const dip = (color: string, alpha: number) => { if (alpha > 0.01) { ctx.fillStyle = color; ctx.globalAlpha = clamp01(alpha); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 } }
  if (mode === 'strobe_b') dip('#000', p > 0.15 && p < 0.85 && q % 2 === 0 ? depth : 0)
  else if (mode === 'strobe_w') dip('#fff', p > 0.15 && p < 0.85 && q % 2 === 0 ? depth : 0)
  else if (mode === 'blink') dip('#000', depth * Math.pow(Math.sin(Math.PI * (p * 3 % 1)), 3))
  else if (mode === 'burn') { dip('hsl(38 100% 82%)', rnd() > 0.5 ? depth * (0.4 + rnd() * 0.6) : depth * 0.3) }
  else if (mode === 'film' || mode === 'vintage' || mode === 'candle' || mode === 'projector' || mode === 'gate') {
    const warm = mode === 'candle' ? 0.16 : mode === 'vintage' ? 0.13 : 0
    if (warm) dip('hsl(30 60% 50%)', warm)
    const amp = depth * (0.35 + 0.65 * Math.abs(v))
    if (v > 0) dip('#fff', amp * 0.7)
    else dip('#000', amp * 0.7)
    if (mode === 'gate' || mode === 'projector') {
      const n = mode === 'gate' ? 7 : 3
      for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(230,225,215,${0.15 + rnd() * 0.3})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 0, 7); ctx.fill() }
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95)
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.25 + depth * 0.3 * Math.abs(v)})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }
  } else if (mode === 'frameskip') {
    if (rnd() > 0.5) dip('#fff', 0.22)
    else dip('#000', 0.15)
  }
  ctx.restore()
}

// ------------------------------------------------------------------------- TV
function renderTV(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const mode = str(params, 'mode', 'static_burst')
  const I = num(params, 'intensity', 0.55)
  const osd = num(params, 'osd', 0)
  const seed = num(params, 'seed', 1)
  const rnd = stepRnd(seed, p, 20)
  const e = smooth(p)
  ctx.save()
  if (mode === 'static_burst') {
    if (hasFrom) { ctx.globalAlpha = 1 - e; drawFrom(ctx); ctx.globalAlpha = 1 }
    if (hasTo) { ctx.globalAlpha = e; drawTo(ctx); ctx.globalAlpha = 1 }
    snow(ctx, W, H, Math.sin(Math.PI * p) * I, rnd)
  } else if (mode === 'channel') {
    if (p < 0.42) { if (hasFrom) drawFrom(ctx) }
    else if (p < 0.58) snow(ctx, W, H, 0.55 + I * 0.45, rnd)
    else {
      if (hasTo) drawTo(ctx)
      snow(ctx, W, H, (1 - p) * I * 0.7, rnd)
      if (osd) {
        ctx.globalAlpha = clamp01((p - 0.55) * 6) * clamp01((1 - p) * 6)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W - 190, 40, 150, 56)
        ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`CH ${String((seed % 9) + 2).padStart(2, '0')}`, W - 115, 68)
        ctx.globalAlpha = 1
      }
    }
  } else if (mode === 'v_roll') {
    const off = (1 - e) * H * (0.6 + I)
    const y = -(off % H)
    ctx.translate(0, y)
    if (hasTo) drawTo(ctx)
    ctx.translate(0, H)
    if (hasFrom) drawFrom(ctx)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    snow(ctx, W, H, I * 0.35 * Math.sin(Math.PI * p), rnd)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, ((H - off % H) % H) - 2, W, 3)
  } else if (mode === 'h_tear') {
    if (hasFrom) { ctx.globalAlpha = 1 - e; drawFrom(ctx); ctx.globalAlpha = 1 }
    if (hasTo) { ctx.globalAlpha = e; drawTo(ctx); ctx.globalAlpha = 1 }
    const scr = a.takeScratch(); const s = scr.getContext('2d')!
    s.drawImage(ctx.canvas, 0, 0)
    const bands = 2 + Math.round(I * 3)
    for (let i = 0; i < bands; i++) {
      const sy = rnd() * H, sh = (0.04 + rnd() * 0.1) * H
      ctx.drawImage(scr, 0, sy, W, sh, (rnd() - 0.5) * I * 0.5 * W, sy, W, sh)
      ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.4})`; ctx.fillRect(0, sy, W, 2)
    }
    a.releaseScratch(scr)
  } else if (mode === 'screen_off') {
    if (p < 0.5) {
      const k = 1 - p * 2
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (hasFrom) { ctx.save(); ctx.translate(0, H / 2); ctx.scale(1, Math.max(0.004, k * k)); ctx.translate(0, -H / 2); drawFrom(ctx); ctx.restore() }
      ctx.fillStyle = `rgba(255,255,255,${0.5 + k * 0.5})`; ctx.fillRect(0, H / 2 - 1.5, W, 3)
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (hasTo) { ctx.globalAlpha = smooth((p - 0.5) * 2); drawTo(ctx); ctx.globalAlpha = 1 }
      ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 0.8})`; ctx.fillRect(0, H / 2 - 1, W, 2)
    }
  } else if (mode === 'power_on') {
    if (p < 0.4) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      const hgt = 2 + p * 30
      ctx.fillStyle = `rgba(255,255,255,${0.7 + p})`; ctx.fillRect(0, H / 2 - hgt / 2, W, hgt)
      if (hasFrom) { ctx.globalAlpha = 0.35; ctx.save(); ctx.translate(0, H / 2); ctx.scale(1, 0.02); ctx.translate(0, -H / 2); drawFrom(ctx); ctx.restore(); ctx.globalAlpha = 1 }
    } else {
      const k = smooth((p - 0.4) / 0.6)
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (hasTo) { ctx.save(); ctx.translate(0, H / 2); ctx.scale(0.4 + k * 0.6, Math.max(0.02, k)); ctx.translate(0, -H / 2); drawTo(ctx); ctx.restore() }
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * 0.5})`; ctx.fillRect(0, 0, W, H)
    }
  } else if (mode === 'phosphor') {
    if (hasTo) drawTo(ctx)
    const scr = a.takeScratch(); const s = scr.getContext('2d')!
    if (hasFrom) drawFrom(s)
    s.globalCompositeOperation = 'source-atop'
    s.fillStyle = `rgba(90,255,140,${0.5})`; s.fillRect(0, 0, W, H)
    s.globalCompositeOperation = 'source-over'
    ctx.save(); ctx.globalAlpha = (1 - e) * 0.85; ctx.filter = `blur(${((1 - e) * 14).toFixed(1)}px)`
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(scr, 0, 0); ctx.restore()
    a.releaseScratch(scr)
  } else if (mode === 'scan_crawl') {
    if (hasTo) drawTo(ctx)
    const y = (p * 1.4 - 0.2) * H
    const bh = H * 0.28
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, bh); ctx.clip()
    if (hasFrom) drawFrom(ctx)
    snow(ctx, W, H, I * 0.3, rnd)
    ctx.restore()
    ctx.fillStyle = `rgba(255,255,255,${0.35 + I * 0.3})`; ctx.fillRect(0, y, W, 2); ctx.fillRect(0, y + bh, W, 2)
  } else if (mode === 'color_bleed') {
    if (hasTo) drawTo(ctx)
    const off = (1 - e) * I * 60
    const scr = a.takeScratch(); const s = scr.getContext('2d')!
    if (hasTo) drawTo(s)
    ctx.save(); ctx.globalAlpha = (1 - e) * 0.5; ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'hue-rotate(90deg) saturate(2)'; ctx.drawImage(scr, off, 0)
    ctx.filter = 'hue-rotate(-90deg) saturate(2)'; ctx.drawImage(scr, -off, 0)
    ctx.restore()
    a.releaseScratch(scr)
  } else if (mode === 'vhs_track') {
    if (hasTo) drawTo(ctx)
    const y = (1 - p) * H * 1.1 - H * 0.06
    const bh = H * (0.08 + I * 0.08)
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, bh); ctx.clip()
    if (hasFrom) drawFrom(ctx)
    snow(ctx, W, H, 0.5 + I * 0.4, rnd)
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, y - 2, W, 2)
    ctx.fillStyle = `rgba(0,0,0,${I * 0.2})`
    for (let yy = 0; yy < H; yy += 4) ctx.fillRect(0, yy, W, 1)
  }
  ctx.restore()
}

// -------------------------------------------------------------------- OVERLAY
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawDeviceBody(ctx: CanvasRenderingContext2D, scene: string, W: number, H: number) {
  // Local space: the screen IS the full frame rect; bodies extend beyond it.
  const body = '#17171d', edge = '#2c2c36', detail = '#3a3a46'
  ctx.lineWidth = Math.max(2, W * 0.004)
  ctx.strokeStyle = edge
  ctx.fillStyle = body
  const m = (t: number, r: number, b: number, l: number) => { roundRect(ctx, -l, -t, W + l + r, H + t + b, W * 0.02); ctx.fill(); ctx.stroke() }
  if (scene === 'tv') {
    m(H * 0.14, W * 0.09, H * 0.2, W * 0.09)
    ctx.strokeStyle = detail
    ctx.beginPath(); ctx.moveTo(W * 0.3, -H * 0.13); ctx.lineTo(W * 0.12, -H * 0.42); ctx.moveTo(W * 0.7, -H * 0.13); ctx.lineTo(W * 0.9, -H * 0.4); ctx.stroke()
    ctx.fillStyle = detail
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W * (0.2 + i * 0.12), H + H * 0.1, W * 0.008, 0, 7); ctx.fill() }
  } else if (scene === 'phone') {
    m(H * 0.09, W * 0.05, H * 0.09, W * 0.05)
    ctx.fillStyle = '#000'
    roundRect(ctx, W * 0.42, -H * 0.055, W * 0.16, H * 0.035, H * 0.017); ctx.fill()
    ctx.fillStyle = detail; roundRect(ctx, W * 0.44, H + H * 0.03, W * 0.12, H * 0.012, H * 0.006); ctx.fill()
  } else if (scene === 'monitor') {
    m(H * 0.07, W * 0.04, H * 0.07, W * 0.04)
    ctx.fillStyle = body; ctx.fillRect(W * 0.44, H + H * 0.06, W * 0.12, H * 0.16)
    roundRect(ctx, W * 0.32, H + H * 0.21, W * 0.36, H * 0.035, H * 0.017); ctx.fill(); ctx.stroke()
  } else if (scene === 'camera') {
    m(H * 0.12, W * 0.08, H * 0.14, W * 0.08)
    ctx.fillStyle = body; roundRect(ctx, W * 0.36, -H * 0.24, W * 0.28, H * 0.12, H * 0.03); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#e33'; ctx.beginPath(); ctx.arc(W * 0.94, -H * 0.06, W * 0.012, 0, 7); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(W / 3, 0); ctx.lineTo(W / 3, H); ctx.moveTo((2 * W) / 3, 0); ctx.lineTo((2 * W) / 3, H); ctx.moveTo(0, H / 3); ctx.lineTo(W, H / 3); ctx.moveTo(0, (2 * H) / 3); ctx.lineTo(W, (2 * H) / 3); ctx.stroke()
  } else if (scene === 'projector') {
    m(H * 0.05, W * 0.03, H * 0.05, W * 0.03)
    ctx.strokeStyle = 'rgba(255,255,240,0.12)'; ctx.lineWidth = W * 0.002
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(W * 0.5, -H * 0.9); ctx.lineTo(W * (i / 4), 0); ctx.stroke() }
  } else if (scene === 'watch') {
    m(H * 0.16, W * 0.12, H * 0.16, W * 0.12)
    ctx.fillStyle = body
    ctx.fillRect(W * 0.3, -H * 0.7, W * 0.4, H * 0.56); ctx.fillRect(W * 0.3, H + H * 0.14, W * 0.4, H * 0.56)
    ctx.fillStyle = detail; roundRect(ctx, W + W * 0.12, H * 0.35, W * 0.03, H * 0.2, W * 0.01); ctx.fill()
  } else if (scene === 'tablet') {
    m(H * 0.08, W * 0.05, H * 0.08, W * 0.05)
    ctx.fillStyle = detail; ctx.beginPath(); ctx.arc(-W * 0.025, H / 2, W * 0.008, 0, 7); ctx.fill()
  } else if (scene === 'laptop') {
    m(H * 0.08, W * 0.05, H * 0.05, W * 0.05)
    ctx.fillStyle = body
    ctx.beginPath(); ctx.moveTo(-W * 0.09, H + H * 0.05); ctx.lineTo(W * 1.09, H + H * 0.05); ctx.lineTo(W * 1.16, H + H * 0.2); ctx.lineTo(-W * 0.16, H + H * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke()
  } else if (scene === 'console') {
    m(H * 0.1, W * 0.22, H * 0.1, W * 0.22)
    ctx.fillStyle = detail
    ctx.beginPath(); ctx.arc(-W * 0.11, H * 0.5, W * 0.035, 0, 7); ctx.fill()
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(W * (1.08 + (i % 2) * 0.05), H * (0.42 + Math.floor(i / 2) * 0.08), W * 0.014, 0, 7); ctx.fill() }
  } else if (scene === 'cinema') {
    ctx.fillStyle = '#3d0d12'
    ctx.fillRect(-W * 0.22, -H * 0.2, W * 0.24, H * 1.4); ctx.fillRect(W * 0.98, -H * 0.2, W * 0.24, H * 1.4)
    ctx.fillRect(-W * 0.22, -H * 0.2, W * 1.44, H * 0.16)
    ctx.strokeStyle = '#2a080c'; ctx.lineWidth = W * 0.006
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-W * 0.2 + i * W * 0.07, -H * 0.2); ctx.lineTo(-W * 0.2 + i * W * 0.07, H * 1.2); ctx.stroke() }
  }
}

function renderOverlay(a: PillarDrawArgs) {
  const { ctx, width: W, height: H, p, params, drawFrom, drawTo, hasFrom, hasTo } = a
  const scene = str(params, 'scene', 'tv')
  const motion = str(params, 'motion', 'flip')
  const seed = num(params, 'seed', 1)
  const rnd = stepRnd(seed, p, 10)
  // phases: zoom-out (0-0.35) / device moment (0.35-0.65) / zoom-in (0.65-1)
  let scale = 1, rot = 0, flipX = 1
  let content: 'from' | 'to' = p < 0.5 ? 'from' : 'to'
  let staticOn = 0
  if (p < 0.35) { scale = 1 - smooth(p / 0.35) * 0.5; content = 'from' }
  else if (p < 0.65) {
    const t = (p - 0.35) / 0.3
    scale = 0.5
    if (motion === 'flip') { flipX = Math.cos(Math.PI * t); if (Math.abs(flipX) < 0.15) staticOn = 0.5; content = t < 0.5 ? 'from' : 'to' }
    else if (motion === 'spin') { rot = t * Math.PI; content = t < 0.5 ? 'from' : 'to'; if (t > 0.42 && t < 0.58) staticOn = 0.4 }
    else if (motion === 'swing') { rot = Math.sin(t * Math.PI) * 0.4; content = t < 0.5 ? 'from' : 'to'; if (t > 0.44 && t < 0.56) staticOn = 0.45 }
    else if (motion === 'zoom') { scale = 0.5 + smooth(t) * 1.1; content = t < 0.5 ? 'from' : 'to'; if (t > 0.4 && t < 0.6) staticOn = 0.35 }
    else { content = t < 0.45 ? 'from' : 'to'; if (t > 0.35 && t < 0.6) staticOn = 0.8 }
  } else {
    const t = (p - 0.65) / 0.35
    scale = 0.5 + smooth(t) * 0.5
    content = 'to'
  }
  ctx.save()
  ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8)
  g.addColorStop(0, 'rgba(60,60,80,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.translate(W / 2, H / 2)
  ctx.scale(Math.max(0.02, scale * Math.abs(flipX || 0.02) * (flipX < 0 ? -1 : 1) || 0.02), scale)
  ctx.rotate(rot)
  ctx.translate(-W / 2, -H / 2)
  drawDeviceBody(ctx, scene, W, H)
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
  if (content === 'from' && hasFrom) drawFrom(ctx)
  else if (content === 'to' && hasTo) drawTo(ctx)
  if (staticOn > 0) snow(ctx, W, H, staticOn, rnd)
  ctx.restore()
  ctx.restore()
}

// -------------------------------------------------------------------- DISPATCH
export function drawPillarFamily(family: string, a: PillarDrawArgs) {
  if (family === 'glitch') renderGlitch(a)
  else if (family === 'blur') renderBlur(a)
  else if (family === 'dissolve') renderDissolve(a)
  else if (family === 'light') renderLight(a)
  else if (family === 'flicker') renderFlicker(a)
  else if (family === 'tv') renderTV(a)
  else if (family === 'overlay') renderOverlay(a)
  else if (family === 'scene') renderScene(a)
  else { if (a.hasFrom) a.drawFrom(a.ctx); else if (a.hasTo) a.drawTo(a.ctx) }
}

/* ------------------------------------------------------------------ */
/* Scene-recreation pillar — named scenes from the Drive-zip footage   */
/* study (youtube-audit/study/deep-study-1.md). Every renderer below    */
/* recreates one watched scene grammar and finishes through the SAME   */
/* constant-look pass (SCENE_LOOK): one fade curve, one grain, one      */
/* vignette — so all six recreations cut as one family.                */
/* ------------------------------------------------------------------ */

const SCENE_LOOK = {
  /** single shared fade curve: easeInOutCubic (the orb/line/divider all ride it) */
  fade: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  grain: 0.05,
  vignette: 0.16,
  warm: '255, 140, 60',   // comp-light key (M2 relight)
  cool: '120, 80, 200',   // comp-light ambient
  magenta: '255, 40, 200', // manga rim-glow pulse
  gold: '212, 175, 55',   // magnates divider
  line: '60, 255, 120',   // line draw-on stroke
}

function sceneFinish(a: PillarDrawArgs) {
  const { ctx, width: w, height: h } = a
  // constant vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, `rgba(0,0,0,${SCENE_LOOK.vignette})`)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  // constant grain (seeded per progress bucket so it breathes, never dances)
  const rnd = mulberry32(1000 + Math.floor(a.p * 12))
  ctx.fillStyle = `rgba(255,255,255,${SCENE_LOOK.grain})`
  for (let i = 0; i < 140; i++) ctx.fillRect(rnd() * w, rnd() * h, 1, 1)
}

/** M2_vjAseOns — comp-light relight: roto-matte dim, travelling light orb with
 *  falloff ring on an eased arc, then warm-key / cool-ambient relit incoming. */
function sceneCompLight(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  if (p < 0.5) {
    if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 1; ctx.filter = 'brightness(0.38) saturate(0.7)'; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
    // roto-matte proof: feathered silhouette ring around subject centre
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 5])
    ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.55, w * 0.16, h * 0.3, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  } else {
    if (a.hasTo) { ctx.save(); ctx.globalAlpha = (p - 0.5) * 2; a.drawTo(ctx); ctx.restore() }
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, `rgba(${SCENE_LOOK.warm},${0.28 * (1 - (p - 0.5) * 1.2)})`)
    g.addColorStop(1, `rgba(${SCENE_LOOK.cool},${0.22 * (1 - (p - 0.5) * 1.2)})`)
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }
  // travelling orb + falloff ring on the eased arc (accelerate then settle)
  const t = e
  const ox = w * (0.18 + 0.6 * t)
  const oy = h * (0.32 + 0.26 * Math.sin(Math.PI * t))
  const orb = ctx.createRadialGradient(ox, oy, 2, ox, oy, w * 0.16)
  orb.addColorStop(0, 'rgba(255,255,255,0.95)')
  orb.addColorStop(0.35, 'rgba(255,240,220,0.5)')
  orb.addColorStop(1, 'rgba(255,220,180,0)')
  ctx.fillStyle = orb
  ctx.fillRect(ox - w * 0.16, oy - w * 0.16, w * 0.32, w * 0.32)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(ox, oy, w * 0.11, 0, Math.PI * 2); ctx.stroke()
  sceneFinish(a)
}

/** RktZGRjji5g — CRT emulator: scanlines + posterize blotches (mask shown as
 *  grey amplitude map mid-cut) + RGB fringe on the attack. */
function sceneCrtBlotch(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const base = p < 0.5 ? a.hasFrom : a.hasTo
  if (p < 0.5 && a.hasFrom) a.drawFrom(ctx); else if (a.hasTo) a.drawTo(ctx)
  if (!base && p >= 0.5 && !a.hasTo && a.hasFrom) a.drawFrom(ctx)
  // RGB fringe on the attack only (smooth-text grammar: flicker at entry)
  if (p < 0.3) {
    const dx = (0.3 - p) * 40
    ctx.save(); ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'screen'
    ctx.translate(dx, 0); if (a.hasFrom) a.drawFrom(ctx); ctx.translate(-dx * 2, 0)
    ctx.fillStyle = 'rgba(255,0,60,0.08)'; ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
  // grey blotch amplitude-map (mask visualised) peaks mid-cut
  const blot = Math.sin(p * Math.PI)
  if (blot > 0.05) {
    const rnd = mulberry32(4242)
    ctx.save(); ctx.globalAlpha = blot * 0.5
    for (let i = 0; i < 14; i++) {
      const bx = rnd() * w, by = rnd() * h, br = (0.04 + rnd() * 0.1) * w
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(160,160,160,0.8)' : 'rgba(40,40,40,0.8)'
      ctx.beginPath(); ctx.ellipse(bx, by, br, br * (0.5 + rnd() * 0.8), rnd() * 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  // scanlines, constant across the family look
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.restore()
  sceneFinish(a)
}

/** jlDIX3Ky-hs — magnates split proof: before/after halves on a gold divider
 *  sweep with sparkle accent and the small "After" label. */
function sceneMagnaSplit(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  const dx = w * e
  if (a.hasFrom) { ctx.save(); ctx.beginPath(); ctx.rect(dx, 0, w - dx, h); ctx.clip(); a.drawFrom(ctx); ctx.restore() }
  if (a.hasTo) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, dx, h); ctx.clip(); a.drawTo(ctx); ctx.restore() }
  // gold divider + soft glow
  const g = ctx.createLinearGradient(dx - 14, 0, dx + 14, 0)
  g.addColorStop(0, 'rgba(212,175,55,0)')
  g.addColorStop(0.5, `rgba(${SCENE_LOOK.gold},0.95)`)
  g.addColorStop(1, 'rgba(212,175,55,0)')
  ctx.fillStyle = g; ctx.fillRect(dx - 14, 0, 28, h)
  ctx.fillStyle = `rgba(${SCENE_LOOK.gold},1)`; ctx.fillRect(dx - 1.5, 0, 3, h)
  // sparkle accent riding the divider top
  const sy = h * (0.22 + 0.1 * Math.sin(p * 9))
  ctx.save(); ctx.strokeStyle = 'rgba(255,250,230,0.95)'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(dx - 12, sy); ctx.lineTo(dx + 12, sy)
  ctx.moveTo(dx, sy - 12); ctx.lineTo(dx, sy + 12)
  ctx.stroke(); ctx.restore()
  if (p > 0.55) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (p - 0.55) * 4)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '600 22px system-ui, sans-serif'
    ctx.fillText('After', 24, h - 26)
    ctx.restore()
  }
  sceneFinish(a)
}

/** kZskcvTkAjs — line draw-on: green stroke trims on with a travelling bend,
 *  then splits open vertically to reveal the incoming clip. */
function sceneLineDraw(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  if (p < 0.68) { if (a.hasFrom) a.drawFrom(ctx) } else {
    const open = SCENE_LOOK.fade((p - 0.68) / 0.32) * h / 2
    if (a.hasFrom) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h / 2 - open); ctx.rect(0, h / 2 + open, w, h); ctx.clip(); a.drawFrom(ctx); ctx.restore() }
    if (a.hasTo) { ctx.save(); ctx.beginPath(); ctx.rect(0, h / 2 - open, w, open * 2); ctx.clip(); a.drawTo(ctx); ctx.restore() }
  }
  const trim = SCENE_LOOK.fade(Math.min(1, p / 0.6))
  const x0 = w * 0.12, x1 = x0 + (w * 0.76) * trim
  ctx.save()
  ctx.strokeStyle = `rgba(${SCENE_LOOK.line},0.95)`
  ctx.lineWidth = 3.5
  ctx.shadowColor = `rgba(${SCENE_LOOK.line},0.8)`
  ctx.shadowBlur = 10
  ctx.beginPath()
  for (let x = x0; x <= x1; x += 6) {
    const y = h / 2 + Math.sin((x / w) * 5 + p * 6) * 9 * trim
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
  sceneFinish(a)
}

/** khjRWWTYZcc — manga rim-glow pulse: magenta rim pulses around the outgoing
 *  silhouette, then a warm grade crossfade into the incoming clip. */
function sceneRimGlow(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const pulse = Math.sin(p * Math.PI) * (0.6 + 0.4 * Math.sin(p * 22))
  if (p < 0.6) {
    if (a.hasFrom) a.drawFrom(ctx)
    // rim glow: blurred magenta silhouette behind a re-drawn subject
    const sc = a.takeScratch()
    sc.width = w; sc.height = h
    const sctx = sc.getContext('2d')!
    sctx.filter = 'blur(10px)'
    if (a.hasFrom) a.drawFrom(sctx)
    sctx.filter = 'none'
    sctx.globalCompositeOperation = 'source-in'
    sctx.fillStyle = `rgba(${SCENE_LOOK.magenta},${0.85 * pulse})`
    sctx.fillRect(0, 0, w, h)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(sc, 0, 0); ctx.restore()
    a.releaseScratch(sc)
  } else {
    const t = (p - 0.6) / 0.4
    if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 1 - t; a.drawFrom(ctx); ctx.restore() }
    if (a.hasTo) { ctx.save(); ctx.globalAlpha = t; a.drawTo(ctx); ctx.restore() }
    ctx.save(); ctx.globalAlpha = (1 - t) * 0.3
    const g = ctx.createLinearGradient(0, h, w, 0)
    g.addColorStop(0, `rgba(${SCENE_LOOK.warm},0.8)`); g.addColorStop(1, `rgba(${SCENE_LOOK.cool},0.6)`)
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore()
  }
  sceneFinish(a)
}

/** jlDIX3Ky-hs — mosaic pixel shift: mosaic cells shrink & row-shift out of
 *  the outgoing frame into the incoming clip (documentary pixel transition). */
function sceneMosaicPix(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  if (a.hasTo) { ctx.save(); ctx.globalAlpha = e; a.drawTo(ctx); ctx.restore() }
  const cell = Math.max(8, Math.round(72 * (1 - e) + 8))
  const sc = a.takeScratch()
  sc.width = Math.max(2, Math.floor(w / cell)); sc.height = Math.max(2, Math.floor(h / cell))
  const sctx = sc.getContext('2d')!
  if (a.hasFrom) a.drawFrom(sctx)
  ctx.save()
  ctx.globalAlpha = 1 - e
  ctx.imageSmoothingEnabled = false
  const rnd = mulberry32(77)
  const rows = Math.ceil(h / cell)
  for (let r = 0; r < rows; r++) {
    const off = (rnd() - 0.5) * 2 * cell * 3 * (1 - e)
    ctx.drawImage(sc, 0, (r * sc.height) / rows, sc.width, sc.height / rows, off, r * cell, w, cell)
  }
  ctx.imageSmoothingEnabled = true
  ctx.restore()
  a.releaseScratch(sc)
  sceneFinish(a)
}

/** pztANrbFI3w — roto polygon as hero: polygon outline draws on alone over a
 *  dark field, then sits over the footage, then fades into a graded hold. */
function sceneRotoPoly(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const pts = 9
  const poly = (scale: number) => {
    ctx.beginPath()
    for (let i = 0; i <= pts; i++) {
      const t = (i / pts) * Math.PI * 2
      const r = scale * (0.2 + 0.05 * Math.sin(t * 3))
      const x = w * 0.5 + Math.cos(t) * r * w * 0.5
      const y = h * 0.52 + Math.sin(t) * r * h * 0.62
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  if (p < 0.4) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
    const draw = SCENE_LOOK.fade(p / 0.4)
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2
    ctx.setLineDash([draw * 900, 900])
    poly(1); ctx.stroke(); ctx.restore()
  } else {
    const g = SCENE_LOOK.fade(Math.min(1, (p - 0.4) / 0.3))
    if (a.hasFrom) { ctx.save(); ctx.filter = `saturate(${1 - 0.4 * g}) brightness(${1 - 0.15 * g})`; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
    else if (a.hasTo) a.drawTo(ctx)
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - Math.max(0, (p - 0.75) / 0.25))})`; ctx.lineWidth = 2
    poly(1); ctx.stroke(); ctx.restore()
    if (p > 0.75) { ctx.save(); ctx.globalAlpha = (p - 0.75) * 1.6; ctx.fillStyle = 'rgba(60,90,200,0.16)'; ctx.fillRect(0, 0, w, h); ctx.restore() }
  }
  sceneFinish(a)
}

/** AsHnacGDo6E — rounded TV mask constant frame: content lives inside a rounded
 *  TV with scanlines and a bottom reflection; static burst opens the cut. */
function sceneTvMask(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  if (p < 0.12) {
    const rnd = mulberry32(9)
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(${rnd() * 255 | 0},${rnd() * 255 | 0},${rnd() * 255 | 0},0.5)`; ctx.fillRect(0, y, w, 1) }
    sceneFinish(a); return
  }
  const grow = SCENE_LOOK.fade(Math.min(1, (p - 0.12) / 0.3))
  const tw = w * 0.72 * grow, th = h * 0.6 * grow
  const x = (w - tw) / 2, y = (h - th) / 2 - h * 0.05
  const rr = Math.min(tw, th) * 0.12
  const round = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, r: number) => {
    c.beginPath()
    c.moveTo(rx + r, ry); c.arcTo(rx + rw, ry, rx + rw, ry + rh, r); c.arcTo(rx + rw, ry + rh, rx, ry + rh, r)
    c.arcTo(rx, ry + rh, rx, ry, r); c.arcTo(rx, ry, rx + rw, ry, r); c.closePath()
  }
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h)
  ctx.save(); round(ctx, x, y, tw, th, rr); ctx.clip()
  if (p < 0.55 && a.hasFrom) a.drawFrom(ctx); else if (a.hasTo) a.drawTo(ctx); else if (a.hasFrom) a.drawFrom(ctx)
  ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'
  for (let sy = y; sy < y + th; sy += 3) ctx.fillRect(x, sy, tw, 1)
  ctx.restore()
  // bottom reflection of the TV
  ctx.save(); ctx.globalAlpha = 0.16; ctx.translate(0, y + th * 2 + h * 0.06); ctx.scale(1, -1)
  round(ctx, x, y, tw, th, rr); ctx.clip()
  if (a.hasFrom) a.drawFrom(ctx); else if (a.hasTo) a.drawTo(ctx)
  ctx.restore()
  sceneFinish(a)
}

/** Z8EAr0p6X14 — slit-scan red arch + halftone dot field: red arch band expands
 *  over a red-tinted frame, halftone dots ramp in and become the outro bed. */
function sceneSlitHalftone(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  if (a.hasFrom) { ctx.save(); ctx.filter = 'sepia(0.6) hue-rotate(-30deg) saturate(2.4)'; ctx.globalAlpha = 1 - e * 0.5; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
  // red slit arch: vertical band w/ arched top expanding from centre
  const bw = w * 0.34 * e
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(w / 2 - bw, h); ctx.lineTo(w / 2 - bw, h * 0.42)
  ctx.quadraticCurveTo(w / 2, h * (0.42 - 0.24 * e), w / 2 + bw, h * 0.42)
  ctx.lineTo(w / 2 + bw, h); ctx.closePath()
  ctx.fillStyle = 'rgba(200,20,30,0.5)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
  // halftone dot field ramps in over everything
  const dot = Math.max(0, (p - 0.35) / 0.65)
  if (dot > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * dot
    ctx.fillStyle = '#fff'
    const step = Math.max(6, 14 - dot * 6)
    for (let y = 0; y < h; y += step) for (let x = ((y / step) | 0) % 2 ? step / 2 : 0; x < w; x += step) {
      ctx.beginPath(); ctx.arc(x, y, dot * 2.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  sceneFinish(a)
}

/** WC1tT1B5o_w — fisheye-circle typo sting: circular lens bulge of the incoming
 *  clip with a white ring, glitch-warp bands around it on the attack. */
function sceneFisheyeSting(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  if (a.hasFrom) a.drawFrom(ctx)
  const e = SCENE_LOOK.fade(Math.min(1, p / 0.7))
  const r = Math.min(w, h) * (0.12 + 0.34 * e)
  // glitch-warp bands on the attack
  if (p < 0.35) {
    const rnd = mulberry32(31)
    ctx.save(); ctx.globalAlpha = 0.5
    for (let i = 0; i < 8; i++) {
      const by = rnd() * h, bh = 4 + rnd() * 18, dx = (rnd() - 0.5) * 60 * (0.35 - p)
      ctx.drawImage(ctx.canvas, 0, by, w, bh, dx, by, w, bh)
    }
    ctx.restore()
  }
  // fisheye lens: incoming clip magnified inside the circle
  if (a.hasTo) {
    const sc = a.takeScratch(); sc.width = w; sc.height = h
    const sctx = sc.getContext('2d')!
    a.drawTo(sctx)
    ctx.save()
    ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.clip()
    const m = 1.45
    ctx.drawImage(sc, w / 2 - (w / 2) * m, h / 2 - (h / 2) * m, w * m, h * m)
    ctx.restore()
    a.releaseScratch(sc)
  }
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  if (p > 0.45) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (p - 0.45) * 3)
    ctx.fillStyle = '#fff'; ctx.font = '800 44px system-ui, sans-serif'
    ctx.textAlign = 'center'; ctx.fillText('NIKA', w / 2, h / 2 + 14); ctx.textAlign = 'left'
    ctx.restore()
  }
  sceneFinish(a)
}

/** BP4xGE9iUtU — spotlight typo stage: grey field + spotlight ellipse; scattered
 *  inverted 3D typo fragments with drop shadows settle onto the stage. */
function sceneSpotlightTypo(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 0, w, h)
  const sp = ctx.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.42, w * 0.42)
  sp.addColorStop(0, 'rgba(255,255,255,0.95)')
  sp.addColorStop(0.7, 'rgba(255,255,255,0.55)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.42, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill()
  if (p > 0.35 && a.hasTo) { ctx.save(); ctx.globalAlpha = (p - 0.35) * 1.2; ctx.globalCompositeOperation = 'multiply'; a.drawTo(ctx); ctx.restore() }
  else if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'multiply'; a.drawFrom(ctx); ctx.restore() }
  // scattered inverted typo fragments settle with eased offsets + shadows
  const frags = ['SO', 'THIS', 'SHIT']
  ctx.save()
  ctx.font = '900 64px system-ui, sans-serif'
  frags.forEach((t, i) => {
    const settle = SCENE_LOOK.fade(Math.min(1, Math.max(0, (p - 0.15 - i * 0.12) / 0.4)))
    const bx = w * (0.3 + i * 0.16) + (1 - settle) * (i % 2 ? 90 : -90)
    const by = h * (0.34 + i * 0.14) + (1 - settle) * 60
    ctx.save()
    ctx.translate(bx, by); ctx.rotate((i - 1) * 0.22 + Math.PI)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(t, 4, 5)
    ctx.fillStyle = i === 2 ? 'rgba(160,30,40,0.9)' : 'rgba(70,70,70,0.9)'
    ctx.fillText(t, 0, 0)
    ctx.restore()
  })
  ctx.restore()
  void e
  sceneFinish(a)
}

/** jZiwWHV7M54 — neon crescent arc sting: two red neon arcs frame the mouth
 *  where stacked CTA typos enter; arc glow breathes on the shared fade. */
function sceneNeonArc(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  ctx.fillStyle = '#0a0000'; ctx.fillRect(0, 0, w, h)
  if (p > 0.5 && a.hasTo) { ctx.save(); ctx.globalAlpha = (p - 0.5) * 0.5; a.drawTo(ctx); ctx.restore() }
  else if (p <= 0.5 && a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.25; a.drawFrom(ctx); ctx.restore() }
  const breathe = 0.75 + 0.25 * Math.sin(SCENE_LOOK.fade(p) * Math.PI)
  ctx.save()
  ctx.strokeStyle = `rgba(255,40,50,${0.9 * breathe})`
  ctx.lineWidth = 5
  ctx.shadowColor = 'rgba(255,30,40,0.9)'; ctx.shadowBlur = 24
  ctx.beginPath(); ctx.arc(w / 2, -h * 0.28, h * 0.62, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke()
  ctx.beginPath(); ctx.arc(w / 2, h * 1.28, h * 0.62, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke()
  ctx.restore()
  const ctas = ['AvoidAEP', 'Discord', 'Link in Bio']
  ctx.save(); ctx.textAlign = 'center'
  ctas.forEach((t, i) => {
    const on = SCENE_LOOK.fade(Math.min(1, Math.max(0, (p - 0.2 - i * 0.15) / 0.3)))
    if (on <= 0) return
    ctx.globalAlpha = on
    ctx.fillStyle = i === 2 ? 'rgba(255,80,80,0.95)' : 'rgba(255,120,120,0.8)'
    ctx.font = `${i === 2 ? '800 40px' : '700 26px'} system-ui, sans-serif`
    ctx.fillText(t, w / 2, h * (0.42 + i * 0.1))
  })
  ctx.restore()
  sceneFinish(a)
}

/** YOCiH8zHGic — logo cloud over classical art: app-name typos float placed
 *  around the frame; the hero app name enters late with a glow. */
function sceneLogoCloud(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  if (a.hasFrom) { ctx.save(); ctx.filter = 'sepia(0.7) brightness(0.9)'; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
  else if (a.hasTo) { ctx.save(); ctx.filter = 'sepia(0.7) brightness(0.9)'; a.drawTo(ctx); ctx.filter = 'none'; ctx.restore() }
  const names: [string, number, number][] = [
    ['Premiere', 0.5, 0.18], ['Photoshop', 0.26, 0.3], ['Illustrator', 0.72, 0.3],
    ['InDesign', 0.5, 0.44], ['Lightroom', 0.2, 0.62], ['Acrobat', 0.42, 0.74], ['Canva', 0.68, 0.62],
  ]
  ctx.save(); ctx.textAlign = 'center'
  names.forEach(([t, fx, fy], i) => {
    const on = SCENE_LOOK.fade(Math.min(1, Math.max(0, (p - i * 0.06) / 0.25)))
    if (on <= 0) return
    ctx.globalAlpha = on * 0.9
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '600 22px system-ui, sans-serif'
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6
    ctx.fillText(t, w * fx, h * fy + (1 - on) * 14)
  })
  const hero = SCENE_LOOK.fade(Math.min(1, Math.max(0, (p - 0.6) / 0.3)))
  if (hero > 0) {
    ctx.globalAlpha = hero
    ctx.fillStyle = '#fff'
    ctx.font = '800 40px system-ui, sans-serif'
    ctx.shadowColor = 'rgba(120,160,255,0.9)'; ctx.shadowBlur = 18
    ctx.fillText('After Effects', w / 2, h * 0.32 - (1 - hero) * 20)
  }
  ctx.restore()
  sceneFinish(a)
}

/** GP-dx6ruQQA / -SZcpYq49v8 — grade-compare rhythm: one comp cut through
 *  graded states (plain / desat / dark / warm) on the shared fade, with a
 *  curve-graph proof inset on the second state. */
function sceneGradeCompare(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const states = [
    'none',
    'saturate(0.25) brightness(1.05)',
    'saturate(1.5) contrast(1.25) brightness(0.85)',
    'sepia(0.5) hue-rotate(-18deg) saturate(2.2)',
  ]
  const idx = Math.min(states.length - 1, Math.floor(p * states.length))
  const src = idx % 2 === 0 ? a.hasFrom : a.hasTo
  const draw = idx % 2 === 0 ? a.drawFrom : a.drawTo
  if (src) { ctx.save(); ctx.filter = states[idx]; draw(ctx); ctx.filter = 'none'; ctx.restore() }
  else if (a.hasFrom) { ctx.save(); ctx.filter = states[idx]; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
  // state label chip
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(16, h - 44, 150, 28)
  ctx.fillStyle = '#fff'; ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillText(['plain', 'desat', 'crush', 'warm'][idx], 28, h - 24)
  ctx.restore()
  // curve-graph proof inset on the second state
  if (idx === 1) {
    const gx = w - 190, gy = h - 150, gs = 130
    ctx.save()
    ctx.strokeStyle = 'rgba(190,80,255,0.95)'; ctx.lineWidth = 3
    ctx.strokeRect(gx - 6, gy - 6, gs + 12, gs + 12)
    ctx.fillStyle = 'rgba(20,20,20,0.9)'; ctx.fillRect(gx, gy, gs, gs)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(gx, gy + gs)
    ctx.bezierCurveTo(gx + gs * 0.5, gy + gs, gx + gs * 0.35, gy, gx + gs, gy)
    ctx.stroke()
    ctx.restore()
  }
  sceneFinish(a)
}

/** chIJCGNoGls — X-slash sky: red X-slash strokes draw on with their diagonal
 *  speed-graph inset bottom-right, radial ray burst at the impact beat. */
function sceneXslashGraph(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  if (a.hasFrom) { ctx.save(); ctx.filter = 'saturate(1.2) brightness(1.1)'; a.drawFrom(ctx); ctx.filter = 'none'; ctx.restore() }
  const draw = SCENE_LOOK.fade(Math.min(1, p / 0.55))
  ctx.save()
  ctx.strokeStyle = 'rgba(230,30,60,0.95)'
  ctx.lineWidth = 7
  ctx.shadowColor = 'rgba(230,30,60,0.8)'; ctx.shadowBlur = 14
  const cx = w / 2, cy = h * 0.42, len = Math.max(w, h) * 0.75 * draw
  ctx.beginPath(); ctx.moveTo(cx - len / 2, cy - len / 4); ctx.lineTo(cx - len / 2 + len * draw, cy - len / 4 + len / 2 * draw); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + len / 2, cy - len / 4); ctx.lineTo(cx + len / 2 - len * draw, cy - len / 4 + len / 2 * draw); ctx.stroke()
  ctx.restore()
  // radial ray burst at the impact beat
  const burst = Math.sin(Math.min(1, Math.max(0, (p - 0.5) / 0.3)) * Math.PI)
  if (burst > 0.02) {
    ctx.save(); ctx.globalAlpha = burst * 0.85
    ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 3
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(t) * w * 0.06, cy + Math.sin(t) * w * 0.06)
      ctx.lineTo(cx + Math.cos(t) * w * (0.06 + 0.3 * burst), cy + Math.sin(t) * w * (0.06 + 0.3 * burst))
      ctx.stroke()
    }
    ctx.restore()
  }
  // diagonal speed-graph inset bottom-right (the curve that drives the slash)
  const gx = w - 200, gy = h - 130, gs = 110
  ctx.save()
  ctx.fillStyle = 'rgba(15,15,15,0.85)'; ctx.fillRect(gx, gy, gs, gs)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gs, gs)
  ctx.strokeStyle = 'rgba(120,220,120,0.95)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(gx, gy + gs); ctx.lineTo(gx + gs * draw, gy + gs - gs * draw); ctx.stroke()
  ctx.restore()
  sceneFinish(a)
}

/** LqfUhkr2vcc — 3D thumbnail card wall: perspective grid of cards flies the
 *  incoming clip in as the hero thumb; green grid + yellow typo constant. */
function sceneThumbWall(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, w, h)
  const e = SCENE_LOOK.fade(p)
  const cols = 4, rows = 3
  const cw = w * 0.16, ch = h * 0.2
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const z = 0.55 + 0.45 * e
    const px = w / 2 + (c - (cols - 1) / 2) * cw * 1.35 * z - (c - (cols - 1) / 2) * w * 0.06 * (1 - e)
    const py = h / 2 + (r - (rows - 1) / 2) * ch * 1.5 * z
    const hero = r === 1 && c === 2
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(z, z)
    ctx.fillStyle = hero ? '#123' : '#1a1e24'
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
    ctx.strokeStyle = hero ? 'rgba(255,220,60,0.9)' : 'rgba(80,200,120,0.5)'
    ctx.lineWidth = hero ? 3 : 1.2
    ctx.strokeRect(-cw / 2, -ch / 2, cw, ch)
    if (hero && a.hasTo) { ctx.beginPath(); ctx.rect(-cw / 2, -ch / 2, cw, ch); ctx.clip(); a.drawTo(ctx); }
    else if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.rect(-cw / 2, -ch / 2, cw, ch); ctx.clip(); a.drawFrom(ctx); ctx.restore() }
    ctx.restore()
  }
  ctx.save(); ctx.fillStyle = 'rgba(255,220,60,0.95)'; ctx.font = '800 30px system-ui, sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8
  ctx.fillText('editing videos', w * 0.08, h * 0.86)
  ctx.restore()
  sceneFinish(a)
}

/** YHJUoaPcyqg — cut-out proof: transparency checker field with the cut-out
 *  subject, then the neutral-grey hold the channel ends on. */
function sceneCutoutChecker(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const neutral = p > 0.55
  if (neutral) { ctx.fillStyle = '#3f4348'; ctx.fillRect(0, 0, w, h) }
  else {
    const cell = 18
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) | 0) % 2 ? '#c9ccd1' : '#eef0f2'
      ctx.fillRect(x, y, cell, cell)
    }
  }
  const src = a.hasFrom ? a.drawFrom : a.drawTo
  if (src) { ctx.save(); ctx.globalAlpha = neutral ? 1 : 0.96; src(ctx); ctx.restore() }
  // red spiral-eye accent sting on the proof half
  if (!neutral) {
    ctx.save(); ctx.strokeStyle = 'rgba(220,30,40,0.9)'; ctx.lineWidth = 3
    ctx.beginPath()
    for (let t = 0; t < Math.PI * 5; t += 0.2) {
      const r = t * 4
      const x = w * 0.78 + Math.cos(t) * r, y = h * 0.3 + Math.sin(t) * r
      t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke(); ctx.restore()
  }
  sceneFinish(a)
}

/** eB10bFHlz7Y / 2AuOLEmEAkU — 3D proof beats: material sphere row along the
 *  bottom + wireframe camera arc over a warm bokeh bed behind the incoming. */
function sceneMaterialSpheres(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  drawReplaceBg(ctx, w, h, p * 2, 'bokeh')
  const e = SCENE_LOOK.fade(p)
  if (a.hasTo) { ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * e; a.drawTo(ctx); ctx.restore() }
  else if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.5; a.drawFrom(ctx); ctx.restore() }
  // wireframe camera arc
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.55); ctx.quadraticCurveTo(w * 0.5, h * (0.18 - 0.06 * e), w * 0.85, h * 0.55); ctx.stroke()
  const camX = w * (0.15 + 0.7 * e), camY = h * 0.55 - Math.sin(Math.PI * e) * h * 0.3
  ctx.strokeRect(camX - 10, camY - 7, 20, 14)
  ctx.beginPath(); ctx.moveTo(camX, camY); ctx.lineTo(w * 0.5, h * 0.5); ctx.stroke()
  ctx.restore()
  // material sphere row
  const n = 8
  for (let i = 0; i < n; i++) {
    const x = w * (0.14 + (i / (n - 1)) * 0.72), y = h * 0.86, r = Math.min(w, h) * 0.035
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r)
    const hues = ['200,200,205', '150,90,200', '220,180,90', '90,160,90', '200,60,60', '240,240,245', '60,120,200', '230,140,60']
    g.addColorStop(0, `rgba(255,255,255,0.95)`)
    g.addColorStop(0.35, `rgba(${hues[i]},0.9)`)
    g.addColorStop(1, `rgba(20,20,25,0.95)`)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  sceneFinish(a)
}

/* ------------------------------------------------------------------ */
/* Chat-history wave (WhatsApp zip links, techniques 49-54): quote     */
/* band card + mono micro-caps typo. Same SCENE_LOOK finish so they    */
/* cut as one family with the Drive-zip recreations.                   */
/* ------------------------------------------------------------------ */

function sceneQuoteBand(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const e = SCENE_LOOK.fade(p)
  if (p < 0.8) {
    if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.5 * e; ctx.filter = 'grayscale(1)'; a.drawFrom(ctx); ctx.restore(); ctx.filter = 'none' }
  } else if (a.hasTo) {
    const fl = Math.sin(Math.PI * clamp01((p - 0.8) / 0.2))
    ctx.save(); ctx.globalAlpha = 0.85; a.drawTo(ctx); ctx.restore()
    if (fl > 0.35) { ctx.fillStyle = `rgba(255,240,244,${0.75 * fl})`; ctx.fillRect(0, 0, w, h) }
  }
  const bandH = Math.max(34, h * 0.13)
  const y = -bandH + bandH * SCENE_LOOK.fade(clamp01(p / 0.3))
  ctx.fillStyle = '#f5f2ec'
  ctx.fillRect(0, y, w, bandH)
  const q1 = "Trust yourself — you've "
  const acc = 'survived'
  const q2 = ' a lot'
  ctx.font = `italic bold ${Math.round(bandH * 0.42)}px Georgia, serif`
  ctx.textBaseline = 'middle'
  const fs = Math.round(bandH * 0.42)
  const mw = (t: string) => ctx.measureText(t)?.width ?? fs * 0.5 * t.length
  const w1 = mw(q1)
  const wa = mw(acc)
  const w2 = mw(q2)
  const x0 = (w - (w1 + wa + w2)) / 2
  const reveal = clamp01((p - 0.18) / 0.3)
  ctx.save()
  ctx.beginPath(); ctx.rect(0, y, w * reveal, bandH); ctx.clip()
  ctx.fillStyle = '#141414'; ctx.fillText(q1, x0, y + bandH / 2)
  ctx.fillStyle = '#c22323'; ctx.fillText(acc, x0 + w1, y + bandH / 2)
  ctx.fillStyle = '#141414'; ctx.fillText(q2, x0 + w1 + wa, y + bandH / 2)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  if (p > 0.75) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `${Math.max(9, Math.round(h * 0.035))}px sans-serif`
    ctx.textAlign = 'center'; ctx.fillText('real growth starts within', w / 2, h * 0.94); ctx.textAlign = 'left'
  }
  sceneFinish(a)
}

function sceneMonoTypo(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  const whip = p > 0.45 && p < 0.62
  const draw = (fn: (c: CanvasRenderingContext2D) => void, alpha: number, dx = 0) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.filter = 'grayscale(1) contrast(1.35)'
    if (dx) ctx.translate(dx, 0)
    fn(ctx); ctx.restore(); ctx.filter = 'none'
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
  if (p < 0.62) {
    if (a.hasFrom) {
      draw(a.drawFrom, 0.9)
      if (whip) for (let i = 1; i <= 4; i++) draw(a.drawFrom, 0.16, -i * w * 0.03 * ((p - 0.45) / 0.17))
    }
  } else if (a.hasTo) draw(a.drawTo, 0.9)
  ctx.fillStyle = `rgba(0,0,0,${0.28 + 0.1 * (1 - e)})`; ctx.fillRect(0, 0, w, h)
  const line = "YOU CAN'T BREAK A PERSON"
  const size = Math.max(9, Math.round(h * 0.045))
  ctx.font = `600 ${size}px sans-serif`
  const ls = size * 0.42
  const chars = [...line]
  const widths = chars.map((c) => ctx.measureText(c)?.width ?? size * 0.62)
  const total = widths.reduce((s2, x) => s2 + x, 0) + ls * (chars.length - 1)
  let x = (w - total) / 2
  const appear = clamp01((p - 0.2) / 0.25)
  ctx.fillStyle = `rgba(240,240,240,${0.85 * appear})`
  chars.forEach((c, i) => { ctx.fillText(c, x, h * 0.52); x += widths[i] + ls })
  sceneFinish(a)
}

/* Chat-history short K2mSI59wPvg: minimal gradient-sky bed + one drifting
   hero object (paper plane) with a thin motion trail — technique 85. */
function sceneDriftTrail(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#4d94e8')
  g.addColorStop(0.75, '#cfe3f7')
  g.addColorStop(1, '#e8f1fb')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const x = w * (-0.08 + 1.16 * e)
  const y = h * (0.62 - 0.06 * Math.sin(Math.PI * e))
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1.1
  ctx.beginPath(); ctx.moveTo(w * 0.02, y + 2); ctx.lineTo(x - 10, y + 1); ctx.stroke()
  ctx.translate(x, y)
  ctx.rotate(-0.12 + 0.1 * Math.sin(Math.PI * e))
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill()
  ctx.restore()
  if (a.hasTo && p > 0.7) { ctx.save(); ctx.globalAlpha = ((p - 0.7) / 0.3) * 0.9; a.drawTo(ctx); ctx.restore() }
  else if (a.hasFrom) { ctx.save(); ctx.globalAlpha = 0.12; a.drawFrom(ctx); ctx.restore() }
  sceneFinish(a)
}

/* Hancybox short V9ApHueQbN0: anamorphic lens-flare streak on a black bed —
   technique 99. The flare swells on the shared fade curve, fringes chromatically,
   then hands off to the incoming clip. */
function sceneFlareSting(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.06 + 0.08 * (1 - e); a.drawFrom(ctx); ctx.restore() }
  const cx = w * (0.32 + 0.1 * e)
  const cy = h * 0.52
  const len = w * (0.1 + 0.16 * Math.sin(Math.PI * Math.min(1, p * 1.2)))
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, len * 1.6)
  glow.addColorStop(0, `rgba(255,255,255,${0.85 * Math.sin(Math.PI * Math.min(1, p * 1.1))})`)
  glow.addColorStop(0.25, 'rgba(160,190,255,0.35)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  // horizontal anamorphic streak with chromatic fringes
  const streak = (color: string, dy: number, alpha: number) => {
    ctx.fillStyle = color
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.ellipse(cx, cy + dy, len, Math.max(1, h * 0.006), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  streak('rgba(255,140,60,0.8)', 1.2, 0.7)
  streak('rgba(120,160,255,0.8)', -1.2, 0.7)
  streak('rgba(255,255,255,0.95)', 0, 0.9)
  // bright core dot (arc so headless stub-canvas QA can count it)
  const core = Math.max(1.5, h * 0.02 * Math.sin(Math.PI * Math.min(1, p * 1.1)))
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.arc(cx, cy, core, 0, Math.PI * 2)
  ctx.fill()
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

/* Hancybox wave-1 tricks (techniques 100-111): five new scene grammars. */
function sceneWedgeWipe(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.25 * (1 - e); a.drawFrom(ctx); ctx.restore() }
  const g = ctx.createLinearGradient(0, 0, w * 0.6, h)
  g.addColorStop(0, '#8c0d0d'); g.addColorStop(1, '#e01818')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w * (0.15 + 0.95 * e), 0)
  ctx.lineTo(w * (0.0 + 0.8 * e), h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

function sceneCardInset(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.1; a.drawFrom(ctx); ctx.restore() }
  const cw = w * 0.62, ch = h * 0.5
  const cx = (w - cw) / 2, cy = h * 0.12 + h * 0.06 * (1 - e)
  ctx.fillStyle = '#f4f4f2'
  ctx.fillRect(cx, cy, cw, ch)
  // feathered bottom edge
  const fg = ctx.createLinearGradient(0, cy + ch - h * 0.12, 0, cy + ch + h * 0.06)
  fg.addColorStop(0, 'rgba(244,244,242,1)'); fg.addColorStop(1, 'rgba(244,244,242,0)')
  ctx.fillStyle = fg
  ctx.fillRect(cx, cy + ch - h * 0.12, cw, h * 0.18)
  ctx.fillStyle = '#111'
  ctx.font = `bold ${Math.round(h * 0.05)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Reliable', w / 2, cy + ch * 0.5)
  ctx.textAlign = 'left'
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

function sceneGoldCard(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  const vg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7)
  vg.addColorStop(0, '#b9b9b9'); vg.addColorStop(1, '#5c5c5c')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.15; a.drawFrom(ctx); ctx.restore() }
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-0.16 + 0.06 * e)
  const cw = w * 0.3, ch = h * 0.42
  const gg = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2)
  gg.addColorStop(0, '#f6e27a'); gg.addColorStop(0.5, '#c9a227'); gg.addColorStop(1, '#f6e27a')
  ctx.fillStyle = gg
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5
  ctx.strokeRect(-cw / 2 + 4, -ch / 2 + 4, cw - 8, ch - 8)
  ctx.restore()
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

function sceneWireGlow(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.08; a.drawFrom(ctx); ctx.restore() }
  ctx.save()
  ctx.translate(w / 2, h / 2 + Math.sin(Math.PI * e) * h * 0.04)
  ctx.rotate(0.5 - 0.15 * e)
  ctx.shadowColor = 'rgba(60,220,255,0.9)'; ctx.shadowBlur = 18
  ctx.strokeStyle = 'rgba(120,235,255,0.95)'; ctx.lineWidth = 2
  ctx.strokeRect(-w * 0.06, -h * 0.2, w * 0.12, h * 0.4)
  ctx.strokeStyle = 'rgba(255,120,220,0.7)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(-w * 0.03, -h * 0.16); ctx.lineTo(w * 0.03, h * 0.16); ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

function sceneDualTypo(a: PillarDrawArgs) {
  const { ctx, width: w, height: h, p } = a
  const e = SCENE_LOOK.fade(p)
  ctx.fillStyle = '#0a0c10'
  ctx.fillRect(0, 0, w, h)
  if (a.hasFrom && p <= 0.6) { ctx.save(); ctx.globalAlpha = 0.35; a.drawFrom(ctx); ctx.restore() }
  const reveal = clamp01((p - 0.15) / 0.35)
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, w * reveal, h); ctx.clip()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(h * 0.075)}px sans-serif`
  ctx.fillText('Building blocks', w / 2, h * 0.46)
  ctx.fillStyle = '#e8d44d'
  ctx.font = `italic bold ${Math.round(h * 0.065)}px Georgia, serif`
  ctx.fillText('prompt', w / 2, h * 0.58)
  ctx.textAlign = 'left'
  ctx.restore()
  if (a.hasTo && p > 0.6) { ctx.save(); ctx.globalAlpha = ((p - 0.6) / 0.4) * 0.95; a.drawTo(ctx); ctx.restore() }
  sceneFinish(a)
}

function renderScene(a: PillarDrawArgs) {
  const style = str(a.params, 'style', 'relight')
  if (style === 'relight') sceneCompLight(a)
  else if (style === 'crt') sceneCrtBlotch(a)
  else if (style === 'magna') sceneMagnaSplit(a)
  else if (style === 'line') sceneLineDraw(a)
  else if (style === 'rim') sceneRimGlow(a)
  else if (style === 'mosaic') sceneMosaicPix(a)
  else if (style === 'roto') sceneRotoPoly(a)
  else if (style === 'tv') sceneTvMask(a)
  else if (style === 'slit') sceneSlitHalftone(a)
  else if (style === 'fisheye') sceneFisheyeSting(a)
  else if (style === 'spotlight') sceneSpotlightTypo(a)
  else if (style === 'arc') sceneNeonArc(a)
  else if (style === 'cloud') sceneLogoCloud(a)
  else if (style === 'compare') sceneGradeCompare(a)
  else if (style === 'xslash') sceneXslashGraph(a)
  else if (style === 'wall') sceneThumbWall(a)
  else if (style === 'cutout') sceneCutoutChecker(a)
  else if (style === 'spheres') sceneMaterialSpheres(a)
  else if (style === 'quote') sceneQuoteBand(a)
  else if (style === 'mono') sceneMonoTypo(a)
  else if (style === 'drift') sceneDriftTrail(a)
  else if (style === 'flare') sceneFlareSting(a)
  else if (style === 'wedge') sceneWedgeWipe(a)
  else if (style === 'card') sceneCardInset(a)
  else if (style === 'goldcard') sceneGoldCard(a)
  else if (style === 'wire') sceneWireGlow(a)
  else if (style === 'dualtypo') sceneDualTypo(a)
  else { if (a.hasFrom) a.drawFrom(a.ctx); else if (a.hasTo) a.drawTo(a.ctx) }
}
