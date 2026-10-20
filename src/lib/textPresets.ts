/**
 * Text Preset Library — procedural text looks (from the tutorial index in
 * tutorial.md). Every preset is a FUNCTION of the user's text, never a
 * recording made for one specific word, so any text works. The mapping
 * rules that solve the "different character count" problem:
 *
 *  R1  Normalized position u = i/(n-1) drives stagger, settle order and
 *      wave phase — a 3-letter and a 12-letter word get the same *shape*
 *      of animation, compressed or stretched.
 *  R2  n <= 2 collapses per-letter looks to whole-word equivalents.
 *  R3  Each preset declares its ideal length; the UI warns (never blocks)
 *      outside it: "Best with 4–10 characters".
 *  R4  Seeds make every randomized look deterministic and re-rollable.
 */
import { useEditor } from '../store'
import type { Clip, TextTitleStyle } from '../types'
import { baseClip, buildRetroText, pushClips, seededRng, textClip, withFade, withKeys, barAssetId } from './builders'

export interface TextPresetDef {
  id: string
  name: string
  category: string
  source: string
  ideal: [number, number]
  demo: string
  build: (text: string, o: PresetBuildOpts) => string[]
}

const FONT = 'Arial Black, sans-serif'

export interface GlowSettings {
  angle: number
  intensity: number
  spread: number
  blur: number
  smoothness: number
  sharpness: 'text' | 'effect'
  clarity: number
}

export interface PresetBuildOpts {
  seed: number
  color: string
  duration: number
  delay?: number
  charSpacing?: number
  wordSpacing?: number
  graph?: string
  glow?: GlowSettings
  /** Typewriter cursor: 'follow' trails each typed letter (1_ 12_ 123_);
   *  'end' parks the cursor at the final position while letters fill in. */
  typewriterCursor?: 'follow' | 'end'
}

type O = PresetBuildOpts

export const GRAPH_OPTIONS: { id: string; label: string }[] = [
  { id: 'preset', label: "Preset's own graph" },
  { id: 'linear', label: 'Linear (constant speed)' },
  { id: 'constant', label: 'Constant / Stepped (hold)' },
  { id: 'ease-in', label: 'Ease In (quad)' },
  { id: 'cubic-in', label: 'Ease In Strong (cubic)' },
  { id: 'ease-out', label: 'Ease Out (quad)' },
  { id: 'cubic-out', label: 'Ease Out Strong (cubic)' },
  { id: 'ease-in-out', label: 'Ease In-Out (sine-like S)' },
  { id: 'back', label: 'Back (overshoot)' },
  { id: 'bounce', label: 'Bounce (gravity arcs)' },
  { id: 'elastic', label: 'Elastic (damped sine)' },
  { id: 'bezier', label: 'Bezier Smooth (auto handles)' },
]

export const PREVIEW_W = 1920
export const USABLE_W = PREVIEW_W * 0.92

let measureCtx: CanvasRenderingContext2D | null = null
export function measureText(text: string, fontSize: number, fontFamily = FONT): number {
  try {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
    if (measureCtx) {
      measureCtx.font = `700 ${fontSize}px ${fontFamily}`
      return measureCtx.measureText(text).width
    }
  } catch { /* fallback below */ }
  return text.length * fontSize * 0.62
}

export function spacingCaps(text: string, fontSize = 88): { charMax: number; wordMax: number; textWidth: number } {
  const t = (text || '').trim()
  const glyphW = [...t].reduce((a, ch) => a + (ch === ' ' ? fontSize * 0.34 : measureText(ch, fontSize)), 0)
  const n = [...t].filter((c) => c !== ' ').length
  const words = t.split(/\s+/).filter(Boolean).length
  const charMax = n > 1 ? Math.max(0, Math.floor((USABLE_W - glyphW) / (n - 1))) : 0
  const wordMax = words > 1 ? Math.max(0, Math.floor((USABLE_W - glyphW) / (words - 1))) : 0
  return { charMax: Math.min(charMax, 400), wordMax: Math.min(wordMax, 600), textWidth: Math.round(glyphW) }
}

export function clampSpacing(text: string, charSpacing: number, wordSpacing: number, fontSize = 88): { charSpacing: number; wordSpacing: number } {
  const caps = spacingCaps(text, fontSize)
  const cs = Math.max(-20, Math.min(charSpacing, caps.charMax))
  let ws = Math.max(0, Math.min(wordSpacing, caps.wordMax))
  const n = [...text].filter((c) => c !== ' ').length
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const used = caps.textWidth + (n - 1) * Math.max(0, cs) + (words - 1) * ws
  if (used > USABLE_W && words > 1) ws = Math.max(0, Math.floor((USABLE_W - caps.textWidth - (n - 1) * Math.max(0, cs)) / (words - 1)))
  return { charSpacing: cs, wordSpacing: ws }
}

function track() { return useEditor.getState().createTrack('video') }
function start() { return useEditor.getState().playhead }

function word(text: string, style: Omit<TextTitleStyle, 'text'>, o: O, clipOpts: Partial<Clip> = {}): Clip {
  const sp = o.charSpacing ? clampSpacing(text, o.charSpacing, 0, style.fontSize ?? 88) : null
  const ls = (style.letterSpacing ?? 0) + (sp ? sp.charSpacing : 0)
  return textClip(track(), start(), o.duration, { fontSize: 88, bold: true, fontFamily: FONT, color: '#ffffff', ...style, letterSpacing: ls, text }, clipOpts)
}

