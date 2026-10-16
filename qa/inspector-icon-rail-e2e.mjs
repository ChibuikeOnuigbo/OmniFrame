/**
 * Inspector layout (user redesign): general clip sections (General,
 * Transform, Mask, Appearance, Audio, Effects, Text, Source) live as icons
 * on a vertical rail at the inspector's right edge — not in the horizontal
 * pill train. Remaining sections keep the train, whose edge arrows reserve
 * a lane so no chip sits under an arrow.
 */
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const pass = (label) => console.log(`[PASS] ${label}`)

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => Boolean(window.__omniframe_store))
await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const t = s.createTrack('video')
  s.addClipToTrack(t, 'asset-death-note-vid', 0)
  const st = window.__omniframe_store.getState()
  st.selectClip(st.clips[0]?.id)
  st.setRightOpen(true)
})
pass('video clip selected, inspector open')

// The icon rail exists at the inspector's right edge with the general set.
const rail = page.getByTestId('sections-icon-rail')
await rail.waitFor({ state: 'visible' })
const railIds = await rail.evaluate((el) => [...el.querySelectorAll('button')].map((b) => b.getAttribute('data-testid')))
for (const id of ['clip', 'transform', 'video-mask-view', 'appearance', 'audio', 'source']) {
  assert.ok(railIds.includes(`section-tab-${id}`), `rail has ${id}`)
}
pass(`icon rail holds the general sections: ${railIds.join(', ')}`)

// Rail buttons are icon-only (no text pills) but labelled for AT.
const transformBtn = page.getByTestId('section-tab-transform')
assert.equal(await transformBtn.getAttribute('aria-label'), 'Transform section')
assert.equal((await transformBtn.innerText()).trim(), '')
pass('rail buttons are icons with accessible names, no pills')

// Clicking the Transform icon shows the Transform section body.
await transformBtn.click()
await page.waitForTimeout(300)
assert.equal(await transformBtn.getAttribute('aria-selected'), 'true')
const transformVisible = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="inspector-panel"]')
  return el ? el.textContent.includes('Position X') : false
})
assert.ok(transformVisible, 'transform controls visible after rail click')
pass('Transform icon activates the Transform section')

// Mask icon activates Video Mask View.
await page.getByTestId('section-tab-video-mask-view').click()
await page.waitForTimeout(300)
const maskVisible = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="inspector-panel"]')
  return el ? el.textContent.includes('Video Mask View') : false
})
assert.ok(maskVisible, 'mask view controls visible after rail click')
pass('Mask icon activates Video Mask View')

// The horizontal train must NOT contain the general sections anymore.
const stripTexts = await page.evaluate(() => {
  const strip = document.querySelector('[data-testid="sections-tablist"]')
  if (!strip) return null
  return [...strip.querySelectorAll('button')].map((b) => b.getAttribute('data-testid'))
})
if (stripTexts) {
  for (const id of ['clip', 'transform', 'audio', 'appearance']) {
    assert.ok(!stripTexts.includes(`section-tab-${id}`), `train must not hold ${id}`)
  }
}
pass(`horizontal train no longer carries general sections (${JSON.stringify(stripTexts)})`)

// Audio icon also activates (audio is a general section too).
await page.getByTestId('section-tab-audio').click()
await page.waitForTimeout(300)
assert.equal(await page.getByTestId('section-tab-audio').getAttribute('aria-selected'), 'true')
pass('Audio icon activates the Audio section')

assert.equal(errors.length, 0, `page errors: ${errors.join(' | ')}`)
pass('zero page errors')
await page.screenshot({ path: 'evidence/screenshots/omniframe-inspector-icon-rail.png', fullPage: false }).catch(() => {})
await browser.close()
console.log('[DONE] inspector-icon-rail-e2e')
