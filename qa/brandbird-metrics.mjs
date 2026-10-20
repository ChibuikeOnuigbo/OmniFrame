const base = 'http://127.0.0.1:8901'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  const M = {}
  M.welcome = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('Welcome to BrandBird') && d.getBoundingClientRect().width > 300 && d.getBoundingClientRect().width < 900)
    const r = dlg?.getBoundingClientRect()
    return r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null
  })
  await page.getByText("I'll explore on my own").click().catch(() => {})
  await page.waitForTimeout(800)
  M.regions = await page.evaluate(() => {
    const out = {}
    const all = [...document.querySelectorAll('*')]
    const byText = (t) => all.find((e) => e.children.length === 0 && e.textContent?.trim() === t)
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    out.viewport = { w: innerWidth, h: innerHeight }
    out.signIn = rect(byText('Sign In'))
    out.exportBtn = rect(byText('Export'))
    out.sizeBtn = rect(byText('2400 × 1350 px'))
    const ai = byText('AI')
    out.railBtnAI = rect(ai?.closest('button') || ai)
    const names = ['AI', 'Uploads', 'Templates', 'Images', 'Annotation', 'Background', 'Mockup', 'Position', '3D', 'Shadow', 'Border', 'Layout', 'Header', 'Watermark', 'Brands']
    out.railButtons = names.map((t) => rect(byText(t)?.closest('button') || byText(t)))
    out.railCount = out.railButtons.filter(Boolean).length
    let panel = byText('IMAGES')
    while (panel && panel.getBoundingClientRect().width < 200) panel = panel.parentElement
    out.panel = rect(panel)
    let sc = panel
    while (sc && !(sc.scrollHeight > sc.clientHeight + 4)) sc = sc.parentElement
    out.panelScroller = sc ? { ...rect(sc), scrollH: sc.scrollHeight, clientH: sc.clientHeight } : null
    const cands = all.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 600 && r.height > 300 && r.x > 300)
    cands.sort((a, b) => b.width * b.height - a.width * a.height)
    out.design = cands[0] ? { x: Math.round(cands[0].x), y: Math.round(cands[0].y), w: Math.round(cands[0].width), h: Math.round(cands[0].height) } : null
    return out
  })
  const sections = ['AI', 'Uploads', 'Templates', 'Images', 'Annotation', 'Background', 'Mockup', 'Position', '3D', 'Shadow', 'Border', 'Layout', 'Header', 'Watermark', 'Brands']
  M.sections = {}
  for (const label of sections) {
    await page.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().click().catch(() => {})
    await page.waitForTimeout(450)
    M.sections[label] = await page.evaluate(() => {
      const all = [...document.querySelectorAll('*')]
      const byText = (t) => all.find((e) => e.children.length === 0 && e.textContent?.trim() === t)
      const titles = ['AI', 'UPLOADS', 'TEMPLATES', 'IMAGES', 'ANNOTATION', 'BACKGROUND', 'MOCKUP', 'POSITION', '3D EFFECT', 'SHADOW', 'BORDER', 'LAYOUT', 'HEADER', 'WATERMARK', 'BRANDS', 'History']
      let panel = null
      for (const t of titles) { const el = byText(t); if (el) { let p = el; while (p && (p.getBoundingClientRect().width < 200 || p.getBoundingClientRect().width > 340)) p = p.parentElement; if (p) { panel = p; break } } }
      if (!panel) return { found: false }
      const q = (sel) => panel.querySelectorAll(sel).length
      const scrollables = [panel, ...panel.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4)
      return {
        found: true,
        panelW: Math.round(panel.getBoundingClientRect().width),
        buttons: q('button'), inputs: q('input'), sliders: q('input[type="range"], [role="slider"]'),
        scrollableChildren: scrollables.length,
        panelScrollH: Math.max(panel.scrollHeight, ...[...panel.querySelectorAll('*')].map((e) => e.scrollHeight)),
        panelClientH: panel.clientHeight,
        text: panel.innerText.slice(0, 200).replace(/\n/g, ' | '),
      }
    })
  }
  await page.locator('button', { hasText: /^\s*Export\s*$/ }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  M.export = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')]
    const el = all.find((e) => e.children.length === 0 && e.textContent?.trim() === 'EXPORT OPTIONS')
    let pop = el
    while (pop && pop.getBoundingClientRect().width < 150) pop = pop.parentElement
    const r = pop?.getBoundingClientRect()
    return r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null
  })
  await page.keyboard.press('Escape').catch(() => {})
  fs.writeFileSync('brandbird_study/snapshots/metrics.json', JSON.stringify(M, null, 2))
  console.log(JSON.stringify(M, null, 2).slice(0, 5000))
  await browser.close()
}
main()
