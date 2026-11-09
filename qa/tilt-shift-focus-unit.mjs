import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'

globalThis.document = { createElement: (tag) => {
  if (tag !== 'canvas') throw new Error(`Unsupported test element: ${tag}`)
  return createCanvas(1, 1)
} }

const { PG, loadAppTs } = await import('../tools/mcp/appRender.mjs')
const { getFxCatalog, paramsForPatch, queryFxCatalog } = await loadAppTs('src/lib/effectCatalog.ts')
const { sanitizeEffect } = await loadAppTs('src/lib/customEffects.ts')

const W = 320, H = 200
function fixture() {
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d')
  ctx.fillStyle = '#08111f'; ctx.fillRect(0, 0, W, H)
  for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x += 10) {
    ctx.fillStyle = (x / 10 + y / 10) % 2 ? '#e9f3ff' : '#152943'
    ctx.fillRect(x, y, 10, 10)
  }
  ctx.fillStyle = '#ff5d4c'; ctx.fillRect(22, 74, 276, 52)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('FOCUS', 103, 111)
  return canvas
}

const signature = (canvas) => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex')
const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, W, H).data
const mae = (a, b, region) => {
  let sum = 0, count = 0
  for (let y = region.y0; y < region.y1; y++) for (let x = region.x0; x < region.x1; x++) {
    const i = (y * W + x) * 4
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    count += 3
  }
  return sum / Math.max(1, count)
}

const original = fixture()
const originalPixels = pixels(original)
const originalHash = signature(original)
const cases = [
  ['Horizontal center', { tiltShift: .86, tiltShiftCenterX: .5, tiltShiftCenterY: .5, tiltShiftAngle: 0, tiltShiftWidth: .2, tiltShiftFeather: .1 }],
  ['Portrait near', { tiltShift: .86, tiltShiftCenterX: .3, tiltShiftCenterY: .5, tiltShiftAngle: 90, tiltShiftWidth: .18, tiltShiftFeather: .1 }],
  ['Diagonal wide', { tiltShift: .72, tiltShiftCenterX: .5, tiltShiftCenterY: .5, tiltShiftAngle: 35, tiltShiftWidth: .46, tiltShiftFeather: .2 }],
]
const sheet = createCanvas(W * 3, H), sheetContext = sheet.getContext('2d')
const signatures = new Set()
for (const [index, [label, effect]] of cases.entries()) {
  const canvas = fixture()
  PG.applyPixelGrade(canvas, effect, 31)
  const hash = signature(canvas)
  assert.notEqual(hash, originalHash, `${label} changes pixels`)
  assert.ok(!signatures.has(hash), `${label} has a distinct focus-plane render`)
  signatures.add(hash)
  sheetContext.drawImage(canvas, index * W, 0)
  sheetContext.fillStyle = 'rgba(3,7,14,.8)'; sheetContext.fillRect(index * W, 0, 132, 22)
  sheetContext.fillStyle = '#fff'; sheetContext.font = '12px sans-serif'; sheetContext.fillText(label, index * W + 7, 15)

  if (index === 0) {
    const result = pixels(canvas)
    const focusError = mae(originalPixels, result, { x0: 40, x1: 280, y0: 88, y1: 112 })
    const edgeError = (mae(originalPixels, result, { x0: 40, x1: 280, y0: 8, y1: 42 }) + mae(originalPixels, result, { x0: 40, x1: 280, y0: 158, y1: 192 })) / 2
    assert.ok(focusError < edgeError * 0.3, `horizontal focus band stays sharper (${focusError.toFixed(2)} < ${edgeError.toFixed(2)})`)
  }
  if (index === 1) {
    const result = pixels(canvas)
    const focusError = mae(originalPixels, result, { x0: 82, x1: 110, y0: 28, y1: 172 })
    const farError = mae(originalPixels, result, { x0: 246, x1: 294, y0: 28, y1: 172 })
    assert.ok(focusError < farError * 0.45, `portrait focus centre moves to x=0.3 (${focusError.toFixed(2)} < ${farError.toFixed(2)})`)
  }
}

const bypass = fixture()
PG.applyPixelGrade(bypass, { tiltShift: 0, tiltShiftAngle: 90, tiltShiftWidth: .04 }, 31)
assert.equal(signature(bypass), originalHash, 'zero amount is a pixel-identical bypass')

const catalog = getFxCatalog()
const presets = catalog.filter((entry) => entry.id.startsWith('tilt-focus-'))
assert.equal(presets.length, 48, 'forty-eight movable selective-focus presets')
assert.equal(new Set(presets.map((entry) => JSON.stringify(entry.patch))).size, 48, 'all focus-plane patches are unique')
assert.ok(queryFxCatalog({ q: 'Diagonal Focus Center Narrow', limit: 20 }).entries.some((entry) => entry.id === 'tilt-focus-diagonal-center-narrow'), 'natural multiword search ignores display separators')
for (const entry of presets) {
  const params = paramsForPatch(entry.patch)
  assert.equal(params.length, 6, `${entry.id} exposes all six controls`)
  assert.ok(params.every((param) => param.kind === 'number'), `${entry.id} controls are keyframeable`)
}

const clean = sanitizeEffect({
  tiltShift: 8,
  tiltShiftCenterX: -2,
  tiltShiftCenterY: 3,
  tiltShiftAngle: 900,
  tiltShiftWidth: 0,
  tiltShiftFeather: 7,
})
assert.deepEqual(
  [clean.tiltShift, clean.tiltShiftCenterX, clean.tiltShiftCenterY, clean.tiltShiftAngle, clean.tiltShiftWidth, clean.tiltShiftFeather],
  [1, 0, 1, 180, .04, .5],
  'imported focus-plane controls are validated and clamped',
)

mkdirSync('qa/artifacts', { recursive: true })
writeFileSync('qa/artifacts/tilt-shift-focus-planes.png', sheet.toBuffer('image/png'))
console.log(`tilt-shift-focus-unit: 3 distinct renders, movable sharp plane, 48 presets, ${catalog.length} materialized recipes PASS`)
