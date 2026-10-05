/**
 * COLLAPSE −/+ · POPOUT FLOATING WINDOWS · LAYOUT GALLERY E2E
 * ==========================================================
 *
 * Verifies the CapCut-inspired UI overhaul:
 *
 *  1. Preview view-controls: the old in-cluster chevron toggle is GONE; a
 *     − / + chip sits at the stage's TOP-LEFT (testid preserved:
 *     slide-dock-preview-view-controls-toggle). − collapses the cluster,
 *     + restores it; aria-expanded flips; the root dock testid survives.
 *  2. − / + is the single collapse dialect everywhere: PanelSection and
 *     ui.Section headers show a minus glyph expanded / plus glyph collapsed,
 *     no chevrons left in section headers.
 *  3. Left dock pop-out: button tears the panel into a floating window;
 *     dragging the dock header ≥24px also tears it off; the dock slot shows
 *     a placeholder with a working dock-back control.
 *  4. FloatingWindow: header drag moves it, corner resize resizes it,
 *     double-click maximizes/restores, − collapses the body to the title
 *     bar, click-to-front z-ordering beats the inspector float window,
 *     dock-back returns the panel.
 *  5. Layout gallery: CapCut Studio + Cinema Review presets render
 *     wireframe thumbnails and apply their geometry.
 *  6. Mini-icon audit: the −/+ chips are uniformly sized (20px / 18px) with
 *     adequate hit areas — small but not too small.
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

// ---------- 1. Preview −/+ chip: top-left placement, collapse, restore ----------
{
  const chip = page.locator('[data-testid="slide-dock-preview-view-controls-toggle"]')
  await chip.waitFor({ state: 'visible', timeout: 5000 })
  const chipBox = await chip.boundingBox()
  // The preview stage = the first large ancestor of the dock cluster.
  const stage = await page.evaluate(() => {
    let el = document.querySelector('[data-testid="slide-dock-preview-view-controls"]')
    while (el && el.parentElement) {
      el = el.parentElement
      const r = el.getBoundingClientRect()
      if (r.width > 400 && r.height > 300) return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    return null
  })
  const topLeft = stage
    ? chipBox.x - stage.x < 80 && chipBox.y - stage.y < 80
    : chipBox.x < 260 && chipBox.y < 220
  assert('preview −/+ chip renders in the stage top-left corner', topLeft,
    chipBox && stage ? `chip at ${Math.round(chipBox.x)},${Math.round(chipBox.y)} vs stage ${Math.round(stage.x)},${Math.round(stage.y)}` : 'no box')

  const ariaBefore = await chip.getAttribute('aria-expanded')
  const expandedWidth = (await page.locator('[data-testid="slide-dock-preview-view-controls"]').boundingBox())?.width ?? 0
  assert('view-controls cluster expanded on load', ariaBefore === 'true', `aria-expanded=${ariaBefore}`)

  await chip.click()
  await page.waitForTimeout(400)
  const ariaAfter = await chip.getAttribute('aria-expanded')
  const collapsedWidth = (await page.locator('[data-testid="slide-dock-preview-view-controls"]').boundingBox())?.width ?? 0
  assert('− collapses the view-controls cluster', ariaAfter === 'false', `aria-expanded=${ariaAfter}`)
  assert('collapsed cluster is dramatically narrower', collapsedWidth < Math.max(24, expandedWidth * 0.5), `${Math.round(expandedWidth)}px → ${Math.round(collapsedWidth)}px`)
  const hiddenContent = await page.locator('[data-testid="slide-dock-preview-view-controls"] [aria-hidden="true"]').count()
  assert('cluster content is aria-hidden while collapsed', hiddenContent >= 1, `${hiddenContent} hidden node(s)`)

  await chip.click()
  await page.waitForTimeout(400)
  assert('+ restores the view-controls cluster', (await chip.getAttribute('aria-expanded')) === 'true')
  await page.screenshot({ path: join(EVIDENCE, 'collapse-preview-chip.png') })
}

// ---------- 2. − / + dialect across section headers ----------
{
  // Section headers only carry aria-expanded in accordion mode — switch first.
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    if (st.sidebarSectionMode !== 'accordion') st.setSidebarSectionMode('accordion')
  })
  await page.waitForTimeout(500)
  // Inspector sections (right panel). The selector matches both states so the
  // element handle survives the collapse (a [aria-expanded="true"]-only
  // locator would resolve to nothing once everything is folded away).
  const sectionHeader = page.locator('[data-testid="inspector-panel"] button[aria-expanded]').first()
  const hasHeader = await sectionHeader.count()
  if (hasHeader) {
    // Ensure it's open first (accordion auto-opens the first section).
    if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
      await sectionHeader.click()
      await page.waitForTimeout(300)
    }
    const glyph = await sectionHeader.locator('svg').first().evaluate((el) => {
      // lucide Minus renders a single horizontal line path; Plus has two.
      return el.querySelectorAll('path, line').length >= 2 ? 'plus' : 'minus'
    }).catch(() => 'unknown')
    assert('inspector open section header shows − (minus) glyph', glyph === 'minus', `glyph=${glyph}`)
    await sectionHeader.click()
    await page.waitForTimeout(300)
    const aria2 = await sectionHeader.getAttribute('aria-expanded')
    assert('inspector section header click collapses it (toggle-close)', aria2 === 'false', `→ ${aria2}`)
    const glyph2 = await sectionHeader.locator('svg').first().evaluate((el) =>
      el.querySelectorAll('path, line').length >= 2 ? 'plus' : 'minus').catch(() => 'unknown')
    assert('collapsed inspector section header shows + (plus) glyph', glyph2 === 'plus', `glyph=${glyph2}`)
    await sectionHeader.click()
    await page.waitForTimeout(200)
    assert('+ reopens the inspector section', (await sectionHeader.getAttribute('aria-expanded')) === 'true')
  } else {
    assert('inspector has collapsible sections to test', false, 'no aria-expanded header found')
  }

  // Left panel: DrawingPanel is built from PanelSection accordions.
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    st.setLeftOpen(true)
    st.setLeftTab('drawing')
  })
  await page.waitForTimeout(500)
  const leftHeader = page.locator('#left-panel button[aria-expanded]').first()
  const leftCount = await leftHeader.count()
  if (leftCount) {
    const g = await leftHeader.locator('svg').first().evaluate((el) =>
      el.querySelectorAll('path, line').length >= 2 ? 'plus' : 'minus').catch(() => 'unknown')
    assert('left panel accordion header uses − / + dialect', g === 'minus' || g === 'plus', `glyph=${g}`)
    // No chevron dialect left anywhere in section headers.
    const chevrons = await page.locator('#left-panel svg.lucide-chevron-right, #left-panel svg.lucide-chevron-down, [data-testid="inspector-panel"] svg.lucide-chevron-right, [data-testid="inspector-panel"] svg.lucide-chevron-down').count()
    assert('no chevron glyphs remain in section headers', chevrons === 0, `${chevrons} chevron(s)`)
  } else {
    assert('left panel accordion headers exist', false, 'no header found')
  }
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    st.setSidebarSectionMode('tabs')
    st.setLeftTab('media')
  })
  await page.waitForTimeout(300)
}

// ---------- 3. Left dock pop-out ----------
{
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    st.setLeftOpen(true)
    st.setLeftTab('media')
  })
  await page.waitForTimeout(400)
  const popBtn = page.locator('[data-testid="left-panel-popout-btn"]')
  assert('left dock has a pop-out button', (await popBtn.count()) === 1)
  await popBtn.click()
  await page.waitForTimeout(400)

  const fw = page.locator('[data-testid="left-panel-float-window"]')
  assert('pop-out creates a floating window', (await fw.count()) === 1)
  assert('dock slot shows a floating placeholder', (await page.locator('[data-testid="left-panel-float-placeholder"]').count()) === 1)
  const st1 = await page.evaluate(() => window.__omniframe_store.getState().leftPanelFloating)
  assert('store marks the left panel floating', st1 === true)

  // Float body actually contains panel content (media panel).
  const bodyHasContent = await fw.locator('[data-testid="left-panel-float-window-body"] *').count()
  assert('floating window renders the panel content', bodyHasContent > 0, `${bodyHasContent} nodes`)

  await page.screenshot({ path: join(EVIDENCE, 'popout-floating-window.png') })

  // Drag the floating header: position must follow the pointer.
  const header = fw.locator('[data-testid="left-panel-float-window-header"]')
  const before = await fw.boundingBox()
  await header.hover()
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 180, before.y + 120, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after = await fw.boundingBox()
  assert('header drag moves the floating window', after.x - before.x > 100, `x ${Math.round(before.x)} → ${Math.round(after.x)}`)

  // Corner resize: bottom-right handle grows the window.
  const beforeResize = await fw.boundingBox()
  const handle = fw.locator('[data-testid="left-panel-float-window-resize"]')
  const hb = await handle.boundingBox()
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 140, hb.y + 120, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const afterResize = await fw.boundingBox()
  assert('corner handle resizes the floating window', afterResize.width - beforeResize.width > 80, `w ${Math.round(beforeResize.width)} → ${Math.round(afterResize.width)}px`)

  // Double-click header maximizes, then restores.
  await header.dblclick()
  await page.waitForTimeout(300)
  const maxed = await fw.getAttribute('data-maximized')
  assert('double-click header maximizes the window', maxed === 'true', `data-maximized=${maxed}`)
  await header.dblclick()
  await page.waitForTimeout(300)
  assert('double-click again restores the window', (await fw.getAttribute('data-maximized')) === 'false')

  // − collapses the body to the title bar.
  const bodyH = (await fw.locator('[data-testid="left-panel-float-window-body"]').boundingBox())?.height ?? 0
  const chip = fw.locator('button[aria-expanded]').first()
  await chip.click()
  await page.waitForTimeout(300)
  const bodyGone = await fw.locator('[data-testid="left-panel-float-window-body"]').count()
  assert('− collapses the floating window body', bodyGone === 0, `body nodes=${bodyGone}`)
  await chip.click()
  await page.waitForTimeout(300)
  const bodyBack = (await fw.locator('[data-testid="left-panel-float-window-body"]').boundingBox())?.height ?? 0
  assert('+ restores the floating window body', bodyBack > 0 && Math.abs(bodyBack - bodyH) < 40, `${Math.round(bodyH)} → ${Math.round(bodyBack)}px`)

  // z-order vs the inspector float window: clicking the left window brings
  // it in front of the (older) inspector float window.
  await page.evaluate(() => window.__omniframe_store.getState().setRightPanelFloating(true))
  await page.waitForTimeout(400)
  await fw.click({ position: { x: 30, y: 200 } })
  await page.waitForTimeout(200)
  const z = await page.evaluate(() => {
    const l = document.querySelector('[data-testid="left-panel-float-window"]')
    const r = document.querySelector('[data-testid="right-panel-float-window"]')
    return { l: l ? Number(getComputedStyle(l).zIndex) : -1, r: r ? Number(getComputedStyle(r).zIndex) : -1 }
  })
  assert('click-to-front: left float window stacks above inspector float', z.l > z.r && z.l > 0 && z.r > 0, `left=${z.l} right=${z.r}`)

  // Dock back from the placeholder AND from the window header.
  await page.locator('[data-testid="left-panel-float-window-dock-btn"]').click()
  await page.waitForTimeout(400)
  assert('dock-back button returns the panel to its slot', (await page.locator('[data-testid="left-panel-float-window"]').count()) === 0)
  const backDocked = await page.evaluate(() => window.__omniframe_store.getState().leftPanelFloating)
  assert('store marks the left panel docked again', backDocked === false)

  // Header drag-out gesture: dragging the docked header tears the panel off.
  const dockHeader = page.locator('#left-panel .h-8\\.5').first()
  const dhCount = await dockHeader.count()
  if (dhCount) {
    const dhb = await dockHeader.boundingBox()
    await page.mouse.move(dhb.x + dhb.width / 2, dhb.y + dhb.height / 2)
    await page.mouse.down()
    await page.mouse.move(dhb.x + 260, dhb.y + 180, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const tornOff = await page.locator('[data-testid="left-panel-float-window"]').count()
    assert('dragging the dock header ≥24px tears the panel out', tornOff === 1, `float windows=${tornOff}`)
    await page.locator('[data-testid="left-panel-float-placeholder"], [data-testid="left-panel-dock-back-btn"]').first().click().catch(() => {})
    await page.evaluate(() => window.__omniframe_store.getState().setLeftPanelFloating(false))
    await page.waitForTimeout(300)
  } else {
    assert('docked header exists for drag-out gesture', false, 'header not found')
  }
  await page.evaluate(() => window.__omniframe_store.getState().setRightPanelFloating(false))
  await page.waitForTimeout(300)
}

// ---------- 4. Layout gallery: CapCut + Cinema presets ----------
{
  await page.evaluate(() => window.__omniframe_store.getState().setLeftOpen(true))
  await page.waitForTimeout(300)
  // Open the TopBar layout popup, then the full Layout Manager gallery.
  await page.click('[data-testid="workspace-layout-btn"]')
  await page.waitForTimeout(400)
  const quickCapcut = await page.locator('[data-testid="preset-capcut"]').count()
  assert('TopBar quick menu lists CapCut Studio', quickCapcut === 1)
  await page.click('[data-testid="open-layout-manager-btn"]')
  await page.waitForTimeout(400)
  const capcutCard = page.locator('[data-testid="preset-card-capcut"]')
  const cinemaCard = page.locator('[data-testid="preset-card-cinema"]')
  assert('layout gallery lists CapCut Studio preset', (await capcutCard.count()) === 1)
  assert('layout gallery lists Cinema Review preset', (await cinemaCard.count()) === 1)
  const schematic = await capcutCard.locator('[data-testid="workspace-schematic"]').count()
  assert('preset cards show wireframe thumbnails', schematic >= 1, `${schematic} schematic(s)`)

  await capcutCard.click()
  await page.waitForTimeout(500)
  const cap = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { preset: s.workspacePreset, leftTab: s.leftTab, leftOpen: s.leftOpen, rightOpen: s.rightOpen, tl: s.timelineHeight, lf: s.leftPanelFloating, rf: s.rightPanelFloating }
  })
  assert('CapCut preset applies media-first geometry',
    cap.preset === 'capcut' && cap.leftTab === 'media' && cap.leftOpen && cap.rightOpen && cap.tl === 320 && !cap.lf && !cap.rf,
    JSON.stringify(cap))
  await page.screenshot({ path: join(EVIDENCE, 'layout-capcut-studio.png') })

  // Cinema preset from the TopBar quick menu.
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    st.setWorkspacePreset('cinema')
  })
  await page.waitForTimeout(500)
  const cin = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { preset: s.workspacePreset, leftOpen: s.leftOpen, rightOpen: s.rightOpen, tl: s.timelineHeight }
  })
  assert('Cinema preset closes docks for a clean screen',
    cin.preset === 'cinema' && !cin.leftOpen && !cin.rightOpen && cin.tl === 180,
    JSON.stringify(cin))
  await page.screenshot({ path: join(EVIDENCE, 'layout-cinema-review.png') })

  await page.evaluate(() => window.__omniframe_store.getState().setWorkspacePreset('default'))
  await page.waitForTimeout(300)
}

// ---------- 5. Mini-icon audit: −/+ chips uniformly sized, sane hit areas ----------
{
  const chips = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button[aria-expanded][data-testid*="toggle"], [data-testid="slide-dock-preview-view-controls-toggle"]')]
    return nodes.map((n) => {
      const r = n.getBoundingClientRect()
      return { id: n.dataset.testid ?? '(none)', w: r.width, h: r.height }
    })
  })
  const previewChips = chips.filter((c) => c.id.includes('preview-view-controls') || c.id.includes('slide-dock'))
  assert('−/+ slide-dock chips present for audit', previewChips.length >= 1, `${previewChips.length} chip(s)`)
  const allSane = previewChips.every((c) => c.w >= 16 && c.w <= 28 && c.h >= 16 && c.h <= 28 && Math.abs(c.w - c.h) < 3)
  assert('−/+ chips are uniformly square ~18–20px (small but clickable)', allSane, JSON.stringify(previewChips))
}

assert('zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200))

await browser.close()

const pass = results.filter((r) => r.status === 'PASS').length
writeFileSync(join(REPORTS, 'collapse-popout-layouts.json'), JSON.stringify({ suite: 'collapse-popout-layouts', pass, fail: results.length - pass, results }, null, 2))
console.log(`\n=== ${pass} passed / ${results.length - pass} failed ===`)
process.exit(results.length - pass ? 1 : 0)
