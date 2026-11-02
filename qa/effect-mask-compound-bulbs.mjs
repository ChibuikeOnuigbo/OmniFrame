import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { renderFrame } from '../tools/mcp/appRender.mjs'
import { makeCanvas } from '../tools/mcp/core.mjs'
import { registry, SESSION } from '../tools/mcp/tools.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixtureDir = path.join(root, 'qa', 'fixtures')
const outDir = path.join(root, 'qa-output', 'effect-mask-bulbs')
fs.mkdirSync(fixtureDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const fixture = path.join(fixtureDir, 'five-hanging-bulbs.png')
const W = 640, H = 360
const bulbs = [
  { x: .14, y: .56, rope: .18 }, { x: .32, y: .48, rope: .13 },
  { x: .50, y: .62, rope: .24 }, { x: .68, y: .44, rope: .11 },
  { x: .86, y: .57, rope: .19 },
]

// Original, license-clean test fixture. The final proof below is rendered by
// OmniFrame's own import/compound/effect/export tools.
const art = makeCanvas(W, H), ax = art.getContext('2d')
const bg = ax.createLinearGradient(0, 0, 0, H)
bg.addColorStop(0, '#07111f'); bg.addColorStop(1, '#111827')
ax.fillStyle = bg; ax.fillRect(0, 0, W, H)
ax.strokeStyle = '#38475a'; ax.lineWidth = 4
for (const bulb of bulbs) {
  const x = bulb.x * W, y = bulb.y * H
  ax.beginPath(); ax.moveTo(x, 0); ax.bezierCurveTo(x - 8, bulb.rope * H, x + 7, y - 42, x, y - 26); ax.stroke()
  ax.fillStyle = '#202b38'; ax.fillRect(x - 10, y - 31, 20, 15)
  ax.beginPath(); ax.ellipse(x, y, 18, 23, 0, 0, Math.PI * 2)
  const glass = ax.createRadialGradient(x - 6, y - 8, 2, x, y, 24)
  glass.addColorStop(0, '#fffce5'); glass.addColorStop(.35, '#ffd66b'); glass.addColorStop(1, '#a95b13')
  ax.fillStyle = glass; ax.fill()
  ax.strokeStyle = '#ffeba5'; ax.lineWidth = 2; ax.stroke()
}
ax.fillStyle = '#8fa4ba'; ax.font = '600 17px sans-serif'; ax.textAlign = 'center'
ax.fillText('FIVE-LIGHT EFFECT MASK TEST', W / 2, H - 22)
fs.writeFileSync(fixture, art.toBuffer('image/png'))

const call = async (tool, params = {}) => {
  const result = await registry.call(tool, params)
  if (!result.ok) throw new Error(`${tool}: ${JSON.stringify(result.data)}`)
  return result.data
}
const proofPath = (name) => path.relative(root, path.join(outDir, name))

await call('project_new', { w: W, h: H, fps: 24, duration: 4, bg: '#07111f' })
const imported = await call('import_media', { path: path.relative(root, fixture), fit: 'cover' })
const nested = await call('compound_clip_create', { ids: [imported.clipId], name: 'Five Hanging Bulbs — Compound', nest: true })
await call('select', { clipId: nested.id })

const baseline = renderFrame(SESSION.seq, 2)
fs.writeFileSync(path.join(outDir, 'before-effects.png'), baseline.toBuffer('image/png'))
const baselinePixels = baseline.getContext('2d').getImageData(0, 0, W, H).data

const regions = bulbs.map((bulb, index) => ({
  id: `bulb-${index + 1}`, shape: 'circle', centerX: bulb.x, centerY: bulb.y,
  width: .125, height: .125, rotation: 0, feather: 18, opacity: 1,
}))
await call('edit_element', { clipId: nested.id, patch: { adjustmentMask: {
  enabled: true, inverted: false, shape: 'ellipse', centerX: .5, centerY: .5,
  width: .2, height: .2, feather: 18, regions,
} } })
const fx = await call('fx_add', {
  clipId: nested.id, catalogId: 'glow-2', duration: 4,
  params: { glow: .15, blur: 0 },
  keys: { glow: [[0, .15], [2, 2.2], [4, .35]], blur: [[0, 0], [2, 7], [4, 1]] },
})
assert.equal(fx.duration, 4)

for (const [time, name] of [[.15, 'glow-low.png'], [2, 'glow-peak.png'], [3.85, 'glow-falloff.png']]) {
  await call('snapshot', { time, out: proofPath(name) })
}
await call('timeline_screenshot', { out: proofPath('five-bulb-timeline.png'), playhead: 2 })

const peak = renderFrame(SESSION.seq, 2)
const peakPixels = peak.getContext('2d').getImageData(0, 0, W, H).data
const rgbDelta = (x, y) => {
  const i = (Math.round(y) * W + Math.round(x)) * 4
  return Math.abs(peakPixels[i] - baselinePixels[i]) + Math.abs(peakPixels[i + 1] - baselinePixels[i + 1]) + Math.abs(peakPixels[i + 2] - baselinePixels[i + 2])
}
const bulbDeltas = bulbs.map((bulb) => rgbDelta(bulb.x * W, bulb.y * H))
assert.ok(bulbDeltas.every((delta) => delta > 12), `each bulb must change through its circle: ${bulbDeltas}`)
const outside = [[20, 30], [W / 2, 40], [W - 20, 30], [W / 2, H - 25]]
const outsideDeltas = outside.map(([x, y]) => rgbDelta(x, y))
assert.ok(outsideDeltas.every((delta) => delta === 0), `pixels outside the five masks changed: ${outsideDeltas}`)

await call('render_export', { out: proofPath('five-bulb-effect-mask.mp4'), fps: 24, duration: 4 })
const manifest = {
  fixture: path.relative(root, fixture), compoundClipId: nested.id, fxId: fx.fxId,
  effect: 'Glow + Gaussian blur', effectPropertyKeyframes: { glow: 3, blur: 3 },
  maskRegions: regions, bulbCenterRgbDeltasAtPeak: bulbDeltas,
  outsideRgbDeltasAtPeak: outsideDeltas,
  proofVideo: 'five-bulb-effect-mask.mp4',
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`PASS five-bulb compound effect mask; inside deltas=${bulbDeltas.join(',')} outside=${outsideDeltas.join(',')}`)
