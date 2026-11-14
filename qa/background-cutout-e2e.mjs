import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { PNG } from 'pngjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
  const alias = await page.evaluate(async () => {
    const { compositeCutout } = await import('/src/lib/bgRemovalEngine.ts')
    const canvas = document.createElement('canvas')
    canvas.width = 4; canvas.height = 4
    const context = canvas.getContext('2d')
    context.fillStyle = '#d21414'; context.fillRect(0, 0, 4, 4)
    const mask = { width: 4, height: 4, data: new Uint8ClampedArray(16).fill(255) }
    mask.data[0] = 0
    compositeCutout(canvas, mask, { modelId: 'birefnet-general', mode: 'transparent' }, canvas)
    return {
      center: [...context.getImageData(2, 2, 1, 1).data],
      corner: [...context.getImageData(0, 0, 1, 1).data],
    }
  })
  assert(alias.center[0] > 150 && alias.center[3] === 255 && alias.corner[3] === 0,
    `same-canvas compositing preserves source pixels ${JSON.stringify(alias)}`)
  await page.evaluate(() => window.__omniframe_store.getState().newProject())
  const fixture = new PNG({ width: 64, height: 64 })
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const index = (y * 64 + x) * 4
    const subject = x >= 20 && x < 44 && y >= 20 && y < 44
    fixture.data[index] = subject ? 210 : 255
    fixture.data[index + 1] = subject ? 20 : 255
    fixture.data[index + 2] = subject ? 20 : 255
    fixture.data[index + 3] = 255
  }
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'cutout-fixture.png', mimeType: 'image/png', buffer: PNG.sync.write(fixture),
  })
  await page.getByRole('button', { name: /Add cutout-fixture\.png to timeline/ }).click()
  const original = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { clipId: state.clips[0].id, assetId: state.clips[0].assetId }
  })
  const clip = page.locator('[data-testid="timeline-clip"][data-kind="image"]').first()
  await clip.click({ button: 'right' })
  await page.getByText('Quick Background Cutout…').click()
  const modal = page.getByTestId('bg-removal-modal')
  await modal.waitFor()
  await page.getByTestId('preview-bg-removal-btn').click()
  const preview = await modal.locator('canvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d')
    return {
      corner: ctx.getImageData(2, 2, 1, 1).data[3],
      center: ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3],
    }
  })
  assert(preview.corner < 10 && preview.center > 240, `real preview alpha ${JSON.stringify(preview)}`)
  await page.getByTestId('bg-mode-solid').click()
  const solid = await modal.locator('canvas').evaluate(canvas =>
    [...canvas.getContext('2d').getImageData(2, 2, 1, 1).data])
  assert(solid[1] > 180 && solid[0] < 40 && solid[3] === 255,
    `solid replacement paints the cleared backdrop ${solid}`)
  await page.getByTestId('bg-mode-blur').click()
  const blurred = await modal.locator('canvas').evaluate(canvas =>
    [...canvas.getContext('2d').getImageData(2, 2, 1, 1).data])
  assert(blurred[0] > 180 && blurred[3] === 255,
    `blur replacement keeps the source backdrop opaque ${blurred}`)
  await page.getByTestId('bg-mode-transparent').click()
  await page.getByTestId('apply-bg-removal-btn').click()
  await modal.waitFor({ state: 'hidden' })
  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.setMonitorMode('program')
    state.setPlayhead(state.clips[0].start + 0.1)
  })
  await page.waitForTimeout(500)
  const applied = await page.evaluate(async () => {
    const state = window.__omniframe_store.getState()
    const clip = state.clips[0]
    const asset = state.assets.find(item => item.id === clip.assetId)
    const image = new Image()
    image.src = asset.url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const blob = await (await import('/src/lib/projectSubsets.ts')).exportProgramFramePng()
    const frame = await createImageBitmap(blob)
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = frame.width; frameCanvas.height = frame.height
    const frameContext = frameCanvas.getContext('2d')
    frameContext.drawImage(frame, 0, 0)
    const frameCenter = [...frameContext.getImageData(frame.width / 2, frame.height / 2, 1, 1).data]
    const frameCorner = [...frameContext.getImageData(2, 2, 1, 1).data]
    frame.close()
    return {
      clipId: clip.id, assetId: clip.assetId, kind: asset.kind,
      corner: context.getImageData(2, 2, 1, 1).data[3],
      center: context.getImageData(image.width / 2, image.height / 2, 1, 1).data[3],
      originalAssetExists: state.assets.some(item => item.id !== asset.id && item.name === 'cutout-fixture.png'),
      pngBytes: blob.size, frameCenter, frameCorner,
    }
  })
  assert.equal(applied.clipId, original.clipId)
  assert.notEqual(applied.assetId, original.assetId)
  assert.equal(applied.kind, 'image')
  assert(applied.corner < 10 && applied.center > 240, `asset alpha ${JSON.stringify(applied)}`)
  assert(applied.originalAssetExists && applied.pngBytes > 100, 'source retained and Program PNG exported')
  assert(applied.frameCenter[0] > applied.frameCenter[1] + 70 &&
    applied.frameCenter[0] > applied.frameCenter[2] + 70,
  `Program export shows the subject: ${applied.frameCenter}`)
  await page.evaluate(() => window.__omniframe_store.getState().undo())
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].assetId), original.assetId)
  await page.evaluate(() => window.__omniframe_store.getState().redo())
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips[0].assetId), applied.assetId)
  const restored = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const bundle = await store.getState().saveOmniProject('Cutout round trip')
    store.getState().newProject()
    await store.getState().loadOmniProject(new File([bundle], 'cutout.omni'))
    const state = store.getState()
    const asset = state.assets.find(item => item.id === state.clips[0].assetId)
    return { assetId: asset?.id, url: asset?.url, bytes: bundle.size }
  })
  assert.equal(restored.assetId, applied.assetId)
  assert(restored.url?.startsWith('data:image/png;base64,') && restored.bytes > 100,
    'cutout pixels survive an Omni project round trip')
  assert.deepEqual(errors, [])
  console.log('PASS still cutout preview, alpha, Program PNG, undo, redo and project round trip')
} finally {
  await browser.close()
}
