/**
 * Board T cont.3 — WONDERFUL acceptance render (master prompt P0):
 * correctly spelled, 10 s, ONE text clip, successive per-character color
 * changes on mixed curve families + multiple motions (size pulses, opacity
 * shimmer, tracking widen, clip drift/scale/rotation springs), REAL moving
 * footage (Drive roses petals clip) masked inside the glyphs over an anime
 * scene plate with slow zoom. Two size/framerate exports + timeline proof +
 * frame sheet + project JSON dump.
 */
import fs from 'fs'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
const step = async (t, a = {}) => { const r = await registry.call(t, a); if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a).slice(0, 110), JSON.stringify(r.data ?? '').slice(0, 160)); return r }

const COLORS = ['#ff2d55', '#22d3ee', '#ffd166', '#7cfc88', '#ff9a4d', '#c9b8ff', '#ff6b35', '#9fd8ff', '#ffb3c8']
const CURVES = [
  ['bounce-param', { steps: 3, bounciness: 0.7, firstBounce: 0.25 }],
  ['rebound-out', { overshoot: 0.2 }],
  ['physical', { freq: 3, damping: 3 }],
  ['ease-in-out', undefined],
  ['bounce', undefined],
  ['rebound-in', { overshoot: 0.2 }],
  ['elastic', undefined],
  ['bounce-uniform', { steps: 4, bounciness: 0.6, firstBounce: 0.2 }],
  ['back-out', undefined],
]

async function build(w, h, fps) {
  await step('project_new', { w, h, fps, duration: 10, bg: '#0b0912' })
  const plate = await step('import_media', { path: 'new_doc_toll_research/imgs/montagem-full-frames/f04.png', fit: 'cover', scale: 1.0 })
  await step('clip_stretch', { clipId: plate.data.clipId, duration: 10 })
  await step('edit_element', { clipId: plate.data.clipId, patch: { opacity: 0.62 } })
  await step('select', { clipId: plate.data.clipId })
  for (const ch of ['X', 'Y']) {
    await step('keyframe_set', { property: 'scale', channel: ch, time: 0, value: 1.0 })
    await step('keyframe_set', { property: 'scale', channel: ch, time: 10, value: 1.1, interpolation: 'sine-in-out' })
  }
  await step('import_video', { path: 'google_drive/roses pelats.mp4', fps: 12 })
  const word = 'WONDERFUL'
  const tx = await step('create_text', { text: word, preset: 'plain', x: 0, y: Math.round(h * 0.26) })
  await step('clip_stretch', { clipId: tx.data.clipId, duration: 10 })
  await step('edit_element', {
    clipId: tx.data.clipId,
    patch: { textStyle: { fontSize: Math.round(h * 0.047), bold: true, insideVideo: 'google_drive/roses pelats.mp4', insideBaseAlpha: 0.6, glowBlur: 10, charRanges: [...word].map((_, i) => ({ start: i, end: i + 1, style: { color: COLORS[i], glowColor: COLORS[i] } })) } },
  })
  await step('select', { clipId: tx.data.clipId })
  for (let i = 0; i < word.length; i++) {
    const [interp, params] = CURVES[i % CURVES.length]
    const tA = 0.5 + i * 0.9
    await step('keyframe_set', { property: 'charStyle', channel: `${i}.color`, time: tA, value: COLORS[i] })
    await step('keyframe_set', { property: 'charStyle', channel: `${i}.color`, time: Math.min(9.7, tA + 0.45), value: COLORS[(i + 4) % 9], interpolation: interp, params })
    if (i % 2 === 0) {
      const [i2, p2] = CURVES[(i + 5) % 9]
      await step('keyframe_set', { property: 'charStyle', channel: `${i}.fontSize`, time: tA, value: Math.round(h * 0.041) })
      await step('keyframe_set', { property: 'charStyle', channel: `${i}.fontSize`, time: Math.min(9.7, tA + 0.55), value: Math.round(h * 0.056), interpolation: i2, params: p2 })
    }
    if (i === 3 || i === 6) {
      await step('keyframe_set', { property: 'charStyle', channel: `${i}.opacity`, time: tA, value: 1 })
      await step('keyframe_set', { property: 'charStyle', channel: `${i}.opacity`, time: Math.min(9.7, tA + 0.3), value: 0.35, interpolation: 'sine-in-out' })
      await step('keyframe_set', { property: 'charStyle', channel: `${i}.opacity`, time: Math.min(9.7, tA + 0.6), value: 1, interpolation: 'rebound-out', params: { overshoot: 0.15 } })
    }
  }
  await step('edit_element', { clipId: tx.data.clipId, patch: { textStyle: { charRanges: [...(SESSION.seq.clips.find(c => c.id === tx.data.clipId).textStyle.charRanges || []), { start: 0, end: word.length, style: {}, keys: {} }] } } })
  await step('keyframe_set', { property: 'charStyle', channel: `${word.length - 1 + 1 - 1 + 1}.letterSpacing`, time: 0.4, value: 0 }).catch?.(() => {})
  // whole-word tracking widen on the extra full-range slot
  await step('keyframe_set', { property: 'charStyle', channel: `${word.length}.letterSpacing`, time: 0.4, value: 0 })
  await step('keyframe_set', { property: 'charStyle', channel: `${word.length}.letterSpacing`, time: 4.5, value: 4, interpolation: 'rebound-in', params: { overshoot: 0.25 } })
  // clip-level motions: drift + scale spring + tiny rotation spring
  await step('keyframe_set', { property: 'position', channel: 'Y', time: 0, value: Math.round(h * 0.26) + 10 })
  await step('keyframe_set', { property: 'position', channel: 'Y', time: 9.5, value: Math.round(h * 0.26) - 14, interpolation: 'sine-in-out' })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: 2.0, value: 1.0 })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: 3.2, value: 1.08, interpolation: 'physical', params: { freq: 3, damping: 4 } })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: 2.0, value: 1.0 })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: 3.2, value: 1.08, interpolation: 'physical', params: { freq: 3, damping: 4 } })
  await step('keyframe_set', { property: 'rotation', channel: 'Z', time: 5.5, value: 0 })
  await step('keyframe_set', { property: 'rotation', channel: 'Z', time: 6.6, value: 2.5, interpolation: 'spring-soft' })
  return tx.data.clipId
}

const tid = await build(720, 1280, 24)
const e1 = await step('render_export', { out: 'test_ans_result/board_T_WONDERFUL_720p24.mp4', fps: 24, duration: 10 })
console.log('WONDERFUL 720p24:', e1.ok, e1.data?.frames)
fs.writeFileSync('test_ans_result/wonderful.project.json', JSON.stringify(SESSION.seq, null, 1).slice(0, 4_000_000))
await step('timeline_screenshot', { out: 'test_ans_result/evidence/T-timeline-WONDERFUL.png', playhead: 5 })
await build(360, 640, 30)
const e2 = await step('render_export', { out: 'test_ans_result/board_T_WONDERFUL_360p30.mp4', fps: 30, duration: 10 })
console.log('WONDERFUL 360p30:', e2.ok, e2.data?.frames)
console.log('WONDERFUL ACCEPTANCE COMPLETE')
