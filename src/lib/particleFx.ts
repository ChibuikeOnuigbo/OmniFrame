/**
 * Particle / overlay / background-replace layers for clip effects.
 *
 * Scanned from the AE tutorial corpus (Study_edits_videos/deep-study-*.md):
 * feather & ember particle beds, dust/bokeh/sparkle overlays, scanline &
 * halftone looks, spotlight stages, and "replace the background with a cool
 * one" composite beds (synthwave grid, aurora, bokeh, sunset, studio).
 *
 * Pure canvas functions so they can be unit-tested headlessly
 * (qa/particle-fx-unit.mjs) and reused by playback.ts at every grade site.
 */
import type { ClipEffect } from '../types'

export const PARTICLE_KINDS = ['none', 'feathers', 'embers', 'dust', 'bokeh', 'sparkles', 'snow', 'rain', 'petals',
  // lens-blur matte/bokeh shape picker variety observed in downloaded frame 36_t070
  'bokeh-square', 'bokeh-plus', 'bokeh-triangle', 'bokeh-hexagon', 'bokeh-star', 'bokeh-bowtie', 'bokeh-slash'] as const
export const OVERLAY_KINDS = ['none', 'scanlines', 'halftone', 'spotlight', 'vignette', 'lightleak', 'frameglow'] as const
export const REPLACE_BG_KINDS = ['none', 'synthwave', 'aurora', 'grid', 'bokeh', 'sunset', 'studio'] as const

export type ParticleKind = (typeof PARTICLE_KINDS)[number]
export type OverlayKind = (typeof OVERLAY_KINDS)[number]
export type ReplaceBgKind = (typeof REPLACE_BG_KINDS)[number]

/** Shape-path helper for the bokeh beds: circle + the 36_t070 picker variety. */
function bokehShapePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, shape: string) {
  ctx.beginPath()
  if (shape === 'square') { ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); return }
  if (shape === 'slash') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6)
    ctx.rect(-r * 0.28, -r, r * 0.56, r * 2)
    ctx.restore(); return
  }
  if (shape === 'plus') {
    const t = r * 0.34
    ctx.moveTo(x - t, y - r); ctx.lineTo(x + t, y - r); ctx.lineTo(x + t, y - t); ctx.lineTo(x + r, y - t)
    ctx.lineTo(x + r, y + t); ctx.lineTo(x + t, y + t); ctx.lineTo(x + t, y + r); ctx.lineTo(x - t, y + r)
    ctx.lineTo(x - t, y + t); ctx.lineTo(x - r, y + t); ctx.lineTo(x - r, y - t); ctx.lineTo(x - t, y - t)
    ctx.closePath(); return
  }
  if (shape === 'bowtie') {
    ctx.moveTo(x - r, y - r * 0.8); ctx.lineTo(x, y); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath()
    ctx.moveTo(x + r, y - r * 0.8); ctx.lineTo(x, y); ctx.lineTo(x + r, y + r * 0.8); ctx.closePath(); return
  }
  const points = shape === 'triangle' ? 3 : shape === 'hexagon' ? 6 : shape === 'star' ? 10 : 0
  if (points === 0) { ctx.arc(x, y, r, 0, Math.PI * 2); return }
  const rot = shape === 'triangle' ? -Math.PI / 2 : 0
  for (let i = 0; i < points; i++) {
    const ang = rot + (i * 2 * Math.PI) / points
    const rr = shape === 'star' && i % 2 === 1 ? r * 0.45 : r
    const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = t + Math.imul(t ^ (t * 7), t | 61) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const fract = (x: number) => x - Math.floor(x)

export function hasParticleFx(e?: ClipEffect | null): boolean {
  return !!e && !!e.particleFx && e.particleFx !== 'none' && (e.particleDensity ?? 0.5) > 0
}
export function hasOverlayFx(e?: ClipEffect | null): boolean {
  return !!e && !!e.overlayFx && e.overlayFx !== 'none' && (e.overlayStrength ?? 0.5) > 0
}
export function hasReplaceBg(e?: ClipEffect | null): boolean {
  return !!e && !!e.replaceBg && e.replaceBg !== 'none'
}
export function hasClipFxLayers(e?: ClipEffect | null): boolean {
  return hasParticleFx(e) || hasOverlayFx(e) || hasReplaceBg(e)
}

/* ----------------------------- particles ------------------------------ */

export function drawParticleFx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  kind: ParticleKind,
  density = 0.5,
  tint = '#ffffff',
): void {
  if (kind === 'none') return
  const count = Math.round(8 + density * 72)
  const rnd = mulberry32(1234)
  ctx.save()
  for (let i = 0; i < count; i++) {
    const px = rnd(), phase = rnd(), speed = 0.05 + rnd() * 0.16, sway = rnd() * 2 - 1, size = rnd()
    const rise = kind === 'embers'
    const y = rise ? h * (1 - fract(phase + timeSec * speed)) : h * fract(phase + timeSec * speed)
    const x = w * fract(px + 0.12 * Math.sin(timeSec * (0.6 + speed * 4) + i) * sway + (kind === 'rain' ? timeSec * 0.25 : 0))
    ctx.globalAlpha = 0.35 + 0.5 * fract(phase * 7 + timeSec * 0.3)
    if (kind === 'feathers' || kind === 'petals') {
      const r = (kind === 'feathers' ? 10 : 7) * (0.6 + size)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.sin(timeSec * (0.8 + speed * 3) + i) * 0.9 + sway)
      ctx.fillStyle = kind === 'petals' ? 'rgba(255,150,190,0.85)' : tint
      ctx.beginPath()
      ctx.moveTo(0, -r)
      ctx.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.6, r * 0.5, 0, r)
      ctx.bezierCurveTo(-r * 0.6, r * 0.5, -r * 0.7, -r * 0.4, 0, -r)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.stroke()
      ctx.restore()
    } else if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(190,220,255,0.55)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 26); ctx.stroke()
    } else if (kind === 'sparkles') {
      const r = 3 + size * 6
      const tw = 0.5 + 0.5 * Math.sin(timeSec * 6 + i * 2.4)
      ctx.strokeStyle = `rgba(255,255,240,${0.85 * tw})`; ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y)
      ctx.moveTo(x, y - r); ctx.lineTo(x, y + r)
      ctx.stroke()
    } else if (kind === 'bokeh' || kind.startsWith('bokeh-')) {
      // bokeh bed; 'bokeh-<shape>' variants trace the BCC lens-blur shape/matte
      // picker grid read off downloaded frame 36_t070 (circle/square/plus/
      // triangle/hexagon/star/slash/bowtie).
      const r = (14 + size * 40)
      const g = ctx.createRadialGradient(x, y, 1, x, y, r)
      g.addColorStop(0, `rgba(255,230,180,${0.16 + size * 0.12})`)
      g.addColorStop(1, 'rgba(255,230,180,0)')
      ctx.fillStyle = g
      bokehShapePath(ctx, x, y, r, kind === 'bokeh' ? 'circle' : kind.slice(6))
      ctx.fill()
    } else {
      // embers / dust / snow dots
      const r = kind === 'embers' ? 1.6 + size * 2.6 : kind === 'snow' ? 1.4 + size * 2.4 : 0.8 + size * 1.4
      ctx.fillStyle = kind === 'embers' ? 'rgba(255,140,50,0.9)' : kind === 'dust' ? 'rgba(255,255,255,0.5)' : tint
      if (kind === 'embers') { ctx.shadowColor = 'rgba(255,120,40,0.9)'; ctx.shadowBlur = 8 } else ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    }
  }
  ctx.restore()
}

