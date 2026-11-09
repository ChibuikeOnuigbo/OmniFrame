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
const out = path.join(root, 'qa-output/directional-light-blur')
fs.mkdirSync(out, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], past: [], future: [] })
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270
    const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 480, 270)
    gradient.addColorStop(0, '#07101e'); gradient.addColorStop(1, '#345170')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 480, 270)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(260, 130, 48, 0, Math.PI * 2); ctx.fill()
    store.getState().addAsset({ id: 'light-source', kind: 'image', name: 'Light source', url: canvas.toDataURL(), duration: 5, width: 480, height: 270, size: 1000 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'light-source', 0)
    store.getState().addAdjustmentLayer({ name: 'Directional light', start: 0, duration: 5, effects: { lightType: 'point', lightColor: '#ffd27a', lightIntensity: 1, lightFalloff: .45, lightX: .5, lightY: .45 } })
    store.getState().setPlayhead(1); store.getState().setLeftTab('effects'); store.getState().setLeftOpen(true)
  })
  await page.getByTestId('section-tab-adjustment-controls').click()
  await page.getByTestId('light-controls').waitFor({ state: 'visible' })
  await page.getByTestId('light-type-directional').click()
  for (const key of ['lightAngle', 'lightWidth', 'lightSoftness']) {
    await page.getByTestId(`light-slider-${key}`).waitFor({ state: 'visible' })
  }
  assert.equal(await page.getByTestId('light-slider-lightFalloff').count(), 0, 'beam hides the radial-only falloff control')
  const setRange = async (key, value) => page.getByTestId(`light-slider-${key}`).evaluate((node, next) => {
    const input = node
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, String(next))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await setRange('lightAngle', 62)
  await setRange('lightWidth', .34)
  await setRange('lightSoftness', .68)
  const stored = await page.evaluate(() => window.__omniframe_store.getState().clips.find((clip) => clip.kind === 'adjustment').effects)
  assert.equal(stored.lightType, 'directional')
  assert.equal(stored.lightAngle, 62)
  assert.equal(stored.lightWidth, .34)
  assert.equal(stored.lightSoftness, .68)
  assert.equal(await page.getByTestId('light-type-directional').getAttribute('aria-pressed'), 'true')
  assert.doesNotMatch(await page.getByTestId('clip-effects-controls').textContent(), /NaN/, 'unset controls use real defaults')
  await page.screenshot({ path: path.join(out, 'directional-light-controls.png'), fullPage: true })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ stored, errors }, null, 2))
  console.log('directional-light-blur-ui-e2e: icon control selection and persisted beam sliders PASS')
} finally {
  await browser.close()
}
