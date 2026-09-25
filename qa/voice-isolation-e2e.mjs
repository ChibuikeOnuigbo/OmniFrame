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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = []
const errors = []

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

const assert = (v, n, d = '') => {
  if (!v) throw Error(`${n}: ${d}`)
  results.push({ name: n, status: 'PASS', detail: d })
  console.log('PASS', n, d)
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' })

  // 1. Sidebar tab and panel verification
  const voiceRailBtn = page.getByTitle('Voice Isolation')
  assert((await voiceRailBtn.count()) === 1, 'Voice Isolation tab present in left rail')

  await voiceRailBtn.click()
  const panel = page.locator('[data-testid="voice-isolation-panel"]')
  await panel.waitFor({ state: 'visible', timeout: 5000 })
  assert(await panel.isVisible(), 'Voice Isolation sidebar panel opened')

  assert(await page.locator('[data-testid="panel-mode-keep-vocal"]').isVisible(), 'Keep Vocal button in sidebar')
  assert(await page.locator('[data-testid="panel-mode-remove-vocal"]').isVisible(), 'Remove Vocal button in sidebar')
  assert(await page.locator('[data-testid="panel-strength-slider"]').isVisible(), 'Separation strength slider in sidebar')
  assert(await page.locator('[data-testid="panel-preserve-bass-toggle"]').isVisible(), 'Preserve bass toggle in sidebar')
  assert(await page.locator('[data-testid="panel-speech-focus-toggle"]').isVisible(), 'Speech focus toggle in sidebar')
  assert(await page.locator('[data-testid="panel-execute-voice-btn"]').isVisible(), 'Execute button in sidebar')

  await page.screenshot({ path: join(SHOTS, 'voice-isolation-sidebar-panel.png') })

  // 2. Import audio fixture and add to timeline
  await page.locator('[data-testid="left-tab-media"]').click()
  await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
  await page.waitForTimeout(500)

  const addBtn = page.locator('[data-testid="add-to-timeline-btn"]').first()
  await addBtn.waitFor({ state: 'visible' })
  await addBtn.click({ force: true })
  await page.waitForTimeout(400)

  // 3. Verify clip on timeline
  const audioClip = page.locator('[data-testid="timeline-clip"][data-kind="audio"]').first()
  await audioClip.waitFor({ state: 'visible' })
  assert(await audioClip.isVisible(), 'Source audio clip placed on timeline')

  // 4. Right-click context menu verification
  await audioClip.click({ button: 'right' })
  const menu = page.getByTestId('studio-context-menu')
  await menu.waitFor({ state: 'visible' })

  assert((await menu.getByRole('menuitem', { name: /^Isolate Voice…/ }).count()) === 1, 'Isolate Voice… modal launcher in context menu')
  assert((await menu.getByRole('menuitem', { name: /^Isolate Voice \(Keep Vocal\)/ }).count()) === 1, 'Keep Vocal quick action in context menu')
  assert((await menu.getByRole('menuitem', { name: /^Isolate Voice \(Remove Vocal\)/ }).count()) === 1, 'Remove Vocal quick action in context menu')

  await page.screenshot({ path: join(SHOTS, 'voice-isolation-context-menu.png') })

  // 5. Open Voice Isolation Modal from context menu
  await menu.getByRole('menuitem', { name: /^Isolate Voice…/ }).click()
  const modal = page.locator('[data-testid="voice-isolation-modal"]')
  await modal.waitFor({ state: 'visible' })
  assert(await modal.isVisible(), 'Voice Isolation Modal opens from context menu')

  assert(await page.locator('[data-testid="voice-isolation-clip-select"]').isVisible(), 'Target clip selector present in modal')
  assert(await page.locator('[data-testid="mode-keep-vocal-btn"]').isVisible(), 'Keep vocal mode button in modal')
  assert(await page.locator('[data-testid="mode-remove-vocal-btn"]').isVisible(), 'Remove vocal mode button in modal')
  assert(await page.locator('[data-testid="voice-isolation-strength-slider"]').isVisible(), 'Strength slider in modal')
  assert(await page.locator('[data-testid="preserve-bass-toggle"]').isVisible(), 'Preserve bass toggle in modal')
  assert(await page.locator('[data-testid="speech-focus-toggle"]').isVisible(), 'Speech focus toggle in modal')

  await page.screenshot({ path: join(SHOTS, 'voice-isolation-modal.png') })

  // 6. Execute Remove Vocal (Instrumental) DSP via modal
  await page.locator('[data-testid="mode-remove-vocal-btn"]').click()
  await page.locator('[data-testid="voice-isolation-strength-slider"]').fill('0.85')

  await page.locator('[data-testid="execute-voice-isolation-btn"]').click()

  // Wait for processing status and completion
  await modal.waitFor({ state: 'hidden', timeout: 15000 })
  assert((await modal.count()) === 0, 'Modal automatically closes upon DSP completion')

  // 7. Verify new synchronized clip and asset created
  await page.waitForTimeout(500)
  const clips = await page.evaluate(() => window.__omniframe_store.getState().clips)
  const assets = await page.evaluate(() => window.__omniframe_store.getState().assets)

  const removedClip = clips.find((c) => c.name.includes('[Vocal Removed]'))
  assert(Boolean(removedClip), 'New synchronized clip with [Vocal Removed] created on timeline')
  assert(removedClip.kind === 'audio', 'Removed vocal clip is canonical audio kind')

  const removedAsset = assets.find((a) => a.name.includes('[Vocal Removed]'))
  assert(Boolean(removedAsset), 'New isolated asset registered in Media Library')
  assert(Boolean(removedAsset.waveform && removedAsset.waveform.length === 256), 'Waveform extracted with 256 bins for isolated asset')

  // 8. Execute Keep Vocal (Voice Isolation) via Sidebar Panel
  await page.getByTitle('Voice Isolation').click()
  await panel.waitFor({ state: 'visible' })
  await page.locator('[data-testid="panel-mode-keep-vocal"]').click()
  await page.locator('[data-testid="panel-execute-voice-btn"]').click()

  // Wait for success alert in sidebar
  const successAlert = page.locator('[data-testid="panel-success-alert"]')
  await successAlert.waitFor({ state: 'visible', timeout: 15000 })
  assert(await successAlert.isVisible(), 'Success alert displayed in sidebar panel')

  const updatedClips = await page.evaluate(() => window.__omniframe_store.getState().clips)
  const isolatedClip = updatedClips.find((c) => c.name.includes('[Vocal Isolated]'))
  assert(Boolean(isolatedClip), 'New synchronized clip with [Vocal Isolated] created on timeline')

  const updatedAssets = await page.evaluate(() => window.__omniframe_store.getState().assets)
  const isolatedAsset = updatedAssets.find((a) => a.name.includes('[Vocal Isolated]'))
  assert(Boolean(isolatedAsset), 'Isolated vocal asset registered in Media Library')

  await page.screenshot({ path: join(SHOTS, 'voice-isolation-timeline-tracks.png') })

  // Verify zero runtime errors
  assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))

  writeFileSync(
    join(REPORTS, 'voice-isolation-results.json'),
    JSON.stringify({ results, errors }, null, 2),
  )
  console.log(`RESULT ${results.length} PASS`)
} finally {
  await browser.close()
}
