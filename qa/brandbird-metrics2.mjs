const base = 'http://127.0.0.1:8901'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  await page.getByText("I'll explore on my own").click().catch(() => {})
  await page.waitForTimeout(800)
  const M = JSON.parse(fs.readFileSync('brandbird_study/snapshots/metrics.json', 'utf8'))
  M.regions2 = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')]
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    // panel: element with x in [90,130], w in [240,340], h > 400, most buttons inside
    const panels = all.filter((e) => { const r = e.getBoundingClientRect(); return r.x >= 90 && r.x <= 130 && r.width >= 240 && r.width <= 340 && r.height > 400 })
    panels.sort((a, b) => b.querySelectorAll('button').length - a.querySelectorAll('button').length)
    const panel = panels[0]
    // design: element with aspect ~16:9, biggest area
    const designs = all.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 400 && Math.abs(r.width / r.height - 16 / 9) < 0.02)
    designs.sort((a, b) => b.width * b.height - a.width * a.height)
    // rail container: ancestor of AI button that scrolls or contains all rail buttons
    const aiBtn = all.find((e) => e.children.length === 0 && e.textContent?.trim() === 'AI')?.closest('button')
    let rail = aiBtn
    while (rail && rail.querySelectorAll('button').length < 15) rail = rail.parentElement
    // topbar: ancestor of Export text with height < 80 spanning full width
    const exp = all.find((e) => e.children.length === 0 && e.textContent?.trim() === 'Export')
    let top = exp
    while (top && !(top.getBoundingClientRect().width > 1400 && top.getBoundingClientRect().height < 90)) top = top.parentElement
    return {
      panel: rect(panel),
      panelButtons: panel?.querySelectorAll('button').length,
      design: designs[0] ? { x: Math.round(designs[0].x), y: Math.round(designs[0].y), w: Math.round(designs[0].width), h: Math.round(designs[0].height) } : null,
      rail: rail ? { ...rect(rail), scrollH: rail.scrollHeight, clientH: rail.clientHeight, buttons: rail.querySelectorAll('button').length } : null,
      topbar: rect(top),
    }
  })
  const sections = ['AI', 'Uploads', 'Templates', 'Images', 'Annotation', 'Background', 'Mockup', 'Position', '3D', 'Shadow', 'Border', 'Layout', 'Header', 'Watermark', 'Brands']
  M.sections = {}
  for (const label of sections) {
    await page.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().click().catch(() => {})
    await page.waitForTimeout(450)
    M.sections[label] = await page.evaluate(() => {
      const all = [...document.querySelectorAll('*')]
      const panels = all.filter((e) => { const r = e.getBoundingClientRect(); return r.x >= 90 && r.x <= 130 && r.width >= 240 && r.width <= 340 && r.height > 400 })
      panels.sort((a, b) => b.querySelectorAll('button').length - a.querySelectorAll('button').length)
      const panel = panels[0]
      if (!panel) return { found: false }
      const q = (sel) => panel.querySelectorAll(sel).length
      const scrollables = [panel, ...panel.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4).map((e) => ({ scrollH: e.scrollHeight, clientH: e.clientHeight }))
      const rows = [...panel.querySelectorAll('button, input, [role="slider"]')].length
      return { found: true, buttons: q('button'), inputs: q('input'), sliders: q('input[type="range"], [role="slider"]'), interactives: rows, scrollables, clientH: panel.clientHeight, text: panel.innerText.slice(0, 160).replace(/\n/g, ' | ') }
    })
  }
  // panel scroll linkage: scroll the panel scroller, check design rect stays put
  M.scrollLink = await page.evaluate(async () => {
    const all = [...document.querySelectorAll('*')]
    const designs = all.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 400 && Math.abs(r.width / r.height - 16 / 9) < 0.02)
    designs.sort((a, b) => b.width * b.height - a.width * a.height)
    const before = designs[0] ? { x: Math.round(designs[0].x), y: Math.round(designs[0].y) } : null
    const panels = all.filter((e) => { const r = e.getBoundingClientRect(); return r.x >= 90 && r.x <= 130 && r.width >= 240 && r.width <= 340 && r.height > 400 })
    const panel = panels[0]
    const sc = [panel, ...panel.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4)
    if (sc) sc.scrollTop = 300
    await new Promise((r) => setTimeout(r, 300))
    const designs2 = [...document.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 400 && Math.abs(r.width / r.height - 16 / 9) < 0.02)
    designs2.sort((a, b) => b.width * b.height - a.width * a.height)
    const after = designs2[0] ? { x: Math.round(designs2[0].x), y: Math.round(designs2[0].y) } : null
    return { scrolled: sc ? sc.scrollTop : null, designBefore: before, designAfter: after }
  })
  fs.writeFileSync('brandbird_study/snapshots/metrics.json', JSON.stringify(M, null, 2))
  console.log(JSON.stringify({ regions2: M.regions2, sections: M.sections, scrollLink: M.scrollLink }, null, 2).slice(0, 5200))
  await browser.close()
}
main()