/* ------------------------------ overlays ------------------------------ */

export function drawOverlayFx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  kind: OverlayKind,
  strength = 0.5,
): void {
  if (kind === 'none') return
  ctx.save()
  if (kind === 'scanlines') {
    ctx.globalAlpha = 0.35 * strength; ctx.fillStyle = '#000'
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  } else if (kind === 'halftone') {
    ctx.globalAlpha = 0.4 * strength; ctx.fillStyle = '#000'
    const step = 8
    for (let y = 0; y < h; y += step) for (let x = ((y / step) | 0) % 2 ? step / 2 : 0; x < w; x += step) {
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
    }
  } else if (kind === 'spotlight' || kind === 'vignette') {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * (kind === 'spotlight' ? 0.18 : 0.4), w / 2, h * 0.45, Math.max(w, h) * 0.75)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${(kind === 'spotlight' ? 0.85 : 0.55) * strength})`)
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  } else if (kind === 'lightleak') {
    const pulse = 0.75 + 0.25 * Math.sin(timeSec * 1.7)
    const g = ctx.createRadialGradient(w * 0.15, h * 0.2, 10, w * 0.15, h * 0.2, Math.max(w, h) * 0.9)
    g.addColorStop(0, `rgba(255,190,120,${0.5 * strength * pulse})`)
    g.addColorStop(0.5, `rgba(255,120,60,${0.25 * strength * pulse})`)
    g.addColorStop(1, 'rgba(255,120,60,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  } else if (kind === 'frameglow') {
    ctx.globalAlpha = strength
    ctx.strokeStyle = 'rgba(140,200,255,0.55)'; ctx.lineWidth = 10
    ctx.shadowColor = 'rgba(120,190,255,0.9)'; ctx.shadowBlur = 26
    ctx.strokeRect(5, 5, w - 10, h - 10)
  }
  ctx.restore()
}

/* --------------------------- background beds --------------------------- */

export function drawReplaceBg(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number, kind: ReplaceBgKind): void {
  if (kind === 'none') return
  ctx.save()
  if (kind === 'synthwave' || kind === 'grid') {
    const top = kind === 'synthwave' ? '#1a0533' : '#04070c'
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, top); g.addColorStop(0.55, kind === 'synthwave' ? '#3d0f63' : '#071120'); g.addColorStop(1, '#000')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    const horizon = h * 0.62
    ctx.strokeStyle = kind === 'synthwave' ? 'rgba(255,60,200,0.8)' : 'rgba(60,220,255,0.7)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 12; i++) {
      const t = i / 12
      const y = horizon + (h - horizon) * t * t
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.06, horizon); ctx.lineTo(w / 2 + i * w * 0.42, h); ctx.stroke()
    }
    if (kind === 'synthwave') {
      const sg = ctx.createRadialGradient(w / 2, horizon, 4, w / 2, horizon, w * 0.22)
      sg.addColorStop(0, 'rgba(255,120,60,0.95)'); sg.addColorStop(1, 'rgba(255,60,160,0)')
      ctx.fillStyle = sg
      ctx.beginPath(); ctx.arc(w / 2, horizon, w * 0.22, Math.PI, 0); ctx.fill()
    }
  } else if (kind === 'aurora') {
    ctx.fillStyle = '#020608'; ctx.fillRect(0, 0, w, h)
    for (let b = 0; b < 4; b++) {
      const x = w * (0.2 + b * 0.2) + Math.sin(timeSec * 0.5 + b) * w * 0.05
      const g = ctx.createLinearGradient(x - w * 0.12, 0, x + w * 0.12, h)
      const col = b % 2 ? '80,255,180' : '120,120,255'
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},0.28)`); g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g
      ctx.save(); ctx.translate(x, h / 2); ctx.rotate(-0.35 + b * 0.12); ctx.fillRect(-w * 0.12, -h, w * 0.24, h * 2); ctx.restore()
    }
  } else if (kind === 'bokeh') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#101418'); g.addColorStop(1, '#1d130a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    const rnd = mulberry32(55)
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 12 + rnd() * 60
      const bg = ctx.createRadialGradient(x, y, 1, x, y, r)
      bg.addColorStop(0, `rgba(255,200,120,${0.1 + rnd() * 0.15})`); bg.addColorStop(1, 'rgba(255,200,120,0)')
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
  } else if (kind === 'sunset') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2b0f3a'); g.addColorStop(0.5, '#c2426b'); g.addColorStop(0.78, '#ff9a4d'); g.addColorStop(1, '#ffd98a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,236,180,0.95)'
    ctx.beginPath(); ctx.arc(w / 2, h * 0.66, Math.min(w, h) * 0.16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(43,15,58,0.5)'
    for (let i = 0; i < 5; i++) ctx.fillRect(0, h * (0.6 + i * 0.05), w, 3 + i * 2)
  } else if (kind === 'studio') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#3a3f45'); g.addColorStop(0.6, '#22262b'); g.addColorStop(1, '#101215')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    const sg = ctx.createRadialGradient(w * 0.3, h * 0.25, 8, w * 0.3, h * 0.25, w * 0.5)
    sg.addColorStop(0, 'rgba(255,255,255,0.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()
}