interface LetterCtx { ch: string; i: number; n: number; u: number; x: number; trackId: string; t0: number; dur: number }
function letters(text: string, o: O, fn: (ctx: LetterCtx) => Clip[]): string[] {
  const chars = [...text]
  const n = chars.length
  const cs = o.charSpacing ? clampSpacing(text, o.charSpacing, 0).charSpacing : 0
  const widths = chars.map((ch) => (ch === ' ' ? 30 + (o.wordSpacing ?? 0) : measureText(ch, 88)))
  const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, n - 1) * cs
  let cursor = -totalW / 2
  const created: Clip[] = []
  chars.forEach((ch, i) => {
    const x = cursor + widths[i] / 2
    cursor += widths[i] + cs
    if (ch === ' ') return
    const ctx: LetterCtx = { ch, i, n, u: n <= 1 ? 0 : i / (n - 1), x, trackId: track(), t0: start(), dur: o.duration }
    created.push(...fn(ctx))
  })
  return pushClips(created)
}

function letterClip(ctx: LetterCtx, style: Omit<TextTitleStyle, 'text'>, opts: Partial<Clip> = {}): Clip {
  const c = textClip(ctx.trackId, ctx.t0, ctx.dur, { fontSize: 88, bold: true, fontFamily: FONT, color: '#ffffff', ...style, text: ctx.ch }, opts)
  c.transform = { ...c.transform, x: ctx.x }
  return c
}

export type TypewriterForm = 'bar' | 'block' | 'underscore' | 'caret' | 'highlight'
export const TYPEWRITER_FORMS: { form: TypewriterForm; name: string; glyph: string }[] = [
  { form: 'bar', name: 'Typewriter · Vertical Bar', glyph: '|' },
  { form: 'block', name: 'Typewriter · Block', glyph: '\u{25AE}' },
  { form: 'underscore', name: 'Typewriter · Underscore', glyph: '_' },
  { form: 'caret', name: 'Typewriter · Caret', glyph: '\u{25B8}' },
  { form: 'highlight', name: 'Typewriter · Highlight', glyph: '\u{2588}' },
]

function typewriterBuild(form: TypewriterForm) {
  return (text: string, o: O): string[] => {
    const MONO = 'ui-monospace, Menlo, monospace'
    const chars = [...text]
    const per = Math.min(0.16, (o.duration * 0.55) / Math.max(1, chars.length))
    const widths = chars.map((ch) => measureText(ch === ' ' ? ' ' : ch, 72, MONO))
    const cs = o.charSpacing ? clampSpacing(text, o.charSpacing, 0, 72).charSpacing : 0
    const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, chars.length - 1) * cs
    const charX: number[] = []
    let cursor = -totalW / 2
    chars.forEach((ch, i) => { charX.push(cursor + widths[i] / 2); cursor += widths[i] + cs })
    const created: Clip[] = []
    // highlight block sits under the glyphs (created first = drawn first)
    const glyph = TYPEWRITER_FORMS.find((f) => f.form === form)!.glyph
    const cursorTrack = track()
    chars.forEach((ch, i) => {
      if (ch === ' ') return
      const c = textClip(track(), start(), o.duration, { text: ch, fontSize: 72, bold: true, fontFamily: MONO, color: '#ffffff' }, { name: ch })
      c.transform = { ...c.transform, x: charX[i] }
      const on = i * per
      withKeys(c, 'opacity', [[0, 0], [on, 0], [on + 0.02, 1], [o.duration - 0.3, 1], [o.duration, 0]])
      created.push(c)
    })
    const cur = textClip(cursorTrack, start(), o.duration, { text: glyph, fontSize: 72, bold: true, fontFamily: MONO, color: form === 'highlight' ? o.color : '#7dd3fc' }, { name: `cursor ${form}` })
    if (form === 'highlight') cur.transform = { ...cur.transform, opacity: 0.55 }
    const endX = form === 'highlight' ? (charX[chars.length - 1] ?? 0) : totalW / 2 + 6
    let xKeys: [number, number, string?][]
    if ((o.typewriterCursor ?? 'follow') === 'end') {
      // Cursor parked where the finished word will end; letters fill toward it.
      xKeys = [[0, endX], [o.duration, endX]]
    } else {
      // Cursor trails each typed letter: 1_ -> 12_ -> 123_
      xKeys = [[0, form === 'highlight' ? charX[0] ?? 0 : -totalW / 2]]
      chars.forEach((ch, i) => {
        const x = form === 'highlight' ? charX[i] : -totalW / 2 + widths.slice(0, i + 1).reduce((a, b) => a + b, 0) + i * cs + 6
        xKeys.push([i * per, x])
      })
      xKeys.push([o.duration, xKeys[xKeys.length - 1][1]])
    }
    withKeys(cur, 'position_x', xKeys)
    if (cur.animation) for (const cv of Object.values(cur.animation.curves)) for (const k of cv.keyframes) if (cv === cur.animation.curves.position_x) k.interpolation = 'constant'
    const blink: [number, number, string?][] = [[0, 1]]
    for (let t = chars.length * per + 0.4; t < o.duration - 0.2; t += 0.8) blink.push([t, 0.05], [t + 0.4, 1])
    blink.push([o.duration, 0])
    withKeys(cur, 'opacity', blink)
    if (cur.animation) for (const k of cur.animation.curves.opacity.keyframes) k.interpolation = 'constant'
    created.push(cur)
    return pushClips(created)
  }
}

function makeTypewriterFormes(): TextPresetDef[] {
  return TYPEWRITER_FORMS.map((f) => ({
    id: `typewriter-${f.form}`,
    name: f.name,
    category: 'Typewriter',
    source: 'Typewriter tutorials — 5 cursor formes',
    ideal: [4, 20] as [number, number],
    demo: 'HELLO WORLD',
    build: typewriterBuild(f.form),
  }))
}

