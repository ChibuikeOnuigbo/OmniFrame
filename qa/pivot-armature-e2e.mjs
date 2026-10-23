// Pivot (anchor) rotation + Krita-style armature recreation:
//  A. a solo arm rotates about its end joint (not its centre),
//  B. the pivot itself can be keyframed and morphs mid-animation,
//  C. a 5-arm chain rebuilt like the Krita armature post — nested compounds,
//     each arm hinged at its linkage — verified by forward-kinematics pixels,
//  D. the on-preview anchor handle drags to a new pivot.
// Arm assets are generated (canvas PNGs); reference technique:
// krita-artists.org/t/armature-animation-with-free-kra-file/88662
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

function assert(cond, name, detail = '') {
  if (!cond) throw new Error(`${name}: ${detail}`)
  console.log('PASS', name, detail)
}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 200)))
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

/** Screenshot the preview stage and return colour centroids as frame fractions. */
async function colourCentroid(hex) {
  const shot = await page.getByTestId('preview-stage').screenshot()
  const b64 = shot.toString('base64')
  return page.evaluate(async ([dataUrl, target]) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const px = g.getImageData(0, 0, c.width, c.height).data
    const tr = parseInt(target.slice(1, 3), 16)
    const tg = parseInt(target.slice(3, 5), 16)
    const tb = parseInt(target.slice(5, 7), 16)
    let sx = 0, sy = 0, n = 0
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        const dr = px[i] - tr, dg = px[i + 1] - tg, db = px[i + 2] - tb
        if (dr * dr + dg * dg + db * db < 3600 && px[i + 3] > 200) {
          sx += x; sy += y; n++
        }
      }
    }
    return n ? { x: sx / n / c.width, y: sy / n / c.height, n } : null
  }, [`data:image/png;base64,${b64}`, hex])
}

const rot = (deg, x, y) => {
  const r = (deg * Math.PI) / 180
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) }
}

// ---------------------------------------------------------------- A: solo arm
const solo = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], selectedClipId: null, playhead: 0, playing: false, pivotEditEnabled: false })
  const s = store.getState()
  const c = document.createElement('canvas')
  c.width = 1280; c.height = 720
  const g = c.getContext('2d')
  g.fillStyle = '#ef4444'
  g.beginPath(); g.roundRect(240, 344, 400, 32, 16); g.fill()
  g.fillStyle = '#ffffff'
  g.beginPath(); g.arc(240, 360, 7, 0, 7); g.fill()
  const url = c.toDataURL('image/png')
  s.addAsset({ id: 'arm-solo', name: 'arm-solo.png', kind: 'image', url, width: 1280, height: 720, duration: 8 })
  const trackId = s.createTrack('video')
  s.addClipToTrack(trackId, 'arm-solo', 0)
  const clip = store.getState().clips[0]
  // anchor on the left joint (the white dot), per the Krita technique
  s.setClipTransform(clip.id, { pivotX: 240 / 1280, pivotY: 0.5 })
  s.setClipKeyframe(clip.id, 'rotation_z', 0, 0, 'linear')
  s.setClipKeyframe(clip.id, 'rotation_z', 2, 90, 'linear')
  return { clipId: clip.id }
})
await page.evaluate(() => window.__omniframe_store.setState({ playhead: 1.0 }))
await page.waitForTimeout(900)
const soloCentroid = await colourCentroid('#ef4444')
{
  const p = rot(45, 200, 0)
  const expected = { x: (240 + p.x) / 1280, y: (360 + p.y) / 720 }
  const err = Math.hypot(soloCentroid.x - expected.x, soloCentroid.y - expected.y)
  assert(err < 0.035, 'solo arm rotates about its end pivot at 45°', `centroid ${soloCentroid.x.toFixed(3)},${soloCentroid.y.toFixed(3)} vs FK ${expected.x.toFixed(3)},${expected.y.toFixed(3)} (err ${err.toFixed(3)})`)
}

