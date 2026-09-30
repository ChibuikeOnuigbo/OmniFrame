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
  console.log('=== Starting Cursor Visibility, Continuous Showing & Bug Inspection ===')
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
    checks: [],
    coordinatesVerified: [],
    passed: true,
  }

  try {
    console.log(`Navigating to ${BASE_URL}/#studio...`)
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const cursorContainer = page.locator('[data-testid="custom-cursor-container"]')

    // Test 1: Native Cursor Suppression Check
    console.log('[Check 1] Checking native OS cursor suppression across DOM nodes...')
    await page.mouse.move(400, 400)
    await page.waitForTimeout(150)

    const nativeCursorStyles = await page.evaluate(() => {
      const elHtml = window.getComputedStyle(document.documentElement).cursor
      const elBody = window.getComputedStyle(document.body).cursor
      const btn = document.querySelector('button')
      const btnCursor = btn ? window.getComputedStyle(btn).cursor : 'none'
      const canvas = document.querySelector('canvas')
      const canvasCursor = canvas ? window.getComputedStyle(canvas).cursor : 'none'
      return { elHtml, elBody, btnCursor, canvasCursor }
    })
    console.log('Native cursor styles:', nativeCursorStyles)

    const nativeSuppressed =
      nativeCursorStyles.elHtml === 'none' &&
      nativeCursorStyles.elBody === 'none' &&
      nativeCursorStyles.btnCursor === 'none' &&
      nativeCursorStyles.canvasCursor === 'none'

    results.checks.push({
      name: 'Native OS cursor 100% suppressed (no double cursor leak)',
      styles: nativeCursorStyles,
      passed: nativeSuppressed,
    })

    // Test 2: Continuous Visibility across 5 distinct application zones ("showing all time")
    const testPositions = [
      { name: 'Canvas Stage Center', x: 680, y: 320 },
      { name: 'Timeline Scrub Tracks', x: 700, y: 680 },
      { name: 'Top Transport Bar', x: 720, y: 24 },
      { name: 'Media Library Dock', x: 120, y: 220 },
      { name: 'Inspector Right Panel', x: 1320, y: 260 },
    ]

    for (const pos of testPositions) {
      console.log(`[Check 2] Testing continuous cursor presence at ${pos.name} (${pos.x}, ${pos.y})...`)
      await page.mouse.move(pos.x, pos.y)
      await page.waitForTimeout(150)

      const isVisible = await cursorContainer.isVisible()
      const box = await cursorContainer.boundingBox()
      const state = await cursorContainer.getAttribute('data-cursor-state')

      results.coordinatesVerified.push({
        zone: pos.name,
        targetPos: { x: pos.x, y: pos.y },
        cursorVisible: isVisible,
        state,
        cursorBounds: box,
      })
    }

    const allPositionsVisible = results.coordinatesVerified.every((c) => c.cursorVisible)
    results.checks.push({
      name: 'Continuous cursor visibility across all application zones (showing all time)',
      passed: allPositionsVisible,
    })

    // Test 3: Capture Full Screenshot & Frame Cutout over Video Canvas
    console.log('[Check 3] Capturing full screenshot & frame cutout over Video Preview Canvas...')
    await page.mouse.move(680, 320)
    await page.waitForTimeout(200)

    const ssCanvas = path.join(EVIDENCE_DIR, 'cursor-visibility-canvas-inspection.png')
    await page.screenshot({ path: ssCanvas })
    console.log(`Saved screenshot: ${ssCanvas}`)

    const cBox = await cursorContainer.boundingBox()
    if (cBox) {
      const cutCanvas = path.join(CUTOUTS_DIR, 'cut-cursor-canvas-visibility.png')
      await page.screenshot({
        path: cutCanvas,
        clip: {
          x: Math.max(0, cBox.x - 15),
          y: Math.max(0, cBox.y - 15),
          width: Math.min(120, cBox.width + 50),
          height: Math.min(120, cBox.height + 50),
        },
      })
      console.log(`Saved cutout: ${cutCanvas}`)
    }

    // Test 4: Capture Full Screenshot & Frame Cutout over Timeline
    console.log('[Check 4] Capturing full screenshot & frame cutout over Timeline lanes...')
    await page.mouse.move(700, 680)
    await page.waitForTimeout(200)

    const ssTimeline = path.join(EVIDENCE_DIR, 'cursor-visibility-timeline-inspection.png')
    await page.screenshot({ path: ssTimeline })
    console.log(`Saved screenshot: ${ssTimeline}`)

    const tBox = await cursorContainer.boundingBox()
    if (tBox) {
      const cutTimeline = path.join(CUTOUTS_DIR, 'cut-cursor-timeline-visibility.png')
      await page.screenshot({
        path: cutTimeline,
        clip: {
          x: Math.max(0, tBox.x - 15),
          y: Math.max(0, tBox.y - 15),
          width: Math.min(120, tBox.width + 50),
          height: Math.min(120, tBox.height + 50),
        },
      })
      console.log(`Saved cutout: ${cutTimeline}`)
    }

    // Test 5: Boundary Exit / Entry Inspection (Window Mouseleave & Re-entry)
    console.log('[Check 5] Testing document boundary exit and re-entry...')
    // Move off-screen / trigger mouseleave
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    })
    await page.waitForTimeout(150)

    const isHiddenOnExit = (await cursorContainer.count()) === 0 || !(await cursorContainer.isVisible().catch(() => false))
    console.log(`Cursor hidden on mouseleave: ${isHiddenOnExit}`)

    // Move back inside window
    await page.mouse.move(500, 300)
    await page.waitForTimeout(150)

    const isRestoredOnEntry = await cursorContainer.isVisible()
    console.log(`Cursor restored on mouse entry: ${isRestoredOnEntry}`)

    results.checks.push({
      name: 'Document boundary exit hiding & entry restoration',
      hiddenOnExit: isHiddenOnExit,
      restoredOnEntry: isRestoredOnEntry,
      passed: isHiddenOnExit && isRestoredOnEntry,
    })

    const ssBoundary = path.join(EVIDENCE_DIR, 'cursor-visibility-boundary-test.png')
    await page.screenshot({ path: ssBoundary })

    const bBox = await cursorContainer.boundingBox()
    if (bBox) {
      const cutBoundary = path.join(CUTOUTS_DIR, 'cut-cursor-boundary-entry.png')
      await page.screenshot({
        path: cutBoundary,
        clip: {
          x: Math.max(0, bBox.x - 15),
          y: Math.max(0, bBox.y - 15),
          width: Math.min(120, bBox.width + 50),
          height: Math.min(120, bBox.height + 50),
        },
      })
      console.log(`Saved cutout: ${cutBoundary}`)
    }

    const allPassed = results.checks.every((c) => c.passed)
    results.passed = allPassed

    console.log('\n=== Visibility Inspection Results ===')
    results.checks.forEach((c) => {
      console.log(`[${c.passed ? 'PASS' : 'FAIL'}] ${c.name}`)
    })
    console.log(`Overall: ${allPassed ? 'ALL VISIBILITY CHECKS PASSED' : 'SOME CHECKS FAILED'}`)
  } catch (err) {
    console.error('Inspection execution error:', err)
    results.passed = false
    results.error = err.message
  } finally {
    const reportPath = path.join(REPORTS_DIR, 'cursor-visibility-inspection-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`Saved inspection report: ${reportPath}`)
    await browser.close()
  }
}

run()
