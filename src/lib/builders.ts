/**
 * One-click builders from the tutorial studies:
 *  - Retro Text (Alight Motion, Noelle Tutorials UxfwndLF8cY): effects
 *    method (Text Randomizer + glow) and traditional method (per-letter
 *    1-frame glitch mutations that settle, deterministic from a seed).
 *  - Watermark Studio (CapCut, NDK Edit r6GsP90vBLk): six levels from a
 *    glowing text tag to an animated character logo with voice tag,
 *    built as ordinary clips (compounds when stamped), so everything
 *    stays editable — nothing is baked or faked.
 */
import { useEditor } from '../store'
import type { Clip, ClipEffect, TextTitleStyle } from '../types'
import { createDefaultClipAnimation } from './animation/CurveEngine'

let uidCounter = 0
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

export function seededRng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1
  return () => {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5
    return (a >>> 0) / 4294967295
  }
}

type Store = ReturnType<typeof useEditor.getState>

export function pushClips(clips: Clip[]) {
  const st = useEditor.getState()
  useEditor.setState({ clips: [...st.clips, ...clips] })
  return clips.map((c) => c.id)
}

export function baseClip(partial: Partial<Clip> & { trackId: string; start: number; duration: number; name: string }): Clip {
  return {
    id: uid('clip'),
    assetId: '',
    inPoint: 0,
    kind: 'text',
    volume: 1,
    hidden: false,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, pivotX: 0.5, pivotY: 0.5 },
    ...partial,
  } as Clip
}

export function textClip(trackId: string, start: number, duration: number, style: TextTitleStyle, opts: Partial<Clip> = {}): Clip {
  return baseClip({
    trackId, start, duration,
    name: (style.text || 'Text').slice(0, 24) || 'Text',
    kind: 'text',
    textStyle: style,
    ...opts,
  })
}

export function withKeys(clip: Clip, prop: string, keys: [number, number, string?][]): Clip {
  // Merge into any existing animation — stacking curves must not drop
  // the ones already written (position + opacity + scale combos).
  const anim = clip.animation || createDefaultClipAnimation(clip.transform, clip.duration)
  anim.curves[prop].keyframes = keys.map(([time, value, easingPreset], i) => ({
    id: `${clip.id}_${prop}_${i}`,
    time, value,
    interpolation: 'bezier' as const,
    easingPreset: easingPreset || 'ease-in-out',
  }))
  clip.animation = anim
  return clip
}

export function withFade(clip: Clip, fadeIn = 0.4, fadeOut = 0.4, peak?: number): Clip {
  const top = peak ?? clip.transform.opacity
  const d = clip.duration
  return withKeys(clip, 'opacity', [
    [0, 0, 'ease-out'],
    [Math.min(fadeIn, d / 2), top, 'ease-out'],
    [Math.max(fadeIn, d - fadeOut), top, 'ease-in'],
    [d, 0, 'ease-in'],
  ])
}

/** White bar asset for retro wipe rectangles (created once per build). */
export function barAssetId(st: Store): string {
  const existing = st.assets.find((a) => a.id === 'builders-white-bar')
  const c = document.createElement('canvas')
  // Image clips are cover-fit to the frame, so the bar must be a
  // full-frame transparent canvas with a painted centre band — a small
  // asset would flood the frame when cover-scaled.
  c.width = 1920; c.height = 1080
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1920, 1080)
  g.fillStyle = '#ffffff'; g.fillRect(0, 488, 1920, 104)
  st.addAsset({ id: 'builders-white-bar', name: 'white-bar.png', kind: 'image', url: c.toDataURL('image/png'), width: 1920, height: 1080, duration: 8 } as never)
  return 'builders-white-bar'
}

export interface RetroOptions {
  text: string
  sub: string
  color: string
  seed: number
  method: 'effects' | 'traditional'
  duration: number
  fontFamily?: string
}

