import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
const out = path.join(root, 'qa-output/lens-bokeh')
fs.mkdirSync(out, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], past: [], future: [] })
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
    const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 640, 360)
    gradient.addColorStop(0, '#040816'); gradient.addColorStop(.55, '#123351'); gradient.addColorStop(1, '#4a1d45')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 360)
    const lights = [[80,72,16,'#fff0a0'],[190,105,12,'#6ee7ff'],[310,68,18,'#ff79c6'],[465,112,15,'#fff'],[565,70,16,'#ffc55c'],[130,260,18,'#72f4c2'],[290,238,14,'#fff'],[470,270,20,'#91aaff']]
    for (const [x,y,r,color] of lights) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill() }
    ctx.fillStyle = '#9b5d2b'; ctx.fillRect(0, 318, 640, 42)
    store.getState().addAsset({ id: 'bokeh-source', kind: 'image', name: 'Night practicals', url: canvas.toDataURL(), duration: 5, width: 640, height: 360, size: 1000 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'bokeh-source', 0)
    store.getState().setPlayhead(.8); store.getState().setLeftTab('effects'); store.getState().setLeftOpen(true); store.getState().setRightOpen(true)
  })
  await page.getByTestId('fx-catalog-browser').waitFor({ state: 'visible' })
  await page.getByTestId('fx-cat-blur').click()
  await page.getByTestId('fx-catalog-search').fill('Lens Bokeh Hex Night')
  await page.getByTestId('fx-tile-bokeh-lens-5').click()
  const item = page.locator('[data-testid^="fxstack-item-"]').first()
  await item.waitFor({ state: 'visible' })
  const toggle = item.locator('[data-testid^="fxstack-toggleopen-"]')
  if (!(await item.locator('[data-testid^="fxstack-actions-"]').isVisible())) await toggle.click()
  const applied = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances.at(-1))
  assert.equal(applied.catalogId, 'bokeh-lens-5')
  assert.equal(applied.params.bokehShape, 'hexagon')

  const shape = item.locator('[data-testid$="-bokehShape"]')
  await shape.selectOption('star')
  const amountKey = item.locator('[data-testid*="fxstack-key-"][data-testid$="-lensBokeh"]')
  await amountKey.click()
  const stored = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances[0])
  assert.equal(stored.params.bokehShape, 'star')
  assert.equal(stored.keys.lensBokeh.length, 1, 'lens amount is keyframeable')
  for (const key of ['lensBokeh', 'bokehRadius', 'bokehThreshold', 'bokehGain', 'bokehRotation', 'bokehSoftness']) {
    await item.locator(`[data-testid$="-${key}"]`).first().waitFor({ state: 'visible' })
  }
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(out, 'lens-bokeh-controls.png'), fullPage: true })
  await item.locator('[data-testid^="fxstack-region-"]').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].adjustmentMask.regions[0].shape), 'ellipse')
  await page.getByTestId('effect-mask-controls').waitFor({ state: 'visible' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(out, 'lens-bokeh-controls-mask.png'), fullPage: true })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ catalogId: applied.catalogId, shape: stored.params.bokehShape, keyframes: stored.keys.lensBokeh.length, region: 'ellipse', errors }, null, 2))
  console.log('lens-bokeh-ui-e2e: search, apply, aperture controls, keyframe and effect mask PASS')
} finally {
  await browser.close()
}
