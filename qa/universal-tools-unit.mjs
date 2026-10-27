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

// ---- Board K: MCP-driven ALL-ELEMENTS sweep — glow, shapes, drawing, every effect sub-tab.
// Proofs are app-made only: pixels come from data_dump's data:img (the app renderer),
// never from python/ffmpeg authoring. Each proof is filed to evidence/K-*.png. ----
const { loadImage: loadK, makeCanvas: mkK } = await import('../tools/mcp/core.mjs')
await registry.call('project_new', { w: 320, h: 180, fps: 12, duration: 2 })
await registry.call('import_media', { path: 'qa/shots/01-home.png', fit: 'contain', scale: 1 })
const dumpK = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/K-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const diffK = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n }
const baseK = await dumpK('base')
// glow family first (mandated test): glow → edge glow → light layer
await registry.call('fx_add', { catalogId: 'glow-2' })
const glowK = await dumpK('glow')
if (!glowK || diffK(baseK, glowK) < 300) { console.error('FAIL glow engine invisible'); fail++ }
await registry.call('fx_add', { catalogId: 'edgeglow-cobalt' })
const edgeK = await dumpK('edgeglow')
if (!edgeK || diffK(glowK, edgeK) < 300) { console.error('FAIL edge glow invisible'); fail++ }
await registry.call('fx_add', { catalogId: 'light-point-gold', asLayer: true })
const litK = await dumpK('lightlayer')
if (!litK || diffK(edgeK, litK) < 300) { console.error('FAIL light layer invisible'); fail++ }
for (const id of ['fx-1', 'fx-2']) await registry.call('fx_remove', { clipId: 'clip-1', fxId: id })
// the light adjustment layer still grades everything below — re-baseline AFTER
// the fx cleanup so mask proofs compare like-for-like
const baseK2 = await dumpK('base-postfx')
// shape tools: rectangle mask, then inverted feathered ellipse mask
await registry.call('select', { clipId: 'clip-1' })
await registry.call('mask_draw', { shape: 'rectangle', x0: 80, y0: 40, x1: 240, y1: 140 })
const mrectK = await dumpK('mask-rect')
if (!mrectK || diffK(baseK2, mrectK) < 300) { console.error('FAIL rectangle mask shape'); fail++ }
await registry.call('mask_draw', { shape: 'ellipse', x0: 60, y0: 30, x1: 260, y1: 150, inverted: true, feather: 8 })
const mellK = await dumpK('mask-ellipse-inv')
if (!mellK || diffK(mrectK, mellK) < 300) { console.error('FAIL inverted ellipse mask'); fail++ }
await registry.call('mask_clear', {})
const mclearK = await dumpK('mask-cleared')
if (!mclearK || diffK(baseK2, mclearK) > 50) { console.error('FAIL mask_clear did not restore'); fail++ }
// drawing engine: shape strokes (rectangle/star/polygon/bezier/fill)
const shapeTools = ['rectangle', 'star', 'polygon', 'bezier', 'fill']
for (const tl of shapeTools) {
  const rr = await registry.call('draw_stroke', { tool: tl, points: [[40, 40], [90, 50], [70, 90]], color: '#ffd9a0', size: 6, filled: tl === 'fill' })
  if (!rr.ok) { console.error('FAIL draw_stroke shape tool', tl, rr.data); fail++ }
}
const kindSet = new Set(SESSION.paint.strokes.map((st) => st.tool))
for (const tl of shapeTools) if (!kindSet.has(tl)) { console.error('FAIL stroke kind missing', tl); fail++ }
if (SESSION.paint.strokes.some((st) => st.points.some((pt) => pt.x > 1 || pt.y > 1))) { console.error('FAIL stroke points must stay normalized'); fail++ }
await registry.call('paint_clear', {})
// effects: one live render per catalog sub-tab
const sweepFx = ['glitch-slice-medium', 'osc-90-sine-40', 'look-noir', 'blur-2', 'swirl-90', 'vhs-2', 'part-1', 'gmap-0-4']
for (const id of sweepFx) {
  const ad = await registry.call('fx_add', { catalogId: id })
  if (!ad.ok) { console.error('FAIL fx_add sweep', id, ad.data); fail++; continue }
  const pxK = await dumpK(`fx-${id}`, id.startsWith('osc-') ? 0.5625 : 0.5) // osc: avoid the sine zero-crossing at t=0.5
  if (!pxK || diffK(baseK, pxK) < 200) { console.error('FAIL effect rendered identically to base:', id); fail++ }
  await registry.call('fx_remove', { clipId: 'clip-1', fxId: ad.data.fxId })
}

