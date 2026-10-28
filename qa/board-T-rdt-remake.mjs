/**
 * Board T: remake of Drive RDT_20261027_092910.mp4 grammar (vetted via
 * new_doc_toll_research/imgs/rdt2-sheet/): one-word tracked title cards over
 * sharp anime cuts, whip-blur + strobe gaps between beats, cool/warm duotone
 * sections — rebuilt with char-range tracking/color keys + new curve families.
 */
import fs from 'fs'
import { registry } from '../tools/mcp/tools.mjs'
const step = async (t, a = {}) => { const r = await registry.call(t, a); if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a).slice(0, 100), r.error); return r }
const WORDS = ['GIVE', 'HALLMARK', 'ONE', 'PAINT', 'HAPPY', 'BLUE', 'NORMAN', 'ROCKWELL']
const PLATES = [
  'new_doc_toll_research/imgs/montagem-full-frames/f04.png',
  'new_doc_toll_research/imgs/montagem-full-frames/f02.png',
  'new_doc_toll_research/imgs/montagem-full-frames/f06.png',
  'new_doc_toll_research/imgs/montagem-full-frames/f08.png',
]
const LUTS = ['midnight-noir', 'crimson-pulse', 'neon-afterdark', 'ink-cut']
await step('project_new', { w: 360, h: 640, fps: 30, duration: WORDS.length * 1.3, bg: '#000000' })
let t0 = 0
for (let i = 0; i < WORDS.length; i++) {
  const bg = await step('import_media', { path: PLATES[i % 4], fit: 'cover', scale: 1.15 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 1.2 })
  await step('clip_move_time', { clipId: bg.data.clipId, start: t0 })
  await step('edit_element', { clipId: bg.data.clipId, patch: { adjustment: { luts: [{ id: `l${i}`, builtin: LUTS[i % 4], name: LUTS[i % 4], intensity: 1, enabled: true }] } } })
  // whip-blur approx: scale punch keys on the plate
  await step('select', { clipId: bg.data.clipId })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: t0, value: 1.0 })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: t0 + 1.15, value: 1.22, interpolation: 'ease-in' })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: t0, value: 1.0 })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: t0 + 1.15, value: 1.22, interpolation: 'ease-in' })
  const tx = await step('create_text', { text: WORDS[i], preset: 'plain', x: 0, y: i % 2 ? 20 : -10 })
  await step('clip_move_time', { clipId: tx.data.clipId, start: t0 + 0.05 })
  await step('clip_stretch', { clipId: tx.data.clipId, duration: 1.1 })
  await step('select', { clipId: tx.data.clipId })
  await step('edit_element', { clipId: tx.data.clipId, patch: { textStyle: { fontSize: 40, bold: true, color: '#ffffff', chroma: 2.2, letterSpacing: 3, charRanges: [{ start: 0, end: WORDS[i].length, style: {} }] } } })
  // tracking slam-in with the new rebound/physical families, per beat
  const fam = i % 4
  const [interp, params] = [['rebound-out', { overshoot: 0.25 }], ['bounce-param', { steps: 3, bounciness: 0.6, firstBounce: 0.2 }], ['physical', { freq: 4, damping: 4 }], ['bounce-uniform', { steps: 4, bounciness: 0.7, firstBounce: 0.15 }]][fam]
  await step('keyframe_set', { property: 'charStyle', channel: '0.letterSpacing', time: t0 + 0.05, value: 26 })
  await step('keyframe_set', { property: 'charStyle', channel: '0.letterSpacing', time: t0 + 0.6, value: 3, interpolation: interp, params })
  await step('keyframe_set', { property: 'charStyle', channel: '0.color', time: t0 + 0.05, value: i % 2 ? '#9fd8ff' : '#ffd7de' })
  await step('keyframe_set', { property: 'charStyle', channel: '0.color', time: t0 + 0.7, value: '#ffffff', interpolation: 'ease-out' })
  t0 += 1.2
  const b = await step('import_media', { path: '/tmp/mont-black.png', fit: 'cover', scale: 1 })
  if (!b.ok) {
    const { createCanvas } = await import('@napi-rs/canvas')
    const bc = createCanvas(16, 16); const bx = bc.getContext('2d'); bx.fillStyle = '#000'; bx.fillRect(0, 0, 16, 16)
    fs.writeFileSync('/tmp/mont-black.png', bc.toBuffer('image/png'))
  }
  const blk = await step('import_media', { path: '/tmp/mont-black.png', fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: blk.data.clipId, duration: 0.1 })
  await step('clip_move_time', { clipId: blk.data.clipId, start: t0 })
  t0 += 0.1
}
const ex = await step('render_export', { out: 'test_ans_result/board_T_rdt_remake.mp4', fps: 12, duration: t0 })
console.log('RDT REMAKE DONE', ex.ok, ex.data?.frames, 'dur', t0.toFixed(2))
