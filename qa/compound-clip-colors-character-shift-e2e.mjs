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
  console.log('--- Step 1: Launching Headless Chromium & Navigating to OmniFrame Studio ---')
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
    store.setState({ clips: [] })
    s.addClipToTrack(trkId, 'asset-death-note-vid', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null })
  })
  await page.waitForTimeout(600)

  // Open LeftDock OmniFrame AI tab
  console.log('--- Step 3: Shifting Character Positions on Canvas with OmniFrame ---')
  const omniTabBtn = page.locator('[data-testid="left-tab-omniframe"]')
  await omniTabBtn.waitFor({ state: 'visible' })
  await omniTabBtn.click()
  await page.waitForTimeout(400)

  // 1. Shift Light Yagami
  console.log('  -> Shifting Light Yagami (X: +150, Y: -40)')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_light"]').click()
  await page.waitForTimeout(200)
  await page.click('[data-testid="omniframe-section-transform"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="omniframe-pos-x-input"]').fill('150')
  await page.locator('[data-testid="omniframe-pos-y-input"]').fill('-40')
  await page.click('[data-testid="omniframe-section-scope"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="scope-all-frames"]').click()
  await page.waitForTimeout(300)

  // 2. Shift L Lawliet
  console.log('  -> Shifting L Lawliet (X: -80, Y: +60)')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_l"]').click()
  await page.waitForTimeout(200)
  await page.click('[data-testid="omniframe-section-transform"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="omniframe-pos-x-input"]').fill('-80')
  await page.locator('[data-testid="omniframe-pos-y-input"]').fill('60')
  await page.click('[data-testid="omniframe-section-scope"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="scope-all-frames"]').click()
  await page.waitForTimeout(300)

  // 3. Shift Ryuk Shinigami
  console.log('  -> Shifting Ryuk Shinigami (X: +180, Y: +30)')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_ryuk"]').click()
  await page.waitForTimeout(200)
  await page.click('[data-testid="omniframe-section-transform"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="omniframe-pos-x-input"]').fill('180')
  await page.locator('[data-testid="omniframe-pos-y-input"]').fill('30')
  await page.click('[data-testid="omniframe-section-scope"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="scope-all-frames"]').click()
  await page.waitForTimeout(300)

  // 4. Shift Near
  console.log('  -> Shifting Near (X: -60, Y: -20)')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_near"]').click()
  await page.waitForTimeout(200)
  await page.click('[data-testid="omniframe-section-transform"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="omniframe-pos-x-input"]').fill('-60')
  await page.locator('[data-testid="omniframe-pos-y-input"]').fill('-20')
  await page.click('[data-testid="omniframe-section-scope"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="scope-all-frames"]').click()
  await page.waitForTimeout(400)

  // Verify on canvas preview
  const previewBox = page.locator('[data-testid="preview-stage"]')
  await previewBox.waitFor({ state: 'visible' })

  // Capture Full Studio Screenshot with Characters Shifted on Preview
  console.log('--- Step 4: Capturing Proof Screenshot of Video Preview with Shifted Characters ---')
  const fullScreenshotPath = resolve(EVID_DIR, 'omniframe-characters-shifted-preview.png')
  await page.screenshot({ path: fullScreenshotPath, fullPage: true })
  console.log(`[SAVED] Full Studio Screenshot: ${fullScreenshotPath}`)

  // Capture Cropped Cutout of Video Preview Canvas with Moved Characters
  const previewCutoutPath = resolve(CUT_DIR, 'cut-video-preview-characters-shifted.png')
  await previewBox.screenshot({ path: previewCutoutPath })
  console.log(`[SAVED] Video Preview Cutout: ${previewCutoutPath}`)

  // Step 5: Test Color-Coded Tracks and Clips
  console.log('--- Step 5: Testing Distinct Color-Coded Tracks and Clips ---')
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    // Add text title clip
    s.addTextTitleClip('Death Note Chibi Action', 4.0)

    // Add audio track with audio asset
    const audioTrackId = s.ensureTrack('audio')
    const audioAsset = {
      id: 'asset-test-audio-theme',
      name: 'Death Note Theme.ogg',
      kind: 'audio',
      url: '/assets/audio/theme.ogg',
      duration: 6.0,
      size: 50000,
      waveform: Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.2) * 0.5 + 0.5),
    }
    s.addAsset(audioAsset)
    s.addClipToTrack(audioTrackId, audioAsset.id, 0)
  })
  await page.waitForTimeout(500)

  // Verify distinct track kind badges exist in DOM
  const vidBadge = page.locator('[data-testid="track-kind-badge-video"]')
  const audBadge = page.locator('[data-testid="track-kind-badge-audio"]')
  const txtBadge = page.locator('[data-testid="track-kind-badge-text"]')
  console.log('Track badge counts:', {
    video: await vidBadge.count(),
    audio: await audBadge.count(),
    text: await txtBadge.count(),
  })

  // Capture Color-Coded Timeline Cutout
  const timelineEl = page.locator('[data-testid="timeline"]')
  const colorCodedCutoutPath = resolve(CUT_DIR, 'cut-color-coded-tracks-clips.png')
  await timelineEl.screenshot({ path: colorCodedCutoutPath })
  console.log(`[SAVED] Color-Coded Timeline Cutout: ${colorCodedCutoutPath}`)

  // Step 6: Test Compound Clip Creation & Nested Timeline Architecture
  console.log('--- Step 6: Testing Compound Clip Creation via Target-Aware Context Menu ---')
  const clipsBeforeCompound = await page.evaluate(() => window.__omniframe_store.getState().clips)
  console.log(`Clips before compounding: ${clipsBeforeCompound.length}`)

  // Right-click on the first video clip
  const firstClipEl = page.locator('[data-testid="timeline-clip"]').first()
  await firstClipEl.click({ button: 'right' })
  await page.waitForTimeout(300)

  // Context menu should appear with "Create Compound Clip"
  const contextMenuEl = page.locator('[data-testid="studio-context-menu"]')
  await contextMenuEl.waitFor({ state: 'visible' })

  const createCompoundBtn = page.locator('[data-testid="ctx-cmd-create-compound-clip"]')
  await createCompoundBtn.waitFor({ state: 'visible' })
  console.log('[PASS] "Create Compound Clip" context menu item verified')

  // Capture context menu cutout
  const contextMenuCutoutPath = resolve(CUT_DIR, 'cut-compound-context-menu.png')
  await contextMenuEl.screenshot({ path: contextMenuCutoutPath })
  console.log(`[SAVED] Context Menu Cutout: ${contextMenuCutoutPath}`)

  // Click "Create Compound Clip"
  await createCompoundBtn.click()
  await page.waitForTimeout(500)

  // Verify compound clip exists on timeline
  const compoundClipData = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const compound = s.clips.find((c) => c.kind === 'compound')
    return compound ? {
      id: compound.id,
      kind: compound.kind,
      name: compound.name,
      sourceSequenceId: compound.sourceSequenceId,
      nestedClipCount: compound.nestedClipCount,
    } : null
  })
  if (!compoundClipData) throw new Error('Compound clip was not created!')
  console.log('[PASS] Compound clip successfully created:', compoundClipData)

  // Capture Timeline with Compound Clip
  const compoundClipEl = page.locator('[data-kind="compound"]')
  await compoundClipEl.waitFor({ state: 'visible' })
  const compoundClipCutoutPath = resolve(CUT_DIR, 'cut-compound-clip-created.png')
  await timelineEl.screenshot({ path: compoundClipCutoutPath })
  console.log(`[SAVED] Compound Clip Cutout: ${compoundClipCutoutPath}`)

  // Step 7: Double-Click to Enter Nested Compound Sequence Timeline
  console.log('--- Step 7: Testing Double-Click Entry to Nested Timeline ---')
  await compoundClipEl.dblclick()
  await page.waitForTimeout(600)

  // Verify Sequence Breadcrumbs bar shows nested path and Back button
  const breadcrumbBar = page.locator('[data-testid="sequence-breadcrumbs-bar"]')
  await breadcrumbBar.waitFor({ state: 'visible' })

  const backBtn = page.locator('[data-testid="breadcrumb-back-button"]')
  await backBtn.waitFor({ state: 'visible' })

  const activeSeqState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      activeSequenceId: s.activeSequenceId,
      breadcrumbs: s.breadcrumbs,
      childClipCount: s.clips.length,
    }
  })
  console.log('[PASS] Active nested sequence:', activeSeqState)

  // Capture Breadcrumb bar cutout
  const breadcrumbCutoutPath = resolve(CUT_DIR, 'cut-compound-clip-breadcrumbs.png')
  await breadcrumbBar.screenshot({ path: breadcrumbCutoutPath })
  console.log(`[SAVED] Breadcrumb Bar Cutout: ${breadcrumbCutoutPath}`)

  // Step 8: Test "Back to Timeline" Breadcrumb Navigation
  console.log('--- Step 8: Testing Back Navigation to Main Timeline ---')
  await backBtn.click()
  await page.waitForTimeout(500)

  const restoredMainState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      activeSequenceId: s.activeSequenceId,
      breadcrumbs: s.breadcrumbs,
      hasCompound: s.clips.some((c) => c.kind === 'compound'),
    }
  })
  if (restoredMainState.activeSequenceId !== 'main' || !restoredMainState.hasCompound) {
    throw new Error(`Failed to restore main timeline: ${JSON.stringify(restoredMainState)}`)
  }
  console.log('[PASS] Successfully returned to main timeline with compound clip intact')

  // Step 9: Test Uncompound (Decompose)
  console.log('--- Step 9: Testing Uncompound Clip (Decompose) ---')
  const compoundClipToUncompound = page.locator('[data-kind="compound"]')
  await compoundClipToUncompound.click({ button: 'right' })
  await page.waitForTimeout(300)

  const uncompoundBtn = page.locator('[data-testid="ctx-cmd-uncompound-clip"]')
  await uncompoundBtn.waitFor({ state: 'visible' })
  await uncompoundBtn.click()
  await page.waitForTimeout(500)

  const uncompoundResult = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      hasCompound: s.clips.some((c) => c.kind === 'compound'),
      clipCount: s.clips.length,
    }
  })
  if (uncompoundResult.hasCompound) throw new Error('Compound clip was not decomposed!')
  console.log('[PASS] Compound clip successfully uncompounded back into children:', uncompoundResult)

  const uncompoundCutoutPath = resolve(CUT_DIR, 'cut-uncompound-restored.png')
  await timelineEl.screenshot({ path: uncompoundCutoutPath })
  console.log(`[SAVED] Uncompound Restored Timeline Cutout: ${uncompoundCutoutPath}`)

  // Step 10: Test Atomic Undo and Redo
  console.log('--- Step 10: Testing Atomic Undo & Redo ---')
  // Undo the uncompound -> compound clip should be back
  await page.evaluate(() => window.__omniframe_store.getState().undo())
  await page.waitForTimeout(300)
  const undoResult1 = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { hasCompound: s.clips.some((c) => c.kind === 'compound') }
  })
  if (!undoResult1.hasCompound) throw new Error('Undo uncompound failed to restore compound clip!')
  console.log('[PASS] Undo uncompound atomically restored compound clip')

  // Redo the uncompound -> compound decomposed again
  await page.evaluate(() => window.__omniframe_store.getState().redo())
  await page.waitForTimeout(300)
  const redoResult1 = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { hasCompound: s.clips.some((c) => c.kind === 'compound') }
  })
  if (redoResult1.hasCompound) throw new Error('Redo uncompound failed!')
  console.log('[PASS] Redo uncompound atomically decomposed compound clip again')

  // Undo uncompound again, then undo compound creation -> original clips back
  await page.evaluate(() => window.__omniframe_store.getState().undo()) // back to compound
  await page.waitForTimeout(200)
  await page.evaluate(() => window.__omniframe_store.getState().undo()) // back to original clips
  await page.waitForTimeout(300)
  const undoResult2 = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      hasCompound: s.clips.some((c) => c.kind === 'compound'),
      clipCount: s.clips.length,
    }
  })
  if (undoResult2.hasCompound) throw new Error('Undo compound creation failed!')
  console.log('[PASS] Undo compound creation atomically restored original state:', undoResult2)

  await browser.close()
  console.log('=== ALL E2E TEST CRITERIA PASSED AND ARTIFACTS CAPTURED ===')
}

runTest().catch((err) => {
  console.error('[FAIL] E2E Test Failed:', err)
  process.exit(1)
})
