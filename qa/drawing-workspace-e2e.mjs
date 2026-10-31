/**
 * Krita-style drawing workspace E2E (qa/drawing-workspace-e2e.mjs)
 *
 * The user's Krita reference (their own customized layout): a permanent icon
 * toolbox, tabbed dockers whose options follow the active tool, and panels
 * that appear with context instead of "packing modes" that hide everything.
 * This suite proves OmniFrame now behaves that way:
 *  1. The drawing workspace shelves the Audio rail tab out of the way.
 *  2. The toolbox is an always-visible icon grid (no accordion, no tab).
 *  3. Picking a tool activates its options docker on its own.
 *  4. Turning drawing on from anywhere brings the Drawing panel forward.
 *  5. No visible section header is squished (nothing truncates).
 */
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs'

const BASE = process.env.URL || 'http://localhost:5173/#studio'
const SHOT = 'evidence/screenshots/omniframe-drawing-workspace.png'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}

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
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]', { timeout: 30000 })
  await page.waitForFunction(() => Boolean(window.__omniframe_store), null, { timeout: 30000 })
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    localStorage.setItem('omniframeCharacters', '[]')
    s.setWorkspacePreset('drawing')
  })
  await page.waitForSelector('[data-testid="left-tab-drawing"]', { timeout: 15000 })

  // 1) Drawing workspace shelves the audio tab (category scope follows context)
  await page.waitForTimeout(600)
  check('drawing workspace hides the Audio rail tab', (await page.locator('[data-testid="left-tab-audio"]').count()) === 0)
  check('drawing workspace keeps the Drawing rail tab', (await page.locator('[data-testid="left-tab-drawing"]').count()) === 1)

  // 2) Toolbox: always visible icon grid, outside any section/tab
  const toolbox = page.locator('[data-testid="drawing-toolbox"]')
  await toolbox.waitFor({ state: 'visible', timeout: 15000 })
  const brushBtn = page.locator('[data-testid="panel-tool-brush"]')
  await brushBtn.waitFor({ state: 'visible', timeout: 10000 })
  check('toolbox icon grid is visible without opening any section', await brushBtn.isVisible())
  check('toolbox is not inside an accordion section', (await page.locator('[data-testid^="panel-section-"] [data-testid="drawing-toolbox"]').count()) === 0)

  // 3) Tool pick activates its options docker (Krita Tool Options follow)
  await page.locator('[data-testid="panel-tool-smart-patch"]').click()
  await page.waitForSelector('[data-testid="smart-patch-subtool"]', { timeout: 10000 })
  check('picking Smart Patch opens the Smart Patch docker', true)
  const tool = await page.evaluate(() => window.__omniframe_store.getState().drawingTool)
  check('smart-patch tool is active in the store', tool === 'smart-patch', tool)
  await page.locator('[data-testid="panel-tool-line"]').click()
  await page.waitForSelector('[data-testid="panel-section-tool-params"]', { timeout: 10000 })
  const paramsVisible = await page.evaluate(() => {
    const chip = document.querySelector('[data-testid="section-tab-tool-params"]')
    return chip?.getAttribute('aria-selected') === 'true'
  })
  check('picking the Line tool activates Tool Parameters', paramsVisible)
  await page.locator('[data-testid="panel-tool-brush"]').click()

  // 4) Context-follow: enable drawing from the Media tab -> panel follows
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.setLeftTab('media')
    s.setDrawingEnabled(false)
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__omniframe_store.getState().setDrawingEnabled(true))
  await page.waitForSelector('[data-testid="drawing-toolbox"]', { timeout: 10000 })
  check('enabling drawing auto-opens the Drawing panel', true)

  // 5) No squished headers: every visible section header fits its box
  //    (wrapping is allowed; horizontal truncation is not).
  const squished = await page.evaluate(() => {
    const bad = []
    document.querySelectorAll('[data-testid^="panel-section-"] > button, [data-testid^="section-tab-"]').forEach((el) => {
      if (el.getClientRects().length === 0) return
      el.querySelectorAll('span').forEach((span) => {
        if (span.scrollWidth > span.clientWidth + 2 && getComputedStyle(span).whiteSpace !== 'normal') {
          bad.push(`${el.getAttribute('data-testid')}: "${span.textContent?.trim()}" ${span.scrollWidth}>${span.clientWidth}`)
        }
      })
    })
    return bad
  })
  check('no section header is squished/truncated', squished.length === 0, squished.slice(0, 3).join(' | '))

  await page.screenshot({ path: SHOT })
  console.log(`screenshot: ${SHOT}`)

  fs.mkdirSync('evidence', { recursive: true })
  fs.writeFileSync(
    'evidence/drawing-workspace-summary.json',
    JSON.stringify({ failures, pageErrors: errors.slice(0, 5) }, null, 2),
  )
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
} catch (err) {
  failures++
  console.error('[FAIL] exception:', err)
} finally {
  await browser.close()
}

console.log(failures === 0 ? 'drawing-workspace-e2e: passed' : `drawing-workspace-e2e: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