export function buildRetroText(opts: RetroOptions): string[] {
  const st = useEditor.getState()
  const start = st.playhead
  const dur = Math.max(1.2, opts.duration)
  const font = opts.fontFamily || 'Arial Black, sans-serif'
  const created: Clip[] = []
  const shadowTrack = st.createTrack('video')
  const fxTrack = st.createTrack('video')

  // red/colored shadow base (traditional bottom layer)
  const shadow = textClip(shadowTrack, start, dur, {
    text: opts.text, fontSize: 92, color: opts.color, bold: true, fontFamily: font,
    glowColor: opts.color, glowBlur: 26, letterSpacing: 5,
  }, { name: `${opts.text} shadow` })
  shadow.transform = { ...shadow.transform, y: 10 }
  created.push(withFade(shadow, 0.25, 0.3))

  if (opts.method === 'effects') {
    const main = textClip(fxTrack, start, dur, {
      text: opts.text, fontSize: 92, color: '#ffffff', bold: true, fontFamily: font,
      glowColor: '#ffffff', glowBlur: 14, letterSpacing: 5,
      randomizer: { seed: opts.seed, untilSec: 0.9 },
    }, { name: `${opts.text} (randomizer)` })
    created.push(withFade(main, 0.15, 0.3))
  } else {
    // traditional: per-letter settled clips with 1-frame mutation gaps
    const letters = [...opts.text].slice(0, 14)
    const advance = 62 // project px per glyph at fontSize 92 (builder metric)
    const totalW = Math.max(1, letters.length - 1) * advance
    letters.forEach((ch, li) => {
      if (ch === ' ') return
      const trackId = st.createTrack('video')
      const rng = seededRng(opts.seed * 131 + li * 17 + 5)
      const x = -totalW / 2 + li * advance
      const frames = 10
      const mutations = new Map<number, Clip>()
      for (let f = 0; f < frames; f++) {
        if (rng() > 0.55) continue
        const kind = rng()
        const mStyle: TextTitleStyle = {
          text: kind < 0.18 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(rng() * 36)] : ch,
          fontSize: 92, bold: true, fontFamily: font,
          color: kind < 0.45 ? opts.color : kind < 0.7 ? '#00e5ff' : '#ffffff',
          strokeColor: '#ffffff', strokeWidth: kind >= 0.85 ? 2 : 0, strokeOnly: kind >= 0.85,
          glowColor: opts.color, glowBlur: 18, letterSpacing: 5,
        }
        const m = textClip(trackId, start + f / 30, 1 / 30, mStyle, { name: `${ch} glitch f${f}` })
        m.transform = {
          ...m.transform, x: x + (rng() - 0.5) * 26, y: (rng() - 0.5) * 18,
          rotation: (rng() - 0.5) * 28, scale: 0.85 + rng() * 0.4,
        }
        mutations.set(f, m)
      }
      // settled segments fill everything the mutations don't cover
      let cursor = 0 // frames
      const seg = (fromF: number, toF: number) => {
        if (toF <= fromF) return
        const c = textClip(trackId, start + fromF / 30, (toF - fromF) / 30, {
          text: ch, fontSize: 92, color: '#ffffff', bold: true, fontFamily: font,
          glowColor: '#ffffff', glowBlur: 12, letterSpacing: 5,
        }, { name: `${ch}` })
        c.transform = { ...c.transform, x }
        created.push(c)
      }
      for (let f = 0; f < frames; f++) {
        if (mutations.has(f)) {
          seg(cursor, f)
          created.push(mutations.get(f)!)
          cursor = f + 1
        }
      }
      seg(cursor, Math.round(dur * 30))
    })
  }

  // bar-wipe rectangles: frame 0 small, gap, end large (tutorial base)
  const bar = barAssetId(useEditor.getState())
  const barTrack = st.createTrack('video')
  const mkBar = (at: number, scale: number, len = 2 / 30) => {
    const c = baseClip({ trackId: barTrack, start: start + at, duration: len, name: 'wipe bar', kind: 'image', assetId: bar })
    c.transform = { ...c.transform, scale, y: -6 }
    return c
  }
  created.push(mkBar(0, 0.5), mkBar(3 / 30, 1.05), mkBar(dur - 4 / 30, 1.3))

  if (opts.sub.trim()) {
    const subTrack = st.createTrack('video')
    const sub = textClip(subTrack, start + 0.25, dur - 0.25, {
      text: opts.sub, fontSize: 30, color: '#e8e8f2', fontFamily: font, letterSpacing: 8,
    }, { name: opts.sub.slice(0, 24) })
    sub.transform = { ...sub.transform, y: 92 }
    created.push(withFade(sub, 0.4, 0.3))
  }
  return pushClips(created)
}

// ---------------------------------------------------------------------
export type WatermarkLevel = 1 | 2 | 3 | 4 | 5 | 6
export interface WatermarkOptions {
  text: string
  level: WatermarkLevel
  color: string
  fontFamily?: string
  characterAssetId?: string
  voiceAssetId?: string
  duration: number
  seed: number
}

export const WATERMARK_LEVELS: { level: WatermarkLevel; name: string; desc: string }[] = [
  { level: 1, name: 'Level 1 · Text Glow', desc: 'Name text with a glow and fade in/out' },
  { level: 2, name: 'Level 2 · Character + Text', desc: 'Cut-out character beside your name, gentle drift, graph ease' },
  { level: 3, name: 'Level 3 · Pixel Stretch FX', desc: 'Pixel-stretch + chromatic intro slices over the text' },
  { level: 4, name: 'Level 4 · Animated Character', desc: 'Wave-warp life, sway rotation, text, optional voice tag' },
  { level: 5, name: 'Level 5 · Logo Mark', desc: 'Logo/character mark pops in, randomizer text reveal, signature sound slot' },
  { level: 6, name: 'Level 6 · Creative Combo', desc: 'Lighten-blended logo, stretch slices, drift and fades combined' },
]

