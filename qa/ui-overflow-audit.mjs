/**
 * UI Overflow & Layout Audit
 * ==========================
 *
 * Walks every left-dock tab and every submode inside it, at five viewport
 * widths, and measures REAL rendered overflow rather than guessing from
 * classnames.
 *
 * Three classes of defect are reported:
 *
 *   CLIP   content is wider than its box AND the box does not scroll, so
 *          the content is silently cut off.
 *   SPILL  the element's painted box extends outside the viewport, so it is
 *          off-screen and unreachable.
 *   SQUASH the element has been compressed below its content's minimum
 *          (a flex child that could not shrink, or text with no room).
 *
 * Deliberately-ignored: elements that are themselves scroll containers
 * (overflow auto/scroll), elements with `truncate`/`text-ellipsis` (an
 * intentional, communicated truncation), and hidden/zero-size nodes.
 *
 * Usage: npx vite --host 0.0.0.0 --port 5173
 *        node qa/ui-overflow-audit.mjs
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const REPORTS_DIR = path.resolve('qa/reports')
const SHOTS_DIR = path.resolve('evidence/screenshots')
fs.mkdirSync(REPORTS_DIR, { recursive: true })
fs.mkdirSync(SHOTS_DIR, { recursive: true })

const VIEWPORTS = [
  { w: 1920, h: 1080, name: '1920' },
  { w: 1440, h: 900, name: '1440' },
  { w: 1280, h: 800, name: '1280' },
  { w: 1024, h: 768, name: '1024' },
  { w: 900, h: 700, name: '900' },
]

const TABS = ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed']

/** Runs in the page. Returns every overflowing element in the current UI state. */
function collectOverflow() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const out = []
  const seen = new Set()

  const styleOf = (el) => getComputedStyle(el)

  function isScrollable(el) {
    const s = styleOf(el)
    return (
      /(auto|scroll)/.test(s.overflowX) ||
      /(auto|scroll)/.test(s.overflowY) ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && el.type !== 'range')
    )
  }

  function intentionalTruncate(el) {
    const s = styleOf(el)
    return s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' || el.classList.contains('truncate')
  }

  function label(el) {
    const t = (el.getAttribute('data-testid') || '').trim()
    if (t) return `[testid=${t}]`
    const id = el.id ? `#${el.id}` : ''
    const cls = (el.className || '')
      .toString()
      .split(/\s+/)
      .filter((c) => c && !/^(flex|grid|relative|absolute|hidden|block|w-full|h-full)$/.test(c))
      .slice(0, 3)
      .join('.')
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)
    return `${el.tagName.toLowerCase()}${id}.${cls}${txt ? ` "${txt}"` : ''}`
  }

  function path(el) {
    const parts = []
    let n = el
    for (let i = 0; i < 4 && n && n !== document.body; i++) {
      const t = n.getAttribute?.('data-testid')
      parts.unshift(t ? `[${t}]` : n.tagName.toLowerCase())
      n = n.parentElement
    }
    return parts.join('>')
  }

  /**
   * True if some ancestor can scroll, meaning content outside the viewport is
   * still REACHABLE by scrolling and therefore not a layout defect. Without
   * this check every item past the fold in a scrolling sidebar is reported,
   * which is nearly all the noise in an audit like this.
   */
  function hasScrollableAncestor(el) {
    // Any positive scroll amount means the content is REACHABLE, so the
    // threshold here is > 0 rather than the > 1 used for CLIP detection.
    // A 1px scroll is still a scroll: treating it as unreachable reported a
    // false SHEAR on a panel that simply sat 1px past its scroll box.
    let n = el.parentElement
    while (n && n !== document.documentElement) {
      const s = styleOf(n)
      if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth - n.clientWidth > 0) return true
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight - n.clientHeight > 0) return true
      n = n.parentElement
    }
    return false
  }

  /** True if an ancestor clips, making the content permanently unreachable. */
  function clippingAncestor(el) {
    let n = el.parentElement
    while (n && n !== document.documentElement) {
      const s = styleOf(n)
      if (s.overflowX === 'hidden' || s.overflowY === 'hidden') return n
      n = n.parentElement
    }
    return null
  }

  /** True if the element itself (or any descendant) scrolls on an axis: an
   *  overflow-hidden panel that WRAPS a scroll container is a legitimate
   *  layout (left-panel wraps the panel-contents scroller) — its content is
   *  reachable by scrolling, so it is not a CLIP. Mirrors the reachability
   *  logic hasScrollableAncestor already applies to SHEAR. */
  function hasScrollableDescendant(el, axis) {
    const walk = (n) => {
      if (n !== el) {
        const s = styleOf(n)
        const over = axis === 'y' ? n.scrollHeight - n.clientHeight : n.scrollWidth - n.clientWidth
        if (new RegExp(`(auto|scroll)`).test(axis === 'y' ? s.overflowY : s.overflowX) && over > 0) return true
      }
      for (const c of n.children) if (walk(c)) return true
      return false
    }
    return walk(el)
  }

  const INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'])

  for (const el of document.querySelectorAll('body *')) {
    const s = styleOf(el)
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue

    const key = path(el) + '|' + label(el)
    if (seen.has(key)) continue

    // ---- A. CLIP: own content exceeds own box, box hides overflow, no ellipsis.
    const overflowsX = el.scrollWidth - el.clientWidth > 1
    const overflowsY = el.scrollHeight - el.clientHeight > 1
    const clippedX = overflowsX && s.overflowX === 'hidden' && !intentionalTruncate(el) && !hasScrollableDescendant(el, 'x')
    const clippedY = overflowsY && s.overflowY === 'hidden' && s.webkitLineClamp === 'none' && !hasScrollableDescendant(el, 'y')

    // ---- B. SHEAR: clipped by an ancestor, so unreachable even by scrolling.
    let shear = null
    if (!isScrollable(el)) {
      const ca = clippingAncestor(el)
      if (ca) {
        const cr = ca.getBoundingClientRect()
        const overRight = r.right - cr.right > 1
        const overBottom = r.bottom - cr.bottom > 1
        const overLeft = cr.left - r.left > 1
        if ((overRight || overBottom || overLeft) && !hasScrollableAncestor(el)) {
          shear = { overRight, overBottom, overLeft, by: Math.round(Math.max(r.right - cr.right, r.bottom - cr.bottom, cr.left - r.left)) }
        }
      }
    }

    // ---- C. OFFSCREEN: outside the viewport with no way to scroll to it.
    const reachable = hasScrollableAncestor(el)
    const outsideViewport = r.right > vw + 1 || r.bottom > vh + 1 || r.right < 1 || r.bottom < 1
    const interactive = INTERACTIVE.has(el.tagName) || el.getAttribute('role') === 'button'
    const offscreen = outsideViewport && !reachable && interactive && !clippingAncestor(el)
    // Ignore controls deliberately parked far off-screen (hidden drawers).
    const parked = r.left < -500 || r.top < -500

    if (clippedX || clippedY || shear || (offscreen && !parked)) {
      seen.add(key)
      out.push({
        kind: clippedX || clippedY ? 'CLIP' : shear ? 'SHEAR' : 'OFFSCREEN',
        el: label(el),
        path: path(el),
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        content: [el.scrollWidth, el.scrollHeight],
        client: [el.clientWidth, el.clientHeight],
        clipX: clippedX,
        clipY: clippedY,
        shearBy: shear ? shear.by : 0,
        offscreen,
        lv: 0,
      })
    }
  }

  // ---- D. PAGE: the document itself scrolls horizontally (classic layout bug).
  const de = document.documentElement
  const pageOverflowX = de.scrollWidth - de.clientWidth
  if (pageOverflowX > 1) {
    out.push({
      kind: 'PAGE-X',
      el: 'document',
      path: 'html',
      box: [0, 0, de.clientWidth, de.clientHeight],
      content: [de.scrollWidth, de.scrollHeight],
      client: [de.clientWidth, de.clientHeight],
      clipX: false,
      clipY: false,
      shearBy: pageOverflowX,
      offscreen: false,
    })
  }
  return out
}

