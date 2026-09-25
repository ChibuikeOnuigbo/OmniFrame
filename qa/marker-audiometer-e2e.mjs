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

  // 1. Verify Audio Meter component in Transport Bar
  const meter = page.locator('[data-testid="audio-vu-meter"]')
  await meter.waitFor({ state: 'visible', timeout: 5000 })
  assert(await meter.isVisible(), 'Audio VU Meter is visible in transport bar')

  const leftBar = page.locator('[data-testid="vu-meter-left-bar"]')
  const rightBar = page.locator('[data-testid="vu-meter-right-bar"]')
  assert((await leftBar.count()) > 0, 'Left channel LED bar mounted in DOM')
  assert((await rightBar.count()) > 0, 'Right channel LED bar mounted in DOM')

  const masterVolSlider = page.locator('[data-testid="master-volume-slider"]')
  assert(await masterVolSlider.isVisible(), 'Master volume slider visible')
  await masterVolSlider.fill('1.25')
  const volValue = await page.evaluate(() => window.__omniframe_store.getState().masterVolume)
  assert(Math.abs(volValue - 1.25) < 0.01, 'Master volume updated in store')

  const muteBtn = page.locator('[data-testid="audio-master-mute-btn"]')
  await muteBtn.click()
  const isMuted = await page.evaluate(() => window.__omniframe_store.getState().masterMuted)
  assert(isMuted === true, 'Master mute toggled to true')
  await muteBtn.click()
  const isUnmuted = await page.evaluate(() => window.__omniframe_store.getState().masterMuted)
  assert(isUnmuted === false, 'Master mute toggled back to false')

  // 2. Test Add Marker button and Marker Modal
  const addMarkerBtn = page.locator('[data-testid="add-marker-btn"]')
  await addMarkerBtn.waitFor({ state: 'visible' })
  assert(await addMarkerBtn.isVisible(), 'Add Marker button visible in timeline toolbar')

  // Seek playhead to 2.5s
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2.5))
  await addMarkerBtn.click()

  const markerModal = page.locator('[data-testid="marker-modal"]')
  await markerModal.waitFor({ state: 'visible', timeout: 5000 })
  assert(await markerModal.isVisible(), 'Marker Modal opened upon clicking Add Marker')

  // Fill in marker properties
  await page.locator('[data-testid="marker-name-input"]').fill('Chorus Drop')
  await page.locator('[data-testid="marker-duration-input"]').fill('1.5')
  await page.locator('[data-testid="marker-color-green"]').click()
  await page.locator('[data-testid="marker-notes-textarea"]').fill('Cue visual distortion and transition')

  await page.screenshot({ path: join(SHOTS, 'marker-dialog-active.png') })

  // Save Marker
  await page.locator('[data-testid="save-marker-btn"]').click()
  await markerModal.waitFor({ state: 'hidden' })
  assert((await markerModal.count()) === 0, 'Marker Modal closed on save')

  // 3. Verify Marker rendered on Timeline Ruler
  const markersOnRuler = page.locator('[data-testid="timeline-marker"]')
  await markersOnRuler.first().waitFor({ state: 'visible' })
  assert((await markersOnRuler.count()) === 1, 'Marker pin rendered on timeline ruler')

  const markerColor = await markersOnRuler.first().getAttribute('data-marker-color')
  assert(markerColor === 'green', 'Marker rendered with green color flag')

  const markerTime = await markersOnRuler.first().getAttribute('data-marker-time')
  assert(Math.abs(parseFloat(markerTime) - 2.5) < 0.05, 'Marker positioned at exact playhead time')

  // 4. Test Single Click seek
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
  await markersOnRuler.first().click({ force: true })
  await page.waitForTimeout(200)
  const currentPlayhead = await page.evaluate(() => window.__omniframe_store.getState().playhead)
  assert(Math.abs(currentPlayhead - 2.5) < 0.05, 'Clicking marker seeks playhead to marker time')

  // 5. Test Keyboard Shortcut M
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(5.0))
  await page.keyboard.press('m')
  await markerModal.waitFor({ state: 'visible', timeout: 5000 })
  assert(await markerModal.isVisible(), 'Pressing M shortcut opened Marker Modal at 5.0s')

  await page.locator('[data-testid="marker-name-input"]').fill('Outro Fade')
  await page.locator('[data-testid="marker-color-purple"]').click()
  await page.locator('[data-testid="save-marker-btn"]').click()
  await markerModal.waitFor({ state: 'hidden' })

  assert((await page.locator('[data-testid="timeline-marker"]').count()) === 2, 'Two markers rendered on ruler')

  // 6. Test Double Click edit & Delete Marker
  await page.locator('[data-testid="timeline-marker"]').first().dblclick({ force: true })
  await markerModal.waitFor({ state: 'visible' })
  assert(await markerModal.isVisible(), 'Double clicking marker opens edit modal')

  await page.locator('[data-testid="delete-marker-btn"]').click()
  await markerModal.waitFor({ state: 'hidden' })
  assert((await page.locator('[data-testid="timeline-marker"]').count()) === 1, 'Marker deleted successfully')

  await page.screenshot({ path: join(SHOTS, 'timeline-markers-and-vu-meter.png') })

  // Verify zero errors
  assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))

  writeFileSync(
    join(REPORTS, 'marker-audiometer-results.json'),
    JSON.stringify({ results, errors }, null, 2),
  )
  console.log(`RESULT ${results.length} PASS`)
} finally {
  await browser.close()
}
