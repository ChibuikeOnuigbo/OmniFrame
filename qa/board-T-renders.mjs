/**
 * Board T render battery:
 *  1) curve_texts/      — 50 videos, one per curve spec (all families incl. the
 *     new bounce-param / bounce-uniform / rebound-in / rebound-out / physical),
 *     each driving charStyle fontSize (or color) keys on range 0.
 *  2) newtext_preset/   — every In-Video Text preset + plain (49) on scene plates
 *     (NO blank canvas: Drive sky/clouds/petals + studied montagem frames),
 *     plus 6 character-range editing demos.
 *  3) board_T_wonderful.mp4 — 10s single-cut hero: 'wodnderful', per-character
 *     color keyframes at intervals with mixed curves + fontSize pulses.
 *  4) timeline_screenshot proof of the hero's keyframe diamonds.
 */
import fs from 'fs'
import { registry, SESSION } from '../tools/mcp/tools.mjs'

const step = async (t, a = {}) => {
  const r = await registry.call(t, a)
  if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a).slice(0, 120), r.error)
  return r
}
fs.mkdirSync('curve_texts', { recursive: true })
fs.mkdirSync('newtext_preset', { recursive: true })

const PLATES = [
  'google_drive/sky.jpg',
  'google_drive/clouds.png',
  'new_doc_toll_research/imgs/montagem-full-frames/f04.png',
  'new_doc_toll_research/imgs/montagem-full-frames/f02.png',
]

// ---------------- 1) curve family battery ----------------
const specs = []
for (const [interp, params] of [
  ['linear'], ['ease-in'], ['ease-out'], ['ease-in-out'], ['cubic-in'], ['cubic-out'],
  ['back'], ['bounce'], ['elastic'], ['constant'],
  ['bounce-param', { steps: 1, bounciness: 0.7, firstBounce: 0.3 }],
  ['bounce-param', { steps: 2, bounciness: 0.7, firstBounce: 0.2 }],
  ['bounce-param', { steps: 3, bounciness: 0.6, firstBounce: 0.25 }],
  ['bounce-param', { steps: 4, bounciness: 0.7, firstBounce: 0.2 }],
  ['bounce-param', { steps: 5, bounciness: 0.75, firstBounce: 0.3 }],
  ['bounce-param', { steps: 3, bounciness: 0.4, firstBounce: 0.4 }],
  ['bounce-param', { steps: 3, bounciness: 0.9, firstBounce: 0.15 }],
  ['bounce-param', { steps: 6, bounciness: 0.65, firstBounce: 0.35 }],
  ['bounce-param', { steps: 4, bounciness: 0.5, firstBounce: 0.5 }],
  ['bounce-uniform', { steps: 3, bounciness: 0.7, firstBounce: 0.3 }],
  ['bounce-uniform', { steps: 4, bounciness: 0.6, firstBounce: 0.25 }],
  ['bounce-uniform', { steps: 5, bounciness: 0.8, firstBounce: 0.2 }],
  ['bounce-uniform', { steps: 2, bounciness: 0.7, firstBounce: 0.4 }],
  ['rebound-in', { overshoot: 0.1 }], ['rebound-in', { overshoot: 0.2 }],
  ['rebound-in', { overshoot: 0.4 }], ['rebound-in', { overshoot: 0.6 }],
  ['rebound-out', { overshoot: 0.08 }], ['rebound-out', { overshoot: 0.15 }],
  ['rebound-out', { overshoot: 0.25 }], ['rebound-out', { overshoot: 0.35 }],
  ['rebound-out', { overshoot: 0.5 }], ['rebound-out', { overshoot: 0.6 }],
  ['physical', { freq: 2, damping: 2 }], ['physical', { freq: 3, damping: 2 }],
  ['physical', { freq: 4, damping: 2 }], ['physical', { freq: 3, damping: 3 }],
  ['physical', { freq: 4, damping: 5 }], ['physical', { freq: 2, damping: 5 }],
  ['physical', { freq: 5, damping: 3 }], ['physical', { freq: 3, damping: 5 }],
  ['physical', { freq: 4, damping: 3 }],
]) specs.push({ interp, params })
// color-key variants to reach 50
for (const [interp, params] of [
  ['bounce-param', { steps: 3, bounciness: 0.7, firstBounce: 0.3 }],
  ['rebound-out', { overshoot: 0.2 }],
  ['physical', { freq: 3, damping: 3 }],
  ['elastic'], ['bounce'],
]) specs.push({ interp, params, color: true })

