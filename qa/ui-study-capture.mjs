/**
 * Captures panel screenshots for ui_downlaod_study/ (before/after the
 * sub-mode refactor). Usage: node qa/ui-study-capture.mjs <prefix>
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const prefix = process.argv[2] || 'before'
const OUT = join(process.cwd(), 'ui_downlaod_study')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)

await page.locator('[data-testid="left-tab-text"]').click()
await page.waitForTimeout(700)
const panel = page.locator('[data-testid="left-panel"], [data-testid="text-panel"]').first()
await page.locator('[data-testid="text-panel"]').screenshot({ path: join(OUT, `${prefix}-text-panel.png`) })
const metrics = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="text-panel"]')
  return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, sections: el.children.length }
})
console.log(prefix, 'text panel metrics', JSON.stringify(metrics))

if (prefix === 'after') {
  for (const [tid, name] of [['text-submode-library-btn', 'library'], ['text-submode-retro-btn', 'retro'], ['text-submode-watermark-btn', 'watermark']]) {
    await page.locator(`[data-testid="${tid}"]`).click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="text-panel"]').screenshot({ path: join(OUT, `after-text-${name}.png`) })
    await page.locator('[data-testid="submode-back-btn"]').click()
    await page.waitForTimeout(400)
  }
}
await page.screenshot({ path: join(OUT, `${prefix}-studio.png`) })
await browser.close()
console.log('UI STUDY CAPTURE DONE', prefix)
