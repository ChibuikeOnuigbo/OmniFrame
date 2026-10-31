/**
 * ProPainter-style propagation controls QA: donor direction/window + mask
 * grow persist in state and render in the Analyze & Inpaint section.
 * Run: URL=http://localhost:5173/#studio node qa/inpaint-propagation-e2e.mjs
 */
import assert from 'node:assert/strict'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.setDefaultTimeout(15000)
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]')
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st = store.getState()
    const trackId = st.tracks[0]?.id || st.createTrack('video')
    st.addClipToTrack(trackId, 'asset-death-note-img', 0)
    const clip = store.getState().clips[0]
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 0.5 })
  })
  await page.getByTestId('left-tab-omniframe').click()
  await page.waitForTimeout(400)
  await page.getByTestId('omniframe-section-rotomask').click()
  await page.getByTestId('rotomask-subtool').waitFor({ state: 'visible' })

  const trigger = page.locator('#panel-section-trigger-roto-inpaint')
  if (await trigger.count()) await trigger.click()
  else await page.getByTestId('section-tab-roto-inpaint').click()
  await page.getByTestId('roto-inpaint-propagation').waitFor({ state: 'visible' })

  // Defaults.
  const defaults = await page.evaluate(() => window.__omniframe_store.getState().rotoInpaint)
  assert.equal(defaults.maskGrow, 4)
  assert.equal(defaults.donorDirection, 'both')
  assert.equal(defaults.donorWindow, 0)

  // UI writes through to the store.
  await page.getByTestId('roto-donor-direction').selectOption('earlier')
  await page.getByTestId('roto-mask-grow').fill('12')
  await page.getByTestId('roto-donor-window').fill('30')
  const after = await page.evaluate(() => window.__omniframe_store.getState().rotoInpaint)
  assert.equal(after.donorDirection, 'earlier')
  assert.equal(after.maskGrow, 12, `maskGrow ${after.maskGrow}`)
  assert.equal(after.donorWindow, 30, `donorWindow ${after.donorWindow}`)

  // Store setter clamps.
  await page.evaluate(() => window.__omniframe_store.getState().setRotoInpaintOptions({ maskGrow: 99, donorWindow: -5 }))
  const clamped = await page.evaluate(() => window.__omniframe_store.getState().rotoInpaint)
  assert.equal(clamped.maskGrow, 24)
  assert.equal(clamped.donorWindow, 0)

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`)
  console.log('INPAINT PROPAGATION E2E PASSED')
} finally {
  await browser.close()
}
