/**
 * PANELS + CURSOR DECLUTTER E2E
 * =============================
 *
 * Verifies the "too much UI / cursor too big" fixes:
 *
 *  1. Cursor defaults are now Pro Precision pack at Standard (native-ish)
 *     size — no gamified energy dot on the arrow — and the follower still
 *     tracks the pointer.
 *  2. Settings: Compact size and pack switching apply live (scale changes,
 *     gamified dot returns only for gamified packs).
 *  3. Right panel (inspector):
 *     - width is SLIDEABLE via the edge handle (docked mode),
 *     - the panel is MOVABLE: float window with header drag + corner resize,
 *     - docking returns it to the layout with the chosen width intact.
 *  4. Left dock (media panel) width is slideable via its edge handle.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const EVIDENCE = join(ROOT, 'evidence/screenshots')
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(EVIDENCE, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

/* ---- 1. Cursor defaults ---- */
console.log('--- Step 1: Cursor defaults (Pro Precision / Standard) ---')
await page.mouse.move(700, 400)
await page.waitForTimeout(400)
const cursorContainer = page.getByTestId('custom-cursor-container')
await cursorContainer.waitFor({ state: 'visible', timeout: 5000 })
const cursorSize = await cursorContainer.getAttribute('data-cursor-size')
const cursorPack = await cursorContainer.getAttribute('data-cursor-pack')
const glyph = page.getByTestId('custom-cursor-glyph')
const glyphTransform = await glyph.evaluate((el) => el.style.transform)
const arrowCircleCount = await glyph.locator('svg', { has: page.locator('path') }).first()
  .evaluate((el) => el.querySelectorAll('circle').length)
  .catch(() => 0)
assert('Default cursor size is Standard (0.85x)', cursorSize === 'standard', cursorSize || '')
assert('Default cursor pack is Pro Precision', cursorPack === 'pro-precision', cursorPack || '')
assert('Standard scale = 0.85', glyphTransform.includes('scale(0.85)'), glyphTransform)
assert('Pro Precision arrow has no gamified energy dot', arrowCircleCount === 0, `${arrowCircleCount} circles`)

/* ---- 2. Settings: size + pack switching ---- */
console.log('--- Step 2: Cursor settings apply live ---')
await page.getByTestId('settings-button').click()
await page.getByTestId('settings-popup').waitFor({ state: 'visible' })
await page.locator('[data-testid="settings-category"][data-category="cursor"], [data-testid="settings-category"]').filter({ hasText: 'Cursor' }).first().click()
await page.waitForTimeout(200)
await page.getByTestId('cursor-size-compact').click()
await page.waitForTimeout(300)
assert(
  'Compact size applies live',
  (await cursorContainer.getAttribute('data-cursor-size')) === 'compact',
  await cursorContainer.getAttribute('data-cursor-size'),
)
assert(
  'Compact scale = 0.7',
  (await glyph.evaluate((el) => el.style.transform)).includes('scale(0.7)'),
)
await page.getByTestId('cursor-pack-mac-gamified').click()
await page.waitForTimeout(300)
assert(
  'Pack switch applies live',
  (await cursorContainer.getAttribute('data-cursor-pack')) === 'mac-gamified',
)
const gamifiedCircleCount = await glyph.locator('circle').count()
assert('Gamified pack restores the energy dot', gamifiedCircleCount >= 1, `${gamifiedCircleCount} circles`)
await page.getByTestId('cursor-pack-pro-precision').click()
await page.getByTestId('cursor-size-standard').click()
await page.waitForTimeout(300)
assert(
  'Restored Pro Precision / Standard defaults',
  (await cursorContainer.getAttribute('data-cursor-pack')) === 'pro-precision' &&
    (await cursorContainer.getAttribute('data-cursor-size')) === 'standard',
)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

/* ---- 3. Right panel: slideable width ---- */
console.log('--- Step 3: Inspector width is slideable ---')
let store = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { rightPanelWidth: s.rightPanelWidth, rightOpen: s.rightOpen, rightPanelFloating: s.rightPanelFloating }
})
assert('Inspector starts docked & open', store.rightOpen === true && store.rightPanelFloating === false)

