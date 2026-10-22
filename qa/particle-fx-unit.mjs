/**
 * Headless unit QA for particle / overlay / background-bed layers
 * (src/lib/particleFx.ts). Transforms with sucrase and drives every kind
 * through the real draw functions with a recording stub canvas.
 *
 * Run: node qa/particle-fx-unit.mjs
 */
import { transform } from 'sucrase'
import { readFileSync, writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'src/lib/particleFx.ts'), 'utf8')
const { code } = transform(src, { transforms: ['typescript'] })
const dir = mkdtempSync(join(tmpdir(), 'pfx-'))
const file = join(dir, 'particleFx.mjs')
writeFileSync(file, code)
const mod = await import(file)
const { drawParticleFx, drawOverlayFx, drawReplaceBg, applyClipFxLayers, PARTICLE_KINDS, OVERLAY_KINDS, REPLACE_BG_KINDS } = mod

function stubCtx(log) {
  const gradient = { addColorStop: () => log.push(['stop']) }
  const target = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 1, shadowColor: '', shadowBlur: 0, filter: 'none' }
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k]
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => (log.push([k]), gradient)
      return (...a) => log.push([k, ...a.map((x) => (typeof x === 'object' ? '[obj]' : x))])
    },
    set(t, k, v) { t[k] = v; return true },
  })
}

let failures = 0
const times = [0, 0.4, 1.25, 2.7]
for (const kind of PARTICLE_KINDS) {
  for (const t of times) {
    const log = []
    drawParticleFx(stubCtx(log), 1280, 720, t, kind, 0.6, '#ffffff')
    const ops = log.length
    if (kind === 'none' ? ops !== 0 : ops < 10) { failures++; console.error(`FAIL particle ${kind} t=${t}: ops=${ops}`) }
  }
  console.log(`ok particles:${kind}`)
}
for (const kind of OVERLAY_KINDS) {
  for (const t of times) {
    const log = []
    drawOverlayFx(stubCtx(log), 1280, 720, t, kind, 0.6)
    const ops = log.length
    if (kind === 'none' ? ops !== 0 : ops < 2) { failures++; console.error(`FAIL overlay ${kind} t=${t}: ops=${ops}`) }
  }
  console.log(`ok overlay:${kind}`)
}
for (const kind of REPLACE_BG_KINDS) {
  const log = []
  drawReplaceBg(stubCtx(log), 1280, 720, 1.5, kind)
  const ops = log.length
  if (kind === 'none' ? ops !== 0 : ops < 4) { failures++; console.error(`FAIL bg ${kind}: ops=${ops}`) }
  console.log(`ok replaceBg:${kind}`)
}
// combined entry point on a stub canvas (replaceBg compositing needs a real
// DOM canvas; headless it must skip cleanly and still draw overlay+particles)
const log = []
const canvas = { width: 640, height: 360, getContext: () => stubCtx(log) }
applyClipFxLayers(canvas, { particleFx: 'feathers', particleDensity: 0.6, overlayFx: 'scanlines', overlayStrength: 0.5, replaceBg: 'synthwave' }, 1.2)
if (log.length < 20) { failures++; console.error(`FAIL applyClipFxLayers: ops=${log.length}`) }
if (failures) { console.error(`${failures} failures`); process.exit(1) }
console.log('PARTICLE FX UNIT QA: PASS')
