/**
 * UI density audit.
 *
 * Finds panels that are too wordy or too crowded, and says *how* to fix each
 * one: split into a new collapsible section, replace prose with a purpose-built
 * control, or switch the flex direction.
 *
 * Every rule ships a fixture in --selftest mode that is guaranteed to trip it,
 * so a green run means the rule works, not that it quietly matched nothing.
 *
 * Usage:
 *   node qa/ui-density-audit.mjs            # full sweep (needs a dev server)
 *   node qa/ui-density-audit.mjs --selftest # prove every rule fires
 */

import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { seedProject } from './seed-project.mjs'

const ROOT = process.cwd()
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const REPORTS_DIR = path.resolve('qa/reports')
fs.mkdirSync(REPORTS_DIR, { recursive: true })

const VIEWPORTS = [
  { w: 1440, h: 900, name: '1440' },
  { w: 1280, h: 800, name: '1280' },
  { w: 1024, h: 768, name: '1024' },
  { w: 390, h: 844, name: '390-mobile' },
]
const TABS = ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed', 'rigging']

// Thresholds live here rather than being sprinkled through the collector so
// they can be tuned in one place and quoted in the report.
const T = {
  WALL_CHARS: 420,      // container text beyond this is a wall
  WALL_RUNS: 8,         // ...when it is also split across this many runs
  BLURB_CHARS: 170,     // a single text block this long needs a home of its own
  CROWDED_ROW_KIDS: 6,  // a row with this many children is cramped
  CRAMPED_CHILD_W: 64,  // ...especially when each child is narrower than this
  LABEL_OVERLOAD: 10,   // this many labels in one container is a form, not a panel
  TINY_TEXT: 12,        // this many <=10px runs in one container is clutter
  DENSITY_PER_1K: 14,   // chars per 1000px^2
}

const RULES = [
  ['D01', 'Wall of text', 'Split into a new collapsible section'],
  ['D02', 'Long blurb in a control row', 'Move to a section body / tooltip, or replace with a purpose-built control'],
  ['D03', 'Crowded flex row', 'Switch to flex-col, or allow wrapping'],
  ['D04', 'Column of cramped children', 'Switch to flex-row / grid'],
  ['D05', 'Label overload', 'Group into a sub-section or a custom control'],
  ['D06', 'Tiny-text clutter', 'Promote to a list, or drop the micro-copy'],
  ['D07', 'Clipped text', 'Widen, wrap, or shorten'],
  ['D08', 'High text density per area', 'Give the copy more room or trim it'],
]

// ---------------------------------------------------------------------------
// in-page collector
// ---------------------------------------------------------------------------

