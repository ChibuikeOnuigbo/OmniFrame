/**
 * UI Strict Audit
 * ===============
 *
 * A broad, multi-rule sweep that looks for defects the two narrow audits
 * cannot see. Where the overflow audit asks "does it fit?" and the affordance
 * audit asks "can you hit it and name it?", this asks the questions a careful
 * human reviewer would ask while actually using the app:
 *
 *   A*  accessibility  - keyboard reach, labels, focus, semantics
 *   K*  keyboard       - tab order, escape hatches
 *   D*  density        - too much UI in one place (the thing you regroup)
 *   C*  consistency    - the same idea expressed a different way
 *   R*  robustness     - unbounded inputs, missing guards, dead ends
 *   T*  copy           - labels that mislead, truncate or contradict
 *
 * Every finding carries the rule id, a severity, the element and the measured
 * evidence, so a finding can be argued with rather than taken on faith.
 *
 * Usage: npx vite --host 0.0.0.0 --port 5173
 *        node qa/ui-strict-audit.mjs [--selftest]
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
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
const TABS = ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed']

// Overlays and secondary surfaces that are closed by default and therefore
// invisible to a plain tab walk. Each tries to open something; the audit runs
// whether or not it succeeds, so a surface that fails to open is itself a
// finding rather than a silent gap.
const OVERLAYS = [
  { name: '(none)', open: null },
  { name: 'graph-editor', open: () => { window.__omniframe_store?.getState?.()?.setGraphEditorOpen?.(true) } },
  { name: 'right-panel', open: () => { window.__omniframe_store?.getState?.()?.setRightOpen?.(true) } },
  { name: 'voice-modal', open: () => { const st = window.__omniframe_store?.getState?.(); const c = st?.clips?.[0]; st?.setVoiceModal?.({ open: true, clipId: c?.id }) } },
  { name: 'curve-editor', open: () => { document.querySelector('[data-testid^="open-curve-"]')?.click() } },
  { name: 'compound-inspector', open: () => { document.querySelector('[data-testid="inspector-open-compound-btn"]')?.click() } },
  { name: 'voice-isolation', open: () => { document.querySelector('[data-testid="audio-voice-isolation-checkbox"]')?.click() } },
]

/** Runs in the page. Returns every rule violation for the current UI state. */
function collectStrict() {
  const out = []
  const push = (rule, sev, el, evidence) => {
    out.push({ rule, sev, el: describe(el), evidence: String(evidence).slice(0, 160) })
  }

  function describe(el) {
    const t = (el.getAttribute && el.getAttribute('data-testid') || '').trim()
    const id = (el.id || '').trim()
    if (t) return `[testid=${t}]${id ? `#${id}` : ''}`
    if (id) return `#${id}`
    const cls = (el.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }

  const vis = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width >= 1 && r.height >= 1
  }

  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [tabindex]'
  const controls = [...document.querySelectorAll(INTERACTIVE)].filter(vis)

  const nameOf = (el) => {
    const al = (el.getAttribute('aria-label') || '').trim()
    if (al) return al
    const ti = (el.getAttribute('title') || '').trim()
    if (ti) return ti
    const txt = (el.textContent || '').trim()
    if (txt) return txt
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      const ph = (el.getAttribute('placeholder') || '').trim()
      if (ph) return ph
    }
    return ''
  }

  // ---- A: accessibility -------------------------------------------------

  // A01 icon-only control with an accessible name but no visual tooltip:
  // a sighted mouse user hovering it gets nothing.
  for (const el of controls) {
    if (el.tagName !== 'BUTTON') continue
    const txt = (el.textContent || '').trim()
    const hasIcon = !!el.querySelector('svg, img')
    const al = (el.getAttribute('aria-label') || '').trim()
    const ti = (el.getAttribute('title') || '').trim()
    // A tooltip may be provided by the <Tooltip> component rather than the
    // native title attribute; its trigger is wrapped in [data-of-tooltip].
    const wrapped = !!el.closest('[data-of-tooltip]')
    if (hasIcon && !txt && al && !ti && !wrapped)
      push('A01', 'low', el, 'icon-only, aria-label but no title -> no hover tooltip')
  }

  // A02 clickable non-button: cursor pointer on a bare div/span, so it is
  // invisible to keyboard and screen readers.
  for (const el of document.querySelectorAll('div, span, li, td, img, p, label')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.cursor !== 'pointer') continue
    if (el.closest('button, a, [role="button"], input, select, textarea, label')) continue
    const role = el.getAttribute('role')
    const ti = el.getAttribute('tabindex')
    if (role || ti !== null) continue
    push('A02', 'high', el, 'cursor:pointer but no role/tabindex -> not keyboard reachable')
  }

  // A03 toggle-flavoured control with no aria-pressed: assistive tech cannot
  // tell whether it is on or off.
  for (const el of controls) {
    if (el.tagName !== 'BUTTON') continue
    const tid = (el.getAttribute('data-testid') || '') + ' ' + (el.getAttribute('aria-label') || '')
    if (!/toggle|mute|loop|snap|solo|repeat|shuffle|lock|visible|enabled/i.test(tid)) continue
    if (el.hasAttribute('aria-pressed') || el.getAttribute('role') === 'switch') continue
    if (el.getAttribute('aria-checked') !== null) continue
    // A collapse/expand control is a disclosure, correctly described by
    // aria-expanded rather than aria-pressed.
    if (el.hasAttribute('aria-expanded')) continue
    push('A03', 'medium', el, 'toggle-style control without aria-pressed/role=switch')
  }

  // A04 text input naming itself by placeholder only: the name vanishes the
  // moment the user types.
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!vis(el)) continue
    if (el.type === 'hidden' || el.type === 'range' || el.type === 'checkbox' || el.type === 'radio') continue
    if (el.getAttribute('aria-label')) continue
    if (el.id && document.querySelector(`label[for="${el.id}"]`)) continue
    if (el.closest('label')) continue
    if (el.getAttribute('title')) continue
    push('A04', 'medium', el, (el.getAttribute('placeholder') ? 'named only by placeholder' : 'no label at all'))
  }

  // A05 positive tabindex: jumps the natural tab order.
  for (const el of controls) {
    const ti = el.getAttribute('tabindex')
    if (ti !== null && Number(ti) > 0) push('A05', 'medium', el, `tabindex="${ti}" opens the tab order`)
  }

  // A06 image with no alt attribute.
  for (const el of document.querySelectorAll('img')) {
    if (!vis(el)) continue
    if (el.getAttribute('alt') === null) push('A06', 'medium', el, 'img without alt')
  }

  // ---- K: keyboard ------------------------------------------------------

  // K01 a scrollable panel that is not focusable: keyboard users cannot
  // scroll it without a mouse.
  for (const el of document.querySelectorAll('div')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    const scrolls = /auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflow)
    if (!scrolls) continue
    if (el.scrollHeight <= el.clientHeight + 2) continue
    if (el.tabIndex >= 0) continue
    const r = el.getBoundingClientRect()
    if (r.height < 80) continue
    push('K01', 'medium', el, `scrollable (${el.scrollHeight}>${el.clientHeight}) but not focusable`)
  }

  // ---- D: density -------------------------------------------------------

  // D01 over-dense section: a group holding more controls than a human can
  // scan at a glance. These are the regroup candidates.
  const CTRL = 'button, input, select, textarea'
  // Only controls a person actually has to scan count. Content inside a
  // collapsed section is not on screen, so it is not a density problem.
  const shown = (c) => c.offsetParent !== null || c.getClientRects().length
  // A real <button aria-expanded> has the role implicitly, so matching only
  // [role="button"] would miss every section that uses a native button as
  // its disclosure trigger. Match either shape.
  const isDisc = (c) =>
    c.querySelector(':scope > button[aria-expanded], :scope > [role="button"][aria-expanded]') !== null

  // Every collapsible sub-group is a group in its own right, whether or not
  // it was declared with a testid. Without adding them, a panel is charged
  // for controls that belong to the sections inside it and the crowded
  // section goes unnamed -- the drawing panel's Tools section looked like 33
  // controls when it owns 1 and merely contains eight sub-sections.
  const declared = [...document.querySelectorAll('[data-testid$="-section"], [data-testid$="-panel"], section, fieldset')]
  const collapsible = [...document.querySelectorAll('div, section')].filter(isDisc)
  const groups = [...new Set([...declared, ...collapsible])].filter(vis)

  for (const g of groups) {
    // Charge a group only for the controls it holds itself, not for those
    // belonging to groups nested inside it. Otherwise every ancestor of a
    // crowded section reports the same crowding, and the container -- which
    // is nothing but a list of headings to scan -- looks like the problem.
    const nested = groups.filter((o) => o !== g && g.contains(o))
    const own = [...g.querySelectorAll(CTRL)]
      .filter(shown)
      .filter((c) => !nested.some((o) => o.contains(c)))
      .length
    if (own > 14) push('D01', 'medium', g, `${own} controls in one group -> regroup candidate`)
  }

  // D02 crammed row: many sibling controls packed too tightly. Measure the
  // real space between consecutive siblings rather than reading `gap`, because
  // the space-y-* utilities space with margins and would read as 0.
  for (const el of document.querySelectorAll('div, section')) {
    if (!vis(el)) continue
    const kids = [...el.children].filter((k) => vis(k) && k.matches('button, input, select'))
    if (kids.length < 6) continue
    let minGap = Infinity
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect()
      const b = kids[i].getBoundingClientRect()
      const horizontal = Math.abs(b.left - a.left) < 2
      const g = horizontal ? b.left - a.right : b.top - a.bottom
      if (g >= 0 && g < minGap) minGap = g
    }
    if (minGap !== Infinity && minGap < 4) {
      push('D02', 'medium', el, `${kids.length} sibling controls with only ${Math.round(minGap)}px between them`)
    }
  }

  // D03 text too small to read comfortably.
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue
    if (!el.firstChild || el.firstChild.nodeType !== 3) continue
    const txt = (el.textContent || '').trim()
    if (!txt) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs > 0 && fs < 9) push('D03', 'medium', el, `font-size ${fs}px on "${txt.slice(0, 30)}"`)
  }

  // D04 clipped text: content wider than its box with no ellipsis.
  for (const el of document.querySelectorAll('button, span, div, p, label')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.textOverflow === 'ellipsis' || cs.overflow === 'visible') continue
    // sr-only is the standard visually-hidden pattern: clipping to 1px is the
    // intent, so it is never a defect.
    if (el.classList.contains('sr-only') || el.closest('.sr-only')) continue
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      if (!el.querySelector('button, input, select')) {
        push('D04', 'low', el, `text clipped: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`)
      }
    }
  }

  // ---- C: consistency ---------------------------------------------------

  // C01 same row, different control heights.
  for (const el of document.querySelectorAll('div')) {
    if (!vis(el)) continue
    // A range input's height is its hit area, not its visual size: the track
    // is drawn separately at 4px inside a transparent 24px box. It is a
    // different shape from a button by design, so comparing the two is a
    // false positive -- a slider padded to button height would be worse.
    const kids = [...el.children].filter(
      (k) => vis(k) && k.matches('button, input, select') && !(k instanceof HTMLInputElement && k.type === 'range'),
    )
    if (kids.length < 3) continue
    // offsetHeight, not getBoundingClientRect: the latter includes CSS
    // transforms, so a control that scales to show selection or hover
    // state measures a few px larger and reads as a sizing bug when it
    // is a deliberate visual state. Layout height is what alignment
    // actually depends on.
    const hs = kids.map((k) => k.offsetHeight)
    const lo = Math.min(...hs), hi = Math.max(...hs)
    if (hi - lo >= 2) push('C01', 'low', el, `sibling control heights ${lo}..${hi}px (${hs.join(',')})`)
  }

  // C02 icon sizes disagreeing inside one toolbar.
  for (const el of document.querySelectorAll('div')) {
    if (!vis(el)) continue
    const svgs = [...el.children].filter((k) => vis(k) && k.matches('button')).map((b) => b.querySelector('svg'))
      .filter(Boolean)
      // Drop collapsed or zero-width svgs: they measure 0-1px and turn the
      // rule into noise rather than a real size disagreement.
      .map((s) => Math.round(s.getBoundingClientRect().width))
      .filter((w) => w >= 6)
    if (svgs.length < 4) continue
    const sizes = [...new Set(svgs)]
    if (sizes.length > 1) push('C02', 'low', el, `icon sizes in one row: ${sizes.join(',')}px`)
  }

  // ---- R: robustness ----------------------------------------------------

  // R01 number input with no bounds: a user can type anything.
  for (const el of document.querySelectorAll('input[type="number"]')) {
    if (!vis(el)) continue
    const miss = []
    if (el.getAttribute('min') === null) miss.push('min')
    if (el.getAttribute('max') === null) miss.push('max')
    if (miss.length) push('R01', 'medium', el, `number input without ${miss.join('/')}`)
  }

  // R02 text input with no length cap.
  for (const el of document.querySelectorAll('input[type="text"], textarea')) {
    if (!vis(el)) continue
    if (el.getAttribute('maxlength') === null) push('R02', 'low', el, 'unbounded text input (no maxlength)')
  }

  // R03 range slider with no visible numeric readout nearby.
  for (const el of document.querySelectorAll('input[type="range"]')) {
    if (!vis(el)) continue
    // The readout is often in a label row that is a sibling of the slider's
    // wrapper, so check a couple of ancestors -- but stop once we reach a
    // container holding several controls, where any number would be
    // coincidental rather than this slider's value.
    let p = el.parentElement
    let sib = ''
    for (let depth = 0; p && depth < 3; depth++) {
      sib = p.textContent || ''
      const nControls = p.querySelectorAll('input[type="range"], input, select').length
      if (/\d/.test(sib)) break
      if (nControls > 3) break
      p = p.parentElement
    }
    // Readouts usually sit in a sibling label row ("Brightness  100%"), so the
    // number is rarely at the start of the string -- do not anchor the match.
    // Do not strip the slider's own value first: a range input is a void
    // element and contributes no text, and stripping "0" would delete the very
    // readout we are looking for.
    const hasNum = /\d+(\.\d+)?\s*(%|px|s|ms|deg|°|x)?/i.test(sib)
    if (!hasNum) push('R03', 'medium', el, 'slider with no numeric readout next to it')
  }

  // R04 empty option / placeholder option in a select.
  for (const el of document.querySelectorAll('select')) {
    if (!vis(el)) continue
    const opts = [...el.options].map((o) => (o.textContent || '').trim())
    if (opts.some((o) => o === '')) push('R04', 'low', el, 'select contains an empty option')
  }

  // ---- T: copy ----------------------------------------------------------

  // T01 tooltip that just repeats the visible label: adds noise, no info.
  for (const el of controls) {
    const ti = (el.getAttribute('title') || '').trim()
    const txt = (el.textContent || '').trim()
    if (ti && txt && ti.toLowerCase() === txt.toLowerCase()) {
      // When the label is truncated the tooltip is the only way to read the
      // full string, so repeating the text is doing real work there.
      const trunc = el.classList.contains('truncate') || !!el.querySelector('.truncate')
      const clipped = el.scrollWidth > el.clientWidth + 1
      if (!trunc && !clipped) {
        push('T01', 'low', el, `title duplicates visible text: "${ti.slice(0, 30)}"`)
      }
    }
  }

  // T02 bare number in a label where a unit is expected.
  for (const el of document.querySelectorAll('button, label, span, option')) {
    if (!vis(el)) continue
    if (el.querySelector('button, input, select')) continue
    const txt = (el.textContent || '').trim()
    if (!/^[\d.]+$/.test(txt)) continue
    const ctx = ((el.parentElement && el.parentElement.textContent) || '') + (el.getAttribute('title') || '')
    if (/dur|sec|time|delay|length/i.test(ctx)) push('T02', 'low', el, `"${txt}" has no unit`)
  }

  // T03 sibling labels disagreeing on Title Case vs lower case.
  for (const el of document.querySelectorAll('div')) {
    if (!vis(el)) continue
    const labels = [...el.children]
      .filter((k) => vis(k) && !k.querySelector('button, input, select'))
      .map((k) => (k.textContent || '').trim())
      .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t) && t === t.toLowerCase() === false || /^[A-Z]/.test(t))
    if (labels.length < 3) continue
    const upper = labels.filter((t) => t === t.toUpperCase() && /[A-Z]{2}/.test(t)).length
    const lower = labels.filter((t) => t === t.toLowerCase()).length
    const title = labels.filter((t) => /^[A-Z][a-z]/.test(t)).length
    if (upper > 0 && title > 0 && upper + title >= 3) {
      push('T03', 'low', el, `mixed casing among sibling labels (${upper} UPPER / ${title} Title / ${lower} lower)`)
    }
  }

  // ---- A: more accessibility -------------------------------------------

  // A07 text/background contrast below WCAG AA. Walk up for the first opaque
  // background; skip anything sitting over an image or canvas where we cannot
  // know the true backdrop.
  {
    const parseRGB = (s) => {
      const m = s.match(/[\d.]+/g)
      if (!m || m.length < 3) return null
      return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }
    }
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const effBg = (el) => {
      let n = el
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n)
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
        const c = parseRGB(cs.backgroundColor)
        if (c && c.a > 0.85) return c
        n = n.parentElement
      }
      return { r: 0, g: 0, b: 0, a: 1 }
    }

    for (const el of document.querySelectorAll('*')) {
      if (!vis(el)) continue
      const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!direct) continue
      const txt = (el.textContent || '').trim()
      if (!txt) continue
      const cs = getComputedStyle(el)
      const fg = parseRGB(cs.color)
      const bg = effBg(el)
      if (!fg || !bg) continue
      if (fg.a < 0.9) continue
      const size = parseFloat(cs.fontSize)
      const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700
      const large = size >= 24 || (bold && size >= 18.66)
      const need = large ? 3 : 4.5
      const r = ratio(fg, bg)
      if (r < need) push('A07', 'high', el, `contrast ${r.toFixed(2)}:1 < ${need} (${size}px, "${txt.slice(0, 24)}")`)
    }
  }

  // A08 duplicate id: getElementById and aria refs become ambiguous.
  {
    const seen = new Map()
    for (const el of document.querySelectorAll('[id]')) {
      const id = el.getAttribute('id')
      seen.set(id, (seen.get(id) || 0) + 1)
    }
    for (const [id, n] of seen) {
      if (n > 1) push('A08', 'high', document.getElementById(id), `id "${id}" used ${n} times`)
    }
  }

  // A09 aria-labelledby / aria-describedby pointing at an id that is not there.
  for (const el of document.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
    if (!vis(el)) continue
    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      const v = (el.getAttribute(attr) || '').trim()
      if (!v) continue
      for (const id of v.split(/\s+/)) {
        if (!document.getElementById(id)) push('A09', 'high', el, `${attr}="${id}" points at a missing element`)
      }
    }
  }

  // A10 button with no explicit type: inside a form it submits.
  for (const el of document.querySelectorAll('button')) {
    if (!vis(el)) continue
    if (!el.hasAttribute('type')) push('A10', 'low', el, 'button without type (defaults to submit)')
  }

  // A11 interactive nested inside interactive: undefined hit behaviour.
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    if (!vis(el)) continue
    if (el.querySelector('button, a[href], input, select, textarea')) {
      push('A11', 'high', el, 'interactive control nested inside another control')
    }
  }

  // A12 aria-hidden on something focusable: focusable but invisible to AT.
  for (const el of document.querySelectorAll('[aria-hidden="true"]')) {
    if (!vis(el)) continue
    const inner = el.matches(INTERACTIVE) || el.querySelector(INTERACTIVE)
    if (inner) push('A12', 'high', el, 'aria-hidden="true" on a focusable element')
  }

  // A13 invalid aria-* attribute value.
  for (const el of document.querySelectorAll('[aria-expanded], [aria-pressed], [aria-checked], [aria-selected]')) {
    if (!vis(el)) continue
    for (const a of ['aria-expanded', 'aria-pressed', 'aria-checked', 'aria-selected']) {
      const v = el.getAttribute(a)
      if (v === null) continue
      if (!['true', 'false', 'mixed'].includes(v)) push('A13', 'high', el, `${a}="${v}" is not a valid value`)
    }
  }

  // ---- D: more layout ---------------------------------------------------

  // D05 a control you cannot actually click because something else is on top
  // of it. Geometric overlap alone is a poor signal: a closed panel that is
  // translated off-screen still reports a bounding box, and a popover is
  // *meant* to cover the page. So this asks the browser directly -- if the
  // element at the control's own centre point is not the control, something is
  // stealing its clicks.
  // A closed side panel is usually translated out of view rather than
  // display:none, so it still reports a bounding box and its controls look
  // like they are sitting on top of the timeline. Skip anything clipped out of
  // its scrolling ancestor's visible box.
  const clippedOut = (el, r) => {
    let n = el.parentElement
    while (n && n !== document.body) {
      const cs = getComputedStyle(n)
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const pr = n.getBoundingClientRect()
        const ix = Math.min(r.right, pr.right) - Math.max(r.left, pr.left)
        const iy = Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top)
        // Less than half the control is inside the clip box -> effectively gone.
        if (ix < r.width * 0.5 || iy < r.height * 0.5) return true
      }
      n = n.parentElement
    }
    return false
  }

  for (const el of controls) {
    if (el.tagName === 'INPUT' && (el.type === 'hidden' || el.type === 'range')) continue
    if (getComputedStyle(el).pointerEvents === 'none') continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
    if (clippedOut(el, r)) continue

    const hit = document.elementFromPoint(cx, cy)
    if (!hit) { push('D05', 'high', el, 'centre point hits nothing'); continue }
    if (hit === el || el.contains(hit) || hit.contains(el)) continue
    // A transparent wrapper (a layout div) between the point and the control
    // still delivers the click, so only report real competing controls.
    const blocker = hit.closest('button, a[href], input, select, textarea, [role="button"], [role="tab"]')
    if (!blocker) continue
    if (blocker === el || el.contains(blocker) || blocker.contains(el)) continue
    push('D05', 'high', el, `clicks stolen by ${describe(blocker)}`)
  }

  // D06 a child painting outside its clipping parent: content is cut off.
  for (const el of document.querySelectorAll('div, section, ul, ol')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (!/hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) continue
    const pr = el.getBoundingClientRect()
    if (pr.width < 4 || pr.height < 4) continue
    let worst = 0, who = null
    for (const k of el.children) {
      if (!vis(k)) continue
      const kr = k.getBoundingClientRect()
      const over = Math.max(kr.right - pr.right, pr.left - kr.left, kr.bottom - pr.bottom, pr.top - kr.top)
      if (over > worst) { worst = over; who = k }
    }
    if (worst > 4 && who) push('D06', 'medium', el, `child ${describe(who)} overflows clip parent by ${Math.round(worst)}px`)
  }

  return out
}

