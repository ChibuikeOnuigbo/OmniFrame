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
const h = await registry.call('help', {})
if (!h.ok || h.data.tools.length < 25) { console.error('FAIL help catalog', h.data.tools && h.data.tools.length); fail++ }
const dd = await registry.call('data_dump', { withImages: true, times: [1.9] })
if (!dd.ok || !dd.data.previews || !dd.data.previews[0]['data:img'].startsWith('data:image/png')) { console.error('FAIL data_dump images'); fail++ }
console.log(fail ? `UNIVERSAL TOOLS QA: FAIL (${fail})` : `UNIVERSAL TOOLS QA: PASS (${trace.length} universal steps, ${h.data.tools.length} tools, omniframe law ok, data:img dumps ok)`)
process.exit(fail ? 1 : 0)
