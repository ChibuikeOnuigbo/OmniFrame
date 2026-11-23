import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { createCanvas } from '@napi-rs/canvas'
import { applyBoxBlur } from '../src/lib/boxBlur.ts'
import { applySelectionGrade } from '../src/lib/selectionGrade.ts'
import { drawingTrimAt, strokeTrimSegments, renderAllPaintLayers, renderOnionSkin } from '../src/lib/drawingEngine.ts'
import { loadAppTs } from '../tools/mcp/appRender.mjs'

const grade = (pixels, effect) => {
  const image = { data: new Uint8ClampedArray(pixels.flat()) }
  applySelectionGrade(image, effect)
  return [...image.data]
}
const red = [255, 0, 0, 200], green = [0, 255, 0, 255], blue = [0, 0, 255, 128]
assert.deepEqual(grade([red, green, blue], { colorHold: 0, despill: 0, lumaRange: 0, channelMixer: 0 }), [...red, ...green, ...blue])
const hold = grade([red, green, blue], { colorHold: 1, holdColor: '#ff0000', holdSimilarity: .01, holdSoftness: .05 })
assert.deepEqual(hold.slice(0, 4), red)
assert.equal(hold[4], hold[5]); assert.equal(hold[5], hold[6]); assert.equal(hold[11], 128)
assert.deepEqual(grade([red], { colorHold: NaN, lumaRange: Infinity, despill: -1, channelMixer: NaN }), red)
assert.deepEqual(grade([red], { channelMixer: 1 }), red, 'identity matrix')
assert.deepEqual(grade([red], { channelMixer: 1, mixRR: 0, mixRB: 1, mixBR: 1, mixBB: 0 }), [0, 0, 255, 200], 'simultaneous channel swap')
assert.deepEqual(grade([green], { despill: 1, despillLuma: 0 }), [0, 0, 0, 255])
assert.deepEqual(grade([blue], { despill: 1, despillChannel: 'blue', despillLuma: 0 }), [0, 0, 0, 128])
const grays = [0, 64, 128, 192, 255].map(n => [n, n, n, 160])
assert.deepEqual(grade(grays, { lumaRange: 1, lumaLow: 0, lumaHigh: 1, lumaFeather: .5 }), grays.flat())
assert.deepEqual(grade(grays, { lumaRange: 1, lumaLow: .25, lumaHigh: .75, lumaFeather: 0 }).filter((_, i) => i % 4 === 3), [0, 160, 160, 0, 0])
assert.equal(grade([[255, 255, 255, 0]], { lumaRange: 1, lumaInvert: 1 })[3], 0)
assert.deepEqual(grade(grays, { lumaRange: 1, lumaLow: .7, lumaHigh: .3 }), grade(grays, { lumaRange: 1, lumaLow: .3, lumaHigh: .7 }), 'crossed bounds are ordered')

// Compare the fast separable kernel against an independent naive 2D convolution.
function naive(data, w, h, radius) {
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sums = [0, 0, 0, 0], i = (y * w + x) * 4
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const j = (Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4
      for (let c = 0; c < 3; c++) sums[c] += data[j + c] * data[j + 3]
      sums[3] += data[j + 3]
    }
    for (let c = 0; c < 3; c++) out[i + c] = sums[3] ? sums[c] / sums[3] : 0
    out[i + 3] = sums[3] / (2 * radius + 1) ** 2
  }
  return out
}
for (const [w, h] of [[1, 1], [1, 9], [11, 1], [8, 7]]) for (const radius of [1, 2, 10]) {
  const data = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i * 73 + 41) % 256)
  const expected = naive(data, w, h, radius)
  applyBoxBlur({ width: w, height: h, data }, radius)
  assert.ok(data.every((v, i) => Math.abs(v - expected[i]) <= 1), `box kernel ${w}×${h} r${radius}`)
}
const alphaEdge = { width: 3, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0, 0, 255, 0, 0]) }
applyBoxBlur(alphaEdge, 1)
assert.deepEqual([...alphaEdge.data.slice(4, 8)], [255, 0, 0, 85], 'transparent green must not leak into blur')

const custom = await loadAppTs('src/lib/customEffects.ts')
const imported = custom.parseCustomEffectFile(custom.serializeCustomEffect({ id: 'test', name: 'Selective grade', effect: { colorHold: 1, holdColor: '#abcdef', boxBlur: 7, despill: .5, despillChannel: 'blue', mixRG: -.5, channelMixer: 1 }, luts: [] }))
assert.equal(imported.error, undefined)
assert.equal(imported.effects[0].effect.holdColor, '#abcdef')
assert.equal(imported.effects[0].effect.despillChannel, 'blue')
assert.equal(imported.effects[0].effect.boxBlur, 7)
assert.equal(imported.effects[0].effect.mixRG, -.5)
assert.equal(custom.sanitizeEffect({ boxBlur: Infinity, holdColor: 'url(bad)', mixRR: 12 }).boxBlur, undefined)
assert.equal(custom.sanitizeEffect({ mixRR: 12 }).mixRR, 2)
assert.deepEqual(grade([red], { colorHold: 1, holdColor: '#ff0000', holdSimilarity: 0, holdSoftness: 0 }), red)

