/**
 * CAPCUT-STYLE GRAPH EDITOR E2E
 * =============================
 *
 * Modeled on CapCut's graph function (LC Editing's "CapCut 101: How to use
 * Graphs Function"): X = time from keyframe 1 to keyframe 2, Y = value of
 * the motion, four presets + custom points.
 *
 *  1. Keyframes render as DIAMONDS (NLE standard), not ellipses/circles,
 *     with a generous invisible grab area.
 *  2. Axis labels state the X/Y semantics.
 *  3. Selecting a key highlights its segment band (keyframe-pair editing)
 *     and the readout shows where the segment ends.
 *  4. Easing bar: exactly 4 primary curve-thumbnail presets inline; the
 *     exotic shapes open via the More toggle (all testids preserved).
 *  5. Tangent handles are small squares with hit areas.
 *  6. Dragging a diamond moves the keyframe (time/value update).
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const EVIDENCE = join(ROOT, 'evidence/screenshots')
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(EVIDENCE, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

// Seed: video clip + two position-X keyframes (the video's "add two
// keyframes, make the second bigger" flow).
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const trkId = s.ensureTrack('video')
  s.addAsset({
    id: 'asset-graph-test', name: 'graph-test.mp4', kind: 'video',
    url: 'blob:graph-test', duration: 30, width: 1920, height: 1080,
  })
  s.addClipToTrack(trkId, 'asset-graph-test', 1.0)
  const clip = store.getState().clips[0]
  store.getState().selectClip(clip.id)
  s.setPlayhead(1.0)
})
await page.waitForTimeout(400)

const activateSection = async (id) => {
  const chip = page.locator(`[data-testid="section-tab-${id}"]`)
  if ((await chip.count()) > 0) {
    if ((await chip.getAttribute('aria-selected')) !== 'true') {
      await chip.click()
      await page.waitForTimeout(250)
    }
    return
  }
  const btn = page.locator(`[data-testid="panel-section-${id}"] > button`)
  if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') {
    await btn.click()
    await page.waitForTimeout(200)
  }
}
await activateSection('transform')

// Keyframe 1 at playhead 1.0 (position X)
await page.locator('[data-testid="keyframe-diamond-position_x"]').click()
await page.waitForTimeout(250)
// Keyframe 2 at 3.0 with a bigger value (position X)
await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(3.0))
await page.waitForTimeout(200)
await page.locator('[data-testid="keyframe-diamond-position_x"]').click()
await page.waitForTimeout(300)

// Open the graph editor
await page.locator('[data-testid="toggle-graph-editor-btn"]').click()
await page.waitForTimeout(500)
await page.locator('[data-testid="graph-editor-panel"]').waitFor({ state: 'visible', timeout: 5000 })

// Select the position_x curve
await page.locator('[data-testid="graph-curve-selector"]').selectOption('position_x')
await page.waitForTimeout(400)

// ---------- 1. diamond keyframe nodes ----------
{
  const nodeInfo = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-testid="curve-keyframe-node"]')]
    return {
      count: nodes.length,
      diamonds: nodes.filter((n) => n.querySelector('polygon')).length,
      circles: nodes.filter((n) => n.querySelector('circle')).length,
      hitAreas: nodes.filter((n) => n.querySelector('polygon[fill="transparent"]')).length,
    }
  })
  assert('two keyframes render on the active curve', nodeInfo.count === 2, `${nodeInfo.count} nodes`)
  assert('keyframe nodes are DIAMONDS (polygons), not circles', nodeInfo.diamonds === nodeInfo.count && nodeInfo.circles === 0, JSON.stringify(nodeInfo))
  assert('every diamond has an invisible grab area', nodeInfo.hitAreas === nodeInfo.count, `${nodeInfo.hitAreas}/${nodeInfo.count}`)

  // diamond geometry: width ≈ height for each visible polygon
  const square = await page.evaluate(() => {
    const polys = [...document.querySelectorAll('[data-testid="curve-keyframe-node"] polygon:not([fill="transparent"])')]
    return polys.every((p) => {
      const bb = p.getBBox()
      return Math.abs(bb.width - bb.height) < 1.5 && bb.width > 8 && bb.width < 20
    })
  })
  assert('diamond markers are square and properly sized', square)
}

// ---------- 2. axis semantics labels ----------
{
  const labels = await page.locator('[data-testid="graph-svg-canvas"] text').allTextContents()
  const hasY = labels.some((t) => t.includes('Y · value'))
  const hasX = labels.some((t) => t.includes('X · time'))
  assert('canvas labels state Y · value (CapCut semantics)', hasY, labels.join(' | '))
  assert('canvas labels state X · time (CapCut semantics)', hasX)
}

// ---------- 3. segment band + pair readout ----------
{
  // The editor auto-selects the first key, so its segment band shows at once.
  const band = page.locator('[data-testid="curve-segment-band"]')
  assert('segment band visible for the auto-selected key', (await band.count()) === 1)
  await page.locator('[data-testid="curve-keyframe-node"]').first().click({ force: true })
  await page.waitForTimeout(300)
  assert('selecting a key keeps its segment band', (await band.count()) === 1)
  const bandBox = await band.boundingBox()
  assert('segment band spans a real width', bandBox && bandBox.width > 20, bandBox ? `${Math.round(bandBox.width)}px` : 'none')
  const readout = await page.locator('[data-testid="graph-editor-keyframe-controls"]').innerText()
  // Keys are clip-relative: playhead 1.0/3.0 on a clip starting at 1.0 → 0.00s / 2.00s.
  assert('readout shows the keyframe-pair destination', readout.includes('→') && readout.includes('2.00s'), readout.replace(/\n/g, ' ').slice(0, 90))
}

// ---------- 4. preset bar: 4 thumbnails + More ----------
{
  const primaries = ['linear', 'ease-in', 'ease-out', 'ease-in-out']
  for (const id of primaries) {
    const btn = page.locator(`[data-testid="preset-${id}"]`)
    const visible = await btn.isVisible().catch(() => false)
    assert(`primary preset ${id} visible as thumbnail`, visible)
  }
  const thumbs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="preset-"][data-testid$="-in"], [data-testid^="preset-"][data-testid$="-out"], [data-testid^="preset-"][data-testid$="-in-out"], [data-testid="preset-linear"]')]
      .filter((b) => b.offsetParent !== null)
      .filter((b) => b.querySelector('svg path')).length,
  )
  assert('presets render curve thumbnails (shape, not text)', thumbs >= 4, `${thumbs} thumbnails`)

  // More toggle reveals the exotic set
  const backHidden = await page.locator('[data-testid="preset-back"]').isVisible().catch(() => false)
  assert('exotic presets hidden until More opens', !backHidden)
  await page.locator('[data-testid="preset-more-toggle"]').click()
  await page.waitForTimeout(250)
  const secondary = ['cubic-in', 'cubic-out', 'back', 'bounce', 'elastic', 'constant']
  let allVisible = true
  for (const id of secondary) {
    if (!(await page.locator(`[data-testid="preset-${id}"]`).isVisible().catch(() => false))) allVisible = false
  }
  assert('More reveals all six exotic presets', allVisible, secondary.join(','))

  // Apply ease-in-out and confirm it sticks on the selected key
  await page.locator('[data-testid="preset-ease-in-out"]').click()
  await page.waitForTimeout(300)
  const pressed = await page.locator('[data-testid="preset-ease-in-out"]').getAttribute('aria-pressed')
  assert('applying a preset marks it active', pressed === 'true', `aria-pressed=${pressed}`)
  await page.locator('[data-testid="preset-more-toggle"]').click()
  await page.waitForTimeout(200)
}

// ---------- 5. tangent handles are squares (bezier keys) ----------
{
  // Preset keys have preset interpolations; bezier handles come from keys
  // added on the curve itself (double-click) — CapCut's "custom" graph.
  const svg = page.locator('[data-testid="graph-svg-canvas"]')
  const box = await svg.boundingBox()
  await page.mouse.dblclick(box.x + box.width * 0.65, box.y + box.height * 0.55)
  await page.waitForTimeout(400)
  const nodeCount = await page.locator('[data-testid="curve-keyframe-node"]').count()
  assert('double-click adds a custom point on the curve', nodeCount === 3, `${nodeCount} nodes`)
  // Select the new (last) node — it is bezier, so handles render.
  await page.locator('[data-testid="curve-keyframe-node"]').nth(2).click({ force: true })
  await page.waitForTimeout(300)
  const inCount = await page.locator('[data-testid="curve-tangent-in"]').count()
  if (inCount > 0) {
    const shapes = await page.evaluate(() => {
      const g1 = document.querySelector('[data-testid="curve-tangent-in"]')
      const g2 = document.querySelector('[data-testid="curve-tangent-out"]')
      return {
        inRect: !!(g1 && g1.querySelector('rect')),
        outRect: !!(g2 && g2.querySelector('rect')),
        inCircle: !!(g1 && g1.querySelector('circle')),
      }
    })
    assert('tangent handles are squares with hit areas', shapes.inRect && shapes.outRect && !shapes.inCircle, JSON.stringify(shapes))
  } else {
    assert('tangent handles present for bezier keyframes', false, 'no handles rendered')
  }
}

// ---------- 6. dragging a diamond moves the keyframe ----------
{
  const node = page.locator('[data-testid="curve-keyframe-node"]').first()
  const before = await node.getAttribute('data-key-time')
  const box = await node.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 60, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const after = await page.locator('[data-testid="curve-keyframe-node"]').first().getAttribute('data-key-time')
  assert('dragging a diamond updates the keyframe time', before !== after, `${before}s → ${after}s`)
  await page.screenshot({ path: join(EVIDENCE, 'graph-editor-capcut-style.png') })
}

assert('zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200))

await browser.close()

const pass = results.filter((r) => r.status === 'PASS').length
writeFileSync(join(REPORTS, 'graph-capcut.json'), JSON.stringify({ suite: 'graph-capcut', pass, fail: results.length - pass, results }, null, 2))
console.log(`\n=== ${pass} passed / ${results.length - pass} failed ===`)
process.exit(results.length - pass ? 1 : 0)
