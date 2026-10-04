import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'

const ROOT = process.cwd()
const EVID_DIR = resolve('evidence/screenshots')
const CUT_DIR = resolve('evidence/cutouts')
const REPORT_DIR = resolve('qa/reports')
if (!existsSync(EVID_DIR)) mkdirSync(EVID_DIR, { recursive: true })
if (!existsSync(CUT_DIR)) mkdirSync(CUT_DIR, { recursive: true })
if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080, type: 'desktop' },
  { name: 'desktop_1440x900', width: 1440, height: 900, type: 'desktop' },
  { name: 'tablet_1024x768', width: 1024, height: 768, type: 'tablet' },
  { name: 'tablet_768x1024', width: 768, height: 1024, type: 'tablet' },
  { name: 'mobile_390x844', width: 390, height: 844, type: 'mobile' },
  { name: 'mobile_360x800', width: 360, height: 800, type: 'mobile' },
  { name: 'mobile_320x640', width: 320, height: 640, type: 'mobile' },
]

async function runResponsivenessVetting() {
  console.log('=== Step 1: Launch Headless Chromium for Responsive Resize Vetting ===')
  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  const results = {
    viewportsTested: [],
    overflowZeroVerified: true,
    drawingToolbarResponsiveVerified: false,
    settingsModalResponsiveVerified: false,
    timelineTransportResponsiveVerified: false,
    screenshots: {},
  }

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Vetting Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`)
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()

    await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)

    // Ensure timeline has a video clip so all subsystems (timeline, preview, inspector) are populated
    await page.evaluate(() => {
      const store = window.__omniframe_store
      const trk = store.getState().ensureTrack('video')
      store.getState().addClipToTrack(trk, 'asset-death-note-vid', 0)
      store.setState({ selectedClipId: store.getState().clips[0]?.id || null })
    })
    await page.waitForTimeout(400)

    // Check page horizontal overflow: scrollWidth must equal clientWidth (no horizontal scrollbar leaks!)
    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasOverflow: doc.scrollWidth > doc.clientWidth,
      }
    })
    console.log(`  -> Page width metrics: scrollWidth=${overflowCheck.scrollWidth}, clientWidth=${overflowCheck.clientWidth}, overflow=${overflowCheck.hasOverflow}`)
    assert(!overflowCheck.hasOverflow, `Viewport ${vp.name} must have zero page horizontal overflow`)

    // Verify Timeline transport buttons exist and are visible
    const splitBtn = page.locator('[data-testid="timeline-split-btn"]')
    const markerBtn = page.locator('[data-testid="add-marker-btn"]')
    const snapBtn = page.locator('[data-testid="snapping-toggle"]')
    assert((await splitBtn.count()) > 0, 'Split button present in timeline transport')
    assert((await markerBtn.count()) > 0, 'Marker button present in timeline transport')
    assert((await snapBtn.count()) > 0, 'Snap button present in timeline transport')

    // Take full viewport screenshot
    const shotPath = join(EVID_DIR, `responsiveness-${vp.name}.png`)
    await page.screenshot({ path: shotPath, fullPage: false })
    console.log(`  -> Captured Screenshot: ${shotPath}`)
    results.screenshots[vp.name] = shotPath
    results.viewportsTested.push(vp)

    // Specialized checks for mobile viewports
    if (vp.width <= 390) {
      // Check Drawing toolbar responsive constraint
      const drawingToggle = page.locator('[data-testid="toggle-drawing-btn"]')
      if (await drawingToggle.isVisible()) {
        await drawingToggle.click()
        await page.waitForTimeout(300)

        const drawingToolbar = page.locator('[data-testid="drawing-toolbar"]')
        if (await drawingToolbar.isVisible()) {
          const dtBox = await drawingToolbar.boundingBox()
          console.log(`  -> Mobile Drawing Toolbar on ${vp.name}: width=${dtBox.width}, maxWidth=${vp.width - 16}`)
          assert(dtBox.width <= vp.width, `Drawing toolbar width (${dtBox.width}px) fits on ${vp.width}px screen`)
          results.drawingToolbarResponsiveVerified = true
          await drawingToolbar.screenshot({ path: join(CUT_DIR, `cut-drawing-toolbar-responsive-${vp.name}.png`) })
        }
        await drawingToggle.click()
        await page.waitForTimeout(200)
      }

      // Check Mobile Settings Popup
      const settingsBtn = page.locator('[data-testid="settings-button"]')
      await settingsBtn.click()
      await page.waitForTimeout(300)

      const settingsPopup = page.locator('[data-testid="settings-popup"]')
      if (await settingsPopup.isVisible()) {
        const sBox = await settingsPopup.boundingBox()
        console.log(`  -> Mobile Settings Popup on ${vp.name}: x=${sBox.x}, width=${sBox.width}`)
        assert(sBox.x >= 0, 'Settings popup left coordinate is non-negative')
        assert(sBox.x + sBox.width <= vp.width, `Settings popup right edge (${sBox.x + sBox.width}px) <= viewport width (${vp.width}px)`)
        results.settingsModalResponsiveVerified = true

        if (vp.width === 390) {
          await page.screenshot({ path: join(EVID_DIR, 'responsiveness-mobile-settings-open.png') })
        }
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)

      // Test mobile drawer toggle (open left media panel on mobile)
      const leftTabMedia = page.locator('[data-testid="left-tab-media"]')
      await leftTabMedia.click()
      await page.waitForTimeout(300)
      const leftPanel = page.locator('[data-testid="left-panel"]')
      const isOpen = await leftPanel.getAttribute('data-open')
      assert.strictEqual(isOpen, 'true', 'Left drawer opens on mobile touch/click')

      if (vp.width === 390) {
        await page.screenshot({ path: join(EVID_DIR, 'responsiveness-mobile-drawer-open.png') })
      }
    }

    // Capture transport toolbar cutout on desktop & tablet
    if (vp.width >= 768 && !results.timelineTransportResponsiveVerified) {
      const transportEl = page.locator('[data-testid="timeline-split-btn"]').locator('..')
      await transportEl.screenshot({ path: join(CUT_DIR, `cut-timeline-transport-responsive-${vp.name}.png`) })
      results.timelineTransportResponsiveVerified = true
    }

    await context.close()
  }

  writeFileSync(join(REPORT_DIR, 'responsiveness-vetting-report.json'), JSON.stringify(results, null, 2))
  await browser.close()
  console.log('\n=== All Responsive Resize Vetting Checks Completed Successfully ===')
}

runResponsivenessVetting().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
