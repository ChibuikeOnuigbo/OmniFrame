import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd(), URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'qa/screenshots'), REPORTS = join(ROOT, 'qa/reports')
mkdirSync(SHOTS, { recursive: true }); mkdirSync(REPORTS, { recursive: true })
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = [], errors = [], failed = []
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', error => errors.push(String(error)))
page.on('requestfailed', request => failed.push(`${request.url()} :: ${request.failure()?.errorText}`))
const assert = (value, name, detail = '') => { if (!value) throw Error(`${name}: ${detail}`); results.push({ name, status: 'PASS', detail }); console.log('PASS', name, detail) }

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
const clip = page.locator('[data-testid="timeline-clip"][data-kind="audio"]')
await clip.waitFor()
const waveform = clip.getByTestId('clip-waveform')
await waveform.waitFor()
const initial = await waveform.evaluate(element => {
  const bars = [...element.querySelectorAll('i')]
  const peaks = bars.map(bar => Number(bar.dataset.peak))
  const heights = bars.map(bar => parseFloat(getComputedStyle(bar).height))
  return { bins: bars.length, uniquePeaks: new Set(peaks).size, minPeak: Math.min(...peaks), maxPeak: Math.max(...peaks), maxHeight: Math.max(...heights), volume: element.dataset.appliedVolume }
})
assert(initial.bins === 256, 'waveform uses 256 decoded source bins', String(initial.bins))
assert(initial.uniquePeaks > 25, 'waveform contains varied source amplitude data', String(initial.uniquePeaks))
assert(initial.maxPeak > initial.minPeak, 'loud and quiet source regions differ', `${initial.minPeak}..${initial.maxPeak}`)
assert(initial.volume === '1.000', 'waveform starts at full clip gain')

await clip.click()
const volumeField = page.getByText('Volume', { exact: true }).locator('..')
const volumeSlider = volumeField.locator('input[type="range"]')
await volumeSlider.evaluate(input => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, '0.25')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForFunction(() => document.querySelector('[data-testid="clip-waveform"]')?.getAttribute('data-applied-volume') === '0.250')
const reduced = await waveform.evaluate(element => ({
  volume: element.dataset.appliedVolume,
  maxHeight: Math.max(...[...element.querySelectorAll('i')].map(bar => parseFloat(getComputedStyle(bar).height))),
}))
assert(reduced.volume === '0.250', 'waveform records current clip gain')
assert(reduced.maxHeight < initial.maxHeight * 0.4, 'visible amplitude scales down with volume', `${initial.maxHeight} -> ${reduced.maxHeight}`)
await page.screenshot({ path: join(SHOTS, 'audio-waveform-volume-25.png') })

await volumeSlider.evaluate(input => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, '0')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForFunction(() => document.querySelector('[data-testid="clip-waveform"]')?.getAttribute('data-applied-volume') === '0.000')
const mutedHeights = await waveform.locator('i').evaluateAll(bars => bars.map(bar => parseFloat(getComputedStyle(bar).height)))
assert(Math.max(...mutedHeights) <= 1, 'zero volume collapses waveform to center line', String(Math.max(...mutedHeights)))
const unexpectedFailed = failed.filter(entry => !(entry.startsWith('blob:') && entry.includes('ERR_ABORTED')))
assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))
assert(unexpectedFailed.length === 0, 'zero unexpected request failures', unexpectedFailed.join(' | '))
writeFileSync(join(REPORTS, 'audio-waveform-results.json'), JSON.stringify({ results, initial, reduced, errors, failed, unexpectedFailed }, null, 2))
console.log(`RESULT ${results.length} PASS`)
await browser.close()