function collectDensity(thresholds) {
  const cands = []
  const T = thresholds

  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }

  /** Identity: prefer a real id, then data-testid, then a structural path. */
  const identify = (el) => {
    if (el.id) return '#' + el.id
    const dt = el.getAttribute && el.getAttribute('data-testid')
    if (dt) return '[data-testid="' + dt + '"]'
    const parts = []
    let n = el
    for (let i = 0; i < 4 && n && n.tagName; i++) {
      let seg = n.tagName.toLowerCase()
      if (n.id) { parts.unshift('#' + n.id); break }
      const sib = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : []
      if (sib.length > 1) seg += `:nth-of-type(${sib.indexOf(n) + 1})`
      parts.unshift(seg)
      n = n.parentElement
    }
    return parts.join(' > ')
  }

  /** Text that a user actually reads: skips scripts, styles and sr-only. */
  const ownText = (el) => {
    let s = ''
    for (const node of el.childNodes) {
      if (node.nodeType === 3) s += node.nodeValue || ''
    }
    return s.trim()
  }

  const textRuns = (el) => {
    const runs = []
    const walk = (n) => {
      for (const node of n.childNodes) {
        if (node.nodeType !== 1) continue
        const cs = getComputedStyle(node)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        if (['SCRIPT', 'STYLE', 'SVG', 'CANVAS'].includes(node.tagName)) continue
        // sr-only text is not read on screen, so it must not count as density.
        const r = node.getBoundingClientRect()
        if (r.width <= 1 || r.height <= 1) continue
        const t = ownText(node)
        if (t) runs.push({ el: node, text: t, size: parseFloat(cs.fontSize) || 12, rect: r })
        walk(node)
      }
    }
    walk(el)
    return runs
  }

  const containers = Array.from(document.querySelectorAll('body *')).filter((el) => {
    if (['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION'].includes(el.tagName)) return false
    return visible(el)
  })

  for (const el of containers) {
    const runs = textRuns(el)
    if (!runs.length) continue
    const chars = runs.reduce((n, r) => n + r.text.length, 0)
    const rect = el.getBoundingClientRect()
    const area = Math.max(1, rect.width * rect.height)
    const cs = getComputedStyle(el)

    // --- D01 wall of text -------------------------------------------------
    if (chars >= T.WALL_CHARS && runs.length >= T.WALL_RUNS) {
      cands.push({ live: el, metric: chars,
        rule: 'D01', el: identify(el), chars, runs: runs.length,
        preview: runs.slice(0, 3).map((r) => r.text.slice(0, 40)).join(' | '),
        detail: `${chars} chars across ${runs.length} runs`,
      })
    }

    // --- D02 long blurb ---------------------------------------------------
    for (const r of runs) {
      if (r.text.length >= T.BLURB_CHARS) {
        cands.push({ live: r.el, metric: r.text.length,
          rule: 'D02', el: identify(r.el), chars: r.text.length, runs: 1,
          preview: r.text.slice(0, 60), detail: `${r.text.length}-char unbroken block`,
        })
      }
    }

    // --- D03 crowded flex row --------------------------------------------
    const kids = Array.from(el.children).filter((c) => visible(c))
    if (kids.length >= T.CROWDED_ROW_KIDS) {
      const isRow = cs.display === 'flex' && (cs.flexDirection === 'row' || cs.flexDirection === 'row-reverse')
      const isGrid = cs.display === 'grid'
      if (isRow || isGrid) {
        const tops = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top)))
        const avgW = kids.reduce((n, k) => n + k.getBoundingClientRect().width, 0) / kids.length
        // A grid is *supposed* to span several rows: grid-cols-3 with six
        // items giving two lines is correct by design, not a defect. Only
        // cramped children are a problem there.
        //
        // For flex, wrapping is only unintended when the author asked for
        // nowrap and the content spilled anyway, or when children are too
        // small to hit. Deliberate flex-wrap is not a defect either.
        const lines = tops.size
        let problem = null
        if (avgW < T.CRAMPED_CHILD_W) {
          problem = `avg child ${Math.round(avgW)}px — too cramped, use flex-col or fewer columns`
        } else if (isRow && lines > 1 && cs.flexWrap === 'nowrap') {
          problem = `nowrap row spilling onto ${lines} lines — use flex-col or flex-wrap`
        }
        if (problem) {
          cands.push({ live: el, metric: kids.length,
            rule: 'D03', el: identify(el), chars, runs: kids.length,
            preview: `${kids.length} children, avg ${Math.round(avgW)}px wide, ${lines} line(s)`,
            detail: problem,
          })
        }
      }
    }

    // --- D04 column of cramped children ----------------------------------
    if (cs.display === 'flex' && cs.flexDirection === 'column' && kids.length >= 5) {
      const avgH = kids.reduce((n, k) => n + k.getBoundingClientRect().height, 0) / kids.length
      // A tall stack of very short children wastes the horizontal space.
      if (avgH < 40 && rect.width > 320) {
        cands.push({ live: el, metric: kids.length,
          rule: 'D04', el: identify(el), chars, runs: kids.length,
          preview: `${kids.length} children stacked, avg ${Math.round(avgH)}px tall`,
          detail: `${Math.round(rect.width)}px wide with ${Math.round(avgH)}px rows — use a row or grid`,
        })
      }
    }

    // --- D05 label overload ----------------------------------------------
    const labels = Array.from(el.querySelectorAll(':scope > * label, :scope > label')).filter(visible)
    if (labels.length >= T.LABEL_OVERLOAD) {
      cands.push({ live: el, metric: labels.length,
        rule: 'D05', el: identify(el), chars, runs: labels.length,
        preview: labels.slice(0, 3).map((l) => (l.textContent || '').trim().slice(0, 20)).join(' | '),
        detail: `${labels.length} labels in one container`,
      })
    }

    // --- D06 tiny-text clutter -------------------------------------------
    const tiny = runs.filter((r) => r.size <= 10)
    if (tiny.length >= T.TINY_TEXT) {
      cands.push({ live: el, metric: tiny.length,
        rule: 'D06', el: identify(el), chars, runs: tiny.length,
        preview: tiny.slice(0, 3).map((r) => r.text.slice(0, 24)).join(' | '),
        detail: `${tiny.length} runs at <=10px`,
      })
    }

    // --- D07 clipped text -------------------------------------------------
    // Measured on the clipping container, not the run: an inline <span> has
    // clientWidth 0, so testing the run itself never fires.
    {
      const o = cs.overflow + cs.overflowX
      if ((o.includes('hidden') || o.includes('clip')) && el.clientWidth > 0) {
        if (el.scrollWidth > el.clientWidth + 2) {
          const shown = runs.map((r) => r.text).join(' ').trim()
          if (shown) {
            cands.push({ live: el, metric: shown.length,
              rule: 'D07', el: identify(el), chars: shown.length, runs: runs.length,
              preview: shown.slice(0, 40),
              detail: `${el.scrollWidth}px of text in ${el.clientWidth}px`,
            })
          }
        }
      }
    }

    // --- D08 density per area --------------------------------------------
    const per1k = chars / (area / 1000)
    if (per1k >= T.DENSITY_PER_1K && chars >= 90) {
      cands.push({ live: el, metric: per1k,
        rule: 'D08', el: identify(el), chars, runs: runs.length,
        preview: `${per1k.toFixed(1)} chars per 1000px²`,
        detail: `${chars} chars in ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      })
    }
  }

  // Collapse ancestor chains. D01/D05/D06/D08 all accumulate up the tree, so a
  // single dense panel would otherwise be reported once per ancestor and
  // inflate the count. A container is dropped when one descendant already
  // accounts for essentially all of it; if the content is spread across several
  // siblings, no single descendant explains it and the parent is kept.
  const AGGREGATE = new Set(['D01', 'D05', 'D06', 'D08'])
  const out = []
  for (const c of cands) {
    if (!AGGREGATE.has(c.rule)) { out.push(c); continue }
    let explainedByChild = false
    for (const other of cands) {
      if (other === c || other.rule !== c.rule) continue
      if (other.live === c.live || !c.live.contains(other.live)) continue
      if (other.metric >= c.metric * 0.9) { explainedByChild = true; break }
    }
    if (!explainedByChild) out.push(c)
  }

  // The live element reference must not cross the page boundary.
  return out.map(({ live: _live, metric: _m, ...rest }) => rest)
}

// ---------------------------------------------------------------------------
// self-test: every rule must fire on a fixture built to trip it
// ---------------------------------------------------------------------------

async function selftest(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // Fixtures are labelled by id, so a failure names the element rather than a
  // class that five panels share.
  const FIXTURES = `
    <div id="fx-root" style="padding:40px;background:#111;color:#fff;font-family:sans-serif">
      <!-- D01: a wall of text -->
      <div id="d01-wall" style="width:400px">
        ${Array.from({ length: 12 }, (_, i) => `<span>This is text run number ${i} in a dense panel full of words and more words and yet more words.</span>`).join('')}
      </div>

      <!-- D02: one long unbroken blurb, held directly so the fixture is the element -->
      <div id="d02-blurb" style="width:400px">This is a single very long paragraph of explanatory copy that goes on and on without ever breaking up into a list or a section of its own, which is exactly the situation this rule is designed to catch for the user.</div>

      <!-- D03: a crowded row -->
      <div id="d03-row" style="display:flex;flex-direction:row;width:400px">
        ${Array.from({ length: 8 }, (_, i) => `<button style="min-width:20px">B${i}</button>`).join('')}
      </div>

      <!-- D04: a column of very short children in a wide box -->
      <div id="d04-col" style="display:flex;flex-direction:column;width:600px">
        ${Array.from({ length: 8 }, (_, i) => `<div style="height:16px">row ${i}</div>`).join('')}
      </div>

      <!-- D05: label overload -->
      <div id="d05-labels" style="display:flex;flex-direction:column;width:400px">
        ${Array.from({ length: 12 }, (_, i) => `<label>Label ${i}</label>`).join('')}
      </div>

      <!-- D06: tiny text clutter -->
      <div id="d06-tiny" style="width:400px">
        ${Array.from({ length: 14 }, (_, i) => `<span style="font-size:9px">tiny ${i}</span>`).join('')}
      </div>

      <!-- D07: clipped text -->
      <div id="d07-clip" style="width:80px;overflow:hidden;white-space:nowrap">
        <span>This sentence is far too long to ever fit inside eighty pixels.</span>
      </div>

      <!-- D08: high density per area -->
      <div id="d08-dense" style="width:120px;height:40px;overflow:hidden;font-size:10px">
        ${Array.from({ length: 30 }, () => `<span>word </span>`).join('')}
      </div>
    </div>
  `

  await page.setContent(`<html><body>${FIXTURES}</body></html>`)
  await page.waitForTimeout(200)

  const res = await page.evaluate(collectDensity, T)
  const hit = new Set(res.map((r) => r.rule))
  const byEl = new Map(res.map((r) => [r.el, r.rule]))

  let allOk = true
  console.log('=== density self-test ===')
  for (const [id, title, fix] of RULES) {
    // Each rule must fire, and must fire on its own fixture element.
    const fixture = '#d' + id.slice(1) + '-' + { D01: 'wall', D02: 'blurb', D03: 'row', D04: 'col', D05: 'labels', D06: 'tiny', D07: 'clip', D08: 'dense' }[id]
    const fired = hit.has(id)
    // The rule reports the element that actually holds the offending text,
    // which may be a descendant of the fixture. Accept either.
    const onFixture = res.some((r) => r.rule === id && (r.el === fixture || r.el.startsWith(fixture + ' > ')))
    const ok = fired && onFixture
    if (!ok) allOk = false
    console.log(
      `  ${ok ? '✓' : '✗'} ${id} ${title} — ${fix}` +
        (!fired ? '  [RULE DID NOT FIRE]' : onFixture ? '' : `  [fired, but not on ${fixture}]`),
    )
  }

  // A clean container must stay clean, or the rules are just noise.
  await page.setContent(`<html><body><div id="clean" style="padding:20px;font-family:sans-serif">
    <div style="width:400px"><span>Short label</span><button>Go</button></div>
    <div style="width:400px"><p>A brief sentence.</p></div>
  </div></body></html>`)
  await page.waitForTimeout(150)
  const clean = await page.evaluate(collectDensity, T)
  const cleanOk = !clean.some((c) => c.rule !== 'D02')
  if (!cleanOk) allOk = false
  console.log(`  ${cleanOk ? '✓' : '✗'} clean panel produces no D01/D03-D08 findings`)

  await page.close()
  return allOk
}

// ---------------------------------------------------------------------------
// sweep
// ---------------------------------------------------------------------------

async function run() {
  console.log('=== UI Density Audit ===')
  try {
    await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
    process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
  } catch (e) { /* already inflated */ }

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  if (process.argv.includes('--selftest')) {
    const ok = await selftest(browser)
    await browser.close()
    console.log(ok ? '\nself-test: PASS' : '\nself-test: FAIL')
    process.exit(ok ? 0 : 1)
  }

  const all = []
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', () => {})
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    await seedProject(page)
    await page.waitForTimeout(1200)

    for (const tab of TABS) {
      await page.evaluate(({ t, w }) => {
        const st = window.__omniframe_store?.getState?.()
        if (!st) return
        st.setActiveCategory?.('all')
        st.setLeftTab(t)
        const allowOpen = w >= 1080
        st.setLeftOpen(allowOpen)
        st.setRightOpen?.(allowOpen)
      }, { t: tab, w: vp.w })
      await page.waitForTimeout(450)

      const sections = await page.evaluate(() => {
        const ids = []
        for (const el of document.querySelectorAll('[data-testid^="omniframe-section-"], [data-testid$="-submode-btn"]')) {
          const id = el.getAttribute('data-testid')
          if (id && id !== 'omniframe-section-nav') ids.push(id)
        }
        return Array.from(new Set(ids))
      })

      for (const sm of [null, ...sections]) {
        if (sm) {
          const ok = await page.evaluate((sel) => {
            const el = document.querySelector(`[data-testid="${sel}"]`)
            if (!el) return false
            el.click(); return true
          }, sm)
          if (!ok) continue
          await page.waitForTimeout(420)
        }
        const res = await page.evaluate(collectDensity, T)
        for (const i of res) all.push({ viewport: vp.name, tab, submode: sm || '(root)', ...i })
        if (sm) {
          await page.evaluate(() => {
            const b = document.querySelector('[data-testid="submode-back-btn"]')
            if (b) b.click()
          })
          await page.waitForTimeout(220)
        }
      }
    }
    await context.close()
  }

  await browser.close()

  // Collapse to root causes: the same element flagged at 4 viewports is one
  // defect, not four. Reporting both numbers keeps the raw count honest.
  const byRule = new Map()
  for (const i of all) {
    const key = i.rule + '|' + i.el + '|' + i.tab + '|' + i.submode
    if (!byRule.has(key)) byRule.set(key, { ...i, viewports: new Set() })
    byRule.get(key).viewports.add(i.viewport)
  }
  const roots = [...byRule.values()].map((i) => ({ ...i, viewports: [...i.viewports].join(',') }))

  console.log(`\nraw findings: ${all.length}   root causes: ${roots.length}`)
  console.log('\nby rule:')
  for (const [id, title, fix] of RULES) {
    const n = roots.filter((r) => r.rule === id).length
    console.log(`  ${id} ${title.padEnd(32)} ${String(n).padStart(4)}   -> ${fix}`)
  }

  console.log('\nby panel (tab):')
  const byTab = new Map()
  for (const r of roots) byTab.set(r.tab, (byTab.get(r.tab) || 0) + 1)
  for (const [tab, n] of [...byTab.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tab.padEnd(16)} ${n}`)
  }

  console.log('\nworst offenders:')
  for (const r of roots
    .sort((a, b) => (b.chars || 0) - (a.chars || 0))
    .slice(0, 25)) {
    console.log(`  [${r.rule}] ${r.tab}/${r.submode} ${r.el}`)
    console.log(`      ${r.detail}  (${r.viewports})`)
    if (r.preview) console.log(`      "${String(r.preview).slice(0, 90)}"`)
  }

  const reportPath = path.join(REPORTS_DIR, 'ui-density.json')
  fs.writeFileSync(reportPath, JSON.stringify({ thresholds: T, rules: RULES, raw: all.length, roots }, null, 2))
  console.log(`\nwrote ${reportPath}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
