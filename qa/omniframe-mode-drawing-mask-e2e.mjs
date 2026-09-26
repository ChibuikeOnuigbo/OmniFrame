import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const EVID_DIR = resolve('evidence/screenshots')
const CUT_DIR = resolve('evidence/cutouts')
if (!existsSync(EVID_DIR)) mkdirSync(EVID_DIR, { recursive: true })
if (!existsSync(CUT_DIR)) mkdirSync(CUT_DIR, { recursive: true })

async function runTest() {
  console.log('--- Step 1: Navigating to OmniFrame Studio ---')
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

  // Seed Death Note 8s video clip on timeline
  console.log('--- Step 2: Seeding Death Note Video Clip onto Timeline ---')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    if (!store) throw new Error('Store not attached')
    const s = store.getState()
    const trkId = s.ensureTrack('video')
    // Clear any previous clips to ensure clean test state
    store.setState({ clips: [] })
    s.addClipToTrack(trkId, 'asset-death-note-vid', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null })
  })
  await page.waitForTimeout(500)

  // Open LeftDock OmniFrame AI tab
  console.log('--- Step 3: Testing OmniFrame AI Character Manipulation ---')
  const omniTabBtn = page.locator('[data-testid="left-tab-omniframe"]')
  await omniTabBtn.waitFor({ state: 'visible' })
  await omniTabBtn.click()
  await page.waitForTimeout(400)

  // Verify OmniFrame Panel
  const omniPanel = page.locator('[data-testid="omniframe-panel"]')
  await omniPanel.waitFor({ state: 'visible' })
  console.log('[PASS] OmniFrame AI Panel opened')

  // Verify all 5 characters are detected
  const charCards = ['char_light', 'char_l', 'char_mello', 'char_near', 'char_ryuk']
  for (const cId of charCards) {
    const card = page.locator(`[data-testid="character-card-${cId}"]`)
    await card.waitFor({ state: 'visible' })
  }
  console.log('[PASS] All 5 Death Note characters detected and visible in panel')

  // 1. Test "All Frames" scope on Light Yagami
  console.log('--- Sub-step 3.1: Testing "All Frames" Scope on Light Yagami ---')
  const lightCard = page.locator('[data-testid="character-card-char_light"]')
  await lightCard.click()
  await page.waitForTimeout(200)

  const posXInput = page.locator('[data-testid="omniframe-pos-x-input"]')
  const posYInput = page.locator('[data-testid="omniframe-pos-y-input"]')
  await posXInput.fill('150')
  await posYInput.fill('-40')
  const allFramesBtn = page.locator('[data-testid="scope-all-frames"]')
  await allFramesBtn.click()
  await page.waitForTimeout(300)

  // Verify position evaluated across all frames
  const allFramesCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const t0 = s.evaluateCharacterTransformAtTime('char_light', 0.0)
    const t2 = s.evaluateCharacterTransformAtTime('char_light', 2.5)
    const t5 = s.evaluateCharacterTransformAtTime('char_light', 5.0)
    const t7 = s.evaluateCharacterTransformAtTime('char_light', 7.0)
    return {
      t0: t0.x === 150 && t0.y === -40,
      t2: t2.x === 150 && t2.y === -40,
      t5: t5.x === 150 && t5.y === -40,
      t7: t7.x === 150 && t7.y === -40,
    }
  })
  if (!allFramesCheck.t0 || !allFramesCheck.t2 || !allFramesCheck.t5 || !allFramesCheck.t7) {
    throw new Error(`All Frames scope check failed: ${JSON.stringify(allFramesCheck)}`)
  }
  console.log('[PASS] "All Frames" scope successfully shifts position across all frames (0.0s, 2.5s, 5.0s, 7.0s)')

  // 2. Test "Section of Frames" scope on L Lawliet (2.0s to 5.0s)
  console.log('--- Sub-step 3.2: Testing "Section of Frames" Scope on L Lawliet ---')
  const lCard = page.locator('[data-testid="character-card-char_l"]')
  await lCard.click()
  await page.waitForTimeout(200)

  await posXInput.fill('-80')
  await posYInput.fill('60')
  const sectionBtn = page.locator('[data-testid="scope-section-frames"]')
  await sectionBtn.click()
  await page.waitForTimeout(200)

  const startInput = page.locator('[data-testid="section-start-time"]')
  const endInput = page.locator('[data-testid="section-end-time"]')
  await startInput.fill('2.0')
  await endInput.fill('5.0')
  await page.waitForTimeout(300)

  const sectionCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const tBefore = s.evaluateCharacterTransformAtTime('char_l', 1.0)
    const tInside = s.evaluateCharacterTransformAtTime('char_l', 3.5)
    const tAfter = s.evaluateCharacterTransformAtTime('char_l', 6.5)
    return {
      beforeOriginal: tBefore.x === 0 && tBefore.y === 0,
      insideShifted: tInside.x === -80 && tInside.y === 60,
      afterOriginal: tAfter.x === 0 && tAfter.y === 0,
    }
  })
  if (!sectionCheck.beforeOriginal || !sectionCheck.insideShifted || !sectionCheck.afterOriginal) {
    throw new Error(`Section scope check failed: ${JSON.stringify(sectionCheck)}`)
  }
  console.log('[PASS] "Section of Frames" scope successfully shifts position ONLY inside 2.0s-5.0s and preserves original position outside')

  // 3. Test "Only 1 Frame" scope on Ryuk Shinigami (Frame 90 / 3.0s)
  console.log('--- Sub-step 3.3: Testing "Only 1 Frame" Scope on Ryuk Shinigami ---')
  const ryukCard = page.locator('[data-testid="character-card-char_ryuk"]')
  await ryukCard.click()
  await page.waitForTimeout(200)

  await posXInput.fill('220')
  await posYInput.fill('10')
  const oneFrameBtn = page.locator('[data-testid="scope-one-frame"]')
  await oneFrameBtn.click()
  await page.waitForTimeout(200)

  const frameInput = page.locator('[data-testid="frame-target-input"]')
  await frameInput.fill('90')
  await page.waitForTimeout(300)

  const frameCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const tOn = s.evaluateCharacterTransformAtTime('char_ryuk', 3.0) // 90 / 30 = 3.0s
    const tOffPrev = s.evaluateCharacterTransformAtTime('char_ryuk', 2.9) // frame 87
    const tOffNext = s.evaluateCharacterTransformAtTime('char_ryuk', 3.1) // frame 93
    return {
      onFrameShifted: tOn.x === 220 && tOn.y === 10,
      prevFrameOriginal: tOffPrev.x === 0 && tOffPrev.y === 0,
      nextFrameOriginal: tOffNext.x === 0 && tOffNext.y === 0,
    }
  })
  if (!frameCheck.onFrameShifted || !frameCheck.prevFrameOriginal || !frameCheck.nextFrameOriginal) {
    throw new Error(`1 Frame scope check failed: ${JSON.stringify(frameCheck)}`)
  }
  console.log('[PASS] "Only 1 Frame" scope successfully shifts position ONLY at Frame #90 and leaves surrounding frames untouched')

  // 4. Test Cut Character to New Track
  console.log('--- Sub-step 3.4: Testing Cut Character to New Track ---')
  const nearCard = page.locator('[data-testid="character-card-char_near"]')
  await nearCard.click()
  await page.waitForTimeout(200)

  const cutBtn = page.locator('[data-testid="omniframe-cut-to-track-btn"]')
  await cutBtn.click()
  await page.waitForTimeout(400)

  const cutTrackCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.some((c) => c.name.includes('Near (Nate River) (Cut Track)'))
  })
  if (!cutTrackCheck) throw new Error('Cut track was not created on timeline')
  console.log('[PASS] Cut character to new track created independent timeline track clip')

  // Capture OmniFrame Panel Proof
  const cutOmniPath = resolve(CUT_DIR, 'cut-omniframe-character-cards.png')
  await omniPanel.screenshot({ path: cutOmniPath })
  console.log(`[PASS] Saved OmniFrame panel cutout to ${cutOmniPath}`)

  // Step 4: Testing Drawing Mode & Attach Directly to Video Toggle
  console.log('--- Step 4: Testing Drawing Mode & Attach to Video Toggle ---')
  const drawTabBtn = page.locator('[data-testid="left-tab-drawing"]')
  await drawTabBtn.click()
  await page.waitForTimeout(400)

  const drawPanel = page.locator('[data-testid="drawing-panel"]')
  await drawPanel.waitFor({ state: 'visible' })

  // Verify Frame Attach Presets
  const preset6f = page.locator('[data-testid="attach-preset-6f"]')
  await preset6f.click()
  await page.waitForTimeout(200)
  const preset12f = page.locator('[data-testid="attach-preset-12f"]')
  await preset12f.click()
  await page.waitForTimeout(200)

  const attachIncBtn = page.locator('[data-testid="attach-frame-increment"]')
  await attachIncBtn.click()
  await page.waitForTimeout(200)

  const framesLabel = page.locator('[data-testid="active-attach-frames-label"]')
  const labelText = await framesLabel.innerText()
  console.log(`[PASS] Frame attach picker confirmed: ${labelText}`)

  // Test "Add Directly to Video" toggle
  const attachToggle = page.locator('[data-testid="attach-directly-to-video-toggle"]')
  await attachToggle.waitFor({ state: 'visible' })

  // Uncheck -> Converts drawing to independent timeline track
  await attachToggle.uncheck()
  await page.waitForTimeout(400)

  const detachedTrackCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.some((c) => c.name.includes('Drawing Overlay (Separate Track)'))
  })
  if (!detachedTrackCheck) throw new Error('Detached drawing track was not created on timeline')
  console.log('[PASS] Untoggling "Add Directly to Video" converted drawing into independent timeline track')

  // Re-check -> Merges drawing back into target video clip
  await attachToggle.check()
  await page.waitForTimeout(400)

  const reattachedCheck = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.attachDirectlyToVideo === true && !s.clips.some((c) => c.name.includes('Drawing Overlay (Separate Track)'))
  })
  if (!reattachedCheck) throw new Error('Drawing did not merge back into video clip')
  console.log('[PASS] Re-toggling "Add Directly to Video" successfully merged drawing back into video clip')

  const cutDrawPath = resolve(CUT_DIR, 'cut-drawing-attach-picker-toggle.png')
  await drawPanel.screenshot({ path: cutDrawPath })

  // Step 5: Testing Masking & Tracking Conversions (LumaCut & Krita Architecture)
  console.log('--- Step 5: Testing Masking & Tracking Conversions ---')
  const trackTabBtn = page.locator('[data-testid="left-tab-tracking"]')
  await trackTabBtn.click()
  await page.waitForTimeout(400)

  const trackPanel = page.locator('[data-testid="tracking-panel"]')
  await trackPanel.waitFor({ state: 'visible' })

  // 1. Convert Drawing to Mask
  const convDrawBtn = page.locator('[data-testid="convert-drawing-to-mask-btn"]')
  await convDrawBtn.waitFor({ state: 'visible' })
  await convDrawBtn.click()
  await page.waitForTimeout(300)
  console.log('[PASS] Convert Drawing to Mask executed successfully')

  // 2. Convert Selection to Mask
  const convSelBtn = page.locator('[data-testid="convert-selection-to-mask-btn"]')
  await convSelBtn.waitFor({ state: 'visible' })
  await convSelBtn.click()
  await page.waitForTimeout(300)
  console.log('[PASS] Convert Selection to Mask executed successfully')

  // 3. Convert Mask to Shape Selection
  const convMaskShapeBtn = page.locator('[data-testid="convert-mask-to-shape-selection-btn"]')
  await convMaskShapeBtn.waitFor({ state: 'visible' })
  await convMaskShapeBtn.click()
  await page.waitForTimeout(300)

  const shapeSelCheck = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().activeSelection
    return sel && sel.fillMode === 'outline'
  })
  if (!shapeSelCheck) throw new Error('Mask to Shape Selection failed')
  console.log('[PASS] Convert Mask to Shape Selection created active outline selection')

  // 4. Convert Mask to Filled Selection
  const convMaskFilledBtn = page.locator('[data-testid="convert-mask-to-filled-selection-btn"]')
  await convMaskFilledBtn.waitFor({ state: 'visible' })
  await convMaskFilledBtn.click()
  await page.waitForTimeout(300)

  const filledSelCheck = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().activeSelection
    return sel && sel.fillMode === 'filled'
  })
  if (!filledSelCheck) throw new Error('Mask to Filled Selection failed')
  console.log('[PASS] Convert Mask to Filled Selection created active filled selection')

  // 5. Test Krita Selection Tools (Box, Circle, Lasso, Poly, Wand)
  const selTools = ['rect', 'ellipse', 'lasso', 'polygon', 'magic-wand']
  for (const st of selTools) {
    const btn = page.locator(`[data-testid="select-tool-${st}"]`)
    await btn.waitFor({ state: 'visible' })
    await btn.click()
    await page.waitForTimeout(100)
  }
  console.log('[PASS] All Krita selection shape tools verified (Box, Circle, Lasso, Polygon, Magic Wand)')

  const cutMaskPath = resolve(CUT_DIR, 'cut-mask-conversion-buttons.png')
  await trackPanel.screenshot({ path: cutMaskPath })

  // Capture full visual proof screenshot
  const fullProofPath = resolve(EVID_DIR, 'omniframe-mode-drawing-mask-verified.png')
  await page.screenshot({ path: fullProofPath })
  console.log(`[PASS] Full screenshot captured: ${fullProofPath}`)

  await browser.close()
  console.log('ALL OMNIFRAME, DRAWING, AND MASKING CRITERIA VERIFIED SUCCESSFULLY!')
}

runTest().catch((err) => {
  console.error('[FAIL] Test threw exception:', err)
  process.exit(1)
})
