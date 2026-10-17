// Visual proof tour: screenshots of the shipped improvements, in-app.
// 01 journey start (image-to-video + converted vector-drawing scene)
// 02 rotate tricks mid-flight (spin Z + 3D flip Y on the entity)
// 03 Graph Editor easing-intensity slider (Jitter parity)
// 04 Drawing panel onion-skin tint strength (Krita parity)
// 05 Desktop Pack Motion Presets group (Jitter-style presets)
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'

const ROOT = '/home/user/OmniFrame'
const OUT = join(ROOT, 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 160)))
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1300)

const shot = async (name) => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(OUT, name) })
  console.log('SCREENSHOT', name)
}

// ---- Seed the journey scene (bg, vector game drawing, player) ----
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
  s.addAsset({
    id: 'asset-shot-bg', name: 'game-bg.png', kind: 'image', width: 640, height: 360,
    url: mk(640, 360, (g, w, h) => {
      g.fillStyle = '#0b1026'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#1e293b'
      g.fillRect(0, h * 0.78, w, h * 0.22)
    }),
  })
  s.addAsset({
    id: 'asset-shot-player', name: 'player.png', kind: 'image', width: 160, height: 160,
    url: mk(160, 160, (g, w, h) => {
      g.fillStyle = '#ff00ff'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#ffffff'
      g.fillRect(55, 60, 50, 40)
    }),
  })
  const trkId = s.ensureTrack('video')
  s.addClipToTrack(trkId, 'asset-shot-bg', 0)
  const bg = store.getState().clips.find((c) => c.assetId === 'asset-shot-bg')
  const layerId = store.getState().paintLayers[0]?.id
  const pts = (arr) => arr.map(([x, y], i) => ({ x, y, timestamp: i * 16 }))
  const circle = (cx, cy, r, n = 20) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
    })
  const scope = { type: 'span', startTime: 0, duration: 5 }
  const st = store.getState()
  const strokes = [
    { id: 's-ground', layerId, tool: 'brush', color: '#38bdf8', size: 8, opacity: 1, points: pts([[0.03, 0.78], [0.5, 0.78], [0.97, 0.78]]), temporalScope: scope, layered: true, anchorClipIds: [bg.id] },
    { id: 's-head', layerId, tool: 'brush', color: '#facc15', size: 13, opacity: 1, points: pts(circle(0.14, 0.52, 0.045)), temporalScope: scope, layered: true, anchorClipIds: [bg.id] },
    { id: 's-body', layerId, tool: 'brush', color: '#facc15', size: 13, opacity: 1, points: pts([[0.14, 0.565], [0.14, 0.7], [0.1, 0.78], [0.14, 0.7], [0.18, 0.78]]), temporalScope: scope, layered: true, anchorClipIds: [bg.id] },
    { id: 's-door', layerId, tool: 'brush', color: '#22c55e', size: 9, opacity: 1, points: pts([[0.84, 0.75], [0.84, 0.38], [0.94, 0.38], [0.94, 0.75]]), temporalScope: scope, layered: true, anchorClipIds: [bg.id] },
  ]
  for (const stroke of strokes) st.addDrawingStroke(stroke)
  store.getState().convertDrawingToClips()
  const playerTrk = store.getState().createTrack('video', 'above', trkId)
  store.getState().addClipToTrack(playerTrk, 'asset-shot-player', 0)
  const player = store.getState().clips.find((c) => c.assetId === 'asset-shot-player')
  const p = store.getState()
  p.setClipTransform(player.id, { scale: 0.5 })
  p.selectClip(player.id)
  p.setClipKeyframe(player.id, 'position_x', 0, -520, 'linear')
  p.setClipKeyframe(player.id, 'position_x', 5, 520, 'linear')
  p.setClipKeyframe(player.id, 'rotation_z', 0, 0, 'linear')
  p.setClipKeyframe(player.id, 'rotation_z', 5, 360, 'linear')
  p.setClipKeyframe(player.id, 'rotation_y', 0, 0, 'linear')
  p.setClipKeyframe(player.id, 'rotation_y', 5, 180, 'linear')
  p.setPlayhead(0)
  return { playerId: player.id }
})
console.log('SEEDED player', ids.playerId)

