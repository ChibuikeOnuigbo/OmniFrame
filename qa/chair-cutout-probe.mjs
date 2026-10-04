/**
 * Probes guidedRectMatting for a usable chair cutout.
 *
 * obj_chair.png is fully opaque, unlike the towel and curtain cutouts, so it
 * cannot be dropped into the scene as an object. This finds whether the app's
 * own matting engine can separate the chair from its background.
 *
 * Quality is judged without looking at the image, by measuring the alpha the
 * engine produces:
 *   - edge alpha  -> should collapse toward 0 (background removed)
 *   - centre alpha -> should stay high (chair retained)
 * A result that is all-opaque removed nothing; all-transparent kept nothing.
 *
 * Usage: node qa/chair-cutout-probe.mjs   (needs the dev server on :5173)
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'

const BASE = process.env.TEST_URL || 'http://localhost:5173'
try {
  await inflate(path.join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) { /* already inflated */ }

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
page.on('pageerror', () => {})
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const candidates = [
  { name: 'wide', rect: { x: 0.04, y: 0.04, width: 0.92, height: 0.92 } },
  { name: 'inset', rect: { x: 0.10, y: 0.10, width: 0.80, height: 0.80 } },
  { name: 'tight', rect: { x: 0.16, y: 0.14, width: 0.68, height: 0.72 } },
  { name: 'centre-hint', rect: { x: 0.10, y: 0.10, width: 0.80, height: 0.80 }, hint: { x: 0.5, y: 0.55, radius: 0.12 } },
  { name: 'lower-hint', rect: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }, hint: { x: 0.5, y: 0.7, radius: 0.10 } },
]

const out = await page.evaluate(async (cands) => {
  const mod = await import('/src/lib/guidedMatting.ts')
  const fn = mod.guidedRectMatting
  if (typeof fn !== 'function') return [{ error: 'guidedRectMatting not exported' }]

  const load = (url) => new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('load failed'))
    i.src = url
  })

  const alphaStats = (img) => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const W = c.width, H = c.height
    let sum = 0, n = 0, edgeSum = 0, edgeN = 0, ctrSum = 0, ctrN = 0
    const band = Math.max(2, Math.round(Math.min(W, H) * 0.03))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = d[(y * W + x) * 4 + 3]
        sum += a; n++
        const onEdge = x < band || y < band || x >= W - band || y >= H - band
        if (onEdge) { edgeSum += a; edgeN++ }
        const inCtr = Math.abs(x - W / 2) < W * 0.18 && Math.abs(y - H / 2) < H * 0.18
        if (inCtr) { ctrSum += a; ctrN++ }
      }
    }
    return {
      alphaMean: +(sum / n / 255).toFixed(3),
      edgeAlpha: +(edgeSum / edgeN / 255).toFixed(3),
      centreAlpha: +(ctrSum / ctrN / 255).toFixed(3),
    }
  }

  const src = await load('/assets/room/obj_chair.png')
  const res = []
  for (const c of cands) {
    try {
      const r = await fn({
        source: src,
        sourceWidth: src.naturalWidth,
        sourceHeight: src.naturalHeight,
        rect: c.rect,
        hint: c.hint,
      })
      const cut = await load(r.cutoutDataUrl)
      res.push({
        name: c.name,
        coverage: +r.coverage.toFixed(3),
        confidence: +r.confidence.toFixed(3),
        ...alphaStats(cut),
      })
    } catch (e) {
      res.push({ name: c.name, error: String(e).slice(0, 90) })
    }
  }
  return res
}, candidates)

console.log('=== chair cutout probe ===')
console.log('  want: edgeAlpha low (bg removed), centreAlpha high (chair kept)\n')
for (const r of out) {
  if (r.error) { console.log(`  ${r.name}: ERROR ${r.error}`); continue }
  const good = r.edgeAlpha < 0.35 && r.centreAlpha > 0.6
  console.log(
    `  ${good ? '✓' : '·'} ${r.name.padEnd(12)} coverage=${String(r.coverage).padEnd(6)} conf=${String(r.confidence).padEnd(6)} ` +
    `edgeAlpha=${String(r.edgeAlpha).padEnd(6)} centreAlpha=${String(r.centreAlpha).padEnd(6)} alphaMean=${r.alphaMean}`,
  )
}

await browser.close()
