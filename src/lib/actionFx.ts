/**
 * Time-based burst and aura effects shared by browser playback/export and the
 * headless MCP renderer. The source image is fragmented with deterministic
 * canvas geometry; no preview-only CSS or random frame state is used.
 */
import type { ClipEffect } from '../types'

export const BURST_FAMILIES = ['glass', 'crack', 'shatter', 'tiles', 'slice', 'shockwave', 'fireball', 'smoke', 'energy', 'implosion'] as const
export type BurstFamily = (typeof BURST_FAMILIES)[number]

export interface ActionPhase {
  phase: number
  resting: boolean
  cycleIndex: number
  activeDuration: number
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3)

/** Speed shortens the active cycle; interval is the hold before a clean reset. */
export function actionPhase(timeSec: number, cycle = 1, speed = 1, interval = 0, loop = true): ActionPhase {
  const activeDuration = Math.max(0.05, cycle / Math.max(0.05, speed))
  const restDuration = Math.max(0, interval)
  const period = activeDuration + restDuration
  const elapsed = Math.max(0, timeSec)
  const local = loop && period > 0 ? elapsed % period : Math.min(elapsed, period || activeDuration)
  const resting = local >= activeDuration
  return {
    phase: resting ? 1 : clamp(local / activeDuration),
    resting,
    cycleIndex: loop && period > 0 ? Math.floor(elapsed / period) : 0,
    activeDuration,
  }
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function drawGridFragments(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  family: BurstFamily,
  p: number,
  opts: { ox: number; oy: number; spread: number; fragments: number; gravity: number; rotation: number; intensity: number; seed: number },
) {
  const w = source.width, h = source.height
  const cols = Math.max(2, Math.round(Math.sqrt(opts.fragments * w / Math.max(1, h))))
  const rows = Math.max(2, Math.ceil(opts.fragments / cols))
  const cw = w / cols, ch = h / rows
  const rnd = mulberry32(opts.seed)
  const moveP = family === 'implosion' ? 1 - easeOut(p) : easeOut(p)
  const alpha = family === 'implosion' ? 0.5 + 0.5 * p : 1 - p * 0.16
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw, y = row * ch
      const cx = x + cw / 2, cy = y + ch / 2
      let vx = cx - opts.ox, vy = cy - opts.oy
      const length = Math.hypot(vx, vy) || 1
      vx /= length; vy /= length
      const jitter = (rnd() - 0.5) * 1.15
      const cosine = Math.cos(jitter), sine = Math.sin(jitter)
      const jx = vx * cosine - vy * sine, jy = vx * sine + vy * cosine
      const distance = opts.spread * (0.42 + rnd() * 0.75) * moveP
      const dx = jx * distance
      const dy = jy * distance + opts.gravity * p * p
      const angle = (rnd() - 0.5) * opts.rotation * moveP
      const scale = Math.max(0.08, 1 - moveP * (0.08 + rnd() * 0.22) * opts.intensity)
      ctx.save()
      // Build the clip after applying the piece transform so the fragment's
      // footprint travels through the frame instead of sampling inside a
      // stationary grid cell.
      ctx.globalAlpha = clamp(alpha)
      ctx.translate(cx + dx, cy + dy)
      ctx.rotate(angle)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
      ctx.beginPath()
      if (family === 'shatter' || family === 'glass' || family === 'implosion') {
        const flip = (row + col) % 2 === 0
        ctx.moveTo(x - 1, y - 1)
        ctx.lineTo(x + cw + 1, flip ? y + ch * (0.65 + rnd() * 0.25) : y - 1)
        ctx.lineTo(x + cw + 1, y + ch + 1)
        ctx.lineTo(x - 1, flip ? y + ch * (0.25 + rnd() * 0.2) : y + ch + 1)
      } else {
        ctx.rect(x - 0.5, y - 0.5, cw + 1, ch + 1)
      }
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(source, 0, 0)
      ctx.restore()
    }
  }
}

