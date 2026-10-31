/**
 * Board T ("omega change"): per-character / per-range text styling + keyframes,
 * shared by the headless renderer (tools/mcp) and browser presets.
 *
 * CapCut-style: the whole clip keeps a base textStyle, and ANY number of
 * character ranges ("a", "bcs", …) carry their own overrides (color, fontSize,
 * opacity, letterSpacing, fontFamily, weight, italic, blendMode, glow) plus
 * their OWN keyframes per property (fontSize/opacity/letterSpacing numeric,
 * color as hex stops) with every curve family incl. bounce-param/rebound/physical.
 *
 * Also powers "In-Video Text" presets: an animated bed (fire/rain/cloud/…)
 * painted INSIDE the glyph silhouettes (destination-in mask), with a faint
 * base pass underneath so the text stays legible — the studied
 * composition-over-text grammar from the Drive overlay packs.
 */
import { evaluateEasingProgress, type InterpolationType } from './animation/CurveEngine'

export interface RunKey {
  t: number
  v: number | string
  interp?: string
  params?: { steps?: number; bounciness?: number; firstBounce?: number; overshoot?: number; freq?: number; damping?: number }
}

export interface CharRange {
  start: number
  end: number // exclusive char positions
  style?: {
    color?: string
    fontSize?: number
    opacity?: number
    letterSpacing?: number
    fontFamily?: string
    bold?: boolean
    italic?: boolean
    blendMode?: string
    glowColor?: string
    glowBlur?: number
  }
  keys?: Record<string, RunKey[]>
}

export interface RunBase {
  fontSize?: number
  fontFamily?: string
  color?: string
  bold?: boolean
  italic?: boolean
  letterSpacing?: number
  glowColor?: string
  glowBlur?: number
  opacity?: number
}

export interface CharMetric {
  pos: number
  ch: string
  x: number
  y: number
  w: number
  h: number
}

function hexToRgb(h: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
  if (!m) return [255, 255, 255]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mixHex(a: string, b: string, u: number): string {
  const A = hexToRgb(a), B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, u))))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Evaluate a numeric key list at time t (segment easing honours curve families). */
export function evalNumKeys(keys: RunKey[] | undefined, t: number, fallback: number): number {
  if (!keys || keys.length === 0) return fallback
  const ks = [...keys].sort((a, b) => a.t - b.t)
  if (t <= ks[0].t) return Number(ks[0].v)
  if (t >= ks[ks.length - 1].t) return Number(ks[ks.length - 1].v)
  for (let i = 0; i < ks.length - 1; i++) {
    if (t >= ks[i].t && t <= ks[i + 1].t) {
      const span = ks[i + 1].t - ks[i].t || 1
      const u = (t - ks[i].t) / span
      const p = evaluateEasingProgress(u, (ks[i].interp as InterpolationType) || 'linear', ks[i].params)
      return Number(ks[i].v) + (Number(ks[i + 1].v) - Number(ks[i].v)) * p
    }
  }
  return fallback
}

/** Evaluate a color key list at time t (hex stops, eased mix). */
export function evalColorKeys(keys: RunKey[] | undefined, t: number, fallback: string): string {
  if (!keys || keys.length === 0) return fallback
  const ks = [...keys].sort((a, b) => a.t - b.t)
  if (t <= ks[0].t) return String(ks[0].v)
  if (t >= ks[ks.length - 1].t) return String(ks[ks.length - 1].v)
  for (let i = 0; i < ks.length - 1; i++) {
    if (t >= ks[i].t && t <= ks[i + 1].t) {
      const span = ks[i + 1].t - ks[i].t || 1
      const u = (t - ks[i].t) / span
      const p = evaluateEasingProgress(u, (ks[i].interp as InterpolationType) || 'linear', ks[i].params)
      return mixHex(String(ks[i].v), String(ks[i + 1].v), p)
    }
  }
  return fallback
}

