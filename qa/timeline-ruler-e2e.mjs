import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(REPORTS, { recursive: true })
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = [], errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
const check = (value, name, detail = '') => { if (!value) throw Error(`${name}: ${detail}`); results.push({ name, status: 'PASS', detail }); console.log('PASS', name, detail) }

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT, 'qa/fixtures/pexels-cinematic-8s.webm'))
const clip = page.locator('[data-testid="timeline-clip"]').first()
await clip.waitFor()
const scale = page.getByTestId('timeline-scale')
const ruler = page.getByTestId('timeline-ruler')
const timeline = page.getByTestId('timeline')

const widths = []
for (const value of ['40', '160', '640', '2400']) {
  await scale.fill(value)
  await page.waitForTimeout(40)
  widths.push((await clip.boundingBox()).width)
  const labels = await page.getByTestId('ruler-label').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }
  }).filter(r => r.width > 0).sort((a,b) => a.left-b.left))
  check(labels.every((label, i) => i === 0 || label.left >= labels[i-1].right - 0.5), `ruler labels do not overlap at ${value} px/s`, `${labels.length} labels`)
  const ticks = await page.locator('[data-testid="ruler-tick"][data-major="true"]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('data-time'))))
  check(ticks.every((time, i) => Number.isFinite(time) && (i === 0 || time > ticks[i-1])), `major tick times strictly increase at ${value} px/s`)
  check(ticks.length > 0 && ticks.length < 100, `major tick density is bounded at ${value} px/s`, String(ticks.length))
}
check(widths.every((width, i) => i === 0 || width > widths[i-1]), 'continuous zoom physically widens clip', JSON.stringify(widths))

await scale.fill('320')
const scroller = ruler.locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]')
await scroller.evaluate(el => { el.scrollLeft = 240; el.dispatchEvent(new Event('scroll')) })
await page.waitForTimeout(80)
const rulerBox = await ruler.boundingBox()
const scrollerBox = await scroller.boundingBox()
const before = await timeline.getAttribute('data-px-per-second')
const scrollBefore = await scroller.evaluate(el => el.scrollLeft)
const anchorX = Math.max(20, (scrollerBox.width - 168) * 0.64)
const timeBefore = (scrollBefore + anchorX) / Number(before)
await page.mouse.move(scrollerBox.x + 168 + anchorX, rulerBox.y + 12)
await page.keyboard.down('Control')
await page.mouse.wheel(0, -180)
await page.keyboard.up('Control')
await page.waitForTimeout(80)
const after = Number(await timeline.getAttribute('data-px-per-second'))
const scrollAfter = await scroller.evaluate(el => el.scrollLeft)
const timeAfter = (scrollAfter + anchorX) / after
check(after > Number(before), 'Ctrl-wheel increases continuous timeline scale', `${before} -> ${after}`)
check(Math.abs(timeAfter - timeBefore) < 0.03, 'wheel zoom preserves pointer time anchor', `${timeBefore.toFixed(4)} -> ${timeAfter.toFixed(4)}`)

await page.getByTestId('settings-button').click()
const fpsSelect = page.getByLabel('Project frame rate')
for (const fps of ['23.976','24','25','29.97','30','50','59.94','60','120']) {
  await fpsSelect.selectOption(fps)
  check(await timeline.getAttribute('data-project-fps') === fps, `project ruler accepts ${fps} fps`)
  await scale.fill('8000')
  const tickTimes = await page.locator('[data-testid="ruler-tick"]').evaluateAll(nodes => nodes.slice(0, 20).map(n => Number(n.getAttribute('data-time'))))
  check(tickTimes.every((time, i) => i === 0 || time > tickTimes[i-1]), `frame ticks increase at ${fps} fps`)
}
await page.keyboard.press('Escape')
check(errors.length === 0, 'zero ruler runtime errors', errors.join(' | '))
writeFileSync(join(REPORTS, 'timeline-ruler-results.json'), JSON.stringify({ results, errors, clipWidths: widths }, null, 2))
console.log(`RESULT ${results.length} PASS`)
await browser.close()
