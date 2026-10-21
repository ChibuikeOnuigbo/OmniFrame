/**
 * Transition wave QA — the "use the app directly" test.
 *
 * Builds the two test clips the brief asked for (CLIP 1 red / CLIP 2 blue,
 * 6s each, back to back), then drives EVERY transition preset through the
 * agent surface (window.__omniframe_transitions — the same JSON in/out any
 * MCP-style agent would use), renders the middle frame of each transition
 * in the real editor canvas, pixel-checks it, and writes a machine report
 * to qa/reports/transition-results.json + one frame per preset to
 * evidence/transitions/.
 *
 * Duration law under test: >0.1s, range 0.1–5s, user-chosen; each side of
 * the cut must hold >= duration/2 of clip.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const FRAMES = join(process.cwd(), 'evidence', 'transitions')
const REPORTS = join(process.cwd(), 'qa', 'reports')
mkdirSync(FRAMES, { recursive: true })
mkdirSync(REPORTS, { recursive: true })
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

// --- Build CLIP 1 + CLIP 2 ----------------------------------------------------
const pair = await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const mk = (id, color, label) => {
    const c = document.createElement('canvas')
    c.width = 1280; c.height = 720
    const g = c.getContext('2d')
    g.fillStyle = color; g.fillRect(0, 0, 1280, 720)
    g.fillStyle = 'rgba(255,255,255,0.92)'
    g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(label, 640, 360)
    s.addAsset({ id, name: `${id}.png`, kind: 'image', url: c.toDataURL('image/png'), width: 1280, height: 720, duration: 12 })
  }
  store.setState({ clips: [], tracks: [], transitions: [], playhead: 0, duration: 12, playing: false })
  mk('test-clip-1', '#dc2645', 'CLIP 1')
  mk('test-clip-2', '#2456e6', 'CLIP 2')
  const trackId = s.createTrack('video')
  s.addClipToTrack(trackId, 'test-clip-1', 0)
  s.addClipToTrack(trackId, 'test-clip-2', 6)
  const st = store.getState()
  const clips = st.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start)
  store.setState({
    clips: st.clips.map((c) => (c.id === clips[0].id ? { ...c, start: 0, duration: 6 } : c.id === clips[1].id ? { ...c, start: 6, duration: 6 } : c)),
    playhead: 5.9,
    duration: 12,
  })
  return { trackId, from: clips[0].id, to: clips[1].id, cut: 6 }
})
assert(!!pair.from && !!pair.to, 'two test clips created (CLIP 1 / CLIP 2, 6s each)', JSON.stringify(pair))
await page.waitForTimeout(500)

// --- Agent surface: catalogue JSON ---------------------------------------------
const catalog = await page.evaluate(() => window.__omniframe_transitions.list())
assert(catalog.count >= 30 && catalog.minDuration === 0.1 && catalog.maxDuration === 5, 'agent list(): catalogue + duration law', `count=${catalog.count}`)

// --- Duration validation (JSON in / JSON out) -----------------------------------
const validation = await page.evaluate(() => {
  const api = window.__omniframe_transitions
  const store = window.__omniframe_store
  const out = {}
  out.tooShort = api.apply('cross_dissolve', 0.05)
  out.zero = api.apply('cross_dissolve', 0)
  out.tooLong = api.apply('cross_dissolve', 7)
  out.min = api.apply('cross_dissolve', 0.1)
  api.clear()
  out.max = api.apply('cross_dissolve', 5)
  api.clear()
  out.unknown = api.apply('does_not_exist', 1)
  // Short clips: shrink both clips to 1s, try a 4s transition (needs 2s per side)
  const st = store.getState()
  store.setState({ clips: st.clips.map((c) => ({ ...c, duration: 1 })) })
  out.shortClips = api.apply('cross_dissolve', 4)
  const st2 = store.getState()
  const sorted = [...st2.clips].sort((a, b) => a.start - b.start)
  store.setState({ clips: st2.clips.map((c) => (c.id === sorted[0].id ? { ...c, start: 0, duration: 6 } : { ...c, start: 6, duration: 6 })), playhead: 5.9 })
  return out
})
assert(validation.tooShort.ok === false && validation.zero.ok === false, 'duration must be > 0.1s', JSON.stringify(validation.tooShort))
assert(validation.tooLong.ok === false, 'duration capped at 5s', JSON.stringify(validation.tooLong))
assert(validation.min.ok === true && validation.max.ok === true, 'boundary durations 0.1s and 5s apply', '')
assert(validation.unknown.ok === false, 'unknown preset rejected with JSON error', JSON.stringify(validation.unknown))
assert(validation.shortClips.ok === false && validation.shortClips.requiredClipSeconds === 2, 'short clips rejected: needs >= duration/2 per side', JSON.stringify(validation.shortClips))

// --- Base seconds per preset ------------------------------------------------------
const baseCheck = await page.evaluate(() => {
  const api = window.__omniframe_transitions
  const { presets, minDuration, maxDuration } = api.list()
  const inRange = presets.every((p) => typeof p.baseDuration === 'number' && p.baseDuration >= minDuration && p.baseDuration <= maxDuration)
  api.clear()
  const applied = api.apply('whip_left') // no explicit duration -> base seconds
  const dur = applied.ok ? applied.transition.duration : null
  const base = presets.find((p) => p.id === 'whip_left').baseDuration
  api.clear()
  return { inRange, count: presets.length, dur, base }
})
assert(baseCheck.inRange, 'every preset ships a base duration inside 0.1–5s', `count=${baseCheck.count}`)
assert(baseCheck.dur === baseCheck.base, 'apply() without a duration uses the preset base seconds', `applied=${baseCheck.dur} base=${baseCheck.base}`)

// --- Panel: duration slider law --------------------------------------------------
await page.getByTestId('left-tab-transitions').click()
await page.getByTestId('transitions-panel').waitFor({ state: 'visible' })
await page.getByTestId('transition-duration-slider').fill('3.4')
assert((await page.getByTestId('transition-duration-value').innerText()) === '3.4s', 'panel slider sets any duration 0.1–5s')
assert((await page.getByTestId('transition-requirement').innerText()).includes('1.70s'), 'panel states the per-side clip requirement')
const segOk = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="transition-dur-"]')].every((b) => b.getBoundingClientRect().height <= 26))
assert(segOk, 'duration chips are single-line')
await page.getByTestId('transition-card-whip_left').click({ position: { x: 30, y: 14 } }) // label area, not the buttons
assert((await page.getByTestId('transition-duration-value').innerText()) === '0.5s', 'selecting a preset loads its base seconds into the slider')
assert((await page.getByTestId('transition-base-loaded').innerText()).includes('base 0.5s'), 'panel states the loaded base seconds')
{
  const stop = page.getByTestId('stop-visual-preview')
  if (await stop.count()) await stop.click()
}

// --- Reference frames: pure CLIP 1 (t=3) and pure CLIP 2 (t=9) ------------------
const frameStats = () => page.evaluate(() => {
  const src = document.querySelector('#of-canvas')
  const c = document.createElement('canvas')
  c.width = src.width; c.height = src.height
  const x = c.getContext('2d')
  x.drawImage(src, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  let red = 0, blue = 0, dark = 0, bright = 0, sr = 0, sg = 0, sb = 0, n = 0
  for (let i = 0; i < d.length; i += 16) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    if (r > 90 && r > g + 20 && r > b + 10) red++
    if (b > 90 && b > r + 20 && b > g + 5) blue++
    if (r < 40 && g < 40 && b < 40) dark++
    if (r > 215 && g > 215 && b > 215) bright++
    sr += r; sg += g; sb += b; n++
  }
  return { red, blue, dark, bright, total: n, mean: [sr / n, sg / n, sb / n] }
})
await page.evaluate(() => { window.__omniframe_transitions.clear(); window.__omniframe_store.setState({ playhead: 3, playing: false }) })
await page.waitForTimeout(200)
const pureA = await frameStats()
await page.evaluate(() => window.__omniframe_store.setState({ playhead: 9 }))
await page.waitForTimeout(200)
const pureB = await frameStats()
assert(pureA.red > pureA.total * 0.5 && pureB.blue > pureB.total * 0.5, 'reference frames are pure CLIP 1 / CLIP 2', JSON.stringify({ a: pureA.mean, b: pureB.mean }))
const meanDist = (m, ref) => Math.abs(m[0] - ref[0]) + Math.abs(m[1] - ref[1]) + Math.abs(m[2] - ref[2])

// --- Every preset: apply between CLIP 1 and CLIP 2, render the middle frame -----
const results = []
for (const preset of catalog.presets) {
  const applied = await page.evaluate(([type]) => {
    const api = window.__omniframe_transitions
    api.clear()
    const r = api.apply(type, 2)
    if (r.ok) window.__omniframe_store.setState({ playhead: 6, playing: false })
    return r
  }, [preset.id])
  if (!applied.ok) {
    results.push({ id: preset.id, name: preset.name, category: preset.category, ok: false, error: applied.error })
    assert(false, `preset ${preset.id} applies`, applied.error || '')
    continue
  }
  await page.waitForTimeout(160)
  const shot = join(FRAMES, `${preset.id}.png`)
  const canvas = page.locator('#of-canvas')
  await canvas.screenshot({ path: shot })
  const px = await frameStats()
  // Mid-transition expectations: most looks show BOTH clips (pure regions or
  // alpha blends — dominance classes catch both); dips/flip pass through
  // black/white/edge-on frames at exactly 50%.
  let frameOk
  if (preset.id === 'dip_to_black') frameOk = px.dark > px.total * 0.4
  else if (preset.id === 'dip_to_white') frameOk = px.bright > px.total * 0.3
  else if (preset.id === 'flip_h') frameOk = px.dark > px.total * 0.4
  else if (['cross_dissolve', 'film_dissolve', 'additive_dissolve', 'blur_dissolve', 'light_leak', 'zoom', 'zoom_out', 'spin'].includes(preset.id)) {
    // Alpha-blend looks: the mid frame's mean colour must sit BETWEEN the
    // two pure frames (a purple, not red and not blue).
    frameOk = meanDist(px.mean, pureA.mean) > 12 && meanDist(px.mean, pureB.mean) > 12
  } else frameOk = px.red > 80 && px.blue > 80 && meanDist(px.mean, pureA.mean) > 8 && meanDist(px.mean, pureB.mean) > 8
  results.push({ id: preset.id, name: preset.name, category: preset.category, ok: frameOk, applied: true, pixels: px, frame: `evidence/transitions/${preset.id}.png` })
  assert(frameOk, `preset ${preset.id} renders mid-transition`, JSON.stringify(px))
}

const okCount = results.filter((r) => r.ok).length
writeFileSync(join(REPORTS, 'transition-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  pair: { from: 'CLIP 1 (#dc2645)', to: 'CLIP 2 (#2456e6)', clipSeconds: 6, cut: 6, transitionSeconds: 2 },
  durationLaw: { min: catalog.minDuration, max: catalog.maxDuration, rule: 'each side of the cut must hold >= duration/2' },
  validation,
  presets: results,
  summary: { total: results.length, passed: okCount },
}, null, 2))
assert(okCount === results.length, `ALL ${results.length} transition presets render between CLIP 1 and CLIP 2`, `${okCount}/${results.length}`)
await page.evaluate(() => window.__omniframe_transitions.clear())

await browser.close()
console.log(failures ? `TRANSITIONS: ${failures} FAILURES` : 'TRANSITIONS ALL PASS')
process.exit(failures ? 1 : 0)