const resizeHandle = page.getByTestId('right-panel-resize-handle')
await resizeHandle.waitFor({ state: 'visible' })
const handleBox = await resizeHandle.boundingBox()
const startX = handleBox.x + handleBox.width / 2
const startY = handleBox.y + handleBox.height / 2
await page.mouse.move(startX, startY)
await page.mouse.down()
// Dragging the left edge leftward widens the panel.
for (let i = 1; i <= 8; i++) await page.mouse.move(startX - i * 10, startY, { steps: 2 })
await page.mouse.up()
await page.waitForTimeout(300)
store = await page.evaluate(() => window.__omniframe_store.getState().rightPanelWidth)
assert('Edge drag widens inspector (280 → ~360)', store >= 350 && store <= 370, `width ${store}px`)

/* ---- 4. Right panel: float, move, resize, dock ---- */
console.log('--- Step 4: Inspector floats, moves, resizes, docks ---')
await page.getByTestId('inspector-float-btn').first().click()
const floatWindow = page.getByTestId('right-panel-float-window')
await floatWindow.waitFor({ state: 'visible' })
let floatState = await page.evaluate(() => window.__omniframe_store.getState().rightPanelFloat)
assert('Float window opens', await floatWindow.isVisible())

const header = page.getByTestId('right-panel-float-header')
const headerBox = await header.boundingBox()
await page.mouse.move(headerBox.x + 60, headerBox.y + 16)
await page.mouse.down()
for (let i = 1; i <= 10; i++) await page.mouse.move(headerBox.x + 60 - i * 12, headerBox.y + 16 + i * 9, { steps: 2 })
await page.mouse.up()
await page.waitForTimeout(300)
const movedState = await page.evaluate(() => window.__omniframe_store.getState().rightPanelFloat)
assert(
  'Header drag moves the float window',
  movedState.x < floatState.x - 100 && movedState.y > floatState.y + 70,
  `x ${floatState.x}→${movedState.x}, y ${floatState.y}→${movedState.y}`,
)

const grip = page.getByTestId('right-panel-float-resize')
const gripBox = await grip.boundingBox()
await page.mouse.move(gripBox.x + 6, gripBox.y + 6)
await page.mouse.down()
for (let i = 1; i <= 7; i++) await page.mouse.move(gripBox.x + 6 + i * 10, gripBox.y + 6 + i * 7, { steps: 2 })
await page.mouse.up()
await page.waitForTimeout(300)
const resizedState = await page.evaluate(() => window.__omniframe_store.getState().rightPanelFloat)
assert(
  'Corner grip resizes the float window',
  resizedState.w > movedState.w + 50 && resizedState.h > movedState.h + 35,
  `w ${movedState.w}→${resizedState.w}, h ${movedState.h}→${resizedState.h}`,
)
await page.screenshot({ path: join(EVIDENCE, 'panels-floating-inspector.png') })

await page.getByTestId('inspector-dock-btn').click()
await page.waitForTimeout(400)
assert(
  'Dock button returns the inspector to the layout',
  !(await floatWindow.isVisible().catch(() => false)),
)
const dockedWidth = await page.evaluate(() => window.__omniframe_store.getState().rightPanelWidth)
assert('Docked inspector keeps the dragged width', dockedWidth >= 350, `${dockedWidth}px`)

/* ---- 5. Left dock width slideable ---- */
console.log('--- Step 5: Left dock width is slideable ---')
const leftHandle = page.getByTestId('left-panel-resize-handle')
await leftHandle.waitFor({ state: 'visible' })
const lhBox = await leftHandle.boundingBox()
const lwStart = await page.evaluate(() => window.__omniframe_store.getState().leftDockWidth)
await page.mouse.move(lhBox.x + lhBox.width / 2, lhBox.y + lhBox.height / 2)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(lhBox.x + lhBox.width / 2 + i * 10, lhBox.y + lhBox.height / 2, { steps: 2 })
await page.mouse.up()
await page.waitForTimeout(300)
const lwEnd = await page.evaluate(() => window.__omniframe_store.getState().leftDockWidth)
assert('Left dock edge drag widens panel', lwEnd >= lwStart + 55 && lwEnd <= lwStart + 90, `${lwStart}→${lwEnd}px`)
await page.screenshot({ path: join(EVIDENCE, 'panels-resized-docks.png') })

assert('Zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()

writeFileSync(
  join(REPORTS, 'panels-cursor-declutter.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      results,
      pageErrors,
    },
    null,
    2,
  ),
)
const passCount = results.filter((r) => r.status === 'PASS').length
console.log(`\nRESULT ${passCount}/${results.length} PASS — report: qa/reports/panels-cursor-declutter.json`)