function drawSliceFragments(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  p: number,
  opts: { ox: number; oy: number; spread: number; fragments: number; rotation: number; seed: number },
) {
  const w = source.width, h = source.height
  const bands = Math.max(4, Math.min(40, Math.round(opts.fragments / 1.5)))
  const bh = h / bands
  const rnd = mulberry32(opts.seed)
  const ep = easeOut(p)
  for (let i = 0; i < bands; i++) {
    const y = i * bh
    const direction = i % 2 ? 1 : -1
    const dx = direction * opts.spread * ep * (0.45 + rnd() * 0.65)
    const dy = (rnd() - 0.5) * opts.spread * ep * 0.18
    ctx.save()
    ctx.globalAlpha = 1 - p * 0.12
    ctx.translate(w / 2 + dx, y + bh / 2 + dy)
    ctx.rotate(direction * opts.rotation * ep * 0.18)
    ctx.translate(-w / 2, -(y + bh / 2))
    ctx.beginPath()
    ctx.moveTo(0, y - 2)
    ctx.lineTo(w, y + Math.tan(opts.rotation * 0.08) * w - 2)
    ctx.lineTo(w, y + bh + Math.tan(opts.rotation * 0.08) * w + 2)
    ctx.lineTo(0, y + bh + 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(source, 0, 0)
    ctx.restore()
  }
}

function drawCracks(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, ox: number, oy: number, count: number, seed: number, color: string) {
  const rnd = mulberry32(seed)
  const radius = Math.hypot(w, h) * easeOut(p)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1, Math.min(w, h) / 420)
  ctx.shadowColor = color
  ctx.shadowBlur = 5
  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.5
    ctx.beginPath(); ctx.moveTo(ox, oy)
    let x = ox, y = oy
    const segments = 3 + Math.floor(rnd() * 4)
    for (let s = 1; s <= segments; s++) {
      const r = radius * (s / segments) * (0.72 + rnd() * 0.28)
      const a = base + (rnd() - 0.5) * 0.28
      x = ox + Math.cos(a) * r; y = oy + Math.sin(a) * r
      ctx.lineTo(x, y)
      if (s > 1 && rnd() > 0.45) {
        const branch = a + (rnd() > 0.5 ? 1 : -1) * (0.3 + rnd() * 0.4)
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(branch) * r * 0.18, y + Math.sin(branch) * r * 0.18); ctx.moveTo(x, y)
      }
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawShockwave(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, ox: number, oy: number, intensity: number, color: string) {
  const radius = Math.hypot(w, h) * 0.58 * easeOut(p)
  const fade = Math.pow(1 - p, 0.65) * intensity
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = fade * (0.72 - i * 0.18)
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, Math.min(w, h) * (0.012 - i * 0.002))
    ctx.shadowColor = color; ctx.shadowBlur = 16 + i * 8
    ctx.beginPath(); ctx.arc(ox, oy, Math.max(1, radius - i * Math.min(w, h) * 0.04), 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

function drawCloudBurst(ctx: CanvasRenderingContext2D, family: BurstFamily, w: number, h: number, p: number, opts: { ox: number; oy: number; fragments: number; intensity: number; spread: number; seed: number; color: string }) {
  const rnd = mulberry32(opts.seed)
  const count = Math.max(10, Math.min(80, opts.fragments * 2))
  const ep = easeOut(p)
  ctx.save()
  ctx.globalCompositeOperation = family === 'smoke' ? 'source-over' : 'screen'
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2
    const speed = (0.25 + rnd() * 0.75) * opts.spread
    const distance = speed * ep
    const x = opts.ox + Math.cos(angle) * distance
    const y = opts.oy + Math.sin(angle) * distance + (family === 'smoke' ? -p * opts.spread * 0.18 : 0)
    const size = Math.min(w, h) * (0.012 + rnd() * 0.045) * (1 + p * 2.4)
    const alpha = Math.pow(1 - p, family === 'smoke' ? 0.65 : 1.25) * opts.intensity * (0.35 + rnd() * 0.55)
    if (family === 'energy') {
      ctx.strokeStyle = opts.color; ctx.lineWidth = Math.max(1, size * 0.14); ctx.globalAlpha = alpha
      ctx.shadowColor = opts.color; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.moveTo(opts.ox, opts.oy); ctx.lineTo(x, y); ctx.stroke()
      continue
    }
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size)
    if (family === 'fireball') {
      gradient.addColorStop(0, `rgba(255,255,220,${alpha})`)
      gradient.addColorStop(0.28, `rgba(255,190,40,${alpha * 0.95})`)
      gradient.addColorStop(0.72, `rgba(255,55,10,${alpha * 0.65})`)
      gradient.addColorStop(1, 'rgba(70,0,0,0)')
    } else {
      gradient.addColorStop(0, `rgba(210,220,230,${alpha * 0.52})`)
      gradient.addColorStop(0.55, `rgba(75,80,90,${alpha * 0.4})`)
      gradient.addColorStop(1, 'rgba(25,28,34,0)')
    }
    ctx.fillStyle = gradient; ctx.fillRect(x - size, y - size, size * 2, size * 2)
  }
  ctx.restore()
}

