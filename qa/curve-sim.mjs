/**
 * Board T cont.2 — simulation-based curve verification (user mandate: "use
 * simulation to calc what the graph is like then fix the curve to match").
 * Samples every family at 1001 pts, asserts the geometry of the uploaded
 * reference graphs (overshoot peaks, anticipation dips, equal bounce contacts,
 * damped up-down regression, pinned endpoints), writes curve-stats.json and
 * paints an atlas grid PNG like the reference sheets.
 */
import fs from 'fs'
import { createCanvas } from '@napi-rs/canvas'
import { CE } from '../tools/mcp/appRender.mjs'
const { evaluateEasingProgress } = CE

const FAMS = [
  ['linear', undefined], ['sine-in', undefined], ['sine-out', undefined], ['sine-in-out', undefined],
  ['quad-in', undefined], ['quad-out', undefined], ['quad-in-out', undefined],
  ['cubic-in', undefined], ['cubic-out', undefined], ['cubic-in-out', undefined],
  ['quart-out', undefined], ['quint-out', undefined], ['expo-in', undefined], ['expo-out', undefined],
  ['circ-out', undefined], ['back-in', undefined], ['back-out', undefined], ['back-in-out', undefined],
  ['elastic-in', undefined], ['elastic-out', undefined], ['elastic-in-out', undefined],
  ['bounce-in', undefined], ['bounce-out', undefined], ['bounce-in-out', undefined],
  ['bounce-param', { steps: 3, bounciness: 0.5, firstBounce: 0.24 }],
  ['bounce-uniform', { steps: 4, bounciness: 0.6, firstBounce: 0.2 }],
  ['rebound-in', undefined], ['rebound-out', undefined],
  ['physical', { damping: 5.5, freq: 11 }], ['spring-soft', undefined], ['spring-wild', undefined],
  ['anticipate-settle', undefined], ['smoothstep', undefined], ['smootherstep', undefined],
  ['custom', undefined],
]
const N = 1000
const sample = (fam, ep) => Array.from({ length: N + 1 }, (_, i) => evaluateEasingProgress(i / N, fam, ep))
const stats = (ys) => {
  let max = -9, min = 9, argmax = 0, argmin = 0
  ys.forEach((y, i) => { if (y > max) { max = y; argmax = i / N } if (y < min) { min = y; argmin = i / N } })
  // zero crossings of (y-1) after first reach of 0.9 => regression wiggles
  let cross = 0
  for (let i = 1; i < ys.length; i++) if ((ys[i - 1] - 1) * (ys[i] - 1) < 0) cross++
  let peaks = 0
  for (let i = 1; i < ys.length - 1; i++) if (ys[i] >= ys[i - 1] && ys[i] > ys[i + 1] && ys[i] > 0.995) peaks++
  let mono = true
  for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] - 1e-9) { mono = false; break }
  return { max: +max.toFixed(4), min: +min.toFixed(4), argmax: +argmax.toFixed(3), argmin: +argmin.toFixed(3), crossings1: cross, peaksAt1: peaks, monotonic: mono }
}
const out = {}
let fails = 0
const check = (name, cond, detail) => { if (!cond) { fails++; console.error('ASSERT FAIL', name, detail) } }
for (const [fam, ep] of FAMS) {
  const ys = sample(fam, ep)
  const st = stats(ys)
  out[fam] = st
  check(`${fam} start`, Math.abs(ys[0]) < 1e-9, ys[0])
  check(`${fam} end`, Math.abs(ys[N] - 1) < 1e-9, ys[N])
  if (['quad-in', 'cubic-in', 'quart-in', 'quint-in', 'expo-in', 'circ-in', 'sine-in', 'linear', 'smoothstep', 'smootherstep'].includes(fam)) check(`${fam} monotonic`, st.monotonic, st)
}
// reference-graph geometry assertions
const rOut = stats(sample('rebound-out'))
check('rebound-out overshoots >1.01', rOut.max > 1.01, rOut)
check('rebound-out regresses up-down (>=2 crossings of 1)', rOut.crossings1 >= 2, rOut)
const rIn = stats(sample('rebound-in'))
check('rebound-in dips <-0.01', rIn.min < -0.01, rIn)
check('rebound-in overshoots >1.01 then corrects (>=2 crossings)', rIn.max > 1.01 && rIn.crossings1 >= 2, rIn)
const bOut = sample('bounce-out', { steps: 3, bounciness: 0.5, firstBounce: 0.24 })
check('bounce contact at 0.52 == 1', Math.abs(evaluateEasingProgress(0.52, 'bounce-out', { steps: 3, bounciness: 0.5, firstBounce: 0.24 }) - 1) < 1e-9, bOut[520])
const bSt = stats(bOut)
check('bounce interior contacts at 1 = cycles', bSt.peaksAt1 === 3, bSt)
const eOut = stats(sample('elastic-out'))
check('elastic-out peak ~1.2-1.45', eOut.max > 1.2 && eOut.max < 1.45, eOut)
const kOut = stats(sample('back-out'))
check('back-out overshoot ~1.05-1.2', kOut.max > 1.05 && kOut.max < 1.2, kOut)
const kIn = stats(sample('back-in'))
check('back-in anticipation dip ~-0.1', kIn.min < -0.05 && kIn.min > -0.15, kIn)
const aS = stats(sample('anticipate-settle'))
check('anticipate-settle dip -0.15', Math.abs(aS.min + 0.15) < 0.02, aS)
fs.mkdirSync('curve_texts', { recursive: true })
fs.writeFileSync('curve_texts/curve-stats.json', JSON.stringify(out, null, 1))
// atlas grid
const cols = 6, cw = 200, ch = 150, rows = Math.ceil(FAMS.length / cols)
const cv = createCanvas(cols * cw, rows * ch)
const cx = cv.getContext('2d')
cx.fillStyle = '#f4f6f8'; cx.fillRect(0, 0, cv.width, cv.height)
FAMS.forEach(([fam, ep], i) => {
  const gx = (i % cols) * cw, gy = Math.floor(i / cols) * ch
  cx.strokeStyle = '#d8dee3'; cx.strokeRect(gx + 10, gy + 10, cw - 20, ch - 46)
  cx.strokeStyle = '#bbb'; cx.beginPath(); cx.moveTo(gx + 10, gy + 10 + (ch - 46) * 0.5); cx.lineTo(gx + cw - 10, gy + 10 + (ch - 46) * 0.5); cx.stroke()
  const ys = sample(fam, ep)
  cx.strokeStyle = fam.includes('rebound') || fam.includes('elastic') || fam.includes('spring') || fam.includes('bounce') || fam.includes('back') || fam.includes('anticipate') ? '#2b7de9' : '#188a63'
  cx.lineWidth = 2; cx.beginPath()
  ys.forEach((y, k) => {
    const px = gx + 10 + (k / N) * (cw - 20)
    const py = gy + 10 + (1 - Math.max(-0.35, Math.min(1.45, y))) / 1.8 * (ch - 46)
    k ? cx.lineTo(px, py) : cx.moveTo(px, py)
  })
  cx.stroke(); cx.lineWidth = 1
  cx.fillStyle = '#333'; cx.font = '11px sans-serif'; cx.fillText(fam, gx + 12, gy + ch - 12)
})
fs.writeFileSync('test_ans_result/evidence/curve-atlas.png', cv.toBuffer('image/png'))
console.log(fails === 0 ? `CURVE SIM PASS: ${FAMS.length} families, geometry matches reference graphs` : `CURVE SIM FAILS: ${fails}`)
