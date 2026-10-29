/** QA + DEMO: Replace-Video-With-Video + TEMPLATE MODE (user mega-turn ask).
 *  Proves the full chain headless, app-made:
 *   1. process an ORIGINAL video through a real chain (LUT grade from the TYMM
 *      pack, effects, keyframed motion)
 *   2. template_capture → every stage dumped to data_motiondesijg/templates/
 *   3. import a NEW theme video and template_apply → identical chain replayed
 *   4. replace_video with carryEffects (CapCut "use the original video effect")
 *      and with carryEffects=false (stages cleared)
 *   5. render_export the demo mp4 (test_ans_result/replace-template-demo.mp4)
 *  Also registers every TYMM font and proves list_fonts sees them. */
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import fs from 'fs'
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); fail++ } }

const call = async (name, args) => {
  const r = await registry.call(name, args)
  ok(r.ok, `${name}: ${JSON.stringify(r.data).slice(0, 300)}`)
  return r.data
}

await call('project_new', { w: 640, h: 360, fps: 24, duration: 3, bg: '#0a0a12' })

// ---- 1. ORIGINAL processed video ------------------------------------------
const c1 = await call('import_video', { path: 'Study_edits_videos/exports/-9UkBHVV9OA.mp4', fps: 12, fit: 'cover' })
ok(c1.clipId, 'original imported')
await call('select', { clipId: c1.clipId })
await call('edit_element', { clipId: c1.clipId, patch: {
  adjustment: { luts: [{ builtin: 'tymm-5', intensity: 1 }] },
  effects: { contrast: 1.15, saturation: 1.25, vignette: 0.3 },
} })
await call('keyframe_set', { property: 'position', channel: 'X', time: 0, value: -60, interpolation: 'easeInOut' })
await call('keyframe_set', { property: 'position', channel: 'X', time: 2.5, value: 60, interpolation: 'easeInOut' })
await call('keyframe_set', { property: 'scale', channel: 'X', time: 0, value: 0.92, interpolation: 'easeOut' })
await call('keyframe_set', { property: 'scale', channel: 'X', time: 2.5, value: 1.08, interpolation: 'easeOut' })

// ---- 2. TEMPLATE CAPTURE (data-dump JSON) ----------------------------------
const t = await call('template_capture', { clipId: c1.clipId, name: 'TYMM graded push-in' })
ok(t.fields.includes('adjustment') && t.fields.includes('animation') && t.fields.includes('effects') && t.fields.includes('transform'), 'template fields complete: ' + t.fields.join(','))
ok(fs.existsSync(t.file), 'template data-dump written: ' + t.file)
const dump = JSON.parse(fs.readFileSync(t.file, 'utf8'))
ok(dump.fields.adjustment.luts[0].builtin === 'tymm-5', 'TYMM lut inside template dump')
ok(dump.fields.animation && dump.fields.animation.curves.position_x.keyframes.length === 2, 'keys captured in dump')

// ---- 3. NEW THEME video + TEMPLATE APPLY -----------------------------------
const c2 = await call('import_video', { path: 'public/death_note_video.mp4', fps: 12, fit: 'cover' })
const ap = await call('template_apply', { templateId: t.templateId, clipId: c2.clipId })
ok(ap.applied.includes('adjustment') && ap.applied.includes('animation') && ap.applied.includes('effects'), 'chain replayed on new clip: ' + ap.applied.join(','))

// ---- 4. REPLACE VIDEO (carry vs no-carry) -----------------------------------
const c3 = await call('import_video', { path: 'new_glitch/batch/b0013_digital-slice.mp4', fps: 12, fit: 'cover' })
const rep = await call('replace_video', { clipId: c2.clipId, path: 'Study_edits_videos/exports/-JLpm8uJBOo.mp4', windowStart: 0.5, carryEffects: true })
ok(rep.carried === true && rep.window.start >= 0 && rep.window.start <= Math.max(0, rep.sourceDuration - rep.window.length) + 0.01, 'replace carried effects, window ' + rep.window.start + '-' + rep.window.end + ' of ' + rep.sourceDuration + 's')
const rep2 = await call('replace_video', { clipId: c3.clipId, path: 'Study_edits_videos/exports/-JLpm8uJBOo.mp4', windowStart: 999, carryEffects: false })
ok(rep2.cleared.length === 3, 'no-carry cleared: ' + rep2.cleared.join(','))
ok(rep2.window.start < rep2.sourceDuration, 'windowStart clamped into source')
const list = await call('list_templates', {})
ok(list.templates.length >= 1 && list.templates[0].fields.length >= 4, 'list_templates sees the dump')

// ---- 5. FONTS: every TYMM file stem registered ------------------------------
const fonts = await call('list_fonts', {})
ok(fonts.count === 49, `49 TYMM fonts registered headless (got ${fonts.count})`)
ok(fonts.fonts.includes('blood-crow-italic') && fonts.fonts.includes('Quicksand_Bold') && fonts.fonts.includes('Minecrafter.Reg'), 'stem names exact')
await call('select', { clipId: c2.clipId })
const txt = await call('create_text', { text: 'TYMM SWAP', x: 320, y: 60 })
await call('edit_element', { clipId: txt.clipId, patch: { textStyle: { fontFamily: 'Minecrafter.Reg', fontSize: 44, color: '#ffd76a' } } })

// ---- 6. RENDER the demo ------------------------------------------------------
const out = 'test_ans_result/replace-template-demo.mp4'
const rr = await call('render_export', { out })
ok(fs.existsSync(out) && fs.statSync(out).size > 8000, 'demo mp4 rendered: ' + out + ' (' + (fs.existsSync(out) ? fs.statSync(out).size : 0) + ' B)')

console.log(fail === 0 ? 'REPLACE+TEMPLATE QA: PASS (' + SESSION.trace.length + ' steps, template ' + t.templateId + ', demo ' + out + ')' : 'REPLACE+TEMPLATE QA: FAIL ' + fail)
process.exitCode = fail === 0 ? 0 : 1
