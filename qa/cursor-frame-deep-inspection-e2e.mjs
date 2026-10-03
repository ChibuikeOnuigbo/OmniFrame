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
  console.log('=== Starting Deep Frame-by-Frame Cursor Visibility & Bug Audit ===')
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

    const cursorContainer = page.locator('[data-testid="custom-cursor-container"]')

    // -------------------------------------------------------------
    // SCENARIO 1: Blade Cut Reticle over Timeline Clip
    // -------------------------------------------------------------
    console.log('[Scenario 1] Testing Blade tool cursor over timeline clip...')
    // Switch to blade tool via shortcut B or UI
    await page.keyboard.press('KeyB')
    await page.waitForTimeout(200)

    const timelineClip = page.locator('[data-testid="timeline-clip"]').first()
    if (await timelineClip.isVisible()) {
      const clipBox = await timelineClip.boundingBox()
      if (clipBox) {
        await page.mouse.move(clipBox.x + clipBox.width / 2, clipBox.y + clipBox.height / 2)
        await page.waitForTimeout(200)

        const bladeState = await cursorContainer.getAttribute('data-cursor-state')
        const isVisible = await cursorContainer.isVisible()
        console.log(`Blade cursor state: ${bladeState}, isVisible: ${isVisible}`)

        const ssBlade = path.join(EVIDENCE_DIR, 'cursor-frame-blade-timeline.png')
        await page.screenshot({ path: ssBlade })

        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          const cutBlade = path.join(CUTOUTS_DIR, 'cut-cursor-frame-blade.png')
          await page.screenshot({
            path: cutBlade,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(80, cBox.width + 30),
              height: Math.min(80, cBox.height + 30),
            },
          })
          console.log(`Saved cutout: ${cutBlade}`)
        }

        results.scenarios.push({
          name: 'Blade tool cursor over timeline clip',
          state: bladeState,
          visible: isVisible,
          passed: bladeState === 'blade' && isVisible,
        })
      }
    }
    // Switch back to select tool
    await page.keyboard.press('KeyV')
    await page.waitForTimeout(200)

    // -------------------------------------------------------------
    // SCENARIO 2: Timeline Playhead Active Drag / Scrubbing
    // -------------------------------------------------------------
    console.log('[Scenario 2] Testing playhead scrub continuous cursor visibility...')
    const ruler = page.locator('[data-testid="timeline-ruler"]')
    const rulerBox = await ruler.boundingBox()
    if (rulerBox) {
      const startX = rulerBox.x + 100
      const startY = rulerBox.y + rulerBox.height / 2

      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.waitForTimeout(100)

      // Drag 150px to the right
      await page.mouse.move(startX + 150, startY, { steps: 5 })
      await page.waitForTimeout(150)

      const isVisibleWhileScrubbing = await cursorContainer.isVisible()
      const scrubState = await cursorContainer.getAttribute('data-cursor-state')
      console.log(`Scrubbing cursor visible: ${isVisibleWhileScrubbing}, state: ${scrubState}`)

      const ssScrub = path.join(EVIDENCE_DIR, 'cursor-frame-playhead-scrub.png')
      await page.screenshot({ path: ssScrub })

      const cBox = await cursorContainer.boundingBox()
      if (cBox) {
        const cutScrub = path.join(CUTOUTS_DIR, 'cut-cursor-frame-playhead-scrub.png')
        await page.screenshot({
          path: cutScrub,
          clip: {
            x: Math.max(0, cBox.x - 10),
            y: Math.max(0, cBox.y - 10),
            width: Math.min(80, cBox.width + 30),
            height: Math.min(80, cBox.height + 30),
          },
        })
        console.log(`Saved cutout: ${cutScrub}`)
      }

      await page.mouse.up()
      await page.waitForTimeout(200)

      results.scenarios.push({
        name: 'Timeline playhead scrub continuous visibility',
        visible: isVisibleWhileScrubbing,
        passed: isVisibleWhileScrubbing,
      })
    }

    // -------------------------------------------------------------
    // SCENARIO 3: Cursor Over Modal Dialog (Marker Modal)
    // -------------------------------------------------------------
    console.log('[Scenario 3] Testing cursor visibility on top of Modal Dialog...')
    // Press 'M' to open Marker Modal
    await page.keyboard.press('KeyM')
    await page.waitForTimeout(300)

    const markerModal = page.locator('[data-testid="marker-modal"]')
    if (await markerModal.isVisible()) {
      const modalBox = await markerModal.boundingBox()
      if (modalBox) {
        // Move cursor over modal save button or header
        await page.mouse.move(modalBox.x + modalBox.width / 2, modalBox.y + modalBox.height / 2)
        await page.waitForTimeout(200)

        const isVisibleOnModal = await cursorContainer.isVisible()
        const modalCursorState = await cursorContainer.getAttribute('data-cursor-state')
        console.log(`Modal cursor state: ${modalCursorState}, isVisible: ${isVisibleOnModal}`)

        const ssModal = path.join(EVIDENCE_DIR, 'cursor-frame-modal-overlay.png')
        await page.screenshot({ path: ssModal })

        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          const cutModal = path.join(CUTOUTS_DIR, 'cut-cursor-frame-modal-overlay.png')
          await page.screenshot({
            path: cutModal,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(80, cBox.width + 30),
              height: Math.min(80, cBox.height + 30),
            },
          })
          console.log(`Saved cutout: ${cutModal}`)
        }

        results.scenarios.push({
          name: 'Cursor visibility on top of modal dialog',
          visible: isVisibleOnModal,
          state: modalCursorState,
          passed: isVisibleOnModal,
        })
      }

      // Close modal with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(250)
    }

    // -------------------------------------------------------------
    // SCENARIO 4: Inspector Slider Scrubbing / Number Input
    // -------------------------------------------------------------
    console.log('[Scenario 4] Testing cursor over Inspector controls...')
    // Select the first clip to open Inspector
    if (await timelineClip.isVisible()) {
      await timelineClip.click()
      await page.waitForTimeout(200)
    }

    const slider = page.locator('input[type="range"]').first()
    if (await slider.isVisible()) {
      const sBox = await slider.boundingBox()
      if (sBox) {
        await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2)
        await page.waitForTimeout(200)

        const isVisibleOnSlider = await cursorContainer.isVisible()
        const sliderCursorState = await cursorContainer.getAttribute('data-cursor-state')
        console.log(`Slider cursor state: ${sliderCursorState}, isVisible: ${isVisibleOnSlider}`)

        const ssSlider = path.join(EVIDENCE_DIR, 'cursor-frame-inspector-slider.png')
        await page.screenshot({ path: ssSlider })

        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          const cutSlider = path.join(CUTOUTS_DIR, 'cut-cursor-frame-inspector-slider.png')
          await page.screenshot({
            path: cutSlider,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(80, cBox.width + 30),
              height: Math.min(80, cBox.height + 30),
            },
          })
          console.log(`Saved cutout: ${cutSlider}`)
        }

        results.scenarios.push({
          name: 'Cursor visibility over inspector controls',
          visible: isVisibleOnSlider,
          passed: isVisibleOnSlider,
        })
      }
    }

    // -------------------------------------------------------------
    // SCENARIO 5: 3D Mode Orbit / Rotation Cursor
    // -------------------------------------------------------------
    console.log('[Scenario 5] Testing cursor in 3D Mode...')
    await page.keyboard.press('Digit3')
    await page.waitForTimeout(350)

    const threeCanvas = page.locator('[data-testid="three-canvas-wrapper"], canvas').first()
    if (await threeCanvas.isVisible()) {
      const tBox = await threeCanvas.boundingBox()
      if (tBox) {
        await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2)
        await page.waitForTimeout(200)

        const threeCursorState = await cursorContainer.getAttribute('data-cursor-state')
        const isVisible3D = await cursorContainer.isVisible()
        console.log(`3D canvas cursor state: ${threeCursorState}, isVisible: ${isVisible3D}`)

        const ss3D = path.join(EVIDENCE_DIR, 'cursor-frame-3d-orbit.png')
        await page.screenshot({ path: ss3D })

        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          const cut3D = path.join(CUTOUTS_DIR, 'cut-cursor-frame-3d-orbit.png')
          await page.screenshot({
            path: cut3D,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(80, cBox.width + 30),
              height: Math.min(80, cBox.height + 30),
            },
          })
          console.log(`Saved cutout: ${cut3D}`)
        }

        results.scenarios.push({
          name: '3D mode rotation arc cursor',
          state: threeCursorState,
          visible: isVisible3D,
          passed: isVisible3D && (threeCursorState === 'rotate' || threeCursorState === 'default'),
        })
      }
    }
    // Return from 3D mode
    await page.keyboard.press('Digit3')
    await page.waitForTimeout(200)

    const allPassed = results.scenarios.every((s) => s.passed)
    results.passed = allPassed

    console.log('\n=== Deep Inspection Summary ===')
    results.scenarios.forEach((s) => {
      console.log(`[${s.passed ? 'PASS' : 'FAIL'}] ${s.name}`)
    })
    console.log(`Overall: ${allPassed ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED'}`)
  } catch (err) {
    console.error('Inspection execution error:', err)
    results.passed = false
    results.error = err.message
  } finally {
    const reportPath = path.join(REPORTS_DIR, 'cursor-frame-inspection-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`Saved deep inspection report: ${reportPath}`)
    await browser.close()
  }
}

run()
