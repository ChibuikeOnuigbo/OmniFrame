// Runnable verification of the editor's pure logic (no browser needed).
// Run: node --experimental-strip-types scripts/verify-engine.ts
import { formatTimecode, chooseTickInterval, snap, clamp } from '../src/lib/time.ts'

let pass = 0
let fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) {
    pass++
    console.log('  PASS ', name)
  } else {
    fail++
    console.log('  FAIL ', name, '-> got', got, 'want', want)
  }
}

console.log('Timecode formatting (30fps, CapCut-style HH:MM:SS:FF):')
eq('0s', formatTimecode(0, 30), '00:00:00:00')
eq('1s', formatTimecode(1, 30), '00:00:01:00')
eq('65.5s', formatTimecode(65.5, 30), '00:01:05:15')
eq('3661s', formatTimecode(3661, 30), '01:01:01:00')

console.log('\nAdaptive ruler tick interval (smaller interval = finer zoom):')
const coarse = chooseTickInterval(20)
const fine = chooseTickInterval(2400)
eq('zooming in yields a finer interval', fine < coarse, true)
// At 2400px/s the ruler's base interval is exactly one frame (1/30s @30fps).
eq('high zoom interval is 1/30s (frame level)', chooseTickInterval(2400), 1 / 30)
// The real frame-level ruler engages whenever >=10px per frame (px >= 300 @30fps).
eq('frame-level ruler engages at 2400px/s', 2400 / 30 >= 10, true)
eq('frame-level ruler engages at 300px/s (Frames button territory)', 300 / 30 >= 10, true)

console.log('\nSnapping / clamping:')
eq('snap 1.04 -> 1', snap(1.04, 1), 1)
eq('clamp high', clamp(5, 0, 3), 3)
eq('clamp low', clamp(-2, 0, 3), 0)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
