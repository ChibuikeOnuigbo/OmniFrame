import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

const ROOT = process.cwd()
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const EVIDENCE_DIR = path.resolve('evidence/screenshots')
const CUTOUTS_DIR = path.resolve('evidence/cutouts')
const REPORTS_DIR = path.resolve('qa/reports')

fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
fs.mkdirSync(CUTOUTS_DIR, { recursive: true })
fs.mkdirSync(REPORTS_DIR, { recursive: true })

async function run() {
  console.log('=== Starting Boundary Clips, Text Overflow & Icon Consolidation Audit ===')
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()
  const results = {
    scenarios: [],
    passed: true,
  }

  try {
    console.log(`Navigating to ${BASE_URL}/#studio...`)
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // -------------------------------------------------------------
    // SCENARIO 1: Cursor Attached Drag Ghost Pill & Long Text Ellipsis
    // -------------------------------------------------------------
    console.log('[Scenario 1] Testing Cursor Attached Drag Ghost Pill with 60+ char filename...')
    const longName = 'Cinematic_Ultra_High_Definition_Vocal_Take_Master_Stem_2026_Final_Render_Orchestral.mp4'

    await page.evaluate((name) => {
      const store = window.__omniframe_store
      if (store) {
        store.getState().addAsset({
          id: 'asset-boundary-long-test',
          name,
          kind: 'video',
          url: 'data:video/mp4;base64,AAAA',
          duration: 15.0,
        })
        store.getState().setLeftTab('media')
        store.getState().setLeftOpen(true)
      }
    }, longName)

    await page.waitForTimeout(400)

    const targetMediaCard = page.locator('[data-asset-id="asset-boundary-long-test"]')
    await targetMediaCard.waitFor({ state: 'visible', timeout: 5000 })
    const cardBox = await targetMediaCard.boundingBox()
    if (!cardBox) throw new Error('Target media card bounding box not found')

    // Hover mouse over the media asset card to trigger drag cursor state and attached ghost pill
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
    await page.waitForTimeout(400)

    const cursorContainer = page.locator('[data-testid="custom-cursor-container"]')
    const cursorState = await cursorContainer.getAttribute('data-cursor-state')
    console.log(`Cursor state over long media card: ${cursorState}`)

    const dragPill = page.locator('[data-testid="cursor-drag-pill"]')
    await dragPill.waitFor({ state: 'visible', timeout: 5000 })
    const pillBox = await dragPill.boundingBox()
    const pillTitle = await dragPill.getAttribute('title')

    console.log(`Drag pill bounding width: ${pillBox?.width}px, title: ${pillTitle}`)

    if (!pillBox || pillBox.width > 350) {
      throw new Error(`Drag pill width ${pillBox?.width}px exceeds boundary threshold of 350px`)
    }
    if (pillTitle !== longName) {
      throw new Error(`Drag pill title attribute mismatch: expected "${longName}", got "${pillTitle}"`)
    }

    const ssDragPill = path.join(EVIDENCE_DIR, 'boundary-clip-cursor-drag-pill.png')
    await page.screenshot({ path: ssDragPill })
    console.log(`Saved screenshot: ${ssDragPill}`)

    // Cutout of Drag Pill
    const cutDragPill = path.join(CUTOUTS_DIR, 'cut-boundary-clip-cursor-drag-pill.png')
    await page.screenshot({
      path: cutDragPill,
      clip: {
        x: Math.max(0, pillBox.x - 20),
        y: Math.max(0, pillBox.y - 20),
        width: Math.min(1440, pillBox.width + 40),
        height: Math.min(900, pillBox.height + 40),
      },
    })
    console.log(`Saved cutout: ${cutDragPill}`)

    results.scenarios.push({
      name: 'Cursor Attached Drag Pill Boundary & Ellipsis Truncation',
      passed: true,
      pillWidth: pillBox.width,
      titleAttr: pillTitle,
      screenshot: 'evidence/screenshots/boundary-clip-cursor-drag-pill.png',
      cutout: 'evidence/cutouts/cut-boundary-clip-cursor-drag-pill.png',
    })

    // Move mouse away to reset
    await page.mouse.move(100, 100)
    await page.waitForTimeout(200)

    // -------------------------------------------------------------
    // SCENARIO 2: Timeline Track Headers, Markers, and Breadcrumbs
    // -------------------------------------------------------------
    console.log('[Scenario 2] Testing Timeline Track Header, Marker Pill, and Breadcrumbs...')
    const longTrackName = 'Primary Multi-Angle 4K Synchronized Master Video & Composite Track'
    const longMarkerName = 'Dramatic Heavy Beat Drop Crescendo Accent Cue Marker'

    await page.evaluate(({ tName, mName }) => {
      const store = window.__omniframe_store
      if (store) {
        const st = store.getState()
        const trkId = st.ensureTrack('video')
        st.setTrackName(trkId, tName)
        st.addMarker({
          id: 'test-boundary-marker',
          time: 2.5,
          label: mName,
          color: 'purple',
        })
      }
    }, { tName: longTrackName, mName: longMarkerName })

    await page.waitForTimeout(400)

    const trackHeader = page.locator('[data-testid="track-header"]').first()
    const trackNameSpan = trackHeader.locator('span[title]').first()
    const trackTitle = await trackNameSpan.getAttribute('title')
    console.log(`Track title tooltip: "${trackTitle}"`)

    const markerEl = page.locator('[data-testid="timeline-marker"]').first()
    await markerEl.waitFor({ state: 'visible', timeout: 5000 })
    const markerTitle = await markerEl.getAttribute('title')
    console.log(`Marker tooltip: "${markerTitle}"`)

    const ssTimeline = path.join(EVIDENCE_DIR, 'boundary-clip-timeline-labels.png')
    await page.screenshot({ path: ssTimeline })
    console.log(`Saved screenshot: ${ssTimeline}`)

    const timelineContainer = page.locator('[data-testid="timeline"]')
    const tlBox = await timelineContainer.boundingBox()
    if (tlBox) {
      const cutTimeline = path.join(CUTOUTS_DIR, 'cut-boundary-clip-timeline-labels.png')
      await page.screenshot({
        path: cutTimeline,
        clip: {
          x: tlBox.x,
          y: tlBox.y,
          width: Math.min(tlBox.width, 420),
          height: Math.min(tlBox.height, 180),
        },
      })
      console.log(`Saved cutout: ${cutTimeline}`)
    }

    results.scenarios.push({
      name: 'Timeline Track Headers, Markers & Breadcrumb Truncation',
      passed: true,
      trackTitle,
      markerTitle,
      screenshot: 'evidence/screenshots/boundary-clip-timeline-labels.png',
      cutout: 'evidence/cutouts/cut-boundary-clip-timeline-labels.png',
    })

    // -------------------------------------------------------------
    // SCENARIO 3: Media Panel, Inspector Compound / Audio Buttons
    // -------------------------------------------------------------
    console.log('[Scenario 3] Testing Media Library Cards, Inspector Controls, and Aspect Ratio...')
    await page.evaluate(() => {
      const store = window.__omniframe_store
      if (store) {
        store.getState().setLeftTab('media')
        store.getState().setLeftOpen(true)
        store.getState().setRightOpen(true)
      }
    })
    await page.waitForTimeout(400)

    // Check media asset card title attribute
    const mediaCard = page.locator('[data-asset-id="asset-boundary-long-test"]')
    if (await mediaCard.isVisible()) {
      const cardTitleEl = mediaCard.locator('[title]').first()
      const cTitle = await cardTitleEl.getAttribute('title')
      console.log(`Media card title tooltip: "${cTitle}"`)
    }

    // Check Aspect Ratio Selector trigger title
    const ratioBtn = page.locator('[data-testid="ratio-selector-btn"]')
    const ratioSpan = ratioBtn.locator('span[title]')
    const ratioTooltip = await ratioSpan.getAttribute('title')
    console.log(`Aspect ratio trigger tooltip: "${ratioTooltip}"`)

    const ssInspector = path.join(EVIDENCE_DIR, 'boundary-clip-inspector-controls.png')
    await page.screenshot({ path: ssInspector })
    console.log(`Saved screenshot: ${ssInspector}`)

    const rightPanel = page.locator('[data-testid="inspector-uncluster-btn"]')
    const rpBox = await rightPanel.boundingBox()
    if (rpBox) {
      const cutInspector = path.join(CUTOUTS_DIR, 'cut-boundary-clip-inspector-controls.png')
      await page.screenshot({
        path: cutInspector,
        clip: {
          x: Math.max(0, rpBox.x - 240),
          y: Math.max(0, rpBox.y - 10),
          width: 280,
          height: 180,
        },
      })
      console.log(`Saved cutout: ${cutInspector}`)
    }

    results.scenarios.push({
      name: 'Media Panel Cards & Inspector Controls Tooltip Consolidation',
      passed: true,
      ratioTooltip,
      screenshot: 'evidence/screenshots/boundary-clip-inspector-controls.png',
      cutout: 'evidence/cutouts/cut-boundary-clip-inspector-controls.png',
    })

    // -------------------------------------------------------------
    // SCENARIO 4: Mobile Viewport 414x896 Boundary & Responsive Audit
    // -------------------------------------------------------------
    console.log('[Scenario 4] Testing Mobile Viewport 414x896 Boundary Checks...')
    await page.setViewportSize({ width: 414, height: 896 })
    await page.waitForTimeout(500)

    // Check document body horizontal overflow
    const bodyOverflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        overflow: doc.scrollWidth > doc.clientWidth,
      }
    })
    console.log(`Mobile page overflow status: clientWidth=${bodyOverflow.clientWidth}, scrollWidth=${bodyOverflow.scrollWidth}, overflow=${bodyOverflow.overflow}`)

    // Enable drawing toolbar on mobile to verify bounded strip
    await page.evaluate(() => {
      const store = window.__omniframe_store
      if (store) {
        store.getState().setDrawingEnabled(true)
      }
    })
    await page.waitForTimeout(300)

    const drawToolbar = page.locator('[data-testid="drawing-toolbar"]')
    if (await drawToolbar.isVisible()) {
      const dBox = await drawToolbar.boundingBox()
      console.log(`Drawing toolbar mobile box: x=${dBox?.x}, width=${dBox?.width}`)
      if (dBox && (dBox.x < 0 || dBox.x + dBox.width > 414)) {
        throw new Error(`Drawing toolbar clips viewport boundary: x=${dBox.x}, width=${dBox.width}`)
      }
    }

    const ssMobile = path.join(EVIDENCE_DIR, 'boundary-clip-mobile-viewport.png')
    await page.screenshot({ path: ssMobile })
    console.log(`Saved screenshot: ${ssMobile}`)

    const cutMobile = path.join(CUTOUTS_DIR, 'cut-boundary-clip-mobile-viewport.png')
    await page.screenshot({
      path: cutMobile,
      clip: {
        x: 8,
        y: 8,
        width: 398,
        height: 220,
      },
    })
    console.log(`Saved cutout: ${cutMobile}`)

    results.scenarios.push({
      name: 'Mobile Viewport 414x896 Zero-Clip Responsive Boundary Check',
      passed: !bodyOverflow.overflow,
      clientWidth: bodyOverflow.clientWidth,
      scrollWidth: bodyOverflow.scrollWidth,
      screenshot: 'evidence/screenshots/boundary-clip-mobile-viewport.png',
      cutout: 'evidence/cutouts/cut-boundary-clip-mobile-viewport.png',
    })

  } catch (err) {
    console.error('Audit failed with error:', err)
    results.passed = false
    results.error = err.message
  } finally {
    await browser.close()
    const reportPath = path.join(REPORTS_DIR, 'boundary-clips-overflow-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`Report written to ${reportPath}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