export const TEXT_PRESETS: TextPresetDef[] = [
  {
    id: 'retro-traditional', name: 'Retro Glitch (Traditional)', category: 'Retro / Glitch', source: 'Alight Motion — Noelle Tutorials (UxfwndLF8cY)', ideal: [4, 10], demo: 'NOELLE',
    build: (text, o) => buildRetroText({ text, sub: '', color: o.color, seed: o.seed, method: 'traditional', duration: o.duration }),
  },
  {
    id: 'retro-effects', name: 'Retro Scramble (Effects)', category: 'Retro / Glitch', source: 'Alight Motion — Noelle Tutorials (UxfwndLF8cY)', ideal: [3, 12], demo: 'RETRO',
    build: (text, o) => buildRetroText({ text, sub: '', color: o.color, seed: o.seed, method: 'effects', duration: o.duration }),
  },
  {
    id: 'rgb-split', name: 'RGB Split Glitch', category: 'Retro / Glitch', source: 'CapCut RGB glitch text tutorials', ideal: [3, 12], demo: 'GLITCH',
    build: (text, o) => {
      const created: Clip[] = []
      const mk = (color: string, dx: number, name: string) => {
        const c = word(text, { color }, o, { name })
        c.transform = { ...c.transform, x: dx }
        return withFade(c, 0.1, 0.2)
      }
      created.push(mk('#ff004c', -7, 'rgb red'), mk('#00e5ff', 7, 'rgb cyan'), mk('#ffffff', 0, 'rgb white'))
      // short chromatic slice hits
      const t = track()
      ;[0.3, 0.75].forEach((off, i) => {
        const s = textClip(t, start() + off, 0.18, { text, fontSize: 88, bold: true, fontFamily: FONT, color: '#fff' }, { name: `rgb slice ${i}` })
        s.effects = { chromatic: 10, pixelStretch: 12 }
        created.push(s)
      })
      return pushClips(created)
    },
  },
  {
    id: 'matrix-scramble', name: 'Matrix Scramble', category: 'Retro / Glitch', source: 'Text randomizer tutorials (Alight/CapCut)', ideal: [4, 14], demo: 'MATRIX',
    build: (text, o) => pushClips([withFade(word(text, { color: '#4ade80', randomizer: { seed: o.seed, untilSec: 1.7, charset: '01<>/\\|#@$%&' }, glowColor: '#22c55e', glowBlur: 16 }, o), 0.1, 0.3)]),
  },
  {
    id: 'neon-flicker', name: 'Neon Sign Flicker', category: 'Glow / Neon', source: 'Neon sign text tutorials (CapCut/AE)', ideal: [3, 10], demo: 'NEON',
    build: (text, o) => {
      const c = word(text, { color: '#fdf4ff', glowColor: o.color, glowBlur: 30 }, o)
      const rng = seededRng(o.seed)
      const keys: [number, number, string?][] = [[0, 0], [0.08, 1], [0.14, 0.2], [0.2, 1], [0.55, 0.85], [0.62, 1]]
      for (let t = 0.8; t < o.duration - 0.4; t += 0.35 + rng() * 0.5) keys.push([t, 0.55 + rng() * 0.45])
      keys.push([o.duration - 0.3, 1], [o.duration, 0])
      return pushClips([withKeys(c, 'opacity', keys)])
    },
  },
  {
    id: 'glow-pulse', name: 'Glow Pulse Title', category: 'Glow / Neon', source: 'Glow text tutorials (all editors)', ideal: [3, 14], demo: 'SHINE',
    build: (text, o) => {
      const shadow = word(text, { color: o.color, glowColor: o.color, glowBlur: 34 }, o, { name: 'glow halo' })
      const main = word(text, { color: '#ffffff', glowColor: '#ffffff', glowBlur: 10 }, o)
      const pulsed = withKeys(main, 'opacity', [[0, 0, 'ease-out'], [0.3, 1], [o.duration / 2, 0.82], [o.duration - 0.3, 1], [o.duration, 0]])
      return pushClips([withFade(shadow, 0.3, 0.4), pulsed])
    },
  },
  {
    id: 'bounce-letters', name: 'Bounce Letters', category: 'Motion', source: 'Bounce text tutorials (CapCut/Alight/AE)', ideal: [3, 12], demo: 'BOUNCE',
    build: (text, o) => letters(text, o, (ctx) => {
      const c = letterClip(ctx, {})
      const d = ctx.u * Math.min(0.9, o.duration * 0.3)
      withKeys(c, 'position_y', [[0, -190], [d, -190], [d + 0.42, 8, 'bounce'], [d + 0.6, 0, 'bounce']])
      withKeys(c, 'opacity', [[0, 0], [d, 0], [d + 0.05, 1], [ctx.dur - 0.25, 1], [ctx.dur, 0]])
      // merge: position curve from first call survives (same anim object overwritten) — rebuild combined:
      const anim = c.animation!
      const op = anim.curves.opacity.keyframes
      void op
      return [c]
    }),
  },
  {
    id: 'wave-letters', name: 'Wave Letters', category: 'Motion', source: 'Wave/liquid text tutorials', ideal: [4, 14], demo: 'WAVES',
    build: (text, o) => letters(text, o, (ctx) => {
      const c = letterClip(ctx, { color: '#ffffff' })
      const phase = ctx.u * Math.PI * 2
      const keys: [number, number, string?][] = []
      for (let t = 0; t <= o.duration; t += 0.24) keys.push([t, Math.sin(phase + t * 5.2) * 15, 'smooth'])
      withKeys(c, 'position_y', keys)
      return [withFade(c, 0.3, 0.3)]
    }),
  },
  {
    id: 'spin-drop', name: 'Spin Drop Letters', category: 'Motion', source: 'Spin-in typography tutorials', ideal: [3, 10], demo: 'SPIN',
    build: (text, o) => letters(text, o, (ctx) => {
      const c = letterClip(ctx, {})
      const d = ctx.u * 0.7
      withKeys(c, 'rotation_z', [[0, -160], [d, -160], [d + 0.5, 0, 'back']])
      withKeys(c, 'opacity', [[0, 0], [d, 0], [d + 0.06, 1], [ctx.dur - 0.25, 1], [ctx.dur, 0]])
      withKeys(c, 'position_y', [[0, -120], [d, -120], [d + 0.5, 0, 'back']])
      return [c]
    }),
  },
  {
    id: 'cascade-fall', name: 'Cascade Fall', category: 'Motion', source: 'Falling letters tutorials', ideal: [3, 12], demo: 'FALL',
    build: (text, o) => letters(text, o, (ctx) => {
      const c = letterClip(ctx, {})
      const d = 0.15 + ctx.u * 0.8
      withKeys(c, 'position_y', [[0, -320], [d, -320], [d + 0.55, 0, 'bounce']])
      withKeys(c, 'opacity', [[0, 0], [d, 0], [d + 0.05, 1], [ctx.dur - 0.25, 1], [ctx.dur, 0]])
      return [c]
    }),
  },
  {
    id: 'slam-zoom', name: 'Slam Zoom', category: 'Motion', source: 'Impact/slam title tutorials (AMV)', ideal: [2, 8], demo: 'SLAM',
    build: (text, o) => {
      const c = word(text, { glowColor: o.color, glowBlur: 12 }, o)
      withKeys(c, 'scale_x', [[0, 2.6, 'ease-in'], [0.16, 0.94, 'ease-out'], [0.26, 1, 'back'], [o.duration - 0.25, 1], [o.duration, 1]])
      withKeys(c, 'scale_y', [[0, 2.6, 'ease-in'], [0.16, 0.94, 'ease-out'], [0.26, 1, 'back']])
      withKeys(c, 'opacity', [[0, 1], [o.duration - 0.25, 1], [o.duration, 0]])
      return pushClips([c])
    },
  },
  {
    id: 'karaoke-sweep', name: 'Karaoke Sweep', category: 'Style', source: 'Karaoke/lyric highlight tutorials', ideal: [4, 16], demo: 'SING ALONG',
    build: (text, o) => {
      const created: Clip[] = []
      created.push(withFade(word(text, { color: '#5b6474' }, o, { name: 'karaoke base' }), 0.2, 0.3))
      const per = (o.duration * 0.62) / Math.max(1, [...text].length)
      pushClips(created)
      const ids = letters(text, o, (ctx) => {
        const c = letterClip(ctx, { color: o.color, glowColor: o.color, glowBlur: 8 })
        const on = 0.25 + ctx.i * per
        withKeys(c, 'opacity', [[0, 0], [on, 0], [on + 0.04, 1], [ctx.dur - 0.25, 1], [ctx.dur, 0]])
        return [c]
      })
      return [...created.map((c) => c.id), ...ids]
    },
  },
  ...makeTypewriterFormes(),
  {
    id: 'rainbow-letters', name: 'Rainbow Letters', category: 'Style', source: 'Rainbow/multicolour text tutorials', ideal: [3, 14], demo: 'RAINBOW',
    build: (text, o) => {
      const hues = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#ec4899']
      return letters(text, o, (ctx) => [withFade(letterClip(ctx, { color: hues[ctx.i % hues.length], glowColor: hues[ctx.i % hues.length], glowBlur: 9 }), 0.25, 0.3)])
    },
  },
  {
    id: 'outline-echo', name: 'Outline Echo', category: 'Style', source: 'Outline/echo text tutorials', ideal: [3, 10], demo: 'ECHO',
    build: (text, o) => {
      const created: Clip[] = []
      ;[26, 16, 8].forEach((off, i) => {
        const c = word(text, { color: 'transparent', strokeColor: o.color, strokeWidth: 2, strokeOnly: true }, o, { name: `echo ${i}` })
        c.transform = { ...c.transform, x: off, y: off * 0.55, opacity: 0.35 + i * 0.2 }
        created.push(withFade(c, 0.3, 0.3))
      })
      created.push(withFade(word(text, {}, o), 0.3, 0.3))
      return pushClips(created)
    },
  },
  {
    id: 'lower-third', name: 'News Lower Third', category: 'Style', source: 'Lower-third title tutorials (Premiere/CapCut)', ideal: [4, 24], demo: 'BREAKING NEWS',
    build: (text, o) => {
      const barId = barAssetId(useEditor.getState())
      const bar = baseClip({ trackId: track(), start: start(), duration: o.duration, name: 'lower-third bar', kind: 'image', assetId: barId })
      bar.transform = { ...bar.transform, x: -420, y: 330, scale: 1.7, scaleY: 2.6 }
      bar.effects = {}
      const barClip = withKeys(bar, 'scale_x', [[0, 0.02], [0.35, 1.7, 'ease-out'], [o.duration - 0.3, 1.7], [o.duration, 0.02]])
      // tint the white bar via invert? bars render white; acceptable studio white bar
      const title = word(text, { fontSize: 54, color: '#111827' }, o, { name: 'lower-third text' })
      title.transform = { ...title.transform, x: -420, y: 318 }
      const t2 = withKeys(title, 'opacity', [[0, 0], [0.3, 0], [0.45, 1], [o.duration - 0.3, 1], [o.duration, 0]])
      return pushClips([barClip, t2])
    },
  },
  {
    id: 'cinematic-fade', name: 'Cinematic Serif Fade', category: 'Style', source: 'Cinematic title tutorials (film style)', ideal: [4, 20], demo: 'EPISODE ONE',
    build: (text, o) => {
      const c = word(text, { fontFamily: 'Georgia, serif', bold: false, fontSize: 64, letterSpacing: 14, color: '#f3ead8' }, o)
      withKeys(c, 'scale_x', [[0, 1.06], [o.duration, 1.0, 'smooth']])
      withKeys(c, 'opacity', [[0, 0, 'ease-in'], [o.duration * 0.35, 1], [o.duration * 0.8, 1], [o.duration, 0, 'ease-out']])
      return pushClips([c])
    },
  },
  {
    id: 'highlight-marker', name: 'Marker Highlight', category: 'Style', source: 'Highlight-text tutorials (social edits)', ideal: [3, 16], demo: 'IMPORTANT',
    build: (text, o) => {
      const barId = barAssetId(useEditor.getState())
      const bar = baseClip({ trackId: track(), start: start(), duration: o.duration, name: 'highlight bar', kind: 'image', assetId: barId })
      bar.transform = { ...bar.transform, y: 8, scale: 1.9, scaleY: 2.1, opacity: 0.85 }
      const swept = withKeys(bar, 'scale_x', [[0, 0.02], [0.1, 0.02], [0.55, 1.9, 'ease-out'], [o.duration - 0.3, 1.9], [o.duration, 1.9]])
      swept.effects = { hueRotate: 48 }
      const title = word(text, { color: '#141414', fontSize: 72 }, o)
      const t2 = withKeys(title, 'opacity', [[0, 0], [0.15, 0], [0.3, 1], [o.duration - 0.3, 1], [o.duration, 0]])
      return pushClips([swept, t2])
    },
  },
  {
    id: 'pixel-stretch-in', name: 'Pixel Stretch Intro', category: 'Retro / Glitch', source: 'CapCut pixel-stretch text (watermark L3)', ideal: [3, 12], demo: 'STRETCH',
    build: (text, o) => {
      const created: Clip[] = []
      created.push(withFade(word(text, {}, o), 0.35, 0.3))
      const t = track()
      ;[0, 0.34].forEach((off, i) => {
        const s = textClip(t, start() + off, 0.3, { text, fontSize: 88, bold: true, fontFamily: FONT, color: '#fff' }, { name: `stretch slice ${i}` })
        s.effects = { pixelStretch: 34 - i * 14, chromatic: 7 }
        created.push(s)
      })
      return pushClips(created)
    },
  },
  {
    id: 'credit-roll', name: 'Credit Roll Rise', category: 'Motion', source: 'Credits/roll text tutorials', ideal: [4, 24], demo: 'THE END',
    build: (text, o) => {
      const c = word(text, { fontFamily: 'Georgia, serif', bold: false, fontSize: 58 }, o)
      withKeys(c, 'position_y', [[0, 330, 'smooth'], [o.duration * 0.75, -40, 'smooth'], [o.duration, -90]])
      withKeys(c, 'opacity', [[0, 0], [o.duration * 0.2, 1], [o.duration * 0.85, 1], [o.duration, 0]])
      return pushClips([c])
    },
  },
  {
    id: 'minimal-fade', name: 'Minimal Fade', category: 'Style', source: 'Minimal typography tutorials', ideal: [2, 20], demo: 'less, but better',
    build: (text, o) => {
      const c = word(text, { fontFamily: 'Inter, sans-serif', bold: false, fontSize: 52, letterSpacing: 4, color: '#e8e8ee' }, o)
      withKeys(c, 'opacity', [[0, 0, 'ease-in'], [o.duration * 0.3, 0.92], [o.duration * 0.75, 0.92], [o.duration, 0, 'ease-out']])
      withKeys(c, 'position_y', [[0, 14, 'smooth'], [o.duration, -6, 'smooth']])
      return pushClips([c])
    },
  },
  {
    id: 'vertical-stack', name: 'Vertical Letter Stack', category: 'Style', source: 'Vertical typography tutorials', ideal: [3, 8], demo: 'STACK',
    build: (text, o) => {
      const chars = [...text]
      const created: Clip[] = []
      chars.forEach((ch, i) => {
        const c = textClip(track(), start(), o.duration, { text: ch, fontSize: 84, bold: true, fontFamily: FONT, color: '#ffffff', glowColor: o.color, glowBlur: 8 }, { name: ch })
        c.transform = { ...c.transform, y: (i - (chars.length - 1) / 2) * 92 }
        created.push(withFade(c, 0.3, 0.3))
      })
      return pushClips(created)
    },
  },
  {
    id: 'echo-trail', name: 'Echo Trail', category: 'Motion', source: 'Echo/trail motion text tutorials', ideal: [2, 10], demo: 'TRAIL',
    build: (text, o) => {
      const created: Clip[] = []
      ;[3, 2, 1].forEach((k) => {
        const c = word(text, { color: o.color }, o, { name: `trail ghost ${k}` })
        c.transform = { ...c.transform, x: -k * 17, y: k * 7, opacity: 0.16 }
        created.push(c)
      })
      const main = word(text, {}, o)
      withKeys(main, 'position_x', [[0, -70, 'ease-out'], [0.5, 0, 'ease-out'], [o.duration - 0.3, 0], [o.duration, 24]])
      withKeys(main, 'opacity', [[0, 1], [o.duration - 0.3, 1], [o.duration, 0]])
      created.push(main)
      return pushClips(created)
    },
  },
  {
    id: 'shake-smooth', name: 'Smooth Shake Text (Wizzy)', category: 'Motion', source: 'Wizzy Tutorials — Make YOUR OWN Shake Effects (91AtnciF8fc)', ideal: [2, 10], demo: 'SMOOTH',
    build: (text, o) => {
      const c = word(text, { glowColor: o.color, glowBlur: 10 }, o)
      const keys: [number, number, string?][] = [[0, 0]]
      for (let t = 0.06; t < 1.5; t += 0.07) { const decay = 1 - t / 1.6; keys.push([t, Math.sin(t * 42) * 6 * decay, 'smooth']) }
      keys.push([1.6, 0], [o.duration, 0])
      withKeys(c, 'position_x', keys)
      const ky: [number, number, string?][] = keys.map(([t, v, e]) => [t, v * 0.6, e] as [number, number, string?])
      withKeys(c, 'position_y', ky)
      return pushClips([withFade(c, 0.15, 0.25)])
    },
  },
  {
    id: 'shake-aggressive', name: 'Aggressive Shake Text (Wizzy)', category: 'Motion', source: 'Wizzy Tutorials — Make YOUR OWN Shake Effects (91AtnciF8fc)', ideal: [2, 8], demo: 'CHAOS',
    build: (text, o) => {
      const c = word(text, { color: '#ffffff', glowColor: '#ff2222', glowBlur: 12 }, o)
      const rng = seededRng(o.seed)
      const kx: [number, number, string?][] = [[0, 0]]
      const ky: [number, number, string?][] = [[0, 0]]
      const kr: [number, number, string?][] = [[0, 0]]
      for (let t = 0.05; t < 1.3; t += 0.05) {
        const decay = 1 - t / 1.45
        kx.push([t, (rng() * 2 - 1) * 17 * decay]); ky.push([t, (rng() * 2 - 1) * 12 * decay]); kr.push([t, (rng() * 2 - 1) * 2.4 * decay])
      }
      kx.push([1.4, 0], [o.duration, 0]); ky.push([1.4, 0], [o.duration, 0]); kr.push([1.4, 0], [o.duration, 0])
      withKeys(c, 'position_x', kx); withKeys(c, 'position_y', ky); withKeys(c, 'rotation_z', kr)
      return pushClips([withFade(c, 0.1, 0.25)])
    },
  },
  {
    id: 'fire-text', name: 'Fire Text', category: 'Glow / Neon', source: 'Fire text tutorials (subscription scan)', ideal: [3, 10], demo: 'FIRE',
    build: (text, o) => {
      const halo = word(text, { color: '#ff6a00', glowColor: '#ff4400', glowBlur: 36 }, o, { name: 'fire halo' })
      const rng = seededRng(o.seed)
      const keys: [number, number, string?][] = [[0, 0.4]]
      for (let t = 0.15; t < o.duration - 0.3; t += 0.13) keys.push([t, 0.55 + rng() * 0.45])
      keys.push([o.duration - 0.25, 0.9], [o.duration, 0])
      withKeys(halo, 'opacity', keys)
      const core = word(text, { color: '#ffd23f', glowColor: '#ff9500', glowBlur: 12 }, o)
      return pushClips([halo, withFade(core, 0.2, 0.3)])
    },
  },
  {
    id: 'ice-text', name: 'Ice Text', category: 'Glow / Neon', source: 'Frozen/ice text tutorials (subscription scan)', ideal: [3, 10], demo: 'FROZEN',
    build: (text, o) => {
      const halo = word(text, { color: '#a5f3fc', glowColor: '#22d3ee', glowBlur: 30 }, o, { name: 'ice halo' })
      const core = word(text, { color: '#ffffff', glowColor: '#bae6fd', glowBlur: 8 }, o)
      withKeys(core, 'opacity', [[0, 0, 'ease-out'], [0.4, 1], [o.duration / 2, 0.9], [o.duration - 0.3, 1], [o.duration, 0]])
      return pushClips([withFade(halo, 0.3, 0.4), core])
    },
  },
  {
    id: 'gold-text', name: 'Gold Shine Text', category: 'Style', source: 'Gold/metallic text tutorials (subscription scan)', ideal: [3, 10], demo: 'GOLD',
    build: (text, o) => {
      const golds = ['#b8860b', '#daa520', '#ffd700', '#ffec8b', '#ffd700', '#daa520']
      return letters(text, o, (ctx) => [withFade(letterClip(ctx, { color: golds[ctx.i % golds.length], glowColor: '#ffaa00', glowBlur: 10 }), 0.3, 0.3)])
    },
  },
  {
    id: 'gradient-flow', name: 'Gradient Flow Letters', category: 'Style', source: 'Animated gradient text tutorials (subscription scan)', ideal: [4, 14], demo: 'FLOW',
    build: (text, o) => {
      const stops = ['#22d3ee', '#34d399', '#a3e635', '#facc15', '#fb923c', '#f472b6', '#a78bfa']
      return letters(text, o, (ctx) => {
        const col = stops[Math.floor(ctx.u * (stops.length - 1))]
        const c = letterClip(ctx, { color: col, glowColor: col, glowBlur: 7 })
        withKeys(c, 'position_y', [[0, 0, 'smooth'], [ctx.dur / 2, -7, 'smooth'], [ctx.dur, 0, 'smooth']])
        return [withFade(c, 0.3, 0.3)]
      })
    },
  },
  {
    id: 'long-shadow', name: 'Long Shadow Retro', category: 'Style', source: 'Long shadow text tutorials (subscription scan)', ideal: [3, 10], demo: 'SHADOW',
    build: (text, o) => {
      const created: Clip[] = []
      for (let k = 6; k >= 1; k--) {
        const c = word(text, { color: '#15151f' }, o, { name: `shadow ${k}` })
        c.transform = { ...c.transform, x: k * 5, y: k * 5 }
        created.push(c)
      }
      created.push(withFade(word(text, { color: o.color, glowColor: o.color, glowBlur: 6 }, o), 0.25, 0.3))
      return pushClips(created)
    },
  },
  {
    id: 'blur-focus', name: 'Blur Focus Pull', category: 'Motion', source: 'Blur reveal / focus pull title tutorials', ideal: [3, 14], demo: 'FOCUS',
    build: (text, o) => {
      const blurred = word(text, {}, o, { name: 'blurred pass' })
      blurred.effects = { blur: 16 }
      blurred.duration = Math.min(0.85, o.duration * 0.4)
      blurred.transform = { ...blurred.transform, scale: 1.07, scaleY: 1.07 }
      const sharp = word(text, {}, o)
      const offset = Math.min(0.55, o.duration * 0.28)
      sharp.start = start() + offset
      sharp.duration = o.duration - offset
      withKeys(sharp, 'opacity', [[0, 0], [0.25, 1], [sharp.duration - 0.3, 1], [sharp.duration, 0]])
      return pushClips([withFade(blurred, 0.1, 0.3), sharp])
    },
  },
  {
    id: 'vhs-text', name: 'VHS Camcorder Text', category: 'Retro / Glitch', source: 'VHS retro overlay text tutorials', ideal: [3, 12], demo: 'PLAY ►',
    build: (text, o) => {
      const created: Clip[] = []
      const main = word(text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 76 }, o)
      const ky: [number, number, string?][] = [[0, 0], [0.5, 1.5], [1.1, -1], [1.7, 1], [2.3, -1.5], [o.duration, 0]]
      withKeys(main, 'position_y', ky)
      created.push(withFade(main, 0.2, 0.3))
      const t = track()
      ;[0.45, 1.35, 2.2].forEach((off, i) => {
        const sl = textClip(t, start() + off, 0.16, { text, fontSize: 76, bold: true, fontFamily: 'ui-monospace, Menlo, monospace', color: '#fff' }, { name: `vhs tear ${i}` })
        sl.effects = { chromatic: 14, waveWarp: 9 }
        created.push(sl)
      })
      return pushClips(created)
    },
  },
  {
    id: 'word-pop', name: 'Word Pop Captions', category: 'Style', source: 'Word-by-word caption tutorials (podcast style)', ideal: [6, 28], demo: 'EVERY WORD POPS',
    build: (text, o) => {
      const wordsArr = text.split(/\s+/).filter(Boolean)
      const created: Clip[] = []
      const per = Math.min(0.42, (o.duration * 0.7) / Math.max(1, wordsArr.length))
      const FS = 68
      const widths = wordsArr.map((w) => measureText(w, FS))
      const ws = o.wordSpacing ? clampSpacing(text, 0, o.wordSpacing, FS).wordSpacing : 0
      const gap = 16 + ws
      const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, wordsArr.length - 1) * gap
      let cursor = -total / 2
      wordsArr.forEach((w, wi) => {
        const c = textClip(track(), start(), o.duration, { text: w, fontSize: FS, bold: true, fontFamily: FONT, color: wi % 2 ? '#ffffff' : o.color }, { name: w })
        c.transform = { ...c.transform, x: cursor + widths[wi] / 2 }
        cursor += widths[wi] + gap
        const on = wi * per
        withKeys(c, 'scale_x', [[0, 0], [on, 0], [on + 0.14, 1.12, 'back'], [on + 0.24, 1], [o.duration - 0.25, 1], [o.duration, 1]])
        withKeys(c, 'scale_y', [[0, 0], [on, 0], [on + 0.14, 1.12, 'back'], [on + 0.24, 1]])
        withKeys(c, 'opacity', [[0, 0], [on, 0], [on + 0.03, 1], [o.duration - 0.25, 1], [o.duration, 0]])
        created.push(c)
      })
      return pushClips(created)
    },
  },
  {
    id: 'scramble-padding', name: 'Gibberish Padding Reveal', category: 'Retro / Glitch', source: 'Scramble/decode text tutorials — filler grows with duration', ideal: [3, 12], demo: 'DECODE',
    build: (text, o) => {
      const rng = seededRng(o.seed)
      const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$<>/'
      // Filler padding scales with duration: ~6 gibberish chars per second.
      const fill = Math.max(2, Math.min(20, Math.round(o.duration * 3)))
      const gib = (k: number) => Array.from({ length: k }, () => CH[Math.floor(rng() * CH.length)]).join('')
      const padded = `${gib(fill)} ${text} ${gib(fill)}`
      const scramble = word(padded, { color: '#9ef01a', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 64, randomizer: { seed: o.seed, untilSec: Math.min(5, o.duration * 0.72), charset: CH } }, o, { name: 'gibberish padding' })
      scramble.duration = o.duration * 0.78
      const clean = word(text, { color: '#ffffff', glowColor: '#9ef01a', glowBlur: 10 }, o, { name: 'decoded text' })
      const onAt = o.duration * 0.62
      clean.start = start() + onAt
      clean.duration = o.duration - onAt
      withKeys(clean, 'opacity', [[0, 0], [0.12, 1], [clean.duration - 0.25, 1], [clean.duration, 0]])
      return pushClips([withFade(scramble, 0.05, 0.2), clean])
    },
  },
  {
    id: 'glitch-blocks', name: 'Glitch Blocks Datamosh', category: 'Retro / Glitch', source: 'Datamosh/block glitch text tutorials (subscription scan)', ideal: [3, 10], demo: 'D4TA',
    build: (text, o) => {
      const created: Clip[] = []
      created.push(withFade(word(text, {}, o), 0.3, 0.3))
      const t = track()
      const rng = seededRng(o.seed)
      ;[0.2, 0.55, 1.0, 1.6].forEach((off, i) => {
        const sl = textClip(t, start() + off, 0.14, { text, fontSize: 88, bold: true, fontFamily: FONT, color: '#fff' }, { name: `block tear ${i}` })
        sl.effects = { pixelStretch: 20 + Math.floor(rng() * 26), chromatic: 12, waveWarp: 4 }
        sl.transform = { ...sl.transform, y: (rng() * 2 - 1) * 22 }
        created.push(sl)
      })
      return pushClips(created)
    },
  },
  {
    id: 'chrome-text', name: 'Retro Chrome 80s', category: 'Style', source: '80s chrome text tutorials (subscription scan)', ideal: [3, 10], demo: 'CHROME',
    build: (text, o) => {
      const stops = ['#f8fafc', '#7dd3fc', '#1d4ed8', '#f0abfc', '#f8fafc']
      return letters(text, o, (ctx) => [withFade(letterClip(ctx, { color: stops[Math.floor(ctx.u * (stops.length - 1))], glowColor: '#38bdf8', glowBlur: 9, strokeColor: '#0f172a', strokeWidth: 1.5 }), 0.3, 0.3)])
    },
  },
  {
    id: 'neon-outline', name: 'Neon Outline Only', category: 'Glow / Neon', source: 'Outline neon sign tutorials (subscription scan)', ideal: [3, 10], demo: 'OUTLINE',
    build: (text, o) => {
      const c = word(text, { color: 'transparent', strokeColor: o.color, strokeWidth: 2.5, strokeOnly: true, glowColor: o.color, glowBlur: 22 }, o)
      const rng = seededRng(o.seed + 3)
      const keys: [number, number, string?][] = [[0, 0], [0.1, 1], [0.16, 0.3], [0.24, 1]]
      for (let t = 0.9; t < o.duration - 0.3; t += 0.5 + rng() * 0.6) keys.push([t, 0.6 + rng() * 0.4])
      keys.push([o.duration - 0.25, 1], [o.duration, 0])
      return pushClips([withKeys(c, 'opacity', keys)])
    },
  },
  {
    id: 'bubble-pop', name: 'Y2K Bubble Pop', category: 'Motion', source: 'Bubble/Y2K text tutorials (subscription scan)', ideal: [3, 10], demo: 'BUBBLE',
    build: (text, o) => letters(text, o, (ctx) => {
      const cols = ['#fda4af', '#93c5fd', '#86efac', '#fde68a', '#c4b5fd']
      const c = letterClip(ctx, { color: cols[ctx.i % cols.length], glowColor: cols[ctx.i % cols.length], glowBlur: 6 })
      const d = ctx.u * 0.6
      withKeys(c, 'scale_x', [[0, 0], [d, 0], [d + 0.3, 1.25, 'elastic'], [d + 0.55, 1], [ctx.dur - 0.25, 1], [ctx.dur, 1]])
      withKeys(c, 'scale_y', [[0, 0], [d, 0], [d + 0.3, 1.25, 'elastic'], [d + 0.55, 1]])
      withKeys(c, 'opacity', [[0, 0], [d, 0], [d + 0.04, 1], [ctx.dur - 0.25, 1], [ctx.dur, 0]])
      return [c]
    }),
  },
]

