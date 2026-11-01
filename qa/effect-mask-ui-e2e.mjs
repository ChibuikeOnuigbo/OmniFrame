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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.setState({ assets: [], clips: [], tracks: [], selectedClipId: null, selectedClipIds: [], rightOpen: true, sidebarSectionMode: 'tabs' })
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
    const x = canvas.getContext('2d'); x.fillStyle = '#132033'; x.fillRect(0, 0, 640, 360)
    store.getState().addAsset({ id: 'mask-ui-plate', kind: 'image', name: 'Five bulbs', url: canvas.toDataURL(), duration: 5, width: 640, height: 360, size: 100 })
    const track = store.getState().ensureTrack('video')
    store.getState().addClipToTrack(track, 'mask-ui-plate', 0)
    const clip = store.getState().clips[0]
    store.getState().setClipProp(clip.id, { effects: { glow: 1, blur: 5 } })
    store.getState().selectClip(clip.id)
  })
  const effectTab = page.getByTestId('section-tab-effect-mask')
  await effectTab.waitFor({ state: 'visible' }); await effectTab.evaluate((button) => button.click())
  const add = page.getByTestId('add-effect-mask-btn')
  await add.scrollIntoViewIfNeeded(); await add.evaluate((button) => button.click())
  for (let i = 0; i < 5; i += 1) await page.getByTestId('add-effect-mask-circle').evaluate((button) => button.click())
  const regionList = page.getByTestId('effect-mask-region-list')
  await regionList.locator('button').first().evaluate((button) => button.click())
  await page.getByRole('button', { name: 'Remove selected region' }).evaluate((button) => button.click())
  let state = await page.evaluate(() => window.__omniframe_store.getState().clips[0].adjustmentMask)
  assert.equal(state.regions.length, 5)
  assert.ok(state.regions.every((region) => region.shape === 'circle'))
  await page.getByTestId('add-effect-mask-custom').evaluate((button) => button.click())
  await page.getByRole('button', { name: 'Add draw point' }).evaluate((button) => button.click())
  await page.getByTestId('add-effect-mask-text').evaluate((button) => button.click())
  const textInput = page.getByLabel('Effect mask text'); await textInput.fill('LIGHT')
  state = await page.evaluate(() => window.__omniframe_store.getState().clips[0].adjustmentMask)
  assert.equal(state.regions.length, 7)
  assert.equal(state.regions.at(-1).text, 'LIGHT')
  assert.equal(state.regions.find((region) => region.shape === 'custom').points.length, 5)
  await page.getByTestId('add-effect-mask-rectangle').evaluate((button) => button.click())
  const undoRedo = await page.evaluate(() => {
    const store = window.__omniframe_store
    const afterAdd = store.getState().clips[0].adjustmentMask.regions.length
    store.getState().undo()
    const afterUndo = store.getState().clips[0].adjustmentMask.regions.length
    store.getState().redo()
    return { afterAdd, afterUndo, afterRedo: store.getState().clips[0].adjustmentMask.regions.length }
  })
  assert.deepEqual(undoRedo, { afterAdd: 8, afterUndo: 7, afterRedo: 8 })
  const out = path.join(root, 'qa-output', 'effect-mask-bulbs')
  fs.mkdirSync(out, { recursive: true })
  await page.screenshot({ path: path.join(out, 'effect-mask-ui.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS effect-mask UI: five circle regions plus custom draw and text regions persisted in the live store')
} finally {
  await browser.close()
}
