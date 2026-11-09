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
const out = path.join(root, 'qa-output/action-fx')
fs.mkdirSync(out, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], past: [], future: [] })
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270
    const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 480, 270)
    gradient.addColorStop(0, '#112d5f'); gradient.addColorStop(.5, '#e8437a'); gradient.addColorStop(1, '#ffd45e')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 480, 270); ctx.fillStyle = 'white'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('OMNI', 145, 155)
    store.getState().addAsset({ id: 'burst-source', kind: 'image', name: 'Burst source', url: canvas.toDataURL(), duration: 5, width: 480, height: 270, size: 1000 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'burst-source', 0)
    store.getState().setPlayhead(.48); store.getState().setLeftTab('effects'); store.getState().setLeftOpen(true); store.getState().setRightOpen(true)
  })
  await page.getByTestId('fx-catalog-browser').waitFor({ state: 'visible' })
  await page.getByTestId('fx-cat-burst').click()
  assert.match(await page.getByTestId('fx-catalog-count').textContent(), /^50\//)
  await page.getByTestId('fx-catalog-search').fill('Glass Classic')
  await page.getByTestId('fx-tile-burst-glass-classic').click()
  await page.locator('[data-testid^="fxstack-item-"]').first().waitFor({ state: 'visible' })
  const applied = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances.at(-1))
  assert.equal(applied.catalogId, 'burst-glass-classic')
  assert.equal(applied.params.burstLoop, 1)
  const item = page.locator('[data-testid^="fxstack-item-"]').first()
  const toggle = item.locator('[data-testid^="fxstack-toggleopen-"]')
  if (!(await item.locator('[data-testid^="fxstack-actions-"]').isVisible())) await toggle.click()
  const fit = item.locator('[data-testid^="fxstack-fit-cycle-"]')
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState(), clip = s.clips[0], fx = clip.fxInstances[0]
    s.updateFxParams(clip.id, fx.id, { burstCycle: 1, burstSpeed: 2 })
  })
  await fit.click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances[0].duration), .5)
  await item.locator('[data-testid^="fxstack-region-"]').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].adjustmentMask.regions[0].shape), 'ellipse')
  await page.getByTestId('effect-mask-controls').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(out, 'burst-catalog-stack-mask.png'), fullPage: true })

  await page.getByTestId('left-tab-threed').click()
  await page.getByTestId('open-3d-asset-library').click()
  const modal = page.getByTestId('asset-library-modal')
  await modal.waitFor({ state: 'visible' })
  assert.doesNotMatch(await modal.textContent(), /CC0/i, 'license jargon is kept out of browsing cards')
  await page.screenshot({ path: path.join(out, 'asset-library-clean.png') })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ burstCatalogCount: 50, applied: applied.catalogId, fitDuration: .5, effectRegion: 'ellipse', cc0BrowseLabels: false, errors }, null, 2))
  console.log('PASS burst catalog UI, apply, fit cycle, effect region and clean asset browsing')
} finally {
  await browser.close()
}
