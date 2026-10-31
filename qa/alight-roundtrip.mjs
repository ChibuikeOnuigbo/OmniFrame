/** QA: XML EXPORT/IMPORT round-trip + shake pack (user mandate: users can
 *  import xml and export xml; templates export as xml).
 *  Chain: build a processed project (effects + TYMM LUT + custom-bezier keys +
 *  AM fx instance + shake preset + text w/ TYMM font) → alight_export →
 *  alight_import the SAME file → assert every stage survived → template_capture
 *  → template_export (xml) → template_import → template_apply → render proof. */
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import fs from 'fs'
let fail = 0
const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++ } }
const call = async (n, a) => { const r = await registry.call(n, a); ok(r.ok, `${n}: ${JSON.stringify(r.data || r.error).slice(0, 240)}`); return r.data }

const PLATE = 'public/luts/source-tymm/preview-Lut 0.jpg'
ok(fs.existsSync(PLATE), 'plate asset exists')

await call('project_new', { w: 640, h: 360, fps: 24, duration: 3, bg: '#0a0a12' })
const c1 = await call('import_media', { path: PLATE, fit: 'cover' })
await call('select', { clipId: c1.clipId })
await call('edit_element', { clipId: c1.clipId, patch: {
  effects: { contrast: 1.2, glow: 0.4 },
  adjustment: { luts: [{ builtin: 'tymm-5', intensity: 0.8 }] },
} })
await call('keyframe_set', { property: 'position', channel: 'X', time: 0, value: -50, interpolation: 'custom', points: [[0, 0], [0.3, 0.1], [0.7, 0.9], [1, 1]] })
await call('keyframe_set', { property: 'position', channel: 'X', time: 2, value: 50, interpolation: 'custom', points: [[0, 0], [0.3, 0.1], [0.7, 0.9], [1, 1]] })
await call('fx_add', { clipId: c1.clipId, catalogId: 'am-turbulentdisplace3', params: { turbulent: 0.6 }, keys: { turbulent: [[0, 0.6], [1.5, 0]] } })
const shk = await call('shake_apply', { clipId: c1.clipId, preset: 'shake-molob' })
ok(shk.fxInstances.length >= 1, 'shake preset applied: ' + JSON.stringify(shk.fxInstances))
const txt = await call('create_text', { text: 'RT', x: 320, y: 60 })
await call('edit_element', { clipId: txt.clipId, patch: { textStyle: { fontFamily: 'Quicksand_Bold', fontSize: 40, color: '#ffd76a' } } })

// template BEFORE the session reset that alight_import performs
const t = await call('template_capture', { clipId: c1.clipId, name: 'RT chain' })
const tx = await call('template_export', { templateId: t.templateId })
ok(tx.file.endsWith('.xml') && fs.existsSync(tx.file), 'template xml written: ' + tx.file)

// ---- project round-trip ----
const ex = await call('alight_export', { path: 'data_motiondesijg/alight/roundtrip-export.xml', title: 'RT project' })
ok(ex.bytes > 500, 'project xml written (' + ex.bytes + ' B)')
const xml = fs.readFileSync(ex.file, 'utf8')
ok(xml.includes('omniframe.fx') && xml.includes('omniframe.lut') && xml.includes('omniframe.fxinst.am-turbulentdisplace3'), 'omniframe namespaces present')
ok(xml.includes('<kf t=') && xml.includes('cubicBezier 0.3 0.1 0.7 0.9'), 'custom bezier keyframes exported')
ok(xml.includes('<content>RT</content>') && xml.includes('Quicksand_Bold'), 'text layer + TYMM font stem exported')

const im = await call('alight_import', { path: ex.file })
ok(im.clips === 2, 'round-trip clip count = 2, got ' + im.clips)
const dump = JSON.parse(fs.readFileSync(im.dump, 'utf8'))
const rc = dump.imported.clips.find(c => c.kind !== 'text')
const rt = dump.imported.clips.find(c => c.kind === 'text')
ok(rc && Math.abs(rc.effects.contrast - 1.2) < 1e-6 && Math.abs(rc.effects.glow - 0.4) < 1e-6, 'engine effect VALUES survived: ' + JSON.stringify(rc?.effects))
ok(rc?.adjustment?.luts?.[0]?.builtin === 'tymm-5' && Math.abs(rc.adjustment.luts[0].intensity - 0.8) < 1e-6, 'TYMM lut + intensity survived')
const turb = rc?.fxInstances?.find(f => f.catalogId === 'am-turbulentdisplace3')
ok(turb && turb.keys?.turbulent?.length === 2 && Math.abs(turb.keys.turbulent[0].v - 0.6) < 1e-6, 'fx instance + keys survived')
ok(rc?.fxInstances?.some(f => f.catalogId === 'am-shake2' && f.keys?.autoShake?.length === 2), 'shake pack instance survived')
ok(rc?.keys.positionX.length === 2 && rc.keys.positionX[0].points?.length === 2 && rc.keys.positionX[0].points[0][0] === 0.3, 'custom bezier points survived: ' + JSON.stringify(rc?.keys.positionX[0].points))
ok(rt?.text === 'RT' && rt.fontFamily === 'Quicksand_Bold' && rt.fontSize === 40, 'text content/font/size survived')
ok(Math.abs(rc.start) < 0.02 && Math.abs(rc.duration - 3) < 0.05, 'timings survived')

// ---- template round-trip ----
const ti = await call('template_import', { path: tx.file })
ok(ti.templateId === t.templateId && ti.fieldCount === t.fieldCount, 'template re-imported identical id/fields')
const applied = await call('template_apply', { templateId: ti.templateId, clipId: SESSION.seq.clips[0].id })
ok(applied.applied.includes('effects'), 'template chain replayed after xml round-trip')

const out = 'test_ans_result/xml-roundtrip.mp4'
await call('render_export', { out, fps: 12, duration: 2 })
ok(fs.existsSync(out) && fs.statSync(out).size > 5000, 'round-trip render proof: ' + out)

console.log(fail === 0 ? 'ALIGHT XML ROUND-TRIP QA: PASS (project + template + shake pack, proof ' + out + ')' : 'ALIGHT XML ROUND-TRIP QA: FAIL ' + fail)
process.exitCode = fail === 0 ? 0 : 1
