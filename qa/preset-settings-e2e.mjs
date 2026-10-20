/**
 * Preset settings wave: 5 typewriter formes, per-animation settings
 * (char/word spacing with auto caps, duration, delay, graph), glow stack
 * (angle/intensity/spread/blur/smoothness/sharpness/clarity), word-pop
 * collision fix, scramble filler growth. See animation_study.md.
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

// --- A. five typewriter formes ---------------------------------------------
const formes = await page.evaluate(() => {
  const store = window.__omniframe_store
  const out = {}
  for (const f of ['bar', 'block', 'underscore', 'caret', 'highlight']) {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    const ids = window.__omniframe_build_text_preset(`typewriter-${f}`, 'TYPING')
    const clips = store.getState().clips
    const cursor = clips.find((c) => c.name.startsWith('cursor'))
    out[f] = { clips: ids.length, glyph: cursor?.textStyle?.text, stepped: cursor?.animation?.curves?.position_x?.keyframes?.length > 3 }
  }
  return out
})
assert(Object.values(formes).every((f) => f.clips >= 7 && f.stepped), 'A all 5 formes build letters + moving cursor', JSON.stringify(formes))
assert(new Set(Object.values(formes).map((f) => f.glyph)).size === 5, 'A 5 distinct cursor glyphs', JSON.stringify(Object.values(formes).map((f) => f.glyph)))

// --- B. spacing caps maths + clamping ---------------------------------------
const caps = await page.evaluate(() => ({
  short: window.__omniframe_spacing_caps('HI'),
  long: window.__omniframe_spacing_caps('EXTRAVAGANZA IS LONG'),
}))
assert(caps.short.charMax > caps.long.charMax && caps.long.charMax >= 0, 'B longer text => smaller char-spacing cap', JSON.stringify(caps))
const span = await page.evaluate(() => {
  const store = window.__omniframe_store
  const measure = (sp) => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    window.__omniframe_build_text_preset('rainbow-letters', 'WIDE', { seed: 7, charSpacing: sp })
    const xs = store.getState().clips.map((c) => c.transform.x)
    return Math.max(...xs) - Math.min(...xs)
  }
  return { tight: measure(0), loose: measure(60), clamped: measure(100000) }
})
assert(span.loose > span.tight + 100, 'B char spacing widens letter layout', JSON.stringify(span))
assert(span.clamped > span.loose && span.clamped <= 1766, 'B absurd spacing clamps to the auto cap and still fits the preview', JSON.stringify(span))

// --- C. word-pop: no collisions, word spacing honoured -----------------------
const wp = await page.evaluate(() => {
  const store = window.__omniframe_store
  const run = (ws) => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    window.__omniframe_build_text_preset('word-pop', 'WIDE WORDS COLLIDE HERE', { seed: 7, wordSpacing: ws })
    const cs = store.getState().clips.filter((c) => c.textStyle?.text).sort((a, b) => a.transform.x - b.transform.x)
    // measured widths via same canvas metrics the builder uses
    const cv = document.createElement('canvas').getContext('2d')
    cv.font = '700 68px "Arial Black", sans-serif'
    let minGap = Infinity
    for (let i = 1; i < cs.length; i++) {
      const wPrev = cv.measureText(cs[i - 1].textStyle.text).width
      const wCur = cv.measureText(cs[i].textStyle.text).width
      minGap = Math.min(minGap, (cs[i].transform.x - wCur / 2) - (cs[i - 1].transform.x + wPrev / 2))
    }
    return minGap
  }
  return { gap0: run(0), gap60: run(60) }
})
assert(wp.gap0 >= 8, 'C word-pop words never collide (measured gap)', JSON.stringify(wp))
assert(wp.gap60 > wp.gap0 + 30, 'C word spacing setting widens gaps', JSON.stringify(wp))

// --- D. duration + delay ------------------------------------------------------
const timing = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 1, duration: 12 })
  window.__omniframe_build_text_preset('bounce-letters', 'TIME', { seed: 7, duration: 5, delay: 1.5 })
  const cs = store.getState().clips
  return { start: Math.min(...cs.map((c) => c.start)), dur: Math.max(...cs.map((c) => c.duration)) }
})
assert(Math.abs(timing.start - 2.5) < 0.01 && timing.dur === 5, 'D delay shifts start, duration sets clip length', JSON.stringify(timing))

// --- E. graph remap -------------------------------------------------------------
const graph = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
  window.__omniframe_build_text_preset('bounce-letters', 'GRAPH', { seed: 7, graph: 'linear' })
  const interps = new Set()
  for (const c of store.getState().clips) if (c.animation) for (const cv of Object.values(c.animation.curves)) for (const k of cv.keyframes) interps.add(k.interpolation)
  return [...interps]
})
assert(graph.includes('linear') && !graph.includes('bounce'), 'E graph setting remaps keyframe interpolation', graph.join(','))

// --- F. glow stack ----------------------------------------------------------------
const glow = await page.evaluate(() => {
  const store = window.__omniframe_store
  const run = (g) => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 })
    const ids = window.__omniframe_build_text_preset('neon-flicker', 'GLOW', { seed: 7, glow: g })
    const cs = store.getState().clips
    const halo = cs.filter((c) => c.name.includes('glow'))
    const main = cs.find((c) => c.textStyle?.glowColor && !c.name.includes('glow'))
    return { n: ids.length, halo: halo.length, blur: main?.textStyle?.glowBlur, haloDy: halo.length ? Math.abs(halo[0].transform.y - main.transform.y) : 0, haloDx: halo.length ? Math.abs(halo[0].transform.x - main.transform.x) : 0 }
  }
  const base = { angle: 90, intensity: 1, spread: 0, blur: 1, smoothness: 0, sharpness: 'text', clarity: 0 }
  return { plain: run(base), spreadDown: run({ ...base, spread: 40 }), hot: run({ ...base, intensity: 2, blur: 1.5 }) }
})
assert(glow.spreadDown.halo >= 1 && glow.spreadDown.haloDy > 20 && glow.spreadDown.haloDx < 3, 'F glow spread copies land along the 90° angle', JSON.stringify(glow.spreadDown))
assert(glow.hot.blur > glow.plain.blur * 2, 'F intensity x blur scales glowBlur', JSON.stringify({ a: glow.plain.blur, b: glow.hot.blur }))

// --- G. scramble filler grows with duration -----------------------------------------
const filler = await page.evaluate(() => {
  const store = window.__omniframe_store
  const len = (d) => {
    store.setState({ clips: [], tracks: [], playhead: 0, duration: 12 })
    window.__omniframe_build_text_preset('scramble-padding', 'DECODE', { seed: 7, duration: d })
    const pad = store.getState().clips.find((c) => c.name === 'gibberish padding')
    return { textLen: pad?.textStyle?.text?.length ?? 0, until: pad?.textStyle?.randomizer?.untilSec ?? 0 }
  }
  return { short: len(2), long: len(6) }
})
assert(filler.long.textLen > filler.short.textLen && filler.long.until > filler.short.until, 'G longer duration => more gibberish filler + longer scramble', JSON.stringify(filler))

// --- H. panel settings UI -------------------------------------------------------------
for (const tid of ['preset-spacing-input', 'preset-word-spacing-input', 'preset-duration-input', 'preset-delay-input', 'preset-graph-select', 'preset-glow-angle', 'preset-glow-intensity', 'preset-glow-spread', 'preset-glow-blur', 'preset-glow-sharp', 'preset-caps']) {
  assert(await page.locator(`[data-testid="${tid}"]`).count() === 1, `H control ${tid}`)
}
for (const f of ['bar', 'block', 'underscore', 'caret', 'highlight']) {
  assert(await page.locator(`[data-testid="text-preset-lib-typewriter-${f}"]`).count() === 1, `H panel lists typewriter-${f}`)
}
const capsText = await page.locator('[data-testid="preset-caps"]').innerText()
assert(capsText.includes('Auto caps'), 'H auto caps explained in panel', capsText.slice(0, 60))

await page.evaluate(() => { window.__omniframe_store.setState({ clips: [], tracks: [], playhead: 0, duration: 8 }); window.__omniframe_build_text_preset('typewriter-block', 'TYPING', { seed: 7 }) })
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.5))
await page.waitForTimeout(500)
await page.screenshot({ path: join(OUT, '24-typewriter-formes.png') })

await browser.close()
if (failures) { console.error(`PRESET SETTINGS SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('PRESET SETTINGS SUITE: ALL PASS')
