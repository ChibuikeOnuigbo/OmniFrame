/** QA: boards are solved by UNIVERSAL tools only (vow universal-tools law)
 *  AND by the omniframe law (vow omniframe law):
 *   - img is stretched on the timeline then compounded (never auto-converted)
 *   - the box is selected by cycling every selection method, then extracted
 *     to a cut-out clip on the track above (no copy/paste of the plate)
 *   - patch-under hides the hole on the source for every frame
 *   - flash moves use constant interpolation (step, NO slide)
 *   - keyframes + every curve (incl. 5 user-dragged custom) live on the
 *     CUT-OUT, not on the video
 *  Runs recipe E through the registry and asserts all of it from the trace. */
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import fs from 'fs'
import crypto from 'crypto'
let fail = 0
const r = await registry.call('run_recipe', { file: 'tools/mcp/recipes/board_E_move.json' })
if (!r.ok) { console.error('FAIL recipe', r.data); fail++ }
const trace = SESSION.trace.map(t => t.tool)
const banned = ['solve_move', 'solve_tank', 'compose_', 'inpaint_']
if (trace.some(t => banned.some(b => t.startsWith(b)))) { console.error('FAIL task-shaped tool in trace', trace); fail++ }
for (const need of ['project_new', 'omniframe_mode', 'import_media', 'clip_stretch', 'compound_clip_create',
  'roto_mask', 'mask_draw', 'transparent_select', 'brush_select', 'select_main_element',
  'omniframe_extract', 'patch_under', 'omniframe_move', 'keyframe_set', 'render_export', 'timeline_screenshot'])
  if (!trace.includes(need)) { console.error('FAIL missing universal step', need); fail++ }
// stretch happens BEFORE compound (the only img->clip path)
if (trace.indexOf('clip_stretch') > trace.indexOf('compound_clip_create')) { console.error('FAIL stretch must precede compound'); fail++ }
// one import only — the plate is never copied to become the mover
if (trace.filter(t => t === 'import_media').length !== 1) { console.error('FAIL expected exactly 1 import_media'); fail++ }
// the mover is the extracted cut-out, not a duplicate of the plate
const cut = SESSION.seq.clips.find(c => c.asset === 'omni-cutout')
if (!cut) { console.error('FAIL no omni-cutout clip'); fail++ }
else {
  const kx = cut.animation.curves.position_x.keyframes
  if (kx.filter(k => k.interpolation === 'constant').length < 5) { console.error('FAIL expected >=5 constant omniframe moves'); fail++ }
  if (kx.filter(k => k.interpolation === 'custom' && k.points?.length >= 2).length < 5) { console.error('FAIL expected >=5 custom dragged curves'); fail++ }
  if (!kx.some(k => k.interpolation === 'ease-in-out')) { console.error('FAIL eased destination move missing'); fail++ }
}
// plate carries the hole (inverted mask) + smart patch-under
const plate = SESSION.seq.clips.find(c => c.patch?.strategy === 'smart')
if (!plate || !plate.mask?.inverted) { console.error('FAIL patch-under/hole missing on source'); fail++ }
// cut-out lives on its own track, above the plate
if (!cut || cut.track === plate?.track) { console.error('FAIL cut-out must sit on another track'); fail++ }
// no-slide proof: frames inside a hold are byte-identical, the step is not
const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex')
const ha = 'test_ans_result/evidence/E-snap-hold-a.png', hb = 'test_ans_result/evidence/E-snap-hold-b.png', hj = 'test_ans_result/evidence/E-snap-jump.png'
if (!fs.existsSync(ha) || md5(ha) !== md5(hb)) { console.error('FAIL hold frames differ (slide!)'); fail++ }
if (md5(hb) === md5(hj)) { console.error('FAIL step never happened'); fail++ }
if (!fs.existsSync('test_ans_result/E_move/solution.mp4')) { console.error('FAIL no mp4'); fail++ }
if (!fs.existsSync('test_ans_result/evidence/timeline-E.png')) { console.error('FAIL no timeline proof'); fail++ }
// ---- paint canvas (ibisPaint X family harvested from NothingxArt 2yAZqtdc_qk) ----
SESSION.paint = { strokes: [], layers: SESSION.paint.layers, clock: 0 }
const d1 = await registry.call('draw_stroke', { tool: 'gradient', points: [[10, 0], [10, 10]], color: '#2b1e5a', gradientColor: '#ff8c42', size: 40 })
const d2 = await registry.call('draw_stroke', { tool: 'circle', points: [[8, 6], [12, 10]], color: '#ffd9a0', filled: true, size: 2 })
const d3 = await registry.call('draw_stroke', { tool: 'line', points: [[10, 8], [10, 4]], color: '#ffb86b', size: 2, radialCopies: 8 })
const d4 = await registry.call('draw_stroke', { tool: 'smudge', points: [[4, 3], [8, 3], [12, 3]], size: 20 })
for (const d of [d1, d2, d3, d4]) if (!d.ok) { console.error('FAIL draw_stroke', d.data); fail++ }
if (SESSION.paint.strokes.length !== 4) { console.error('FAIL stroke count'); fail++ }
if (SESSION.paint.strokes[2].radialCopies !== 8) { console.error('FAIL radial ruler'); fail++ }
if (SESSION.paint.strokes[0].points[0].x > 1 || SESSION.paint.strokes[0].points[0].y > 1) { console.error('FAIL points must be normalized'); fail++ }
const tl = await registry.call('paint_timelapse', { out: 'test_ans_result/G_paint/qa-timelapse.mp4', fps: 12, duration: 2 })
if (!tl.ok || !fs.existsSync('test_ans_result/G_paint/qa-timelapse.mp4') || !fs.existsSync('test_ans_result/G_paint/qa-timelapse-final.png')) { console.error('FAIL paint_timelapse', tl.data); fail++ }
const td = await registry.call('paint_timelapse', { out: 'test_ans_result/G_paint/qa-dreamcore.mp4', grade: 'dreamcore', fps: 12, duration: 1 })
if (!td.ok || td.data.grade !== 'dreamcore') { console.error('FAIL dreamcore grade', td.data); fail++ }
const pc = await registry.call('paint_clear', {})
if (!pc.ok || SESSION.paint.strokes.length !== 0) { console.error('FAIL paint_clear'); fail++ }
for (const t of ['draw_stroke', 'paint_timelapse', 'paint_clear'])
  if (!registry.list().some(x => x.name === t)) { console.error('FAIL missing tool', t); fail++ }