/* ------------------------- combined entry point ------------------------ */

let off: HTMLCanvasElement | null = null
function offscreen(w: number, h: number): HTMLCanvasElement {
  if (!off) off = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (off && (off.width !== w || off.height !== h)) { off.width = w; off.height = h }
  return off as HTMLCanvasElement
}

/** Background bed UNDER the keyed clip, then overlay + particles ON TOP. */
export function applyClipFxLayers(canvas: HTMLCanvasElement, e: ClipEffect, timeSec: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  if (hasReplaceBg(e)) {
    const o = offscreen(w, h)
    if (o) {
      const octx = o.getContext('2d')
      if (octx) {
        octx.clearRect(0, 0, w, h)
        drawReplaceBg(octx, w, h, timeSec, e.replaceBg as ReplaceBgKind)
        octx.drawImage(canvas, 0, 0)
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(o, 0, 0)
        ctx.restore()
      }
    }
  }
  if (hasOverlayFx(e)) drawOverlayFx(ctx, w, h, timeSec, e.overlayFx as OverlayKind, e.overlayStrength ?? 0.5)
  if (hasParticleFx(e)) drawParticleFx(ctx, w, h, timeSec, e.particleFx as ParticleKind, e.particleDensity ?? 0.5, e.particleTint ?? '#ffffff')
}
