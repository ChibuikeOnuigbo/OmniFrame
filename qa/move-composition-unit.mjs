/** Headless QA for the board-E masked-keyframe mover: the mask must land on
 *  the EXISTING rectangle in the source image, keys must span pos1 -> dest,
 *  and the curve must resolve through the app speed-curve library. */
import { MaskedKeyframeMover } from '../tools/mcp/moveComposition.mjs'
const m = await new MaskedKeyframeMover(new URL('../test_ans_result/sources/src_move.png', import.meta.url).pathname, { duration: 2, curve: 'ease-in-out-cubic' }).analyze()
let fail = 0
const M = m.maskRectPx, D = m.destRectPx
if (!(M.x < m.img.width * 0.3 && M.w > 100 && M.h > 80)) { console.error('FAIL mask not on existing left rect', M); fail++ }
if (!(D.x > m.img.width * 0.5)) { console.error('FAIL dest not right rect', D); fail++ }
const kx = m.animation.curves.position_x.keyframes
if (kx[0].time !== 0 || kx[0].value !== 0) { console.error('FAIL pos1 key', kx[0]); fail++ }
if (Math.abs(kx[1].value - m.delta.dx) > 1e-9) { console.error('FAIL end key', kx[1]); fail++ }
const p0 = m.evalPosition(0), p1 = m.evalPosition(2), pm = m.evalPosition(1)
if (p0.x !== 0 || p0.y !== 0) { console.error('FAIL t0', p0); fail++ }
if (Math.abs(p1.x - m.delta.dx) > 1e-6) { console.error('FAIL tEnd', p1); fail++ }
if (!(pm.x > p0.x && pm.x < p1.x)) { console.error('FAIL mid monotonic', pm); fail++ }
if (m.mask.shape !== 'rectangle') { console.error('FAIL mask shape'); fail++ }
console.log(fail ? `MOVE COMPOSITION QA: FAIL (${fail})` : 'MOVE COMPOSITION QA: PASS (mask-on-existing-rect + pos1/end keys + curve)')
process.exit(fail ? 1 : 0)
