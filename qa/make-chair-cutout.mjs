/**
 * Produces a proper chair cutout from the opaque source photo.
 *
 * obj_chair.png is a fully opaque photo, while its neighbours obj_towel.png
 * and obj_curtain.png are cutouts with alpha. That is why the chair was never
 * usable as a scene object: drawing it would paint an opaque rectangle over
 * everything behind it.
 *
 * This runs the app's own guidedRectMatting over the source and writes the
 * result back. The original photo is kept alongside it so nothing is lost.
 *
 * Usage: node qa/make-chair-cutout.mjs   (needs the dev server on :5173)
 */

import fs from 'node:fs'
import path from 'node:path'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'

const BASE = process.env.TEST_URL || 'http://localhost:5173'
const OUT = 'public/assets/room/obj_chair.png'
const KEEP_ORIGINAL = 'public/assets/room/obj_chair_photo.png'

try {
  await inflate(path.join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) { /* already inflated */ }

// Best of the candidates swept by chair-cutout-probe.mjs: background fully
// removed at the edges, chair essentially intact in the middle.
const RECT = { x: 0.10, y: 0.10, width: 0.80, height: 0.80 }
const HINT = { x: 0.5, y: 0.55, radius: 0.12 }

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
page.on('pageerror', () => {})
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const result = await page.evaluate(async ({ rect, hint }) => {
  const mod = await import('/src/lib/guidedMatting.ts')
  const load = (url) => new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('load failed ' + url))
    i.src = url
  })
  const src = await load('/assets/room/obj_chair.png')
  const r = await mod.guidedRectMatting({
    source: src,
    sourceWidth: src.naturalWidth,
    sourceHeight: src.naturalHeight,
    rect,
    hint,
  })

  // Measure the matte so the result is verified before anything is written.
  const cut = await load(r.cutoutDataUrl)
  const c = document.createElement('canvas')
  c.width = cut.naturalWidth; c.height = cut.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(cut, 0, 0)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const W = c.width, H = c.height
  let sum = 0, n = 0, edgeSum = 0, edgeN = 0, ctrSum = 0, ctrN = 0
  const band = Math.max(2, Math.round(Math.min(W, H) * 0.03))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = d[(y * W + x) * 4 + 3]
      sum += a; n++
      if (x < band || y < band || x >= W - band || y >= H - band) { edgeSum += a; edgeN++ }
      if (Math.abs(x - W / 2) < W * 0.18 && Math.abs(y - H / 2) < H * 0.18) { ctrSum += a; ctrN++ }
    }
  }
  return {
    dataUrl: r.cutoutDataUrl,
    width: r.width, height: r.height,
    coverage: +r.coverage.toFixed(3),
    confidence: +r.confidence.toFixed(3),
    alphaMean: +(sum / n / 255).toFixed(3),
    edgeAlpha: +(edgeSum / edgeN / 255).toFixed(3),
    centreAlpha: +(ctrSum / ctrN / 255).toFixed(3),
  }
}, { rect: RECT, hint: HINT })

await browser.close()

console.log('=== chair cutout ===')
console.log(`  size         ${result.width}x${result.height}`)
console.log(`  coverage     ${result.coverage}`)
console.log(`  confidence   ${result.confidence}`)
console.log(`  alphaMean    ${result.alphaMean}`)
console.log(`  edgeAlpha    ${result.edgeAlpha}   (want ~0: background removed)`)
console.log(`  centreAlpha  ${result.centreAlpha}   (want ~1: chair retained)`)

// Refuse to overwrite unless the matte is genuinely a cutout.
const usable = result.edgeAlpha < 0.2 && result.centreAlpha > 0.75 && result.alphaMean > 0.1 && result.alphaMean < 0.9
if (!usable) {
  console.error('\nREFUSED: matte failed the cutout check, nothing written.')
  process.exit(1)
}

const b64 = result.dataUrl.slice(result.dataUrl.indexOf(',') + 1)
const buf = Buffer.from(b64, 'base64')

// Keep the untouched photo before overwriting the object asset.
if (!fs.existsSync(KEEP_ORIGINAL)) {
  fs.copyFileSync(OUT, KEEP_ORIGINAL)
  console.log(`\n  original photo preserved as ${KEEP_ORIGINAL}`)
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, buf)
console.log(`  wrote ${OUT} (${(buf.length / 1024).toFixed(0)} KB)`)
