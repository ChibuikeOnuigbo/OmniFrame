/** Headless QA for the 15 speed-curve presets: endpoints + sane sampling. */
import { transform } from 'sucrase'
import { mkdtempSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
const dir = mkdtempSync(join(tmpdir(), 'speed-qa-'))
const src = readFileSync(join(process.cwd(), 'src/lib/speedCurves.ts'), 'utf8')
const { code } = transform(src, { transforms: ['typescript'] })
const f = join(dir, 'speedCurves.mjs')
writeFileSync(f, code)
const m = await import(f)
let fail = 0
for (const c of m.SPEED_CURVES) {
  const e0 = m.evaluateSpeedCurve(c.id, 0), e1 = m.evaluateSpeedCurve(c.id, 1)
  if (Math.abs(e0) > 1e-6 || Math.abs(e1 - 1) > 1e-6) { console.error(`FAIL endpoints ${c.id}: ${e0} ${e1}`); fail++ }
  const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(t => m.evaluateSpeedCurve(c.id, t))
  if (samples.some(v => !Number.isFinite(v) || v < -0.5 || v > 1.5)) { console.error(`FAIL range ${c.id}`, samples); fail++ }
}
if (m.SPEED_CURVES.length !== 15) { console.error('FAIL count', m.SPEED_CURVES.length); fail++ }
const rem = m.remapClipLocal({ speedCurve: 'hold-then-go', duration: 2 }, 0.5)
if (Math.abs(rem - 0) > 1e-6) { console.error('FAIL remap hold', rem); fail++ }
console.log(fail ? `SPEED CURVE QA: FAIL (${fail})` : 'SPEED CURVE QA: PASS (15 curves x 7 samples + remap)')
process.exit(fail ? 1 : 0)
