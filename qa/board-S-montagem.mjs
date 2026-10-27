/** Board S: MONTAGEM/scene-pack study remake. Grammar sources (all frame-studied this turn):
 *  - Drive "MONTAGEM ADEUS effect.mp4" (9.9MB, pulled via connector): ember shard particles,
 *    whip-pan smear, deep crimson grade w/ cyan rim, crushed blacks (no titles in file — logged)
 *  - Drive "Broken Glass Overlay" (2.5MB): glass shards on black = screen-blend pack overlay
 *  - Drive "Black White Transition Overay" (0.7MB): B/W wipe pack overlay
 *  - scenepack.com guide (parked -> answerharbor): packs = transitions/overlays/grades/TITLE
 *    templates/SFX/particles; "one or two well-placed effects beat many competing"
 *  - RDT reference: see-through chroma titles, per-cut whole-frame grades, blur-fill pillarbox
 *  Build: 4 cuts, graded fills, ember rim on bands, glass/BW pack frames as timed screen
 *  overlays at cuts, titles with pop-in curve + gentle oscillate shake + chroma + glow. */
import { registry } from '../tools/mcp/tools.mjs'
import fs from 'fs'

console.log('MONT START');
const PHOTO = 'public/uploads/17908683167065917032696543501299.jpg'
const GLASS = 'new_doc_toll_research/imgs/glass-frames/f01.png'
const BW = 'new_doc_toll_research/imgs/bw-frames/f03.png'
const step = async (tool, args = {}) => {
  const r = await registry.call(tool, args)
  if (!r.ok) { console.error('MONTAGEM FAIL', tool, JSON.stringify(r.data).slice(0, 140)); process.exitCode = 1 }
  return r
}
await step('project_new', { w: 360, h: 640, fps: 30, duration: 7.2, bg: '#000000' })
await step('omniframe_mode', {})
const CUT = 1.8
const cuts = [
  { lut: 'crimson-pulse', word: 'ADEUS', band: 1 },
  { lut: 'ink-cut', word: 'HALLMARK', band: 0.74 },
  { lut: 'midnight-noir', word: 'ME', band: 1 },
  { lut: 'neon-afterdark', word: 'UNDER', band: 0.82 },
]
for (let i = 0; i < cuts.length; i++) {
  const c0 = cuts[i], start = i * CUT
  // graded blur fill for this cut (whole-frame grade switch)
  const bg = await step('import_media', { path: PHOTO, fit: 'cover', scale: 1.15 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: CUT })
  await step('clip_move_time', { clipId: bg.data.clipId, start })
  await step('select', { clipId: bg.data.clipId })
  await step('fx_add', { catalogId: 'blur-2' })
  await step('edit_element', { clipId: bg.data.clipId, patch: { adjustment: { luts: [{ id: 'bg', builtin: c0.lut, name: c0.lut, intensity: 1, enabled: true }] } } })
  // band with ember rim + grade
  const bd = await step('import_media', { path: PHOTO, fit: 'contain', scale: c0.band })
  await step('clip_stretch', { clipId: bd.data.clipId, duration: CUT })
  await step('clip_move_time', { clipId: bd.data.clipId, start })
  await step('select', { clipId: bd.data.clipId })
  await step('fx_add', { catalogId: 'edgeglow-ember' })
  // study-driven tune: MONTAGEM grade = crimson bed + cyan rims, not amber wash
  await step('edit_element', { clipId: bd.data.clipId, effect: { edgeGlowColor: i % 2 ? '#22d3ee' : '#ff2d55' } })
  await step('edit_element', { clipId: bg.data.clipId, effect: { temp: -0.18, tint: 0.10, sat: 1.18, contrast: 1.10 } })
  await step('edit_element', { clipId: bd.data.clipId, patch: { adjustment: { luts: [{ id: 'bd', builtin: c0.lut, name: c0.lut, intensity: 1, enabled: true }] } } })
  // whip-pop on the band at cut start
  await step('keyframe_set', { property: 'scale', channel: 'X', time: start + 0.03, value: 1.14, interpolation: 'linear' })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: start + 0.35, value: 1, interpolation: 'custom', points: [[start + 0.03, 1.14], [start + 0.18, 1.02], [start + 0.35, 1]] })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: start + 0.03, value: 1.14, interpolation: 'linear' })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: start + 0.35, value: 1, interpolation: 'linear' })
  // scene-pack overlay flash at the cut (glass shards / B-W wipe), screen-blended
  const ovSrc = i % 2 === 0 ? GLASS : BW
  const ov = await step('import_media', { path: ovSrc, fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: ov.data.clipId, duration: 0.3 })
  await step('clip_move_time', { clipId: ov.data.clipId, start })
  await step('select', { clipId: ov.data.clipId })
  await step('blend_set', { mode: 'screen' })
  await step('transform_set', { opacity: 0.85 })
  // title: pop-in curve + gentle shake + chroma + glow + see-through
  const t = await step('create_text', { text: c0.word, preset: 'bar', x: 0, y: 0 })
  await step('clip_move_time', { clipId: t.data.clipId, start: start + 0.1 })
  await step('clip_stretch', { clipId: t.data.clipId, duration: CUT - 0.2 })
  await step('select', { clipId: t.data.clipId })
  await step('blend_set', { mode: 'screen' })
  await step('transform_set', { opacity: 0.82 })
  await step('fx_add', { catalogId: 'osc-0-sine-6' })
  await step('edit_element', { clipId: t.data.clipId, patch: { textStyle: { glowColor: '#22d3ee', glowBlur: 12, glowMode: 'outward', chroma: 2.5 } } })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: start + 0.12, value: 1.35, interpolation: 'linear' })
  await step('keyframe_set', { property: 'scale', channel: 'X', time: start + 0.4, value: 1, interpolation: 'custom', points: [[start + 0.12, 1.35], [start + 0.26, 0.96], [start + 0.4, 1]] })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: start + 0.12, value: 1.35, interpolation: 'linear' })
  await step('keyframe_set', { property: 'scale', channel: 'Y', time: start + 0.4, value: 1, interpolation: 'linear' })
}
for (const [i, t] of [0.9, 2.7, 4.5, 6.3].entries()) {
  const d = await step('data_dump', { withImages: true, times: [t] })
  if (d.ok && d.data.previews?.[0]) fs.writeFileSync(`test_ans_result/evidence/S-mont-cut${i + 1}.png`, Buffer.from(d.data.previews[0]['data:img'].split(',')[1], 'base64'))
}
await step('timeline_screenshot', { out: 'test_ans_result/evidence/S-mont-timeline.png' })
const ex = await step('render_export', { out: 'test_ans_result/board_S_montagem.mp4', fps: 12, duration: 7.2 })
console.log('MONTAGEM DONE', ex.ok, ex.data.video, 'frames', ex.data.frames)