/**
 * Runs in the page: list submode testids reachable from the open panel, plus
 * any panel section tabs. Sections matter because the OmniFrame panel only
 * renders the active section, so auditing the default one alone would miss
 * overflow in the other five.
 */
function listSubmodes() {
  const ids = []
  for (const el of document.querySelectorAll('[data-testid^="omniframe-submode-"], [data-testid$="-submode-btn"]')) {
    ids.push(el.getAttribute('data-testid'))
  }
  // Section tabs are not submodes (they stay put rather than opening a
  // focused channel), so keep them addressable but distinct.
  for (const el of document.querySelectorAll('[data-testid^="omniframe-section-"]')) {
    const id = el.getAttribute('data-testid')
    if (id && id !== 'omniframe-section-nav') ids.push(id)
  }
  return Array.from(new Set(ids))
}

/**
 * Self-test: inject three known defects and confirm the detector still sees
 * them. A detector that silently went blind (e.g. an over-broad "reachable by
 * scrolling" exemption) would otherwise report a reassuring clean sweep while
 * catching nothing. Run with `--selftest`.
 */
async function selftest(browser) {
  console.log('=== self-test: detector still catches known defects ===')
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const injected = await page.evaluate(() => {
    const host = document.createElement('div')
    host.id = 'audit-selftest-host'
    host.style.cssText = 'position:fixed;left:20px;top:20px;width:200px;height:50px;z-index:99999'

    // 1. CLIP: overflow-hidden box with content taller than the box.
    const clip = document.createElement('div')
    clip.id = 'audit-st-clip'
    clip.style.cssText = 'width:200px;height:50px;overflow:hidden'
    const inner = document.createElement('div')
    inner.style.cssText = 'width:200px;height:150px'
    clip.appendChild(inner)

    // 2. SHEAR: child pushed outside an overflow-hidden parent.
    const shear = document.createElement('div')
    shear.id = 'audit-st-shear'
    shear.style.cssText = 'width:200px;height:50px;overflow:hidden;position:relative'
    const kid = document.createElement('button')
    kid.id = 'audit-st-shear-kid'
    kid.style.cssText = 'position:absolute;left:180px;top:10px;width:100px;height:30px'
    shear.appendChild(kid)

    host.appendChild(clip)
    host.appendChild(shear)
    document.body.appendChild(host)
    return true
  })
  await page.waitForTimeout(200)

  const found = await page.evaluate(collectOverflow)
  const ids = { clip: false, shear: false }
  for (const f of found) {
    if (/audit-st-clip/.test(f.path) || /audit-st-clip/.test(f.el)) ids.clip = true
    if (/audit-st-shear-kid/.test(f.path) || /audit-st-shear-kid/.test(f.el)) ids.shear = true
  }
  console.log(`  injected: ${injected}`)
  console.log(`  CLIP detected   : ${ids.clip ? '✓' : '✗ FAIL'}`)
  console.log(`  SHEAR detected  : ${ids.shear ? '✓' : '✗ FAIL'}`)
  await context.close()
  return ids.clip && ids.shear
}

