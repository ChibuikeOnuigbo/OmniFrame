import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'

globalThis.document = { createElement: (tag) => {
  if (tag !== 'canvas') throw new Error(`Unsupported test element: ${tag}`)
  return createCanvas(1, 1)
} }

const { PG, loadAppTs } = await import('../tools/mcp/appRender.mjs')
const { getFxCatalog, paramsForPatch } = await loadAppTs('src/lib/effectCatalog.ts')
const { sanitizeEffect } = await loadAppTs('src/lib/customEffects.ts')

const W = 320, H = 180
function fixture() {
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#050a16'); bg.addColorStop(0.52, '#152f48'); bg.addColorStop(1, '#381b3d')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const lights = [
    [42, 36, 7, '#fff2b0'], [98, 58, 5, '#64dcff'], [158, 34, 8, '#ff80c8'],
    [220, 66, 6, '#ffffff'], [278, 38, 7, '#ffc45c'], [62, 126, 8, '#72f4c2'],
    [130, 116, 6, '#fff'], [194, 132, 9, '#8ca9ff'], [268, 128, 5, '#ff7d67'],
  ]
  for (const [x, y, r, color] of lights) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#8a5528'; ctx.fillRect(0, 154, W, 26)
  return canvas
}
const signature = (canvas) => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex')
const baseline = signature(fixture())
const shapes = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'octagon', 'diamond', 'star']
const sheet = createCanvas(W * 4, H * 2), sx = sheet.getContext('2d')
const signatures = new Set()
for (const [index, shape] of shapes.entries()) {
  const canvas = fixture()
  PG.applyPixelGrade(canvas, {
    lensBokeh: 0.9,
    bokehRadius: 21,
    bokehThreshold: 0.56,
    bokehGain: 1.8,
    bokehShape: shape,
    bokehRotation: shape === 'diamond' ? 0 : 18,
    bokehSoftness: 0,
  }, 23)
  const hash = signature(canvas)
  assert.notEqual(hash, baseline, `${shape} bokeh changes pixels`)
  assert.ok(!signatures.has(hash), `${shape} aperture has a distinct output signature`)
  signatures.add(hash)
  const x = (index % 4) * W, y = Math.floor(index / 4) * H
  sx.drawImage(canvas, x, y)
  sx.fillStyle = 'rgba(3,7,14,.78)'; sx.fillRect(x, y, 92, 21)
  sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.fillText(shape, x + 7, y + 15)
}

const repeat = fixture()
PG.applyPixelGrade(repeat, { lensBokeh: .9, bokehRadius: 21, bokehThreshold: .56, bokehGain: 1.8, bokehShape: 'hexagon', bokehRotation: 18, bokehSoftness: 0 }, 23)
const hexCanvas = fixture()
PG.applyPixelGrade(hexCanvas, { lensBokeh: .9, bokehRadius: 21, bokehThreshold: .56, bokehGain: 1.8, bokehShape: 'hexagon', bokehRotation: 18, bokehSoftness: 0 }, 23)
assert.equal(signature(repeat), signature(hexCanvas), 'reused bokeh surfaces stay deterministic')
const bypass = fixture()
PG.applyPixelGrade(bypass, { lensBokeh: 0, bokehRadius: 64, bokehGain: 3 }, 23)
assert.equal(signature(bypass), baseline, 'zero amount is a pixel-identical bypass')

const catalog = getFxCatalog()
const presets = catalog.filter((entry) => entry.id.startsWith('bokeh-lens-'))
assert.equal(presets.length, 16, 'sixteen real lens-bokeh presets')
assert.equal(new Set(catalog.map((entry) => entry.id)).size, catalog.length, 'catalog IDs are unique')
assert.ok(catalog.length >= 10_000, 'base effect catalog remains above ten thousand recipes')
for (const entry of presets) {
  const params = paramsForPatch(entry.patch)
  assert.ok(params.some((param) => param.key === 'lensBokeh'), `${entry.id} exposes amount`)
  assert.ok(params.some((param) => param.key === 'bokehShape' && param.kind === 'select'), `${entry.id} exposes aperture shape`)
  assert.ok(params.filter((param) => param.kind === 'number').length >= 6, `${entry.id} exposes numeric keyframe channels`)
}
const clean = sanitizeEffect({
  lensBokeh: 8, bokehRadius: 900, bokehThreshold: -3, bokehGain: 12,
  bokehShape: 'not-an-iris', bokehRotation: 700, bokehSoftness: 4,
})
assert.deepEqual(
  [clean.lensBokeh, clean.bokehRadius, clean.bokehThreshold, clean.bokehGain, clean.bokehShape, clean.bokehRotation, clean.bokehSoftness],
  [1, 64, 0, 3, undefined, 180, 1],
  'imported bokeh controls are validated and clamped',
)

mkdirSync('qa/artifacts', { recursive: true })
writeFileSync('qa/artifacts/lens-bokeh-apertures.png', sheet.toBuffer('image/png'))
console.log(`lens-bokeh-unit: 8 distinct apertures, 16 presets, ${catalog.length} unique base recipes PASS`)
