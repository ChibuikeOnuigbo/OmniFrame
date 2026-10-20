const base = 'http://127.0.0.1:8899'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  fs.mkdirSync('brandbird_study/snapshots', { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const routes = [
    ['01-collection-studio', '/collection.html'],
    ['02-collection-fresh', '/collection.html?new=1'],
    ['03-index', '/index.html'],
    ['04-home', '/'],
  ]
  const report = []
  for (const [name, route] of routes) {
    try {
      const resp = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => null)
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `brandbird_study/snapshots/${name}.png` })
      const dom = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 4000), html: document.body.innerHTML.slice(0, 20000) }))
      fs.writeFileSync(`brandbird_study/snapshots/${name}.html`, dom.html)
      report.push({ name, route, status: resp?.status(), title: dom.title, text: dom.text })
    } catch (e) { report.push({ name, route, error: String(e).slice(0, 200) }) }
  }
  // try clicking through any visible studio controls for state captures
  try {
    await page.goto(base + '/collection.html', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => null)
    await page.waitForTimeout(2000)
    const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent?.trim().slice(0, 40)).filter(Boolean).slice(0, 60))
    report.push({ name: 'studio-buttons', buttons })
    const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => ({ type: i.type, placeholder: i.placeholder })).slice(0, 40))
    report.push({ name: 'studio-inputs', inputs })
  } catch (e) { report.push({ name: 'studio-enumerate', error: String(e).slice(0, 120) }) }
  fs.writeFileSync('brandbird_study/snapshots/capture-report.json', JSON.stringify(report, null, 2))
  await browser.close()
  console.log(JSON.stringify(report, null, 2).slice(0, 3000))
}
main()