// ------------------------------------------------- B: keyframed (moving) pivot
await page.evaluate((clipId) => {
  const s = window.__omniframe_store.getState()
  s.setClipKeyframe(clipId, 'rotation_z', 2, 90, 'constant')
  s.setClipKeyframe(clipId, 'pivot_x', 2, 240 / 1280, 'linear')
  s.setClipKeyframe(clipId, 'pivot_x', 4, 0.5, 'linear')
}, solo.clipId)
await page.evaluate(() => window.__omniframe_store.setState({ playhead: 3.0 }))
await page.waitForTimeout(900)
const morphCentroid = await colourCentroid('#ef4444')
{
  // At t=3 the pivot has moved halfway to centre (440,360); the bar at 90°
  // is centred exactly on that moved hinge. With a FIXED left-joint pivot the
  // centre would sit at (240,560) = (0.188, 0.778) — far away.
  const movedErr = Math.hypot(morphCentroid.x - 440 / 1280, morphCentroid.y - 0.5)
  const fixedErr = Math.hypot(morphCentroid.x - 240 / 1280, morphCentroid.y - 560 / 720)
  assert(movedErr < 0.035 && fixedErr > 0.15,
    'keyframed pivot morphs the hinge mid-animation', `centroid ${morphCentroid.x.toFixed(3)},${morphCentroid.y.toFixed(3)} (moved-err ${movedErr.toFixed(3)}, fixed-err ${fixedErr.toFixed(3)})`)
}

// ------------------------------------------------- C: 5-arm armature (compounds)
// Krita structure: each arm lives in a group with the next arm's group, and
// the GROUP's transform mask (here: the compound clip) rotates about the
// linkage pivot, carrying everything nested inside.
const chain = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], selectedClipId: null, playhead: 0, playing: false })
  const s = store.getState()
  const colours = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']
  const angles = [30, -20, 25, -15, 20]
  const jointX = (i) => 240 + i * 200
  const ids = []
  for (let i = 0; i < 5; i++) {
    const c = document.createElement('canvas')
    c.width = 1280; c.height = 720
    const g = c.getContext('2d')
    g.fillStyle = colours[i]
    g.beginPath(); g.roundRect(jointX(i), 344, 200, 32, 16); g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath(); g.arc(jointX(i), 360, 7, 0, 7); g.fill()
    s.addAsset({ id: `arm-${i}`, name: `arm-${i}.png`, kind: 'image', url: c.toDataURL('image/png'), width: 1280, height: 720, duration: 8 })
    const trackId = s.createTrack('video')
    s.addClipToTrack(trackId, `arm-${i}`, 0)
    const clip = store.getState().clips.find((cl) => cl.assetId === `arm-${i}`)
    s.setClipTransform(clip.id, { pivotX: jointX(i) / 1280, pivotY: 0.5 })
    ids.push(clip.id)
  }
  // Nest from the tip inward; each compound IS the rotating group: pivot on
  // its arm's linkage joint + rotation keyframes on the compound clip.
  let carried = null
  for (let i = 4; i >= 0; i--) {
    carried = s.createCompoundClip(carried ? [ids[i], carried] : [ids[i]], `Arm ${i + 1}`)
    s.setClipTransform(carried, { pivotX: jointX(i) / 1280, pivotY: 0.5 })
    s.setClipKeyframe(carried, 'rotation_z', 0, 0, 'linear')
    s.setClipKeyframe(carried, 'rotation_z', 3, angles[i], 'linear')
  }
  // Root sway on the whole assembly (one more hinge at the base joint)
  const root = s.createCompoundClip([carried], 'Armature')
  s.setClipTransform(root, { pivotX: 240 / 1280, pivotY: 0.5 })
  s.setClipKeyframe(root, 'rotation_z', 0, 0, 'linear')
  s.setClipKeyframe(root, 'rotation_z', 3, 20, 'linear')
  return { rootId: root }
})
await page.evaluate(() => window.__omniframe_store.setState({ playhead: 1.5 }))
await page.waitForTimeout(1000)
{
  // FK expectation at t=1.5 (linear halves): root 10°, arms 15,-10,12.5,-7.5,10
  const half = [10, 15, -10, 12.5, -7.5, 10]
  const joints = [{ x: 240, y: 360 }]
  let run = 0
  for (let i = 0; i < 5; i++) {
    run += half[i] + (i === 0 ? 0 : 0)
    // segment i world angle = root + arms[0..i]; half[] is [root, arm1..arm5]
  }
  run = half[0]
  const centres = []
  for (let i = 0; i < 5; i++) {
    run += half[i + 1]
    const p = rot(run, 200, 0)
    const tip = { x: joints[i].x + p.x, y: joints[i].y + p.y }
    centres.push({ x: (joints[i].x + tip.x) / 2, y: (joints[i].y + tip.y) / 2 })
    joints.push(tip)
  }
  const purple = await colourCentroid('#a855f7')
  const expected = { x: centres[4].x / 1280, y: centres[4].y / 720 }
  const err = Math.hypot(purple.x - expected.x, purple.y - expected.y)
  assert(err < 0.04, '5-arm FK chain: tip arm lands where forward kinematics says', `centroid ${purple.x.toFixed(3)},${purple.y.toFixed(3)} vs FK ${expected.x.toFixed(3)},${expected.y.toFixed(3)} (err ${err.toFixed(3)})`)
  // every arm's centre should also land on the FK chain
  const hexes = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6']
  let worst = 0
  for (let i = 0; i < 4; i++) {
    const c = await colourCentroid(hexes[i])
    const e = Math.hypot(c.x - centres[i].x / 1280, c.y - centres[i].y / 720)
    worst = Math.max(worst, e)
  }
  assert(worst < 0.04, 'all arm centres follow the FK chain', `worst err ${worst.toFixed(3)}`)
}
await page.screenshot({ path: join(OUT, '12-pivot-armature.png') })
console.log('SCREENSHOT 12-pivot-armature.png')

