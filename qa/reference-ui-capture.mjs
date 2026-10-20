/**
 * Opens the extracted reference web app (ui_downlaod_study/zip-extract,
 * served on :8899) and screenshots its UI for UI-STUDY.md annotation.
 *   LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/reference-ui-capture.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'ui_downlaod_study')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)))
await page.goto('http://localhost:8899/collection.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
console.log('title:', await page.title(), 'url:', page.url())
await page.screenshot({ path: join(OUT, 'reference-1-collection.png') })

// Dump visible text structure for the study (headings, buttons, nav).
const structure = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean)
  return {
    buttons: pick('button').slice(0, 40),
    links: pick('a').slice(0, 30),
    headings: pick('h1,h2,h3').slice(0, 20),
    bodyStart: (document.body.innerText || '').slice(0, 600),
  }
})
console.log(JSON.stringify(structure, null, 1))

// Try the studio route if the SPA exposes one.
for (const route of ['studio', 'dashboard']) {
  try {
    await page.goto(`http://localhost:8899/${route}.html`, { waitUntil: 'domcontentloaded', timeout: 8000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: join(OUT, `reference-${route}.png`) })
    console.log('captured', route, page.url())
  } catch (e) { console.log('route fail', route, String(e).slice(0, 120)) }
}
await browser.close()
console.log('REFERENCE CAPTURE DONE')