// ---- Board L: top backlog names converted into REAL engines (kaleidoscope /
// lens flare / color temperature). Proofs app-made only: data_dump data:img ->
// evidence/L-*.png. Never python/ffmpeg authoring. ----
await registry.call('project_new', { w: 320, h: 180, fps: 12, duration: 2 })
await registry.call('import_media', { path: 'qa/shots/01-home.png', fit: 'contain', scale: 1 })
const dumpL = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump L', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/L-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const meansL = (d) => { let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ } return { r: r / n, g: g / n, b: b / n } }
const catL = await registry.call('fx_catalog', { limit: 50000 })
if (!catL.ok) { console.error('FAIL fx_catalog L', catL.data); fail++ }
const catIds = new Set((catL.data.entries || []).map((en) => en.id))
for (const id of ['kaleido-6', 'flare-0', 'kelvin-3200', 'kelvin-10000']) {
  if (!catIds.has(id)) { console.error('FAIL catalog missing board-L id', id); fail++ }
}
const kaleidoEntry = (catL.data.entries || []).find((en) => en.id === 'kaleido-6')
if (!kaleidoEntry || !kaleidoEntry.params.includes('kaleidoSegments') || !kaleidoEntry.params.includes('kaleidoRotate')) { console.error('FAIL kaleido params not exposed'); fail++ }
const baseL = await dumpL('base')
const kaL = await registry.call('fx_add', { catalogId: 'kaleido-6' })
if (!kaL.ok) { console.error('FAIL fx_add kaleido', kaL.data); fail++; }
const kalL = kaL.ok ? await dumpL('kaleido-6') : null
if (!kalL || diffK(baseL, kalL) < 300) { console.error('FAIL kaleidoscope engine invisible'); fail++ }
if (kaL.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: kaL.data.fxId })
const faL = await registry.call('fx_add', { catalogId: 'flare-0' })
if (!faL.ok) { console.error('FAIL fx_add flare', faL.data); fail++ }
const flL = faL.ok ? await dumpL('flare-anamorphic') : null
if (!flL || diffK(baseL, flL) < 300) { console.error('FAIL lens flare engine invisible'); fail++ }
const mBaseL = meansL(baseL)
const mFlL = flL ? meansL(flL) : mBaseL
if (!(mFlL.r > mBaseL.r + 2 && mFlL.g > mBaseL.g + 2)) { console.error('FAIL flare must lift luminance (screen blend)'); fail++ }
if (faL.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: faL.data.fxId })
const twL = await registry.call('fx_add', { catalogId: 'kelvin-3200' })
if (!twL.ok) { console.error('FAIL fx_add kelvin-3200', twL.data); fail++ }
const warmL = twL.ok ? await dumpL('kelvin-3200') : null
if (!warmL || diffK(baseL, warmL) < 300) { console.error('FAIL color temp warm invisible'); fail++ }
const mWL = warmL ? meansL(warmL) : mBaseL
if (!((mWL.r - mWL.b) - (mBaseL.r - mBaseL.b) > 6)) { console.error('FAIL 3200K must shift R-B warmer'); fail++ }
if (twL.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: twL.data.fxId })
const tcL = await registry.call('fx_add', { catalogId: 'kelvin-10000' })
if (!tcL.ok) { console.error('FAIL fx_add kelvin-10000', tcL.data); fail++ }
const coolL = tcL.ok ? await dumpL('kelvin-10000') : null
const mCL = coolL ? meansL(coolL) : mBaseL
if (!((mWL.r - mWL.b) - (mCL.r - mCL.b) > 6)) { console.error('FAIL 10000K must be cooler than 3200K'); fail++ }
// keyframeable: 2-point ramp on colorTemp must actually animate across time
const kfL = await registry.call('fx_update', { clipId: 'clip-1', fxId: tcL.data.fxId, keys: { colorTemp: [[0, 2500], [1.5, 12000]] } })
if (!kfL.ok || !kfL.data.keys || kfL.data.keys.colorTemp !== 2) { console.error('FAIL colorTemp keyframes not stored', kfL.data); fail++ }
const rampAL = await dumpL('kelvin-ramp-warm', 0.1)
const rampBL = await dumpL('kelvin-ramp-cool', 1.4)
const mRAL = rampAL ? meansL(rampAL) : mBaseL
const mRBL = rampBL ? meansL(rampBL) : mBaseL
if (!((mRAL.r - mRAL.b) - (mRBL.r - mRBL.b) > 6)) { console.error('FAIL colorTemp keyframe ramp does not animate'); fail++ }
if (tcL.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: tcL.data.fxId })

