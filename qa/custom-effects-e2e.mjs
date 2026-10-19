/**
 * Custom effects (Gold Motion-style, OmniFrame form) E2E:
 * dial in a look (effect settings + LUT) on a clip → Save look in the
 * Effects panel → card with preview thumbnail appears → Apply to another
 * clip (settings + LUT stack replaced) → Place as adjustment layer →
 * Export .omniframe-effect.json → delete → Import restores it →
 * .omni project round-trips the library.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })
const assert = (cond, name, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exit(1) }
  console.log(`PASS ${name} ${extra}`)
}

// PW_EXE lets sandboxes without a Playwright browser download point at a
// local Chromium binary; normal environments use the bundled browser.
const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const IDENTITY_CUBE = [
  'TITLE "QA Warm"',
  'LUT_3D_SIZE 2',
  '0 0 0', '1 0 0', '0 0.6 0.1', '1 0.6 0.1',
  '0.1 0.2 1', '1 0.2 1', '0.1 0.8 1', '1 0.8 1',
].join('\n')

const seeded = await page.evaluate((cube) => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], customEffects: [], selectedClipId: null, playhead: 0 })
  try { localStorage.removeItem('omniframe.customEffects') } catch { /* ignore */ }
  const s = store.getState()
  const mk = (id, color) => {
    const c = document.createElement('canvas')
    c.width = 640; c.height = 360
    const g = c.getContext('2d')
    g.fillStyle = color; g.fillRect(0, 0, 640, 360)
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(320, 180, 60, 0, 7); g.fill()
    s.addAsset({ id, name: `${id}.png`, kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
    const trackId = s.createTrack('video')
    s.addClipToTrack(trackId, id, 0)
    return store.getState().clips.find((cl) => cl.assetId === id).id
  }
  const c1 = mk('fx-src', '#3b82f6')
  const c2 = mk('fx-dst', '#22c55e')
  s.setClipEffect(c1, { sepia: 0.6, hueRotate: 40, brightness: 1.25, lightType: 'point', lightIntensity: 0.7, lightColor: '#ffb37a' })
  s.addLutToClip(c1, { name: 'QA Warm', cubeText: cube, intensity: 0.8 })
  s.selectClip(c1)
  return { c1, c2 }
}, IDENTITY_CUBE)
await page.waitForTimeout(800)

// --- UI save flow ----------------------------------------------------
await page.getByTestId('left-tab-effects').click()
await page.waitForTimeout(600)
{
  const chip = page.locator('[data-testid="section-tab-custom-effects-section"]')
  if ((await chip.count()) > 0) {
    if ((await chip.getAttribute('aria-selected')) !== 'true') await chip.click()
  } else {
    await page.locator('[data-testid="panel-section-custom-effects-section"] > button').first().click()
  }
  await page.waitForTimeout(400)
}
await page.getByTestId('custom-effect-name').scrollIntoViewIfNeeded()
await page.getByTestId('custom-effect-name').fill('Ball Action QA')
await page.getByTestId('save-custom-effect-btn').click()
await page.waitForTimeout(400)
const saved = await page.evaluate(() => {
  const st = window.__omniframe_store.getState()
  const fx = st.customEffects[0]
  const stored = JSON.parse(localStorage.getItem('omniframe.customEffects') || '[]')
  return {
    count: st.customEffects.length,
    name: fx?.name,
    sepia: fx?.effect?.sepia,
    lut: fx?.luts?.[0]?.name,
    thumb: typeof fx?.thumbnail === 'string' && fx.thumbnail.startsWith('data:image/jpeg'),
    persisted: stored.length === 1 && stored[0].name === 'Ball Action QA',
  }
})
assert(saved.count === 1 && saved.name === 'Ball Action QA', 'Save look creates the custom effect', JSON.stringify(saved))
assert(saved.sepia === 0.6 && saved.lut === 'QA Warm', 'snapshot carries effect settings + LUT', JSON.stringify(saved))
assert(saved.thumb && saved.persisted, 'preview thumbnail captured and library persisted to localStorage')
const fxId = await page.evaluate(() => window.__omniframe_store.getState().customEffects[0].id)
await page.getByTestId(`custom-effect-${fxId}`).waitFor({ timeout: 5000 })

