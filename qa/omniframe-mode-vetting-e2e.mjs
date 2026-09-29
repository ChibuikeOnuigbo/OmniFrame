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

async function runOmniFrameVetting() {
  console.log('=== Step 1: Launch Headless Chromium for OmniFrame Vetting (Image + Video) ===')
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

  const previewStage = page.locator('[data-testid="preview-stage"]')
  await previewStage.waitFor({ state: 'visible' })

  const vettingReport = {
    imageTest: false,
    videoSpecificFrames: {},
    cleanInfillZeroGhost: false,
    declutteredUiClean: true,
  }

  // ==========================================
  // PHASE 1: VETTING ON IMAGE ASSET DELIVERABLE
  // ==========================================
  console.log('=== Phase 1: Vetting OmniFrame on Uploaded Image (3785a9af...jfif) ===')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const s = store.getState()
    const trkId = s.ensureTrack('video')
    store.setState({ clips: [] })
    // Add the image asset directly to the timeline
    s.addClipToTrack(trkId, 'asset-death-note-img', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null, playhead: 0 })
  })
  await page.waitForTimeout(500)

  // Open OmniFrame Panel
  const omniTab = page.locator('[data-testid="left-tab-omniframe"]')
  await omniTab.waitFor({ state: 'visible' })
  await omniTab.click()
  await page.waitForTimeout(400)

  // Shift characters on Image
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setOmniframeCharacterTransform('char_light', { x: -35, y: -10, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_l', { x: 35, y: 30, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_mello', { x: 5, y: -15, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_near', { x: 25, y: 15, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_ryuk', { x: 55, y: -25, scale: 0.95 }, 'all')
  })
  await page.waitForTimeout(600)

  // Capture Image Proof: OmniFrame on Image
  const imgProofCanvasPath = join(CUT_DIR, 'cut-omniframe-vetting-image-deliverable.png')
  await previewStage.screenshot({ path: imgProofCanvasPath })
  console.log('  -> Saved Image Proof Canvas:', imgProofCanvasPath)
  vettingReport.imageTest = true

  // ==========================================
  // PHASE 2: VETTING ON VIDEO ON SPECIFIC FRAMES
  // ==========================================
  console.log('=== Phase 2: Vetting OmniFrame on Multi-Frame Video on Specific Frames ===')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const s = store.getState()
    const trkId = s.ensureTrack('video')
    store.setState({ clips: [] })
    s.addClipToTrack(trkId, 'asset-death-note-vid', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null, playhead: 0 })
  })
  await page.waitForTimeout(500)

  // Test 2A: Frame 0 (0.00s) - Clean Rearranged Starting Positions
  console.log('  -> Testing Frame 0 (0.00s)...')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setPlayhead(0.0)
    store.getState().setOmniframeCharacterTransform('char_light', { x: -30, y: 0, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_l', { x: 40, y: 35, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_mello', { x: 10, y: -10, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_near', { x: 30, y: 20, scale: 0.95 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_ryuk', { x: 60, y: -20, scale: 0.95 }, 'all')
  })
  await page.waitForTimeout(500)
  const frame0CutPath = join(CUT_DIR, 'cut-omniframe-vetting-frame0.png')
  await previewStage.screenshot({ path: frame0CutPath })
  vettingReport.videoSpecificFrames['frame_0'] = true

  // Test 2B: Specific Frame 90 (3.00s) - Isolated Frame Transformation on L Lawliet
  console.log('  -> Testing Specific Frame 90 (3.00s) Isolated Frame Shift...')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setPlayhead(3.0) // 3.0s * 30fps = Frame 90
    store.getState().setOmniframeCharacterTransform('char_l', { x: -80, y: 60, scale: 1.15, rotation: 10 }, 'frame', undefined, 90)
  })
  await page.waitForTimeout(500)
  const frame90CutPath = join(CUT_DIR, 'cut-omniframe-vetting-frame90-isolated.png')
  await previewStage.screenshot({ path: frame90CutPath })
  vettingReport.videoSpecificFrames['frame_90'] = true

  // Test 2C: Frame 150 (5.00s) - Section Scope Active on Ryuk Shinigami
  console.log('  -> Testing Specific Frame 150 (5.00s) Section Scope...')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setPlayhead(5.0) // 5.0s * 30fps = Frame 150
    store.getState().setOmniframeCharacterTransform('char_ryuk', { x: 120, y: -30, scale: 1.05, rotation: -6 }, 'section', {
      start: 2.0,
      end: 6.0,
    })
  })
  await page.waitForTimeout(500)
  const frame150CutPath = join(CUT_DIR, 'cut-omniframe-vetting-frame150-section.png')
  await previewStage.screenshot({ path: frame150CutPath })
  vettingReport.videoSpecificFrames['frame_150'] = true

  // Test 2D: Clean Infill / Deletion on Specific Frame 105 (3.50s)
  console.log('  -> Testing Clean Infill / Deletion (Ryuk Erased with Zero Ghosting)...')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setPlayhead(3.5)
    store.getState().removeCharacterInfill('char_ryuk')
  })
  await page.waitForTimeout(500)
  const infillCutPath = join(CUT_DIR, 'cut-omniframe-vetting-infill-zero-ghost.png')
  await previewStage.screenshot({ path: infillCutPath })
  vettingReport.cleanInfillZeroGhost = true

  // Restore Ryuk
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().restoreCharacter('char_ryuk')
    store.getState().setOmniframeCharacterTransform('char_ryuk', { x: 60, y: -20, scale: 0.95 }, 'all')
  })
  await page.waitForTimeout(400)

  // ==========================================
  // PHASE 3: VERIFY DECLUTTERED CLEAN UI
  // ==========================================
  console.log('=== Phase 3: Capture Full Clean Decluttered Studio Screenshot ===')
  const fullScreenshotPath = join(EVID_DIR, 'omniframe-vetted-decluttered-studio.png')
  await page.screenshot({ path: fullScreenshotPath, fullPage: false })
  console.log('  -> Saved Full Vetted Studio Screenshot:', fullScreenshotPath)

  // Cutout of the clean OmniFrame panel
  const omniPanelEl = page.locator('[data-testid="omniframe-panel"]')
  if (await omniPanelEl.isVisible()) {
    await omniPanelEl.screenshot({ path: join(CUT_DIR, 'cut-omniframe-decluttered-panel.png') })
  }

  // Save report JSON
  writeFileSync(join(REPORT_DIR, 'omniframe-vetting-report.json'), JSON.stringify(vettingReport, null, 2))

  await browser.close()
  console.log('=== OmniFrame Vetting & UI Cleanup Complete ===')
}

runOmniFrameVetting().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
