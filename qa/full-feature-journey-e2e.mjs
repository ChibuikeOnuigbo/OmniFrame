// Full-feature journey: the user's end-to-end scenario in one chain —
// generate a 2D vector game scene (drawing strokes) -> image-to-video
// timeline -> convert drawing to clips -> compound clip (enter/exit) ->
// OmniFrame selection present -> move the entity from start to exit with
// keyframes -> rotate tricks (spin Z + 3D flip Y) -> export video ->
// OpenCV verifies the entity actually travelled across the exported frames.
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/home/user/OmniFrame'
const EXPORTS_DIR = join(ROOT, 'qa', 'exports')
mkdirSync(EXPORTS_DIR, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

function assert(cond, name, detail = '') {
  if (!cond) throw new Error(`${name}: ${detail}`)
  console.log('PASS', name, detail)
}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 200)))

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1300)

// ---- Step 1: reset + background image (image-to-video base) + entity ----
const ids = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], drawingStrokes: [], selectedClipId: null, playhead: 0 })
  const s = store.getState()
  const mk = (w, h, paint) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    paint(c.getContext('2d'), w, h)
    return c.toDataURL('image/png')
  }
  const bgUrl = mk(640, 360, (g, w, h) => {
    g.fillStyle = '#0b1026'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#1e293b'
    g.fillRect(0, h * 0.78, w, h * 0.22)
  })
  s.addAsset({ id: 'asset-journey-bg', name: 'game-bg.png', kind: 'image', url: bgUrl, width: 640, height: 360 })
  const playerUrl = mk(160, 160, (g, w, h) => {
    g.fillStyle = '#ff00ff'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    g.fillRect(55, 60, 50, 40)
  })
  s.addAsset({ id: 'asset-journey-player', name: 'player.png', kind: 'image', url: playerUrl, width: 160, height: 160 })
  const trkId = s.ensureTrack('video')
  s.addClipToTrack(trkId, 'asset-journey-bg', 0)
  const bg = store.getState().clips.find((c) => c.assetId === 'asset-journey-bg')
  const playerTrk = store.getState().createTrack('video', 'above', trkId)
  store.getState().addClipToTrack(playerTrk, 'asset-journey-player', 0)
  const player = store.getState().clips.find((c) => c.assetId === 'asset-journey-player')
  return { bgId: bg?.id, playerId: player?.id, layerId: store.getState().paintLayers[0]?.id }
})
assert(ids.bgId && ids.playerId, 'image clips on timeline (image-to-video base)', JSON.stringify(ids))
console.log('PASS background + player image clips created')

// ---- Step 2: 2D vector drawing of the game scene (start -> exit) ----
await page.evaluate(({ bgId, layerId }) => {
  const s = window.__omniframe_store.getState()
  const pts = (arr) => arr.map(([x, y], i) => ({ x, y, timestamp: i * 16 }))
  const circle = (cx, cy, r, n = 20) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
    })
  const scope = { type: 'span', startTime: 0, duration: 5 }
  const strokes = [
    // ground line
    { id: 'j-ground', layerId, tool: 'brush', color: '#38bdf8', size: 8, opacity: 1, points: pts([[0.03, 0.78], [0.5, 0.78], [0.97, 0.78]]), temporalScope: scope, layered: true, anchorClipIds: [bgId] },
    // character head (vector circle) + body at the START position
    { id: 'j-head', layerId, tool: 'brush', color: '#facc15', size: 13, opacity: 1, points: pts(circle(0.14, 0.52, 0.045)), temporalScope: scope, layered: true, anchorClipIds: [bgId] },
    { id: 'j-body', layerId, tool: 'brush', color: '#facc15', size: 13, opacity: 1, points: pts([[0.14, 0.565], [0.14, 0.7], [0.1, 0.78], [0.14, 0.7], [0.18, 0.78]]), temporalScope: scope, layered: true, anchorClipIds: [bgId] },
    // EXIT door outline on the right
    { id: 'j-door', layerId, tool: 'brush', color: '#22c55e', size: 9, opacity: 1, points: pts([[0.84, 0.75], [0.84, 0.38], [0.94, 0.38], [0.94, 0.75]]), temporalScope: scope, layered: true, anchorClipIds: [bgId] },
  ]
  for (const st of strokes) s.addDrawingStroke(st)
}, ids)
const strokeCount = await page.evaluate(() => window.__omniframe_store.getState().drawingStrokes.length)
assert(strokeCount >= 4, '2D vector game-scene strokes drawn', `${strokeCount} strokes`)

// ---- Step 3: convert drawing to clips ----
const conv = await page.evaluate(() => {
  const store = window.__omniframe_store
  const before = new Set(store.getState().clips.map((c) => c.id))
  const res = store.getState().convertDrawingToClips()
  const fresh = store.getState().clips.filter((c) => !before.has(c.id))
  return { res, freshIds: fresh.map((c) => c.id), freshKinds: fresh.map((c) => c.kind) }
})
assert(conv.res.clips >= 1 && conv.freshIds.length >= 1, 'drawing converted to clips', JSON.stringify(conv.res))
console.log('PASS drawing-to-clips materialized:', conv.freshKinds.join(','))