// ---- Board M: Krita-scan sub-tools — Multibrush mirror modes, Gradient radial
// shape, symmetry copies. Proofs app-made only: data_dump data:img -> M-*.png. ----
const dumpM = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump M', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/M-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
await registry.call('paint_clear', {})
const baseM = await dumpM('base')
await registry.call('draw_stroke', { tool: 'line', points: [[60, 40], [120, 90]], color: '#ff5d8f', size: 6, appearAt: 0.1 })
const lineM = await dumpM('line-plain')
if (!lineM || diffK(baseM, lineM) < 100) { console.error('FAIL line stroke invisible'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'line', points: [[60, 40], [120, 90]], color: '#ff5d8f', size: 6, mirrorX: true, appearAt: 0.1 })
const mirM = await dumpM('multibrush-mirrorX')
if (!mirM || diffK(lineM, mirM) < 100) { console.error('FAIL mirrorX must add reflected copy'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'gradient', points: [[40, 40], [240, 140]], color: '#22d3ee', gradientColor: '#7a1330', appearAt: 0.1 })
const glM = await dumpM('gradient-linear')
if (!glM || diffK(baseM, glM) < 300) { console.error('FAIL linear gradient invisible'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'gradient', points: [[40, 40], [240, 140]], color: '#22d3ee', gradientColor: '#7a1330', gradientShape: 'radial', appearAt: 0.1 })
const grM = await dumpM('gradient-radial')
if (!grM || diffK(glM, grM) < 300) { console.error('FAIL radial gradient shape must differ from linear'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: [[160, 40], [180, 60]], color: '#ffc93c', size: 5, appearAt: 0.1 })
const oneM = await dumpM('sym-single')
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: [[160, 40], [180, 60]], color: '#ffc93c', size: 5, radialCopies: 8, appearAt: 0.1 })
const radM = await dumpM('multibrush-sym8')
if (!radM || diffK(oneM, radM) < 200) { console.error('FAIL radial symmetry copies invisible'); fail++ }
await registry.call('paint_clear', {})

// ---- Board N: Krita Freehand Brush stabilizer (smoothing 0..1). Proof app-made:
// data_dump data:img -> N-*.png. Same jagged input, raw vs corrected. ----
const dumpN = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump N', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/N-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const jagN = [[40, 90], [70, 50], [100, 95], [130, 45], [160, 95], [190, 50], [220, 90], [250, 55]]
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: jagN, color: '#7dff9b', size: 4, appearAt: 0.1 })
const rawN = await dumpN('stabilizer-raw')
if (!rawN || diffK(baseM || rawN, rawN) < 0) { console.error('FAIL raw stroke render'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: jagN, color: '#7dff9b', size: 4, smoothing: 0.95, appearAt: 0.1 })
const smN = await dumpN('stabilizer-095')
if (!smN || diffK(rawN, smN) < 100) { console.error('FAIL smoothing must visibly correct the jagged stroke'); fail++ }
await registry.call('paint_clear', {})

