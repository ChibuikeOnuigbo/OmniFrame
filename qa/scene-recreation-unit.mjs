/**
 * Headless unit QA for the Scene-recreation pillar (no browser needed).
 *
 * Transforms src/lib/pillarRenderers.ts with sucrase and drives every scene
 * style (relight / crt / magna / line / rim / mosaic) through
 * drawPillarFamily('scene', …) at p = 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1 with a
 * recording stub canvas. Asserts: no exceptions, real draw activity per
 * style, and the constant-look pass (vignette gradient + grain dots) ran.
 *
 * Run: node qa/scene-recreation-unit.mjs
 */
import { transform } from 'sucrase'
import { mkdtempSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const dir = mkdtempSync(join(tmpdir(), 'scene-qa-'))
const src = readFileSync(join(process.cwd(), 'src/lib/pillarRenderers.ts'), 'utf8')
const { code } = transform(src, { transforms: ['typescript'] })
// pillarRenderers imports ./particleFx — ship it alongside with a .mjs specifier
const pfSrc = readFileSync(join(process.cwd(), 'src/lib/particleFx.ts'), 'utf8')
const pf = transform(pfSrc, { transforms: ['typescript'] })
writeFileSync(join(dir, 'particleFx.mjs'), pf.code)
const bundle = join(dir, 'pillarRenderers.mjs')
writeFileSync(bundle, code.replace(/from '\.\/particleFx'/g, "from './particleFx.mjs'"))
const { drawPillarFamily } = await import(bundle)

function stubCtx(log) {
  const gradient = { addColorStop: (o, c) => log.push(['stop', o, c]) }
  const target = {
    canvas: null, globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', shadowColor: '', shadowBlur: 0,
    filter: 'none', imageSmoothingEnabled: true,
  }
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k]
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a) => (log.push([k, ...a]), gradient)
      return (...a) => { log.push([k, ...a.map((x) => (typeof x === 'object' ? '[obj]' : x))]) }
    },
    set(t, k, v) { t[k] = v; return true },
  })
}

const styles = ['relight', 'crt', 'magna', 'line', 'rim', 'mosaic', 'roto', 'tv', 'slit', 'fisheye', 'spotlight', 'arc', 'cloud', 'compare', 'xslash', 'wall', 'cutout', 'spheres', 'quote', 'mono', 'drift', 'flare', 'wedge', 'card', 'goldcard', 'wire', 'dualtypo']
const ps = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
let failures = 0
for (const style of styles) {
  for (const p of ps) {
    const log = []
    const ctx = stubCtx(log)
    const scratch = { width: 0, height: 0, getContext: () => stubCtx(log) }
    const args = {
      ctx, width: 1280, height: 720, p, params: { style },
      drawFrom: (c) => log.push(['drawFrom', c === ctx ? 'main' : 'scratch']),
      drawTo: (c) => log.push(['drawTo', c === ctx ? 'main' : 'scratch']),
      hasFrom: true, hasTo: true,
      takeScratch: () => scratch,
      releaseScratch: () => {},
    }
    try {
      drawPillarFamily('scene', args)
    } catch (e) {
      failures++
      console.error(`FAIL ${style} p=${p}: ${e.message}`)
      continue
    }
    const ops = log.map((l) => l[0])
    const drew = ops.includes('drawFrom') || ops.includes('drawTo')
    const vignette = ops.includes('createRadialGradient')
    const grain = ops.filter((o) => o === 'fillRect').length > 50
    // intentional field-only beats: roto hero polygon draws alone on black
    // (p<0.4), TV static burst opens the cut (p<0.12) — verify those directly
    const fillRects = ops.filter((o) => o === 'fillRect').length
    const fieldBeat =
      (style === 'roto' && p < 0.4 && ops.includes('setLineDash') && ops.includes('stroke')) ||
      (style === 'tv' && p < 0.12 && fillRects >= 300)
    if ((!drew && !fieldBeat) || !vignette || !grain) {
      failures++
      console.error(`FAIL ${style} p=${p}: drew=${drew} fieldBeat=${fieldBeat} vignette=${vignette} grain=${grain}`)
    }
  }
  console.log(`ok scene:${style} (${ps.length} progress samples, constant look verified)`)
}
if (failures) { console.error(`${failures} failures`); process.exit(1) }
console.log(`SCENE RECREATION UNIT QA: PASS (${styles.length} styles x 7 progress samples)`)
