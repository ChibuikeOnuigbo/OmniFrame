/**
 * Screenshots EVERY UI section of the studio into
 * ui_downlaod_study/sections/ for SCREENSHOTS.md: each left-rail tool
 * panel, each Text sub-mode, the cursor forme window, right panel.
 *   LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/ui-sections-capture.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'ui_downlaod_study', 'sections')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 120)))
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)

let n = 0
const shot = async (name) => {
  n++
  const file = `${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: join(OUT, file) })
  console.log('shot', file)
  return file
}
const files = []
files.push(await shot('studio-overview'))

// every left-rail tool panel visible in the current workspace mode
const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="left-tab-"]')].map((e) => e.getAttribute('data-testid').replace('left-tab-', '')).filter((t) => !t.includes('-')))
for (const tab of [...new Set(tabs)]) {
  try {
    await page.locator(`[data-testid="left-tab-${tab}"]`).first().click()
    await page.waitForTimeout(650)
    files.push(await shot(`panel-${tab}`))
  } catch (e) { console.log('skip tab', tab, String(e).slice(0, 80)) }
}

// text sub-modes (the decluttered studios)
await page.locator('[data-testid="left-tab-text"]').click()
await page.waitForTimeout(500)
files.push(await shot('text-overview-tiles'))
for (const [btn, name] of [['text-submode-styling-btn', 'text-mode-styling'], ['text-submode-presets-btn', 'text-mode-title-presets'], ['text-submode-library-btn', 'text-mode-preset-library'], ['text-submode-retro-btn', 'text-mode-retro'], ['text-submode-watermark-btn', 'text-mode-watermark']]) {
  try {
    await page.locator(`[data-testid="${btn}"]`).click()
    await page.waitForTimeout(550)
    files.push(await shot(name))
    if (name === 'text-mode-preset-library') {
      await page.locator('[data-testid="preset-cursor-forme-btn"]').click()
      await page.waitForTimeout(450)
      files.push(await shot('text-cursor-forme-window'))
    }
    await page.locator('[data-testid="submode-back-btn"]').click()
    await page.waitForTimeout(350)
  } catch (e) { console.log('skip mode', name, String(e).slice(0, 80)) }
}

// right inspector panel + timeline context
try {
  await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setLeftTab('media')
  })
  await page.waitForTimeout(500)
  files.push(await shot('inspector-timeline'))
} catch (e) { console.log('skip inspector', String(e).slice(0, 80)) }

console.log('SECTIONS CAPTURED:', files.length)
await browser.close()