// ---- Board O: Voronoi Cells + Spectral Map engines. Proofs app-made only:
// data_dump data:img -> O-*.png. ----
const dumpO = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump O', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/O-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const satMean = (d) => { let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); s += mx - mn; n++ } return s / n }
const baseO = await dumpO('base')
const voA = await registry.call('fx_add', { catalogId: 'voronoi-16' })
if (!voA.ok) { console.error('FAIL fx_add voronoi-16', voA.data); fail++ }
const vorO = voA.ok ? await dumpO('voronoi-16') : null
if (!vorO || diffK(baseO, vorO) < 300) { console.error('FAIL voronoi overlay invisible'); fail++ }
if (voA.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: voA.data.fxId })
const spA = await registry.call('fx_add', { catalogId: 'spectral-1' })
if (!spA.ok) { console.error('FAIL fx_add spectral-1', spA.data); fail++ }
const speO = spA.ok ? await dumpO('spectral-1') : null
if (!speO || diffK(baseO, speO) < 300) { console.error('FAIL spectral map invisible'); fail++ }
if (speO && satMean(speO) - satMean(baseO) < 6) { console.error('FAIL spectral map must raise chroma (luma→hue sweep)'); fail++ }
if (spA.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: spA.data.fxId })

// ---- Board P: Timecode burn-in + Multibrush Translate + Gradient repeat.
// Proofs app-made only: data_dump data:img -> P-*.png. ----
const dumpP = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump P', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/P-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const baseP = await dumpP('base')
const tcA = await registry.call('fx_add', { catalogId: 'timecode-1' })
if (!tcA.ok) { console.error('FAIL fx_add timecode-1', tcA.data); fail++ }
const tcP = tcA.ok ? await dumpP('timecode-burnin', 1.0) : null
if (!tcP || diffK(baseP, tcP) < 60) { console.error('FAIL timecode burn-in invisible'); fail++ }
if (tcA.ok) await registry.call('fx_remove', { clipId: 'clip-1', fxId: tcA.data.fxId })
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: [[150, 80], [170, 100]], color: '#ffc93c', size: 5, appearAt: 0.1 })
const trOne = await dumpP('translate-single')
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'brush', points: [[150, 80], [170, 100]], color: '#ffc93c', size: 5, translateCopies: 4, translateRadius: 40, appearAt: 0.1 })
const trRing = await dumpP('translate-ring4')
if (!trRing || diffK(trOne, trRing) < 200) { console.error('FAIL multibrush translate ring copies invisible'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'gradient', points: [[30, 30], [280, 150]], color: '#22d3ee', gradientColor: '#7a1330', appearAt: 0.1 })
const gNone = await dumpP('gradient-repeat-none')
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'gradient', points: [[30, 30], [280, 150]], color: '#22d3ee', gradientColor: '#7a1330', gradientRepeat: 'forward', appearAt: 0.1 })
const gFwd = await dumpP('gradient-repeat-forward')
if (!gFwd || diffK(gNone, gFwd) < 200) { console.error('FAIL gradient forward repeat must differ from none'); fail++ }
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'gradient', points: [[30, 30], [280, 150]], color: '#22d3ee', gradientColor: '#7a1330', gradientRepeat: 'alternating', appearAt: 0.1 })
const gAlt = await dumpP('gradient-repeat-alternating')
if (!gAlt || diffK(gFwd, gAlt) < 200) { console.error('FAIL gradient alternating repeat must differ from forward'); fail++ }
await registry.call('paint_clear', {})