export function buildTextPreset(id: string, text: string, opts?: Partial<PresetBuildOpts>): string[] {
  const def = TEXT_PRESETS.find((p) => p.id === id)
  if (!def) return []
  const clean = (text || '').trim() || def.demo
  const o: PresetBuildOpts = {
    seed: opts?.seed ?? 7,
    color: opts?.color ?? '#ff2a4d',
    duration: opts?.duration ?? 3,
    delay: opts?.delay ?? 0,
    charSpacing: opts?.charSpacing ?? 0,
    wordSpacing: opts?.wordSpacing ?? 0,
    graph: opts?.graph ?? 'preset',
    glow: opts?.glow,
    typewriterCursor: opts?.typewriterCursor ?? 'follow',
  }
  const ids = def.build(clean.slice(0, 28), o)
  if (!ids.length) return ids

  // --- Post-settings: animation delay, graph (interpolation), glow stack ---
  const graph = o.graph && o.graph !== 'preset' ? o.graph : null
  const delay = o.delay ?? 0
  const glow = o.glow
  const st = useEditor.getState()
  const applyTo = (c: Clip): Clip => {
    let nc = c
    if (delay) nc = { ...nc, start: nc.start + delay }
    if (graph && nc.animation) {
      const curves: Record<string, { keyframes: { interpolation: string }[] }> = {}
      for (const [k, cv] of Object.entries(nc.animation.curves)) {
        curves[k] = { ...cv, keyframes: cv.keyframes.map((kf) => (kf.time === 0 && cv.keyframes.length > 1 && k === 'opacity' ? kf : { ...kf, interpolation: graph })) }
      }
      nc = { ...nc, animation: { ...nc.animation, curves: curves as never } }
    }
    if (glow && nc.textStyle?.glowColor) {
      nc = { ...nc, textStyle: { ...nc.textStyle, glowBlur: Math.max(0, Math.min(90, (nc.textStyle.glowBlur ?? 12) * glow.blur * glow.intensity)) } }
    }
    return nc
  }
  useEditor.setState({ clips: st.clips.map((c) => (ids.includes(c.id) ? applyTo(c) : c)) })

  // Glow spread copies along the angle (layered = smoother).
  let extraIds: string[] = []
  if (glow && (glow.spread > 0 || glow.clarity > 0 || glow.smoothness > 0)) {
    const fresh = useEditor.getState().clips.filter((c) => ids.includes(c.id) && c.textStyle?.glowColor)
    const copies: Clip[] = []
    const rad = (glow.angle * Math.PI) / 180
    const layers = 1 + Math.round(glow.smoothness * 2)
    for (const c of fresh) {
      for (let k = 1; k <= layers; k++) {
        if (glow.spread <= 0) break
        const d = (glow.spread * k) / layers
        const copy: Clip = JSON.parse(JSON.stringify(c))
        copy.id = `glow-${Math.random().toString(36).slice(2, 10)}`
        copy.name = `${c.name} glow`
        copy.transform = { ...copy.transform, x: copy.transform.x + Math.cos(rad) * d, y: copy.transform.y + Math.sin(rad) * d, opacity: 0.45 }
        if (copy.textStyle) copy.textStyle = { ...copy.textStyle, glowBlur: (copy.textStyle.glowBlur ?? 12) * (glow.sharpness === 'effect' ? 0.45 : 1) }
        copies.push(copy)
      }
      if (glow.clarity > 0) {
        const core: Clip = JSON.parse(JSON.stringify(c))
        core.id = `glow-${Math.random().toString(36).slice(2, 10)}`
        core.name = `${c.name} clarity core`
        if (core.textStyle) core.textStyle = { ...core.textStyle, color: '#ffffff', glowBlur: glow.sharpness === 'text' ? 0 : core.textStyle.glowBlur }
        core.transform = { ...core.transform, opacity: 0.3 + 0.7 * glow.clarity }
        copies.push(core)
      }
    }
    if (copies.length) extraIds = pushClips(copies)
  }
  return [...ids, ...extraIds]
}

export function lengthGuidance(def: TextPresetDef, text: string): string {
  const n = [...(text || '').trim()].length
  if (!n) return `Demo text “${def.demo}” will be used.`
  if (n < def.ideal[0]) return `${n} character${n === 1 ? '' : 's'} — this look is best with ${def.ideal[0]}–${def.ideal[1]}. It still maps — fewer letters just means simpler motion.`
  if (n > def.ideal[1]) return `${n} characters — best with ${def.ideal[0]}–${def.ideal[1]}. Timing compresses to fit; consider two lines for long phrases.`
  return `${n} characters — right in this preset's sweet spot (${def.ideal[0]}–${def.ideal[1]}).`
}
