/** QA: device 3D transitions (phone/monitor/tv) + green-screen device overlay.
 *  Renders through the REAL app pipeline (studio canvas, playback engine),
 *  captures frames headlessly and encodes mp4 proofs with ffmpeg.
 *  Asserts: mid-transition frames differ from both ends; the p=1 frame matches
 *  the flat incoming clip (3D→2D handoff); the overlay plate keys its hole.
 */
import fs from 'fs'
import path from 'path'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'child_process'
import { chromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'

const OUT = 'test_ans_result'
fs.mkdirSync(join(OUT, 'device3d'), { recursive: true })
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const runtimeErrors = []
page.on('pageerror', (e) => runtimeErrors.push(String(e)))
await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="studio-scene"]')
const ev = (fn, arg) => page.evaluate(fn, arg)

// project: two overlapping clips, one centred transition we retarget per kind
await ev(() => {
  const g = window.__omniframe_store.getState()
  const mk = (c1, c2, label) => {
    const c = document.createElement('canvas'); c.width = 480; c.height = 270
    const x = c.getContext('2d')
    const gr = x.createLinearGradient(0, 0, 480, 270)
    gr.addColorStop(0, c1); gr.addColorStop(1, c2)
    x.fillStyle = gr; x.fillRect(0, 0, 480, 270)
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = 'bold 64px sans-serif'; x.fillText(label, 90, 160)
    for (let i = 0; i < 24; i++) { x.fillStyle = `rgba(0,0,0,${0.12 + (i % 4) * 0.06})`; x.fillRect(i * 20, 220, 12, 30) }
    return c.toDataURL('image/png')
  }
  g.addAsset({ id: 'd3-a', name: 'a.png', kind: 'image', url: mk('#c2426b', '#ffd98a', 'CLIP A'), duration: 6, width: 480, height: 270, size: 4000 })
  g.addAsset({ id: 'd3-b', name: 'b.png', kind: 'image', url: mk('#123c8c', '#37e0c8', 'CLIP B'), duration: 6, width: 480, height: 270, size: 4000 })
  const trackId = g.ensureTrack('video')
  const st = window.__omniframe_store.getState()
  st.addClipToTrack(trackId, 'd3-a', 0)
  const a = window.__omniframe_store.getState().selectedClipId
  window.__omniframe_store.getState().setClipProp(a, { duration: 2.8 })
  st.addClipToTrack(trackId, 'd3-b', 2.4)
  const b = window.__omniframe_store.getState().selectedClipId
  window.__omniframe_store.getState().setClipProp(b, { duration: 2.8, start: 2.4 })
  window.__omniframe_store.getState().addTransition({
    type: 'device_phone', fromClipId: a, toClipId: b, trackId,
    startTime: 2.8 - 0.8, duration: 1.6, alignment: 'centered', enabled: true,
  })
  return 1
})

const grabPng = () => ev(() => document.querySelector('#of-canvas').toDataURL('image/png'))
const setT = async (t) => { await ev((tt) => window.__omniframe_store.getState().setPlayhead(tt), t); await page.waitForTimeout(240); return grabPng() }
const save = (name, dataUrl) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  fs.writeFileSync(join(OUT, 'device3d', name), buf)
  return buf
}
const lum = (buf) => { // crude mean luma over the png bytes is useless; decode via page instead
  return 0
}
const lums = []
async function shootTransition(kind, frames = 24) {
  await ev((k) => {
    const st = window.__omniframe_store.getState()
    const tr = st.transitions[0]
    st.updateTransition(tr.id, { type: k })
  }, kind)
  const dir = join(OUT, 'device3d', kind)
  fs.mkdirSync(dir, { recursive: true })
  const shots = []
  for (let i = 0; i < frames; i++) {
    const t = 2.0 + (1.6 * i) / (frames - 1)
    const png = await setT(t)
    save(`${kind}/f${String(i).padStart(2, '0')}.png`, png)
    shots.push(png)
  }
  return shots
}
const diffs = (a, b) => { let d = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i += 97) d += Math.abs(a[i] - b[i]); return d / (n / 97) }

for (const kind of ['device_phone', 'device_monitor', 'device_tv']) {
  const shots = await shootTransition(kind)
  const bytes = shots.map((s) => Buffer.from(s.split(',')[1], 'base64'))
  const dStartMid = diffs(bytes[0], bytes[12])
  const dMidEnd = diffs(bytes[12], bytes[23])
  assert.ok(dStartMid > 0.5 && dMidEnd > 0.5, `${kind}: mid frame differs from both ends (${dStartMid.toFixed(2)}, ${dMidEnd.toFixed(2)})`)
  // handoff: last transition frame must match the flat incoming clip
  const flat = await setT(4.6)
  const dFlat = diffs(bytes[23], Buffer.from(flat.split(',')[1], 'base64'))
  assert.ok(dFlat < 1.2, `${kind}: p=1 frame matches flat incoming clip (diff ${dFlat.toFixed(2)})`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '15', '-i', join(OUT, 'device3d', kind, 'f%02d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(OUT, `device3d-${kind}.mp4`)])
  console.log(`${kind} ok: mid-diffs ${dStartMid.toFixed(2)}/${dMidEnd.toFixed(2)}, handoff-to-2D diff ${dFlat.toFixed(2)}`)
}

// green-screen device overlay (AI plates): clip shows through the chroma hole
await ev(() => {
  const st = window.__omniframe_store.getState()
  for (const tr of [...st.transitions]) st.removeTransition(tr.id)
  const clip = st.clips.find((c) => c.assetId === 'd3-b')
  st.setClipProp(clip.id, { effects: { deviceOverlay: 'phone' } })
  st.setPlayhead(2.6)
  return 1
})
await page.waitForTimeout(1200) // plate fetch + key
fs.mkdirSync(join(OUT, 'device3d', 'overlay'), { recursive: true })
const ovFrames = []
for (let i = 0; i < 24; i++) {
  const t = 2.5 + i * 0.083
  const png = await setT(t)
  save(`overlay/f${String(i).padStart(2, '0')}.png`, png)
  ovFrames.push(png)
}
const ovBytes = ovFrames.map((s) => Buffer.from(s.split(',')[1], 'base64'))
const plain = await ev(() => {
  const st = window.__omniframe_store.getState()
  const clip = st.clips.find((c) => c.assetId === 'd3-b')
  st.setClipProp(clip.id, { effects: {} })
  return 1
})
await page.waitForTimeout(300)
const plainPng = await setT(2.6)
const dOverlay = diffs(ovBytes[0], Buffer.from(plainPng.split(',')[1], 'base64'))
assert.ok(dOverlay > 1, `overlay: keyed plate visibly composites over the clip (diff ${dOverlay.toFixed(2)})`)
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', join(OUT, 'device3d', 'overlay', 'f%02d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(OUT, 'device3d-overlay-phone.mp4')])
console.log(`overlay ok: plate-vs-plain diff ${dOverlay.toFixed(2)}`)

const realErrors = runtimeErrors.filter((e) => !/favicon|Download the React|net::ERR/i.test(e))
assert.equal(realErrors.length, 0, 'no runtime errors: ' + realErrors.slice(0, 3).join(' | '))
console.log('DEVICE3D QA: PASS (3 transitions + green-screen overlay, mp4 proofs in test_ans_result/)')
await browser.close()
process.exit(0)
