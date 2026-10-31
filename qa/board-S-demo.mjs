/** Board S demo edit — MCP-only, rendered by the app's own engine to a watchable mp4.
 *  The user's requested edit, on their uploaded photo (public/uploads/...jpg):
 *   - photo plate with a LUT-pack grade (crimson-pulse, real .cube trilinear)
 *   - adjustment clip dropped from fx_catalog (standalone grade layer)
 *   - image overlay at reduced opacity (0.35) blended screen (the "see-through" look)
 *   - title text with preset + glow + Photoshop-model shadow + small opacity keys on a custom curve
 *  Output: test_ans_result/board_S_demo.mp4 (+ timeline screenshot evidence). */
import { registry } from '../tools/mcp/tools.mjs'
import fs from 'fs'

const step = async (tool, args = {}) => {
  const r = await registry.call(tool, args)
  if (!r.ok) { console.error('DEMO FAIL', tool, JSON.stringify(r.data).slice(0, 200)); process.exitCode = 1 }
  return r
}
await step('project_new', {})
await step('omniframe_mode', {})
// 1. the plate: the user's uploaded photo, full-frame, 4s
const imp = await step('import_media', { path: 'public/uploads/17908683167065917032696543501299.jpg', fit: 'cover', scale: 1 })
const plate = imp.data.clipId
await step('select', { clipId: plate })
await step('clip_stretch', { clipId: plate, duration: 4 })
// 2. LUT-pack grade on the plate
await step('edit_element', { clipId: plate, patch: { adjustment: { luts: [{ id: 'lut-demo', name: 'crimson-pulse', builtin: 'crimson-pulse', intensity: 0.8, enabled: true }] } } })
// 3. adjustment clip (standalone grade layer) from the effects catalog
const fc = await step('fx_catalog', { cat: 'color', limit: 3 })
const fxId = (fc.data.entries || [])[0]?.id
if (fxId) await step('fx_add', { catalogId: fxId, asLayer: true })
// 4. image overlay at reduced opacity, blended screen (see-through)
const ov = await step('import_media', { path: 'qa/shots/01-home.png', fit: 'cover', scale: 1 })
const ovId = ov.data.clipId
await step('select', { clipId: ovId })
await step('clip_stretch', { clipId: ovId, duration: 4 })
await step('transform_set', { opacity: 0.35 })
await step('blend_set', { mode: 'screen' })
// 5. title: preset + glow + outer shadow + small opacity keys with a custom curve
const tx = await step('create_text', { text: 'BOARD S', preset: 'bar', x: 0, y: -60 })
const tId = tx.data.clipId
await step('select', { clipId: tId })
await step('edit_element', { clipId: tId, patch: { textStyle: { glowColor: '#22d3ee', glowBlur: 26, glowMode: 'outward', shadowMode: 'outer', shadowColor: '#000000', shadowBlur: 8, shadowOffsetX: 5, shadowOffsetY: 5 } } })
await step('keyframe_set', { property: 'opacity', time: 0.2, value: 0.25, interpolation: 'linear' })
await step('keyframe_set', { property: 'opacity', time: 0.9, value: 1, interpolation: 'custom', points: [[0.2, 0.25], [0.5, 0.9], [0.9, 1]] })
// 6. evidence: timeline + a graded frame dump, then the mp4 you can actually watch
await step('timeline_screenshot', { out: 'test_ans_result/evidence/S-demo-timeline.png' })
const dump = await step('data_dump', { withImages: true, times: [1.5] })
if (dump.ok && dump.data.previews?.[0]) {
  fs.writeFileSync('test_ans_result/evidence/S-demo-graded-frame.png', Buffer.from(dump.data.previews[0]['data:img'].split(',')[1], 'base64'))
}
const ex = await step('render_export', { out: 'test_ans_result/board_S_demo.mp4', fps: 24, duration: 4 })
console.log('DEMO DONE', ex.ok, ex.data.video, 'frames', ex.data.frames)
