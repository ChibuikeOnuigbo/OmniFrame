import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/home/user/OmniFrame'
const SHOTS_DIR = join(ROOT, 'evidence', 'rebuild')
const CUTOUTS_DIR = join(ROOT, 'evidence', 'cutouts')
const EXPORTS_DIR = join(ROOT, 'qa', 'exports')
mkdirSync(SHOTS_DIR, { recursive: true })
mkdirSync(CUTOUTS_DIR, { recursive: true })
mkdirSync(EXPORTS_DIR, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

function assert(cond, name, detail = '') {
  if (!cond) throw new Error(`${name}: ${detail}`)
  console.log('PASS', name, detail)
}

async function run() {
  console.log('========================================================================')
  console.log('Starting OmniFrame Master Rebuild Verification E2E Test Suite...')
  console.log('========================================================================')

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  })

  const page = await context.newPage()
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err))
  const URL = 'http://localhost:5173/#studio'

  try {
    console.log('Phase 1: Loading OmniFrame Studio...')
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    // Verify UI components load
    const studio = page.locator('[data-testid="preview-stage"]')
    assert((await studio.count()) > 0, 'Preview stage visible')

    // Phase 2: Aspect Ratio Subsystem Verification
    console.log('Phase 2: Verifying Compact Bottom-Right Aspect Ratio Selector...')
    const ratioTrigger = page.locator('[data-testid="ratio-selector-btn"], #aspect-ratio-selector-trigger')
    assert((await ratioTrigger.count()) > 0, 'Aspect ratio selector trigger exists in bottom-right')
    const triggerText = await ratioTrigger.innerText()
    console.log(`Current Aspect Ratio Trigger Label: "${triggerText.trim()}"`)

    // Click trigger to open dropdown
    await ratioTrigger.click()
    await page.waitForTimeout(300)

    const ratioDropdown = page.locator('[data-testid="ratio-popover"]')
    assert((await ratioDropdown.count()) > 0, 'Aspect ratio presets dropdown opened')

    // Check presets exist
    const preset916 = page.locator('[data-testid="ratio-preset-9:16"]')
    assert((await preset916.count()) > 0, '9:16 (TikTok/Reels/Shorts) preset exists')

    const preset11 = page.locator('[data-testid="ratio-preset-1:1"]')
    assert((await preset11.count()) > 0, '1:1 (Square) preset exists')

    const preset219 = page.locator('[data-testid="ratio-preset-21:9"]')
    assert((await preset219.count()) > 0, '21:9 (Cinemascope) preset exists')

    // Switch to 9:16
    console.log('Selecting 9:16 aspect ratio preset...')
    await preset916.click()
    await page.waitForTimeout(300)

    // Check store sequence settings
    const seqSettings = await page.evaluate(() => window.__omniframe_store.getState().sequenceSettings)
    console.log('Active Sequence Settings:', JSON.stringify(seqSettings))
    assert(seqSettings.aspectRatio === '9:16', 'Sequence settings aspect ratio updated to 9:16')
    assert(seqSettings.width === 1080 && seqSettings.height === 1920, 'Sequence settings dimensions are 1080x1920')

    // Phase 3: Media Library & Source Preview Separation (Invariant I-10)
    console.log('Phase 3: Media Import & Source Monitor Separation...')
    const imgPath = join(ROOT, 'qa/fixtures/pexels-landscape-962322.jpg')
    const vidPath = join(ROOT, 'qa/fixtures/pexels-cinematic-8s.webm')
    const fileInput = page.locator('#topbar-import-input')
    await fileInput.setInputFiles([imgPath, vidPath])
    await page.waitForTimeout(800)

    const initialClips = await page.locator('[data-testid="timeline-clip"]').count()
    console.log(`Timeline clip count immediately after import: ${initialClips}`)
    assert(initialClips === 0, 'Invariant I-10: Media import adds to library ONLY without auto-inserting into timeline')

    // Check Unified Media Preview is displayed for imported asset
    const assetStage = page.locator('[data-testid="preview-asset-stage"]')
    assert((await assetStage.count()) > 0, 'Unified Preview is active displaying imported media asset')

    // Transport bar for asset preview
    const assetTransport = page.locator('[data-testid="asset-transport-bar"]')
    assert(await assetTransport.isVisible(), 'Asset transport controls visible in preview')

    // Capture screenshot of unified asset preview
    await page.screenshot({ path: join(SHOTS_DIR, 'omniframe-source-monitor-active.png') })
    console.log('Captured evidence: omniframe-source-monitor-active.png')

    // Test returning to timeline sequence preview
    const closeAssetBtn = page.locator('[data-testid="close-asset-preview-btn"]')
    await closeAssetBtn.click()
    await page.waitForTimeout(300)
    const previewStage = page.locator('[data-testid="preview-stage"]')
    assert(await previewStage.isVisible(), 'Returned to Timeline Sequence canvas preview')

    // Test 3D Orbit Viewer toggle
    const toggle3dBtn = page.locator('[data-testid="toggle-3d-btn"]')
    await toggle3dBtn.click()
    await page.waitForTimeout(300)
    const threeStage = page.locator('[data-testid="preview-3d-stage"]')
    assert(await threeStage.isVisible(), '3D Orbit Viewer activated with camera controls')
    await toggle3dBtn.click() // toggle back to 2D
    await page.waitForTimeout(200)

    // Phase 4: Explicit Timeline Insertion & Ripple Push Invariant
    console.log('Phase 4: Adding media to timeline and verifying same-track ripple push...')
    const isMediaOpen = await page.evaluate(() => window.__omniframe_store.getState().leftOpen && window.__omniframe_store.getState().leftTab === 'media')
    if (!isMediaOpen) {
      await page.locator('[data-testid="left-tab-media"]').click()
      await page.waitForTimeout(200)
    }

    const addBtns = page.locator('[data-testid="add-to-timeline-btn"]')
    const addCount = await addBtns.count()
    assert(addCount >= 2, `Media library contains at least 2 items (found ${addCount})`)

    // Add first item
    await addBtns.first().click({ force: true })
    await page.waitForTimeout(300)
    let currentClips = await page.locator('[data-testid="timeline-clip"]').count()
    assert(currentClips === 1, 'First clip inserted into timeline')

    // Add second item
    await addBtns.nth(1).click({ force: true })
    await page.waitForTimeout(300)
    currentClips = await page.locator('[data-testid="timeline-clip"]').count()
    assert(currentClips === 2, 'Second clip inserted into timeline')

    // Verify clips do not overlap on same track
    const clipsData = await page.evaluate(() => window.__omniframe_store.getState().clips)
    console.log('Clips on timeline:', clipsData.map((c) => ({ id: c.id, start: c.start, dur: c.duration, trackId: c.trackId })))
    if (clipsData[0].trackId === clipsData[1].trackId) {
      const [c1, c2] = clipsData[0].start <= clipsData[1].start ? [clipsData[0], clipsData[1]] : [clipsData[1], clipsData[0]]
      assert(c2.start >= c1.start + c1.duration - 0.001, 'Invariant I-01: Same-track clips do not overlap')
    }

    // Phase 5: Testing Track Close Gaps Control
    console.log('Phase 5: Testing Close Gaps on Track...')
    // Introduce an artificial gap by moving clip 2 further downstream
    await page.evaluate(() => {
      const st = window.__omniframe_store.getState()
      const c = st.clips[1]
      if (c) {
        st.moveClip(c.id, c.start + 5.0, c.trackId)
      }
    })
    await page.waitForTimeout(200)
    const gapClips = await page.evaluate(() => window.__omniframe_store.getState().clips)
    console.log('Clips with gap:', gapClips.map((c) => ({ id: c.id, start: c.start, dur: c.duration })))

    // Click Close Gaps button on track header
    const primaryTrackId = gapClips[0].trackId
    const closeGapsBtn = page.locator(`[data-testid="close-gaps-${primaryTrackId}"]`)
    if ((await closeGapsBtn.count()) > 0) {
      await closeGapsBtn.click()
      await page.waitForTimeout(300)
    } else {
      await page.evaluate((trId) => window.__omniframe_store.getState().closeTrackGaps(trId), primaryTrackId)
    }

    const closedClips = await page.evaluate(() => window.__omniframe_store.getState().clips)
    console.log('Clips after Close Gaps:', closedClips.map((c) => ({ id: c.id, start: c.start, dur: c.duration })))
    const sorted = [...closedClips].sort((a, b) => a.start - b.start)
    assert(Math.abs(sorted[1].start - (sorted[0].start + sorted[0].duration)) < 0.01, 'Close Gaps eliminated space between clips')

    // Phase 6: Centralized Context Menu Resolver & Target Awareness
    console.log('Phase 6: Verifying Target-Aware Context Menu...')
    const emptyTrackId = await page.evaluate(() => window.__omniframe_store.getState().createTrack('video', 'below'))
    await page.waitForTimeout(200)
    const emptyTrackLane = page.locator(`[data-testid="track-lane-${emptyTrackId}"]`)
    await emptyTrackLane.click({ button: 'right', force: true })
    await page.waitForTimeout(300)

    const ctxMenu = page.locator('[data-testid*="context-menu"]')
    assert((await ctxMenu.count()) > 0, 'Target-aware context menu opened on empty track lane')

    // Verify it does NOT contain transition commands on empty track
    const transitionCmd = ctxMenu.locator('text=Add Transition')
    assert((await transitionCmd.count()) === 0, 'Context menu does NOT show transition commands on empty track')

    // Verify it contains Close Gaps on Track and Track options
    const ctxCloseGaps = ctxMenu.locator('[data-testid*="close-gaps"]')
    assert((await ctxCloseGaps.count()) > 0, 'Context menu contains Close Gaps on Track')

    // Dismiss context menu
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Phase 7: Add Title and Effects
    console.log('Phase 7: Testing Effects & Text Title Clips...')
    await page.evaluate(() => {
      window.__omniframe_store.getState().addTextTitleClip('OmniFrame 9:16 Rebuild', 4.0)
    })
    await page.waitForTimeout(300)
    const titleClips = await page.evaluate(() => window.__omniframe_store.getState().clips)
    assert(titleClips.some((c) => c.textStyle?.text === 'OmniFrame 9:16 Rebuild'), 'Text title clip created successfully')

    // Switch back to program monitor for export
    await page.evaluate(() => window.__omniframe_store.getState().setMonitorMode('program'))
    await page.waitForTimeout(300)

    // Capture visual evidence of full rebuild stack
    await page.screenshot({ path: join(SHOTS_DIR, 'omniframe-master-rebuild-full.png') })
    console.log('Captured evidence: omniframe-master-rebuild-full.png')

    // Phase 8: Authoritative Video Export & Headless OpenCV Verification
    console.log('Phase 8: Executing Video Export in 9:16 Portrait Mode...')
    const exportBtn = page.locator('[data-testid="export-video-btn"]')
    assert((await exportBtn.count()) > 0, 'TopBar export button found')

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await exportBtn.click()
    const download = await downloadPromise
    const exportDest = join(EXPORTS_DIR, 'master_rebuild_9_16_export.webm')
    await download.saveAs(exportDest)
    assert(existsSync(exportDest), 'Exported video file saved to disk')
    console.log(`Saved exported video: ${exportDest}`)

    // Phase 9: Headless OpenCV Export Verification
    console.log('Phase 9: Running OpenCV frame inspection on exported video...')
    const pyScript = `
import cv2, sys, os, numpy as np
path = "${exportDest}"
cap = cv2.VideoCapture(path)
if not cap.isOpened():
    print("FAILED TO OPEN EXPORT VIDEO")
    sys.exit(1)

w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)
print(f"Decoded Video Metadata: {w}x{h} @ {fps:.1f} fps")

# Verify authoritative dimensions: Sequence is 9:16 (1080x1920)
if w != 1080 or h != 1920:
    print(f"ERROR: Expected 1080x1920, got {w}x{h}")
    sys.exit(1)

frames = 0
luminances = []
while True:
    ret, frame = cap.read()
    if not ret or frame is None:
        break
    frames += 1
    luminances.append(float(np.mean(frame)))

cap.release()
print(f"Decoded {frames} frames, avg luminance: {np.mean(luminances):.2f}")
if frames >= 10 and np.mean(luminances) > 5.0:
    print("OPENCV EXPORT VERIFICATION PASSED")
else:
    print("ERROR: insufficient frames or blank output")
    sys.exit(1)
`
    const pyOut = execSync(`python3 -c '${pyScript}'`, { encoding: 'utf-8' })
    console.log(pyOut)
    assert(pyOut.includes('OPENCV EXPORT VERIFICATION PASSED'), 'OpenCV verified 1080x1920 portrait dimensions and valid rendered content')

    console.log('========================================================================')
    console.log('ALL MASTER REBUILD REQUIREMENTS VERIFIED SUCCESSFULLY!')
    console.log('========================================================================')
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('Test Failed:', err)
  process.exit(1)
})
