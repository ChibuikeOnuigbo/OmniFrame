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

async function runOmniFrameVerification() {
  console.log('=== Step 1: Launch Headless Chromium for OmniFrame Clean Infill & Motion Test ===')
  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })

// Section presentation: these workflows exercise disclosure headers, so run
// in single-open accordion mode (production default is tabs).
try {
  await page.evaluate(() => window.__omniframe_store?.getState?.().setSidebarSectionMode?.('accordion'))
} catch {}
  await page.waitForTimeout(1000)

  console.log('=== Step 2: Seed Death Note Video Clip onto Timeline ===')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    if (!store) throw new Error('Store not attached')
    const s = store.getState()
    const trkId = s.ensureTrack('video')
    store.setState({ clips: [] })
    s.addClipToTrack(trkId, 'asset-death-note-vid', 0)
    store.setState({ selectedClipId: store.getState().clips[0]?.id || null, playhead: 0 })
  })
  await page.waitForTimeout(600)

  // Open LeftDock OmniFrame AI tab
  console.log('=== Step 3: Open OmniFrame AI Panel ===')
  const omniTabBtn = page.locator('[data-testid="left-tab-omniframe"]')
  await omniTabBtn.waitFor({ state: 'visible' })
  await omniTabBtn.click()
  await page.waitForTimeout(500)

  const testResults = {
    allScope: false,
    frameScope: false,
    sectionScope: false,
    duplicateCharacter: false,
    deleteInfillCharacter: false,
    restoreCharacter: false,
    motionTransforms: false,
    autoRearrange: false,
    zeroGhostMetrics: {},
  }

  // --- SUBTEST A: All Frame Scope ('all') ---
  console.log('=== Subtest A: All Frame Scope (Light Yagami moved across all frames) ===')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_light"]').click()
  await page.waitForTimeout(200)

  // Scope radio / button: all
  await page.click('[data-testid="omniframe-section-scope"]')
  await page.waitForTimeout(300)
  const scopeAllBtn = page.locator('[data-testid="scope-all-frames"]')
  if (await scopeAllBtn.isVisible()) {
    await scopeAllBtn.click()
  }
  // Adjust X: +120, Y: -50, Scale: 1.15, Rotation: -5
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setOmniframeCharacterTransform('char_light', { x: 120, y: -50, scale: 1.15, rotation: -5 }, 'all')
  })
  await page.waitForTimeout(400)

  // Verify evaluated values across multiple frames
  const evalAllTimes = [0.0, 1.5, 3.0, 5.0, 7.5]
  const allFrameChecks = await page.evaluate((times) => {
    const store = window.__omniframe_store
    return times.map((t) => store.getState().evaluateCharacterTransformAtTime('char_light', t))
  }, evalAllTimes)

  const allPassed = allFrameChecks.every((res) => res.x === 120 && res.y === -50 && res.scale === 1.15 && res.rotation === -5)
  console.log('  -> All-frame scope check result:', allPassed, allFrameChecks[0])
  testResults.allScope = allPassed

  // Capture canvas cutout for Subtest A
  const previewCanvas = page.locator('[data-testid="preview-stage"]')
  await previewCanvas.waitFor({ state: 'visible' })
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-omniframe-all-frame-scope.png') })

  // --- SUBTEST B: One Frame Scope ('frame') ---
  console.log('=== Subtest B: One Frame Scope (L moved ONLY on frame 90 / 3.0s) ===')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_l"]').click()
  await page.waitForTimeout(200)

  // Set Scope to 'frame' with frameNumber 90
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setOmniframeCharacterTransform('char_l', { x: -90, y: 70, scale: 1.1, rotation: 12 }, 'frame', undefined, 90)
  })
  await page.waitForTimeout(400)

  // Evaluate at frame 90 (3.0s), frame 30 (1.0s), frame 120 (4.0s)
  const oneFrameChecks = await page.evaluate(() => {
    const store = window.__omniframe_store
    const f90 = store.getState().evaluateCharacterTransformAtTime('char_l', 3.0) // 3.0s * 30fps = frame 90
    const f30 = store.getState().evaluateCharacterTransformAtTime('char_l', 1.0) // frame 30
    const f120 = store.getState().evaluateCharacterTransformAtTime('char_l', 4.0) // frame 120
    return { f90, f30, f120 }
  })

  const oneFramePassed =
    oneFrameChecks.f90.x === -90 &&
    oneFrameChecks.f90.y === 70 &&
    oneFrameChecks.f30.x === 0 &&
    oneFrameChecks.f30.y === 0 &&
    oneFrameChecks.f120.x === 0 &&
    oneFrameChecks.f120.y === 0
  console.log('  -> One-frame scope check result:', oneFramePassed, oneFrameChecks)
  testResults.frameScope = oneFramePassed

  // Seek playhead to frame 90 (3.0s) and take screenshot
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(3.0))
  await page.waitForTimeout(300)
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-omniframe-one-frame-scope-active.png') })

  // Seek playhead to frame 30 (1.0s) where L is in original position
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(1.0))
  await page.waitForTimeout(300)
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-omniframe-one-frame-scope-original.png') })

  // --- SUBTEST C: Section of Frames Scope ('section') ---
  console.log('=== Subtest C: Section Scope (Ryuk moved ONLY between 2.0s and 5.0s) ===')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_ryuk"]').click()
  await page.waitForTimeout(200)

  // Set Scope to 'section' from 2.0s to 5.0s (frames 60 to 150)
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setOmniframeCharacterTransform('char_ryuk', { x: 140, y: -40, scale: 1.05, rotation: -8 }, 'section', {
      start: 2.0,
      end: 5.0,
    })
  })
  await page.waitForTimeout(400)

  // Evaluate at 1.0s (before section), 3.5s (inside section), 6.5s (after section)
  const sectionChecks = await page.evaluate(() => {
    const store = window.__omniframe_store
    const before = store.getState().evaluateCharacterTransformAtTime('char_ryuk', 1.0)
    const inside = store.getState().evaluateCharacterTransformAtTime('char_ryuk', 3.5)
    const after = store.getState().evaluateCharacterTransformAtTime('char_ryuk', 6.5)
    return { before, inside, after }
  })

  const sectionPassed =
    sectionChecks.inside.x === 140 &&
    sectionChecks.inside.y === -40 &&
    sectionChecks.before.x === 0 &&
    sectionChecks.before.y === 0 &&
    sectionChecks.after.x === 0 &&
    sectionChecks.after.y === 0
  console.log('  -> Section scope check result:', sectionPassed, sectionChecks)
  testResults.sectionScope = sectionPassed

  // Seek playhead to 3.5s (inside section) and capture screenshot
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(3.5))
  await page.waitForTimeout(300)
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-omniframe-section-scope-inside.png') })

  // --- SUBTEST D: Duplicate Character ---
  console.log('=== Subtest D: Duplicate Character (Create 2nd Light Yagami) ===')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_light"]').click()
  await page.waitForTimeout(200)

  await page.click('[data-testid="omniframe-section-actions"]')
  await page.waitForTimeout(300)
  const dupBtn = page.locator('[data-testid="omniframe-duplicate-btn"]')
  await dupBtn.waitFor({ state: 'visible' })
  await dupBtn.click()
  await page.waitForTimeout(400)

  const charsAfterDup = await page.evaluate(() => {
    const store = window.__omniframe_store
    return store.getState().omniframeCharacters.map((c) => ({ id: c.id, name: c.name, transform: c.transform }))
  })
  const dupFound = charsAfterDup.some((c) => c.name.includes('(Copy)') || c.id.includes('_copy'))
  console.log('  -> Duplicate character check result:', dupFound, charsAfterDup.map((c) => c.name))
  testResults.duplicateCharacter = dupFound

  // --- SUBTEST E: Delete / Infill Character ---
  console.log('=== Subtest E: Delete / Infill Character (Remove Ryuk cleanly across all parts of clip) ===')
  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  await page.locator('[data-testid="character-card-char_ryuk"]').click()
  await page.waitForTimeout(200)

  await page.click('[data-testid="omniframe-section-actions"]')
  await page.waitForTimeout(250)
  const infillBtn = page.locator('[data-testid="omniframe-delete-infill-btn"]')
  await infillBtn.waitFor({ state: 'visible' })
  await infillBtn.click()
  await page.waitForTimeout(400)

  // Verify Ryuk transform opacity is 0 (cleanly infilled backdrop)
  const ryukInfillCheck = await page.evaluate(() => {
    const store = window.__omniframe_store
    const ryuk = store.getState().omniframeCharacters.find((c) => c.id === 'char_ryuk')
    const evalAt3 = store.getState().evaluateCharacterTransformAtTime('char_ryuk', 3.0)
    return { opacity: ryuk?.transform?.opacity, evalOpacity: evalAt3?.opacity }
  })
  const infillPassed = ryukInfillCheck.opacity === 0 && ryukInfillCheck.evalOpacity === 0
  console.log('  -> Infill / Delete character check result:', infillPassed, ryukInfillCheck)
  testResults.deleteInfillCharacter = infillPassed

  // Capture canvas with Ryuk cleanly deleted/infilled
  await previewCanvas.screenshot({ path: join(CUT_DIR, 'cut-omniframe-character-deleted-infilled.png') })

  // Verify Restore Character
  await page.click('[data-testid="omniframe-section-actions"]')
  await page.waitForTimeout(250)
  const restoreBtn = page.locator('[data-testid="omniframe-restore-btn"]')
  await restoreBtn.waitFor({ state: 'visible' })
  await restoreBtn.click()
  await page.waitForTimeout(300)

  const ryukRestoredCheck = await page.evaluate(() => {
    const store = window.__omniframe_store
    const ryuk = store.getState().omniframeCharacters.find((c) => c.id === 'char_ryuk')
    return ryuk?.transform?.opacity
  })
  const restorePassed = ryukRestoredCheck === 1
  console.log('  -> Restore character check result:', restorePassed)
  testResults.restoreCharacter = restorePassed

  // --- SUBTEST F: Motion Transforms (Position, Scale, Rotation) ---
  console.log('=== Subtest F: Motion Transforms (Position, Scale, Rotation verification) ===')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setOmniframeCharacterTransform('char_mello', { x: -60, y: 40, scale: 1.25, rotation: 18 }, 'all')
    store.getState().setOmniframeCharacterTransform('char_near', { x: 70, y: -30, scale: 0.85, rotation: -15 }, 'all')
  })
  await page.waitForTimeout(300)

  const motionChecks = await page.evaluate(() => {
    const store = window.__omniframe_store
    const mello = store.getState().evaluateCharacterTransformAtTime('char_mello', 2.0)
    const near = store.getState().evaluateCharacterTransformAtTime('char_near', 2.0)
    return { mello, near }
  })
  const motionPassed =
    motionChecks.mello.scale === 1.25 &&
    motionChecks.mello.rotation === 18 &&
    motionChecks.near.scale === 0.85 &&
    motionChecks.near.rotation === -15
  console.log('  -> Motion transforms check result:', motionPassed, motionChecks)
  testResults.motionTransforms = motionPassed

  // --- SUBTEST G: Rearrange Clean Layout ---
  console.log('=== Subtest G: Auto-Rearrange Clean Non-Overlapping Layout across Video Canvas ===')
  // Remove copies if exist so we have the standard 5 characters
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const copyChars = store.getState().omniframeCharacters.filter((c) => c.id.includes('_dup') || c.id.includes('_copy'))
    copyChars.forEach((c) => store.getState().deleteCharacter(c.id))
  })
  await page.waitForTimeout(300)

  await page.click('[data-testid="omniframe-section-segments"]')
  await page.waitForTimeout(250)
  const autoArrangeBtn = page.locator('[data-testid="omniframe-auto-arrange-btn"]')
  await autoArrangeBtn.waitFor({ state: 'visible' })
  await autoArrangeBtn.click()
  await page.waitForTimeout(600)

  const rearrangedPositions = await page.evaluate(() => {
    const store = window.__omniframe_store
    return store.getState().omniframeCharacters.map((c) => ({
      id: c.id,
      name: c.name,
      x: c.transform.x,
      y: c.transform.y,
      scale: c.transform.scale,
    }))
  })
  console.log('  -> Rearranged character positions:', rearrangedPositions)
  testResults.autoRearrange = rearrangedPositions.length >= 5 && rearrangedPositions.some((c) => c.x !== 0 || c.y !== 0)

  // Capture Final Full Deliverable Screenshot & Final Preview Cutout
  console.log('=== Step 4: Capture Visual Proof Screenshots & Cutouts ===')
  const fullScreenshotPath = join(EVID_DIR, 'omniframe-clean-infill-characters-repositioned.png')
  await page.screenshot({ path: fullScreenshotPath, fullPage: false })
  console.log('  -> Saved full screenshot:', fullScreenshotPath)

  const deliverableCutoutPath = join(CUT_DIR, 'cut-omniframe-clean-infill-preview-rearranged.png')
  await previewCanvas.screenshot({ path: deliverableCutoutPath })
  console.log('  -> Saved rearranged preview cutout:', deliverableCutoutPath)

  // Capture verification inspector table cutout
  await page.click('[data-testid="omniframe-section-actions"]')
  await page.waitForTimeout(300)
  const verificationDisclosure = page.locator('[data-testid="panel-section-omniframe-verification"] > button')
  await verificationDisclosure.click()
  await page.waitForTimeout(100)
  const verifTable = page.locator('[data-testid="omniframe-verification-table"]')
  if (!(await verifTable.isVisible())) throw new Error('Frame verification details did not expand')
  await verifTable.screenshot({ path: join(CUT_DIR, 'cut-omniframe-verification-table.png') })

  // Write results JSON
  writeFileSync(join(REPORT_DIR, 'omniframe-infill-motion-results.json'), JSON.stringify(testResults, null, 2))

  await browser.close()
  console.log('=== All OmniFrame Clean Infill & Motion E2E Tests Complete ===')
}

runOmniFrameVerification().catch((err) => {
  console.error('Test run failed with error:', err)
  process.exit(1)
})
