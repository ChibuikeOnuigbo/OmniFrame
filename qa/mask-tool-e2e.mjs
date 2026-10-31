/**
 * Clip Mask regression test (CapCut/AE-style visibility mask).
 *
 * Verifies the Mask tool is distinct from selection/roto masking:
 *  - store-level add/remove participate in undo (Ctrl+Z path)
 *  - Inside mode keeps only the masked region of the top clip
 *  - Outside mode keeps frame − mask (complement)
 *  - feather blends the boundary
 *  - the mask hides the clip's own effects inside the region only
 *  - drawing on the monitor updates mask geometry
 *  - the RightPanel Mask UI adds the mask and toggles Inside/Outside
 *
 * Run with a Vite server at localhost:5173:
 *   URL=http://localhost:5173/#studio node qa/mask-tool-e2e.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
const ROOT = process.cwd()
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}

const browser = await playwrightChromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const runtimeErrors = []
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(20000)
page.on('pageerror', (error) => runtimeErrors.push(String(error)))
page.on('console', (message) => message.type() === 'error' && runtimeErrors.push(message.text()))

const frames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const sampleAt = (fx, fy) => page.evaluate(([x, y]) => {
  const canvas = document.querySelector('#of-canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Preview canvas is missing')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Preview canvas has no 2D context')
  return Array.from(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data)
}, [fx, fy])
const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
const close = (a, b, tol = 14) => dist(a, b) <= tol

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.evaluate(() => window.__omniframe_store.getState().setPreviewQuality('low'))
  await page.waitForFunction(() => document.querySelector('#of-canvas')?.width === 426)

  // Seed: bottom = room photo, top = Death Note image (full-frame, 10s each).
  const seeded = await page.evaluate(() => {
    const store = window.__omniframe_store
    const state = store.getState()
    const top = state.assets.find((a) => a.id === 'asset-death-note-img')
    const bottom = state.assets.find((a) => a.id === 'asset-room-chair-towel')
    if (!top || !bottom) throw new Error('Bundled mask fixtures are missing')
    // Plain image-over-photo composite: clear the demo OmniFrame characters
    // so neither fixture takes the character-cutout render path.
    store.setState({ omniframeCharacters: [] })
    const bottomTrack = state.createTrack('video')
    const topTrack = state.createTrack('video')
    state.addClipToTrack(bottomTrack, bottom.id, 0)
    state.addClipToTrack(topTrack, top.id, 0)
    const clips = store.getState().clips
    const topClip = clips.find((c) => c.trackId === topTrack)
    const bottomClip = clips.find((c) => c.trackId === bottomTrack)
    if (!topClip || !bottomClip) throw new Error('Could not seed mask clips')
    store.getState().setPlayhead(1)
    store.getState().selectClip(topClip.id)
    return { topId: topClip.id, bottomId: bottomClip.id }
  })
  await frames()

  const baseCenter = await sampleAt(0.5, 0.5)
  const baseCorner = await sampleAt(0.06, 0.06)
  assert.ok(baseCenter[3] > 200 && baseCorner[3] > 200, 'Seeded clips should render opaque pixels')

  // Bottom-only reference: hide the top clip.
  await page.evaluate((id) => {
    const s = window.__omniframe_store.getState()
    s.setClipProp(id, { hidden: true })
  }, seeded.topId)
  await frames()
  const bottomCenter = await sampleAt(0.5, 0.5)
  const bottomCorner = await sampleAt(0.06, 0.06)
  await page.evaluate((id) => {
    const s = window.__omniframe_store.getState()
    s.setClipProp(id, { hidden: false })
    s.selectClip(id)
    s.setRightOpen(true)
  }, seeded.topId)
  await frames()
  assert.ok(!close(baseCenter, bottomCenter, 10) || !close(baseCorner, bottomCorner, 10), 'Fixtures must differ somewhere')

  // --- Store-level undo: addClipMask must be one Ctrl+Z step ---
  const undoCheck = await page.evaluate((id) => {
    const store = window.__omniframe_store
    store.getState().addClipMask(id)
    const withMask = store.getState().clips.find((c) => c.id === id)?.mask
    store.getState().undo()
    const afterUndo = store.getState().clips.find((c) => c.id === id)?.mask
    return { withMask: Boolean(withMask), afterUndo: afterUndo ?? null }
  }, seeded.topId)
  assert.ok(undoCheck.withMask, 'addClipMask should create a mask')
  assert.equal(undoCheck.afterUndo, null, 'Undo must remove a freshly added mask')

  // Undo clears the selection in this app; re-select before using the UI.
  await page.evaluate((id) => {
    const s = window.__omniframe_store.getState()
    s.selectClip(id)
    s.setRightOpen(true)
  }, seeded.topId)

  // --- UI: add the mask from the inspector ---
  await page.locator('[data-testid="section-tab-video-mask-view"], [data-testid="section-header-mask"], [data-testid="section-tab-mask"]').first().click()
  await page.getByTestId('add-clip-mask-btn').waitFor({ state: 'visible' })
  await page.getByTestId('add-clip-mask-btn').click()
  await page.getByTestId('clip-mask-controls').waitFor({ state: 'visible' })
  await page.getByTestId('clip-mask-overlay').waitFor({ state: 'visible' })

  // Deterministic geometry for pixel checks: rectangle, no feather.
  await page.evaluate((id) => {
    window.__omniframe_store.getState().updateClipMask(id, {
      shape: 'rectangle', centerX: 0.5, centerY: 0.5, width: 0.4, height: 0.4, feather: 0, rotation: 0, expansion: 0, opacity: 1, inverted: false, enabled: true,
    })
  }, seeded.topId)
  await frames()

  // Inside: center = top clip, corner = bottom clip (top hidden there).
  const insideCenter = await sampleAt(0.5, 0.5)
  const insideCorner = await sampleAt(0.06, 0.06)
  assert.ok(close(insideCenter, baseCenter), `Inside center should keep top clip ${insideCenter} vs ${baseCenter}`)
  assert.ok(close(insideCorner, bottomCorner), `Inside corner should reveal bottom clip ${insideCorner} vs ${bottomCorner}`)

  // Outside (frame − mask): center = bottom, corner = top.
  await page.getByTestId('mask-mode-outside-btn').click()
  await frames()
  const outsideCenter = await sampleAt(0.5, 0.5)
  const outsideCorner = await sampleAt(0.06, 0.06)
  assert.ok(close(outsideCenter, bottomCenter), `Outside center should reveal bottom clip ${outsideCenter} vs ${bottomCenter}`)
  assert.ok(close(outsideCorner, baseCorner), `Outside corner should keep top clip ${outsideCorner} vs ${baseCorner}`)
  const hint = await page.getByTestId('mask-mode-hint').innerText()
  assert.match(hint, /except the masked region/i)

  // Back Inside + feather: boundary pixel blends top and bottom.
  await page.getByTestId('mask-mode-inside-btn').click()
  await page.evaluate((id) => {
    window.__omniframe_store.getState().updateClipMask(id, { feather: 160 })
  }, seeded.topId)
  await frames()
  const edge = await sampleAt(0.7, 0.5) // on the rectangle's right edge (0.5 + 0.4/2)
  assert.ok(dist(edge, baseCenter) > 6 && dist(edge, bottomCenter) > 6, `Feathered edge should blend, got ${edge} between ${baseCenter} and ${bottomCenter}`)

  // Mask hides the clip's own effects inside the region only.
  await page.evaluate((id) => {
    const s = window.__omniframe_store.getState()
    s.updateClipMask(id, { feather: 0 })
    s.setClipProp(id, { effects: { invert: 1 } })
  }, seeded.topId)
  await frames()
  const fxCenter = await sampleAt(0.5, 0.5)
  const fxCorner = await sampleAt(0.06, 0.06)
  const invertedBase = [255 - baseCenter[0], 255 - baseCenter[1], 255 - baseCenter[2], 255]
  assert.ok(close(fxCenter, invertedBase, 18), `Inside region should show inverted top clip ${fxCenter} vs ${invertedBase}`)
  assert.ok(close(fxCorner, bottomCorner), `Outside region must not show the top clip effect ${fxCorner} vs ${bottomCorner}`)
  await page.evaluate((id) => {
    window.__omniframe_store.getState().setClipProp(id, { effects: {} })
  }, seeded.topId)
  await frames()

  // Draw on the monitor: drag a new rectangle (30%,35%) -> (66%,72%).
  const stage = await page.locator('#of-canvas').boundingBox()
  assert.ok(stage, 'Canvas bounding box missing')
  await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(stage.x + stage.width * 0.66, stage.y + stage.height * 0.72, { steps: 8 })
  await page.mouse.up()
  const drawn = await page.evaluate((id) => window.__omniframe_store.getState().clips.find((c) => c.id === id)?.mask, seeded.topId)
  assert.ok(drawn, 'Mask should still exist after drawing')
  assert.ok(Math.abs(drawn.centerX - 0.48) < 0.06, `Drawn centerX ~0.48, got ${drawn.centerX}`)
  assert.ok(Math.abs(drawn.centerY - 0.535) < 0.06, `Drawn centerY ~0.535, got ${drawn.centerY}`)
  assert.ok(Math.abs(drawn.width - 0.36) < 0.06, `Drawn width ~0.36, got ${drawn.width}`)
  assert.ok(Math.abs(drawn.height - 0.37) < 0.06, `Drawn height ~0.37, got ${drawn.height}`)

  mkdirSync(join(ROOT, 'evidence/screenshots'), { recursive: true })
  await page.screenshot({ path: join(ROOT, 'evidence/screenshots/omniframe-mask-tool.png'), fullPage: false })

  // Remove via UI, then undo restores it (remove is a snapshot step).
  await page.getByTestId('remove-clip-mask-btn').click()
  const removed = await page.evaluate((id) => window.__omniframe_store.getState().clips.find((c) => c.id === id)?.mask ?? null, seeded.topId)
  assert.equal(removed, null, 'Remove mask should clear the mask')
  await frames()
  const restoredCorner = await sampleAt(0.06, 0.06)
  assert.ok(close(restoredCorner, baseCorner), 'After removal the top clip should cover the corner again')
  await page.evaluate(() => window.__omniframe_store.getState().undo())
  const restored = await page.evaluate((id) => Boolean(window.__omniframe_store.getState().clips.find((c) => c.id === id)?.mask), seeded.topId)
  assert.ok(restored, 'Undo should restore the removed mask')

  assert.deepEqual(runtimeErrors, [], `Runtime errors: ${runtimeErrors.join(' | ')}`)
  console.log('mask-tool-e2e: passed')
} finally {
  await browser.close()
}