export interface PaintRunsOpts {
  text: string
  base: RunBase
  ranges?: CharRange[]
  t: number
  /** Animated bed painter drawn INSIDE glyph silhouettes (In-Video Text). */
  inside?: (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void
  /** Legibility floor for the base pass under an inside bed (0..1). */
  insideBaseAlpha?: number
  /** draw-px per project-px (clip rect vs project size). */
  pxScale?: number
  makeCanvas: (w: number, h: number) => HTMLCanvasElement
}

/** Lay out + paint per-character runs; returns per-char metrics in draw px. */
// Grow-only scratch pair: an animated clip changes its rounded layer size
// every frame, and each fresh napi-rs canvas leaks native memory forever.
let SCRATCH: { w: number; h: number; mask: HTMLCanvasElement; bed: HTMLCanvasElement } | null = null

export function paintTextRuns(ctx: CanvasRenderingContext2D, w: number, h: number, o: PaintRunsOpts): CharMetric[] {
  const chars = [...o.text]
  const k = 1 // draw-space units are already project-scaled by callers
  const rangeAt = (pos: number) => (o.ranges || []).filter(r => pos >= r.start && pos < r.end)
  const merged = chars.map((ch, pos) => {
    const rs = rangeAt(pos)
    const st: Record<string, unknown> = {}
    for (const r of rs) Object.assign(st, r.style || {})
    const keysOf = (prop: string): RunKey[] | undefined => {
      for (const r of rs) if (r.keys && r.keys[prop]) return r.keys[prop]
      return undefined
    }
    const px = o.pxScale ?? 1
    const fontSize = evalNumKeys(keysOf('fontSize'), o.t, (st.fontSize as number) ?? o.base.fontSize ?? h * 0.5) * px
    return {
      ch,
      pos,
      fontSize,
      fontFamily: (st.fontFamily as string) ?? o.base.fontFamily ?? 'sans-serif',
      color: evalColorKeys(keysOf('color'), o.t, (st.color as string) ?? o.base.color ?? '#ffffff'),
      bold: (st.bold as boolean) ?? o.base.bold ?? true,
      italic: (st.italic as boolean) ?? o.base.italic ?? false,
      letterSpacing: evalNumKeys(keysOf('letterSpacing'), o.t, (st.letterSpacing as number) ?? o.base.letterSpacing ?? 0) * (o.pxScale ?? 1),
      opacity: evalNumKeys(keysOf('opacity'), o.t, (st.opacity as number) ?? o.base.opacity ?? 1),
      glowColor: (st.glowColor as string) ?? o.base.glowColor,
      glowBlur: ((st.glowBlur as number) ?? o.base.glowBlur ?? 0) * (o.pxScale ?? 1),
      blendMode: (st.blendMode as string) ?? 'source-over',
    }
  })
  const fontOf = (m: (typeof merged)[0]) => `${m.italic ? 'italic ' : ''}${m.bold ? 'bold ' : ''}${Math.round(m.fontSize * k)}px ${m.fontFamily}`
  // measure pass
  ctx.save()
  const widths = merged.map(m => { ctx.font = fontOf(m); return ctx.measureText(m.ch).width })
  const total = widths.reduce((a, b) => a + b, 0) + merged.reduce((a, m) => a + m.letterSpacing * k, 0)
  let cx = w / 2 - total / 2
  const baseY = h * 0.65
  const metrics: CharMetric[] = merged.map((m, i) => {
    const x = cx
    cx += widths[i] + m.letterSpacing * k
    return { pos: m.pos, ch: m.ch, x, y: baseY - m.fontSize * k * 0.72, w: widths[i], h: m.fontSize * k }
  })
  const paintPass = (c: CanvasRenderingContext2D) => {
    merged.forEach((m, i) => {
      c.save()
      c.globalAlpha = Math.max(0, Math.min(1, m.opacity))
      c.globalCompositeOperation = (m.blendMode as GlobalCompositeOperation) || 'source-over'
      c.fillStyle = m.color
      c.font = fontOf(m)
      if (m.glowBlur && m.glowBlur > 0) {
        c.shadowColor = m.glowColor || m.color
        c.shadowBlur = m.glowBlur * k
      }
      c.textAlign = 'left'
      c.fillText(m.ch, metrics[i].x, baseY)
      c.restore()
    })
  }
  if (o.inside) {
    // mask pass: glyphs -> bed inside them, faint base pass under for legibility.
    // Scratch canvases are REUSED: napi-rs native surfaces are not GC-tracked,
    // so allocating per frame leaks ~15 MB/frame on long renders.
    // power-of-two sizing: an animated clip changes its rounded layer size
    // every frame; re-allocating native canvases mid-render leaks forever.
    const W = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(2, w)))), H = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(2, h))))
    if (!SCRATCH || SCRATCH.w < W || SCRATCH.h < H) {
      const sw = Math.max(W, SCRATCH?.w ?? 0), sh = Math.max(H, SCRATCH?.h ?? 0)
      SCRATCH = { w: sw, h: sh, mask: o.makeCanvas(sw, sh), bed: o.makeCanvas(sw, sh) }
    }
    const mask = SCRATCH.mask
    const bed = SCRATCH.bed
    const mx = mask.getContext('2d')!
    mx.clearRect(0, 0, W, H)
    paintPass(mx)
    const bx2 = bed.getContext('2d')!
    bx2.globalCompositeOperation = 'source-over'
    bx2.clearRect(0, 0, W, H)
    o.inside(bx2, w, h, o.t)
    bx2.globalCompositeOperation = 'destination-in'
    bx2.drawImage(mask, 0, 0, W, H, 0, 0, W, H)
    ctx.save()
    ctx.drawImage(bed, 0, 0, W, H, 0, 0, W, H)
    ctx.restore()
    // tinted base ON TOP of the footage keeps the text legible while the
    // moving video reads through the colour (user: "text still visible").
    ctx.save()
    ctx.globalAlpha = o.insideBaseAlpha ?? 0.55
    paintPass(ctx)
    ctx.restore()
  } else {
    paintPass(ctx)
  }
  ctx.restore()
  return metrics
}
