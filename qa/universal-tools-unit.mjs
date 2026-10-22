/** QA: boards are solved by UNIVERSAL tools only (vow universal-tools law).
 *  Runs recipe E through the registry and asserts: mask drawn over the
 *  EXISTING rectangle, pos1 + end keys present, app easing applied, render
 *  produced, and no task-shaped tool names anywhere in the trace. */
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import fs from 'fs'
let fail = 0
const r = await registry.call('run_recipe', { file: 'tools/mcp/recipes/board_E_move.json' })
if (!r.ok) { console.error('FAIL recipe', r.data); fail++ }
const trace = SESSION.trace.map(t => t.tool)
const banned = ['solve_move', 'solve_tank', 'compose_', 'inpaint_']
if (trace.some(t => banned.some(b => t.startsWith(b)))) { console.error('FAIL task-shaped tool in trace', trace); fail++ }
for (const need of ['project_new', 'click', 'mask_draw', 'keyframe_set', 'curve_set', 'render_export'])
  if (!trace.includes(need)) { console.error('FAIL missing universal step', need); fail++ }
const mover = SESSION.seq.clips[1]
if (!mover.mask || !mover.mask.enabled) { console.error('FAIL no mask on mover'); fail++ }
const kx = mover.animation.curves.position_x.keyframes
if (!(kx.length === 2 && kx[0].value === 0 && kx[1].value === 529)) { console.error('FAIL keys', kx); fail++ }
if (kx[1].interpolation !== 'ease-in-out') { console.error('FAIL easing', kx[1].interpolation); fail++ }
if (!fs.existsSync('test_ans_result/E_move/solution.mp4')) { console.error('FAIL no mp4'); fail++ }
const h = await registry.call('help', {})
if (!h.ok || h.data.tools.length < 25) { console.error('FAIL help catalog', h.data.tools && h.data.tools.length); fail++ }
const dd = await registry.call('data_dump', { withImages: true, times: [1.9] })
if (!dd.ok || !dd.data.previews || !dd.data.previews[0]['data:img'].startsWith('data:image/png')) { console.error('FAIL data_dump images'); fail++ }
console.log(fail ? `UNIVERSAL TOOLS QA: FAIL (${fail})` : `UNIVERSAL TOOLS QA: PASS (${trace.length} universal steps, ${h.data.tools.length} tools, data:img dumps ok)`)
process.exit(fail ? 1 : 0)