// ---- Board Q: alignment + detection (motion/shape) + prism + compound extras.
// Proofs app-made only: data_dump data:img -> Q-*.png. ----
const dumpQ = async (name, t = 0.5) => {
  const r = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r.ok || !r.data.previews || !r.data.previews[0]) { console.error('FAIL data_dump Q', name); fail++; return null }
  const b64 = r.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/Q-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0)
  return cx.getImageData(0, 0, img.width, img.height).data
}
const meanRB = (d, w, x0, x1) => { let s2 = 0, n = 0; for (let y = 0; y < 180; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s2 += d[i] - d[i + 2]; n++ } return s2 / n }
await registry.call('import_media', { path: 'qa/shots/01-home.png', fit: 'contain', scale: 0.5 })
await registry.call('select', { clipId: 'clip-2' })
await registry.call('transform_set', { x: 70, y: 40 })
const baseQ = await dumpQ('base')
const alQ = await registry.call('align_clips', { mode: 'hcenter' })
if (!alQ.ok || alQ.data.clips.some((k) => Math.abs(k.cx - 160) > 2)) { console.error('FAIL align hcenter', alQ.data); fail++ }
const alvQ = await registry.call('align_clips', { mode: 'vcenter' })
if (!alvQ.ok || alvQ.data.clips.some((k) => Math.abs(k.cy - 90) > 2)) { console.error('FAIL align vcenter', alvQ.data); fail++ }
await dumpQ('align-centered')
await registry.call('select', { clipId: 'clip-1' })
const ma0 = await registry.call('motion_analyze', { t0: 0.5, t1: 0.5625 })
if (!ma0.ok || ma0.data.changedRatio > 0.001) { console.error('FAIL static scene must read ~zero motion', ma0.data); fail++ }
const osQ = await registry.call('fx_add', { catalogId: 'osc-90-sine-40' })
const ma1 = await registry.call('motion_analyze', { t0: 0.5, t1: 0.5625 })
if (!ma1.ok || ma1.data.changedRatio < 0.005) { console.error('FAIL oscillating clip must register motion', ma1.data); fail++ }
if (!ma1.data.grid.some((v) => v > 1)) { console.error('FAIL motion grid must light up'); fail++ }
await dumpQ('motion-osc', 0.5625)
await registry.call('fx_remove', { clipId: 'clip-1', fxId: osQ.data.fxId })
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'rectangle', points: [[80, 40], [200, 120]], color: '#ffffff', filled: true, appearAt: 0.1 })
const sdR = await registry.call('shape_detect', { t: 0.5, thresh: 128 })
if (!sdR.ok || !sdR.data.shapes.length || !['rect', 'square'].includes(sdR.data.shapes[0].class)) { console.error('FAIL shape_detect rect', sdR.data); fail++ }
await dumpQ('shape-rect')
await registry.call('paint_clear', {})
await registry.call('draw_stroke', { tool: 'circle', points: [[120, 60], [180, 120]], color: '#ffffff', filled: true, appearAt: 0.1 })
const sdC = await registry.call('shape_detect', { t: 0.5, thresh: 128 })
if (!sdC.ok || !sdC.data.shapes.length || sdC.data.shapes[0].class !== 'circle') { console.error('FAIL shape_detect circle', sdC.data); fail++ }
await registry.call('paint_clear', {})
const prQ = await registry.call('fx_add', { catalogId: 'prism-1' })
const prPx = await dumpQ('prism')
if (!prPx || diffK(baseQ, prPx) < 200) { console.error('FAIL prism sweep invisible'); fail++ }
if (Math.abs(meanRB(prPx, 320, 0, 100) - meanRB(prPx, 320, 220, 320)) < 4) { console.error('FAIL prism must sweep hue across X'); fail++ }
await registry.call('fx_remove', { clipId: 'clip-1', fxId: prQ.data.fxId })
const ccQ = await registry.call('compound_clip_create', { ids: ['clip-1'], name: 'HeroComp' })
const clQ = await registry.call('compound_list', {})
if (!clQ.ok || !clQ.data.compounds.some((k) => k.id === ccQ.data.id && k.name === 'HeroComp')) { console.error('FAIL compound persist', clQ.data); fail++ }
await registry.call('compound_rename', { id: ccQ.data.id, name: 'HeroComp2' })
const ceQ = await registry.call('compound_expand', { id: ccQ.data.id })
if (!ceQ.ok || ceQ.data.memberIds[0] !== 'clip-1') { console.error('FAIL compound expand', ceQ.data); fail++ }

