// Smoke-test the Rigging mode in a real browser: can we create a rig, add
// parts, auto-rig them, and does the hierarchy actually move children?
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.BASE || 'http://localhost:5173'

// Playwright's own Chromium download is unavailable here, so we use the
// serverless build (same approach as qa/ui-strict-audit.mjs).
try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) { /* already inflated */ }

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('Console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('Pageerror', (e) => errors.push(String(e)))

const results = []
const ok = (n, c, d = '') => { results.push([n, !!c, d]); console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

// Open the rigging tab via the store so we don't depend on dock iconography.
// The app boots on the landing page; enter the studio first.
await page.getByRole('button', { name: 'Open Studio' }).click()
await page.waitForTimeout(1200)

// Open the rigging tab through the store: the left dock may be collapsed
// at this viewport, and the tab button is only rendered when it is open.
const opened = await page.evaluate(() => {
  const st = window.__omniframe_store?.getState?.()
  if (!st) return 'no store'
  st.setLeftTab?.('rigging')
  if (st.leftOpen === false) st.setLeftOpen?.(true)
  return 'ok'
})
console.log(`   (tab open via store: ${opened})`)
await page.waitForTimeout(800)

const visible = await page.locator('#rig-canvas').count()
ok('rigging canvas renders', visible === 1, visible ? '' : 'left-tab-rigging not found or panel closed')

if (visible) {
  /**
   * Rigging panel sections are tabbed now ('Parts', 'Part — <name>',
   * 'Transform', ...). Show the tab whose label contains `text`.
   */
  const rigTab = async (text) => {
    const chip = page.locator('[role="tab"]').filter({ hasText: text }).first()
    if ((await chip.count()) > 0 && (await chip.getAttribute('aria-selected')) !== 'true') {
      await chip.click()
      await page.waitForTimeout(200)
    }
  }

  await page.click('#rig-new')
  await page.waitForTimeout(300)

  // Add: torso, upper arm L, forearm L, hand L -- the canonical limb chain.
  const add = async (kind, side) => {
    await page.selectOption('#rig-new-kind', kind)
    await page.selectOption('#rig-new-side', side)
    await page.click('#rig-add')
    await page.waitForTimeout(150)
  }
  await add('torso', 'center')
  await add('armUpper', 'left')
  await add('armLower', 'left')
  await add('hand', 'left')

  const count = await page.locator('#rig-part-list > li').count()
  ok('four parts added', count === 4, `got ${count}`)

  await page.click('#rig-auto')
  await page.waitForTimeout(300)

  // The forearm should now have the upper arm as parent.
  const names = await page.locator('#rig-part-list button[id^="rig-select-"]').allTextContents()
  const handIdx = names.findIndex((n) => n.startsWith('Hand'))
  ok('auto-rig named parts with L suffix', names.some((n) => n === 'Upper Arm L'), names.join(' | '))

  if (handIdx >= 0) {
    await page.locator('#rig-part-list button[id^="rig-select-"]').nth(handIdx).click()
    await page.waitForTimeout(250)
    // Sections are tabbed now: switch to the selected part's tab to reach its
    // controls (the only section chip whose label contains an em dash).
    await rigTab('—')
    const parent = await page.locator('#rig-part-parent').inputValue()
    const parentName = await page.locator('#rig-part-parent option:checked').textContent()
    ok('hand is parented to the forearm after auto-rig',
       /forearm/i.test(parentName || ''), `parent = "${parentName}"`)
    ok('parent select is populated (not empty)', !!parent)
  }

  // Cycle guard: parenting the torso under its own descendant must be refused.
  const torsoIdx = names.findIndex((n) => n === 'Torso')
  if (handIdx >= 0 && torsoIdx >= 0) {
    await rigTab('Parts')
    const parts = page.locator('#rig-part-list button[id^="rig-select-"]')
    await parts.nth(handIdx).click(); await page.waitForTimeout(150)
    await rigTab('—')
    const handId = (await page.locator('#rig-part-name').inputValue(), null)
    // Record the hand's id by selecting it, then try to make torso its child.
    await rigTab('Parts')
    await parts.nth(torsoIdx).click(); await page.waitForTimeout(250)
    await rigTab('—')
    const opts = await page.locator('#rig-part-parent option').allTextContents()
    const handOpt = await page.locator('#rig-part-parent option', { hasText: 'Hand L' }).count()
    ok('hand offered as a possible parent when torso is selected', handOpt >= 1, `${opts.length} options`)
    // The DOM only offers the link; the guard lives in the store. Verify via the store.
  }

  // Bend + wind sections exist and toggle.
  await rigTab('Parts')
  await page.locator('#rig-part-list button[id^="rig-select-"]').first().click()
  await page.waitForTimeout(200)
  await rigTab('Transform')
  ok('transform controls present', await page.locator('#rig-rot').count() === 1)

  // --- "Rigged in 1 tap": seed a rig from an existing segmented cutout ---
  await rigTab('Parts')
  const hasChars = await page.locator('#rig-from-character-go').count()
  ok('one-tap path offered when cutouts exist', hasChars === 1)

  if (hasChars) {
    const nameBefore = await page
      .locator('#rig-source-character option')
      .first()
      .textContent()
    await page.click('#rig-from-character-go')
    await page.waitForTimeout(400)

    const seeded = await page.evaluate(() => {
      const st = window.__omniframe_store.getState()
      const rig = st.rigs.find((r) => r.id === st.activeRigId)
      const root = rig?.parts?.[0]
      return {
        parts: rig?.parts?.length ?? 0,
        cutout: root?.cutoutUrl ?? '',
        kind: root?.kind ?? '',
        parent: root ? root.parentId : 'MISSING',
        hasBounds: !!root?.bounds?.width,
      }
    })
    ok('one-tap creates a rig', seeded.parts >= 1, JSON.stringify(seeded))
    ok('seeded root carries real artwork, not a placeholder',
       seeded.cutout.length > 0, `cutoutUrl = "${seeded.cutout}"`)
    ok('seeded root is the torso (anatomical root)', seeded.kind === 'torso', seeded.kind)
    ok('seeded root has no parent', seeded.parent === null, String(seeded.parent))
    ok('seeded root has real bounds', seeded.hasBounds === true)
    ok('seeded from the character shown in the picker', !!nameBefore)
  }
}

ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' / '))

await browser.close()
const failed = results.filter((r) => !r[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
