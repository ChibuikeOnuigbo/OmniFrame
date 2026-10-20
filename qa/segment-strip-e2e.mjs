// Segment strip contract (user sketch): [arrow cell][view: same-size
// segments][arrow cell]. No arrow overlaps a segment; at rest no segment
// is cut at the view edge; paging lands on whole-segment boundaries.
const base = 'http://127.0.0.1:5173'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }
async function main() {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1200)
  await page.getByText('Open Studio').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.click('[data-testid="left-tab-pack"]')
  await page.waitForTimeout(700)

  const measure = () => page.evaluate(() => {
    const vp = document.querySelector('[data-testid="pack-section-strip"]')
    const vr = vp.getBoundingClientRect()
    const cells = [...vp.querySelectorAll('[data-segment-cell]')].map((c) => {
      const r = c.getBoundingClientRect()
      return { left: r.left, right: r.right, w: r.width }
    })
    const la = document.querySelector('[data-testid="pack-section-arrow-left"]')?.getBoundingClientRect()
    const ra = document.querySelector('[data-testid="pack-section-arrow-right"]')?.getBoundingClientRect()
    return {
      vp: { left: vr.left, right: vr.right, w: vr.width },
      cells,
      scrollLeft: vp.scrollLeft,
      la: la ? { left: la.left, right: la.right } : null,
      ra: ra ? { left: ra.left, right: ra.right } : null,
    }
  })

  let m = await measure()
  check('arrows are layout cells, not overlays', !!m.la && !!m.ra && m.la.right <= m.vp.left + 1 && m.ra.left >= m.vp.right - 1, JSON.stringify({ la: m.la, vpL: m.vp.left, ra: m.ra }))
  const widths = m.cells.map((c) => Math.round(c.w))
  check('all segments the same size', new Set(widths).size === 1, `widths=${widths.join(',')}`)
  const cut = (mm) => mm.cells.filter((c) => (c.right > mm.vp.left + 1 && c.left < mm.vp.left - 1) || (c.left < mm.vp.right - 1 && c.right > mm.vp.right + 1))
  check('no segment cut at the view edge (start)', cut(m).length === 0, `cut=${cut(m).length}`)
  const fullText = await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="pack-section-strip"]')
    const vr = vp.getBoundingClientRect()
    return [...vp.querySelectorAll('[data-segment-cell]')].filter((c) => {
      const r = c.getBoundingClientRect()
      return r.left >= vr.left - 1 && r.right <= vr.right + 1
    }).map((c) => {
      const b = c.firstElementChild
      return { text: b.textContent.trim(), fits: b.scrollWidth <= b.clientWidth + 1 }
    })
  })
  check('visible segments show their FULL text', fullText.length > 0 && fullText.every((t) => t.fits), JSON.stringify(fullText))
  check('left arrow disabled at start', await page.evaluate(() => document.querySelector('[data-testid="pack-section-arrow-left"]')?.disabled === true))

  await page.click('[data-testid="pack-section-arrow-right"]')
  await page.mouse.move(10, 10)
  await page.waitForTimeout(900)
  m = await measure()
  const cellW = m.cells[0].w
  const idx = m.scrollLeft / cellW
  check('paging lands on a whole-segment boundary', Math.abs(idx - Math.round(idx)) < 0.02, `scrollLeft=${Math.round(m.scrollLeft)} cellW=${Math.round(cellW)} idx=${idx.toFixed(2)}`)
  check('no segment cut at the view edge (after page)', cut(m).length === 0, `cut=${cut(m).length}`)
  check('left arrow enabled after paging', await page.evaluate(() => document.querySelector('[data-testid="pack-section-arrow-left"]')?.disabled === false))

  // sections strip (inspector) obeys the same rules
  const sec = await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="sections-tablist"]')
    if (!vp) return null
    const vr = vp.getBoundingClientRect()
    const cells = [...vp.querySelectorAll('[data-segment-cell]')].map((c) => c.getBoundingClientRect())
    return { n: cells.length, sameW: new Set(cells.map((c) => Math.round(c.width))).size <= 1, cut: cells.filter((r) => (r.right > vr.left + 1 && r.left < vr.left - 1) || (r.left < vr.right - 1 && r.right > vr.right + 1)).length }
  })
  check('sections strip: same-size segments, no cut-outs', !!sec && sec.sameW && sec.cut === 0, JSON.stringify(sec))

  console.log(`\n${pass} passed, ${fail} failed`)
  await browser.close()
  process.exit(fail ? 1 : 0)
}
main()
