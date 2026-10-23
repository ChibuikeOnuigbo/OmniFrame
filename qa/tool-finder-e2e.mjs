/**
 * Search/discoverability regression test for the left-rail tool finder.
 *
 * Run with a Vite server at localhost:5173:
 *   URL=http://localhost:5173/#studio node qa/tool-finder-e2e.mjs
 */
import assert from 'node:assert/strict'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}

const browser = await playwrightChromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.setDefaultTimeout(15000)
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  const trigger = page.getByTestId('tool-finder-open')
  await trigger.waitFor({ state: 'visible' })
  await trigger.click()
  const dialog = page.getByTestId('tool-finder-dialog')
  const search = page.getByTestId('tool-finder-search')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'tool finder is announced as a modal dialog')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'tool-finder-search', 'search receives focus on open')

  await search.fill('voice isolation')
  const audioResult = page.getByTestId('tool-finder-result-audio')
  await audioResult.waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid^="tool-finder-result-"]').count(), 1, 'feature search resolves to one panel')
  await audioResult.click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByTestId('left-tab-audio').getAttribute('aria-pressed'), 'true', 'choosing a result opens and selects its panel')
  await page.getByTestId('voice-isolation-panel').waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'tool-finder-open', 'focus returns to the search trigger')

  await trigger.click()
  await search.fill('.cube')
  await page.getByTestId('tool-finder-result-effects').waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid^="tool-finder-result-"]').count(), 1, 'LUT file-extension search finds color adjustments')
  await search.fill('Smart Patch')
  const drawingResult = page.getByTestId('tool-finder-result-drawing')
  await drawingResult.waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid^="tool-finder-result-"]').count(), 1, 'Smart Patch donor/target workflow is discoverable from the finder')
  await drawingResult.click()
  // The finder opens the Drawing panel; the Smart Patch toolbox tile then
  // brings its options docker forward (Krita-style tool -> options follow).
  await page.getByTestId('panel-tool-smart-patch').click()
  await page.getByTestId('smart-patch-subtool').waitFor({ state: 'visible' })
  await trigger.click()
  await search.fill('temporal')
  await page.getByTestId('tool-finder-result-omniframe').waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid^="tool-finder-result-"]').count(), 1, 'temporal Analyze & Inpaint is searchable')
  await search.fill('Procreate')
  const mediaResult = page.getByTestId('tool-finder-result-media')
  await mediaResult.waitFor({ state: 'visible' })
  assert.match(await mediaResult.innerText(), /no Procreate/i, 'unsupported Procreate files are not advertised as supported')
  await search.fill('no matching tool')
  await page.getByTestId('tool-finder-empty').waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })

  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  await dialog.waitFor({ state: 'visible' })
  const dialogBounds = await dialog.boundingBox()
  assert.ok(dialogBounds && dialogBounds.x >= 0 && dialogBounds.width <= 390, `tool finder fits a 390px screen: ${JSON.stringify(dialogBounds)}`)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [], `no browser errors: ${errors.join(' | ')}`)

  console.log('Tool finder: feature search, panel navigation, unsupported-format messaging, keyboard dismissal, focus return, and mobile fit passed.')
} finally {
  await browser.close()
}
