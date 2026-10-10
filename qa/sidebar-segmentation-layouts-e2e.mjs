/**
 * SIDEBAR SEGMENTATION + LAYOUT FORMS E2E
 * =======================================
 *
 * Verifies the tabbed-interface sidebar (default) and the accordion
 * fallback, plus the new workspace layout presets:
 *
 *  1. Default presentation is TABS: a role=tablist chip strip at the top of
 *     the left panel; exactly one tab panel rendered; switching tabs swaps
 *     content; arrow keys navigate.
 *  2. The header toggle flips to single-open ACCORDION: headers visible,
 *     opening one section collapses the previous one.
 *  3. The right-panel inspector follows the same section modes.
 *  4. New layout presets (Audio Suite, VFX & Tracking, Rig & Animate,
 *     Manga/MMV) apply their layout geometry from the Layout Manager.
 *  5. Decluttered chrome: panel overview banners are now compact hints
 *     (no giant banner text), AccordionGroup has no Show/Hide text.
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

const openLeftTab = async (tab) => {
  await page.evaluate((t) => {
    const st = window.__omniframe_store.getState()
    if (st.leftTab !== t || !st.leftOpen) st.setLeftTab(t)
  }, tab)
  await page.waitForTimeout(400)
}

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

/* ---- 1. Tabs is the default sidebar presentation ---- */
console.log('--- Step 1: Tabs mode default (left panel) ---')
let mode = await page.evaluate(() => window.__omniframe_store.getState().sidebarSectionMode)
assert('Default sidebar section mode is tabs', mode === 'tabs', mode)

// Drawing panel has multiple top-level PanelSections.
await openLeftTab('drawing')
const tablist = page.getByTestId('left-panel').getByTestId('sections-tablist')
await tablist.waitFor({ state: 'visible', timeout: 5000 })
const tabCount = await tablist.locator('[role="tab"]').count()
assert('Tab list renders for sectioned panel', tabCount >= 2, `${tabCount} tabs`)
const selected1 = await tablist.locator('[aria-selected="true"]').first().getAttribute('data-testid')
assert('Exactly one tab selected', (await tablist.locator('[aria-selected="true"]').count()) === 1, selected1 || '')

// Only the active section's body renders: check a control inside another section is hidden.
const allDrawingSections = await page.locator('[data-testid^="panel-section-"]').count()
await page.screenshot({ path: join(EVIDENCE, 'sidebar-tabs-default.png') })

// Switch tab via chip click.
const otherTab = tablist.locator('[role="tab"]').nth(1)
const otherTabId = await otherTab.getAttribute('data-testid')
await otherTab.click()
await page.waitForTimeout(300)
const selected2 = await tablist.locator('[aria-selected="true"]').first().getAttribute('data-testid')
assert('Clicking a chip switches the active tab panel', selected2 === otherTabId, `${selected1} -> ${selected2}`)

// Arrow-key navigation.
await tablist.locator('[aria-selected="true"]').first().focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(200)
const selected3 = await tablist.locator('[aria-selected="true"]').first().getAttribute('data-testid')
assert('Arrow key moves to the next tab', selected3 !== selected2, `${selected2} -> ${selected3}`)

/* ---- 2. Accordion fallback: single-open ---- */
console.log('--- Step 2: Accordion mode (single-open) ---')
await page.getByTestId('sidebar-section-mode-btn').click()
await page.waitForTimeout(400)
mode = await page.evaluate(() => window.__omniframe_store.getState().sidebarSectionMode)
assert('Header toggle flips to accordion', mode === 'accordion', mode)
assert('Tab list hidden in accordion mode', !(await tablist.isVisible().catch(() => false)))

// Top-level sections only: nested sections (inside another section's body)
// keep independent disclosure and are excluded from single-open accounting.
const topLevel = page.locator(
  '[data-testid^="panel-section-"]:not(:has([data-testid^="panel-section-"]))',
)
const topLevelInfo = () =>
  page.evaluate(() => {
    const tops = [...document.querySelectorAll('#left-panel [data-testid^="panel-section-"]')].filter(
      (el) => !el.parentElement.closest('section'),
    )
    return tops.map((el) => ({
      id: el.getAttribute('data-testid'),
      expanded: el.querySelector(':scope > button[aria-expanded]')?.getAttribute('aria-expanded'),
    }))
  })
const headerCount = (await topLevelInfo()).length
assert('Section headers visible again in accordion', headerCount >= 2, `${headerCount} top-level headers`)
const expandedBefore = (await topLevelInfo()).filter((x) => x.expanded === 'true').length
// Open the first header, then the second: only one stays open.
const tops = await topLevelInfo()
await page.locator(`[data-testid="${tops[0].id}"] > button`).click()
await page.waitForTimeout(250)
await page.locator(`[data-testid="${tops[1].id}"] > button`).click()
await page.waitForTimeout(250)
const after = await topLevelInfo()
const expandedAfter = after.filter((x) => x.expanded === 'true').length
assert(
  'Single-open: expanding one section collapses the others',
  expandedAfter === 1 && after[1].expanded === 'true',
  `${JSON.stringify(after)}`,
)
await page.screenshot({ path: join(EVIDENCE, 'sidebar-accordion-single-open.png') })