const curveLog = []
for (let i = 0; i < specs.length; i++) {
  const sp = specs[i]
  await step('project_new', { w: 360, h: 480, fps: 30, duration: 2, bg: '#101418' })
  const bg = await step('import_media', { path: PLATES[i % PLATES.length], fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 2 })
  const tx = await step('create_text', { text: 'CURVE', preset: 'plain', x: 0, y: 0 })
  await step('select', { clipId: tx.data.clipId })
  if (sp.color) {
    await step('keyframe_set', { property: 'charStyle', channel: '0.color', time: 0.2, value: '#ffffff' })
    await step('keyframe_set', { property: 'charStyle', channel: '0.color', time: 1.6, value: '#ff2d55', interpolation: sp.interp, params: sp.params })
  } else {
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 0.2, value: 18 })
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 1.6, value: 64, interpolation: sp.interp, params: sp.params })
  }
  const name = `c${String(i + 1).padStart(2, '0')}_${sp.interp}${sp.params ? `_${Object.values(sp.params).join('-')}` : ''}${sp.color ? '_color' : ''}`.replace(/\./g, 'p')
  await step('render_export', { out: `curve_texts/${name}.mp4`, fps: 12, duration: 2 })
  curveLog.push({ file: `${name}.mp4`, ...sp })
}
fs.writeFileSync('curve_texts/specs.json', JSON.stringify(curveLog, null, 1))
console.log('CURVES DONE', curveLog.length)

// ---------------- 2) preset + char-demo battery ----------------
const presetIds = ['plain', 'inv-synthwave-clean', 'inv-synthwave-embers', 'inv-synthwave-rain', 'inv-synthwave-snow', 'inv-synthwave-sparkles', 'inv-synthwave-bokeh', 'inv-synthwave-dust', 'inv-synthwave-petals',
  'inv-aurora-clean', 'inv-aurora-embers', 'inv-aurora-rain', 'inv-aurora-snow', 'inv-aurora-sparkles', 'inv-aurora-bokeh', 'inv-aurora-dust', 'inv-aurora-petals',
  'inv-grid-clean', 'inv-grid-embers', 'inv-grid-rain', 'inv-grid-snow', 'inv-grid-sparkles', 'inv-grid-bokeh', 'inv-grid-dust', 'inv-grid-petals',
  'inv-bokeh-clean', 'inv-bokeh-embers', 'inv-bokeh-rain', 'inv-bokeh-snow', 'inv-bokeh-sparkles', 'inv-bokeh-bokeh', 'inv-bokeh-dust', 'inv-bokeh-petals',
  'inv-sunset-clean', 'inv-sunset-embers', 'inv-sunset-rain', 'inv-sunset-snow', 'inv-sunset-sparkles', 'inv-sunset-bokeh', 'inv-sunset-dust', 'inv-sunset-petals',
  'inv-studio-clean', 'inv-studio-embers', 'inv-studio-rain', 'inv-studio-snow', 'inv-studio-sparkles', 'inv-studio-bokeh', 'inv-studio-dust', 'inv-studio-petals']