export function buildWatermark(opts: WatermarkOptions): string[] {
  const st = useEditor.getState()
  const start = st.playhead
  const dur = Math.max(1.5, opts.duration)
  const font = opts.fontFamily || 'Arial Black, sans-serif'
  const created: Clip[] = []
  const charAsset = opts.characterAssetId ? st.assets.find((a) => a.id === opts.characterAssetId) : undefined

  const textTrack = st.createTrack('video')
  const main = textClip(textTrack, start, dur, {
    text: opts.text, fontSize: 54, color: '#ffffff', bold: true, fontFamily: font,
    glowColor: opts.level === 1 ? opts.color : '#ffffff',
    glowBlur: opts.level === 1 ? 24 : 10,
    letterSpacing: 3,
    ...(opts.level >= 5 ? { randomizer: { seed: opts.seed, untilSec: 0.7 } } : {}),
  }, { name: `Watermark · ${opts.text}`.slice(0, 32) })
  main.transform = { ...main.transform, x: charAsset && opts.level !== 1 ? 130 : 0, opacity: 0.62 }
  created.push(withFade(main, 0.4, 0.4, 0.62))

  if (charAsset && opts.level !== 1) {
    const charTrack = st.createTrack('video')
    const ch = baseClip({
      trackId: charTrack, start, duration: dur, name: `Watermark character`, kind: charAsset.kind === 'video' ? 'video' : 'image', assetId: charAsset.id,
    })
    ch.transform = { ...ch.transform, x: -190, scale: 0.42, opacity: 0.9 }
    if (opts.level === 4) {
      ch.effects = { waveWarp: 6 }
      withKeys(ch, 'rotation_z', [[0, -3, 'ease-in-out'], [dur / 2, 3, 'ease-in-out'], [dur, -3, 'ease-in-out']])
      // merge sway with the fade applied below
      const anim = ch.animation!
      created.push(ch)
      const faded = withFade(ch, 0.4, 0.4, 0.9)
      faded.animation = anim
      // re-add opacity curve alongside sway
      const full = createDefaultClipAnimation(faded.transform, dur)
      full.curves.rotation_z.keyframes = anim.curves.rotation_z.keyframes
      full.curves.opacity.keyframes = faded.animation!.curves.opacity.keyframes
      faded.animation = full
    } else if (opts.level === 5) {
      const pop = withKeys(ch, 'scale_x', [[0, 0.4, 'back'], [0.45, 1, 'back']])
      withKeys(pop, 'scale_y', [[0, 0.4, 'back'], [0.45, 1, 'back']])
      created.push(withFade(pop, 0.3, 0.4, 0.9))
    } else {
      if (opts.level === 2 || opts.level === 6) {
        withKeys(ch, 'position_x', [[0, -206, 'ease-in-out'], [dur, -174, 'ease-in-out']])
        const drift = ch.animation
        const faded = withFade(ch, 0.4, 0.4, 0.9)
        const full = createDefaultClipAnimation(faded.transform, dur)
        full.curves.position_x.keyframes = drift!.curves.position_x.keyframes
        full.curves.opacity.keyframes = faded.animation!.curves.opacity.keyframes
        faded.animation = full
        created.push(faded)
      } else {
        created.push(withFade(ch, 0.4, 0.4, 0.9))
      }
    }
    if (opts.level === 6) {
      const logo = created[created.length - 1]
      logo.blendMode = 'lighten'
    }
  }

  if (opts.level === 3 || opts.level === 6) {
    // pixel-stretch intro slices stacked on the text
    const fxT = st.createTrack('video')
    ;[0, 0.4].forEach((off, i) => {
      const slice = textClip(fxT, start + off, 0.32, {
        text: opts.text, fontSize: 54, color: '#ffffff', bold: true, fontFamily: font, letterSpacing: 3,
      }, { name: `Watermark stretch ${i + 1}` })
      slice.transform = { ...slice.transform, x: charAsset ? 130 : 0, opacity: 0.75 }
      slice.effects = { pixelStretch: 30 - i * 10, chromatic: 8 - i * 3 } as ClipEffect
      created.push(slice)
    })
  }

  if (opts.voiceAssetId && (opts.level === 4 || opts.level === 5 || opts.level === 6)) {
    const voice = st.assets.find((a) => a.id === opts.voiceAssetId)
    if (voice) {
      const aTrack = st.createTrack('audio')
      const vc = baseClip({ trackId: aTrack, start, duration: Math.min(dur, voice.duration || dur), name: 'Voice tag', kind: 'audio', assetId: voice.id })
      vc.volume = 0.85
      created.push(vc)
    }
  }
  return pushClips(created)
}
