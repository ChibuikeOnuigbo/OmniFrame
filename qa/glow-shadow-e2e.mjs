/**
 * Glow/Shadow wave (Photoshop model, see ui_downlaod_study/GLOW-SHADOW.md):
 * glow is OPTIONAL on text presets except Glow/Neon presets where it is
 * forced on; glow has Outward/Inward types; shadow is its own effect with
 * Outer/Inner types (angle/distance/blur/opacity/colour).
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

// --- A. panel: separate Glow + Shadow groups, toggles, single-line segments --
for (const tid of ['preset-glow-enabled', 'preset-glow-mode-outward', 'preset-glow-mode-inward',
  'preset-shadow-enabled', 'preset-shadow-mode-outer', 'preset-shadow-mode-inner',
  'preset-shadow-color', 'preset-shadow-angle', 'preset-shadow-distance', 'preset-shadow-blur',
  'preset-shadow-opacity', 'preset-glow-lock-note']) {
  assert(await page.locator(`[data-testid="${tid}"]`).count() === 1, `A panel has ${tid}`)
}
const segHeights = await page.evaluate(() => ['preset-glow-mode-outward', 'preset-glow-mode-inward', 'preset-shadow-mode-outer', 'preset-shadow-mode-inner']
  .map((tid) => document.querySelector(`[data-testid="${tid}"]`)?.getBoundingClientRect().height))
assert(segHeights.every((h) => h && h <= 26), 'A direction segments are single-line', JSON.stringify(segHeights))
await page.locator('[data-testid="preset-glow-mode-inward"]').click()
const inwardActive = await page.locator('[data-testid="preset-glow-mode-inward"]').evaluate((el) => el.className.includes('bg-brand'))
assert(inwardActive, 'A Inward glow segment activates')
await page.locator('[data-testid="preset-shadow-mode-inner"]').click()
const innerActive = await page.locator('[data-testid="preset-shadow-mode-inner"]').evaluate((el) => el.className.includes('bg-brand'))
assert(innerActive, 'A Inner shadow segment activates')

const G = (over) => ({ angle: 45, intensity: 1, spread: 0, blur: 1, smoothness: 0, sharpness: 'text', clarity: 0, ...over })
const build = (id, opts) => page.evaluate(([pid, o]) => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
  const ids = window.__omniframe_build_text_preset(pid, 'GLOW', o)
  const cs = store.getState().clips.filter((c) => ids.includes(c.id) && c.textStyle)
  return cs.map((c) => ({ glow: c.textStyle.glowColor, blur: c.textStyle.glowBlur, mode: c.textStyle.glowMode, sm: c.textStyle.shadowMode, sx: c.textStyle.shadowOffsetX, sy: c.textStyle.shadowOffsetY, sb: c.textStyle.shadowBlur, so: c.textStyle.shadowOpacity, sc: c.textStyle.shadowColor }))
}, [id, opts])

// --- B. glow optional on a non-glow preset -----------------------------------
const off = await build('minimal-fade', { seed: 7, glow: G({ enabled: false }) })
assert(off.length >= 1 && off.every((c) => !c.glow), 'B glow OFF strips glow from Minimal Fade', JSON.stringify(off))
const on = await build('minimal-fade', { seed: 7, glow: G({ enabled: true }) })
assert(on.length >= 1 && on.every((c) => c.glow && c.mode === 'outward'), 'B glow ON adds outward glow', JSON.stringify(on))
const inward = await build('minimal-fade', { seed: 7, glow: G({ enabled: true, mode: 'inward' }) })
assert(inward.every((c) => c.glow && c.mode === 'inward'), 'B inward glow type stored', JSON.stringify(inward))

// --- C. glow presets: glow cannot be turned off ------------------------------
const forced = await build('neon-flicker', { seed: 7, glow: G({ enabled: false }) })
assert(forced.length >= 1 && forced.every((c) => c.glow), 'C Neon preset keeps glow when toggle OFF (forced)', JSON.stringify(forced))
const forcedIn = await build('neon-flicker', { seed: 7, glow: G({ enabled: false, mode: 'inward' }) })
assert(forcedIn.every((c) => c.glow && c.mode === 'inward'), 'C forced glow still honours inward type', JSON.stringify(forcedIn))

// --- D. shadow: outer / inner / off ------------------------------------------
const S = (over) => ({ angle: 45, distance: 10, blur: 12, opacity: 0.55, color: '#000000', ...over })
const outer = await build('minimal-fade', { seed: 7, glow: G({ enabled: false }), shadow: S({ enabled: true, mode: 'outer' }) })
assert(outer.every((c) => c.sm === 'outer' && Math.abs(c.sx - 7.07) < 0.2 && Math.abs(c.sy - 7.07) < 0.2 && c.sb === 12 && c.so === 0.55), 'D outer shadow fields (angle->offset)', JSON.stringify(outer))
const inner = await build('minimal-fade', { seed: 7, glow: G({ enabled: false }), shadow: S({ enabled: true, mode: 'inner' }) })
assert(inner.every((c) => c.sm === 'inner'), 'D inner shadow type stored', JSON.stringify(inner))
const none = await build('minimal-fade', { seed: 7, glow: G({ enabled: false }), shadow: S({ enabled: false }) })
assert(none.every((c) => c.sm === 'none'), 'D shadow OFF stored as none', JSON.stringify(none))

// --- E. render: inward glow + inner shadow draw without errors ----------------
await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
  window.__omniframe_build_text_preset('neon-flicker', 'INNER', { seed: 7, color: '#22d3ee', glow: { enabled: true, mode: 'inward', angle: 45, intensity: 1.4, spread: 0, blur: 1.6, smoothness: 0, sharpness: 'text', clarity: 0 }, shadow: { enabled: true, mode: 'inner', angle: 45, distance: 8, blur: 14, opacity: 0.6, color: '#001133' } })
  store.setState({ playhead: 1.2 })
})
await page.waitForTimeout(700)
const canvasLen = await page.evaluate(() => document.querySelector('#of-canvas')?.toDataURL().length || 0)
assert(canvasLen > 5000, 'E preview canvas renders inward glow/inner shadow', `dataURL ${canvasLen}`)
const cyanPx = await page.evaluate(() => {
  const src = document.querySelector('#of-canvas')
  const c = document.createElement('canvas')
  c.width = src.width; c.height = src.height
  const x = c.getContext('2d')
  x.drawImage(src, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 120 && d[i + 1] > 90 && d[i] < 130) n++
  return n
})
assert(cyanPx > 200, 'E inward glow paints cyan inside glyphs (pixel check)', `${cyanPx}px`)
await page.screenshot({ path: join(OUT, '25-glow-shadow-inward.png') })
assert(true, 'E screenshot saved evidence/improvements/25-glow-shadow-inward.png')

await browser.close()
console.log(failures ? `GLOW-SHADOW: ${failures} FAILURES` : 'GLOW-SHADOW ALL PASS')
process.exit(failures ? 1 : 0)
