import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const out = path.resolve('evidence/screenshots')
fs.mkdirSync(out, { recursive: true })
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
  page.setDefaultTimeout(15000)
  const errors = []; page.on('pageerror', error => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const st = window.__omniframe_store, s = st.getState()
    s.newProject(); s.setCustomSequenceDimensions(640, 360)
    const img = new Image(); img.src = '/assets/effect-subjects/pexels-car.jpg'; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
    canvas.getContext('2d').drawImage(img, 0, 0, 640, 360)
    st.getState().addAsset({ id: 'study-car', name: 'Car', kind: 'image', url: canvas.toDataURL(), duration: 5, width: 640, height: 360, size: 1000 })
    st.getState().addClipToTrack(st.getState().ensureTrack('video'), 'study-car', 0)
    st.getState().selectClip(st.getState().clips[0].id)
    st.getState().setLeftTab('effects'); st.getState().setRightOpen(true)
  })
  await page.getByTestId('fx-cat-blur').click()
  await page.getByTestId('fx-group-shape').click()
  await page.getByTestId('fx-tile-essential-box-blur').waitFor()
  await page.screenshot({ path: path.join(out, 'effects-nested-shape-blur.png') })
  await page.getByTestId('fx-group-box').click()
  assert.equal(await page.getByTestId('fx-catalog-grid').locator('[data-testid^="preview-card-"]').count(), 1)
  await page.getByTestId('fx-catalog-search').fill('gaussian')
  await page.getByText('No effects here. Clear search or choose another group.').waitFor()
  await page.getByTestId('fx-catalog-search').fill('shape')
  await page.getByTestId('fx-tile-essential-box-blur').waitFor()
  const before = await page.evaluate(() => JSON.stringify(window.__omniframe_store.getState().clips))
  await page.getByTestId('fx-tile-essential-box-blur').click()
  await page.getByRole('slider', { name: 'Scrub Box Blur' }).waitFor()
  assert.equal(await page.evaluate(() => JSON.stringify(window.__omniframe_store.getState().clips)), before, 'single click auditions without modifying clips')
  await page.getByTestId('add-fx-tile-essential-box-blur').click()
  const layer = await page.evaluate(() => window.__omniframe_store.getState().clips.find(c => c.kind === 'adjustment'))
  assert.equal(layer.effects.boxBlur, 6)
  await page.getByTestId('selection-grade-controls').getByRole('slider', { name: 'Radius (px)' }).fill('12')
  assert.equal(await page.evaluate(id => window.__omniframe_store.getState().clips.find(c => c.id === id).effects.boxBlur, layer.id), 12)
  await page.evaluate(() => window.__omniframe_store.getState().undo())
  assert.equal(await page.evaluate(id => window.__omniframe_store.getState().clips.find(c => c.id === id).effects.boxBlur, layer.id), 6)
  await page.getByRole('button', { name: 'Parent effect group' }).click()
  await page.getByTestId('fx-catalog-search').fill('')
  await page.getByTestId('fx-group-aperture').click()
  await page.getByTestId('fx-collection-select').selectOption('generated')
  await page.waitForFunction(() => document.querySelector('[data-testid="fx-catalog-grid"] [data-testid^="fx-tile-ofx-"]'))
  assert.ok(await page.getByTestId('fx-catalog-grid').locator('[data-testid^="fx-tile-ofx-"]').count() <= 60)
  await page.getByRole('button', { name: 'Parent effect group' }).click()
  await page.getByTestId('fx-collection-select').selectOption('all')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.__omniframe_store.setState({ leftOpen: true, rightOpen: false }))
  await page.getByTestId('fx-group-box').waitFor()
  const overflow = await page.getByTestId('fx-group-browser').evaluate(el => el.scrollWidth > el.clientWidth + 1)
  assert.equal(overflow, false, 'nested group navigation fits a narrow dock')
  await page.screenshot({ path: path.join(out, 'effects-nested-mobile.png') })
  await page.setViewportSize({ width: 1440, height: 940 })

  // Full Program renderer with real editor clips: animate a selective grade and limit it with a mask.
  const ids = await page.evaluate(() => {
    const st = window.__omniframe_store; st.getState().newProject(); st.getState().setCustomSequenceDimensions(320, 180)
    const c = document.createElement('canvas'); c.width = 320; c.height = 180
    const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 160, 180); x.fillStyle = '#00ff00'; x.fillRect(160, 0, 160, 180)
    st.getState().addAsset({ id: 'color-fixture', name: 'Grade fixture', kind: 'image', url: c.toDataURL(), duration: 5, width: 320, height: 180, size: 1000 })
    st.getState().addClipToTrack(st.getState().ensureTrack('video'), 'color-fixture', 0)
    const clipId = st.getState().clips[0].id
    const fxId = st.getState().addFxInstance(clipId, 'essential-color-hold')
    st.getState().setFxKey(clipId, fxId, 'colorHold', 0, 0)
    st.getState().setFxKey(clipId, fxId, 'colorHold', 1, 1)
    st.getState().setMonitorMode('program'); st.getState().setPlayhead(1.5)
    return { clipId, fxId }
  })
  const pixel = async (rx, ry) => page.evaluate(([rx, ry]) => {
    const c = document.getElementById('of-canvas')
    return [...c.getContext('2d').getImageData(c.width * rx, c.height * ry, 1, 1).data]
  }, [rx, ry])
  await page.waitForFunction(() => {
    const c = document.getElementById('of-canvas'), p = c.getContext('2d').getImageData(c.width * .75, c.height * .5, 1, 1).data
    return p[0] > 150 && Math.abs(p[0] - p[1]) < 3
  })
  assert.deepEqual((await pixel(.25, .5)).slice(0, 3), [255, 0, 0], 'selected red survives')
  await page.evaluate(({ clipId }) => window.__omniframe_store.getState().setClipProp(clipId, { adjustmentMask: { enabled: true, inverted: false, shape: 'rectangle', centerX: .5, centerY: .25, width: 1, height: .5, feather: 0 } }), ids)
  await page.waitForFunction(() => {
    const c = document.getElementById('of-canvas'), p = c.getContext('2d').getImageData(c.width * .75, c.height * .8, 1, 1).data
    return p[0] < 5 && p[1] > 250
  })
  const insideMask = await pixel(.75, .2)
  assert.ok(insideMask[0] > 150, `grade renders inside its mask: ${insideMask}, center ${await pixel(.75,.4)}`)
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
  await page.waitForFunction(() => {
    const c = document.getElementById('of-canvas'), p = c.getContext('2d').getImageData(c.width * .75, c.height * .2, 1, 1).data
    return p[0] < 5 && p[1] > 250
  })
  const persistence = await page.evaluate(async ({ clipId }) => {
    const st = window.__omniframe_store, bundle = await st.getState().saveOmniProject('Grade round trip')
    st.getState().newProject(); await st.getState().loadOmniProject(new File([bundle], 'grade.omni'))
    const c = st.getState().clips.find(c => c.id === clipId)
    return { keys: c.fxInstances[0].keys.colorHold, mask: c.adjustmentMask.shape }
  }, ids)
  assert.deepEqual(persistence, { keys: [{ t: 0, v: 0 }, { t: 1, v: 1 }], mask: 'rectangle' })

  await page.evaluate(() => {
    const s = window.__omniframe_store.getState(); s.newProject(); s.setCustomSequenceDimensions(640, 360)
    s.setActiveCategory('2d'); s.setLeftTab('animation')
  })
  await page.getByTestId('animation-workspace').waitFor()
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.addDrawingStroke({ id: 'trim-line', layerId: s.activePaintLayerId, tool: 'brush', color: '#6ee7b7', size: 10, opacity: 1,
      points: Array.from({ length: 100 }, (_, i) => ({ x: .1 + i / 125, y: .5 + Math.sin(i / 10) * .2, timestamp: i * 10 })), temporalScope: { type: 'global' } })
  })
  await page.getByLabel('Trim end', { exact: true }).fill('25')
  await page.getByRole('button', { name: 'Keyframe trim end', exact: true }).click()
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2))
  await page.getByLabel('Trim end', { exact: true }).fill('75')
  const trim = await page.evaluate(() => window.__omniframe_store.getState().drawingStrokes[0].pathTrim)
  assert.deepEqual(trim.keys.end, [{ t: 0, v: .25 }, { t: 2, v: .75 }])
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(1))
  assert.equal(await page.getByLabel('Trim end', { exact: true }).inputValue(), '50')
  await page.screenshot({ path: path.join(out, 'animation-trim-path.png') })
  await page.getByRole('button', { name: 'Reset path trim' }).click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().drawingStrokes[0].pathTrim), undefined)
  await page.evaluate(() => window.__omniframe_store.getState().undo())
  const savedTrim = await page.evaluate(async () => {
    const st = window.__omniframe_store, bundle = await st.getState().saveOmniProject('Trim round trip')
    st.getState().newProject(); await st.getState().loadOmniProject(new File([bundle], 'trim.omni'))
    return st.getState().drawingStrokes[0].pathTrim
  })
  assert.deepEqual(savedTrim, trim)
  assert.deepEqual(errors, [])
  console.log('PASS nested groups, scoped tag search, bounded variation pages, audition/add, adjustment controls/Undo, masks/keyframed grade pixels, trim UI and project round trips')
} finally { await browser.close() }
