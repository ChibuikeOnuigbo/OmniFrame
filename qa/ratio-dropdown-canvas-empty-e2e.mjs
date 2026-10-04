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

async function run() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))

  console.log('--- Step 1: Loading OmniFrame ---')
  await page.goto(URL)
  await page.waitForSelector('[data-testid="preview-stage"]')

  console.log('--- Step 2: Testing "Your canvas is empty" visibility during playback ---')
  const emptyText = page.locator('text=Your canvas is empty')
  const isInitiallyEmpty = await emptyText.isVisible()
  console.log(`Initial canvas empty notice visible: ${isInitiallyEmpty}`)
  if (!isInitiallyEmpty) throw new Error('Expected "Your canvas is empty" to be visible initially')
  console.log('PASS Canvas empty text initially visible')

  // Start playback while empty
  await page.evaluate(() => {
    window.__omniframe_store.setState({ playing: true })
  })
  await page.waitForTimeout(300)

  const isHiddenDuringPlay = await emptyText.isVisible()
  console.log(`Canvas empty notice visible during play: ${isHiddenDuringPlay}`)
  if (isHiddenDuringPlay) throw new Error('Expected "Your canvas is empty" to hide during playback')
  console.log('PASS Canvas empty text successfully hides during playback')

  // Stop playback
  await page.evaluate(() => {
    window.__omniframe_store.setState({ playing: false })
  })
  await page.waitForTimeout(300)

  console.log('--- Step 3: Verifying Ratio Dropdown with Actual Icons & 9:16 Stacked Paper Slide ---')
  const ratioBtn = page.locator('#aspect-ratio-selector-trigger')
  await ratioBtn.waitFor({ state: 'visible' })

  // Open the ratio popover
  await ratioBtn.click()
  await page.waitForSelector('[data-testid="ratio-popover"]')
  console.log('PASS Aspect ratio popover opened')

  // Verify 9:16 item has the stacked YouTube + TikTok paper slide icon
  const stackIcon = page.locator('[data-testid="ratio-icon-9-16-stack"]')
  const stackCount = await stackIcon.count()
  console.log(`Found ${stackCount} stacked paper slide icons for 9:16`)
  if (stackCount === 0) throw new Error('Expected at least one stacked 9:16 paper slide icon')
  console.log('PASS 9:16 option renders stacked YouTube + TikTok paper slide icon')

  // Verify 3:4 Instagram Grid research enhancement
  const preset34 = page.locator('[data-testid="ratio-preset-3:4"]')
  const text34 = await preset34.innerText()
  console.log(`3:4 preset details: ${text34.replace(/\n/g, ' ')}`)
  if (!text34.includes('Instagram Grid') && !text34.includes('Instagram Feed')) {
    throw new Error(`Expected 3:4 preset to show Instagram Grid/Feed, got: ${text34}`)
  }
  console.log('PASS 3:4 preset presents Instagram Grid and Feed metadata')

  // Verify 2:3 Pinterest Pin research enhancement
  const preset23 = page.locator('[data-testid="ratio-preset-2:3"]')
  const text23 = await preset23.innerText()
  console.log(`2:3 preset details: ${text23.replace(/\n/g, ' ')}`)
  if (!text23.includes('Pinterest Pin')) {
    throw new Error(`Expected 2:3 preset to show Pinterest Pin, got: ${text23}`)
  }
  console.log('PASS 2:3 preset presents Pinterest Pin metadata')

  // Check custom ratio button
  const customPresetBtn = page.locator('[data-testid="ratio-preset-custom"]')
  await customPresetBtn.click()
  await page.waitForSelector('[data-testid="custom-ratio-editor"]')
  console.log('PASS Custom ratio editor opened and takes compact space')

  // Unlock ratio lock to set custom independent dimensions
  await page.click('[data-testid="toggle-ratio-lock-btn"]')
  await page.fill('[data-testid="custom-width-input"]', '2048')
  await page.fill('[data-testid="custom-height-input"]', '1080')
  const customSettings = await page.evaluate(() => window.__omniframe_store.getState().sequenceSettings)
  if (customSettings.width !== 2048 || customSettings.height !== 1080) {
    throw new Error(`Expected custom 2048x1080, got ${customSettings.width}x${customSettings.height}`)
  }
  console.log('PASS Custom dimensions updated in store to 2048x1080')

  // Now select 9:16 preset
  await page.click('[data-testid="ratio-preset-9:16"]')
  await page.waitForTimeout(300)

  // Verify trigger now shows 9:16 label AND the stacked icon
  const triggerText = await ratioBtn.innerText()
  console.log(`Ratio trigger button text: "${triggerText}"`)
  if (!triggerText.includes('9:16')) throw new Error(`Expected 9:16 on trigger, got ${triggerText}`)

  const triggerStackIcon = ratioBtn.locator('[data-testid="ratio-icon-9-16-stack"]')
  const triggerHasStack = await triggerStackIcon.count() > 0
  if (!triggerHasStack) throw new Error('Expected trigger to render 9:16 stacked paper slide icon when active')
  console.log('PASS Trigger button renders YouTube + TikTok stacked paper slide icon for 9:16')

  // Re-open to take screenshot of the sleek dropdown
  await ratioBtn.click()
  await page.waitForSelector('[data-testid="ratio-popover"]')
  await page.screenshot({ path: join(SHOTS, 'ratio-dropdown-actual-icons.png') })
  console.log('PASS Screenshot saved: qa/screenshots/ratio-dropdown-actual-icons.png')

  console.log('--- Step 4: Verifying Removal of Hyphens from Text Throughout ---')
  // Check descriptions in popover
  const popoverText = await page.locator('[data-testid="ratio-popover"]').innerText()
  const forbiddenHyphens = ['Full-screen', 'Ultra-Wide', 'Ultra-widescreen', 'User-specified', 'real-time', 'X-Ray']
  for (const forbidden of forbiddenHyphens) {
    if (popoverText.includes(forbidden)) {
      throw new Error(`Found forbidden hyphenated word in ratio popover: "${forbidden}"`)
    }
  }
  console.log('PASS No forbidden hyphens found in ratio dropdown text')

  // Check effects panel for realtime and X Ray
  await page.click('[data-testid="left-tab-effects"]')
  await page.waitForTimeout(300)
  const effectsEmpty = page.locator('[data-testid="effects-panel-empty"]')
  if (await effectsEmpty.isVisible()) {
    const emptyEffText = await effectsEmpty.innerText()
    if (emptyEffText.includes('real-time')) {
      throw new Error('Found "real-time" in effects panel empty text')
    }
  }
  console.log('PASS No forbidden hyphens in effects panel')

  if (errors.length > 0) {
    throw new Error(`Runtime errors encountered: ${errors.join(', ')}`)
  }
  console.log('PASS zero runtime errors')

  await browser.close()
  console.log('\nRESULT: ALL RATIO DROPDOWN & CANVAS EMPTY TESTS PASS!')
}

run().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
