/**
 * Verifies the recolor engine actually works on the chair image.
 *
 * Context: recolorActiveSelection used to swap in one of five pre-baked PNGs
 * matched by colour name, which silently did nothing for any other colour and
 * produced flat composites that destroyed the object's shading. It now calls
 * recolorImage(), which computes the recolour from the object's own cutout and
 * preserves its lightness structure.
 *
 * This checks that promise on obj_chair.png: the hue must move to the target
 * while the luminance structure (how light and dark the folds are, and how
 * widely they spread) survives. A flat fill would collapse the spread.
 *
 * Usage: node qa/recolor-chair-e2e.mjs   (needs the dev server on :5173)
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
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))

const results = []
const ok = (n, c, d = '') => { results.push([n, !!c]); console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

// Run the real engine against the real chair image, inside the browser so it
// has a canvas, then measure both images.
const measured = await page.evaluate(async () => {
  const mod = await import('/src/lib/recolor.ts')
  const recolorImage = mod.recolorImage
  if (typeof recolorImage !== 'function') return { error: 'recolorImage not exported' }

  const load = (url) => new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('load failed ' + url))
    i.src = url
  })

  const stats = (img) => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    // Luminance histogram over pixels that carry any signal.
    const lum = []
    let rs = 0, gs = 0, bs = 0, n = 0
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3]
      if (a < 8) continue
      const r = d[i], g = d[i + 1], b = d[i + 2]
      lum.push(0.299 * r + 0.587 * g + 0.114 * b)
      rs += r; gs += g; bs += b; n++
    }
    lum.sort((x, y) => x - y)
    const mean = lum.reduce((s, v) => s + v, 0) / lum.length
    const sd = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / lum.length)
    const p = (q) => lum[Math.floor(q * (lum.length - 1))]
    return {
      meanRGB: [rs / n, gs / n, bs / n].map((v) => Math.round(v)),
      lumMean: +mean.toFixed(2),
      lumSD: +sd.toFixed(2),
      p5: Math.round(p(0.05)), p95: Math.round(p(0.95)),
      px: n,
    }
  }

  const src = await load('/assets/room/obj_chair.png')
  const before = stats(src)

  const { dataUrl } = await recolorImage('/assets/room/obj_chair.png', { color: '#2563eb', blend: 'dye' })
  if (!dataUrl) return { error: 'no dataUrl returned', before }
  const out = await load(dataUrl)
  const after = stats(out)

  return { before, after }
})

if (measured.error) {
  ok('recolor engine runs on the chair image', false, JSON.stringify(measured.error))
} else {
  const { before, after } = measured
  console.log('  before:', JSON.stringify(before))
  console.log('  after :', JSON.stringify(after))

  ok('recolor produced an image', !!after && after.px > 0)

  // Hue must actually move toward the requested blue.
  const [br, bg2, bb] = before.meanRGB
  const [ar, ag, ab] = after.meanRGB
  ok('hue moves to the target colour (blue channel now dominant)',
     ab > ar && ab > ag, `before rgb(${br},${bg2},${bb}) -> after rgb(${ar},${ag},${ab})`)

  // The whole point of the rewrite: shading must survive. A flat fill
  // collapses both the standard deviation and the p5..p95 spread.
  const sdKept = before.lumSD > 0 ? after.lumSD / before.lumSD : 0
  ok('luminance spread preserved (not flattened)', sdKept > 0.6,
     `SD ${before.lumSD} -> ${after.lumSD} (${Math.round(sdKept * 100)}% kept)`)

  const spreadBefore = before.p95 - before.p5
  const spreadAfter = after.p95 - after.p5
  ok('p5..p95 range preserved', spreadAfter > spreadBefore * 0.6,
     `${before.p5}..${before.p95} -> ${after.p5}..${after.p95}`)

  ok('overall brightness not crushed', after.lumMean > before.lumMean * 0.35,
     `mean ${before.lumMean} -> ${after.lumMean}`)
}

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' / '))

await browser.close()
const failed = results.filter((r) => !r[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
