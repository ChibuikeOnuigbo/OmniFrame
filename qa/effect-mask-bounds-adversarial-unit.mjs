import assert from 'node:assert/strict'
import { effectMaskFeatherBounds } from '../src/lib/effectMask.ts'

const frame = { x: 0, y: 0, width: 1920, height: 1080 }
const region = { id: 'r', shape: 'custom', centerX: .5, centerY: .5,
  width: .2, height: .2, feather: 8, opacity: 1,
  points: [{ x: .4, y: .4 }, { x: .6, y: .4 }, { x: .5, y: .6 }] }

assert.deepEqual(effectMaskFeatherBounds([], 1920, 1080), frame,
  'no region may produce an out-of-frame pixel readback')
for (const changed of [
  { centerX: NaN }, { centerY: Infinity }, { width: NaN },
  { height: Infinity }, { feather: NaN },
  { points: [{ x: NaN, y: .4 }, ...region.points.slice(1)] },
  { points: [{ x: .4, y: .4, outHandle: { x: Infinity, y: .4 } }, ...region.points.slice(1)] },
  { centerX: 1e308 },
]) {
  assert.deepEqual(effectMaskFeatherBounds([{ ...region, ...changed }], 1920, 1080), frame,
    `invalid ${Object.keys(changed)[0]} must use a safe full-frame bound`)
}

for (const changed of [
  { centerX: -2 }, { centerX: 2 }, { centerY: -2 }, { centerY: 2 },
]) {
  assert.deepEqual(effectMaskFeatherBounds([{ ...region, shape: 'circle', ...changed }], 1920, 1080), frame,
    `fully offscreen ${Object.keys(changed)[0]} must avoid an invalid readback`)
}

const valid = effectMaskFeatherBounds([region], 1920, 1080)
assert(valid.x >= 0 && valid.y >= 0 && valid.width > 0 && valid.height > 0)
assert(valid.width < frame.width && valid.height < frame.height)
console.log('PASS effect-mask bounds reject malformed geometry and remain local for valid masks')
