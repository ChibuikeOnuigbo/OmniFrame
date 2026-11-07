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
const out = path.join(root, 'qa-output/motion-lab')
fs.mkdirSync(out, { recursive: true })

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], past: [], future: [], playhead: 0 })
  })

  await page.getByTestId('templates-button').click()
  const modal = page.getByTestId('template-picker-modal')
  await modal.waitFor({ state: 'visible' })
  assert.match(await modal.textContent(), /201 original recipes/)

  await page.getByTestId('template-category-data').click()
  assert.match(await modal.textContent(), /Data Story/)
  await page.getByTestId('template-search').fill('Data Story · Neon')
  const card = page.getByTestId('template-item-motion-lab-data-story-neon')
  await card.waitFor({ state: 'visible' })
  await card.click()
  assert.match(await page.getByTestId('template-preview').textContent(), /84%/)
  await page.screenshot({ path: path.join(out, 'catalog-search-preview.png') })

  await page.getByTestId('apply-template-btn').click()
  await modal.waitFor({ state: 'hidden' })
  const result = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const recipeClips = state.clips.filter((clip) => clip.name.startsWith('Data Story · Neon'))
    const text = recipeClips.filter((clip) => clip.kind === 'text')
    return {
      clips: recipeClips.length,
      textLayers: text.length,
      animatedText: text.filter((clip) => clip.animation && Object.keys(clip.animation).length > 0).length,
      backgroundAssets: state.assets.filter((asset) => asset.id === 'template-bg-motion-lab-data-story-neon').length,
      attribution: state.assets.find((asset) => asset.id === 'template-bg-motion-lab-data-story-neon')?.attribution,
      notice: state.mediaImportNotice,
      aspect: state.sequenceSettings.aspectRatio,
    }
  })
  assert.ok(result.clips >= 4, `expected backdrop plus three text layers, got ${result.clips}`)
  assert.equal(result.textLayers, 3)
  assert.equal(result.animatedText, 3)
  assert.equal(result.backgroundAssets, 1)
  assert.equal(result.attribution, 'Original OmniFrame Motion Lab artwork')
  assert.equal(result.aspect, '16:9')
  assert.match(result.notice, /built 4 editable layers/i)
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(1))
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(out, 'data-story-editable-scene.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('mobile-workspace-tools').click()
  const mobileMenu = page.getByTestId('mobile-workspace-menu')
  await mobileMenu.waitFor({ state: 'visible' })
  await mobileMenu.getByText('Motion Lab templates', { exact: true }).click()
  const mobileModal = page.getByTestId('template-picker-modal')
  await mobileModal.waitFor({ state: 'visible' })
  const mobileBounds = await mobileModal.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  assert.ok(mobileBounds.left >= 0 && mobileBounds.right <= mobileBounds.viewport, JSON.stringify(mobileBounds))
  assert.equal(mobileBounds.documentWidth, mobileBounds.viewport)
  await page.screenshot({ path: path.join(out, 'mobile-template-browser.png'), fullPage: true })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...result, mobileBounds }, null, 2))
  console.log('PASS Motion Lab search, filters, editable keyed scene build and narrow-screen bounds')
} finally {
  await browser.close()
}