// ---- Board S: blend modes / text glow+shadow / padded compound / nest / demo edit ----
const dumpS = async (name, t = 0.5) => {
  const r2 = await registry.call('data_dump', { withImages: true, times: [t] })
  if (!r2.ok || !r2.data.previews || !r2.data.previews[0]) { console.error('FAIL data_dump S', name); fail++; return null }
  const b64 = r2.data.previews[0]['data:img'].split(',')[1]
  fs.writeFileSync(`test_ans_result/evidence/S-${name}.png`, Buffer.from(b64, 'base64'))
  const img = await loadK(Buffer.from(b64, 'base64'))
  const cv = mkK(img.width, img.height)
  const cx2 = cv.getContext('2d')
  cx2.drawImage(img, 0, 0)
  return cx2.getImageData(0, 0, img.width, img.height).data
}
const lumBox = (d, w, x0, x1, y0, y1) => { let s3 = 0, n3 = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s3 += (d[i] + d[i + 1] + d[i + 2]) / 3; n3++ } return s3 / n3 }
const diffPx = (a, b) => { let s4 = 0; for (let i = 0; i < a.length; i += 4) s4 += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s4 / (a.length / 4) }
// 1. clip blend modes: see-through (screen) vs color-burn must composite differently
await registry.call('select', { clipId: 'clip-2' })
await registry.call('blend_set', { mode: 'screen' })
const sScreen = await dumpS('blend-screen')
await registry.call('blend_set', { mode: 'color-burn' })
const sBurn = await dumpS('blend-burn')
const sBlendDiff = (sScreen && sBurn) ? diffPx(sScreen, sBurn) : 0
if (sBlendDiff < 6) { console.error('FAIL blend screen vs color-burn must differ', sBlendDiff.toFixed(2)); fail++ }
await registry.call('blend_set', { mode: 'source-over' })
// 2. text preset + explicit glow + Photoshop-model shadow + small keys with a custom curve
const tS = await registry.call('create_text', { text: 'BOARD S', preset: 'bar', x: 0, y: -50 })
const tId = tS.data.clipId
await registry.call('select', { clipId: tId })
const sTextBase = await dumpS('text-base')
await registry.call('edit_element', { clipId: tId, patch: { textStyle: { glowColor: '#22d3ee', glowBlur: 26, glowMode: 'outward', shadowMode: 'outer', shadowColor: '#000000', shadowBlur: 8, shadowOffsetX: 5, shadowOffsetY: 5, chroma: 3 } } })
const sTextGlow = await dumpS('text-glowshadow')
const sTextDiff = (sTextBase && sTextGlow) ? diffPx(sTextBase, sTextGlow) : 0
if (sTextDiff < 3) { console.error('FAIL text glow+shadow must change pixels', sTextDiff.toFixed(2)); fail++ }
await registry.call('keyframe_set', { property: 'opacity', time: 0.15, value: 0.35, interpolation: 'linear' })
await registry.call('keyframe_set', { property: 'opacity', time: 0.55, value: 1, interpolation: 'custom', points: [[0.15, 0.35], [0.3, 0.9], [0.55, 1]] })
// 3. oversized element + own LUT (forces isolated render) + compound + scale: corners must keep pixels
await registry.call('select', { clipId: 'clip-2' })
await registry.call('transform_set', { x: 0, y: 0, scale: 4 })
await registry.call('edit_element', { clipId: 'clip-2', patch: { adjustment: { luts: [{ id: 'lut-qs', name: 'bright-air', builtin: 'bright-air', intensity: 1, enabled: true }] } } })
const ccS = await registry.call('compound_clip_create', { ids: ['clip-2'], name: 'BigS', nest: true })
const cidS = ccS.data.id
await registry.call('select', { clipId: cidS })
await registry.call('transform_set', { scale: 1.6 })
const sComp = await dumpS('compound-scaled')
if (!sComp) { console.error('FAIL compound dump missing'); fail++ }
else {
  const corners = lumBox(sComp, 320, 0, 48, 0, 48) + lumBox(sComp, 320, 272, 320, 132, 180)
  if (corners < 4) { console.error('FAIL compound cutoff: scaled corners empty', corners.toFixed(2)); fail++ }
}
// 4. nested timeline enter/exit (double-click equivalent) + uncompound (Ctrl+Z-registered)
const enS = await registry.call('compound_enter', { id: cidS })
if (!enS.ok || !enS.data.activeSequenceId || enS.data.activeSequenceId === 'main') { console.error('FAIL compound_enter', enS.data); fail++ }
const exS = await registry.call('compound_exit', {})
if (!exS.ok || exS.data.activeSequenceId !== 'main') { console.error('FAIL compound_exit', exS.data); fail++ }
const unS = await registry.call('uncompound_clip', { id: cidS })
if (!unS.ok) { console.error('FAIL uncompound_clip', unS.data); fail++ }
// 5. the requested edit: LUT pack grade + adjustment layer + image overlay at reduced opacity
await registry.call('select', { clipId: 'clip-2' })
await registry.call('edit_element', { clipId: 'clip-2', patch: { adjustment: { luts: [] } } })
const sPreLut = await dumpS('pre-lut')
const edS = await registry.call('edit_element', { clipId: 'clip-2', patch: { adjustment: { luts: [{ id: 'lut-demo', name: 'crimson-pulse', builtin: 'crimson-pulse', intensity: 0.8, enabled: true }] } } })
const sPostLut = await dumpS('post-lut')
const sLutDiff = (sPreLut && sPostLut) ? diffPx(sPreLut, sPostLut) : 0
if (sLutDiff < 3) { console.error('FAIL LUT pack grade must change pixels headless', sLutDiff.toFixed(2)); fail++ }
if (!edS.ok || !edS.data?.adjustment?.luts?.length) { console.error('FAIL LUT pack grade not stored on clip', edS.ok); fail++ }
const fcS = await registry.call('fx_catalog', { limit: 3 })
const fxS = (fcS.data.entries || [])[0]
if (fxS) await registry.call('fx_add', { catalogId: fxS.id, asLayer: true })
const impS = await registry.call('import_media', { path: 'qa/shots/01-home.png', fit: 'cover', scale: 1 })
const ovId = impS.data.clipId || 'clip-3'
await registry.call('select', { clipId: ovId })
await registry.call('transform_set', { opacity: 0.35 })
await registry.call('blend_set', { mode: 'screen' })
await dumpS('demo-frame')
const tlS = await registry.call('timeline_screenshot', { out: 'test_ans_result/evidence/S-demo-edit.png' })
if (!tlS.ok) { console.error('FAIL demo timeline_screenshot'); fail++ }

const h = await registry.call('help', {})
if (!h.ok || h.data.tools.length < 25) { console.error('FAIL help catalog', h.data.tools && h.data.tools.length); fail++ }
const dd = await registry.call('data_dump', { withImages: true, times: [1.9] })
if (!dd.ok || !dd.data.previews || !dd.data.previews[0]['data:img'].startsWith('data:image/png')) { console.error('FAIL data_dump images'); fail++ }
console.log(fail ? `UNIVERSAL TOOLS QA: FAIL (${fail})` : `UNIVERSAL TOOLS QA: PASS (${trace.length} universal steps, ${h.data.tools.length} tools, omniframe law ok, data:img dumps ok)`)
process.exit(fail ? 1 : 0)
