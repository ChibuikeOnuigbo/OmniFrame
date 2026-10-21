/**
 * Transition video results — renders ONE real video per transition preset.
 *
 * Every transition is placed between the two test clips (CLIP 1 -> CLIP 2,
 * the same pair the QA suite builds) through the agent surface
 * (window.__omniframe_transitions.apply) using each preset's BASE duration,
 * then the editor canvas is stepped frame by frame (24 fps) and captured
 * with toDataURL. Frames land in /tmp/tvframes/<id>/ for
 * qa/encode-transition-videos.py to encode into
 * transistion_video_result/<id>.mp4, plus one combined reel.
 *
 * A transition always lives BETWEEN two clips: the clip on each side of the
 * cut must hold at least duration/2 seconds, and the duration itself is
 * capped to 0.1–5s (base seconds per preset, user-adjustable).
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const FPS = 24
const ROOT = '/tmp/tvframes'
mkdirSync(ROOT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// --- Build CLIP 1 + CLIP 2 (6s each, cut at 6s) -------------------------------
await page.evaluate(() => {
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
  store.setState({
    clips: st.clips.map((c) => ({ ...c, duration: 6, start: c.start === 0 ? 0 : 6 })),
    playhead: 5.9,
    duration: 12,
  })
})
await page.waitForTimeout(400)

const catalog = await page.evaluate(() => window.__omniframe_transitions.list())
console.log(`catalog: ${catalog.count} presets, ${catalog.minDuration}–${catalog.maxDuration}s`)

const captureWindow = async (dir, t0, t1) => {
  mkdirSync(dir, { recursive: true })
  const n = Math.max(2, Math.round((t1 - t0) * FPS))
  for (let i = 0; i < n; i++) {
    const t = t0 + i / FPS
    const url = await page.evaluate(async (time) => {
      window.__omniframe_store.setState({ playhead: time, playing: false })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      return document.querySelector('#of-canvas').toDataURL('image/jpeg', 0.92)
    }, t)
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'))
  }
  return n
}

const manifest = []
for (const preset of catalog.presets) {
  const res = await page.evaluate((id) => {
    const api = window.__omniframe_transitions
    api.clear()
    return api.apply(id) // base duration of the preset
  }, preset.id)
  if (!res.ok) { console.error(`FAIL apply ${preset.id}: ${res.error}`); process.exit(1) }
  const tr = res.transition
  const lead = 0.8, tail = 0.8
  const nVideo = await captureWindow(join(ROOT, preset.id), tr.startTime - lead, tr.startTime + tr.duration + tail)
  const nReel = await captureWindow(join(ROOT, `reel-${preset.id}`), tr.startTime - 0.5, tr.startTime + tr.duration + 0.5)
  manifest.push({
    id: preset.id, name: preset.name, category: preset.category,
    baseDuration: preset.baseDuration, appliedDuration: tr.duration,
    cut: res.cut, fps: FPS, frames: nVideo, reelFrames: nReel,
  })
  console.log(`captured ${preset.id} base=${preset.baseDuration}s applied=${tr.duration}s frames=${nVideo}+${nReel}`)
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ fps: FPS, items: manifest }, null, 2))
await page.evaluate(() => window.__omniframe_transitions.clear())
await browser.close()
console.log(`manifest written: ${manifest.length} presets`)