async function selftest(browser) {
  console.log('=== self-test: strict audit detects seeded defects ===')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.setContent(`<!doctype html><html><body>
    <div id="st-clickable" style="cursor:pointer;width:80px;height:30px">click me</div>
    <button id="st-toggle" data-testid="thing-toggle">Toggle</button>
    <input id="st-num" type="number" style="width:60px">
    <button id="st-dupe" title="Save">Save</button>
    <img id="st-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="20" height="20">
    <button id="st-notip" aria-label="Do thing"><svg width="14" height="14"></svg></button>
    <div id="st-tab" tabindex="5">jumpy</div>
    <div id="st-dupid">x</div><div id="st-dupid">y</div>
    <button id="st-ref" aria-labelledby="st-nope">labelled by nothing</button>
    <div id="st-outer" role="button"><button id="st-inner">nested</button></div>
    <div id="st-hid" aria-hidden="true"><button id="st-hidbtn">focusable</button></div>
    <button id="st-badaria" aria-pressed="yes">bad</button>
    <span id="st-contrast" style="color:#aaaaaa;background:#ffffff">faint text</span>
    <button id="st-notype">no type</button>
  </body></html>`)

  const found = await page.evaluate(collectStrict)
  const has = (id, rule) => found.some((f) => f.el.includes(id) && f.rule === rule)
  const checks = [
    ['A02 clickable div', has('st-clickable', 'A02')],
    ['A03 toggle no pressed', has('st-toggle', 'A03')],
    ['R01 unbounded number', has('st-num', 'R01')],
    ['T01 dup tooltip', has('st-dupe', 'T01')],
    ['A06 img no alt', has('st-img', 'A06')],
    ['A01 icon no tooltip', has('st-notip', 'A01')],
    ['A05 positive tabindex', has('st-tab', 'A05')],
    ['A08 duplicate id', has('st-dupid', 'A08')],
    ['A09 dangling aria-labelledby', has('st-ref', 'A09')],
    ['A11 nested interactive', has('st-outer', 'A11')],
    ['A12 aria-hidden focusable', has('st-hid', 'A12')],
    ['A13 invalid aria value', has('st-badaria', 'A13')],
    ['A07 low contrast', has('st-contrast', 'A07')],
    ['A10 button no type', has('st-notype', 'A10')],
  ]
  let ok = true
  for (const [n, v] of checks) { console.log(`  ${v ? '✓' : '✗ FAIL'}  ${n}`); if (!v) ok = false }
  await page.close()
  return ok
}

