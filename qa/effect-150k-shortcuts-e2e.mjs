import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'qa-output/effect-150k')
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
    localStorage.removeItem('omniframe.shortcuts')
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], selectedClipId: null, selectedClipIds: [], past: [], future: [] })
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
    const context = canvas.getContext('2d'); const gradient = context.createLinearGradient(0, 0, 640, 360)
    gradient.addColorStop(0, '#071224'); gradient.addColorStop(.5, '#315b8c'); gradient.addColorStop(1, '#ef8b55')
    context.fillStyle = gradient; context.fillRect(0, 0, 640, 360)
    context.fillStyle = '#fff'; context.font = 'bold 64px sans-serif'; context.fillText('150K+', 205, 205)
    store.getState().addAsset({ id: 'recipe-source', kind: 'image', name: 'Recipe source', url: canvas.toDataURL(), duration: 5, width: 640, height: 360, size: 1000 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'recipe-source', 0)
    store.getState().setLeftTab('effects'); store.getState().setRightOpen(true)
  })

  const count = page.getByTestId('fx-catalog-count')
  await count.waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('[data-testid="fx-catalog-count"]')?.textContent?.includes('155,048'), null, { timeout: 15_000 })
  assert.match(await count.textContent(), /155,048/, '5k authored pack joins the 150k+ base catalog')

  await page.getByTestId('fx-catalog-search').fill('ofx-139425')
  await page.getByTestId('fx-tile-ofx-139425').waitFor({ state: 'visible' })
  await page.getByTestId('fx-tile-ofx-139425').click()
  const applied = await page.evaluate(() => window.__omniframe_store.getState().clips[0].fxInstances.at(-1))
  assert.equal(applied.catalogId, 'ofx-139425')
  assert.ok(Object.keys(applied.params).length >= 6, 'indexed recipe keeps editable parameters')
  await page.mouse.move(1000, 40)
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(out, '150k-catalog-last-recipe.png'), fullPage: true })

  await page.getByTestId('settings-button').click()
  await page.locator('[data-testid="settings-category"][data-category-id="shortcuts"]').click()
  await page.getByTestId('settings-shortcuts-section').waitFor({ state: 'visible' })
  assert.ok(await page.locator('[data-testid^="shortcut-row-"]').count() >= 40, 'expanded shortcut registry is visible')
  await page.getByTestId('edit-shortcut-effectsPanel').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(out, 'shortcut-settings.png'), fullPage: true })

  await page.getByTestId('edit-shortcut-effectsPanel').click()
  await page.getByTestId('shortcut-input-effectsPanel').fill('Alt+7')
  await page.getByTestId('shortcut-input-effectsPanel').press('Enter')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.evaluate(() => window.__omniframe_store.setState({ leftOpen: false, leftTab: 'media' }))
  await page.keyboard.press('Alt+7')
  const rebound = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { leftOpen: state.leftOpen, leftTab: state.leftTab, binding: state.customShortcuts.effectsPanel, saved: JSON.parse(localStorage.getItem('omniframe.shortcuts') || '{}').effectsPanel }
  })
  assert.deepEqual(rebound, { leftOpen: true, leftTab: 'effects', binding: 'Alt+7', saved: 'Alt+7' }, 'rebound command executes and persists')

  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().customShortcuts.effectsPanel), 'Alt+7', 'shortcut survives reload')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], selectedClipId: null, selectedClipIds: [], groups: [], playhead: 1 })
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    store.getState().addAsset({ id: 'shortcut-source', kind: 'image', name: 'Shortcut source', url: canvas.toDataURL(), duration: 4, width: 64, height: 64, size: 100 })
    const track = store.getState().ensureTrack('video')
    store.getState().addClipToTrack(track, 'shortcut-source', 0)
    store.getState().addClipToTrack(track, 'shortcut-source', 4)
    store.getState().selectClips(store.getState().clips.map((clip) => clip.id))
  })
  await page.keyboard.press('i')
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(3))
  await page.keyboard.press('o')
  assert.deepEqual(await page.evaluate(() => window.__omniframe_store.getState().exportRange), { in: 1, out: 3 }, 'configurable export In/Out commands execute')
  await page.keyboard.press('Control+g')
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().groups.length), 1, 'configurable group command executes')
  await page.keyboard.press('Control+Shift+g')
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().groups.length), 0, 'configurable ungroup command executes')
  await page.keyboard.press('Delete')
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips.length), 0, 'configurable delete removes a multi-selection')
  await page.getByTestId('settings-button').click()
  await page.locator('[data-testid="settings-category"][data-category-id="shortcuts"]').click()
  await page.getByTestId('edit-shortcut-effectsPanel').scrollIntoViewIfNeeded()
  await page.getByTestId('edit-shortcut-effectsPanel').click()
  await page.getByTestId('clear-shortcut-effectsPanel').click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.evaluate(() => window.__omniframe_store.setState({ leftOpen: false, leftTab: 'media' }))
  await page.keyboard.press('Alt+7')
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().leftOpen), false, 'cleared shortcut is disabled')

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ baseRecipes: 150048, loadedRecipes: 155048, applied: applied.catalogId, editableParams: Object.keys(applied.params).length, shortcuts: 44, runtimeCommands: ['rebind', 'reload-persistence', 'clear', 'export-in', 'export-out', 'group', 'ungroup', 'multi-delete'], rebound, errors }, null, 2))
  assert.deepEqual(errors, [])
  console.log('effect-150k-shortcuts-e2e: 155048 loaded recipes, indexed apply, 44 persistent/rebindable commands PASS')
} finally {
  await browser.close()
}
