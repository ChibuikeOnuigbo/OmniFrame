import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
const out = join(root, 'qa-output/performance-20261031')
mkdirSync(out, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__omniframe_store)
  const setup = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const c = document.createElement('canvas'); c.width = 320; c.height = 180
    const ctx = c.getContext('2d'); ctx.fillStyle = '#e53322'; ctx.fillRect(0, 0, 320, 180)
    store.getState().addAsset({ id: 'perf-image', kind: 'image', name: 'Performance plate', url: c.toDataURL(), width: 320, height: 180, duration: 10, size: 100 })
    store.getState().addClipToTrack(store.getState().ensureTrack('video'), 'perf-image', 0)
    store.setState({ sequenceSettings: { ...store.getState().sequenceSettings, width: 320, height: 180 }, previewQuality: 'high' })
    window.perf = await import('/src/lib/performanceSettings.ts')
    return true
  })
  assert.equal(setup, true)
  await page.waitForTimeout(500)
  assert.deepEqual(await page.locator('#of-canvas').evaluate(c => [c.width, c.height]), [320, 180])
  const idleBefore = await page.evaluate(() => window.perf.previewMetrics.frames)
  await page.waitForTimeout(1000)
  const idleFrames = await page.evaluate(n => window.perf.previewMetrics.frames - n, idleBefore)
  assert.ok(idleFrames >= 2 && idleFrames <= 7, `idle frames ${idleFrames}`)
  await page.evaluate(() => window.perf.usePerformanceSettings.getState().setPreviewFps(15))
  await page.evaluate(() => window.__omniframe_store.getState().play())
  const start = await page.evaluate(() => ({ frames: window.perf.previewMetrics.frames, time: window.__omniframe_store.getState().playhead }))
  await page.waitForTimeout(1000)
  const result = await page.evaluate(start => ({ frames: window.perf.previewMetrics.frames - start.frames, elapsed: window.__omniframe_store.getState().playhead - start.time }), start)
  assert.ok(result.frames >= 8 && result.frames <= 17, JSON.stringify(result))
  assert.ok(result.elapsed > .7 && result.elapsed < 1.5, JSON.stringify(result))
  await page.evaluate(() => { window.__omniframe_store.getState().pause(); window.__omniframe_store.getState().setIs3DMode(true) })
  await page.locator('#of-three-canvas').waitFor()
  await page.evaluate(() => { window.originalThreeCanvas = document.getElementById('of-three-canvas') })
  for (const time of [.1, .5, 1, 1.5]) {
    await page.evaluate(t => window.__omniframe_store.getState().setPlayhead(t), time)
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => window.originalThreeCanvas === document.getElementById('of-three-canvas')), true, 'scrubbing preserves WebGL context')
  }
  const threeBefore = await page.locator('#of-three-canvas').getAttribute('data-rendered-frames')
  await page.waitForTimeout(1000)
  const threeFrames = Number(await page.locator('#of-three-canvas').getAttribute('data-rendered-frames')) - Number(threeBefore)
  assert.ok(threeFrames >= 8 && threeFrames <= 17, `3D frame limit: ${threeFrames}`)
  await page.setViewportSize({ width: 1100, height: 700 })
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => window.originalThreeCanvas === document.getElementById('of-three-canvas')), true, 'resizing preserves WebGL context')
  assert.equal(await page.getByTestId('selection-quick-bar').count(), 0, '2D quick bar does not cover 3D tools')
  await page.screenshot({ path: join(out, 'three-view.png') })
  assert.deepEqual(errors, [])
  writeFileSync(join(out, 'report.json'), JSON.stringify({ idleFrames, playback: result, stableThreeCanvas: true, threeFrames, errors }, null, 2))
  console.log('PASS idle compositing, real-time clock at 15 fps, native-size preview and persistent 3D context', { idleFrames, ...result })
} finally { await browser.close() }
