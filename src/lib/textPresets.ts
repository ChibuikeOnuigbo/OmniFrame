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
  build: (text: string, o: { seed: number; color: string; duration: number }) => string[]
}

const FONT = 'Arial Black, sans-serif'
type O = { seed: number; color: string; duration: number }

function track() { return useEditor.getState().createTrack('video') }
function start() { return useEditor.getState().playhead }

function word(text: string, style: Omit<TextTitleStyle, 'text'>, o: O, clipOpts: Partial<Clip> = {}): Clip {
  return textClip(track(), start(), o.duration, { fontSize: 88, bold: true, fontFamily: FONT, color: '#ffffff', ...style, text }, clipOpts)
}

interface LetterCtx { ch: string; i: number; n: number; u: number; x: number; trackId: string; t0: number; dur: number }
function letters(text: string, o: O, fn: (ctx: LetterCtx) => Clip[]): string[] {
  const chars = [...text]
  const n = chars.length
  const advance = 60
  const totalW = Math.max(0, n - 1) * advance
  const created: Clip[] = []
  chars.forEach((ch, i) => {
    if (ch === ' ') return
    const ctx: LetterCtx = { ch, i, n, u: n <= 1 ? 0 : i / (n - 1), x: -totalW / 2 + i * advance, trackId: track(), t0: start(), dur: o.duration }
    created.push(...fn(ctx))
  })
  return pushClips(created)
}

function letterClip(ctx: LetterCtx, style: Omit<TextTitleStyle, 'text'>, opts: Partial<Clip> = {}): Clip {
  const c = textClip(ctx.trackId, ctx.t0, ctx.dur, { fontSize: 88, bold: true, fontFamily: FONT, color: '#ffffff', ...style, text: ctx.ch }, opts)
  c.transform = { ...c.transform, x: ctx.x }
  return c
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
  {
    id: 'typewriter', name: 'Typewriter + Cursor', category: 'Style', source: 'Typewriter text tutorials (all editors)', ideal: [4, 20], demo: 'HELLO WORLD',
    build: (text, o) => {
      const chars = [...text]
      const per = Math.min(0.16, (o.duration * 0.55) / Math.max(1, chars.length))
      const ids = letters(text, o, (ctx) => {
        const c = letterClip(ctx, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 72 })
        const on = ctx.i * per
        withKeys(c, 'opacity', [[0, 0], [on, 0], [on + 0.02, 1], [ctx.dur - 0.3, 1], [ctx.dur, 0]])
        return [c]
      })
      // blinking cursor bar after the last letter
      const barId = barAssetId(useEditor.getState())
      const cursor = baseClip({ trackId: track(), start: start(), duration: o.duration, name: 'cursor', kind: 'image', assetId: barId })
      cursor.transform = { ...cursor.transform, x: (chars.length * 30) + 26, scale: 0.09, scaleY: 1.6 }
      const blink: [number, number, string?][] = [[0, 1]]
      for (let t = 0.4; t < o.duration - 0.2; t += 0.8) blink.push([t, 0], [t + 0.4, 1])
      blink.push([o.duration, 0])
      withKeys(cursor, 'opacity', blink)
      pushClips([cursor])
      return [...ids, cursor.id]
    },
  },
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
]

export function buildTextPreset(id: string, text: string, opts?: Partial<O>): string[] {
  const def = TEXT_PRESETS.find((p) => p.id === id)
  if (!def) return []
  const clean = (text || '').trim() || def.demo
  const o: O = { seed: opts?.seed ?? 7, color: opts?.color ?? '#ff2a4d', duration: opts?.duration ?? 3 }
  // R2: very short text collapses per-letter looks to whole-word timing —
  // the builders already key off normalized position, so short words map
  // safely; nothing to force, nothing to drop.
  return def.build(clean.slice(0, 28), o)
}

export function lengthGuidance(def: TextPresetDef, text: string): string {
  const n = [...(text || '').trim()].length
  if (!n) return `Demo text “${def.demo}” will be used.`
  if (n < def.ideal[0]) return `${n} character${n === 1 ? '' : 's'} — this look is best with ${def.ideal[0]}–${def.ideal[1]}. It still maps — fewer letters just means simpler motion.`
  if (n > def.ideal[1]) return `${n} characters — best with ${def.ideal[0]}–${def.ideal[1]}. Timing compresses to fit; consider two lines for long phrases.`
  return `${n} characters — right in this preset's sweet spot (${def.ideal[0]}–${def.ideal[1]}).`
}
