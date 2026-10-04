import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const ROOT = '/home/user/OmniFrame'
const SHOTS = join(ROOT, 'evidence/screenshots')
mkdirSync(SHOTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  console.log('--- Step 1: Navigating to OmniFrame Studio ---')
  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })

  // Seed sample asset and clip
  await page.evaluate(() => {
    const store = window.__omniframe_store
    if (!store) return
    const s = store.getState()
    if (s.clips.length === 0) {
      s.addAsset({
        id: 'test-vid-audio',
        name: 'Bro killed 99.9% of the Viltrumites - INVINCIBLE',
        kind: 'video',
        duration: 30.5,
        width: 1080,
        height: 1080,
        fps: 30,
        url: 'blob:mock-vid-audio',
      })
      const trkId = s.ensureTrack('video')
      s.addClipToTrack(trkId, 'test-vid-audio', 0)
    }
  })
  await page.waitForTimeout(500)

  console.log('--- Step 2: Testing RightPanel Audio Section & Voice Isolation Checkbox ---')
  const info = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clipsCount: s.clips.length,
      selectedClipId: s.selectedClipId,
      rightOpen: s.rightOpen,
      tracks: s.tracks.map(t => ({ id: t.id, type: t.type }))
    }
  })
  console.log('Store info:', info)

  // Select first clip via timeline clip click
  const clipToSelect = page.locator('.timeline-clip').first()
  if (await clipToSelect.isVisible()) {
    await clipToSelect.click()
  } else {
    await page.evaluate(() => {
      const s = window.__omniframe_store.getState()
      if (s.clips[0]) s.selectClip(s.clips[0].id)
    })
  }
  await page.evaluate(() => window.__omniframe_store.getState().setRightOpen(true))
  await page.waitForTimeout(400)

  // Verify Audio section in inspector
  const checkbox = page.locator('[data-testid="audio-voice-isolation-checkbox"]')
  assert(await checkbox.isVisible(), 'Voice Isolation checkbox is visible in RightPanel Audio section')
  const isInitiallyChecked = await checkbox.isChecked()
  assert.strictEqual(isInitiallyChecked, false, 'Checkbox is initially unchecked')

  // Check the checkbox
  await checkbox.check()
  await page.waitForTimeout(300)

  // Verify custom dropdown appears underneath
  const controls = page.locator('[data-testid="audio-isolation-controls"]')
  assert(await controls.isVisible(), 'Custom dropdown container appears directly underneath checkbox')

  const modeDropdown = page.locator('[data-testid="audio-isolation-mode-dropdown"]')
  assert(await modeDropdown.isVisible(), 'Isolation mode dropdown is visible')
  const modeOptions = await modeDropdown.locator('option').allTextContents()
  assert(modeOptions.some(o => o.includes('Remove Vocal')), 'Contains Remove Vocal option')
  assert(modeOptions.some(o => o.includes('Keep Vocal')), 'Contains Keep Vocal option')
  console.log('[PASS] Mode dropdown options verified:', modeOptions)

  const modelDropdown = page.locator('[data-testid="audio-isolation-model-dropdown"]')
  assert(await modelDropdown.isVisible(), 'Neural model dropdown is visible')
  const modelOptions = await modelDropdown.locator('option').allTextContents()
  assert(modelOptions.some(o => o.includes('omni-voicetarget')), 'Contains omni-voicetarget neural model option')
  console.log('[PASS] Model dropdown options verified:', modelOptions)

  console.log('--- Step 3: Testing Context Menu Hover Side Flyout (No Popups) ---')
  // Find a timeline clip to right-click
  const clipEl = page.locator('[data-testid="timeline-clip"]').first()
  await clipEl.click({ button: 'right' })
  await page.waitForTimeout(300)

  const contextMenu = page.locator('[data-testid="studio-context-menu"]')
  assert(await contextMenu.isVisible(), 'Context menu opened on right-click')

  // Hover over Isolate Voice
  const isolateCmd = page.locator('[data-testid="ctx-cmd-isolate-voice"]')
  assert(await isolateCmd.isVisible(), 'Isolate Voice command is in context menu')
  await isolateCmd.hover()
  await page.waitForTimeout(300)

  // Verify side flyout submenu is visible
  const submenu = page.locator('[data-testid="ctx-submenu-isolate-voice"]')
  assert(await submenu.isVisible(), 'Side flyout submenu appeared beside Isolate Voice')

  const subItems = await submenu.locator('button').allTextContents()
  console.log('Submenu items:', subItems)
  assert.strictEqual(subItems.length, 2, 'Submenu contains exactly two options')
  assert(subItems.some(i => i.includes('Remove Vocal')), 'Submenu has Remove Vocal')
  assert(subItems.some(i => i.includes('Keep Vocal')), 'Submenu has Keep Vocal')

  // Verify no popup modal launcher exists
  const modalLauncher = page.locator('[data-testid="ctx-cmd-isolate-voice-modal"]')
  assert.strictEqual(await modalLauncher.count(), 0, 'No popup modal launcher in submenu')
  console.log('[PASS] Zero popup modals verified in context menu')

  console.log('--- Step 4: Testing Context Menu Outside Dismissal (Never Stuck) ---')
  // Verify context menu is currently open
  assert(await contextMenu.isVisible(), 'Context menu is visible before outside click')

  // Click on preview stage outside the context menu
  const previewStage = page.locator('[data-testid="preview-stage"]').first()
  if (await previewStage.isVisible()) {
    await previewStage.click({ position: { x: 50, y: 50 } })
  } else {
    await page.mouse.click(100, 100)
  }
  await page.waitForTimeout(300)

  // Verify context menu immediately dismissed
  assert.strictEqual(await contextMenu.isVisible(), false, 'Context menu closed immediately on outside click (never stuck)')
  console.log('[PASS] Context menu outside dismiss verified')

  console.log('--- Step 5: Testing LeftDock Audio Tab Renaming ---')
  const audioTab = page.locator('button[title*="Audio"], button[data-tab="audio"]').first()
  assert(await audioTab.isVisible(), 'LeftDock Audio tab exists and is labeled Audio')
  console.log('[PASS] LeftDock Audio tab verified')

  console.log('--- Step 6: Capturing Visual Proof Screenshot ---')
  // Open RightPanel checkbox dropdown and capture full screenshot
  const shotPath = join(SHOTS, 'audio-inspector-checkbox-context.png')
  await page.screenshot({ path: shotPath })
  console.log(`[PASS] Visual proof screenshot saved to ${shotPath}`)

  console.log('ALL AUDIO & CONTEXT CRITERIA VERIFIED SUCCESSFULLY!')
} catch (err) {
  console.error('Test failed:', err)
  process.exit(1)
} finally {
  await browser.close()
}