// --- Apply to another clip -------------------------------------------
await page.evaluate((dst) => window.__omniframe_store.getState().selectClip(dst), seeded.c2)
await page.waitForTimeout(300)
await page.getByTestId(`custom-effect-apply-${fxId}`).click()
await page.waitForTimeout(300)
const applied = await page.evaluate((dst) => {
  const clip = window.__omniframe_store.getState().clips.find((c) => c.id === dst)
  return { sepia: clip.effects?.sepia, hue: clip.effects?.hueRotate, bright: clip.effects?.brightness, lut: clip.adjustment?.luts?.[0]?.name, lutI: clip.adjustment?.luts?.[0]?.intensity }
}, seeded.c2)
assert(applied.sepia === 0.6 && applied.hue === 40 && applied.bright === 1.25 && applied.lut === 'QA Warm' && applied.lutI === 0.8,
  'Apply replaces the target clip’s settings + LUT stack', JSON.stringify(applied))

// --- Place as adjustment layer ---------------------------------------
const layersBefore = await page.evaluate(() => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'adjustment').length)
await page.getByTestId(`custom-effect-layer-${fxId}`).click()
await page.waitForTimeout(300)
const layered = await page.evaluate(() => {
  const st = window.__omniframe_store.getState()
  const layer = st.clips.find((c) => c.kind === 'adjustment' && c.name === 'Ball Action QA')
  return { count: st.clips.filter((c) => c.kind === 'adjustment').length, sepia: layer?.effects?.sepia, lut: layer?.adjustment?.luts?.[0]?.name }
})
assert(layered.count === layersBefore + 1 && layered.sepia === 0.6 && layered.lut === 'QA Warm',
  'Layer places the custom effect as an adjustment layer', JSON.stringify(layered))

// temp audition must not commit (clicking the card body)
await page.evaluate(() => window.__omniframe_store.getState().visualPreview && window.__omniframe_store.setState({ visualPreview: null }))
await page.getByTestId(`custom-effect-${fxId}`).locator('button').first().click()
await page.waitForTimeout(500)
const audition = await page.evaluate(() => !!window.__omniframe_store.getState().visualPreview)
assert(audition, 'clicking the card auditions a temporary preview (no commit)')

await page.screenshot({ path: join(OUT, '13-custom-effects.png') })
console.log('SCREENSHOT 13-custom-effects.png')

// --- Export → delete → import round trip ------------------------------
const downloadPromise = page.waitForEvent('download')
await page.getByTestId(`custom-effect-export-${fxId}`).click()
const download = await downloadPromise
const filePath = join('/tmp', await download.suggestedFilename())
await download.saveAs(filePath)
const doc = JSON.parse(readFileSync(filePath, 'utf8'))
assert(doc.kind === 'omniframe-custom-effect' && doc.name === 'Ball Action QA' && doc.effect.sepia === 0.6 && doc.luts?.[0]?.name === 'QA Warm',
  'exported file is a self-describing custom-effect JSON', await download.suggestedFilename())

await page.getByTestId(`custom-effect-delete-${fxId}`).click()
await page.waitForTimeout(300)
assert(await page.evaluate(() => window.__omniframe_store.getState().customEffects.length) === 0, 'delete removes the custom effect')

await page.getByTestId('import-custom-effects-input').setInputFiles(filePath)
await page.waitForTimeout(400)
const imported = await page.evaluate(() => window.__omniframe_store.getState().customEffects[0])
assert(imported?.name === 'Ball Action QA' && imported.effect.sepia === 0.6, 'import restores the custom effect from file')

// --- .omni round trip ---------------------------------------------------
const omni = await page.evaluate(async () => {
  const store = window.__omniframe_store
  const blob = await store.getState().saveOmniProject('Custom FX Round Trip')
  store.setState({ customEffects: [] })
  const file = new File([blob], 'fx.omni', { type: 'application/octet-stream' })
  await store.getState().loadOmniProject(file)
  const list = store.getState().customEffects
  return { size: blob.size, count: list.length, name: list[0]?.name, sepia: list[0]?.effect?.sepia }
})
assert(omni.count === 1 && omni.name === 'Ball Action QA' && omni.sepia === 0.6, '.omni project round-trips the custom-effects library', JSON.stringify(omni))

console.log('CUSTOM EFFECTS SUITE PASSED')
await browser.close()
