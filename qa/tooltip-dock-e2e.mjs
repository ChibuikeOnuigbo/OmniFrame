// Verifies the two new interactive surfaces: draggable tooltips and slide docks.
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { seedProject } from './seed-project.mjs'

const BASE = process.env.TEST_URL || 'http://localhost:5173'
try {
  await inflate(path.join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) {}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))

const results = []
const ok = (n, c, d = '') => { results.push([n, !!c]); console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }

await page.goto(`${BASE}/#studio`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await seedProject(page)
await page.waitForTimeout(1000)

// ---------- slide docks ----------
for (const [id, label] of [['preview-view-controls', 'preview view controls']]) {
  const toggle = page.locator(`[data-testid="slide-dock-${id}-toggle"]`)
  ok(`${label}: handle present`, await toggle.count() === 1)
  if (await toggle.count() === 1) {
    ok(`${label}: starts expanded`, await toggle.getAttribute('aria-expanded') === 'true')
    const before = await page.locator(`[data-testid="slide-dock-${id}"]`).boundingBox()
    await toggle.click()
    await page.waitForTimeout(350)
    const after = await page.locator(`[data-testid="slide-dock-${id}"]`).boundingBox()
    ok(`${label}: collapses to less width`, after.width < before.width - 20,
       `${Math.round(before.width)} -> ${Math.round(after.width)}px`)
    ok(`${label}: aria-expanded flips`, await toggle.getAttribute('aria-expanded') === 'false')
    ok(`${label}: content hidden from a11y tree`,
       await page.locator(`[data-testid="slide-dock-${id}"] [aria-hidden="true"]`).count() >= 1)
    await toggle.click()
    await page.waitForTimeout(350)
    ok(`${label}: re-expands`, await toggle.getAttribute('aria-expanded') === 'true')
  }
}

// the 3D toggle must still be reachable and clickable after collapsing/expanding
const td = page.locator('[data-testid="toggle-3d-btn"]')
ok('3D toggle still clickable', await td.isVisible())

// ---------- tooltips ----------
const tip = page.locator('[data-testid="of-tooltip"]')
ok('no tooltip before hover', await tip.count() === 0)

await td.hover()
await page.waitForTimeout(600)
ok('tooltip appears on hover', await tip.count() === 1)

if (await tip.count() === 1) {
  const box = await tip.boundingBox()
  // "too big" was the complaint: keep the tooltip compact.
  ok('tooltip is compact (<=260x70)', box.width <= 260 && box.height <= 70,
     `${Math.round(box.width)}x${Math.round(box.height)}`)

  // It must not sit on top of the control cluster it describes.
  const cluster = await page.locator('[data-testid="slide-dock-preview-view-controls"]').boundingBox()
  const overlaps = !(box.x + box.width < cluster.x || box.x > cluster.x + cluster.width ||
                     box.y + box.height < cluster.y || box.y > cluster.y + cluster.height)
  ok('tooltip does not cover the control cluster', !overlaps)

  ok('tooltip stays inside the viewport',
     box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 900,
     `x=${Math.round(box.x)} y=${Math.round(box.y)}`)

  // drag it
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 180, box.y + 120, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const moved = await tip.boundingBox()
  ok('tooltip is draggable', Math.abs(moved.x - box.x) > 100 || Math.abs(moved.y - box.y) > 60,
     `moved (${Math.round(moved.x - box.x)}, ${Math.round(moved.y - box.y)})`)

  // position is remembered for next time
  await page.mouse.move(700, 500)
  await page.waitForTimeout(300)
  ok('tooltip dismissed on mouse-out', await tip.count() === 0)
  await td.hover()
  await page.waitForTimeout(600)
  const again = await tip.boundingBox()
  if (again) {
    ok('remembered position is reused', Math.abs(again.x - moved.x) < 6 && Math.abs(again.y - moved.y) < 6,
       `${Math.round(again.x)},${Math.round(again.y)} vs ${Math.round(moved.x)},${Math.round(moved.y)}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    ok('Escape closes the tooltip', await tip.count() === 0)
  }
}

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' / '))

await browser.close()
const failed = results.filter((r) => !r[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