let pn = 0
for (const pid of presetIds) {
  await step('project_new', { w: 360, h: 480, fps: 30, duration: 1.6, bg: '#101418' })
  const bg = await step('import_media', { path: PLATES[pn % PLATES.length], fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 1.6 })
  await step('create_text', { text: 'FLOW', preset: pid, x: 0, y: 0 })
  await step('render_export', { out: `newtext_preset/p${String(++pn).padStart(2, '0')}_${pid}.mp4`, fps: 12, duration: 1.6 })
}
// 6 character-range editing demos
const demos = [
  async (tid) => { // a red+bounce size, bcs cyan small
    await step('edit_element', { clipId: tid, patch: { textStyle: { charRanges: [{ start: 0, end: 1, style: { color: '#ff2d55' } }, { start: 1, end: 4, style: { color: '#22d3ee', fontSize: 26 } }] } } })
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 0.2, value: 60 })
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 1.4, value: 30, interpolation: 'bounce-param', params: { steps: 4, bounciness: 0.65, firstBounce: 0.3 } })
  },
  async (tid) => { // per-char families
    await step('edit_element', { clipId: tid, patch: { textStyle: { charRanges: [
      { start: 0, end: 1, style: { fontFamily: 'Georgia, serif', color: '#ffd166' } },
      { start: 1, end: 2, style: { fontFamily: 'Courier New, monospace', color: '#22d3ee' } },
      { start: 2, end: 3, style: { fontFamily: 'Impact, fantasy', color: '#ff2d55' } },
      { start: 3, end: 4, style: { fontFamily: 'Inter, sans-serif', color: '#7CFC88' } }] } } })
  },
  async (tid) => { // blend + opacity keys per range
    await step('edit_element', { clipId: tid, patch: { textStyle: { charRanges: [
      { start: 0, end: 2, style: { blendMode: 'screen', color: '#22d3ee' } },
      { start: 2, end: 4, style: { blendMode: 'overlay', color: '#ff9a4d' } }] } } })
    await step('keyframe_set', { property: 'charStyle', channel: '0.opacity', time: 0.2, value: 0.2 })
    await step('keyframe_set', { property: 'charStyle', channel: '0.opacity', time: 1.4, value: 1, interpolation: 'rebound-out', params: { overshoot: 0.25 } })
  },
  async (tid) => { // per-char glow + chroma
    await step('edit_element', { clipId: tid, patch: { textStyle: { chroma: 2, charRanges: [
      { start: 0, end: 1, style: { glowColor: '#ff2d55', glowBlur: 18 } },
      { start: 1, end: 2, style: { glowColor: '#22d3ee', glowBlur: 18 } },
      { start: 2, end: 3, style: { glowColor: '#ffd166', glowBlur: 18 } },
      { start: 3, end: 4, style: { glowColor: '#7CFC88', glowBlur: 18 } }] } } })
  },
  async (tid) => { // tracking expand per range
    await step('edit_element', { clipId: tid, patch: { textStyle: { charRanges: [{ start: 0, end: 2, style: {} }, { start: 2, end: 4, style: {} }] } } })
    await step('keyframe_set', { property: 'charStyle', channel: '0.letterSpacing', time: 0.2, value: 0 })
    await step('keyframe_set', { property: 'charStyle', channel: '0.letterSpacing', time: 1.4, value: 14, interpolation: 'physical', params: { freq: 3, damping: 3 } })
  },
  async (tid) => { // three ranges, three curves, simultaneous
    await step('edit_element', { clipId: tid, patch: { textStyle: { charRanges: [{ start: 0, end: 1, style: {} }, { start: 1, end: 3, style: {} }, { start: 3, end: 4, style: {} }] } } })
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 0.2, value: 20 })
    await step('keyframe_set', { property: 'charStyle', channel: '0.fontSize', time: 1.4, value: 56, interpolation: 'bounce-param', params: { steps: 3, bounciness: 0.7, firstBounce: 0.25 } })
    await step('keyframe_set', { property: 'charStyle', channel: '1.fontSize', time: 0.2, value: 20 })
    await step('keyframe_set', { property: 'charStyle', channel: '1.fontSize', time: 1.4, value: 44, interpolation: 'physical', params: { freq: 4, damping: 3 } })
    await step('keyframe_set', { property: 'charStyle', channel: '2.fontSize', time: 0.2, value: 20 })
    await step('keyframe_set', { property: 'charStyle', channel: '2.fontSize', time: 1.4, value: 40, interpolation: 'rebound-in', params: { overshoot: 0.3 } })
  },
]
for (let d = 0; d < demos.length; d++) {
  await step('project_new', { w: 360, h: 480, fps: 30, duration: 1.8, bg: '#101418' })
  const bg = await step('import_media', { path: PLATES[d % PLATES.length], fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 1.8 })
  const tx = await step('create_text', { text: 'abcs', preset: 'plain', x: 0, y: 0 })
  await step('select', { clipId: tx.data.clipId })
  await demos[d](tx.data.clipId)
  await step('render_export', { out: `newtext_preset/d${d + 1}_charedit.mp4`, fps: 12, duration: 1.8 })
}
console.log('PRESETS DONE', pn + demos.length)

