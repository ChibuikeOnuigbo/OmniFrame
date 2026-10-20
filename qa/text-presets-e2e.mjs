/**
 * Text Preset Library (from tutorial.md): procedural presets, the
 * character-count mapping rules, and UI wiring.
 *  A. every preset builds real editable clips from a single click
 *  B. char-count mapping: 2-char and 16-char texts both map without loss
 *  C. guidance text reacts to length (sweet spot / too short / long)
 *  D. seeded looks are deterministic (same seed -> same structure)
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

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

await page.locator('[data-testid="left-tab-text"]').click()
await page.waitForTimeout(600)
await page.locator('[data-testid="text-submode-library-btn"]').click()
await page.waitForTimeout(400)
const index = await page.evaluate(() => window.__omniframe_text_presets)
assert(Array.isArray(index) && index.length >= 20, 'A preset index exposed', `n=${index?.length}`)

// --- A. every preset builds --------------------------------------------------
const buildStats = await page.evaluate((presets) => {
  const store = window.__omniframe_store
  const results = {}
  for (const p of presets) {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    store.getState().createTrack('video')
    const ids = window.__omniframe_build_text_preset(p.id, p.demo)
    const clips = store.getState().clips
    results[p.id] = { ids: ids.length, clips: clips.length, keyframed: clips.filter((c) => c.animation && Object.values(c.animation.curves).some((cv) => cv.keyframes.length)).length }
  }
  return results
}, index)
const broken = Object.entries(buildStats).filter(([, v]) => v.clips === 0)
assert(broken.length === 0, 'A all presets build clips', JSON.stringify(broken))
const staticOnes = Object.entries(buildStats).filter(([, v]) => v.keyframed === 0).map(([k]) => k)
assert(staticOnes.length <= 3, 'A nearly all presets are animated (keyframed)', staticOnes.join(','))

// --- B. character-count mapping -----------------------------------------------
const mapping = await page.evaluate(() => {
  const store = window.__omniframe_store
  const run = (text) => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    const ids = window.__omniframe_build_text_preset('bounce-letters', text)
    return { ids: ids.length, clips: store.getState().clips.length }
  }
  return { two: run('GO'), six: run('BOUNCE'), sixteen: run('ABCDEFGHIJKLMNOP') }
})
assert(mapping.two.clips >= 2 && mapping.six.clips >= 6 && mapping.sixteen.clips >= 16, 'B 2/6/16-char texts all map per-letter', JSON.stringify(mapping))
const retroMap = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
  window.__omniframe_build_text_preset('retro-traditional', 'UP')
  const short = store.getState().clips.length
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
  window.__omniframe_build_text_preset('retro-traditional', 'EXTRAVAGANZA')
  return { short, long: store.getState().clips.length }
})
assert(retroMap.short > 0 && retroMap.long > retroMap.short, 'B retro maps short + long texts (normalized positions)', JSON.stringify(retroMap))

// --- D. determinism --------------------------------------------------------------
const det = await page.evaluate(() => {
  const store = window.__omniframe_store
  const snap = () => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    window.__omniframe_build_text_preset('retro-traditional', 'NOELLE', 7)
    return store.getState().clips.map((c) => `${c.name}|${c.start.toFixed(3)}|${c.duration.toFixed(3)}|${c.transform.x.toFixed(1)}|${c.textStyle?.text}`).join(';')
  }
  return { a: snap(), b: snap() }
})
assert(det.a === det.b && det.a.length > 50, 'D same seed + text = identical structure')

// --- C. UI + guidance -----------------------------------------------------------------
await page.evaluate(() => window.__omniframe_store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 }))
await page.locator('[data-testid="preset-text-input"]').fill('HI')
await page.locator('[data-testid="text-preset-lib-bounce-letters"]').click()
await page.waitForTimeout(300)
let guidance = await page.locator('[data-testid="preset-guidance"]').innerText()
assert(guidance.includes('best with'), 'C guidance warns for 2-char text on a 3+ preset', guidance)
const built = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
assert(built >= 2, 'C UI build created clips', `n=${built}`)
await page.locator('[data-testid="preset-text-input"]').fill('PERFECT')
await page.locator('[data-testid="text-preset-lib-bounce-letters"]').click()
await page.waitForTimeout(300)
guidance = await page.locator('[data-testid="preset-guidance"]').innerText()
assert(guidance.includes('sweet spot'), 'C guidance confirms sweet-spot length', guidance)

await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.85))
await page.waitForTimeout(500)
await page.screenshot({ path: join(OUT, '23-text-presets.png') })

await browser.close()
if (failures) { console.error(`TEXT PRESETS SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('TEXT PRESETS SUITE: ALL PASS')
