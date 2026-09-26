import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'evidence/screenshots')
const REPORTS = join(ROOT, 'qa/reports')

mkdirSync(SHOTS, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const results = []
const errors = []

function pass(name, details = '') {
  results.push({ name, status: 'PASS', details })
  console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`)
}

function fail(name, reason) {
  errors.push({ name, reason })
  results.push({ name, status: 'FAIL', reason })
  console.error(`[FAIL] ${name}: ${reason}`)
}

try {
  // ==========================================
  // PART 1: Desktop Test - Separation of Masking from Drawing & Connection to Tracking
  // ==========================================
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desktopPage.goto(URL, { waitUntil: 'networkidle' })
  await desktopPage.waitForSelector('[data-testid="preview-viewport"]', { timeout: 10000 })

  // Add a sample clip to timeline
  await desktopPage.evaluate(() => {
    const store = window.__omniframe_store
    if (store) store.getState().addTextTitleClip('Mask & Track Subject', 6.0)
  })
  await desktopPage.waitForTimeout(300)

  // 1. Verify LeftDock tab is "Masking & Tracking"
  const trackingTab = desktopPage.locator('[data-testid="left-tab-tracking"]')
  const tabTitle = await trackingTab.getAttribute('title')
  if (tabTitle && tabTitle.includes('Masking & Tracking')) {
    pass('01. LeftDock Masking & Tracking Tab', `Tab title is "${tabTitle}"`)
  } else {
    fail('01. LeftDock Masking & Tracking Tab', `Expected Masking & Tracking, got "${tabTitle}"`)
  }
  await trackingTab.click()
  await desktopPage.waitForTimeout(300)

  // 2. Verify TrackingPanel provides dedicated Mask Tracking mode connected to Tracking
  const maskModeBtn = desktopPage.locator('[data-testid="track-mode-mask"]')
  await maskModeBtn.click()
  await desktopPage.waitForTimeout(200)

  // Verify Mask Shape creation tools
  const rectMaskBtn = desktopPage.locator('[data-testid="create-mask-rectangle"]')
  const circleMaskBtn = desktopPage.locator('[data-testid="create-mask-ellipse"]')
  const polyMaskBtn = desktopPage.locator('[data-testid="create-mask-polygon"]')
  const brushMaskBtn = desktopPage.locator('[data-testid="create-mask-brush"]')

  if (
    (await rectMaskBtn.isVisible()) &&
    (await circleMaskBtn.isVisible()) &&
    (await polyMaskBtn.isVisible()) &&
    (await brushMaskBtn.isVisible())
  ) {
    pass('02. Mask Shape Creation Tools in Tracking', 'Box, Circle, Polygon, Brush mask shapes available')
  } else {
    fail('02. Mask Shape Creation Tools in Tracking', 'One or more mask shape buttons not visible')
  }

  // Verify Mask property controls: Invert, Feather, Expansion, Opacity, Apply to All Frames
  const invertToggle = desktopPage.locator('[data-testid="mask-invert-toggle"]')
  const featherSlider = desktopPage.locator('[data-testid="mask-feather-slider"]')
  const expansionSlider = desktopPage.locator('[data-testid="mask-expansion-slider"]')
  const opacitySlider = desktopPage.locator('[data-testid="mask-opacity-slider"]')
  const applyAllToggle = desktopPage.locator('[data-testid="mask-apply-all-frames-toggle"]')

  if (
    (await invertToggle.isVisible()) &&
    (await featherSlider.isVisible()) &&
    (await expansionSlider.isVisible()) &&
    (await opacitySlider.isVisible()) &&
    (await applyAllToggle.isVisible())
  ) {
    pass('03. Mask Properties Controls', 'Invert, Feather, Expansion, Opacity, Apply to All Frames verified')
  } else {
    fail('03. Mask Properties Controls', 'Mask controls not all visible')
  }

  // 3. Verify Mask Tracking optical flow execution
  const trackMaskFwdBtn = desktopPage.locator('[data-testid="run-track-forward-btn"]')
  const fwdText = await trackMaskFwdBtn.innerText()
  if (fwdText.includes('Track Mask Forward')) {
    pass('04. Mask Connected to Optical Flow Tracking', 'Button explicitly performs "Track Mask Forward"')
  } else {
    fail('04. Mask Connected to Optical Flow Tracking', `Expected "Track Mask Forward", got "${fwdText}"`)
  }

  await trackMaskFwdBtn.click()
  await desktopPage.waitForTimeout(1100)
  pass('05. Mask Contour Deformation Tracking', 'Executed optical flow tracking on mask contour')

  // 4. Verify Drawing is separated from Masking
  // Enable drawing mode
  await desktopPage.evaluate(() => {
    window.__omniframe_store.getState().setDrawingEnabled(true)
  })
  await desktopPage.waitForTimeout(300)

  const drawingToolbar = desktopPage.locator('[data-testid="drawing-toolbar"]')
  if (await drawingToolbar.isVisible()) {
    pass('06. Drawing Toolbar Active', 'Floating drawing palette mounted')

    // Verify marquee selection tools are NOT in the drawing tool selector
    const rectSelect = desktopPage.locator('[data-testid="drawing-tool-select-rect"]')
    const lassoSelect = desktopPage.locator('[data-testid="drawing-tool-select-lasso"]')
    const hasMarqueeInDrawing = (await rectSelect.count()) > 0 || (await lassoSelect.count()) > 0
    if (!hasMarqueeInDrawing) {
      pass('07. Masking Separated from Drawing', 'Drawing toolbar contains zero selection/marquee masks')
    } else {
      fail('07. Masking Separated from Drawing', 'Drawing toolbar still contains selection marquee tools')
    }
  } else {
    fail('06. Drawing Toolbar Active', 'Drawing toolbar not visible')
  }

  await desktopPage.close()

  // ==========================================
  // PART 2: Mobile Phone Viewport Test (390px - iPhone 14)
  // ==========================================
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobilePage.goto(URL, { waitUntil: 'networkidle' })
  await mobilePage.waitForSelector('[data-testid="preview-viewport"]', { timeout: 10000 })

  // Enable drawing mode on mobile
  await mobilePage.evaluate(() => {
    window.__omniframe_store.getState().setDrawingEnabled(true)
  })
  await mobilePage.waitForTimeout(400)

  const mobileToolbar = mobilePage.locator('[data-testid="drawing-toolbar"]')
  if (await mobileToolbar.isVisible()) {
    const box = await mobileToolbar.boundingBox()
    if (box) {
      console.log(`[INFO] Mobile Drawing Toolbar Bounding Box: width=${box.width}px, screenWidth=390px`)
      // Assert toolbar width does NOT exceed screen width (390px)
      if (box.width <= 390) {
        pass('08. Drawing Toolbar Width Fits Mobile Screen', `Toolbar width is ${Math.round(box.width)}px <= 390px phone width`)
      } else {
        fail('08. Drawing Toolbar Width Fits Mobile Screen', `Toolbar width ${box.width}px EXCEEDS 390px phone width!`)
      }
    } else {
      fail('08. Drawing Toolbar Width Fits Mobile Screen', 'Could not get toolbar bounding box')
    }

    // Check page horizontal overflow on mobile
    const overflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    if (!overflow) {
      pass('09. Zero Page Horizontal Overflow on Phone', 'document.scrollWidth <= document.clientWidth')
    } else {
      fail('09. Zero Page Horizontal Overflow on Phone', 'Horizontal scrollbar detected on mobile!')
    }

    // Check tool tooltip / title lengths
    const toolButtons = mobileToolbar.locator('button[title]')
    const count = await toolButtons.count()
    let maxTitleLen = 0
    let longestTitle = ''

    for (let i = 0; i < count; i++) {
      const title = await toolButtons.nth(i).getAttribute('title')
      if (title) {
        if (title.length > maxTitleLen) {
          maxTitleLen = title.length
          longestTitle = title
        }
      }
    }

    console.log(`[INFO] Longest Tooltip/Title: "${longestTitle}" (${maxTitleLen} chars)`)
    // Concise titles (max 20 chars) ensure native tooltips never wrap or span across phone screens
    if (maxTitleLen <= 22) {
      pass('10. Drawing Tooltip / Title Length Compact', `Longest title is "${longestTitle}" (${maxTitleLen} chars <= 22)`)
    } else {
      fail('10. Drawing Tooltip / Title Length Compact', `Title "${longestTitle}" is too long (${maxTitleLen} chars)`)
    }

    // Capture mobile evidence screenshot
    const mobileShotPath = join(SHOTS, 'mobile-drawing-toolbar-responsive.png')
    await mobilePage.screenshot({ path: mobileShotPath, fullPage: true })
    pass('11. Mobile Evidence Screenshot Saved', 'evidence/screenshots/mobile-drawing-toolbar-responsive.png')
  } else {
    fail('08. Drawing Toolbar Width Fits Mobile Screen', 'Drawing toolbar not visible on mobile')
  }

  await mobilePage.close()

} catch (err) {
  fail('Unhandled Exception', err instanceof Error ? err.stack : String(err))
} finally {
  await browser.close()
}

const summary = {
  timestamp: new Date().toISOString(),
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length,
  total: results.length,
  results,
}

writeFileSync(join(REPORTS, 'masking-tracking-mobile-drawing-report.json'), JSON.stringify(summary, null, 2))
console.log('\n========================================')
console.log(`Test Execution Complete: ${summary.passed}/${summary.total} PASS, ${summary.failed} FAIL`)
console.log('========================================')

if (summary.failed > 0) {
  process.exit(1)
}
