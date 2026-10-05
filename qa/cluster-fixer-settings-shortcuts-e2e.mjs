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

async function runClusterFixerVerification() {
  console.log('=== Step 1: Launch Headless Chromium for Cluster Fixer & Settings E2E ===')
  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  const report = {
    iconTooltipSpaceSaved: false,
    accordionCollapsibleVerified: false,
    duplicateButtonsRemoved: false,
    contextMenuCustomizationVerified: false,
    shortcutsCustomizationVerified: false,
    mobileSettingsResponsive360px: false,
  }

  // ==========================================
  // TEST SUITE 1: DESKTOP (1440x900)
  // ==========================================
  console.log('=== Test Suite 1: Desktop Viewport (1440x900) ===')
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktopContext.newPage()

  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })

// Section presentation: these workflows exercise disclosure headers, so run
// in single-open accordion mode (production default is tabs).
try {
  await page.evaluate(() => window.__omniframe_store?.getState?.().setSidebarSectionMode?.('accordion'))
} catch {}
  await page.waitForTimeout(1000)

  // Subtest 1A: Check Space-Saving Icon + Tooltip Buttons on Timeline
  console.log('  -> Checking Icon + Tooltip timeline buttons (Split, Marker, Snap)...')
  const splitBtn = page.locator('[data-testid="timeline-split-btn"]')
  await splitBtn.waitFor({ state: 'visible' })
  const splitTitle = await splitBtn.getAttribute('title')
  assert(splitTitle && splitTitle.includes('Split at playhead'), 'Split button has descriptive tooltip')

  const markerBtn = page.locator('[data-testid="add-marker-btn"]')
  await markerBtn.waitFor({ state: 'visible' })
  const markerTitle = await markerBtn.getAttribute('title')
  assert(markerTitle && markerTitle.includes('Marker'), 'Marker button has descriptive tooltip')

  const snapBtn = page.locator('[data-testid="snapping-toggle"]')
  await snapBtn.waitFor({ state: 'visible' })
  const snapTitle = await snapBtn.getAttribute('title')
  assert(snapTitle && snapTitle.includes('Snapping'), 'Snapping button has descriptive tooltip')

  // Check MediaPanel compact import button
  const mediaTab = page.locator('[data-testid="left-tab-media"]')
  await mediaTab.click()
  await page.waitForTimeout(300)
  const mediaImportBtn = page.locator('[data-testid="media-import-btn"]')
  await mediaImportBtn.waitFor({ state: 'visible' })
  const mediaImportTitle = await mediaImportBtn.getAttribute('title')
  assert(mediaImportTitle && mediaImportTitle.includes('Import'), 'Media import button is compact icon with tooltip')
  report.iconTooltipSpaceSaved = true

  // Subtest 1B: Accordion & Collapsible Sub-groups in RightPanel Inspector
  console.log('  -> Checking Accordion & Collapsible Inspector Groups...')
  // Select a clip so inspector shows Clip Inspector
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const trk = store.getState().ensureTrack('video')
    store.getState().addClipToTrack(trk, 'asset-death-note-vid', 0)
    const freshClips = store.getState().clips
    store.setState({ selectedClipId: freshClips[0]?.id || null, rightOpen: true })
  })
  await page.waitForTimeout(500)

  const transformHeader = page.locator('[data-testid="section-header-transform"]')
  await transformHeader.waitFor({ state: 'visible' })
  // Sections are single-open now: expand Transform before inspecting it.
  await transformHeader.click()
  await page.waitForTimeout(300)

  // 3D Spatial Accordion Sub-group
  const accordion3D = page.locator('[data-testid="accordion-3d-spatial-(depth,-tilt,-pan)"]')
  await accordion3D.waitFor({ state: 'visible' })
  // Click to open 3D Spatial accordion
  await accordion3D.click()
  await page.waitForTimeout(300)

  // Check uncluster toggle button
  const unclusterBtn = page.locator('[data-testid="inspector-uncluster-btn"]')
  await unclusterBtn.waitFor({ state: 'visible' })
  await unclusterBtn.click()
  await page.waitForTimeout(300)

  const cutInspectorPath = join(CUT_DIR, 'cut-inspector-unclustered-accordion.png')
  const rightPanelEl = page.locator('[data-testid="section-header-transform"]')
  await rightPanelEl.screenshot({ path: cutInspectorPath })
  console.log('  -> Saved Inspector Accordion Cutout:', cutInspectorPath)
  report.accordionCollapsibleVerified = true

  // Subtest 1C: Settings Popup - Context Menu Customization
  console.log('  -> Testing Settings Popup: Context Menu Customization...')
  const settingsBtn = page.locator('[data-testid="settings-button"]')
  await settingsBtn.click()
  await page.waitForTimeout(400)

  const settingsPopup = page.locator('[data-testid="settings-popup"]')
  await settingsPopup.waitFor({ state: 'visible' })

  // Click Context Menu category tab
  const ctxCategoryBtn = page.locator('[data-category-id="contextMenu"]')
  await ctxCategoryBtn.waitFor({ state: 'visible' })
  await ctxCategoryBtn.click()
  await page.waitForTimeout(300)

  const ctxSection = page.locator('[data-testid="settings-context-menu-section"]')
  await ctxSection.waitFor({ state: 'visible' })

  const cutCtxSettingsPath = join(CUT_DIR, 'cut-settings-context-menu-customizer.png')
  await ctxSection.screenshot({ path: cutCtxSettingsPath })
  console.log('  -> Saved Context Menu Settings Cutout:', cutCtxSettingsPath)

  // Toggle off 'separate-audio' in settings
  const toggleSepAudio = page.locator('[data-testid="ctx-setting-toggle-separate-audio"] input')
  await toggleSepAudio.click()
  await page.waitForTimeout(200)

  // Verify store reflects that 'separate-audio' is disabled
  const isSepAudioEnabled = await page.evaluate(
    () => window.__omniframe_store.getState().contextMenuEnabledCommands['separate-audio'],
  )
  assert.strictEqual(isSepAudioEnabled, false, 'separate-audio successfully disabled in context menu settings')

  // Close settings popup
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Right-click video clip and verify 'separate-audio' is hidden
  const videoClipEl = page.locator('[data-testid="timeline-clip"]').first()
  await videoClipEl.click({ button: 'right' })
  await page.waitForTimeout(400)

  const ctxMenu = page.locator('[data-testid="studio-context-menu"]')
  await ctxMenu.waitFor({ state: 'visible' })

  const sepAudioCmdCount = await page.locator('[data-testid="ctx-cmd-separate-audio"]').count()
  assert.strictEqual(sepAudioCmdCount, 0, 'Disabled command is hidden from context menu')

  // Verify other commands and shortcuts appear in context menu
  const splitCmd = page.locator('[data-testid="ctx-cmd-split"]')
  assert((await splitCmd.count()) > 0, 'Split at Playhead appears in context menu')

  const markerCmd = page.locator('[data-testid="ctx-cmd-marker"]')
  assert((await markerCmd.count()) > 0, 'Add Marker appears in context menu')

  const cutCmd = page.locator('[data-testid="ctx-cmd-cut"]')
  assert((await cutCmd.count()) > 0, 'Cut command appears in context menu')

  // Dismiss context menu
  await page.click('body', { position: { x: 50, y: 50 } })
  await page.waitForTimeout(300)
  report.contextMenuCustomizationVerified = true

  // Subtest 1D: Settings Popup - Keyboard Shortcuts Customization
  console.log('  -> Testing Settings Popup: Keyboard Shortcuts Customization...')
  await settingsBtn.click()
  await page.waitForTimeout(400)

  const shortcutsCategoryBtn = page.locator('[data-category-id="shortcuts"]')
  await shortcutsCategoryBtn.waitFor({ state: 'visible' })
  await shortcutsCategoryBtn.click()
  await page.waitForTimeout(300)

  const shortcutsSection = page.locator('[data-testid="settings-shortcuts-section"]')
  await shortcutsSection.waitFor({ state: 'visible' })

  const cutShortcutsPath = join(CUT_DIR, 'cut-settings-shortcuts-customizer.png')
  await shortcutsSection.screenshot({ path: cutShortcutsPath })
  console.log('  -> Saved Shortcuts Settings Cutout:', cutShortcutsPath)

  // Edit a shortcut (e.g. edit 'split' from 'B' to 'X')
  const editSplitBtn = page.locator('[data-testid="edit-shortcut-split"]')
  await editSplitBtn.click()
  await page.waitForTimeout(200)

  const splitInput = page.locator('[data-testid="shortcut-input-split"]')
  await splitInput.fill('X')
  await splitInput.press('Enter')
  await page.waitForTimeout(300)

  const updatedSplitShortcut = await page.evaluate(
    () => window.__omniframe_store.getState().customShortcuts.split,
  )
  assert.strictEqual(updatedSplitShortcut, 'X', 'Custom shortcut X successfully saved in store')

  // Click Reset All
  const resetShortcutsBtn = page.locator('[data-testid="reset-shortcuts-btn"]')
  await resetShortcutsBtn.click()
  await page.waitForTimeout(200)

  const restoredSplitShortcut = await page.evaluate(
    () => window.__omniframe_store.getState().customShortcuts.split,
  )
  assert.strictEqual(restoredSplitShortcut, 'B', 'Default shortcut B restored after reset')
  report.shortcutsCustomizationVerified = true

  // Capture Full Desktop Studio Screenshot with Settings open
  const fullDesktopPath = join(EVID_DIR, 'cluster-fixer-settings-desktop.png')
  await page.screenshot({ path: fullDesktopPath, fullPage: false })
  console.log('  -> Saved Full Desktop Studio Screenshot:', fullDesktopPath)

  await desktopContext.close()

  // ==========================================
  // TEST SUITE 2: MOBILE (360x800) RESPONSIVENESS
  // ==========================================
  console.log('=== Test Suite 2: Mobile Viewport (360x800) Settings Popup Responsiveness ===')
  const mobileContext = await browser.newContext({ viewport: { width: 360, height: 800 } })
  const mobilePage = await mobileContext.newPage()

  await mobilePage.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(1000)

  const mobileSettingsBtn = mobilePage.locator('[data-testid="settings-button"]')
  await mobileSettingsBtn.click()
  await mobilePage.waitForTimeout(400)

  const mobileSettingsPopup = mobilePage.locator('[data-testid="settings-popup"]')
  await mobileSettingsPopup.waitFor({ state: 'visible' })

  // Verify bounding box on 360px screen
  const box = await mobileSettingsPopup.boundingBox()
  console.log(`  -> Mobile Settings Popup Box on 360px screen: width=${box.width}, height=${box.height}, x=${box.x}`)
  assert(box.width <= 360, `Settings popup width (${box.width}px) fits within 360px viewport`)
  assert(box.x >= 0, `Settings popup x position (${box.x}px) is non-negative and not clipped`)
  assert(box.x + box.width <= 360, `Settings popup right edge (${box.x + box.width}px) is within screen bounds`)

  // Click Context Menu category on mobile
  const mobileCtxCatBtn = mobilePage.locator('[data-category-id="contextMenu"]')
  await mobileCtxCatBtn.click()
  await mobilePage.waitForTimeout(300)

  const mobileSettingsPath = join(EVID_DIR, 'cluster-fixer-settings-mobile-360x800.png')
  await mobilePage.screenshot({ path: mobileSettingsPath, fullPage: false })
  console.log('  -> Saved Mobile Settings Screenshot:', mobileSettingsPath)
  report.mobileSettingsResponsive360px = true

  await mobileContext.close()
  await browser.close()

  writeFileSync(join(REPORT_DIR, 'cluster-fixer-report.json'), JSON.stringify(report, null, 2))
  console.log('=== All Cluster Fixer & Settings Verifications Passed Successfully ===')
}

runClusterFixerVerification().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