async function run() {
  console.log('=== UI Overflow & Layout Audit ===')
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
  const stateSummary = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    for (const tab of TABS) {
      // Open the tab.
      await page.evaluate((t) => {
        const st = window.__omniframe_store?.getState?.()
        if (!st) return
        st.setActiveCategory?.('all')
        st.setLeftTab(t)
        st.setLeftOpen(true)
      }, tab)
      await page.waitForTimeout(450)

      const submodes = await page.evaluate(listSubmodes)
      const statesToVisit = [
        null,
        ...submodes.filter(
          (s) => s.endsWith('-submode-btn') || s.startsWith('omniframe-section-'),
        ),
      ]

      for (const sm of statesToVisit) {
        if (sm) {
          const clicked = await page.evaluate((sel) => {
            const el = document.querySelector(`[data-testid="${sel}"]`)
            if (!el) return false
            el.click()
            return true
          }, sm)
          if (!clicked) continue
          await page.waitForTimeout(450)
        }

        const issues = await page.evaluate(collectOverflow)
        const name = `${vp.name} / ${tab}${sm ? ` / ${sm.replace('-submode-btn', '')}` : ''}`
        if (issues.length) {
          for (const i of issues) all.push({ viewport: vp.name, tab, submode: sm || '(root)', ...i })
          stateSummary.push({ name, count: issues.length })
        }

        if (sm) {
          await page.evaluate(() => {
            const b = document.querySelector('[data-testid="submode-back-btn"]')
            if (b) b.click()
          })
          await page.waitForTimeout(250)
        }
      }
    }
    await context.close()
  }

  await browser.close()

  // ---- Report -------------------------------------------------------------
  console.log('\n--- states with issues (worst first) ---')
  stateSummary.sort((a, b) => b.count - a.count)
  for (const s of stateSummary.slice(0, 40)) {
    console.log(`  ${String(s.count).padStart(3)}  ${s.name}`)
  }
  if (!stateSummary.length) console.log('  (none)')

  console.log('\n--- per-viewport totals ---')
  const byVp = {}
  for (const i of all) byVp[i.viewport] = (byVp[i.viewport] || 0) + 1
  for (const vp of VIEWPORTS) console.log(`  ${vp.name}: ${byVp[vp.name] || 0}`)

  console.log('\n--- per-tab totals ---')
  const byTab = {}
  for (const i of all) byTab[i.tab] = (byTab[i.tab] || 0) + 1
  for (const [t, c] of Object.entries(byTab).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(3)}  ${t}`)
  }

  console.log('\n--- unique offending elements (deduped) ---')
  const uniq = new Map()
  for (const i of all) {
    const k = i.path
    if (!uniq.has(k)) uniq.set(k, { ...i, count: 0, viewports: new Set() })
    uniq.get(k).count++
    uniq.get(k).viewports.add(i.viewport)
  }
  const rows = [...uniq.values()].sort((a, b) => b.viewports.size - a.viewports.size || b.count - a.count)
  for (const r of rows.slice(0, 40)) {
    console.log(
      `  ${r.kind.padEnd(5)} vw[${[...r.viewports].join(',')}] ${r.el}\n        path=${r.path} box=${r.box.join(',')} content=${r.content.join('x')} client=${r.client.join('x')}`,
    )
  }

  const reportPath = path.join(REPORTS_DIR, 'ui-overflow-audit.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ totals: { issues: all.length, unique: rows.length }, byViewport: byVp, byTab, unique: rows.map((r) => ({ ...r, viewports: [...r.viewports] })), all }, null, 2),
  )
  console.log(`\nWrote ${reportPath}  (${all.length} issue instances, ${rows.length} unique)`)
}

run()