// ------------------------------------------------- D: anchor handle drag
await page.evaluate((rootId) => {
  const store = window.__omniframe_store
  store.setState({ selectedClipId: rootId, pivotEditEnabled: true, playhead: 1.5 })
}, chain.rootId)
const handle = page.getByTestId('pivot-anchor-handle')
await handle.waitFor({ state: 'visible', timeout: 10000 })
const box = await handle.boundingBox()
const stageBox = await page.getByTestId('preview-stage').boundingBox()
const before = await page.evaluate((rootId) => {
  const c = window.__omniframe_store.getState().clips.find((cl) => cl.id === rootId)
  return { x: c.transform.pivotX, y: c.transform.pivotY }
}, chain.rootId)
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const after = await page.evaluate((rootId) => {
  const c = window.__omniframe_store.getState().clips.find((cl) => cl.id === rootId)
  return { x: c.transform.pivotX, y: c.transform.pivotY }
}, chain.rootId)
{
  const expDx = 90 / stageBox.width
  const expDy = 45 / stageBox.height
  const err = Math.hypot(after.x - before.x - expDx, after.y - before.y - expDy)
  assert(err < 0.05, 'anchor handle drag moves the pivot', `Δ=(${((after.x - before.x)).toFixed(3)},${((after.y - before.y)).toFixed(3)}) expected ≈(${expDx.toFixed(3)},${expDy.toFixed(3)})`)
}
// Inspector preset round-trip (activate the Transform section first)
{
  const chip = page.locator('[data-testid="section-tab-transform"]')
  if ((await chip.count()) > 0) {
    if ((await chip.getAttribute('aria-selected')) !== 'true') await chip.click()
  } else {
    await page.locator('[data-testid="panel-section-transform"] > button').first().click()
  }
  await page.waitForTimeout(400)
}
await page.getByTestId('pivot-preset-joint-l').scrollIntoViewIfNeeded()
await page.getByTestId('pivot-preset-joint-l').click()
const preset = await page.evaluate((rootId) => {
  const c = window.__omniframe_store.getState().clips.find((cl) => cl.id === rootId)
  return { x: c.transform.pivotX, y: c.transform.pivotY }
}, chain.rootId)
assert(preset.x === 0 && preset.y === 0.5, 'inspector Joint L preset sets pivot', JSON.stringify(preset))

console.log('PIVOT ARMATURE SUITE PASSED')
await browser.close()
