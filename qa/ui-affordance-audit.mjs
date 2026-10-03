/**
 * UI Affordance Audit
 * ===================
 *
 * The overflow audit measures whether things FIT. This measures whether they
 * are USABLE — defects you cannot see as overflow:
 *
 *   TINY      an interactive control smaller than the recommended minimum
 *             target, so it is hard to hit with a mouse or impossible to hit
 *             reliably with a finger.
 *   NAMELESS  an interactive control with no accessible name, so a screen
 *             reader announces it as "button" and `getByRole` cannot find it.
 *   DUPID     the same data-testid on more than one element, which makes any
 *             test targeting it ambiguous.
 *
 * Thresholds follow WCAG 2.5.8 (Target Size Minimum): 24x24 CSS px. Anything
 * under that is reported, ranked by how far under it is.
 *
 * Usage: npx vite --host 0.0.0.0 --port 5173
 *        node qa/ui-affordance-audit.mjs [--selftest]
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const REPORTS_DIR = path.resolve('qa/reports')
fs.mkdirSync(REPORTS_DIR, { recursive: true })

const MIN_TARGET = 24

const VIEWPORTS = [{ w: 1440, h: 900, name: '1440' }, { w: 1024, h: 768, name: '1024' }]
const TABS = ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed']

/** Runs in the page. Returns affordance defects in the current UI state. */
function collectAffordance(minTarget) {
  const out = []
  const seen = new Set()
  const testidSeen = new Map()

  function pathOf(el) {
    const parts = []
    let n = el
    for (let i = 0; i < 4 && n && n !== document.body; i++) {
      const t = n.getAttribute?.('data-testid')
      parts.unshift(t ? `[${t}]` : n.tagName.toLowerCase())
      n = n.parentElement
    }
    return parts.join('>')
  }

  /** Accessible name: aria-label, aria-labelledby, title, alt, or text. */
  function accessibleName(el) {
    const al = (el.getAttribute('aria-label') || '').trim()
    if (al) return al
    const lb = el.getAttribute('aria-labelledby')
    if (lb) {
      const t = document.getElementById(lb)
      if (t && t.textContent) return t.textContent.trim()
    }
    const ti = (el.getAttribute('title') || '').trim()
    if (ti) return ti
    if (el.tagName === 'IMG') {
      const alt = (el.getAttribute('alt') || '').trim()
      if (alt) return alt
    }
    const txt = (el.textContent || '').trim()
    if (txt) return txt
    // Inputs often get their name from a sibling label or placeholder.
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      const ph = (el.getAttribute('placeholder') || '').trim()
      if (ph) return ph
      if (el.id) {
        const lab = document.querySelector(`label[for="${el.id}"]`)
        if (lab && lab.textContent) return lab.textContent.trim()
      }
    }
    return ''
  }

  function label(el) {
    const t = (el.getAttribute('data-testid') || '').trim()
    if (t) return `[testid=${t}]`
    const id = (el.id || '').trim()
    if (id) return `#${id}`
    const cls = (el.className || '')
      .toString()
      .split(/\s+/)
      .filter((c) => c && !/^(flex|grid|relative|absolute|hidden|block|w-full|h-full)$/.test(c))
      .slice(0, 3)
      .join('.')
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
    return `${el.tagName.toLowerCase()}.${cls}${txt ? ` "${txt}"` : ''}`
  }

  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [tabindex]'

  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    // Off-screen parked controls (closed drawers) are not in play.
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue

    const key = pathOf(el) + '|' + label(el)
    if (seen.has(key)) continue

    // DUPID: repeated data-testid.
    const tid = el.getAttribute('data-testid')
    if (tid) {
      testidSeen.set(tid, (testidSeen.get(tid) || 0) + 1)
    }

    // WCAG 2.5.8 counts the whole activation area. A checkbox/radio wrapped in
    // a <label> is activated by clicking anywhere on that label, so the label's
    // box -- not the bare 16px input -- is the real target. (Do NOT gate this on
    // `cursor: pointer`: this app sets `cursor: none` globally for its custom
    // cursor, so a cursor check would never match.)
    const LABELABLE = ['checkbox', 'radio']
    const isLabelable = el.tagName === 'INPUT' && LABELABLE.includes(el.type)
    const host = isLabelable ? el.closest('label') : null
    const target = host ? host.getBoundingClientRect() : r

    const isRange = el.tagName === 'INPUT' && el.type === 'range'
    const tooSmall = target.width < minTarget || target.height < minTarget
    // Range sliders are thin by design but still need a grabbable height.
    const effective = isRange ? { w: r.width, h: Math.max(r.height, 0) } : { w: r.width, h: r.height }

    const noName = !accessibleName(el) && el.tabIndex >= 0

    if ((tooSmall && !isRange) || (isRange && effective.h < 12) || noName) {
      seen.add(key)
      out.push({
        kind: noName ? 'NAMELESS' : 'TINY',
        el: label(el),
        path: pathOf(el),
        w: Math.round(target.width),
        h: Math.round(target.height),
        shortfall: Math.round(minTarget - Math.min(target.width, target.height)),
        isRange,
      })
    }
  }

  const dupes = []
  for (const [tid, n] of testidSeen) if (n > 1) dupes.push({ testid: tid, count: n })

  return { issues: out, dupes }
}