export function hasBurstFx(effect?: ClipEffect | null): boolean {
  return !!effect?.burstFx && (effect.burstIntensity ?? 1) > 0
}

export function hasAuraFx(effect?: ClipEffect | null): boolean {
  return (effect?.aura ?? 0) > 0
}

export function hasActionFx(effect?: ClipEffect | null): boolean {
  return hasBurstFx(effect) || hasAuraFx(effect)
}

/** Fragment or decorate the current canvas in place. */
export function applyBurstFx(canvas: HTMLCanvasElement, effect: ClipEffect, timeSec: number): void {
  if (!hasBurstFx(effect) || !canvas.width || !canvas.height) return
  const family = effect.burstFx as BurstFamily
  if (!BURST_FAMILIES.includes(family)) return
  const clock = effect.motionClock ?? timeSec
  const timing = actionPhase(clock, effect.burstCycle ?? 1, effect.burstSpeed ?? 1, effect.burstInterval ?? 0.35, effect.burstLoop !== 0)
  const p = timing.phase
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  const source = makeCanvas(w, h)
  source.getContext('2d')?.drawImage(canvas, 0, 0)
  const intensity = clamp(effect.burstIntensity ?? 0.8)
  const ox = clamp(effect.burstOriginX ?? 0.5) * w
  const oy = clamp(effect.burstOriginY ?? 0.5) * h
  const fragments = Math.max(4, Math.min(64, Math.round(effect.burstFragments ?? 28)))
  const spread = Math.min(w, h) * clamp(effect.burstSpread ?? 0.7, 0, 1.5) * intensity
  const gravity = h * clamp(effect.burstGravity ?? 0.2, -1, 1) * intensity * 0.55
  const rotation = ((effect.burstRotation ?? 150) * Math.PI) / 180
  const seed = Math.round(effect.burstSeed ?? 731) + timing.cycleIndex * 1009
  const color = effect.burstColor ?? (family === 'fireball' ? '#ff8b2c' : '#bdefff')

  if (['glass', 'shatter', 'tiles', 'implosion'].includes(family)) {
    ctx.clearRect(0, 0, w, h)
    drawGridFragments(ctx, source, family, p, { ox, oy, spread, fragments, gravity, rotation, intensity, seed })
    if (family === 'glass' || family === 'shatter') drawCracks(ctx, w, h, p, ox, oy, Math.max(6, Math.round(fragments / 2.5)), seed + 41, color)
  } else if (family === 'slice') {
    ctx.clearRect(0, 0, w, h)
    drawSliceFragments(ctx, source, p, { ox, oy, spread, fragments, rotation, seed })
  } else if (family === 'crack') {
    drawCracks(ctx, w, h, p, ox, oy, Math.max(7, Math.round(fragments / 2)), seed, color)
  } else if (family === 'shockwave') {
    drawShockwave(ctx, w, h, p, ox, oy, intensity, color)
  } else if (family === 'fireball' || family === 'smoke' || family === 'energy') {
    drawCloudBurst(ctx, family, w, h, p, { ox, oy, fragments, intensity, spread, seed, color })
    if (family !== 'smoke') drawShockwave(ctx, w, h, p, ox, oy, intensity * 0.7, color)
  }
}

