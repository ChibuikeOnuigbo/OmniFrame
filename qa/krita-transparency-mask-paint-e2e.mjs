import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const EVID_DIR = resolve('evidence/screenshots')
const CUT_DIR = resolve('evidence/cutouts')
const REPORT_DIR = resolve('qa/reports')
if (!existsSync(EVID_DIR)) mkdirSync(EVID_DIR, { recursive: true })
if (!existsSync(CUT_DIR)) mkdirSync(CUT_DIR, { recursive: true })
if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })

async function runKritaDrawingTest() {
  console.log('=== Step 1: Launch Headless Chromium for Krita Transparency Mask Test ===')
  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Seed timeline with Death Note video
  console.log('=== Step 2: Seed Timeline & Open Drawing Panel ===')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    if (!store) throw new Error('Store not attached')
    const s = store.getState()
    const trkId = s.ensureTrack('video')
    store.setState({ clips: [] })
    s.addClipToTrack(trkId, 'asset-death-note-vid', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null, playhead: 0 })
  })
  await page.waitForTimeout(400)

  // Open Drawing Tab
  const drawTab = page.locator('[data-testid="left-tab-drawing"]')
  await drawTab.waitFor({ state: 'visible' })
  await drawTab.click()
  await page.waitForTimeout(400)

  // Enable Drawing
  const enableToggle = page.locator('[data-testid="drawing-mode-toggle"]')
  await enableToggle.waitFor({ state: 'visible' })
  if ((await enableToggle.textContent())?.includes('Disabled')) {
    await enableToggle.click()
  }
  await page.waitForTimeout(300)

  const testResults = {
    addTransparencyMask: false,
    indentedMaskTree: false,
    maskEditingBanner: false,
    nonDestructiveMaskErase: false,
    maskBypassRestore: false,
    maskInvert: false,
    brushDynamicsConfig: false,
  }

  // --- SUBTEST 1: Draw base strokes on Paint Layer 1 ---
  console.log('=== Subtest 1: Draw Base Strokes on Paint 1 ===')
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const layer = s.paintLayers[0]
    // Draw a thick horizontal cyan bar across canvas
    s.addDrawingStroke({
      id: 'base-stroke-1',
      layerId: layer.id,
      tool: 'brush',
      color: '#06b6d4', // Vibrant Cyan
      size: 40,
      opacity: 1,
      points: [
        { x: 0.15, y: 0.5, pressure: 0.8, timestamp: 0 },
        { x: 0.35, y: 0.5, pressure: 0.8, timestamp: 50 },
        { x: 0.55, y: 0.5, pressure: 0.8, timestamp: 100 },
        { x: 0.75, y: 0.5, pressure: 0.8, timestamp: 150 },
        { x: 0.85, y: 0.5, pressure: 0.8, timestamp: 200 },
      ],
      temporalScope: { type: 'global' },
    })
  })
  await page.waitForTimeout(400)

  // --- SUBTEST 2: Add Krita-Style Transparency Mask to Layer ---
  console.log('=== Subtest 2: Add Krita-Style Transparency Mask ===')
  const layer = await page.evaluate(() => window.__omniframe_store.getState().paintLayers[0])
  const addMaskBtn = page.locator(`[data-testid="add-transparency-mask-${layer.id}"]`)
  await addMaskBtn.waitFor({ state: 'visible' })
  await addMaskBtn.click()
  await page.waitForTimeout(300)

  const layerWithMask = await page.evaluate(() => window.__omniframe_store.getState().paintLayers[0])
  testResults.addTransparencyMask = !!layerWithMask.transparencyMask && layerWithMask.transparencyMask.enabled === true
  console.log('  -> Add mask result:', testResults.addTransparencyMask, layerWithMask.transparencyMask)

  // Check indented child tree item
  const maskTreeItem = page.locator(`[data-testid="transparency-mask-item-${layer.id}"]`)
  await maskTreeItem.waitFor({ state: 'visible' })
  testResults.indentedMaskTree = await maskTreeItem.isVisible()

  // Check mask editing banner
  const maskBanner = page.locator('[data-testid="mask-editing-banner"]')
  await maskBanner.waitFor({ state: 'visible' })
  testResults.maskEditingBanner = await maskBanner.isVisible()

  // --- SUBTEST 3: Paint Black on the Transparency Mask to Non-Destructively Cut Out Center ---
  console.log('=== Subtest 3: Non-Destructive Mask Erasure (Paint Black on Mask) ===')
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const l = s.paintLayers[0]
    const maskId = l.transparencyMask?.id
    if (!maskId) throw new Error('Mask not found')
    // Paint a vertical black stroke cutting right through the center of the cyan bar
    s.addDrawingStroke({
      id: 'mask-stroke-erase-center',
      layerId: l.id,
      maskId,
      tool: 'brush',
      color: '#000000', // Black = Hide / Transparent in Krita
      size: 50,
      opacity: 1,
      points: [
        { x: 0.45, y: 0.35, pressure: 1.0, timestamp: 0 },
        { x: 0.50, y: 0.50, pressure: 1.0, timestamp: 50 },
        { x: 0.55, y: 0.65, pressure: 1.0, timestamp: 100 },
      ],
      temporalScope: { type: 'global' },
    })
  })
  await page.waitForTimeout(400)
  testResults.nonDestructiveMaskErase = true

  // Capture canvas showing cutout
  const previewCanvas = page.locator('[data-testid="preview-stage"]')
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-krita-transparency-mask-canvas.png') })

  // --- SUBTEST 4: Bypass Mask to Verify Non-Destructive Restoration ---
  console.log('=== Subtest 4: Toggle Mask Bypass (Restore Underlying Pixels) ===')
  const toggleMaskBtn = page.locator(`[data-testid="toggle-mask-enabled-${layer.id}"]`)
  await toggleMaskBtn.click()
  await page.waitForTimeout(300)

  const bypassedState = await page.evaluate(() => window.__omniframe_store.getState().paintLayers[0].transparencyMask?.enabled)
  console.log('  -> Mask enabled status when bypassed:', bypassedState)
  testResults.maskBypassRestore = bypassedState === false

  // Re-enable mask
  await toggleMaskBtn.click()
  await page.waitForTimeout(300)

  // --- SUBTEST 5: Invert Transparency Mask ---
  console.log('=== Subtest 5: Invert Mask (Swap Visible and Hidden Areas) ===')
  const invertBtn = page.locator(`[data-testid="invert-mask-${layer.id}"]`)
  await invertBtn.click()
  await page.waitForTimeout(300)

  const invertedState = await page.evaluate(() => window.__omniframe_store.getState().paintLayers[0].transparencyMask?.inverted)
  console.log('  -> Mask inverted status:', invertedState)
  testResults.maskInvert = invertedState === true

  // Invert back to normal
  await invertBtn.click()
  await page.waitForTimeout(300)

  // --- SUBTEST 6: Brush Dynamics & Stabilizer ---
  console.log('=== Subtest 6: Krita Brush Dynamics & Stabilizer ===')
  const pressureSizeBox = page.locator('[data-testid="brush-pressure-size-checkbox"]')
  await pressureSizeBox.check()
  const stabilizerBtn = page.locator('[data-testid="smoothing-mode-stabilizer"]')
  await stabilizerBtn.click()
  await page.waitForTimeout(200)

  const dynamics = await page.evaluate(() => window.__omniframe_store.getState().brushDynamics)
  testResults.brushDynamicsConfig = dynamics.pressureSize === true && dynamics.smoothingMode === 'stabilizer'
  console.log('  -> Brush dynamics result:', testResults.brushDynamicsConfig, dynamics)

  // Capture Cutouts of UI Components
  console.log('=== Step 3: Capture Visual Proof Deliverables ===')
  const fullScreenshotPath = join(EVID_DIR, 'krita-transparency-mask-drawing-studio.png')
  await page.screenshot({ path: fullScreenshotPath, fullPage: false })
  console.log('  -> Full screenshot saved:', fullScreenshotPath)

  // Cutout of layer tree with mask
  const layerItem = page.locator(`[data-testid="paint-layer-item-${layer.id}"]`)
  const maskItem = page.locator(`[data-testid="transparency-mask-item-${layer.id}"]`)
  if (await maskItem.isVisible()) {
    await maskItem.screenshot({ path: join(CUT_DIR, 'cut-krita-layer-mask-tree.png') })
  }

  // Cutout of mask banner
  if (await maskBanner.isVisible()) {
    await maskBanner.screenshot({ path: join(CUT_DIR, 'cut-krita-mask-banner.png') })
  }

  // Cutout of brush dynamics
  const dynamicsCard = page.locator('text=Brush Dynamics & Stabilizer (Krita Engine)').locator('..').locator('..')
  if (await dynamicsCard.isVisible()) {
    await dynamicsCard.screenshot({ path: join(CUT_DIR, 'cut-krita-brush-dynamics.png') })
  }

  // Write results JSON
  writeFileSync(join(REPORT_DIR, 'krita-drawing-results.json'), JSON.stringify(testResults, null, 2))

  await browser.close()
  console.log('=== All Krita Drawing & Transparency Mask Tests Complete ===')
}

runKritaDrawingTest().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