async function selftest(browser) {
  console.log('=== self-test: detector still catches known affordance defects ===')
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  await page.evaluate(() => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99999'
    const tiny = document.createElement('button')
    tiny.id = 'audit-st-tiny'
    tiny.style.cssText = 'width:10px;height:10px'
    const mute = document.createElement('button')
    mute.id = 'audit-st-nameless'
    mute.style.cssText = 'width:60px;height:30px'
    host.appendChild(tiny)
    host.appendChild(mute)
    document.body.appendChild(host)
  })
  await page.waitForTimeout(200)
  const { issues } = await page.evaluate(collectAffordance, MIN_TARGET)
  const tiny = issues.some((i) => /audit-st-tiny/.test(i.el) || /audit-st-tiny/.test(i.path))
  const mute = issues.some((i) => i.kind === 'NAMELESS' && (/audit-st-nameless/.test(i.el) || /audit-st-nameless/.test(i.path)))
  console.log(`  TINY detected     : ${tiny ? '✓' : '✗ FAIL'}`)
  console.log(`  NAMELESS detected : ${mute ? '✓' : '✗ FAIL'}`)
  await context.close()
  return tiny && mute
}

async function run() {
  console.log('=== UI Affordance Audit ===')
  try {
    await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
    process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
  } catch (e) {
    console.log('Inflate notice:', e.message)
  }

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })

  if (process.argv.includes('--selftest')) {
    const ok = await selftest(browser)
    await browser.close()
    process.exit(ok ? 0 : 1)
  }

  const all = []
  const dupes = new Map()

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    for (const tab of TABS) {
      await page.evaluate((t) => {
        const st = window.__omniframe_store?.getState?.()
        if (st) { st.setActiveCategory?.('all'); st.setLeftTab(t); st.setLeftOpen(true) }
      }, tab)
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
            el.click()
            return true
          }, sm)
          if (!ok) continue
          await page.waitForTimeout(400)
        }

        const res = await page.evaluate(collectAffordance, MIN_TARGET)
        for (const i of res.issues) all.push({ viewport: vp.name, tab, submode: sm || '(root)', ...i })
        for (const d of res.dupes) {
          const k = d.testid
          if (!dupes.has(k)) dupes.set(k, { ...d, viewports: new Set() })
          dupes.get(k).viewports.add(vp.name)
        }

        if (sm) {
          await page.evaluate(() => {
            const b = document.querySelector('[data-testid="submode-back-btn"]')
            if (b) b.click()
          })
          await page.waitForTimeout(200)
        }
      }
    }
    await context.close()
  }

  await browser.close()

  console.log('\n--- totals by kind ---')
  const byKind = {}
  for (const i of all) byKind[i.kind] = (byKind[i.kind] || 0) + 1
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k.padEnd(9)} ${v}`)

  console.log('\n--- totals by tab ---')
  const byTab = {}
  for (const i of all) byTab[i.tab] = (byTab[i.tab] || 0) + 1
  for (const [t, c] of Object.entries(byTab).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(4)}  ${t}`)
  }

  console.log(`\n--- duplicate data-testids (${dupes.size}) ---`)
  for (const d of dupes.values()) console.log(`  ${String(d.count).padStart(3)}x  ${d.testid}  [${[...d.viewports].join(',')}]`)

  console.log('\n--- worst targets (smallest first, deduped) ---')
  const uniq = new Map()
  for (const i of all) {
    const k = i.path + '|' + i.el
    if (!uniq.has(k) || i.shortfall > uniq.get(k).shortfall) uniq.set(k, i)
  }
  const rows = [...uniq.values()].sort((a, b) => b.shortfall - a.shortfall)
  for (const r of rows.slice(0, 30)) {
    console.log(`  ${r.kind.padEnd(9)} ${String(r.w).padStart(3)}x${String(r.h).padStart(3)} (need ${MIN_TARGET}, short ${r.shortfall})  ${r.el}`)
    console.log(`            ${r.path}`)
  }

  const reportPath = path.join(REPORTS_DIR, 'ui-affordance-audit.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ totals: { issues: all.length, unique: rows.length, dupes: dupes.size }, byKind, byTab, duplicates: [...dupes.values()].map((d) => ({ ...d, viewports: [...d.viewports] })), unique: rows, all }, null, 2),
  )
  console.log(`\nWrote ${reportPath}  (${all.length} instances, ${rows.length} unique, ${dupes.size} dup testids)`)
}

run()
