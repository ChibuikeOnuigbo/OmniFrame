import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'qa/screenshots')
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

const assert = (v, n, d = '') => {
  if (!v) throw Error(`${n}: ${d}`)
  results.push({ name: n, status: 'PASS', detail: d })
  console.log('PASS', n, d)
}

try {
  // ==========================================
  // DESKTOP VIEWPORT TEST (1440x900)
  // ==========================================
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))

  console.log('--- Step 1: Loading OmniFrame Studio ---')
  await page.goto(URL, { waitUntil: 'networkidle' })

  // 1. Verify Unified Preview (Program/Source button pill completely eliminated)
  console.log('--- Step 2: Verifying Unified Preview Architecture ---')
  const programPill = page.locator('[data-testid="monitor-mode-program-btn"]')
  const sourcePill = page.locator('[data-testid="monitor-mode-source-btn"]')
  assert((await programPill.count()) === 0, 'Program monitor button pill removed from UI')
  assert((await sourcePill.count()) === 0, 'Source monitor button pill removed from UI')

  // Ingest sample video asset
  const importInput = page.locator('#topbar-import-input')
  await importInput.setInputFiles([
    {
      name: 'clip1.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJ8gbaeAQH///+63Z5+VlA8AQ==', 'base64'),
    },
  ])
  await page.waitForTimeout(500)

  // Verify asset clicked in MediaPanel plays in unified preview
  await page.evaluate(() => {
    window.__omniframe_store.getState().setLeftOpen(true)
    window.__omniframe_store.getState().setLeftTab('media')
  })
  await page.waitForTimeout(300)

  const mediaCard = page.locator('[data-testid="media-asset"]').first()
  await mediaCard.click()
  await page.waitForTimeout(300)

  const assetStage = page.locator('[data-testid="preview-asset-stage"]')
  assert((await assetStage.count()) > 0, 'Media asset plays directly in unified Preview stage')

  const assetTransport = page.locator('[data-testid="asset-transport-bar"]')
  assert(await assetTransport.isVisible(), 'Asset transport controls (Play/Pause, Seek) visible')

  // Return to timeline sequence preview
  await page.locator('[data-testid="close-asset-preview-btn"]').click()
  await page.waitForTimeout(200)
  assert((await page.locator('[data-testid="preview-stage"]').count()) > 0, 'Returned to timeline sequence canvas')

  // Verify 3D Orbit View toggle
  const toggle3d = page.locator('[data-testid="toggle-3d-btn"]')
  await toggle3d.click()
  await page.waitForTimeout(300)
  assert(await page.locator('[data-testid="preview-3d-stage"]').isVisible(), '3D Orbit Viewer active in preview canvas')
  assert(await page.locator('[data-testid="three-canvas-wrapper"]').isVisible(), 'Three.js 3D WebGL canvas interactive')
  await toggle3d.click() // toggle back to 2D
  await page.waitForTimeout(200)

  // Add media to timeline
  await page.evaluate(() => {
    window.__omniframe_store.getState().setLeftOpen(true)
    window.__omniframe_store.getState().setLeftTab('media')
  })
  await page.waitForTimeout(300)
  await page.locator('[data-testid="add-to-timeline-btn"]').first().click({ force: true })
  await page.waitForTimeout(300)

  // 2. Test Text Tool & Text Rendering on Canvas
  console.log('--- Step 3: Testing Text Tool & Live Canvas Rendering ---')
  const textTab = page.locator('[data-testid="left-tab-text"]')
  await textTab.click()
  await page.waitForTimeout(200)

  const textPresetBtn = page.locator('[data-testid="text-preset-cinematic-title"]')
  await textPresetBtn.click()
  await page.waitForTimeout(300)

  // Assert text clip exists in store
  const textClip = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.find((c) => Boolean(c.textStyle))
  })
  assert(Boolean(textClip), 'Text Title clip created on timeline')
  assert(textClip.textStyle.text === 'EPISODE ONE', 'Text clip content initialized to EPISODE ONE')

  // Edit text content
  const textInput = page.locator('[data-testid="text-title-input"]')
  await textInput.fill('OMNIFRAME 2026 HERO')
  await page.waitForTimeout(200)

  const updatedText = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.find((c) => Boolean(c.textStyle))?.textStyle?.text
  })
  assert(updatedText === 'OMNIFRAME 2026 HERO', 'Text clip updated in store dynamically')

  // 3. Test Effects Panel & Real-Time Shader Filters
  console.log('--- Step 4: Testing Effects Panel Real-Time Color Filters ---')
  const effectsTab = page.locator('[data-testid="left-tab-effects"]')
  await effectsTab.click()
  await page.waitForTimeout(200)

  const cyberpunkBtn = page.locator('[data-testid="effect-preset-cyberpunk"]')
  await cyberpunkBtn.click()
  await page.waitForTimeout(200)

  const appliedEffects = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const active = s.clips.find((c) => c.id === s.selectedClipId) || s.clips[0]
    return active?.effects
  })
  assert(appliedEffects?.hueRotate === 280, 'Cyberpunk effect applied with hueRotate 280deg')
  assert(appliedEffects?.contrast === 1.35, 'Cyberpunk effect applied with contrast 1.35')

  // 4. Test Transitions Panel
  console.log('--- Step 5: Testing Video Transitions ---')
  const transTab = page.locator('[data-testid="left-tab-transitions"]')
  await transTab.click()
  await page.waitForTimeout(200)

  const applyCrossBtn = page.locator('[data-testid="apply-trans-btn-cross_dissolve"]')
  await applyCrossBtn.click()
  await page.waitForTimeout(300)

  const transCount = await page.evaluate(() => window.__omniframe_store.getState().transitions?.length || 0)
  assert(transCount >= 1, 'Cross Dissolve transition registered on timeline')

  // 5. Test Voice Isolation Context Menu Submenu
  console.log('--- Step 6: Testing Context Menu Voice Isolation Submenu ---')
  const timelineClip = page.locator('[data-testid="timeline-clip"]').first()
  await timelineClip.click({ button: 'right' })
  const contextMenu = page.getByTestId('studio-context-menu')
  await contextMenu.waitFor({ state: 'visible' })

  const isolateVoiceMenu = contextMenu.getByRole('menuitem', { name: /^Isolate Voice/ })
  assert((await isolateVoiceMenu.count()) === 1, 'Only single Isolate Voice item in main context menu')

  await isolateVoiceMenu.hover()
  await page.waitForTimeout(200)

  const submenu = page.locator('[data-testid="ctx-submenu-isolate-voice"]')
  await submenu.waitFor({ state: 'visible' })
  assert(await submenu.isVisible(), 'Side submenu opened on hover')
  assert((await submenu.getByRole('menuitem', { name: /Remove Vocal/ }).count()) === 1, 'Remove Vocal option in submenu')
  assert((await submenu.getByRole('menuitem', { name: /Keep Vocal/ }).count()) === 1, 'Keep Vocal option in submenu')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  await page.screenshot({ path: join(SHOTS, 'unified-desktop-suite.png') })
  await page.close()

  // ==========================================
  // MOBILE PHONE VIEWPORT TEST (390x844 - iPhone 14)
  // ==========================================
  console.log('--- Step 7: Verifying Mobile Responsiveness (390x844) ---')
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobilePage.goto(URL, { waitUntil: 'networkidle' })

  // Verify no horizontal document overflow
  const isHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  assert(!isHorizontalOverflow, 'No horizontal document overflow on 390px mobile viewport')

  // Open LeftDock drawer on mobile
  const mobileMediaTab = mobilePage.locator('[data-testid="left-tab-media"]')
  await mobileMediaTab.click()
  await mobilePage.waitForTimeout(300)

  const leftPanel = mobilePage.locator('[data-testid="left-panel"]')
  assert(await leftPanel.isVisible(), 'LeftDock panel slides out cleanly on mobile')

  await mobilePage.screenshot({ path: join(SHOTS, 'mobile-drawer-responsive.png') })

  // Close drawer
  await mobileMediaTab.click()
  await mobilePage.waitForTimeout(200)

  // Verify Preview canvas scales to mobile screen
  const mobilePreview = mobilePage.locator('[data-testid="preview-viewport"]')
  assert(await mobilePreview.isVisible(), 'Preview canvas scales responsively on mobile screen')

  await mobilePage.screenshot({ path: join(SHOTS, 'mobile-full-studio.png') })
  await mobilePage.close()

  assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))

  writeFileSync(
    join(REPORTS, 'unified-preview-text-effects-results.json'),
    JSON.stringify({ results, errors }, null, 2),
  )
  console.log(`\nRESULT: ALL ${results.length} PASS!`)
} finally {
  await browser.close()
}
