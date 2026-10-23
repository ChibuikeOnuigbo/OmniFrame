/**
 * Desktop Pack regression test.
 *
 * Verifies the screen-life pack tab (5 CapCut-style sections switched from a
 * horizontal segmented strip), its generated window/cursor/overlay assets,
 * edit-preset auditions, quick 3D, and the app-wide "Hide horizontal
 * overflow" advanced-scroll behavior (arrows / wheel / drag, setting off =
 * native scrollbars return).
 *
 * Run with a Vite server at localhost:5173:
 *   URL=http://localhost:5173/#studio node qa/desktop-pack-e2e.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
const ROOT = process.cwd()
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const runtimeErrors = []
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(20000)
page.on('pageerror', (error) => runtimeErrors.push(String(error)))
page.on('console', (message) => message.type() === 'error' && runtimeErrors.push(message.text()))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')

  // Overflow setting defaults ON.
  const overflowMode = await page.evaluate(() => document.querySelector('[data-testid="studio-scene"]')?.getAttribute('data-overflow-x'))
  assert.equal(overflowMode, 'hidden', 'Hide-overflow-x should default to hidden')

  // Open the pack tab; all five sections are on the horizontal strip.
  await page.getByTestId('left-tab-pack').evaluate((el) => el.click())
  await page.getByTestId('desktop-pack-panel').waitFor({ state: 'visible' })
  for (const id of ['windows', 'cursors', 'overlays', 'edits', 'threed']) {
    await page.getByTestId(`pack-section-${id}`).waitFor({ state: 'visible' })
  }

  // Folders file the library: Browsers starts closed (Explorer-style).
  assert.equal(await page.getByTestId('pack-asset-chrome-mac').count(), 0, 'Assets in a closed folder should not render')
  await page.getByTestId('pack-folder-toggle-windows-Browsers').click()

  // Search filters across folders (ChatGPT-style).
  await page.getByTestId('pack-search').fill('terminal')
  await page.getByTestId('pack-asset-terminal').waitFor({ state: 'visible' })
  assert.equal(await page.getByTestId('pack-asset-chrome-mac').count(), 0, 'Search should hide non-matching assets')
  await page.getByTestId('pack-search').fill('')

  // Window assets: add a Chrome (macOS) overlay clip.
  const clipCount = () => page.evaluate(() => window.__omniframe_store.getState().clips.length)
  const before = await clipCount()
  await page.getByTestId('pack-asset-chrome-mac').click()
  const afterChrome = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { clips: s.clips.length, packAssets: s.assets.filter((a) => a.id.startsWith('pack-')).length }
  })
  assert.equal(afterChrome.clips, before + 1, 'Chrome bar should add one overlay clip')
  assert.ok(afterChrome.packAssets >= 1, 'Chrome bar asset should be registered')

  // Fake Desktop composite: wallpaper + browser + cursor (3 more clips).
  await page.getByTestId('pack-desktop-win').click()
  const afterDesktop = await clipCount()
  assert.equal(afterDesktop, before + 4, `Fake Desktop should add 3 clips (got ${afterDesktop - before - 1} extra)`)

  // One-click bundle: Screen-Life Pack stacks 4 layers.
  await page.getByTestId('pack-bundle-screenlife-mac').click()
  assert.equal(await clipCount(), before + 8, 'Screen-Life bundle should stack 4 clips')

  // Cursors: asset + editor cursor pack apply.
  await page.getByTestId('pack-section-cursors').click()
  await page.getByTestId('pack-asset-cursor-mac').click()
  assert.equal(await clipCount(), before + 9, 'Cursor asset should add a clip')
  await page.getByTestId('pack-folder-toggle-cursors-editor').click()
  await page.getByTestId('pack-cursor-theme-cyber-violet').click()
  const pack = await page.evaluate(() => window.__omniframe_store.getState().cursorConfig.pack)
  assert.equal(pack, 'cyber-violet', 'Editor cursor pack should switch')

  // Overlays: letterbox asset.
  await page.getByTestId('pack-section-overlays').click()
  await page.getByTestId('pack-asset-letterbox').click()
  assert.equal(await clipCount(), before + 10, 'Letterbox should add a clip')

  // Edit presets: audition appears in the monitor (temporary), Stop discards.
  await page.getByTestId('pack-section-edits').click()
  await page.getByTestId('pack-edit-tutorial-pop').click()
  await page.getByTestId('visual-preview-actions').waitFor({ state: 'visible' })
  const clipsDuringAudition = await clipCount()
  await page.getByTestId('stop-visual-preview').click()
  assert.equal(await clipCount(), clipsDuringAudition, 'Audition Stop must not commit clips')

  // 3D tools: add a cube -> scene object count grows.
  const objectsBefore = await page.evaluate(() => window.__omniframe_store.getState().scene3DObjects.length)
  await page.getByTestId('pack-section-threed').click()
  await page.getByTestId('pack-3d-cube').click()
  const objectsAfter = await page.evaluate(() => window.__omniframe_store.getState().scene3DObjects.length)
  assert.equal(objectsAfter, objectsBefore + 1, 'Quick 3D should add one scene object')
  await page.evaluate(() => window.__omniframe_store.getState().setIs3DMode(false))

  // Advanced horizontal scrolling: the narrow panel makes the strip overflow,
  // so it hides its scrollbar and wheel-scrolls instead.
  await page.getByTestId('pack-section-windows').click()
  const strip = page.getByTestId('pack-section-strip')
  const stripBox = await strip.boundingBox()
  assert.ok(stripBox, 'Section strip should have a box')
  const scrollBefore = await strip.evaluate((el) => el.scrollLeft)
  await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2)
  await page.mouse.wheel(0, 240)
  await page.waitForTimeout(250)
  const scrollAfter = await strip.evaluate((el) => el.scrollLeft)
  assert.ok(scrollAfter > scrollBefore, `Wheel should scroll the strip (${scrollBefore} -> ${scrollAfter})`)

  // Setting OFF: native mode returns (data attribute flips, arrows vanish).
  await page.evaluate(() => window.__omniframe_store.getState().setHideOverflowX(false))
  const overflowOff = await page.evaluate(() => document.querySelector('[data-testid="studio-scene"]')?.getAttribute('data-overflow-x'))
  assert.equal(overflowOff, 'visible', 'Setting off should restore native overflow')
  assert.equal(await page.getByTestId('pack-section-arrow-right').count(), 0, 'Arrows should hide when the setting is off')
  await page.evaluate(() => window.__omniframe_store.getState().setHideOverflowX(true))

  mkdirSync(join(ROOT, 'evidence/screenshots'), { recursive: true })
  await page.getByTestId('pack-section-windows').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(ROOT, 'evidence/screenshots/omniframe-desktop-pack.png'), fullPage: false })

  assert.deepEqual(runtimeErrors, [], `Runtime errors: ${runtimeErrors.join(' | ')}`)
  console.log('desktop-pack-e2e: passed')
} finally {
  await browser.close()
}
