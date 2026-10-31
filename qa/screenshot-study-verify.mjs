/**
 * Screenshot-study verification: "For you" is gone, segment labels are
 * single-line, and the three study-derived pack assets render on canvas.
 *   URL=http://localhost:5173/#studio PW_EXE=/tmp/chromium node qa/screenshot-study-verify.mjs
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5173/#studio'
const browser = await chromium.launch({ executablePath: process.env.PW_EXE || '/tmp/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(15000)
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.getByTestId('left-tab-pack').click()
await page.getByTestId('desktop-pack-panel').waitFor({ state: 'visible' })

// 1. No "For you" / taste UI anywhere in the panel.
const panelText = await page.getByTestId('desktop-pack-panel').innerText()
assert.ok(!/for you/i.test(panelText), 'panel must not contain "For you"')
assert.equal(await page.getByTestId('pack-foryou-toggle').count(), 0)

// 2. Segment labels single-line: every section segment's box is one text line tall.
for (const id of ['windows', 'apps', 'scenes', 'cursors', 'overlays']) {
  const seg = page.getByTestId(`pack-section-${id}`)
  if (await seg.count()) {
    const box = await seg.boundingBox()
    assert.ok(box && box.height <= 40, `${id} segment should be single-line (h=${box?.height})`)
  }
}
await page.screenshot({ path: 'ui_downlaod_study/sections/30-pack-panel-no-foryou.png' })

// 3. Study assets exist and render as clips.
for (const [id, query, section] of [['desktop-light-icons', 'Light Icons', 'windows'], ['profile-phone', 'Profile Phone', 'apps'], ['frame-mascot', 'Mascot Frame', 'overlays']]) {
  await page.getByTestId(`pack-section-${section}`).click()
  await page.getByTestId('pack-search').fill(query)
  await page.getByTestId(`pack-asset-${id}`).waitFor({ state: 'visible' })
  await page.getByTestId(`pack-asset-${id}`).click()
  await page.getByTestId('pack-search').fill('')
}
await page.waitForTimeout(600)
const clips = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
assert.ok(clips >= 3, `expected >=3 study clips, got ${clips}`)
await page.screenshot({ path: 'ui_downlaod_study/sections/31-study-pack-canvas.png' })

assert.deepEqual(errs, [], `runtime errors: ${errs.join(' | ')}`)
await browser.close()
console.log('SCREENSHOT-STUDY VERIFY PASS')
