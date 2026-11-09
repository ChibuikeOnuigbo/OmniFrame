import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { actionPhase, applyAuraFx, applyBurstFx, BURST_FAMILIES } from '../src/lib/actionFx.ts'
import { loadAppTs } from '../tools/mcp/appRender.mjs'

globalThis.document = { createElement: (tag) => {
  if (tag !== 'canvas') throw new Error(`Unsupported test element: ${tag}`)
  return createCanvas(1, 1)
} }

const atQuarter = actionPhase(0.25, 1, 2, 0.5, true)
assert.equal(atQuarter.phase, 0.5)
assert.equal(atQuarter.resting, false)
const inGap = actionPhase(0.65, 1, 2, 0.5, true)
assert.equal(inGap.phase, 1)
assert.equal(inGap.resting, true)
assert.equal(actionPhase(1.05, 1, 2, 0.5, true).cycleIndex, 1)

const { getFxCatalog, paramsForPatch } = await loadAppTs('src/lib/effectCatalog.ts')
const { sanitizeEffect } = await loadAppTs('src/lib/customEffects.ts')
const catalog = getFxCatalog()
const burstEntries = catalog.filter((entry) => entry.cat === 'burst')
assert.equal(burstEntries.length, 50, '10 burst families × 5 tiers')
assert.equal(new Set(burstEntries.map((entry) => entry.id)).size, 50, 'unique burst ids')
for (const family of BURST_FAMILIES) assert.equal(burstEntries.filter((entry) => entry.patch.burstFx === family).length, 5, `${family} tiers`)
assert.ok(burstEntries.every((entry) => paramsForPatch(entry.patch).length >= 12), 'burst controls are exposed')
assert.ok(catalog.filter((entry) => entry.id.startsWith('aura-')).length >= 8, 'aura presets')
assert.ok(catalog.filter((entry) => entry.id.startsWith('liquify-')).length >= 8, 'liquify presets')
assert.ok(catalog.filter((entry) => entry.id.startsWith('turb-pro-')).length >= 6, 'turbulence presets')
const sanitized = sanitizeEffect({ burstFx: 'shatter', burstIntensity: 4, burstColor: '#abcdef', aura: .8, auraColor: '#123456', turbulentMode: 'curl', liquifyMode: 'twirl' })
assert.deepEqual({ burstFx: sanitized.burstFx, burstIntensity: sanitized.burstIntensity, burstColor: sanitized.burstColor, aura: sanitized.aura, auraColor: sanitized.auraColor, turbulentMode: sanitized.turbulentMode, liquifyMode: sanitized.liquifyMode }, { burstFx: 'shatter', burstIntensity: 1, burstColor: '#abcdef', aura: .8, auraColor: '#123456', turbulentMode: 'curl', liquifyMode: 'twirl' })

const width = 256, height = 144
function sourceCanvas() {
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#112d5f'); gradient.addColorStop(0.48, '#e8437a'); gradient.addColorStop(1, '#ffd45e')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OMNI', width / 2, height / 2 + 12)
  ctx.strokeStyle = '#67f8ff'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, width - 28, height - 28)
  return canvas
}
const baseline = sourceCanvas().toBuffer('image/png')
const signatures = new Set()
const sheet = createCanvas(width * 5, height * 2), sx = sheet.getContext('2d')
for (const [index, family] of BURST_FAMILIES.entries()) {
  const canvas = sourceCanvas()
  applyBurstFx(canvas, {
    burstFx: family, burstIntensity: 0.85, burstSpeed: 1, burstInterval: 0.35, burstCycle: 1,
    burstLoop: 0, burstOriginX: 0.5, burstOriginY: 0.5, burstSpread: 0.82, burstFragments: 32,
    burstGravity: family === 'smoke' ? -0.2 : 0.22, burstRotation: 220, burstColor: family === 'fireball' ? '#ff8b2c' : '#8eeaff', burstSeed: 700 + index,
    motionClock: 0.48,
  }, 0.48)
  const png = canvas.toBuffer('image/png')
  assert.notDeepEqual(png, baseline, `${family} changes pixels`)
  signatures.add(png.subarray(-96).toString('hex'))
  sx.drawImage(canvas, (index % 5) * width, Math.floor(index / 5) * height)
  sx.fillStyle = 'rgba(0,0,0,.72)'; sx.fillRect((index % 5) * width, Math.floor(index / 5) * height, 94, 20)
  sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.textAlign = 'left'; sx.fillText(family, (index % 5) * width + 6, Math.floor(index / 5) * height + 14)
}
assert.ok(signatures.size >= 8, `family render diversity (${signatures.size})`)

const aura = sourceCanvas()
applyAuraFx(aura, { aura: 0.9, auraThreshold: 0.42, auraRadius: 30, auraLines: 28, auraSpeed: 1.2, auraColor: '#22d3ee', auraSecondary: '#e935c1' }, 0.75)
assert.notDeepEqual(aura.toBuffer('image/png'), baseline, 'aura changes pixels')

mkdirSync('qa/artifacts', { recursive: true })
writeFileSync('qa/artifacts/burst-fx-contact-sheet.png', sheet.toBuffer('image/png'))
console.log(`PASS 50 burst presets, ${signatures.size} family signatures, aura/liquify/turbulence catalog coverage and cycle timing`)
