/** Board S: faithful remake of the user's RDT reference edit (Drive RDT mp4, frames in
 *  new_doc_toll_research/imgs/rdt-frames/). Grammar read off the frames:
 *   - 9:16 vertical canvas; footage as a centered band; behind it a blurred zoomed copy (blur fill)
 *   - grade switches per cut: teal/sky -> magenta/violet -> dark moody blue (LUT-pack flips)
 *   - single-word ALL-CAPS bold titles, see-through over the footage (screen blend, reduced
 *     opacity) with RGB-split glitch edges
 *   - fast cuts (~2.5s), aspect of the band changes per cut (16:9 band -> 4:3 inset -> band)
 *  Rendered MCP-only by the app engine to test_ans_result/board_S_rdt_remake.mp4. */
import { registry } from '../tools/mcp/tools.mjs'
import fs from 'fs'

const PHOTO = 'public/uploads/17908683167065917032696543501299.jpg'
const step = async (tool, args = {}) => {
  const r = await registry.call(tool, args)
  if (!r.ok) { console.error('REMAKE FAIL', tool, JSON.stringify(r.data).slice(0, 160)); process.exitCode = 1 }
  return r
}
await step('project_new', { w: 360, h: 640, fps: 30, duration: 7.5, bg: '#000000' })
await step('omniframe_mode', {})
// blur fill: the same photo zoomed to cover the whole 9:16 frame, blurred
const bg = await step('import_media', { path: PHOTO, fit: 'cover', scale: 1 })
await step('clip_stretch', { clipId: bg.data.clipId, duration: 7.5 })
await step('select', { clipId: bg.data.clipId })
await step('fx_add', { catalogId: 'blur-2' })
// three cuts of the same photo, different band aspect + different LUT grade each
const cuts = [
  { start: 0, dur: 2.5, scale: 1, lut: 'teal-amber', word: 'HALLMARK' },
  { start: 2.5, dur: 2.5, scale: 0.72, lut: 'crimson-pulse', word: 'ME' },
  { start: 5, dur: 2.5, scale: 1, lut: 'midnight-noir', word: 'UNDER' },
]
for (const cut of cuts) {
  const c = await step('import_media', { path: PHOTO, fit: 'contain', scale: cut.scale })
  await step('clip_stretch', { clipId: c.data.clipId, duration: cut.dur })
  await step('clip_move_time', { clipId: c.data.clipId, start: cut.start })
  await step('edit_element', { clipId: c.data.clipId, patch: { adjustment: { luts: [{ id: 'g-' + cut.lut, name: cut.lut, builtin: cut.lut, intensity: 1, enabled: true }] } } })
  // the title word: see-through (screen) + reduced opacity + RGB-split glitch edge + small glow
  const t = await step('create_text', { text: cut.word, preset: 'bar', x: 0, y: 0 })
  await step('clip_move_time', { clipId: t.data.clipId, start: cut.start + 0.2 })
  await step('clip_stretch', { clipId: t.data.clipId, duration: cut.dur - 0.4 })
  await step('select', { clipId: t.data.clipId })
  await step('blend_set', { mode: 'screen' })
  await step('transform_set', { opacity: 0.85 })
  await step('fx_add', { catalogId: 'glitch-slice-mild' })
  await step('edit_element', { clipId: t.data.clipId, patch: { textStyle: { glowColor: '#22d3ee', glowBlur: 10, glowMode: 'outward' } } })
}
// evidence: one graded frame per cut + the timeline, then the mp4
for (const [i, t] of [1.2, 3.7, 6.2].entries()) {
  const d = await step('data_dump', { withImages: true, times: [t] })
  if (d.ok && d.data.previews?.[0]) fs.writeFileSync(`test_ans_result/evidence/S-rdt-cut${i + 1}.png`, Buffer.from(d.data.previews[0]['data:img'].split(',')[1], 'base64'))
}
await step('timeline_screenshot', { out: 'test_ans_result/evidence/S-rdt-timeline.png' })
const ex = await step('render_export', { out: 'test_ans_result/board_S_rdt_remake.mp4', fps: 30, duration: 7.5 })
console.log('REMAKE DONE', ex.ok, ex.data.video, 'frames', ex.data.frames)