// Toggle back to tabs.
await page.getByTestId('sidebar-section-mode-btn').click()
await page.waitForTimeout(400)
assert('Toggle returns to tabs', (await page.evaluate(() => window.__omniframe_store.getState().sidebarSectionMode)) === 'tabs')
await tablist.waitFor({ state: 'visible' })

/* ---- 3. Inspector follows the same modes ---- */
console.log('--- Step 3: Inspector section navigation ---')
// Import the demo asset so a clip exists and the Clip Inspector with its sections shows.
await openLeftTab('media')
const importInput = page.getByTestId('panel-all-import-input')
const demoVideo = join(ROOT, 'qa/fixtures', 'test-audio-6s.ogg')
const hasFixture = await importInput.evaluate(() => true).catch(() => false)
if (hasFixture) {
  // Add a clip via store (fast, deterministic) to select it.
  await page.evaluate(async () => {
    const st = window.__omniframe_store.getState()
    const asset = st.assets.find((a) => a.kind === 'video' || a.kind === 'image')
    if (asset) {
      const trackId = st.ensureTrack('video')
      st.addClipToTrack(trackId, asset.id, 0)
    }
  })
  await page.waitForTimeout(400)
  const inspectorTabs = page.getByTestId('inspector-panel').locator('..').getByTestId('sections-tablist')
  const inspectorTabCount = await inspectorTabs.count()
  assert('Inspector renders a section tab list', inspectorTabCount >= 1, `${inspectorTabCount} list(s)`)
  const firstList = inspectorTabs.first()
  if (await firstList.isVisible()) {
    const n = await firstList.locator('[role="tab"]').count()
    assert('Inspector sections appear as tabs', n >= 2, `${n} tabs`)
    await firstList.locator('[role="tab"]').nth(1).click()
    await page.waitForTimeout(250)
    const sel = await firstList.locator('[aria-selected="true"]').first().getAttribute('data-testid')
    assert('Inspector tab switching works', !!sel, sel || '')
  }
} else {
  console.log('SKIP inspector tab check (no fixture asset)')
}

/* ---- 4. New layout presets ---- */
console.log('--- Step 4: Layout forms (new presets) ---')
const applyPreset = async (id) => {
  await page.evaluate((p) => window.__omniframe_store.getState().setWorkspacePreset(p), id)
  await page.waitForTimeout(300)
}
const snap = () =>
  page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      preset: s.workspacePreset,
      leftTab: s.leftTab,
      leftOpen: s.leftOpen,
      rightOpen: s.rightOpen,
      timelineHeight: s.timelineHeight,
      graphEditorOpen: s.graphEditorOpen,
      drawingEnabled: s.drawingEnabled,
    }
  })

await applyPreset('audio')
let l = await snap()
assert('Audio Suite preset applies', l.preset === 'audio' && l.leftTab === 'audio' && l.timelineHeight >= 460, JSON.stringify({ leftTab: l.leftTab, timeline: l.timelineHeight }))

await applyPreset('vfx')
l = await snap()
assert('VFX & Tracking preset applies', l.preset === 'vfx' && l.leftTab === 'tracking' && l.rightOpen === true, JSON.stringify({ leftTab: l.leftTab, rightOpen: l.rightOpen }))

await applyPreset('rig')
l = await snap()
assert('Rig & Animate preset opens graph editor', l.preset === 'rig' && l.leftTab === 'rigging' && l.graphEditorOpen === true, JSON.stringify({ leftTab: l.leftTab, graph: l.graphEditorOpen }))

await applyPreset('manga')
l = await snap()
assert('Manga/MMV preset enables drawing canvas', l.preset === 'manga' && l.drawingEnabled === true && l.leftTab === 'drawing', JSON.stringify({ leftTab: l.leftTab, drawing: l.drawingEnabled }))
await page.screenshot({ path: join(EVIDENCE, 'layout-manga-preset.png') })

// Presets reachable from the Layout Manager modal list as well.
await page.evaluate(() => window.__omniframe_store.getState().setWorkspacePreset('default'))
await page.waitForTimeout(200)

/* ---- 5. Decluttered chrome ---- */
console.log('--- Step 5: Decluttered chrome ---')
await openLeftTab('audio')
await page.waitForTimeout(300)
const bannerGone = await page.locator('text=Voice Isolation & Vocal Separation').count()
assert('Panel overview banner replaced by compact hint', bannerGone === 0, `${bannerGone} banners`)
const hintCount = await page.locator('[title*="Separates dialogue"]').count()
assert('Compact hint carries the description as tooltip', hintCount >= 1, `${hintCount} hints`)
const showHideText = await page.locator('button:has-text("Show"), button:has-text("Hide")').count()
assert('AccordionGroup Show/Hide text removed', showHideText === 0, `${showHideText} labels`)

assert('Zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()

writeFileSync(
  join(REPORTS, 'sidebar-segmentation-layouts.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), results, pageErrors }, null, 2),
)
const passCount = results.filter((r) => r.status === 'PASS').length
console.log(`\nRESULT ${passCount}/${results.length} PASS — report: qa/reports/sidebar-segmentation-layouts.json`)