async function run() {
  console.log('=== UI Strict Audit ===')
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
    process.exit(ok ? 0 : 1)
  }

  const all = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', () => {})
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)

    // Auditing an empty project only measures the shell: the app boots with no
    // tracks and no clips, so every selection-dependent panel renders nothing.
    // Seed a real project first.
    const seeded = await seedProject(page)
    console.log('seeded:', JSON.stringify(seeded))
    await page.waitForTimeout(1200)

    for (const ov of OVERLAYS) {
    if (ov.open) {
      await page.evaluate(ov.open)
      await page.waitForTimeout(420)
    }
    for (const tab of TABS) {
      // Studio.tsx auto-closes both side panels below 1080px. Forcing them
      // open under that breakpoint would measure a state the app forbids, so
      // follow the app's own rule instead.
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
        const res = await page.evaluate(collectStrict)
        for (const i of res) all.push({ viewport: vp.name, tab, overlay: ov.name, submode: sm || '(root)', ...i })
        if (sm) {
          await page.evaluate(() => {
            const b = document.querySelector('[data-testid="submode-back-btn"]')
            if (b) b.click()
          })
          await page.waitForTimeout(220)
        }
      }
    }
    }
    await context.close()
  }

  await browser.close()

  // Dedupe on rule + element identity.
  const uniq = new Map()
  for (const i of all) {
    const k = i.rule + '|' + i.el + '|' + i.viewport
    if (!uniq.has(k)) uniq.set(k, i)
  }

  console.log('\n--- totals by rule ---')
  const byRule = {}
  for (const i of uniq.values()) byRule[i.rule] = (byRule[i.rule] || 0) + 1
  for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(5)} ${String(v).padStart(4)}`)
  }

  console.log('\n--- totals by severity ---')
  const bySev = {}
  for (const i of uniq.values()) bySev[i.sev] = (bySev[i.sev] || 0) + 1
  for (const [k, v] of Object.entries(bySev)) console.log(`  ${k.padEnd(7)} ${v}`)

  console.log('\n--- totals by tab ---')
  const byTab = {}
  for (const i of uniq.values()) byTab[i.tab] = (byTab[i.tab] || 0) + 1
  for (const [t, c] of Object.entries(byTab).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${t}`)

  const reportPath = path.join(REPORTS_DIR, 'ui-strict-audit.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    totals: { unique: uniq.size, instances: all.length }, byRule, bySev, byTab,
    unique: [...uniq.values()], all,
  }, null, 2))
  console.log(`\nWrote ${reportPath}  (${uniq.size} unique, ${all.length} instances)`)
}

run()