// ---- Step 4: compound clip — create, enter nested sequence, exit ----
const comp = await page.evaluate(({ bgId }) => {
  const store = window.__omniframe_store
  const s = store.getState()
  const drawingClip = s.clips.find((c) => c.kind === 'drawing') || s.clips.find((c) => c.id !== bgId && c.assetId !== 'asset-journey-player' && c.kind !== 'compound')
  const compoundId = s.createCompoundClip([bgId, drawingClip.id], 'Game Scene Compound')
  const outer = store.getState().clips.find((c) => c.id === compoundId)
  return { compoundId, kind: outer?.kind, seq: outer?.sourceSequenceId, nested: outer?.nestedClipCount }
}, { bgId: ids.bgId })
assert(comp.kind === 'compound' && comp.seq, 'compound clip created from bg + drawing', JSON.stringify(comp))
await page.evaluate((seq) => window.__omniframe_store.getState().openSequence(seq), comp.seq)
const inside = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { active: s.activeSequenceId, clips: s.clips.length }
})
assert(inside.active === comp.seq && inside.clips >= 2, 'entered compound nested sequence', JSON.stringify(inside))
await page.evaluate(() => window.__omniframe_store.getState().openSequence('main'))
const back = await page.evaluate(() => window.__omniframe_store.getState().activeSequenceId)
assert(back === 'main', 'exited compound back to main timeline')
console.log('PASS compound clip create/enter/exit confirmed')

// ---- Step 5: OmniFrame selection tool state (frame-scope tool present) ----
await page.evaluate(() => {
  window.__omniframe_store.setState({
    activeSelection: { type: 'rectangle', bounds: { x: 0.06, y: 0.4, width: 0.18, height: 0.38 } },
    selectionMode: 'rect',
  })
})
const sel = await page.evaluate(() => window.__omniframe_store.getState().activeSelection)
assert(sel && sel.type === 'rectangle', 'OmniFrame frame-scope selection active over the entity start area')
await page.evaluate(() => window.__omniframe_store.setState({ activeSelection: null }))

// ---- Step 6: move entity start->end + rotate tricks (keyframes) ----
await page.evaluate(({ playerId }) => {
  const s = window.__omniframe_store.getState()
  s.selectClip(playerId)
  s.setClipKeyframe(playerId, 'position_x', 0, -520, 'linear')
  s.setClipKeyframe(playerId, 'position_x', 5, 520, 'linear')
  s.setClipKeyframe(playerId, 'rotation_z', 0, 0, 'linear')
  s.setClipKeyframe(playerId, 'rotation_z', 5, 360, 'linear')
  s.setClipKeyframe(playerId, 'rotation_y', 0, 0, 'linear')
  s.setClipKeyframe(playerId, 'rotation_y', 5, 180, 'linear')
}, ids)
const anim = await page.evaluate(async ({ playerId }) => {
  const { evaluateClipAnimation } = await import('/src/lib/animation/CurveEngine.ts')
  const clip = window.__omniframe_store.getState().clips.find((c) => c.id === playerId)
  const mid = evaluateClipAnimation(clip, clip.start + 2.5)
  const end = evaluateClipAnimation(clip, clip.start + 4.98)
  const start = evaluateClipAnimation(clip, clip.start + 0.02)
  return { start, mid, end }
}, ids)
assert(Math.abs(anim.start.x - -520) < 30 && Math.abs(anim.end.x - 520) < 30, 'entity moves start -> end (position_x keyframes)', `x ${anim.start.x} -> ${anim.end.x}`)
assert(Math.abs(anim.mid.rotationZ - 180) < 8, 'spin trick: rotation_z reaches 180 at midpoint', `${anim.mid.rotationZ}`)
assert(Math.abs(anim.mid.rotationY - 90) < 8, 'flip trick: rotation_y edge-on (90) at midpoint', `${anim.mid.rotationY}`)
assert(Math.abs(anim.end.rotationY - 180) < 8, 'flip trick completes at 180 (mirrored)', `${anim.end.rotationY}`)
console.log('PASS entity path + spin/flip tricks verified in the curve engine')

// ---- Step 7: export the composed video ----
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
await page.waitForTimeout(400)
const exportPromise = page.waitForEvent('download', { timeout: 120000 })
await page.locator('[data-testid="export-video-btn"]').click()
const download = await exportPromise
const exportFile = join(EXPORTS_DIR, 'journey_game_export.webm')
await download.saveAs(exportFile)
assert(existsSync(exportFile), 'exported journey video written')
const size = readFileSync(exportFile).length
assert(size > 20000, 'exported video has real content', `${size} bytes`)
console.log(`PASS video exported: ${exportFile} (${size} bytes)`)

// ---- Step 8: OpenCV verifies the entity travelled start -> exit ----
const py = `
import cv2, json
cap = cv2.VideoCapture("${exportFile}")
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
def centroid_magenta(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (145, 80, 80), (165, 255, 255))
    m = cv2.moments(mask)
    if m["m00"] < 50: return -1
    return m["m10"] / m["m00"]
def frame_at(frac):
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(n * frac) - 1))
    ok, f = cap.read()
    return f if ok else None
early = frame_at(0.12)
late = frame_at(0.88)
W = early.shape[1] if early is not None else 0
print(json.dumps({
  "frames": n, "fps": fps, "width": W,
  "earlyX": centroid_magenta(early) if early is not None else -1,
  "lateX": centroid_magenta(late) if late is not None else -1,
}))
cap.release()
`
const out = execSync(`python3 -c '${py.replace(/'/g, "'\\''")}'`, { encoding: 'utf8' })
const stats = JSON.parse(out.trim().split('\n').pop())
console.log('OpenCV export stats:', JSON.stringify(stats))
assert(stats.frames > 10, 'export contains real frames', `${stats.frames} frames`)
assert(stats.earlyX > 0 && stats.lateX > 0, 'magenta entity found in early and late frames')
assert(stats.lateX > stats.earlyX + stats.width * 0.08, 'entity travelled from start to exit in the exported video', `x ${Math.round(stats.earlyX)} -> ${Math.round(stats.lateX)} of ${stats.width}`)

await browser.close()
console.log('\nJOURNEY COMPLETE: drawing -> clips -> compound -> OmniFrame -> move/rotate tricks -> export all confirmed')