/** Bright-pixel aura with colored bloom, spiral arcs and radial energy rays. */
export function applyAuraFx(canvas: HTMLCanvasElement, effect: ClipEffect, timeSec: number): void {
  if (!hasAuraFx(effect) || !canvas.width || !canvas.height) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  const intensity = clamp(effect.aura ?? 0.75)
  const threshold = clamp(effect.auraThreshold ?? 0.48)
  const radius = Math.max(2, Math.min(120, effect.auraRadius ?? 28))
  const primary = effect.auraColor ?? '#22d3ee'
  const secondary = effect.auraSecondary ?? '#e935c1'
  const clock = effect.motionClock ?? timeSec
  const speed = effect.auraSpeed ?? 1
  const rotation = clock * speed * 0.75 + ((effect.auraRotation ?? 0) * Math.PI) / 180
  const lines = Math.max(4, Math.min(64, Math.round(effect.auraLines ?? 18)))
  // Bright-pixel analysis is intentionally capped: aura stays responsive on
  // 4K footage while the final bloom/rays still composite at full resolution.
  const analysisScale = Math.min(1, 512 / Math.max(w, h))
  const bw = Math.max(1, Math.round(w * analysisScale)), bh = Math.max(1, Math.round(h * analysisScale))
  const bright = makeCanvas(bw, bh), bx = bright.getContext('2d')!
  bx.drawImage(canvas, 0, 0, bw, bh)
  let image: ImageData
  try { image = bx.getImageData(0, 0, bw, bh) } catch { return }
  for (let i = 0; i < image.data.length; i += 4) {
    const lum = (image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114) / 255
    const alpha = clamp((lum - threshold) / Math.max(0.02, 1 - threshold)) * image.data[i + 3]
    image.data[i] = 255; image.data[i + 1] = 255; image.data[i + 2] = 255; image.data[i + 3] = alpha
  }
  bx.putImageData(image, 0, 0)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = intensity * (0.42 - pass * 0.09)
    ctx.filter = `blur(${radius * (0.35 + pass * 0.42)}px)`
    ctx.shadowColor = pass % 2 ? secondary : primary
    ctx.shadowBlur = radius * (1.2 + pass * 0.55)
    ctx.drawImage(bright, 0, 0, w, h)
  }
  ctx.filter = 'none'; ctx.shadowBlur = 0
  const cx = clamp(effect.auraX ?? 0.5) * w, cy = clamp(effect.auraY ?? 0.5) * h
  const reach = Math.min(w, h) * (0.16 + intensity * 0.34)
  for (let i = 0; i < lines; i++) {
    const angle = rotation + i / lines * Math.PI * 2
    const wobble = Math.sin(clock * speed * 1.7 + i * 2.13) * 0.16
    const inner = reach * (0.14 + (i % 3) * 0.025)
    const outer = reach * (0.72 + 0.28 * Math.sin(i * 4.7 + clock * speed))
    ctx.globalAlpha = intensity * (0.2 + 0.3 * ((i % 5) / 4))
    ctx.strokeStyle = i % 2 ? secondary : primary
    ctx.lineWidth = 1 + intensity * 2.5
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(cx, cy, inner + (outer - inner) * 0.55, angle + wobble, angle + wobble + 0.45 + intensity * 0.55)
    ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
    ctx.lineTo(cx + Math.cos(angle + wobble) * outer, cy + Math.sin(angle + wobble) * outer); ctx.stroke()
  }
  ctx.restore()
}

export function applyActionFx(canvas: HTMLCanvasElement, effect: ClipEffect, timeSec: number): void {
  if (hasBurstFx(effect)) applyBurstFx(canvas, effect, timeSec)
  if (hasAuraFx(effect)) applyAuraFx(canvas, effect, timeSec)
}
