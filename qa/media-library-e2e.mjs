import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'qa/screenshots')
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(SHOTS, { recursive: true })
mkdirSync(REPORTS, { recursive: true })
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = [], errors = [], failed = []
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', (error) => errors.push(String(error)))
page.on('requestfailed', (request) => failed.push(`${request.url()} :: ${request.failure()?.errorText}`))
const assert = (value, name, detail = '') => {
  if (!value) throw new Error(`${name}: ${detail}`)
  results.push({ name, status: 'PASS', detail })
  console.log('PASS', name, detail)
}

await page.goto(URL, { waitUntil: 'networkidle' })
assert(await page.getByTitle('Media library').count() === 1, 'one combined Media Library rail control')
assert(await page.getByTitle('Audio').count() === 0, 'separate Audio rail control removed')
assert(await page.getByTestId('media-search').isVisible(), 'media search is visible')
assert(await page.getByTestId('media-type-filter').isVisible(), 'type filter is visible')

await page.getByTestId('panel-all-import-input').setInputFiles([
  join(ROOT, 'qa/fixtures/pexels-cinematic-8s.webm'),
  join(ROOT, 'qa/fixtures/pexels-landscape-962322.jpg'),
  join(ROOT, 'qa/fixtures/test-audio-6s.ogg'),
])
await page.waitForFunction(() => document.querySelectorAll('[data-testid="media-asset"]').length === 3)
assert(await page.getByTestId('media-asset').count() === 3, 'combined library shows video image and audio')
for (const kind of ['video', 'image', 'audio']) {
  assert(await page.locator(`[data-testid="media-asset"][data-asset-kind="${kind}"]`).count() === 1, `${kind} item retains its type identity`)
}
await page.screenshot({ path: join(SHOTS, 'media-library-all-types.png') })
await page.setViewportSize({ width: 1920, height: 1080 })
await page.waitForTimeout(120)
await page.screenshot({ path: join(SHOTS, 'media-library-wide-1920x1080.png') })
await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(120)

await page.getByTestId('media-type-filter').selectOption('audio')
assert(await page.getByTestId('media-asset').count() === 1, 'audio music filter isolates audio')
assert(await page.getByTestId('media-asset').getAttribute('data-asset-kind') === 'audio', 'filtered result is audio')
await page.screenshot({ path: join(SHOTS, 'media-library-audio-filter.png') })

await page.getByTestId('media-type-filter').selectOption('all')
await page.getByTestId('media-search').fill('landscape')
assert(await page.getByTestId('media-asset').count() === 1, 'search filters by filename')
assert((await page.getByTestId('media-asset').getAttribute('data-asset-kind')) === 'image', 'search result preserves image identity')
await page.screenshot({ path: join(SHOTS, 'media-library-search.png') })

await page.getByTestId('media-search').fill('missing-file')
assert(await page.getByText('No media matches this search').isVisible(), 'empty search state is clear')
await page.screenshot({ path: join(SHOTS, 'media-library-empty-search.png') })
await page.getByTestId('media-search').fill('')

await page.setViewportSize({ width: 900, height: 700 })
await page.waitForTimeout(200)
assert(await page.getByTestId('left-panel').getAttribute('data-open') === 'false', 'narrow viewport collapses panel automatically')
await page.getByTitle('Media library').click()
await page.waitForTimeout(220)
assert(await page.getByTestId('media-search').isVisible(), 'combined panel can reopen at narrow width')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
assert(!overflow, 'narrow viewport has no horizontal overflow')
await page.screenshot({ path: join(SHOTS, 'media-library-narrow-900x700.png') })
await page.setViewportSize({ width: 768, height: 720 })
await page.waitForTimeout(220)
await page.getByTitle('Media library').click()
await page.waitForTimeout(220)
const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
assert(!tabletOverflow, '768px viewport has no horizontal overflow')
await page.screenshot({ path: join(SHOTS, 'media-library-compact-768x720.png') })

assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))
// Chromium reports an in-flight object URL as aborted when responsive panel
// teardown releases a media consumer; the project-level URL remains valid.
const unexpectedFailed = failed.filter((entry) => !(entry.startsWith('blob:') && entry.includes('ERR_ABORTED')))
assert(unexpectedFailed.length === 0, 'zero unexpected failed requests', unexpectedFailed.join(' | '))
writeFileSync(join(REPORTS, 'media-library-results.json'), JSON.stringify({ results, errors, failed, unexpectedFailed }, null, 2))
console.log(`RESULT ${results.length} PASS`)
await browser.close()
