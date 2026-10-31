/**
 * UI styles + palettes (Settings → Appearance), from the data.md study:
 * five structural styles (corner language, density, panel depth, light
 * theme) × three accent palettes, persisted and applied live.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })
let failures = 0
const assert = (cond, name, extra = '') => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${extra}`); return }
  console.log(`PASS ${name} ${extra}`)
}
const hard = (cond, name, extra = '') => { if (!cond) { console.error(`FATAL ${name} ${extra}`); process.exit(1) } }

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const studioBg = () => page.evaluate(() => {
  const el = document.querySelector('[data-testid="settings-popup"]') || document.body
  const root = document.querySelector('#root > div') || el
  return { bg: getComputedStyle(root).backgroundColor, style: document.documentElement.dataset.uiStyle, palette: document.documentElement.dataset.uiPalette }
})

// seed a little scene so screenshots show a working studio
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const t = s.createTrack('video')
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const g = c.getContext('2d'); g.fillStyle = '#2563eb'; g.fillRect(0, 0, 640, 360)
  g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(320, 180, 60, 0, 7); g.fill()
  s.addAsset({ id: 'ui-scene', name: 'scene.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
  s.addClipToTrack(t, 'ui-scene', 0)
  s.addMarker({ time: 2, label: 'Beat 1', kind: 'beat' })
  s.setUiStyle('omniframe'); s.setUiPalette('violet')
})
await page.waitForTimeout(400)

await page.locator('[data-testid="settings-button"]').click()
await page.waitForSelector('[data-testid="settings-popup"]')
await page.locator('[data-testid="settings-popup"] button', { hasText: 'appearance' }).first().click()
await page.waitForTimeout(300)
hard(await page.locator('[data-testid="settings-appearance"]').isVisible(), 'appearance settings render')
for (const id of ['omniframe', 'capcut', 'krita', 'premiere', 'daylight']) {
  assert(await page.locator(`[data-testid="ui-style-${id}"]`).count() === 1, `style card: ${id}`)
}
for (const id of ['violet', 'amber', 'teal']) {
  assert(await page.locator(`[data-testid="ui-palette-${id}"]`).count() === 1, `palette button: ${id}`)
}

const before = await studioBg()
await page.locator('[data-testid="ui-style-capcut"]').click()
await page.waitForTimeout(350)
const capcut = await studioBg()
assert(capcut.style === 'capcut' && capcut.bg !== before.bg, 'Clean Cut restyles the studio live', `${before.bg} → ${capcut.bg}`)
await page.screenshot({ path: join(OUT, '18-ui-style-capcut.png') })

await page.locator('[data-testid="ui-style-krita"]').click()
await page.waitForTimeout(350)
const krita = await studioBg()
assert(krita.style === 'krita' && krita.bg !== capcut.bg, 'Workshop restyles the studio live', krita.bg)
const rootFont = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
assert(rootFont === '15px', 'Workshop is denser (15px root)', rootFont)
await page.screenshot({ path: join(OUT, '19-ui-style-krita.png') })

await page.locator('[data-testid="ui-style-daylight"]').click()
await page.waitForTimeout(350)
const day = await studioBg()
const lum = await page.evaluate(() => {
  const el = document.querySelector('#root > div')
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number)
  return (r + g + b) / 3
})
assert(day.style === 'daylight' && lum > 200, 'Daylight is a true light theme', `lum=${lum.toFixed(0)}`)
await page.screenshot({ path: join(OUT, '20-ui-style-daylight.png') })

await page.locator('[data-testid="ui-palette-amber"]').click()
await page.waitForTimeout(300)
const pal = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { style: s.uiStyle, palette: s.uiPalette, ls: localStorage.getItem('omniframe.uiPalette'), lsStyle: localStorage.getItem('omniframe.uiStyle') }
})
assert(pal.palette === 'amber' && pal.ls === 'amber' && pal.lsStyle === 'daylight', 'palette + style persist', JSON.stringify(pal))
const accent = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="settings-button"]')
  return el ? getComputedStyle(document.documentElement).getPropertyValue('--x') : ''
})
assert((await page.evaluate(() => document.documentElement.dataset.uiPalette)) === 'amber', 'palette attribute applied')

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const afterReload = await page.evaluate(() => ({ style: document.documentElement.dataset.uiStyle, palette: document.documentElement.dataset.uiPalette }))
assert(afterReload.style === 'daylight' && afterReload.palette === 'amber', 'style survives reload', JSON.stringify(afterReload))
await page.evaluate(() => { const s = window.__omniframe_store.getState(); s.setUiStyle('omniframe'); s.setUiPalette('violet') })

await browser.close()
if (failures) { console.error(`UI STYLES SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('UI STYLES SUITE: ALL PASS')
