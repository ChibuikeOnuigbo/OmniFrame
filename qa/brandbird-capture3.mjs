const base = 'http://127.0.0.1:8901'
async function main() {
  const { chromium } = await import('playwright-core')
  const fs = await import('node:fs')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const report = JSON.parse(fs.readFileSync('brandbird_study/snapshots/capture-report.json', 'utf8'))
  const snap = async (name) => {
    await page.waitForTimeout(1100)
    await page.screenshot({ path: `brandbird_study/snapshots/${name}.png` })
    const info = await page.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 2200) }))
    fs.writeFileSync(`brandbird_study/snapshots/${name}.json`, JSON.stringify(info, null, 2))
    report.push({ name, url: info.url, head: info.text.slice(0, 110).replace(/\n/g, ' | ') })
    console.log('SNAP', name, '|', info.text.slice(0, 100).replace(/\n/g, ' | '))
  }
  const clickBtn = async (re) => {
    const loc = page.locator('button', { hasText: re }).first()
    if (await loc.count()) { await loc.click().catch(() => {}); await page.waitForTimeout(450); return true }
    return false
  }
  const section = async (label) => clickBtn(new RegExp(`^\\s*${label}\\s*$`))

  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  await page.getByText("I'll explore on my own").click().catch(() => {})
  await page.waitForTimeout(700)

  // Background sub-tabs
  await section('Background')
  await clickBtn(/^\s*Settings\s*$/); await snap('26-bg-settings')
  await clickBtn(/^\s*Effects\s*$/); await snap('27-bg-effects')
  await clickBtn(/^\s*Saved\s*$/); await snap('28-bg-saved')
  await clickBtn(/^\s*Save\s*$/)
  // Annotation tools
  await section('Annotation')
  await clickBtn(/^\s*Text\s*$/); await snap('29-annotation-text')
  await page.keyboard.press('Escape').catch(() => {})
  await clickBtn(/^\s*Arrow\s*$/); await snap('30-annotation-arrow')
  await clickBtn(/^\s*Rectangle\s*$/); await snap('31-annotation-rectangle')
  await clickBtn(/^\s*Icons\s*$/); await snap('32-annotation-icons')
  await page.keyboard.press('Escape').catch(() => {})
  // Templates: saved tab + open one template
  await section('Templates')
  await clickBtn(/^\s*Saved\s*$/); await snap('33-templates-saved')
  await clickBtn(/^\s*Public\s*$/)
  await page.waitForTimeout(600)
  const tpl = page.locator('button').filter({ hasText: /Airbnb|Spotify|Gym/ }).first()
  if (await tpl.count()) { await tpl.click().catch(() => {}); await page.waitForTimeout(1200) }
  await snap('34-template-applied')
  // Uploads filters
  await section('Uploads')
  await clickBtn(/^\s*Backgrounds\s*$/); await snap('35-uploads-backgrounds')
  await clickBtn(/^\s*Images\s*$/)
  // Header on
  await section('Header')
  const headerToggle = page.locator('button[role="switch"], input[type="checkbox"]').first()
  if (await headerToggle.count()) await headerToggle.click().catch(() => {})
  await page.waitForTimeout(500)
  await snap('36-header-on')
  // Layout picker
  await section('Layout'); await snap('37-layout-picker')
  // Canvas size menu
  await page.locator('button', { hasText: /2400/ }).first().click().catch(() => {})
  await snap('38-canvas-size-menu')
  await page.keyboard.press('Escape').catch(() => {})
  // Export advanced options
  await clickBtn(/^\s*Export\s*$/)
  await page.waitForTimeout(500)
  await clickBtn(/ADVANCE OPTIONS/i)
  await snap('39-export-advanced')
  await page.keyboard.press('Escape').catch(() => {})
  // corner buttons: shortcuts + help (bottom-right small round buttons)
  const corner = page.locator('button').last()
  await corner.click().catch(() => {})
  await snap('40-corner-help')
  await page.keyboard.press('Escape').catch(() => {})
  // Sign in
  await clickBtn(/Sign In/)
  await snap('41-sign-in')
  await page.keyboard.press('Escape').catch(() => {})
  await page.mouse.click(700, 900).catch(() => {})
  // image + floating toolbar menus
  await section('Images')
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
    page.locator('button', { hasText: /Upload Image/ }).first().click().catch(() => {}),
  ])
  if (chooser) await chooser.setFiles('ui_downlaod_study/sections/28-segment-strip-full-text.png')
  await page.waitForTimeout(2200)
  await page.mouse.click(800, 480)
  await page.waitForTimeout(600)
  await snap('42-image-toolbar')
  await clickBtn(/AI Tools/)
  await snap('43-ai-tools-menu')
  await page.keyboard.press('Escape').catch(() => {})
  await clickBtn(/^\s*Crop\s*$/)
  await snap('44-crop-mode')
  await page.keyboard.press('Escape').catch(() => {})
  await section('3D'); await snap('45-3d-with-image')
  await section('Mockup')
  await page.locator('button').filter({ hasText: /NONE/ }).first().click().catch(() => {})
  await snap('46-mockup-frame-picker')
  // dashboard route
  const nav = await page.evaluate(async () => { try { await window.next.router.push('/dashboard'); return 'pushed' } catch (e) { return 'err' } })
  console.log('dashboard nav:', nav)
  await snap('47-dashboard')
  fs.writeFileSync('brandbird_study/snapshots/capture-report.json', JSON.stringify(report, null, 2))
  await browser.close()
  console.log('DONE')
}
main()
