/**
 * AMV recreation E2E — rebuilds the style of edit shown in Wizzy
 * Tutorials' "How I Made This Edit - Full Editing Breakdown" (up7sbPbZlDc;
 * transcript is music-only, so the checkable surface is the AMV technique
 * stack the video's title/tags name: beat-cut stills, impact + oscillate
 * shakes, zoom punch, zoom transition, opacity fade-out, beat music bed):
 *
 *   5 generated "anime still" scenes cut on 0.8s beats
 *   c1 Zoom Punch · c2 Impact Shake · c3 Oscillate Shake
 *   c4 → hero via zoom transition · hero fades out on an opacity curve
 *   synthesized beat WAV underneath
 *
 * Verified by pixels, not by data alone: scene colours at beat times,
 * shake displacement ranges, punch scale ratio, fade depth, and the
 * exported WebM's frames.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'evidence', 'improvements')
const EXPORTS = join(process.cwd(), 'qa', 'exports')
mkdirSync(OUT, { recursive: true })
mkdirSync(EXPORTS, { recursive: true })
const assert = (cond, name, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exit(1) }
  console.log(`PASS ${name} ${extra}`)
}

// 5s mono WAV with a bass thump on every 0.8s beat (built in Node, no files)
function beatWavDataUrl() {
  const sr = 22050, dur = 5, n = sr * dur
  const data = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const beatPhase = t % 0.8
    const thump = beatPhase < 0.18 ? Math.sin(2 * Math.PI * 55 * beatPhase) * Math.exp(-beatPhase * 18) : 0
    data[i] = Math.round(thump * 20000)
  }
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(data[i], 44 + i * 2)
  return `data:audio/wav;base64,${buf.toString('base64')}`
}

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const SCENES = [
  { id: 'amv-1', color: '#e11d48' },
  { id: 'amv-2', color: '#f59e0b' },
  { id: 'amv-3', color: '#06b6d4' },
  { id: 'amv-4', color: '#a855f7' },
  { id: 'amv-5', color: '#22c55e' },
]

const built = await page.evaluate(({ scenes, wav }) => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], transitions: [], selectedClipId: null, playhead: 0, playing: false, duration: 4.8 })
  const s = store.getState()
  const trackId = s.createTrack('video')
  const ids = []
  for (const sc of scenes) {
    const c = document.createElement('canvas')
    c.width = 1280; c.height = 720
    const g = c.getContext('2d')
    g.fillStyle = sc.color; g.fillRect(0, 0, 1280, 720)
    // "character" silhouette + two white tracking dots (scale/shake probes)
    g.fillStyle = 'rgba(10,10,20,0.85)'
    g.beginPath(); g.arc(330, 400, 130, 0, 7); g.fill()
    g.fillRect(270, 500, 120, 220)
    g.fillStyle = '#ffffff'
    g.beginPath(); g.arc(640, 360, 30, 0, 7); g.fill()
    g.beginPath(); g.arc(940, 360, 14, 0, 7); g.fill()
    s.addAsset({ id: sc.id, name: `${sc.id}.png`, kind: 'image', url: c.toDataURL('image/png'), width: 1280, height: 720, duration: 8 })
    s.addClipToTrack(trackId, sc.id, 0)
    ids.push(store.getState().clips.find((cl) => cl.assetId === sc.id).id)
  }
  // beat cuts: 0.8s each, hero 1.6s — durations/starts set on the clips
  const starts = [0, 0.8, 1.6, 2.4, 3.2]
  const durs = [0.8, 0.8, 0.8, 0.8, 1.6]
  store.setState({
    clips: store.getState().clips.map((cl) => {
      const i = ids.indexOf(cl.id)
      return i >= 0 ? { ...cl, start: starts[i], duration: durs[i] } : cl
    }),
  })
  // music bed
  s.addAsset({ id: 'amv-beat', name: 'beat.wav', kind: 'audio', url: wav, duration: 5 })
  const audioTrack = s.createTrack('audio')
  s.addClipToTrack(audioTrack, 'amv-beat', 0)
  const audioClip = store.getState().clips.find((cl) => cl.assetId === 'amv-beat')
  store.setState({
    clips: store.getState().clips.map((cl) => (cl.id === audioClip.id ? { ...cl, start: 0, duration: 4.8 } : cl)),
  })
  // zoom transition into the hero shot + hero fade-out
  s.addTransition({ type: 'zoom', fromClipId: ids[3], toClipId: ids[4], trackId, startTime: 3.0, duration: 0.4, alignment: 'centered', enabled: true })
  s.setClipKeyframe(ids[4], 'opacity', 0, 1, 'linear')
  s.setClipKeyframe(ids[4], 'opacity', 1.2, 1, 'linear')
  s.setClipKeyframe(ids[4], 'opacity', 1.55, 0, 'linear')
  return { ids, trackId, audioId: audioClip.id }
}, { scenes: SCENES, wav: beatWavDataUrl() })
await page.waitForTimeout(600)
assert(built.ids.length === 5, 'five stills cut on beats + beat WAV placed')

// --- apply the AMV recipes through the real Pack UI --------------------
const applyRecipe = async (clipId, recipe) => {
  await page.evaluate((id) => window.__omniframe_store.getState().selectClip(id), clipId)
  await page.waitForTimeout(200)
  const btn = page.getByTestId(`pack-recipe-${recipe}`)
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  await page.waitForTimeout(350)
}
await page.getByTestId('left-tab-pack').click()
await page.waitForTimeout(500)
await page.getByTestId('pack-section-scenes').click()
await page.waitForTimeout(400)
await applyRecipe(built.ids[0], 'motion-zoom-punch')
await applyRecipe(built.ids[1], 'motion-impact-shake')
await applyRecipe(built.ids[2], 'motion-oscillate')
const keyCounts = await page.evaluate((ids) => {
  const st = window.__omniframe_store.getState()
  const count = (id, prop) => st.clips.find((c) => c.id === id)?.animation?.curves?.[prop]?.keyframes?.length ?? 0
  return {
    punch: count(ids[0], 'scale_x'),
    impactX: count(ids[1], 'position_x'),
    impactRot: count(ids[1], 'rotation_z'),
    osc: count(ids[2], 'position_x'),
    trans: st.transitions.length,
  }
}, built.ids)
assert(keyCounts.punch >= 2 && keyCounts.impactX >= 10 && keyCounts.impactRot >= 10 && keyCounts.osc >= 12 && keyCounts.trans === 1,
  'recipes wrote punch/impact/oscillate keyframes + zoom transition', JSON.stringify(keyCounts))

// --- pixel probes -------------------------------------------------------
const stage = page.locator('[data-testid="preview-stage"]')
async function grabPixels() {
  const shot = await stage.screenshot()
  return page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}` })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    // find the preview canvas rect inside the stage shot (largest dark-bordered area):
    // the stage shot IS the stage; the video canvas fills its centre — sample relative points directly.
    return { data: Array.from(g.getImageData(0, 0, c.width, c.height).data), w: c.width, h: c.height }
  }, shot.toString('base64'))
}
function findStageRect(px) {
  // locate non-black pixel bounds (the rendered 16:9 canvas inside the stage)
  const { data, w, h } = px
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = (y * w + x) * 4
    if (data[i] + data[i + 1] + data[i + 2] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  return { minX, minY, maxX, maxY }
}
function analyze(px, rect) {
  const { data, w } = px
  const fx = (fxv) => rect.minX + fxv * (rect.maxX - rect.minX)
  const fy = (fyv) => rect.minY + fyv * (rect.maxY - rect.minY)
  const at = (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 4; return [data[i], data[i + 1], data[i + 2]] }
  const corner = at(fx(0.07), fy(0.92))
  // white dots: label bright clusters in the middle band
  const seen = new Uint8Array(w * px.h)
  const comps = []
  const stack = []
  for (let y = Math.round(fy(0.3)); y < fy(0.7); y++) for (let x = Math.round(fx(0.25)); x < fx(0.85); x++) {
    const idx = y * w + x
    if (seen[idx]) continue
    seen[idx] = 1
    const i4 = idx * 4
    if (!(data[i4] > 235 && data[i4 + 1] > 235 && data[i4 + 2] > 235)) continue
    let sx = 0, sy = 0, n = 0
    stack.push(idx)
    while (stack.length) {
      const cur = stack.pop()
      const cx = cur % w, cy = (cur / w) | 0
      sx += cx; sy += cy; n++
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= px.h) continue
        const ni = ny * w + nx
        if (seen[ni]) continue
        seen[ni] = 1
        const j = ni * 4
        if (data[j] > 235 && data[j + 1] > 235 && data[j + 2] > 235) stack.push(ni)
      }
    }
    if (n > 20) comps.push({ x: sx / n, y: sy / n, n })
  }
  comps.sort((a, b) => b.n - a.n)
  const toProj = (sx) => ((sx - rect.minX) / (rect.maxX - rect.minX)) * 1280
  return {
    corner,
    big: comps[0] ? { x: toProj(comps[0].x), n: comps[0].n } : null,
    dist: comps.length > 1 ? Math.abs(toProj(comps[1].x) - toProj(comps[0].x)) : null,
  }
}
const nearestScene = (rgb) => {
  const pal = { '#e11d48': [225, 29, 72], '#f59e0b': [245, 158, 11], '#06b6d4': [6, 182, 212], '#a855f7': [168, 85, 247], '#22c55e': [34, 197, 94] }
  let best = '', bd = 1e9
  for (const [name, [r, g, b]] of Object.entries(pal)) {
    const d = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2
    if (d < bd) { bd = d; best = name }
  }
  return best
}
const setT = async (t) => {
  await page.evaluate((tt) => window.__omniframe_store.setState({ playhead: tt, playing: false }), t)
  await page.waitForTimeout(220)
}

// beat cuts land on the right scenes
{
  const times = [0.4, 1.0, 2.0, 2.8, 4.0]
  const expect = ['#e11d48', '#f59e0b', '#06b6d4', '#a855f7', '#22c55e']
  for (let i = 0; i < times.length; i++) {
    await setT(times[i])
    const px = await grabPixels()
    const rect = findStageRect(px)
    const a = analyze(px, rect)
    assert(nearestScene(a.corner) === expect[i], `beat cut ${i + 1} shows scene ${expect[i]} at t=${times[i]}`, `got rgb=${a.corner}`)
  }
}
// zoom punch: dot spacing grows to ~1.15x after 0.15s
{
  await setT(0.03)
  const px1 = await grabPixels()
  const a = analyze(px1, findStageRect(px1))
  await setT(0.6)
  const px2 = await grabPixels()
  const b = analyze(px2, findStageRect(px2))
  const ratio = (b.dist ?? 0) / (a.dist ?? 1)
  assert(ratio > 1.07 && ratio < 1.24, 'zoom punch scales the frame to ~115%', `dist ${a.dist?.toFixed(1)} -> ${b.dist?.toFixed(1)} (ratio ${ratio.toFixed(3)})`)
}
// impact shake: large early displacement that decays
{
  const offs = []
  for (const t of [0.85, 0.9, 0.95, 1.0, 1.1, 1.25]) {
    await setT(t)
    const px = await grabPixels()
    const a = analyze(px, findStageRect(px))
    offs.push(Math.abs((a.big?.x ?? 640) - 640))
  }
  const early = Math.max(offs[0], offs[1], offs[2])
  assert(early > 5, 'impact shake displaces the frame on the hit', `offsets=${offs.map((o) => o.toFixed(1)).join(',')}`)
  assert(offs[5] < early, 'impact shake decays', `late=${offs[5].toFixed(1)} vs early=${early.toFixed(1)}`)
}
// oscillate shake: sustained wobble through the clip
{
  const xs = []
  for (const t of [1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3]) {
    await setT(t)
    const px = await grabPixels()
    const a = analyze(px, findStageRect(px))
    xs.push(a.big?.x ?? 640)
  }
  const range = Math.max(...xs) - Math.min(...xs)
  assert(range > 6, 'oscillate shake wobbles continuously (±7px sine)', `x-range=${range.toFixed(1)}px over ${xs.map((x) => x.toFixed(0)).join(',')}`)
}
// hero fade-out on the opacity curve
{
  await setT(4.3)
  const pxA = await grabPixels(); const a = analyze(pxA, findStageRect(pxA))
  await setT(4.78)
  const pxB = await grabPixels(); const b = analyze(pxB, findStageRect(pxB))
  assert(b.corner[1] < a.corner[1] * 0.35, 'hero fades out to black at the end', `green ${a.corner[1]} -> ${b.corner[1]}`)
}

await setT(1.0)
await page.screenshot({ path: join(OUT, '14-amv-recreate.png') })
console.log('SCREENSHOT 14-amv-recreate.png')

// --- export and verify the rendered file --------------------------------
const exportPromise = page.waitForEvent('download', { timeout: 180000 })
await page.locator('[data-testid="export-video-btn"]').click()
const download = await exportPromise
const exportFile = join(EXPORTS, 'amv_recreate.webm')
await download.saveAs(exportFile)
const size = statSync(exportFile).size
writeFileSync(join(EXPORTS, 'amv_recreate.size.txt'), `${size}\n`)
assert(size > 40000, 'AMV edit exports to WebM', `${size} bytes`)

// Decode the exported frames with OpenCV (same convention as the journey
// suite; headless video->canvas readback is black under SwiftShader).
const { execSync } = await import('child_process')
const pyOut = execSync(
  `python3 -c "
import cv2, json
cap = cv2.VideoCapture('${exportFile.replace(/\\/g, '/')}')
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); fps = cap.get(cv2.CAP_PROP_FPS) or 30
def corner(t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, f = cap.read()
    if not ok: return [0, 0, 0]
    b, g, r = f[int(f.shape[0] * 0.92), int(f.shape[1] * 0.07)]
    return [int(r), int(g), int(b)]
print(json.dumps({'duration': n / fps, 's1': corner(0.4), 's3': corner(2.0), 's5': corner(4.2)}))
cap.release()
"`,
  { encoding: 'utf8' },
)
const frames = JSON.parse(pyOut.trim().split('\n').pop())
assert(frames.duration > 4 && frames.duration < 6, 'export duration matches the 4.8s edit', `${frames.duration.toFixed(2)}s`)
assert(nearestScene(frames.s1) === '#e11d48' && nearestScene(frames.s3) === '#06b6d4' && nearestScene(frames.s5) === '#22c55e',
  'exported frames carry the beat-cut scenes (full-frame, no black bars)', JSON.stringify(frames))

console.log('AMV RECREATE SUITE PASSED')
await browser.close()