// 01 — journey start: entity at the start line, vector scene composited
await shot('01-journey-start.png')

// 02 — mid-flight tricks: playhead 1.25s => x -260, spin 90deg, flip 45deg
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(1.25))
await shot('02-rotate-tricks-midair.png')

// 03 — Graph Editor with easing intensity (apply ease-out, set 135%)
try {
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
  await page.locator('[data-testid="toggle-graph-editor-btn"]').click()
  await page.waitForTimeout(600)
  await page.locator('[data-testid="graph-curve-selector"]').selectOption('position_x')
  await page.waitForTimeout(400)
  await page.locator('[data-testid="preset-ease-out"]').click()
  await page.waitForTimeout(300)
  const inten = page.locator('[data-testid="easing-intensity-slider"]')
  if ((await inten.count()) === 1) {
    await inten.fill('135')
    await page.waitForTimeout(300)
    console.log('PASS easing intensity slider visible and set to 135%')
  } else {
    console.log('WARN intensity slider not found for screenshot')
  }
} catch (e) {
  console.log('WARN graph step:', String(e).slice(0, 160))
}
await shot('03-graph-easing-intensity.png')

// 04 — Drawing panel: onion skin on, tint strength at 40%
try {
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.setLeftTab('drawing')
    s.setDrawingEnabled(true)
    s.setDrawingScope({ type: 'frame', frame: 0, holdFrames: 1 })
    s.setOnionSkin({ enabled: true, tintStrength: 0.4 })
  })
  await page.waitForTimeout(800)
  // Bring the Timing & Onion Skin section + tint slider into view.
  const chip = page.locator('[data-testid="section-tab-timing"]').first()
  if ((await chip.count()) > 0) {
    await chip.click()
    await page.waitForTimeout(500)
  }
  const tint = page.locator('[data-testid="onion-tint-strength-slider"]').first()
  if ((await tint.count()) > 0) {
    await tint.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(300)
    const val = await page.evaluate(() => window.__omniframe_store.getState().onionSkin)
    console.log(`PASS onion tint strength shown (enabled=${val.enabled}, strength=${val.tintStrength})`)
  } else {
    console.log('WARN tint slider not found for screenshot')
  }
} catch (e) {
  console.log('WARN drawing step:', String(e).slice(0, 160))
}
await shot('04-onion-tint-strength.png')

// 05 — Desktop Pack: Motion Presets group
try {
  await page.getByTestId('left-tab-pack').evaluate((el) => el.click())
  await page.getByTestId('desktop-pack-panel').waitFor({ state: 'visible' })
  await page.waitForTimeout(500)
  await page.getByTestId('pack-section-scenes').click()
  await page.waitForTimeout(500)
  const popIn = page.locator('[data-testid="pack-recipe-motion-pop-in"]')
  if ((await popIn.count()) === 1) {
    await popIn.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    console.log('PASS Motion Presets group scrolled into view')
  } else {
    console.log('WARN motion-pop-in recipe not found for screenshot')
  }
} catch (e) {
  console.log('WARN pack step:', String(e).slice(0, 160))
}
await shot('05-motion-presets.png')

// 06 — NEW: apply Flip In (3D) to the player and catch it mid-flip
try {
  const flip = page.locator('[data-testid="pack-recipe-motion-flip-in"]')
  if ((await flip.count()) === 1) {
    await flip.scrollIntoViewIfNeeded()
    await flip.click()
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const s = window.__omniframe_store.getState()
      s.setLeftTab('media')
      s.setPlayhead(0.28)
    })
    console.log('PASS Flip In (3D) applied; playhead mid-flip')
  } else {
    console.log('WARN flip-in recipe not found for screenshot')
  }
} catch (e) {
  console.log('WARN flip step:', String(e).slice(0, 160))
}
await shot('06-flip-in-midair.png')

await browser.close()
console.log('SCREENS DONE ->', OUT)
