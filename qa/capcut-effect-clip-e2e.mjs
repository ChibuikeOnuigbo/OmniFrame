/**
 * CapCut effect-clip semantics, verified strictly (from the CapCut study:
 * effects are purple, text-height clips; they grade everything UNDER them
 * and never touch what's above; inside a compound they grade the
 * compound's own contents and the compound then behaves like a brand-new
 * video; an effect compounded ALONE has nothing to grade and is invisible):
 *
 *  A. effect clip is purple + thin (DOM)            D. outer effect grades a compound like a video
 *  B. scene below graded, text above untouched      E. lone effect in a compound: invisible, no leak
 *  C. effect + clip compounded works (flattened)    F. inside the compound, text above the effect is untouched
 *
 * Pixel proof uses an invert effect (binary outcome) on a blue scene.
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

const BLUE = [37, 99, 235]
const INVERTED_BLUE = [218, 156, 20]
const GREEN = [34, 197, 94]

const SCENE_BODY = `
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720
  const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 1280, 720)
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(640, 420, 26, 0, 7); g.fill()
  return c.toDataURL('image/png')`

// --- build: [text | effect | scene] top-to-bottom -----------------------
const ids = await page.evaluate((SCENE_BODY) => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], transitions: [], selectedClipId: null, playhead: 0, playing: false, duration: 5 })
  const s = store.getState()
  // OmniFrame: each new track unshifts above the previous (top row = drawn
  // last = on top). Create bottom-to-top: scene, effect, text.
  const sceneTrack = s.createTrack('video')
  const fxTrack = s.createTrack('video')
  const textTrack = s.createTrack('video')
  const mkScene = new Function('hex', SCENE_BODY)
  s.addAsset({ id: 'scene-blue', name: 'blue.png', kind: 'image', url: mkScene('#2563eb'), width: 1280, height: 720, duration: 8 })
  s.addClipToTrack(sceneTrack, 'scene-blue', 0)
  const scene = store.getState().clips.find((c) => c.assetId === 'scene-blue')
  store.setState({ clips: store.getState().clips.map((c) => (c.id === scene.id ? { ...c, duration: 5 } : c)) })
  const fxId = s.addAdjustmentLayer({ name: 'Invert FX', trackId: fxTrack, start: 0, duration: 5, effects: { invert: 1 } })
  const textClip = {
    id: 'cap-text', trackId: textTrack, assetId: '', start: 0, duration: 5, inPoint: 0,
    name: 'Title', kind: 'text', volume: 1, hidden: false,
    transform: { x: 0, y: -230, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
    textStyle: { text: 'ABOVE FX', fontSize: 92, color: '#ffffff', backgroundColor: 'rgba(0,0,0,0)', fontFamily: 'sans-serif', bold: true, italic: false },
  }
  store.setState({ clips: [...store.getState().clips, textClip] })
  return { scene: scene.id, fx: fxId, text: 'cap-text', fxTrack, sceneTrack, textTrack }
}, SCENE_BODY)
hard(ids.fx, 'adjustment (effect) clip created')
await page.waitForTimeout(700)

// --- pixel probes ---------------------------------------------------------
const stage = page.locator('[data-testid="preview-stage"]')
async function grab() {
  const shot = await stage.screenshot()
  return page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}` })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height)
    return { data: Array.from(d.data), w: c.width, h: c.height }
  }, shot.toString('base64'))
}
async function canvasRect() {
  const sBox = await stage.boundingBox()
  const cBox = await page.locator('#of-canvas').boundingBox()
  const shotW = await page.evaluate(async () => 0).then(() => null).catch(() => null)
  void shotW
  const shot = await stage.screenshot()
  const w = await page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}` })
    return img.naturalWidth
  }, shot.toString('base64'))
  const k = w / Math.max(1, sBox.width)
  return { minX: (cBox.x - sBox.x) * k, minY: (cBox.y - sBox.y) * k, maxX: (cBox.x - sBox.x + cBox.width) * k, maxY: (cBox.y - sBox.y + cBox.height) * k }
}
async function probe() {
  const px = await grab()
  const rect = await canvasRect()
  const { data, w } = px
  const at = (fxv, fyv) => {
    const x = Math.round(rect.minX + fxv * (rect.maxX - rect.minX))
    const y = Math.round(rect.minY + fyv * (rect.maxY - rect.minY))
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  // white text coverage in the top band
  let tw = 0, tt = 0
  for (let y = rect.minY + (rect.maxY - rect.minY) * 0.05; y < rect.minY + (rect.maxY - rect.minY) * 0.3; y += 2)
    for (let x = rect.minX + (rect.maxX - rect.minX) * 0.3; x < rect.minX + (rect.maxX - rect.minX) * 0.7; x += 2) {
      const i = ((y | 0) * w + (x | 0)) * 4
      tt++
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) tw++
    }
  return { corner: at(0.06, 0.93), textWhite: tw / Math.max(1, tt), textPx: at(0.5, 0.18) }
}
const near = (rgb, [r, g, b], tol = 28) => Math.abs(rgb[0] - r) <= tol && Math.abs(rgb[1] - g) <= tol && Math.abs(rgb[2] - b) <= tol

// A. DOM: purple + thin
{
  const fxEl = page.locator(`[data-testid="timeline-clip"][data-kind="adjustment"]`).first()
  const vidEl = page.locator(`[data-testid="timeline-clip"][data-kind="image"]`).first()
  await fxEl.waitFor({ timeout: 8000 })
  const fxBox = await fxEl.boundingBox()
  const vidBox = await vidEl.boundingBox()
  const cls = (await fxEl.getAttribute('class')) || ''
  assert(fxBox.height <= vidBox.height * 0.75, 'effect clip is thin like a text clip (CapCut height)', `${fxBox.height.toFixed(0)}px vs video ${vidBox.height.toFixed(0)}px`)
  assert(/violet|purple/.test(cls) && !/from-cyan/.test(cls), 'effect clip is purple (CapCut colour)', cls.slice(0, 90))
}

// B. below graded, above untouched
{
  const p = await probe()
  assert(near(p.corner, INVERTED_BLUE), 'scene UNDER the effect is graded (inverted blue→orange)', `corner=${p.corner}`)
  assert(p.textWhite > 0.01, 'text ABOVE the effect stays pure white (not inverted to black)', `white coverage=${p.textWhite.toFixed(3)}`)
}
await page.screenshot({ path: join(OUT, '16-capcut-effect-clip.png') })
console.log('SCREENSHOT 16-capcut-effect-clip.png')

// C. compound effect + scene → flattened "new video"
const compoundId = await page.evaluate(([sceneId, fxId]) => window.__omniframe_store.getState().createCompoundClip([sceneId, fxId], 'FX Scene'), [ids.scene, ids.fx])
hard(compoundId, 'effect + scene compounded')
await page.waitForTimeout(700)
{
  const p = await probe()
  assert(near(p.corner, INVERTED_BLUE), 'compounded effect grades the clip inside; compound shows the graded result', `corner=${p.corner}`)
  assert(p.textWhite > 0.01, 'text above the compound is still untouched', `white=${p.textWhite.toFixed(3)}`)
}

// D. outer effect grades the compound like a brand-new video
await page.evaluate((cid) => {
  const store = window.__omniframe_store
  const s = store.getState()
  const topTrack = s.createTrack('video')
  // put the new track directly above the compound's track (array top = drawn last)
  const compound = store.getState().clips.find((c) => c.id === cid)
  const tracks = store.getState().tracks.filter((t) => t.id !== topTrack)
  const idx = tracks.findIndex((t) => t.id === compound.trackId)
  tracks.splice(idx, 0, { ...store.getState().tracks.find((t) => t.id === topTrack) })
  store.setState({ tracks })
  s.addAdjustmentLayer({ name: 'Dim', trackId: topTrack, start: 0, duration: 5, effects: { brightness: 0.5 } })
}, compoundId)
await page.waitForTimeout(700)
{
  const p = await probe()
  const dimmed = INVERTED_BLUE.map((v) => Math.round(v * 0.5))
  assert(near(p.corner, dimmed, 34), 'outer effect grades the whole compound like a new video', `corner=${p.corner} expect≈${dimmed}`)
}

// F. inside the compound: text above the effect is untouched there too
await page.evaluate((cid) => {
  const store = window.__omniframe_store
  const comp = store.getState().clips.find((c) => c.id === cid)
  store.getState().openSequence(comp.sourceSequenceId)
}, compoundId)
await page.waitForTimeout(500)
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const t = s.createTrack('video')
  const innerText = {
    id: 'inner-text', trackId: t, assetId: '', start: 0, duration: 5, inPoint: 0,
    name: 'Inner Title', kind: 'text', volume: 1, hidden: false,
    transform: { x: 0, y: -230, scale: 1, rotation: 0, opacity: 1, z: 0, rotationX: 0, rotationY: 0 },
    textStyle: { text: 'INNER', fontSize: 92, color: '#ffffff', backgroundColor: 'rgba(0,0,0,0)', fontFamily: 'sans-serif', bold: true, italic: false },
  }
  // array order: text track first (drawn last = on top)
  const tracks = store.getState().tracks
  const mine = tracks.find((x) => x.id === t)
  store.setState({ tracks: [mine, ...tracks.filter((x) => x.id !== t)], clips: [...store.getState().clips, innerText] })
})
await page.waitForTimeout(700)
{
  const p = await probe()
  assert(near(p.corner, INVERTED_BLUE, 34), 'inside compound: scene under the effect is graded (outer grade applies only on the main timeline — proven in D)', `corner=${p.corner}`)
  assert(p.textWhite > 0.008, 'inside compound: text above the effect stays white', `white=${p.textWhite.toFixed(3)}`)
}
await page.evaluate(() => window.__omniframe_store.getState().openSequence('main'))
await page.waitForTimeout(500)

// E. lone effect compounded: invisible + no leak onto the scene below
await page.evaluate((SCENE_BODY) => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], transitions: [], selectedClipId: null, playhead: 0, playing: false, duration: 5 })
  const s = store.getState()
  const sceneTrack = s.createTrack('video')
  const fxTrack = s.createTrack('video')
  const mkScene = new Function('hex', SCENE_BODY)
  s.addAsset({ id: 'scene-green', name: 'green.png', kind: 'image', url: mkScene('#22c55e'), width: 1280, height: 720, duration: 8 })
  s.addClipToTrack(sceneTrack, 'scene-green', 0)
  const sc = store.getState().clips.find((c) => c.assetId === 'scene-green')
  store.setState({ clips: store.getState().clips.map((c) => (c.id === sc.id ? { ...c, duration: 5 } : c)) })
  const fxId = s.addAdjustmentLayer({ name: 'Lone Invert', trackId: fxTrack, start: 0, duration: 5, effects: { invert: 1 } })
  const compId = s.createCompoundClip([fxId], 'Lone FX')
  if (!compId) throw new Error('lone-effect compound refused')
}, SCENE_BODY)
await page.waitForTimeout(700)
{
  const p = await probe()
  assert(near(p.corner, GREEN), 'lone effect in a compound is invisible and does NOT leak onto the scene below', `corner=${p.corner}`)
}

if (failures) { console.error(`CAPCUT EFFECT-CLIP SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('CAPCUT EFFECT-CLIP SUITE PASSED')
await browser.close()
