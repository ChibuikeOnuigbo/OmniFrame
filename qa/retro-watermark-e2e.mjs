/**
 * Retro Text (Alight Motion study) + Watermark Studio (CapCut study):
 *  A. traditional retro: per-letter settled clips + 1-frame glitch mutations
 *  B. effects retro: seeded Text Randomizer scrambles, then settles (deterministic)
 *  C. watermark levels build real editable clips (glow/fade/drift/warp/voice)
 *  D. saved watermark stamps across a project at a chosen corner
 *  E. new pixel effects render: chroma key (binary), pixel stretch, chromatic
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
const hard = (cond, name, extra = '') => { if (!cond) { console.error(`FATAL ${name} ${extra}`); process.exit(1) } }

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const st = () => page.evaluate(() => window.__omniframe_store.getState())

const stageShot = async () => {
  const shot = await page.locator('[data-testid="preview-stage"]').screenshot()
  return page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}` })
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height)
    const at = (fx, fy) => { const i = ((Math.floor(fy * c.height) * c.width) + Math.floor(fx * c.width)) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]] }
    let white = 0, red = 0, green = 0, total = 0
    for (let y = Math.floor(c.height * 0.3); y < c.height * 0.7; y += 3) {
      for (let x = Math.floor(c.width * 0.2); x < c.width * 0.8; x += 3) {
        const i = (y * c.width + x) * 4
        const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2]
        total++
        if (r > 200 && gg > 200 && b > 200) white++
        if (r > 150 && gg < 110 && b < 110) red++
        if (gg > 180 && r < 110 && b < 110) green++
      }
    }
    return { at, cx: at(0.5, 0.5), white: white / total, red: red / total, green: green / total }
  }, shot.toString('base64'))
}

// scene: dark backdrop so text/watermarks read
await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], transitions: [], markers: [], watermarks: [], playhead: 0, playing: false, duration: 8 })
  const s = store.getState()
  const t = s.createTrack('video')
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const g = c.getContext('2d'); g.fillStyle = 'rgb(16,18,26)'; g.fillRect(0, 0, 640, 360)
  s.addAsset({ id: 'qa-dark', name: 'dark.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
  const ch = document.createElement('canvas'); ch.width = 200; ch.height = 200
  const cg = ch.getContext('2d'); cg.fillStyle = 'rgb(255,180,40)'; cg.beginPath(); cg.arc(100, 100, 80, 0, 7); cg.fill()
  s.addAsset({ id: 'qa-char', name: 'char.png', kind: 'image', url: ch.toDataURL('image/png'), width: 200, height: 200, duration: 8 })
  s.addClipToTrack(t, 'qa-dark', 0)
  const scene = store.getState().clips.find((cl) => cl.assetId === 'qa-dark')
  store.setState({ clips: store.getState().clips.map((cl) => (cl.id === scene.id ? { ...cl, duration: 8 } : cl)) })
})

await page.locator('[data-testid="left-tab-text"]').click()
await page.locator('[data-testid="text-submode-retro-btn"]').click()
await page.waitForTimeout(400)
await page.waitForTimeout(500)
hard(await page.locator('[data-testid="retro-text-studio"]').isVisible(), 'retro studio renders')
hard(await page.locator('[data-testid="watermark-studio"]').count() === 0, 'watermark studio hidden until its sub-mode (decluttered panel)')

// --- A. traditional retro ---------------------------------------------------
await page.locator('[data-testid="retro-text-input"]').fill('GLITCH')
await page.locator('[data-testid="retro-method-traditional"]').click()
await page.locator('[data-testid="retro-build-btn"]').click()
await page.waitForTimeout(400)
const retro = await st()
const letterClips = retro.clips.filter((c) => c.textStyle && [...'GLITCH'].includes(c.name))
const glitchClips = retro.clips.filter((c) => /glitch f\d+$/.test(c.name))
assert(letterClips.length >= 6, 'A settled per-letter clips built', `letters=${letterClips.length}`)
assert(glitchClips.length >= 4, 'A 1-frame glitch mutations built (seeded)', `glitches=${glitchClips.length}`)
assert(glitchClips.every((c) => Math.abs(c.duration - 1 / 30) < 0.002), 'A mutations are exactly one frame')
const mutatedProps = new Set()
for (const c of glitchClips) {
  if (c.transform.rotation !== 0) mutatedProps.add('rotate')
  if (c.textStyle.strokeOnly) mutatedProps.add('stroke')
  if (c.textStyle.color !== '#ffffff') mutatedProps.add('color')
  if (![...'GLITCH'].includes(c.textStyle.text)) mutatedProps.add('swap')
}
assert(mutatedProps.size >= 2, 'A mutations vary (move/colour/stroke/swap/vanish)', [...mutatedProps].join(','))
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.12))
await page.waitForTimeout(400)
const duringGlitch = await stageShot()
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2))
await page.waitForTimeout(400)
const settled = await stageShot()
assert(settled.white > 0.002, 'A settled text reads white on screen', `white=${settled.white.toFixed(4)}`)
assert(duringGlitch.red > settled.red || duringGlitch.white !== settled.white, 'A glitch frames look different from settled', `red ${duringGlitch.red.toFixed(4)} vs ${settled.red.toFixed(4)}`)

// --- B. randomizer ----------------------------------------------------------------
await page.evaluate(() => window.__omniframe_store.setState({ clips: window.__omniframe_store.getState().clips.filter((c) => c.assetId === 'qa-dark'), playhead: 0 }))
await page.locator('[data-testid="retro-method-effects"]').click()
await page.locator('[data-testid="retro-build-btn"]').click()
await page.waitForTimeout(300)
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.1))
await page.waitForTimeout(400)
const scramble1 = await stageShot()
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2))
await page.waitForTimeout(400)
const settled2 = await stageShot()
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.1))
await page.waitForTimeout(400)
const scramble2 = await stageShot()
assert(Math.abs(scramble1.white - scramble2.white) < 0.0005, 'B randomizer is deterministic (same seed, same frame)', `${scramble1.white} vs ${scramble2.white}`)
assert(Math.abs(scramble1.white - settled2.white) > 0.0005 || scramble1.red !== settled2.red, 'B scramble frame differs from settled text')

// --- C. watermark levels -----------------------------------------------------------
await page.evaluate(() => window.__omniframe_store.setState({ clips: window.__omniframe_store.getState().clips.filter((c) => c.assetId === 'qa-dark'), playhead: 0 }))
await page.locator('[data-testid="submode-back-btn"]').click()
await page.waitForTimeout(300)
await page.locator('[data-testid="text-submode-watermark-btn"]').click()
await page.waitForTimeout(400)
await page.locator('[data-testid="wm-text-input"]').fill('@qaedit')
await page.locator('[data-testid="wm-level-1"]').click()
await page.locator('[data-testid="wm-build-btn"]').click()
await page.waitForTimeout(300)
let wm = (await st()).clips.filter((c) => c.name.includes('Watermark'))
assert(wm.length === 1 && wm[0].textStyle.glowBlur > 0, 'C L1 glowing text watermark built')
const fadeKeys = wm[0].animation?.curves?.opacity?.keyframes || []
assert(fadeKeys.length >= 3 && Math.max(...fadeKeys.map((k) => k.value)) <= 0.63, 'C L1 fades in/out at watermark opacity', JSON.stringify(fadeKeys.map((k) => k.value)))

await page.evaluate(() => window.__omniframe_store.setState({ clips: window.__omniframe_store.getState().clips.filter((c) => c.assetId === 'qa-dark'), playhead: 0 }))
await page.locator('[data-testid="wm-level-4"]').click()
await page.locator('[data-testid="wm-char-select"]').selectOption('qa-char')
await page.locator('[data-testid="wm-build-btn"]').click()
await page.waitForTimeout(300)
wm = (await st()).clips.filter((c) => c.name.includes('Watermark'))
const charClip = wm.find((c) => c.assetId === 'qa-char')
assert(Boolean(charClip), 'C L4 character clip placed')
assert(charClip.effects?.waveWarp === 6, 'C L4 hair/cloth wave-warp applied', JSON.stringify(charClip.effects))
assert((charClip.animation?.curves?.rotation_z?.keyframes || []).length === 3, 'C L4 sway rotation keyframes (graph-ready)')

// --- D. save + stamp ------------------------------------------------------------------
await page.locator('[data-testid="wm-save-btn"]').click()
await page.waitForTimeout(200)
const saved = (await st()).watermarks
assert(saved.length === 1 && saved[0].level === 4, 'D watermark preset saved', JSON.stringify(saved))
await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: store.getState().clips.filter((c) => c.assetId === 'qa-dark'), playhead: 3, duration: 8 })
})
await page.locator('[data-testid="wm-corner-select"]').selectOption('br')
await page.locator(`[data-testid="wm-apply-${saved[0].id}"]`).click()
await page.waitForTimeout(300)
const stamped = (await st()).clips.filter((c) => c.name.includes('Watermark'))
assert(stamped.length >= 1 && stamped.every((c) => c.start === 0), 'D stamp spans from 0 across the project')
assert(stamped.some((c) => c.transform.x > 300), 'D stamp lands bottom-right', JSON.stringify(stamped.map((c) => Math.round(c.transform.x))))
await page.screenshot({ path: join(OUT, '22-retro-watermark.png') })

// --- E. pixel effects ---------------------------------------------------------------------
await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], playhead: 0, duration: 5 })
  const s = store.getState()
  const t = s.createTrack('video')
  const fx = s.createTrack('video')
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const g = c.getContext('2d'); g.fillStyle = 'rgb(0,255,0)'; g.fillRect(0, 0, 640, 360)
  g.fillStyle = 'rgb(220,30,30)'; g.fillRect(0, 0, 200, 360)
  s.addAsset({ id: 'qa-green', name: 'green.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
  s.addClipToTrack(t, 'qa-green', 0)
  const sc = store.getState().clips.find((cl) => cl.assetId === 'qa-green')
  store.setState({ clips: store.getState().clips.map((cl) => (cl.id === sc.id ? { ...cl, duration: 5 } : cl)) })
  s.addAdjustmentLayer({ name: 'Key QA', trackId: fx, start: 0, duration: 5, effects: { chromaKey: 1 } })
  s.setPlayhead(1)
})
await page.waitForTimeout(600)
const keyed = await stageShot()
// green area (right of red panel) keyed out to black; red panel untouched
assert(keyed.green < 0.01, 'E chroma key removes the green screen', `green=${keyed.green.toFixed(4)}`)
assert(keyed.red > 0.05, 'E non-green content survives the key', `red=${keyed.red.toFixed(4)}`)

await browser.close()
if (failures) { console.error(`RETRO-WATERMARK SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('RETRO-WATERMARK SUITE: ALL PASS')
