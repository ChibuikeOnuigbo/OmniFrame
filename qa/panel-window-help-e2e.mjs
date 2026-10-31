const base = 'http://127.0.0.1:5173'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }
async function main() {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.getByText('Open Studio').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  // test rig seeds fixtures (webdriver) — real-user empty path is the same store with webdriver off
  const demoSeeded = await page.evaluate(() => window.__omniframe_store.getState().assets.some((a) => a.id === 'asset-death-note-vid'))
  check('webdriver rig keeps demo fixtures', demoSeeded)
  // maximize → 95vw window
  await page.click('[data-testid="left-panel-maximize-btn"]')
  await page.waitForTimeout(400)
  const max = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="left-panel"]')
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width / innerWidth * 100), backdrop: !!document.querySelector('[data-testid="left-panel-backdrop"]') }
  })
  check('panel maximizes to ~95vw with backdrop', max.w >= 93 && max.backdrop, JSON.stringify(max))
  await page.click('[data-testid="left-panel-maximize-btn"]')
  await page.waitForTimeout(300)
  // help docker
  await page.click('[data-testid="help-open-btn"]')
  await page.waitForTimeout(300)
  const help = await page.evaluate(() => ({ modal: !!document.querySelector('[data-testid="help-modal"]'), entries: document.querySelectorAll('[data-testid^="help-entry-"]').length }))
  check('help docker opens with entries', help.modal && help.entries >= 8, JSON.stringify(help))
  await page.click('[data-testid="help-close-btn"]')
  // pack browser
  await page.click('[data-testid="left-tab-pack"]')
  await page.waitForTimeout(400)
  await page.click('[data-testid="pack-browser-open-btn"]')
  await page.waitForTimeout(600)
  const browserOpen = await page.evaluate(() => !!document.querySelector('[data-testid="pack-browser-modal"]'))
  check('pack browser opens (95% window)', browserOpen)
  const bundlesAll = await page.evaluate(() => document.querySelectorAll('[data-testid^="pack-browser-bundle-"]').length)
  check('pack bundles listed with previews', bundlesAll >= 10, `bundles=${bundlesAll}`)
  await page.fill('[data-testid="pack-browser-search"]', 'chrome')
  await page.waitForTimeout(300)
  const filtered = await page.evaluate(() => document.querySelectorAll('[data-testid^="pack-browser-asset-"]').length)
  check('pack browser search filters', filtered > 0 && filtered < 75, `assets=${filtered}`)
  const bundlesFiltered = await page.evaluate(() => document.querySelectorAll('[data-testid^="pack-browser-bundle-"]').length)
  check('pack bundles filter with search', bundlesFiltered >= 1 && bundlesFiltered < 18, `bundles=${bundlesFiltered}`)
  await page.fill('[data-testid="pack-browser-search"]', '')
  await page.waitForTimeout(200)
  await page.click('[data-testid^="pack-browser-bundle-"]')
  await page.waitForTimeout(300)
  const inside = await page.evaluate(() => !!document.querySelector('[data-testid^="pack-browser-add-bundle-"]'))
  check('bundle detail shows contents + add-whole-pack', inside)
  await page.click('[data-testid="pack-browser-back"]')
  await page.waitForTimeout(300)
  await page.click('[data-testid="pack-browser-folder-all"]')
  await page.waitForTimeout(300)
  await page.click('[data-testid^="pack-browser-asset-"]')
  await page.waitForTimeout(400)
  await page.click('[data-testid="pack-browser-close"]')
  await page.waitForTimeout(300)
  // BrandBird-style floating selection quick bar (needs a clip: add one from the pack browser state or via store)
  const barVisible = await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    if (!st.clips.length) return 'no-clips'
    st.selectClip(st.clips[0].id)
    return true
  })
  if (barVisible === true) {
    await page.waitForTimeout(400)
    const bar = await page.evaluate(() => !!document.querySelector('[data-testid="selection-quick-bar"]'))
    check('selection quick-bar floats over monitor', bar)
    if (bar) {
      await page.click('[data-testid="quick-bar-effects"]')
      await page.waitForTimeout(300)
      const tab = await page.evaluate(() => window.__omniframe_store.getState().leftTab)
      check('quick-bar Effects opens effects panel', tab === 'effects', tab)
    }
  } else {
    console.log('SKIP quick-bar (no clips in project)')
  }
  console.log(`\n${pass} passed, ${fail} failed`)
  await browser.close()
  process.exit(fail ? 1 : 0)
}
main()
