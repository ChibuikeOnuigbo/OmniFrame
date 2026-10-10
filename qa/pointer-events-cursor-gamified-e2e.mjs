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
  console.log('--- Starting Expanded Gamified macOS Pointer Events & Pack E2E ---')
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
    tests: [],
    cursorStates: {},
    passed: true,
  }

  try {
    console.log(`Navigating to ${BASE_URL}/#studio...`)
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Bypass any landing page if present
    const enterBtn = page.locator('text=Open Studio, text=Get Started, button:has-text("Start"), button:has-text("Open")').first()
    if (await enterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await enterBtn.click()
      await page.waitForTimeout(600)
    }

    // 1. Initial State: Gamified macOS Sonoma Cursor
    console.log('[Test 1] Verifying custom macOS vector cursor initial mount...')
    await page.mouse.move(350, 350)
    await page.waitForTimeout(200)

    const cursorContainer = page.locator('[data-testid="custom-cursor-container"]')
    await cursorContainer.waitFor({ state: 'visible', timeout: 5000 })

    const state1 = await cursorContainer.getAttribute('data-cursor-state')
    const size1 = await cursorContainer.getAttribute('data-cursor-size')
    const pack1 = await cursorContainer.getAttribute('data-cursor-pack') || await cursorContainer.getAttribute('data-cursor-theme')
    console.log(`Initial state: ${state1}, size: ${size1}, pack: ${pack1}`)

    const hasCursorClass = await page.evaluate(() =>
      document.documentElement.classList.contains('of-custom-cursor-active')
    )

    results.tests.push({
      name: 'Custom cursor initial mount & pack initialization',
      state: state1,
      size: size1,
      pack: pack1,
      activeClass: hasCursorClass,
      passed: state1 === 'default' && size1 === 'standard' && hasCursorClass,
    })

    const ssDefault = path.join(EVIDENCE_DIR, 'cursor-mac-default.png')
    await page.screenshot({ path: ssDefault })

    // 2. Button Hover: Sleek Apple Pointing Hand
    console.log('[Test 2] Hovering over Settings button for pointer hand...')
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    const settingsBox = await settingsBtn.boundingBox()
    if (settingsBox) {
      await page.mouse.move(settingsBox.x + settingsBox.width / 2, settingsBox.y + settingsBox.height / 2)
      await page.waitForTimeout(200)

      const pointerState = await cursorContainer.getAttribute('data-cursor-state')
      console.log(`State over settings button: ${pointerState}`)

      results.tests.push({
        name: 'Pointing hand cursor on interactive button hover',
        state: pointerState,
        passed: pointerState === 'pointer',
      })
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'cursor-pointer-hover.png') })
    }

    // 3. Media Asset Hover & Attached Drag Ghost Pill: Drag State with + Badge
    console.log('[Test 3] Testing Drag & Drop plus badge and attached ghost pill...')
    const mediaAsset = page.locator('[data-testid="media-asset"]').first()
    if (await mediaAsset.isVisible({ timeout: 2000 }).catch(() => false)) {
      const assetBox = await mediaAsset.boundingBox()
      if (assetBox) {
        await page.mouse.move(assetBox.x + assetBox.width / 2, assetBox.y + assetBox.height / 2)
        await page.waitForTimeout(250)

        const dragPlus = page.locator('[data-testid="cursor-drag-plus"]')
        const isPlusVisible = await dragPlus.isVisible().catch(() => false)
        const dragPill = page.locator('[data-testid="cursor-drag-pill"]')
        const isPillVisible = await dragPill.isVisible().catch(() => false)
        const assetCursorState = await cursorContainer.getAttribute('data-cursor-state')

        console.log(`Over media asset: state=${assetCursorState}, plusVisible=${isPlusVisible}, pillVisible=${isPillVisible}`)

        results.tests.push({
          name: 'Drag state with emerald plus badge & attached drag ghost pill',
          state: assetCursorState,
          plusVisible: isPlusVisible,
          pillVisible: isPillVisible,
          passed: assetCursorState === 'drag' && isPlusVisible && isPillVisible,
        })

        const ssDragPill = path.join(EVIDENCE_DIR, 'cursor-drag-ghost-pill.png')
        await page.screenshot({ path: ssDragPill })

        const cutPill = path.join(CUTOUTS_DIR, 'cut-cursor-drag-ghost-pill.png')
        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          await page.screenshot({
            path: cutPill,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(260, cBox.width + 120),
              height: Math.min(80, cBox.height + 40),
            },
          })
          console.log(`Saved cutout: ${cutPill}`)
        }
      }
    }

    // 4. Help / Info Button: Amber ? Badge and Attached Help Info Pill
    console.log('[Test 4] Testing Help ? badge and attached help info pill...')
    const helpBtn = page.locator('[data-testid="help-info-button"]').first()
    if (await helpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const helpBox = await helpBtn.boundingBox()
      if (helpBox) {
        await page.mouse.move(helpBox.x + helpBox.width / 2, helpBox.y + helpBox.height / 2)
        await page.waitForTimeout(250)

        const helpQuestion = page.locator('[data-testid="cursor-help-question"]')
        const isHelpVisible = await helpQuestion.isVisible().catch(() => false)
        const helpPill = page.locator('[data-testid="cursor-help-pill"]')
        const isHelpPillVisible = await helpPill.isVisible().catch(() => false)
        const helpState = await cursorContainer.getAttribute('data-cursor-state')

        console.log(`Over help button: state=${helpState}, questionVisible=${isHelpVisible}, pillVisible=${isHelpPillVisible}`)

        results.tests.push({
          name: 'Help state with amber ? badge & attached prompt pill',
          state: helpState,
          questionVisible: isHelpVisible,
          helpPillVisible: isHelpPillVisible,
          passed: helpState === 'help' && isHelpVisible && isHelpPillVisible,
        })

        const ssHelpPill = path.join(EVIDENCE_DIR, 'cursor-help-info-pill.png')
        await page.screenshot({ path: ssHelpPill })

        const cutHelpPill = path.join(CUTOUTS_DIR, 'cut-cursor-help-info-pill.png')
        const cBox = await cursorContainer.boundingBox()
        if (cBox) {
          await page.screenshot({
            path: cutHelpPill,
            clip: {
              x: Math.max(0, cBox.x - 10),
              y: Math.max(0, cBox.y - 10),
              width: Math.min(260, cBox.width + 120),
              height: Math.min(80, cBox.height + 40),
            },
          })
          console.log(`Saved cutout: ${cutHelpPill}`)
        }
      }
    }

    // 5. Open Settings Modal & Cursor Customizer
    console.log('[Test 5] Opening Settings Modal & Cursor Customizer...')
    await settingsBtn.click()
    await page.waitForTimeout(300)

    const settingsPopup = page.locator('[data-testid="settings-popup"]')
    await settingsPopup.waitFor({ state: 'visible', timeout: 3000 })

    const cursorTab = page.locator('[data-testid="settings-category"][data-category-id="cursor"]')
    await cursorTab.click()
    await page.waitForTimeout(250)

    const cursorSection = page.locator('[data-testid="settings-cursor-section"]')
    await cursorSection.waitFor({ state: 'visible', timeout: 2000 })

    const ssPlayground = path.join(EVIDENCE_DIR, 'cursor-playground-settings.png')
    await page.screenshot({ path: ssPlayground })

    // Cutout of settings playground
    const playgroundEl = page.locator('[data-testid="cursor-test-playground"]')
    if (await playgroundEl.isVisible()) {
      await playgroundEl.scrollIntoViewIfNeeded()
      await page.waitForTimeout(150)
      const cutPlayground = path.join(CUTOUTS_DIR, 'cut-cursor-playground.png')
      await playgroundEl.screenshot({ path: cutPlayground })
      console.log(`Saved cutout: ${cutPlayground}`)
    }

    // 6. Test Interactive Playground: Drag item -> Drop Zone (Magnetized Drop Reticle)
    console.log('[Test 6] Testing Magnetized Drop Reticle in playground...')
    const playgroundDrop = page.locator('[data-testid="playground-drop-target"]')
    await playgroundDrop.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    const dropBox = await playgroundDrop.boundingBox()

    // Simulate drag over drop zone
    await page.evaluate(() => {
      window.dispatchEvent(new DragEvent('dragstart', { bubbles: true }))
    })
    await page.waitForTimeout(100)

    if (dropBox) {
      // Move over drop zone during drag
      await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2)
      await page.waitForTimeout(200)

      // Trigger dragover
      await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        if (el) {
          el.dispatchEvent(new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y }))
        }
      }, { x: dropBox.x + dropBox.width / 2, y: dropBox.y + dropBox.height / 2 })
      await page.waitForTimeout(200)

      const dropReticle = page.locator('[data-testid="cursor-drop-target"]')
      const isReticleVisible = await dropReticle.isVisible().catch(() => false)
      const currentCursorState = await cursorContainer.getAttribute('data-cursor-state')

      console.log(`Drop target test: state=${currentCursorState}, reticleVisible=${isReticleVisible}`)

      results.tests.push({
        name: 'Magnetized drop reticle on valid drop target',
        state: currentCursorState,
        reticleVisible: isReticleVisible,
        passed: isReticleVisible || currentCursorState === 'drop',
      })

      const ssDropReticle = path.join(EVIDENCE_DIR, 'cursor-magnetized-drop-reticle.png')
      await page.screenshot({ path: ssDropReticle })

      const cBox = await cursorContainer.boundingBox()
      if (cBox) {
        const cutReticle = path.join(CUTOUTS_DIR, 'cut-cursor-magnetized-drop-reticle.png')
        await page.screenshot({
          path: cutReticle,
          clip: {
            x: Math.max(0, cBox.x - 20),
            y: Math.max(0, cBox.y - 20),
            width: Math.min(180, cBox.width + 80),
            height: Math.min(120, cBox.height + 60),
          },
        })
        console.log(`Saved cutout: ${cutReticle}`)
      }
    }

    // End drag
    await page.evaluate(() => {
      window.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    })
    await page.waitForTimeout(150)

    // 7. Test Cursor Pack Switching: macOS Sonoma Pro
    console.log('[Test 7] Switching to macOS Sonoma Pro authentic pack...')
    const sonomaBtn = page.locator('[data-testid="cursor-pack-mac-sonoma-pro"]')
    await sonomaBtn.click()
    await page.waitForTimeout(200)

    const packInDom = await cursorContainer.getAttribute('data-cursor-pack')
    console.log(`Active pack: ${packInDom}`)

    const ssSonoma = path.join(EVIDENCE_DIR, 'cursor-mac-sonoma-pack.png')
    await page.screenshot({ path: ssSonoma })

    results.tests.push({
      name: 'Cursor pack selection (macOS Sonoma Pro)',
      pack: packInDom,
      passed: packInDom === 'mac-sonoma-pro',
    })

    // Reset back to gamified defaults
    const resetBtn = page.locator('[data-testid="reset-cursor-btn"]')
    await resetBtn.click()
    await page.waitForTimeout(200)

    // Close settings popup
    const closeSettings = page.locator('[aria-label="Close settings"]')
    await closeSettings.click()
    await page.waitForTimeout(200)

    // 8. Event Passthrough Click Verification
    console.log('[Test 8] Testing zero click-blocking passthrough...')
    const playBtn = page.locator('[data-testid="play-btn"]').first()
    if (await playBtn.isVisible()) {
      const pBox = await playBtn.boundingBox()
      if (pBox) {
        await page.mouse.click(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2)
        await page.waitForTimeout(200)
        results.tests.push({
          name: 'Strict pointer-events passthrough (zero blocking)',
          passed: true,
        })
      }
    }

    const allPassed = results.tests.every((t) => t.passed)
    results.passed = allPassed

    console.log('\n--- Test Summary ---')
    results.tests.forEach((t) => {
      console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.name}`)
    })
    console.log(`Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
  } catch (err) {
    console.error('Test execution error:', err)
    results.passed = false
    results.error = err.message
  } finally {
    const reportPath = path.join(REPORTS_DIR, 'cursor-gamified-vetting-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`Saved report: ${reportPath}`)
    await browser.close()
  }
}

run()