// ---- GAP queue (am_research): lasso selection + oscillate/turbulent keys ----
await registry.call('project_new', { w: 320, h: 180, fps: 12, duration: 1 })
await registry.call('new_background', { kind: 'sunset' })
const ls = await registry.call('lasso_select', { clipId: 'clip-1', points: [[60, 40], [160, 50], [150, 140], [70, 130]] })
if (!ls.ok || ls.data.method !== 'lasso' || !(ls.data.pixels > 0)) { console.error('FAIL lasso_select', ls.data); fail++ }
if (!registry.list().some(x => x.name === 'lasso_select')) { console.error('FAIL lasso_select missing from catalog'); fail++ }

// ---- Board J: CapCut-style effect system (catalog, drop-on-clip, closed container, keyframes, layers, glitch-out-of-transitions) ----
await registry.call('project_new', { w: 320, h: 180, fps: 12, duration: 2 })
await registry.call('import_media', { path: 'qa/shots/01-home.png', fit: 'contain', scale: 1 })
const catJ = await registry.call('fx_catalog', { limit: 1 })
if (!catJ.ok || !(catJ.data.total > 5000) || !(catJ.data.byCat.glitch >= 40)) { console.error('FAIL fx_catalog real counts', catJ.data && catJ.data.total); fail++ }
const ga = await registry.call('fx_add', { catalogId: 'glitch-rgb-heavy', keys: { glitch: [[0, 0], [1.5, 1]] } })
if (!ga.ok || ga.data.fxId !== 'fx-1' || ga.data.inP !== 0 || ga.data.duration !== 2) { console.error('FAIL fx_add full-length drop', ga.data); fail++ }
const gcl = await registry.call('fx_update', { clipId: 'clip-1', fxId: 'fx-1', inP: 999, duration: 50 })
if (!gcl.ok || gcl.data.inP !== 0 || gcl.data.duration !== 2) { console.error('FAIL closed-container clamp (bars pushed out!)', gcl.data); fail++ }
const { renderFrame: rfJ } = await import('../tools/mcp/appRender.mjs')
const grabJ = (t) => rfJ(SESSION.seq, t).getContext('2d').getImageData(0, 0, 320, 180).data
const diffJ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n }
const gdiff = diffJ(grabJ(0.1), grabJ(1.4))
if (gdiff < 1000) { console.error('FAIL keyframed glitch intensity is static', gdiff); fail++ }
await registry.call('fx_remove', { clipId: 'clip-1', fxId: 'fx-1' })
const halfJ = await registry.call('fx_add', { catalogId: 'vhs-2', inP: 1, duration: 1 })
if (!halfJ.ok || halfJ.data.inP !== 1 || halfJ.data.duration !== 1) { console.error('FAIL ranged drop', halfJ.data); fail++ }
if (diffJ(grabJ(0.5), grabJ(1.5)) < 1000) { console.error('FAIL effect range not honoured inside clip'); fail++ }
const beforeL = grabJ(0.5)
const layJ = await registry.call('fx_add', { catalogId: 'look-noir', asLayer: true })
if (!layJ.ok || layJ.data.kind !== 'adjustment') { console.error('FAIL fx adjustment layer', layJ.data); fail++ }
if (diffJ(beforeL, grabJ(0.5)) < 1000) { console.error('FAIL adjustment layer did not grade tracks below'); fail++ }
for (const t of ['fx_catalog', 'fx_add', 'fx_update', 'fx_remove'])
  if (!registry.list().some(x => x.name === t)) { console.error('FAIL missing tool', t); fail++ }

const h = await registry.call('help', {})
if (!h.ok || h.data.tools.length < 25) { console.error('FAIL help catalog', h.data.tools && h.data.tools.length); fail++ }
const dd = await registry.call('data_dump', { withImages: true, times: [1.9] })
if (!dd.ok || !dd.data.previews || !dd.data.previews[0]['data:img'].startsWith('data:image/png')) { console.error('FAIL data_dump images'); fail++ }
console.log(fail ? `UNIVERSAL TOOLS QA: FAIL (${fail})` : `UNIVERSAL TOOLS QA: PASS (${trace.length} universal steps, ${h.data.tools.length} tools, omniframe law ok, data:img dumps ok)`)
process.exit(fail ? 1 : 0)
