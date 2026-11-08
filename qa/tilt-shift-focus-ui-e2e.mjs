import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'qa-output/tilt-shift-focus')
fs.mkdirSync(out, { recursive: true })
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], past: [], future: [], selectedClipId: null, selectedClipIds: [] })
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
    const context = canvas.getContext('2d')
    context.fillStyle = '#07111f'; context.fillRect(0, 0, 640, 360)
    for (let y = 0; y < 360; y += 20) for (let x = 0; x < 640; x += 20) {
      context.fillStyle = (x / 20 + y / 20) % 2 ? '#e9f3ff' : '#17304e'
      context.fillRect(x, y, 20, 20)
    }
    context.fillStyle = '#ff5d4c'; context.fillRect(62, 132, 516, 96)
    context.fillStyle = '#fff'; context.font = 'bold 54px sans-serif'; context.fillText('FOCUS PLANE', 135, 197)
    store.getState().addAsset({ id: 'focus-source', kind: 'image', name: 'Focus plane source', url: canvas.toDataURL(), duration: 5, width: 640, height: 360, size: 1000 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'focus-source', 0)
    store.getState().setPlayhead(1)
    store.getState().setLeftTab('effects')
    store.getState().setLeftOpen(true)
    store.getState().setRightOpen(true)
  })

  await page.getByTestId('fx-catalog-browser').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('[data-testid="fx-catalog-count"]')?.textContent?.includes('155,048'), null, { timeout: 15_000 })
  await page.getByTestId('fx-cat-blur').click()
  await page.getByTestId('fx-catalog-search').fill('Diagonal Focus Center Narrow')
  await page.getByTestId('fx-tile-tilt-focus-diagonal-center-narrow').click()
  const item = page.locator('[data-testid^="fxstack-item-"]').first()
  await item.waitFor({ state: 'visible' })
  const toggle = item.locator('[data-testid^="fxstack-toggleopen-"]')
  if (!(await item.locator('[data-testid^="fxstack-actions-"]').isVisible())) await toggle.click()

  const applied = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances.at(-1))
  assert.equal(applied.catalogId, 'tilt-focus-diagonal-center-narrow')
  assert.equal(applied.params.tiltShiftAngle, 35)
  const controls = ['tiltShift', 'tiltShiftCenterX', 'tiltShiftCenterY', 'tiltShiftAngle', 'tiltShiftWidth', 'tiltShiftFeather']
  for (const key of controls) await item.locator(`[data-testid$="-${key}"]`).first().waitFor({ state: 'visible' })

  const angleInput = item.locator('[data-testid$="-tiltShiftAngle"] input').first()
  await angleInput.fill('-28')
  await angleInput.press('Enter')
  await item.locator('[data-testid*="fxstack-key-"][data-testid$="-tiltShiftAngle"]').click()
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2.4))
  const yInput = item.locator('[data-testid$="-tiltShiftCenterY"] input').first()
  await yInput.fill('0.68')
  await yInput.press('Enter')
  await item.locator('[data-testid*="fxstack-key-"][data-testid$="-tiltShiftCenterY"]').click()

  const stored = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances[0])
  assert.equal(stored.params.tiltShiftAngle, -28)
  assert.equal(stored.params.tiltShiftCenterY, .68)
  assert.equal(stored.keys.tiltShiftAngle.length, 1)
  assert.equal(stored.keys.tiltShiftCenterY.length, 1)
  await item.locator('[data-testid^="fxstack-region-"]').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].adjustmentMask.regions[0].shape), 'ellipse')
  await page.getByTestId('effect-mask-controls').waitFor({ state: 'visible' })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(out, 'tilt-shift-controls-mask.png'), fullPage: true })

  assert.deepEqual(errors, [])
  const report = { catalogId: applied.catalogId, controls, angle: stored.params.tiltShiftAngle, centerY: stored.params.tiltShiftCenterY, keyframes: { angle: 1, centerY: 1 }, region: 'ellipse', errors }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log('tilt-shift-focus-ui-e2e: search, apply, six controls, angle/position keys and effect mask PASS')
} finally {
  await browser.close()
}
