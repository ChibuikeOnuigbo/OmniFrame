import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'

globalThis.document = { createElement: (tag) => {
  if (tag !== 'canvas') throw new Error(`Unsupported test element: ${tag}`)
  return createCanvas(1, 1)
} }

const { PG, LFX, loadAppTs } = await import('../tools/mcp/appRender.mjs')
const { getFxCatalog, paramsForPatch } = await loadAppTs('src/lib/effectCatalog.ts')
const { sanitizeEffect } = await loadAppTs('src/lib/customEffects.ts')

const W = 320, H = 180
function fixture() {
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#07101e'); grad.addColorStop(1, '#203a56')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffb13b'; ctx.fillRect(34, 35, 56, 108)
  ctx.fillStyle = '#31d7ff'; ctx.fillRect(116, 22, 25, 136)
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(226, 87, 34, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#ff4bc3'; ctx.lineWidth = 7; ctx.strokeRect(270, 26, 32, 126)
  return canvas
}
const signature = (canvas) => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex')
const baseline = signature(fixture())
const cases = [
  ['Point', { lightType: 'point', lightColor: '#ffc65a', lightIntensity: 1.1, lightFalloff: .42, lightX: .35, lightY: .42 }],
  ['Spot 32°', { lightType: 'spot', lightColor: '#7bc8ff', lightIntensity: 1.15, lightFalloff: .55, lightX: .52, lightY: .45, lightAngle: 32 }],
  ['Beam 25°', { lightType: 'directional', lightColor: '#ffd27a', lightIntensity: 1.1, lightX: .46, lightY: .48, lightAngle: 25, lightWidth: .22, lightSoftness: .28 }],
  ['Beam 115°', { lightType: 'directional', lightColor: '#a789ff', lightIntensity: 1.1, lightX: .54, lightY: .52, lightAngle: 115, lightWidth: .38, lightSoftness: .72 }],
  ['One-side blur', { directionalBlur: .9, directionalBlurAngle: 8, directionalBlurBias: 1 }],
  ['Bright fan blur', { directionalBlur: 1.1, directionalBlurAngle: 90, directionalBlurBias: -.3, directionalBlurSpread: 38, directionalBlurThreshold: .56 }],
]
const sheet = createCanvas(W * 3, H * 2), sx = sheet.getContext('2d')
const signatures = new Set()
const hashes = new Map()
for (const [index, [label, effect]] of cases.entries()) {
  const canvas = fixture(), ctx = canvas.getContext('2d')
  if (effect.lightType) LFX.applyLightComposite(ctx, W, H, effect)
  else PG.applyPixelGrade(canvas, effect, 17)
  const hash = signature(canvas)
  assert.notEqual(hash, baseline, `${label} changes pixels`)
  assert.ok(!signatures.has(hash), `${label} is visually distinct in the fixture`)
  signatures.add(hash)
  hashes.set(label, hash)
  sx.drawImage(canvas, (index % 3) * W, Math.floor(index / 3) * H)
  sx.fillStyle = 'rgba(3,7,14,.78)'; sx.fillRect((index % 3) * W, Math.floor(index / 3) * H, 112, 21)
  sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.fillText(label, (index % 3) * W + 7, Math.floor(index / 3) * H + 15)
}
const repeat = fixture()
PG.applyPixelGrade(repeat, cases[4][1], 17)
assert.equal(signature(repeat), hashes.get('One-side blur'), 'reused blur surfaces remain deterministic')

const catalog = getFxCatalog()
const beams = catalog.filter((entry) => entry.id.startsWith('light-directional-'))
assert.equal(beams.length, 6, 'six directional-light colour presets')
assert.ok(beams.every((entry) => paramsForPatch(entry.patch).some((param) => param.key === 'lightAngle')), 'beam angle is editable/keyframeable')
for (const id of ['blur-one-side', 'blur-light-streak', 'blur-fan', 'blur-vertical-light']) {
  const entry = catalog.find((item) => item.id === id)
  assert.ok(entry, `${id} preset exists`)
  assert.ok(paramsForPatch(entry.patch).length >= 3, `${id} exposes its real controls`)
}
const clean = sanitizeEffect({
  lightType: 'directional', lightAngle: 999, lightWidth: -4, lightSoftness: 8,
  directionalBlurBias: 4, directionalBlurSpread: 400, directionalBlurThreshold: -2,
})
assert.deepEqual(
  [clean.lightType, clean.lightAngle, clean.lightWidth, clean.lightSoftness, clean.directionalBlurBias, clean.directionalBlurSpread, clean.directionalBlurThreshold],
  ['directional', 180, .03, 1, 1, 120, 0],
  'imported effect controls are validated and clamped',
)

mkdirSync('qa/artifacts', { recursive: true })
writeFileSync('qa/artifacts/directional-light-blur-contact-sheet.png', sheet.toBuffer('image/png'))
console.log('directional-light-blur-unit: 6 distinct renders, catalog controls and sanitization PASS')
