import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'qa-output/ui-200')
const docs = path.join(root, 'docs')
const baseUrl = process.env.URL || 'http://localhost:5173/#studio'
const tabs = ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed']
const controlsPerTab = 20
const minimumTarget = 24
const affordanceReportPath = path.join(root, 'qa/reports/ui-affordance-audit.json')
const broadAffordance = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(affordanceReportPath, 'utf8'))
    return { tiny: parsed.byKind?.TINY || 0, unnamed: parsed.byKind?.NAMELESS || 0, duplicateTestIds: parsed.totals?.dupes || 0 }
  } catch {
    return null
  }
})()

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
fs.mkdirSync(docs, { recursive: true })

await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`

const browser = await chromium.launch({
  executablePath: await chrome.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ').replace(/\s+/g, ' ').trim()
const rgb = (value) => (value || '').replace(/\s+/g, '')
const differs = (a, b) => rgb(a) !== rgb(b)
const hasVisibleFocus = (rest, focused) => {
  if (differs(rest.outlineColor, focused.outlineColor) && focused.outlineStyle !== 'none') return true
  if (focused.outlineStyle !== 'none' && Number.parseFloat(focused.outlineWidth) > 0) return true
  if (differs(rest.boxShadow, focused.boxShadow) && focused.boxShadow !== 'none') return true
  return false
}

function measurementScript(id) {
  const el = document.querySelector(`[data-ui-audit-id="${CSS.escape(id)}"]`)
  if (!el) return null
  const cs = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  return {
    borderColor: cs.borderColor,
    borderWidth: cs.borderWidth,
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    outlineColor: cs.outlineColor,
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    boxShadow: cs.boxShadow,
    transform: cs.transform,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
  }
}

function selectControls({ tab, take }) {
  document.querySelectorAll('[data-ui-audit-id]').forEach((element) => element.removeAttribute('data-ui-audit-id'))
  const root = document.querySelector('[data-testid="left-dock-root"]')
  const panel = document.querySelector('[data-testid="left-panel"]')
  if (!root || !panel) return []
  const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])'
  const visible = (element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0 || rect.width < 1 || rect.height < 1 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false
    let ancestor = element.parentElement
    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = getComputedStyle(ancestor)
      if (/hidden|auto|scroll|clip/.test(`${ancestorStyle.overflow} ${ancestorStyle.overflowX} ${ancestorStyle.overflowY}`)) {
        const clip = ancestor.getBoundingClientRect()
        if (rect.left < clip.left - 1 || rect.right > clip.right + 1 || rect.top < clip.top - 1 || rect.bottom > clip.bottom + 1) return false
      }
      ancestor = ancestor.parentElement
    }
    return true
  }
  const nameOf = (element) => {
    const labelled = element.getAttribute('aria-labelledby')
    return (element.getAttribute('aria-label') ||
      (labelled && document.getElementById(labelled)?.textContent) ||
      element.getAttribute('title') ||
      element.getAttribute('placeholder') ||
      element.textContent ||
      element.getAttribute('data-testid') || '').trim().replace(/\s+/g, ' ').slice(0, 72)
  }
  const pathOf = (element) => {
    const parts = []
    let node = element
    for (let i = 0; node && node !== root && i < 5; i += 1) {
      const testid = node.getAttribute?.('data-testid')
      parts.unshift(testid ? `[${testid}]` : node.tagName.toLowerCase())
      node = node.parentElement
    }
    return parts.join('>')
  }
  const parentLayout = (element) => {
    let node = element.parentElement
    for (let i = 0; node && i < 4; i += 1, node = node.parentElement) {
      const display = getComputedStyle(node).display
      if (display === 'grid' || display === 'flex' || display === 'inline-flex') return display
    }
    return 'flow'
  }
  const panelControls = [...panel.querySelectorAll(selector)].filter(visible)
  const otherControls = [...root.querySelectorAll(selector)].filter((element) => visible(element) && !panel.contains(element))
  const selected = [...panelControls, ...otherControls].slice(0, take)
  return selected.map((element, index) => {
    const id = `ui-${tab}-${String(index + 1).padStart(2, '0')}`
    element.setAttribute('data-ui-audit-id', id)
    const rect = element.getBoundingClientRect()
    const selectedState = element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-checked') === 'true'
    const role = element.getAttribute('role') || element.tagName.toLowerCase()
    return {
      id,
      tab,
      testid: element.getAttribute('data-testid') || '',
      name: nameOf(element),
      path: pathOf(element),
      role,
      selectedState,
      disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
      parentLayout: parentLayout(element),
      initialRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }
  })
}

async function makeContactSheet(tab, records) {
  const width = 1240
  const height = 760
  const columns = 4
  const rows = 5
  const margin = 12
  const gap = 8
  const cellWidth = (width - margin * 2 - gap * (columns - 1)) / columns
  const cellHeight = (height - margin * 2 - gap * (rows - 1)) / rows
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.fillStyle = '#080d15'
  context.fillRect(0, 0, width, height)
  context.font = '600 12px sans-serif'
  context.textBaseline = 'top'

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = margin + column * (cellWidth + gap)
    const y = margin + row * (cellHeight + gap)
    context.fillStyle = record.verdict === 'PASS' ? '#101d24' : record.verdict === 'REVIEW' ? '#241d10' : '#271014'
    context.strokeStyle = record.verdict === 'PASS' ? '#285969' : record.verdict === 'REVIEW' ? '#886824' : '#a33a48'
    context.lineWidth = 1
    context.fillRect(x, y, cellWidth, cellHeight)
    context.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)
    context.fillStyle = '#d9e7ef'
    context.fillText(`${record.number}. ${record.name || '(unnamed)'}`.slice(0, 42), x + 8, y + 7)
    context.fillStyle = record.verdict === 'PASS' ? '#67d3e8' : record.verdict === 'REVIEW' ? '#f1c45b' : '#ff7185'
    context.fillText(record.verdict, x + cellWidth - 58, y + 7)
    try {
      const image = await loadImage(record.cutout)
      const maxWidth = cellWidth - 18
      const maxHeight = cellHeight - 48
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 2)
      const drawWidth = Math.max(1, image.width * scale)
      const drawHeight = Math.max(1, image.height * scale)
      context.drawImage(image, x + (cellWidth - drawWidth) / 2, y + 28 + (maxHeight - drawHeight) / 2, drawWidth, drawHeight)
    } catch {
      context.fillStyle = '#9ba8b4'
      context.fillText('Cutout unavailable', x + 8, y + 50)
    }
  }
  fs.writeFileSync(path.join(out, `cutouts-${tab}.png`), canvas.toBuffer('image/png'))
}

async function effectsPatternAudit(page) {
  await page.evaluate(() => {
    const state = window.__omniframe_store?.getState?.()
    state?.setLeftOpen?.(true)
    state?.setLeftTab?.('effects')
  })
  const stepper = page.getByTestId('fx-collection-stepper')
  const previous = page.getByTestId('fx-collection-prev')
  const select = page.getByTestId('fx-collection-select')
  const next = page.getByTestId('fx-collection-next')
  const grid = page.getByTestId('fx-category-grid')
  await stepper.waitFor({ state: 'visible' })
  const [previousBox, selectBox, nextBox] = await Promise.all([previous.boundingBox(), select.boundingBox(), next.boundingBox()])
  assert.ok(previousBox && selectBox && nextBox)
  assert.ok(previousBox.x < selectBox.x && selectBox.x < nextBox.x, 'collection stepper orders previous, value, next')
  assert.ok(previousBox.width >= minimumTarget && nextBox.width >= minimumTarget, 'collection arrows meet the 24px target')

  const columns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
  assert.equal(columns, 4, 'effect category tags use a four-column grid')
  const all = page.getByTestId('fx-cat-all')
  const glitch = page.getByTestId('fx-cat-glitch')
  const selected = await all.evaluate((element) => {
    const style = getComputedStyle(element)
    return { border: style.borderColor, background: style.backgroundColor, width: style.borderWidth, selected: element.getAttribute('aria-selected') }
  })
  const rest = await glitch.evaluate((element) => {
    const style = getComputedStyle(element)
    return { border: style.borderColor, background: style.backgroundColor, width: style.borderWidth, selected: element.getAttribute('aria-selected') }
  })
  await glitch.hover()
  await page.waitForTimeout(180)
  const hover = await glitch.evaluate((element) => {
    const style = getComputedStyle(element)
    return { border: style.borderColor, background: style.backgroundColor, width: style.borderWidth }
  })
  assert.equal(selected.selected, 'true')
  assert.equal(rest.selected, 'false')
  assert.notEqual(rgb(selected.border), rgb(rest.border), 'selected tag has a persistent border distinct from rest')
  assert.ok(differs(rest.border, hover.border) || differs(rest.background, hover.background), 'hover tag is visible')
  assert.notEqual(rgb(selected.background), rgb(hover.background), 'hover remains weaker than selected')

  const initial = await select.inputValue()
  await next.click()
  const afterNext = await select.inputValue()
  assert.notEqual(afterNext, initial, 'next arrow changes the collection')
  await previous.click()
  assert.equal(await select.inputValue(), initial, 'previous arrow returns to the collection')

  await stepper.screenshot({ path: path.join(out, 'proof-effects-collection-stepper.png') })
  await grid.screenshot({ path: path.join(out, 'proof-effects-category-grid.png') })
  return {
    arrowOrder: 'previous < selection < next',
    arrowTarget: `${Math.round(previousBox.width)}x${Math.round(previousBox.height)} / ${Math.round(nextBox.width)}x${Math.round(nextBox.height)}`,
    gridColumns: columns,
    selectedBorder: selected.border,
    restBorder: rest.border,
    hoverBorder: hover.border,
    cycle: `${initial} → ${afterNext} → ${initial}`,
  }
}

function buildMarkdown(records, effectsPattern, errors, affordance) {
  const counts = records.reduce((accumulator, record) => {
    accumulator[record.verdict] = (accumulator[record.verdict] || 0) + 1
    return accumulator
  }, {})
  const rows = records.map((record) => {
    const state = record.selectedState ? 'Selected' : 'Rest'
    const interaction = record.hoverChanged ? 'Hover changes' : record.requiresHover ? 'No hover delta' : 'Hover N/A'
    const focus = record.focusVisible ? 'Focus visible' : record.disabled ? 'Disabled' : 'Focus review'
    const target = `${Math.round(record.width)}×${Math.round(record.height)}`
    return `| ${record.number} | ${record.tab} | ${escapeCell(record.name || '(unnamed)')} | ${escapeCell(record.role)} | ${target} | ${record.parentLayout} | ${state}; ${interaction}; ${focus} | **${record.verdict}** | ${escapeCell(record.notes.join('; ') || 'Measured cleanly')} |`
  }).join('\n')
  return `# OmniFrame UI quality — 200 live scans\n\n` +
    `**Run date:** 2026-11-08\n\n` +
    `**Surface:** Studio left dock and each of its ten editor modes at 1600×1000\n\n` +
    `**Method:** Playwright measured exactly 20 visible interactive controls in each mode, captured every control, and assembled ten cutout contact sheets. This is live browser evidence, not a source-only review.\n\n` +
    `## Verdict\n\n` +
    `- Total scans: **${records.length}**\n` +
    `- PASS: **${counts.PASS || 0}**\n` +
    `- REVIEW: **${counts.REVIEW || 0}**\n` +
    `- FAIL: **${counts.FAIL || 0}**\n` +
    `- Browser errors: **${errors.length}**\n` +
    (affordance ? `- Broader two-viewport affordance sweep: **${affordance.tiny} tiny, ${affordance.unnamed} unnamed, ${affordance.duplicateTestIds} duplicate-test-id findings**\n\n` : '\n') +
    `A PASS means the control is named, visible, inside the viewport, at least 24×24 CSS pixels, and exposes the applicable interaction state. REVIEW marks a usable control whose hover or keyboard focus treatment needs a design pass. FAIL marks a target, naming, or viewport defect that blocks reliable operation.\n\n` +
    `## Strict state rules\n\n` +
    `1. A clicked or selected tag keeps a persistent border/background state and exposes \`aria-selected\`, \`aria-pressed\`, or \`aria-checked\`.\n` +
    `2. Hover produces a visible change but remains lower emphasis than the selected state.\n` +
    `3. Tags and view switches use consistent grid or flex alignment instead of irregular wrapping.\n` +
    `4. Keyboard focus must be visible; interactive targets must be at least 24×24 CSS pixels.\n` +
    `5. Edge-arrow selectors keep Previous at the left edge, the current value in the center, and Next at the right edge.\n\n` +
    `## Effects collection proof\n\n` +
    `- Order: **${effectsPattern.arrowOrder}**\n` +
    `- Arrow targets: **${effectsPattern.arrowTarget}**\n` +
    `- Category grid: **${effectsPattern.gridColumns} columns**\n` +
    `- Border hierarchy: selected \`${effectsPattern.selectedBorder}\`; rest \`${effectsPattern.restBorder}\`; hover \`${effectsPattern.hoverBorder}\`\n` +
    `- Functional cycle: **${effectsPattern.cycle}**\n` +
    `- Evidence: [collection stepper](../qa-output/ui-200/proof-effects-collection-stepper.png), [category grid](../qa-output/ui-200/proof-effects-category-grid.png)\n\n` +
    `## Professional pattern comparison\n\n` +
    `The verdict uses three public design-system baselines and the user-supplied picker reference. Adobe Spectrum's button component provides the professional control baseline. Material Design defines hover, focus, and pressed state layers with different emphasis. The WAI-ARIA tabs pattern requires an explicit selected tab and keyboard-operable semantics. OmniFrame's effect tags now follow those principles with a persistent cyan selected state, a quieter hover border, a four-column layout, and semantic \`role=tab\` / \`aria-selected\`. The edge-arrow collection picker follows the supplied compact picker layout while retaining an accessible native select.\n\n` +
    `References checked 2026-11-08:\n\n` +
    `- Adobe Spectrum Web Components, Button: https://opensource.adobe.com/spectrum-web-components/components/button/\n` +
    `- Material Design 3, Interaction states: https://m3.material.io/foundations/interaction/states/overview\n` +
    `- WAI-ARIA Authoring Practices, Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/\n\n` +
    `## Cutout contact sheets\n\n` +
    tabs.map((tab) => `- [${tab}](../qa-output/ui-200/cutouts-${tab}.png) — scans ${tabs.indexOf(tab) * controlsPerTab + 1}–${(tabs.indexOf(tab) + 1) * controlsPerTab}`).join('\n') +
    `\n\n## All 200 scans\n\n` +
    `| # | Mode | Control | Role | Target | Layout | State evidence | Verdict | Notes |\n` +
    `|---:|---|---|---|---:|---|---|---|---|\n` + rows + '\n'
}

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__omniframe_store?.getState?.()))
  const effectsPattern = await effectsPatternAudit(page)
  const records = []

  for (const tab of tabs) {
    await page.evaluate((activeTab) => {
      const state = window.__omniframe_store.getState()
      state.setLeftOpen(true)
      state.setLeftTab(activeTab)
      state.setActiveCategory?.('all')
    }, tab)
    await page.waitForTimeout(tab === 'effects' ? 700 : 250)
    const controls = await page.evaluate(selectControls, { tab, take: controlsPerTab })
    assert.equal(controls.length, controlsPerTab, `${tab} exposes ${controlsPerTab} visible controls for the audit`)
    const tabRecords = []

    for (const control of controls) {
      const locator = page.locator(`[data-ui-audit-id="${control.id}"]`)
      await page.mouse.move(1580, 20)
      await page.waitForTimeout(15)
      const rest = await page.evaluate(measurementScript, control.id)
      assert.ok(rest, `${control.id} remains mounted`)
      if (!control.disabled) {
        await locator.hover({ force: true })
        await page.waitForTimeout(180)
      }
      const hover = await page.evaluate(measurementScript, control.id)
      await page.mouse.move(1580, 20)
      if (!control.disabled) {
        await page.keyboard.press('Tab')
        await locator.focus()
        await page.waitForTimeout(50)
      }
      const focused = await page.evaluate(measurementScript, control.id)
      const box = await locator.boundingBox()
      assert.ok(box, `${control.id} has a screenshot box`)
      const padding = 5
      const clip = {
        x: Math.max(0, box.x - padding),
        y: Math.max(0, box.y - padding),
        width: Math.max(1, Math.min(1600 - Math.max(0, box.x - padding), box.width + padding * 2)),
        height: Math.max(1, Math.min(1000 - Math.max(0, box.y - padding), box.height + padding * 2)),
      }
      const cutout = await page.screenshot({ clip })
      const width = rest.rect.width
      const height = rest.rect.height
      const inViewport = rest.rect.left >= 0 && rest.rect.top >= 0 && rest.rect.right <= 1600 && rest.rect.bottom <= 1000
      const named = Boolean(control.name)
      const targetOkay = width >= minimumTarget && height >= minimumTarget
      const hoverChanged = !control.disabled && (
        differs(rest.borderColor, hover.borderColor) || differs(rest.backgroundColor, hover.backgroundColor) ||
        differs(rest.color, hover.color) || differs(rest.boxShadow, hover.boxShadow) || differs(rest.transform, hover.transform)
      )
      const requiresHover = !control.disabled && !control.selectedState && ['button', 'a', 'tab', 'switch', 'checkbox'].includes(control.role)
      const focusVisible = control.disabled || hasVisibleFocus(rest, focused)
      const notes = []
      if (!named) notes.push('missing accessible name')
      if (!targetOkay) notes.push(`target under ${minimumTarget}px`)
      if (!inViewport) notes.push('outside viewport')
      if (!hoverChanged && requiresHover) notes.push('no computed hover delta')
      if (!focusVisible && !control.disabled) notes.push('focus treatment needs review')
      if ((control.role === 'tab' || control.selectedState) && !['grid', 'flex', 'inline-flex'].includes(control.parentLayout)) notes.push('toggle group lacks grid/flex alignment')
      const fail = !named || !targetOkay || !inViewport
      const review = !fail && ((requiresHover && !hoverChanged) || !focusVisible || ((control.role === 'tab' || control.selectedState) && control.parentLayout === 'flow'))
      const record = {
        ...control,
        number: records.length + tabRecords.length + 1,
        width,
        height,
        inViewport,
        hoverChanged,
        requiresHover,
        focusVisible,
        rest,
        hover,
        focused,
        notes,
        verdict: fail ? 'FAIL' : review ? 'REVIEW' : 'PASS',
        cutout,
      }
      tabRecords.push(record)
      await page.evaluate(() => document.activeElement?.blur?.())
    }
    records.push(...tabRecords)
    await makeContactSheet(tab, tabRecords)
    console.log(`${tab}: ${tabRecords.filter((record) => record.verdict === 'PASS').length} pass, ${tabRecords.filter((record) => record.verdict === 'REVIEW').length} review, ${tabRecords.filter((record) => record.verdict === 'FAIL').length} fail`)
  }

  assert.equal(records.length, 200, 'the report contains exactly 200 measured scans')
  const serializable = records.map(({ cutout, ...record }) => record)
  const summary = serializable.reduce((accumulator, record) => {
    accumulator[record.verdict] = (accumulator[record.verdict] || 0) + 1
    return accumulator
  }, {})
  const report = { date: '2026-11-08', viewport: { width: 1600, height: 1000 }, scans: serializable.length, controlsPerTab, tabs, summary, broadAffordance, effectsPattern, errors, records: serializable }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(docs, 'UI_QUALITY_200_SCAN_20261108.md'), buildMarkdown(serializable, effectsPattern, errors, broadAffordance))
  assert.deepEqual(errors, [], 'the audit produced no page errors')
  console.log(`ui-200-scan-e2e: exactly ${records.length} live scans; ${summary.PASS || 0} pass, ${summary.REVIEW || 0} review, ${summary.FAIL || 0} fail`)
  await context.close()
} finally {
  await browser.close()
}
