const base = 'http://127.0.0.1:8901'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  fs.mkdirSync('brandbird_study/snapshots', { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const report = []
  const snap = async (name) => {
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `brandbird_study/snapshots/${name}.png` })
    const info = await page.evaluate(() => ({
      url: location.pathname,
      text: document.body.innerText.slice(0, 3000),
      buttons: [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 44)).filter(Boolean).slice(0, 90),
      inputs: [...document.querySelectorAll('input')].map((i) => `${i.type}:${i.placeholder || ''}`).slice(0, 40),
      sliders: [...document.querySelectorAll('input[type="range"], [role="slider"]')].length,
    }))
    fs.writeFileSync(`brandbird_study/snapshots/${name}.json`, JSON.stringify(info, null, 2))
    report.push({ name, url: info.url, buttons: info.buttons.length, sliders: info.sliders, head: info.text.slice(0, 150).replace(/\n/g, ' | ') })
    console.log('SNAP', name, '| btns', info.buttons.length, '| sliders', info.sliders, '|', info.text.slice(0, 110).replace(/\n/g, ' | '))
  }
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await snap('01-welcome-modal')
  // dismiss onboarding
  await page.getByText("I'll explore on my own").click().catch(async () => { await page.getByText("Let's Get Started").click().catch(() => {}) })
  await page.waitForTimeout(800)
  await snap('02-studio-clean')
  // enumerate the left rail
  const rail = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter((t) => t && t.length < 30))
  console.log('rail candidates:', JSON.stringify(rail.slice(0, 40)))
  const sections = ['AI', 'Uploads', 'Templates', 'Images', 'Annotation', 'Background', 'Mockup', 'Position', '3D Effect', 'Shadow', 'Border', 'Title', 'Layout', 'Watermark', 'Brands']
  let n = 3
  for (const label of sections) {
    const btn = page.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first()
    if (await btn.count() === 0) continue
    await btn.click().catch(() => {})
    await snap(`${String(n).padStart(2, '0')}-section-${label.toLowerCase().replace(/\s+/g, '-')}`)
    n++
  }
  // Export menu
  await page.locator('button', { hasText: /^\s*Export\s*$/ }).first().click().catch(() => {})
  await snap(`${String(n).padStart(2, '0')}-export-menu`); n++
  await page.keyboard.press('Escape').catch(() => {})
  // upload a real image to unlock image/mockup controls
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles('ui_downlaod_study/sections/23-pack-browser.png').catch((e) => console.log('upload failed', String(e).slice(0, 100)))
    await page.waitForTimeout(2500)
    await snap(`${String(n).padStart(2, '0')}-with-image`); n++
    // click the canvas image to select it -> Mockup Controls
    await page.mouse.click(800, 500).catch(() => {})
    await snap(`${String(n).padStart(2, '0')}-image-selected`); n++
  }
  fs.writeFileSync('brandbird_study/snapshots/capture-report.json', JSON.stringify(report, null, 2))
  await browser.close()
  console.log('DONE', report.length, 'captures')
}
main()