const catalog = await loadAppTs('src/lib/effectCatalog.ts')
const bank = await loadAppTs('src/lib/effectRecipeBank.ts')
const taxonomy = await loadAppTs('src/lib/effectTaxonomy.ts')
const box = catalog.fxCatalogById('essential-box-blur')
assert.deepEqual(taxonomy.effectGroupPath(box), ['blur', 'shape', 'box'])
assert.deepEqual(taxonomy.effectGroupPath(catalog.fxCatalogById('glitch-slice-medium')), ['glitch', 'displacement', 'slice'])
assert.deepEqual(taxonomy.effectGroupPath({ cat: 'distort', patch: { liquifyAmount: -.5 } }), ['distort', 'warp', 'liquify'])
assert.deepEqual(taxonomy.effectGroupPath({ cat: 'Glitch NG', patch: { ngFamily: 'vhs-tear' } }), ['Glitch NG', 'signal', 'vhs-tear'])
assert.deepEqual(catalog.queryFxCatalog({ groupPath: ['blur', 'shape', 'box'] }).entries.map(e => e.id), [box.id])
assert.equal(catalog.queryFxCatalog({ groupPath: ['blur', 'shape', 'missing'] }).total, 0)
assert.equal(catalog.queryFxCatalog({ collection: 'favorites', favorites: [box.id, 'essential-color-hold'], groupPath: ['blur'] }).total, 1)
assert.equal(catalog.queryFxCatalog({ collection: 'essentials', groupPath: ['blur', 'shape', 'box'], q: 'shape' }).total, 1)
assert.ok(catalog.fxGroupChildren(['key', 'chroma', 'spill']).some(g => g.id === 'green'))
const groupCounts = catalog.FX_CATS.filter(c => c.id !== 'all').map(c => catalog.queryFxCatalog({ groupPath: [c.id], limit: 0 }).total)
assert.equal(groupCounts.reduce((a, b) => a + b, 0), catalog.fxCatalogCount())
for (const cat of catalog.FX_CATS.filter(c => c.id !== 'all')) {
  const children = catalog.fxGroupChildren([cat.id])
  assert.ok(children.length)
  assert.equal(children.reduce((n, child) => n + catalog.queryFxCatalog({ groupPath: child.path, limit: 0 }).total, 0), catalog.queryFxCatalog({ cat: cat.id, limit: 0 }).total, `${cat.id} is fully partitioned`)
}
// The arithmetic pages must retain the original interleaved ID order, including the final incomplete round.
for (const group of [['blur'], ['blur', 'shape', 'aperture'], ['burst', 'mixed'], ['light']]) {
  const expected = []
  for (let i = 0; i < bank.GENERATED_RECIPE_COUNT; i++) {
    const family = bank.GENERATED_RECIPE_FAMILIES[i % bank.GENERATED_RECIPE_FAMILIES.length]
    if (taxonomy.isInEffectGroup(taxonomy.GENERATED_GROUPS[family.key], group)) expected.push(i)
  }
  for (const offset of [0, 27, expected.length - 7, expected.length, expected.length + 3]) {
    const actual = bank.queryGeneratedRecipes({ groupPath: group, offset, limit: 15 })
    assert.equal(actual.total, expected.length)
    assert.deepEqual(actual.entries.map(e => e.id), expected.slice(offset, offset + 15).map(i => bank.generatedRecipeAt(i).id))
  }
}
const start = performance.now()
for (let i = 0; i < 100; i++) bank.queryGeneratedRecipes({ groupPath: ['blur', 'shape'], offset: i * 60, limit: 60 })
assert.ok(performance.now() - start < 1000, 'folder navigation must not scan every variation')

const points = [{ x: 0, y: .5, timestamp: 0, pressure: .2 }, { x: 1, y: .5, timestamp: 1000, pressure: 1 }]
const segments = strokeTrimSegments(points, .2, .6, .6, 100, 100)
assert.equal(segments.length, 2)
assert.ok(Math.abs(segments[0][0].x - .8) < 1e-8)
assert.ok(Math.abs(segments[1].at(-1).x - .2) < 1e-8)
assert.ok(Math.abs(segments[0][0].pressure - .84) < 1e-8)
assert.deepEqual(strokeTrimSegments(points, 0, 1, .8, 100, 100), [points])
assert.deepEqual(strokeTrimSegments(points, .5, .5, 0, 100, 100), [])
const stroke = { id: 's', layerId: 'l', tool: 'brush', color: '#ffffff', size: 5, opacity: 1, points, temporalScope: { type: 'global' }, pathTrim: { start: .2, end: .6, offset: .6, keys: { end: [{ t: 2, v: 1 }, { t: 0, v: 0 }] } } }
assert.equal(drawingTrimAt(stroke, 1).end, .5)
assert.equal(drawingTrimAt(stroke, -1).end, 0)
assert.equal(drawingTrimAt(stroke, 4).end, 1)
delete stroke.pathTrim.keys
const canvas = createCanvas(100, 100), ctx = canvas.getContext('2d')
renderAllPaintLayers(ctx, 100, 100, [stroke], [{ id: 'l', visible: true, opacity: 1, blendMode: 'normal' }], 0, 30)
assert.ok(ctx.getImageData(10, 50, 1, 1).data[3] > 0)
assert.equal(ctx.getImageData(50, 50, 1, 1).data[3], 0, 'wrapped trims do not draw a connecting bridge')
assert.ok(ctx.getImageData(90, 50, 1, 1).data[3] > 0)
console.log('PASS shared pixel kernels, premultiplied box blur, nested catalog partitions/paging, trim wrap and keyframes')

// Onion ghosts use the target frame's trim instead of revealing the full stroke.
ctx.clearRect(0, 0, 100, 100)
renderOnionSkin(ctx, 100, 100, [{ ...stroke, temporalScope: { type: 'frame', frame: 0, holdFrames: 1 }, pathTrim: { start: 0, end: .3, offset: 0 } }], 1, 30, { enabled: true, beforeFrames: 1, afterFrames: 0, opacity: .5, tintStrength: 1 })
assert.ok(ctx.getImageData(10, 50, 1, 1).data[3] > 0)
assert.equal(ctx.getImageData(70, 50, 1, 1).data[3], 0, 'onion ghost respects trim')
