/** QA: render proof for the y6richo video-study engine gaps — exposure/gamma,
 *  Raster Extrude, Radial Repeat, Long Shadow — plus XML export generality for
 *  the new keys. Proof: test_ans_result/video-study-effects.mp4 */
import { registry } from '../tools/mcp/tools.mjs'
import fs from 'fs'
let fail = 0
const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++ } else console.log('ok:', m) }
const call = async (n, a) => { const r = await registry.call(n, a); ok(r.ok, `${n} ${JSON.stringify(a).slice(0, 90)} → ${JSON.stringify(r.data || r.error).slice(0, 120)}`); return r.data }

await call('project_new', { w: 640, h: 360, fps: 24, duration: 4, bg: '#101820' })

const t1 = await call('create_text', { text: 'EXP', x: 160, y: 80 })
await call('edit_element', { clipId: t1.clipId, patch: { transform: { x: -160, y: -90 } } })
await call('edit_element', { clipId: t1.clipId, patch: { textStyle: { fontSize: 52, color: '#ffd76a' }, effects: { exposure: 0.9, gamma: 1.25 } } })

const t2 = await call('create_text', { text: '3D', x: 480, y: 80 })
await call('edit_element', { clipId: t2.clipId, patch: { transform: { x: 160, y: -90 } } })
await call('edit_element', { clipId: t2.clipId, patch: { textStyle: { fontSize: 58, color: '#eaf9ff' }, effects: { extrude: 12, extrudeAngle: 135, extrudeColor: '#3a1220' } } })

const t3 = await call('create_text', { text: 'SWRL', x: 160, y: 270 })
await call('edit_element', { clipId: t3.clipId, patch: { transform: { x: -160, y: 90 } } })
await call('edit_element', { clipId: t3.clipId, patch: { textStyle: { fontSize: 40, color: '#25d7fb' }, effects: { radialRepeat: 6 } } })

const t4 = await call('create_text', { text: 'LONG', x: 480, y: 270 })
await call('edit_element', { clipId: t4.clipId, patch: { transform: { x: 160, y: 90 } } })
await call('edit_element', { clipId: t4.clipId, patch: { textStyle: { fontSize: 40, color: '#ffffff' }, effects: { longShadow: 26, longShadowAngle: 45, longShadowColor: '#ff375f' } } })

// XML export must carry the new keys generically
const ex = await call('alight_export', { path: 'data_motiondesijg/alight/video-study-effects.xml', title: 'Video-study effects proof' })
const xml = fs.readFileSync(ex.file, 'utf8')
ok(xml.includes('omniframe.fx') && xml.includes('exposure"') && xml.includes('gamma"'), 'exposure/gamma exported inside the omniframe.fx block')
ok(xml.includes('extrude"') && xml.includes('extrudeAngle"'), 'raster extrude exported')
ok(xml.includes('radialRepeat"'), 'radial repeat exported')
ok(xml.includes('longShadow"') && xml.includes('longShadowColor"'), 'long shadow exported')

// re-import: values survive
const im = await call('alight_import', { path: ex.file })
const dump = JSON.parse(fs.readFileSync(im.dump, 'utf8'))
const clips = dump.imported.clips
const has = (k, v) => clips.some((c) => c.effects && Math.abs((c.effects[k] ?? NaN) - v) < 1e-6)
ok(has('exposure', 0.9) && has('gamma', 1.25), 'exposure 0.9 / gamma 1.25 survived round-trip')
ok(has('extrude', 12) && has('radialRepeat', 6) && has('longShadow', 26), 'extrude/radialRepeat/longShadow survived round-trip')

const out = 'test_ans_result/video-study-effects.mp4'
await call('render_export', { out, fps: 12, duration: 4 })
ok(fs.existsSync(out) && fs.statSync(out).size > 5000, 'render proof written: ' + out + ' (' + (fs.existsSync(out) ? fs.statSync(out).size : 0) + ' B)')

console.log(fail === 0 ? 'VIDEO-STUDY RENDER QA: PASS (4 new effect groups rendered + XML round-trip)' : `VIDEO-STUDY RENDER QA: FAIL (${fail})`)
process.exitCode = fail === 0 ? 0 : 1
