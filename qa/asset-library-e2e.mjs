import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'qa-output', 'asset-library')
fs.mkdirSync(out, { recursive: true })
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(String(error)))
  await page.route('https://api.polyhaven.com/assets?t=models', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      studio_camera: { name: 'Studio Camera', categories: ['electronics', 'camera'], tags: ['film'], authors: { 'QA Artist': 'All' }, max_resolution: [4096, 4096], polycount: 12800, description: 'A production camera.', thumbnail_url: '/models/transition_assets/thumbnails/object_payphone_orbit.png' },
      softbox: { name: 'Softbox Light', categories: ['lighting'], tags: ['studio'], authors: { 'QA Artist': 'All' }, max_resolution: [4096, 4096], polycount: 8200, description: 'A studio softbox.', thumbnail_url: '/models/transition_assets/thumbnails/device_tv_crt_knobs.png' },
    }),
  }))
  await page.route('https://api.polyhaven.com/assets?t=textures', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ brushed_metal: { name: 'Brushed Metal', categories: ['metal'], tags: ['PBR'], authors: { 'QA Artist': 'All' }, max_resolution: [4096, 4096], description: 'A seamless metal texture.', thumbnail_url: '/models/transition_assets/thumbnails/object_shell_whip.png' } }) }))
  await page.route('https://api.polyhaven.com/assets?t=hdris', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ studio_evening: { name: 'Studio Evening', categories: ['studio'], tags: ['lighting'], authors: { 'QA Artist': 'All' }, max_resolution: [16384, 8192], description: 'A studio lighting environment.', thumbnail_url: '/models/transition_assets/thumbnails/device_tv_crt_silver.png' } }) }))
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/#studio', { waitUntil: 'networkidle' })
  await page.getByTestId('left-tab-threed').click()
  await page.getByTestId('open-3d-asset-library').click()
  await page.getByTestId('asset-library-modal').waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid^="asset-library-add-"]').count() > 0, true, 'local model cards should be visible')
  await page.screenshot({ path: path.join(out, 'local-models.png'), fullPage: true })

  await page.locator('[data-testid^="asset-library-add-"]').first().click()
  await page.getByTestId('asset-library-status').getByText(/added to the 3D scene/i).waitFor()
  await page.getByTestId('asset-library-close').click()
  await page.getByTestId('three-viewer-container').waitFor({ state: 'visible' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(out, 'imported-model-scene.png'), fullPage: true })
  assert.deepEqual(runtimeErrors, [], `model import produced runtime errors: ${runtimeErrors.join('; ')}`)
  await page.getByTestId('open-3d-asset-library').click()

  await page.getByTestId('asset-library-source-polyhaven').click()
  await page.getByText(/2 CC0 models indexed/i).waitFor()
  assert.equal(await page.getByText('Studio Camera').count(), 1)
  await page.screenshot({ path: path.join(out, 'poly-haven.png'), fullPage: true })
  await page.getByTestId('asset-library-poly-texture').click()
  await page.getByText(/1 CC0 texture indexed/i).waitFor()
  assert.equal(await page.getByText('Brushed Metal').count(), 1)
  await page.getByTestId('asset-library-poly-hdri').click()
  await page.getByText(/1 CC0 HDRI indexed/i).waitFor()
  assert.equal(await page.getByText('Studio Evening').count(), 1)

  await page.getByTestId('asset-library-open-pack').click()
  await page.getByTestId('pack-browser-modal').waitFor({ state: 'visible' })
  await page.getByTestId('pack-browser-open-assets').click()
  await page.getByTestId('asset-library-modal').waitFor({ state: 'visible' })
  console.log('PASS asset library local import, live-catalog adapter, and Pack Browser round trip')
} finally {
  await browser.close()
}