// ---------------- 3) hero: 'wodnderful' 10s, per-char color keys, no cuts ----------------
await step('project_new', { w: 360, h: 640, fps: 30, duration: 10, bg: '#101418' })
const hb = await step('import_media', { path: 'new_doc_toll_research/imgs/montagem-full-frames/f04.png', fit: 'cover', scale: 1.1 })
await step('clip_stretch', { clipId: hb.data.clipId, duration: 10 })
const ht = await step('create_text', { text: 'wodnderful', preset: 'plain', x: 0, y: 0 })
await step('select', { clipId: ht.data.clipId })
const word = 'wodnderful'
const COLORS = ['#ff2d55', '#22d3ee', '#ffd166', '#7CFC88', '#ff9a4d', '#c9b8ff', '#ff6b35', '#9fd8ff', '#ffb3c8', '#e8e8ee']
const CURVES = [['bounce-param', { steps: 3, bounciness: 0.7, firstBounce: 0.25 }], ['rebound-out', { overshoot: 0.2 }], ['physical', { freq: 3, damping: 3 }], ['ease-in-out'], ['bounce'], ['rebound-in', { overshoot: 0.2 }], ['elastic'], ['bounce-uniform', { steps: 4, bounciness: 0.6, firstBounce: 0.2 }], ['back'], ['cubic-out']]
await step('edit_element', { clipId: ht.data.clipId, patch: { textStyle: { fontSize: 44, bold: true, charRanges: [...word].map((_, i) => ({ start: i, end: i + 1, style: { color: COLORS[i], glowColor: COLORS[i], glowBlur: 10 } } )) } } })
for (let i = 0; i < word.length; i++) {
  const [interp, params] = CURVES[i % CURVES.length]
  const tA = 0.4 + i * 0.8
  await step('keyframe_set', { property: 'charStyle', channel: `${i}.color`, time: tA, value: COLORS[i] })
  await step('keyframe_set', { property: 'charStyle', channel: `${i}.color`, time: Math.min(9.6, tA + 0.5), value: COLORS[(i + 3) % 10], interpolation: interp, params })
  if (i % 2 === 0) {
    await step('keyframe_set', { property: 'charStyle', channel: `${i}.fontSize`, time: tA, value: 40 })
    await step('keyframe_set', { property: 'charStyle', channel: `${i}.fontSize`, time: Math.min(9.6, tA + 0.6), value: 62, interpolation: CURVES[(i + 5) % 10][0], params: CURVES[(i + 5) % 10][1] })
  }
}
const hx = await step('render_export', { out: 'test_ans_result/board_T_wonderful.mp4', fps: 12, duration: 10 })
console.log('HERO DONE', hx.ok, hx.data?.frames)
await step('timeline_screenshot', { out: 'test_ans_result/evidence/T-timeline-wonderful.png', playhead: 5 })
console.log('BATTERY COMPLETE')
