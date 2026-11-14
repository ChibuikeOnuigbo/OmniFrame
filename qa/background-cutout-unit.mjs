import assert from 'node:assert/strict'
import { generateMattingMask, refineAlphaMask } from '../src/lib/bgRemovalEngine.ts'

const width = 12
const height = 12
const pixels = new Uint8ClampedArray(width * height * 4)
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = (y * width + x) * 4
  const foreground = x >= 4 && x < 8 && y >= 4 && y < 8
  pixels[index] = foreground ? 210 : 255
  pixels[index + 1] = foreground ? 20 : 255
  pixels[index + 2] = foreground ? 20 : 255
  pixels[index + 3] = 255
}
const options = { modelId: 'birefnet-general', mode: 'transparent', chokeExpand: 0, featherRadius: 0 }
const matte = generateMattingMask({ width, height, data: pixels }, options.modelId, options)
assert.equal(matte.data[0], 0, 'corner background is transparent')
assert.equal(matte.data[6 * width + 6], 255, 'central subject is opaque')
assert.equal(matte.data[3 * width + 6], 0, 'connected backdrop is transparent')

const expanded = refineAlphaMask(matte.data, width, height, 1, 0)
assert.equal(expanded.data[3 * width + 6], 255, 'positive choke expands the subject')
const eroded = refineAlphaMask(matte.data, width, height, -1, 0)
assert.equal(eroded.data[4 * width + 4], 0, 'negative choke shrinks the subject')
const feathered = refineAlphaMask(matte.data, width, height, 0, 2)
assert(feathered.data[3 * width + 6] > 0 && feathered.data[3 * width + 6] < 255,
  'feather produces an intermediate alpha at the edge')
assert.deepEqual(Array.from(matte.data), Array.from(generateMattingMask({ width, height, data: pixels }, options.modelId, options).data),
  'same input produces the same matte')
console.log('PASS still cutout flood, choke, feather and deterministic alpha')
