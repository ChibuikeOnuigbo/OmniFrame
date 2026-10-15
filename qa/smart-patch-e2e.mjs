/** Smart Patch E2E: user-picked donor, painted target, and all-frame sequence on video. */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const ROOT = process.cwd()
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const state = store.getState()
    const trackId = state.ensureTrack('video')
    store.setState({ clips: [] })
    state.addClipToTrack(trackId, 'asset-death-note-vid', 0)
    const clip = store.getState().clips.find((candidate) => candidate.assetId === 'asset-death-note-vid')
    store.setState({
      clips: store.getState().clips.map((candidate) => candidate.id === clip?.id ? { ...candidate, duration: 0.4 } : candidate),
      selectedClipId: clip?.id ?? null,
      playhead: 0.1,
    })
  })
  await page.waitForTimeout(500)
  await page.click('[data-testid="left-tab-drawing"]')
  // Picking the Smart Patch tool brings its options docker forward (Krita-style).
  await page.click('[data-testid="panel-tool-smart-patch"]')
  await page.waitForTimeout(250)
  const setDonor = page.locator('[data-testid="smart-patch-set-source"]')
  await setDonor.waitFor({ state: 'visible' })
  await page.locator('[data-testid="smart-patch-scope-all"]').click()
  await setDonor.click()

  const canvas = page.locator('[data-testid="drawing-canvas"]')
  await canvas.waitFor({ state: 'visible' })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Drawing canvas has no visible bounds')
  const donorX = box.x + box.width * 0.22
  const donorY = box.y + box.height * 0.32
  await page.mouse.click(donorX, donorY)
  await page.waitForFunction(() => !!window.__omniframe_store.getState().cloneSourcePoint?.sampleDataUrl)

  const targetX = box.x + box.width * 0.69
  const targetY = box.y + box.height * 0.69
  await page.mouse.move(targetX, targetY)
  await page.mouse.down()
  await page.mouse.move(targetX + 18, targetY + 10, { steps: 4 })
  await page.mouse.move(targetX + 36, targetY + 16, { steps: 4 })
  await page.mouse.up()
  await page.waitForFunction(() => ['done', 'error'].includes(window.__omniframe_store.getState().smartPatchStatus.phase), { timeout: 90000 })

  const result = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const patch = state.drawingStrokes.find((stroke) => stroke.tool === 'smart-patch')
    return {
      phase: state.smartPatchStatus.phase,
      message: state.smartPatchStatus.message,
      frameCount: patch?.smartPatchFrames?.length ?? 0,
      expectedFrames: Math.round((state.clips.find((clip) => clip.id === state.selectedClipId)?.duration ?? 0) * state.projectFps),
      times: patch?.smartPatchFrames?.map((frame) => frame.time) ?? [],
      hasDonor: Number.isFinite(patch?.cloneSource?.x) && Number.isFinite(patch?.cloneSource?.y),
    }
  })
  if (result.phase !== 'done' || !result.hasDonor || result.frameCount !== result.expectedFrames || result.frameCount !== 12) {
    throw new Error(`Smart Patch did not create the expected temporal frames: ${JSON.stringify(result)}`)
  }
  mkdirSync(join(ROOT, 'evidence/screenshots'), { recursive: true })
  await page.screenshot({ path: join(ROOT, 'evidence/screenshots/omniframe-smart-patch-temporal.png'), fullPage: false })
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const state = store.getState()
    state.clearDrawingStrokes()
    state.setRotoScope({ mode: 'range', start: 0, end: 0.1, step: 1 })
    state.setSmartPatchScope({ mode: 'omniframe' })
    store.setState({ smartPatchStatus: { phase: 'idle', done: 0, total: 0, message: '' } })
  })
  await page.locator('[data-testid="smart-patch-scope-omniframe"]').click()
  const linkedScope = await page.getByTestId('smart-patch-omniframe-scope').innerText()
  if (!linkedScope.includes('0.0–0.1s')) throw new Error(`Smart Patch did not reflect the OmniFrame range: ${linkedScope}`)
  mkdirSync(join(ROOT, 'evidence/screenshots'), { recursive: true })
  await page.screenshot({ path: join(ROOT, 'evidence/screenshots/omniframe-smart-patch-omniframe-scope.png'), fullPage: false })
  await page.mouse.click(targetX, targetY)
  await page.waitForFunction(() => ['done', 'error'].includes(window.__omniframe_store.getState().smartPatchStatus.phase), { timeout: 90000 })
  const linkedPatch = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const patch = state.drawingStrokes.find((stroke) => stroke.tool === 'smart-patch')
    return { phase: state.smartPatchStatus.phase, frames: patch?.smartPatchFrames?.length ?? 0, scope: patch?.temporalScope }
  })
  if (linkedPatch.phase !== 'done' || linkedPatch.frames !== 4 || linkedPatch.scope?.type !== 'span') {
    throw new Error(`OmniFrame range did not drive the patch frames: ${JSON.stringify(linkedPatch)}`)
  }

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.clearDrawingStrokes()
    state.setActiveSelection({ type: 'ellipse', bounds: { x: 0.52, y: 0.52, width: 0.16, height: 0.16 } })
    window.__omniframe_store.setState({ smartPatchStatus: { phase: 'idle', done: 0, total: 0, message: '' } })
  })
  const selectionPatchButton = page.getByTestId('smart-patch-selection-btn')
  await selectionPatchButton.waitFor({ state: 'visible' })
  await selectionPatchButton.click()
  await page.waitForFunction(() => ['done', 'error'].includes(window.__omniframe_store.getState().smartPatchStatus.phase), { timeout: 90000 })
  const selectedPatch = await page.evaluate(async () => {
    const patch = window.__omniframe_store.getState().drawingStrokes.find((stroke) => stroke.tool === 'smart-patch')
    const frame = patch?.smartPatchFrames?.[0]
    if (!frame) return { phase: 'missing', frames: 0, alphaInside: 0, alphaOutside: 0 }
    const image = new Image()
    image.src = frame.dataUrl
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not inspect selection patch output')
    context.drawImage(image, 0, 0)
    const alphaAt = (x, y) => context.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), 1, 1).data[3]
    return {
      phase: window.__omniframe_store.getState().smartPatchStatus.phase,
      frames: patch.smartPatchFrames?.length ?? 0,
      alphaInside: alphaAt(0.6, 0.6),
      alphaOutside: alphaAt(0.05, 0.05),
    }
  })
  if (selectedPatch.phase !== 'done' || selectedPatch.frames !== 4 || selectedPatch.alphaInside < 200 || selectedPatch.alphaOutside !== 0) {
    throw new Error(`Masked selection target was not respected: ${JSON.stringify(selectedPatch)}`)
  }

  await page.evaluate(async () => {
    const store = window.__omniframe_store
    const state = store.getState()
    state.clearDrawingStrokes()
    store.setState({ clips: [], cloneSourcePoint: null })
    const trackId = store.getState().ensureTrack('video')
    store.getState().addClipToTrack(trackId, 'asset-death-note-img', 0)
    const clip = store.getState().clips.find((candidate) => candidate.assetId === 'asset-death-note-img')
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 0.5 })
    const canvas = document.getElementById('of-canvas')
    store.getState().setCloneSourcePoint({ x: 0.2, y: 0.3, sampleDataUrl: canvas?.toDataURL() })
    store.getState().setSmartPatchScope({ mode: 'all' })
    await store.getState().applySmartPatch([{ x: 0.7, y: 0.7, timestamp: Date.now() }])
  })
  const stillResult = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const patch = state.drawingStrokes.find((stroke) => stroke.tool === 'smart-patch')
    return { kind: state.assets.find((asset) => asset.id === state.clips.find((clip) => clip.id === state.selectedClipId)?.assetId)?.kind, count: patch?.smartPatchFrames?.length ?? 0, scope: patch?.temporalScope }
  })
  if (stillResult.kind !== 'image' || stillResult.count !== 1 || stillResult.scope?.type !== 'span') {
    throw new Error(`Still-image Smart Patch did not persist across the image clip: ${JSON.stringify(stillResult)}`)
  }
  console.log(`PASS Smart Patch: ${result.frameCount}-frame clip scope, ${linkedPatch.frames}-frame OmniFrame range, masked selection, and still-image patch verified`)
} finally {
  await browser.close()
}
