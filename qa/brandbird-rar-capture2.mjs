const base = 'http://127.0.0.1:8901'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const report = JSON.parse(fs.readFileSync('brandbird_study/snapshots/capture-report.json', 'utf8'))
  const snap = async (name) => {
    await page.waitForTimeout(1300)
    await page.screenshot({ path: `brandbird_study/snapshots/${name}.png` })
    const info = await page.evaluate(() => ({
      url: location.pathname,
      text: document.body.innerText.slice(0, 3500),
      buttons: [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 44)).filter(Boolean).slice(0, 90),
      sliders: [...document.querySelectorAll('input[type="range"], [role="slider"]')].length,
      ranges: [...document.querySelectorAll('input[type="range"]')].map((i) => `${i.min}..${i.max}=${i.value}`).slice(0, 20),
    }))
    fs.writeFileSync(`brandbird_study/snapshots/${name}.json`, JSON.stringify(info, null, 2))
    report.push({ name, url: info.url, buttons: info.buttons.length, sliders: info.sliders, ranges: info.ranges })
    console.log('SNAP', name, '| sliders', info.sliders, JSON.stringify(info.ranges), '|', info.text.slice(0, 90).replace(/\n/g, ' | '))
  }
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  await page.getByText("I'll explore on my own").click().catch(() => {})
  await page.waitForTimeout(700)
  const clickSection = async (label) => {
    await page.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().click().catch((e) => console.log('click fail', label, String(e).slice(0, 80)))
    await page.waitForTimeout(500)
  }
  await clickSection('3D'); await snap('17-section-3d')
  await clickSection('Header'); await snap('18-section-header')
  // upload an image through the Images panel (file chooser)
  await clickSection('Images')
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
    page.locator('button', { hasText: /Upload Image/ }).first().click().catch(() => {}),
  ])
  if (chooser) {
    await chooser.setFiles('ui_downlaod_study/sections/23-pack-browser.png')
    console.log('file set via chooser')
  } else {
    const fi = page.locator('input[type="file"]').first()
    if (await fi.count()) { await fi.setInputFiles('ui_downlaod_study/sections/23-pack-browser.png'); console.log('file set via input') }
    else console.log('NO file input found')
  }
  await page.waitForTimeout(2500)
  await snap('19-image-added')
  // select the image on canvas, then open Mockup + Shadow with a selection
  await page.mouse.click(800, 480)
  await page.waitForTimeout(600)
  await snap('20-image-selected')
  await clickSection('Mockup'); await snap('21-mockup-controls')
  await clickSection('Shadow'); await snap('22-shadow-controls')
  await clickSection('Border'); await snap('23-border-controls')
  await clickSection('Position'); await snap('24-position-controls')
  // export menu
  await page.locator('button', { hasText: /^\s*Export\s*$/ }).first().click().catch(() => {})
  await snap('25-export-menu')
  fs.writeFileSync('brandbird_study/snapshots/capture-report.json', JSON.stringify(report, null, 2))
  await browser.close()
  console.log('DONE')
}
main()
