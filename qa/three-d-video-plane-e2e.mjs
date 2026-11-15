import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SHOTS = join(ROOT, 'evidence/screenshots')
mkdirSync(SHOTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(String(error)))

try {
  console.log('--- Step 1: Navigating to OmniFrame ---')
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })

  // Decode real local footage; a fake URL and a ticking empty timeline are
  // not evidence that the 2.5D plane carries moving video.
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().newProject()
    const s = store.getState()
    s.addAsset({ id: 'test-vid-1', name: 'Cinematic fixture', kind: 'video', duration: 8,
      width: 640, height: 360, fps: 24, size: 100, url: '/qa/fixtures/pexels-cinematic-8s.webm' })
    const track = s.createTrack('video')
    store.getState().addClipToTrack(track, 'test-vid-1', 0)
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="program-preview-canvas"]')
    const pixels = canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    return pixels?.some((value, index) => index % 4 !== 3 && value > 40)
  }, null, { timeout: 10000 })

  console.log('--- Step 2: Activating 3D Mode ("3D in 2D") ---')
  const btn3D = page.locator('[data-testid="toggle-3d-btn"], [data-testid="preview-3d-btn"]').first()
  assert(await btn3D.isVisible(), '3D Mode toggle button is visible')
  await btn3D.click()
  await page.waitForTimeout(600)

  const stage3D = page.locator('[data-testid="preview-3d-stage"]')
  assert(await stage3D.isVisible(), '3D Mode stage mounted and visible')
  console.log('[PASS] 3D Mode stage active')

  console.log('--- Step 3: Verifying 3D HUD Toolbar & Camera Aiming ---')
  const hudToolbar = page.locator('[data-testid="three-hud-toolbar"]')
  assert(await hudToolbar.isVisible(), '3D HUD Toolbar is visible')
  const hudBox = await hudToolbar.boundingBox()
  const statusEl = page.locator('[data-testid="camera-aim-status"]')
  const statusBox = await statusEl.boundingBox()
  console.log('hudBox:', hudBox)
  console.log('statusBox:', statusBox)
  const aimComposite = page.locator('[data-testid="aim-composite-btn"]')
  const aimVideo = page.locator('[data-testid="aim-video-btn"]')
  const aimObject = page.locator('[data-testid="aim-object-btn"]')

  assert(await aimComposite.isVisible(), '3D in 2D Composite aim button visible')
  assert(await aimVideo.isVisible(), 'Video Plane aim button visible')
  assert(await aimObject.isVisible(), '3D Object aim button visible')

  // Aim at Video Plane
  await aimVideo.click()
  await page.waitForTimeout(300)
  let statusText = await statusEl.innerText()
  // The status pill is a compact indicator ("Video Plane"); the longer
  // "2.5D Video Plane" wording only appears in the aim button's tooltip.
  assert(statusText.includes('Video Plane'), `Camera aim status correctly updated to Video Plane (got: "${statusText}")`)
  console.log('[PASS] Aim Video Plane verified')

  // Aim at 3D Object
  await aimObject.click()
  await page.waitForTimeout(300)
  statusText = await statusEl.innerText()
  assert(statusText.includes('3D Object'), `Camera aim status correctly updated to 3D Object (got: "${statusText}")`)
  console.log('[PASS] Aim 3D Object verified')

  // Aim at 3D in 2D Composite
  await aimComposite.click()
  await page.waitForTimeout(300)
  statusText = await statusEl.innerText()
  assert(statusText.includes('3D in 2D'), `Camera aim status correctly updated to 3D in 2D (got: "${statusText}")`)
  console.log('[PASS] Aim 3D in 2D Composite verified')

  console.log('--- Step 4: Testing 3D Primitive Switches & Wireframe/Grid ---')
  const sphereBtn = page.locator('[data-testid="three-primitive-sphere"]')
  assert(await sphereBtn.isVisible(), 'Sphere primitive button visible')
  await sphereBtn.click()
  await page.waitForTimeout(200)

  const diamondBtn = page.locator('[data-testid="three-primitive-diamond"]')
  assert(await diamondBtn.isVisible(), 'Diamond primitive button visible')
  await diamondBtn.click()
  await page.waitForTimeout(200)

  const wireframeBtn = page.locator('[data-testid="wireframe-toggle-btn"]')
  await wireframeBtn.click()
  await page.waitForTimeout(200)
  await wireframeBtn.click() // toggle back
  const persistedPrimitive = await page.evaluate(() => {
    const object = window.__omniframe_store.getState().scene3DObjects[0]
    return { type: object?.type, wireframe: object?.wireframe }
  })
  assert.deepStrictEqual(persistedPrimitive, { type: 'diamond', wireframe: false }, 'The active primitive and wireframe state are stored for .omni/OBJ')

  console.log('[PASS] 3D Primitives and project-state sync verified')

  console.log('--- Step 5: Testing Live Video Playback Continuation in 3D ---')
  const playBtn = page.locator('[data-testid="three-play-btn"]')
  assert(await playBtn.isVisible(), 'Play button in 3D HUD is visible')
  const initialPlaying = await page.evaluate(() => window.__omniframe_store.getState().playing)
  assert.strictEqual(initialPlaying, false, 'Playback is initially paused')

  // Trigger Play in 3D
  const beforeFrame = await page.locator('[data-testid="three-canvas-element"]').screenshot()
  await playBtn.click()
  await page.waitForTimeout(800)

  const isPlayingNow = await page.evaluate(() => window.__omniframe_store.getState().playing)
  assert.strictEqual(isPlayingNow, true, 'Video playback started and is actively playing in 3D mode')
  const playhead = await page.evaluate(() => window.__omniframe_store.getState().playhead)
  assert(playhead > 0, `Playhead advanced during 3D playback (current: ${playhead.toFixed(2)}s)`)
  const afterFrame = await page.locator('[data-testid="three-canvas-element"]').screenshot()
  assert(!beforeFrame.equals(afterFrame), 'the rendered 3D canvas changes while the camera and objects stay fixed')
  const decoded = await page.evaluate(() => [...document.querySelectorAll('video')].some(video =>
    video.getAttribute('src') === '/qa/fixtures/pexels-cinematic-8s.webm' && video.readyState >= 2 && video.currentTime > 0))
  assert(decoded, 'real source frames are decoded during playback')
  console.log(`[PASS] Video continuing to play in 3D mode (playhead: ${playhead.toFixed(2)}s)`)

  // Step 6: Interactive Camera Drag (Orbit)
  const canvasWrapper = page.locator('[data-testid="three-canvas-wrapper"]')
  const box = await canvasWrapper.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
  }

  // Step 7: Capture Visual Evidence Screenshot
  const shotPath = join(SHOTS, 'three-d-video-plane-composite.png')
  await page.screenshot({ path: shotPath })
  console.log(`[PASS] Visual proof screenshot saved to ${shotPath}`)

  assert.deepEqual(errors, [], 'the 3D workflow must not raise browser exceptions')
  console.log('PASS real video plane, changing playback pixels, camera controls and persisted primitive settings')
} catch (err) {
  console.error('Test failed:', err)
  process.exit(1)
} finally {
  await browser.close()
}
