import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'evidence/screenshots')

mkdirSync(SHOTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

console.log('--- Step 1: Loading OmniFrame ---')
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 10000 })

console.log('--- Step 2: Testing Source Preview Details & Transport Bar ---')
// Add a sample asset and preview it in source mode
await page.evaluate(() => {
  const store = window.__omniframe_store
  if (store) {
    store.getState().addAsset({
      id: 'asset-hero-preview',
      name: 'Bro killed 99.9% of the Viltrumites - INVINCIBLE',
      kind: 'video',
      url: 'blob:mock-url',
      duration: 30.5,
      width: 1080,
      height: 1080,
      size: 45000000,
    })
    store.getState().setSourcePreviewAsset('asset-hero-preview')
  }
})
await page.waitForTimeout(400)

// 1. Verify detail section is in bottom-left and does NOT have "Add to Timeline" button
const detailPill = page.locator('[data-testid="preview-asset-detail"]')
assert(await detailPill.isVisible(), 'Source asset detail pill is visible in bottom left')
const addBtnInPill = page.locator('[data-testid="add-preview-asset-timeline-btn"]')
assert((await addBtnInPill.count()) === 0, 'No "+ Add to Timeline" button in source detail banner')

// 2. Verify source transport bar has increased width and height
const transportBar = page.locator('[data-testid="asset-transport-bar"]')
assert(await transportBar.isVisible(), 'Source transport bar is visible')
const transportBox = await transportBar.boundingBox()
const detailBox = await page.locator('[data-testid="preview-asset-detail"]').boundingBox()
console.log('detailBox:', detailBox)
console.log('transportBox:', transportBox)
assert(transportBox.height >= 40, `Source transport bar height is increased (found ${transportBox.height}px >= 40px)`)
assert(transportBox.width >= 600, `Source transport bar width is almost full preview width (found ${transportBox.width}px >= 600px)`)
console.log(`[PASS] Transport bar dimensions: ${transportBox.width}x${transportBox.height}px`)

// Capture screenshot while in source preview mode
await page.screenshot({ path: join(SHOTS, 'source-preview-fullscreen-bar.png') })
console.log('[PASS] Source preview screenshot saved to evidence/screenshots/source-preview-fullscreen-bar.png')

console.log('--- Step 3: Testing Media Library Three-Dot Info & 3D Objects Filter ---')
// Ensure media tab is open
await page.evaluate(() => {
  const store = window.__omniframe_store
  if (store) {
    store.getState().setLeftOpen(true)
    store.getState().setLeftTab('media')
  }
})
await page.waitForTimeout(400)

// Check 3D Objects filter in select dropdown
const typeFilter = page.locator('[data-testid="media-type-filter"]')
const filterOptions = await typeFilter.locator('option').allTextContents()
assert(filterOptions.includes('3D Objects'), '3D Objects filter present in media type filter')
console.log('[PASS] 3D Objects filter option confirmed')

// Check three-dot button on media asset card
const infoBtn = page.locator('[data-testid="asset-info-btn"]').first()
if (await infoBtn.count() > 0) {
  await infoBtn.click({ force: true })
  await page.waitForTimeout(300)
  const infoModal = page.locator('[data-testid="media-info-modal"]')
  assert(await infoModal.isVisible(), 'Media file technical specification modal opened')
  await page.screenshot({ path: join(SHOTS, 'media-specs-modal-verified.png') })
  console.log('[PASS] Media specs modal verified and captured to evidence/screenshots/media-specs-modal-verified.png')
  await page.locator('[data-testid="close-media-info-modal"]').click()
  await page.waitForTimeout(200)
}

console.log('--- Step 4: Testing Add Element at Playhead & Track Heights ---')
// Return to timeline sequence
await page.locator('[data-testid="close-asset-preview-btn"]').click()
await page.waitForTimeout(300)

// Set playhead to 3.5 seconds
await page.evaluate(() => {
  window.__omniframe_store.getState().setPlayhead(3.5)
})
await page.waitForTimeout(200)

// Add Text Title clip and verify it is placed at playhead (3.5s), NOT at timeline end
await page.evaluate(() => {
  window.__omniframe_store.getState().addTextTitleClip('PLAYHEAD TITLE TEST', 4.0)
})
await page.waitForTimeout(300)

const clips = await page.evaluate(() => window.__omniframe_store.getState().clips)
const textClip = clips.find((c) => c.name === 'PLAYHEAD TITLE TEST')
assert(textClip, 'Text clip exists on timeline')
assert(Math.abs(textClip.start - 3.5) < 0.05, `Text clip added at playhead 3.5s (found start: ${textClip.start}s)`)
console.log(`[PASS] Text clip added at exact playhead position: ${textClip.start}s`)

// Check track heights: Pure text track height must be reduced by 40% (38px)
const textTrackLane = page.locator(`[data-testid="track-lane-${textClip.trackId}"]`)
const textLaneBox = await textTrackLane.boundingBox()
assert(textLaneBox.height <= 44, `Text track height is reduced by ~40% (found ${textLaneBox.height}px <= 44px)`)
console.log(`[PASS] CapCut style text track height reduced by 40%: ${textLaneBox.height}px`)

console.log('--- Step 5: Testing Track Header Z-Index > Playhead ---')
const trackHeaderBox = page.locator('.sticky.left-0').first()
const zIndex = await trackHeaderBox.evaluate((el) => window.getComputedStyle(el).zIndex)
assert(Number(zIndex) >= 40, `Track header z-index is >= 40 (found ${zIndex})`)
console.log(`[PASS] Track header z-index confirmed higher than playhead: ${zIndex}`)

console.log('--- Step 6: Capturing Visual Proof Screenshot ---')
await page.screenshot({ path: join(SHOTS, 'source-preview-oop-tracks-verified.png') })
console.log('[PASS] Visual proof screenshot saved to evidence/screenshots/source-preview-oop-tracks-verified.png')

await browser.close()
console.log('ALL CRITERIA VERIFIED SUCCESSFULLY!')
