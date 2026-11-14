import assert from 'node:assert/strict'
import { generateMattingMask, refineAlphaMask, compositeCutout } from '../src/lib/bgRemovalEngine.ts'
import { createCanvas } from '@napi-rs/canvas'

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
const logo = new Uint8ClampedArray(width * height * 4)
for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) logo[(y * width + x) * 4 + 3] = 255
const logoMask = generateMattingMask({ width, height, data: logo }, options.modelId, options)
assert.equal(logoMask.data[6 * width + 6], 255, 'transparent black corners must not erase an opaque black subject')
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
const source = createCanvas(2, 2)
const target = createCanvas(2, 2)
const context = source.getContext('2d')
context.fillStyle = 'rgba(210,20,20,0.5)'
context.fillRect(0, 0, 2, 2)
compositeCutout(source, { width: 2, height: 2, data: new Uint8ClampedArray(4).fill(255) },
  { ...options, mode: 'solid', solidColor: '#0000ff' }, target)
const blended = target.getContext('2d').getImageData(0, 0, 1, 1).data
assert(Math.abs(blended[0] - 105) < 3 && Math.abs(blended[2] - 137) < 3 && blended[3] === 255,
  `existing source transparency must blend over the replacement background: ${blended}`)
console.log('PASS still cutout flood, choke, feather, deterministic alpha and source transparency')
