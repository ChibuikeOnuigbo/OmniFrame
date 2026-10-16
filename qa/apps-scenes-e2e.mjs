/**
 * Apps & Devices pack + Scene Recipes QA.
 * Run: URL=http://localhost:5173/#studio node qa/apps-scenes-e2e.mjs
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
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.getByTestId('left-tab-pack').evaluate((el) => el.click())
  await page.getByTestId('desktop-pack-panel').waitFor({ state: 'visible' })

  // Sections include Apps & Devices and Scene Recipes.
  await page.getByTestId('pack-section-apps').waitFor({ state: 'visible' })
  await page.getByTestId('pack-section-scenes').waitFor({ state: 'visible' })

  // Apps: demo-text recreations add real clips.
  await page.getByTestId('pack-section-apps').click()
  await page.getByTestId('pack-asset-spotify-desktop').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId === 'pack-spotify-desktop'))
  const phoneFolder = page.getByTestId('pack-folder-toggle-apps-Phones')
  if (await phoneFolder.count()) await phoneFolder.click()
  await page.getByTestId('pack-asset-phone-android-home').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId === 'pack-phone-android-home'))
  await page.getByTestId('pack-section-windows').click()
  await page.getByTestId('pack-bundle-music-video').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.length >= 4)
  console.log('PASS apps pack assets + bundle add clips')

  // Seed a base clip for recipes (built-in demo image asset).
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st = store.getState()
    const trackId = st.tracks.find((t) => t.type === 'video')?.id || st.createTrack('video')
    st.addClipToTrack(trackId, 'asset-death-note-img', 20)
    const clip = store.getState().clips.find((c) => c.start === 20)
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 21 })
  })

  await page.getByTestId('pack-section-scenes').click()
  // Recipes that need a clip enable once one is selected.
  await page.getByTestId('pack-recipe-freeze-pop').waitFor({ state: 'visible' })
  assert.equal(await page.getByTestId('pack-recipe-freeze-pop').isEnabled(), true, 'freeze-pop should enable with a clip selected')

  await page.getByTestId('pack-recipe-vertical-version').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().sequenceSettings?.aspectRatio === '9:16')
  console.log('PASS vertical-version recipe switches sequence to 9:16')

  await page.getByTestId('pack-recipe-freeze-pop').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((a) => a.id.startsWith('freeze-')))
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId.startsWith('freeze-')))
  const note = await page.getByTestId('pack-recipe-note').textContent()
  assert.match(note ?? '', /Freeze-pop built/)
  console.log('PASS freeze-pop builds freeze frame + title')

  const textBefore = await page.evaluate(() => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'text').length)
  await page.getByTestId('pack-recipe-caption-burst').click()
  await page.waitForFunction((n) => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'text').length >= n + 3, textBefore)
  console.log('PASS caption-burst adds editable caption clips')

  await page.getByTestId('pack-recipe-punch-in').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => (c.transform?.scale ?? 1) > 1.1))
  console.log('PASS punch-in splits and scales the middle clip')

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`)
  console.log('APPS+SCENES E2E PASSED')
} finally {
  await browser.close()
}
