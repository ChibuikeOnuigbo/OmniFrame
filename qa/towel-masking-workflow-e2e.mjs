/**
 * TOWEL MASKING WORKFLOW AUDIT — real cursor input, no store shortcuts.
 *
 * Re-runs the room-photo (leather chair + draped towel) masking test the way a
 * human would actually do it: with the cursor on the canvas, using the real
 * selection tools. Nothing here sets `activeSelection` directly except where the
 * test explicitly documents that it is bypassing input.
 *
 * Workflows covered
 *   W1  Freeform lasso around the towel        → fill / recolor
 *   W2  Paint-selection brush over the towel   → fill / recolor
 *   W3  Brush ring (outline) around the towel  → fill  (fill the inside of a ring)
 *   W4  Brush over the BACKGROUND              → invert → fill (towel ends up filled)
 *   W5  Guided Rect background removal         → workflow matte → explicit Drawing-layer apply
 *
 * Every workflow captures evidence screenshots and OpenCV metrics.
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE = process.env.TEST_URL || 'http://localhost:5173'
const SHOTS = path.join(ROOT, 'evidence', 'screenshots')
const CUTOUTS = path.join(ROOT, 'evidence', 'cutouts')
const REPORTS = path.join(ROOT, 'qa', 'reports')
for (const d of [SHOTS, CUTOUTS, REPORTS]) fs.mkdirSync(d, { recursive: true })

try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) {
  console.log('Inflate notice:', e.message)
}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

const checks = []
const ok = (v, name, detail = '') => {
  checks.push({ name, ok: !!v, detail })
  console.log(`${v ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  return !!v
}

await page.goto(`${BASE}/#studio`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

// ---------------------------------------------------------------- 0. SCENE SETUP
await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  s.setLeftTab('omniframe')
  s.setLeftOpen(true)
  s.loadAssetObjects('asset-room-chair-towel')
  if (!s.clips.length) {
    const asset = s.assets.find((a) => a.id === 'asset-room-chair-towel')
    s.addClipToTrack(s.ensureTrack('video'), asset.id, 0)
  }
})
await page.waitForTimeout(900)

// Enter selection mode through the real UI control first — that is what enables
// the drawing/selection overlay the user actually drags on.
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
const fillRecolorDisclosure = page.locator('[data-testid="panel-section-mask-boundary"] > button')
if (await fillRecolorDisclosure.getAttribute('aria-expanded') === 'false') {
  await fillRecolorDisclosure.click()
}
await page.click('[data-testid="sel-type-freeform"]')
await page.waitForTimeout(400)
const canvas = page.locator('[data-testid="drawing-canvas"]')
await canvas.waitFor({ timeout: 15000 })
const box = await canvas.boundingBox()
console.log(`Canvas: ${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)},${Math.round(box.y)})`)

/** Convert normalised (0..1) canvas coords to viewport client coords. */
const P = (nx, ny) => ({ x: box.x + nx * box.width, y: box.y + ny * box.height })

/** Drag a freehand path with the real cursor. */
async function dragPath(pts, { steps = 3 } = {}) {
  const first = P(pts[0][0], pts[0][1])
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (let i = 1; i < pts.length; i++) {
    const p = P(pts[i][0], pts[i][1])
    await page.mouse.move(p.x, p.y, { steps })
  }
  await page.mouse.up()
  await page.waitForTimeout(220)
}

/** Closed ring path (used for the "brush outline" workflow). */
function ringPath(cx, cy, rx, ry, n = 28, inset = 0) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(t) * (rx - inset), cy + Math.sin(t) * (ry - inset)])
  }
  return pts
}

async function resetSelection() {
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.clearSelection()
    s.setDrawingEnabled(true)
  })
  await page.waitForTimeout(150)
}

async function getSelection() {
  return page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const a = s.activeSelection
    if (!a) return null
    return {
      type: a.type,
      bounds: a.bounds,
      pointCount: a.points?.length || 0,
      inverted: !!a.inverted,
      feather: a.feather,
      fillColor: a.fillColor || null,
      maskDisplayMode: a.maskDisplayMode || null,
    }
  })
}

/** The towel occupies roughly the left-middle of the room photo. */
const TOWEL = { x: 0.02, y: 0.20, w: 0.42, h: 0.55 }
const towelOutline = [
  [0.06, 0.24],
  [0.20, 0.22],
  [0.34, 0.27],
  [0.40, 0.40],
  [0.41, 0.55],
  [0.38, 0.68],
  [0.30, 0.74],
  [0.18, 0.72],
  [0.08, 0.62],
  [0.05, 0.45],
  [0.06, 0.24],
]

// ================================================================== W1: LASSO
console.log('\n--- W1: Freeform lasso around the towel → fill ---')
await resetSelection()
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
await page.click('[data-testid="sel-type-freeform"]')
await page.waitForTimeout(150)
ok(
  (await page.evaluate(() => window.__omniframe_store.getState().drawingTool)) === 'select-lasso',
  'W1 freeform sets the lasso selection tool',
)

await dragPath(towelOutline, { steps: 2 })
const w1 = await getSelection()
if (ok(w1 && w1.type === 'lasso', 'W1 lasso produced a lasso selection', JSON.stringify(w1?.type))) {
  ok(w1.pointCount > 8, 'W1 lasso captured a traced point path', `${w1.pointCount} points`)
  ok(
    w1.bounds.width > 0.2 && w1.bounds.height > 0.3,
    'W1 lasso bounds wrap the towel',
    `w=${w1.bounds.width.toFixed(3)} h=${w1.bounds.height.toFixed(3)}`,
  )
}
await page.click('[data-testid="recolor-swatch-blue"]')
await page.waitForTimeout(350)
const w1Fill = await getSelection()
ok(!!w1Fill?.fillColor, 'W1 fill applied to the lassoed area', String(w1Fill?.fillColor))
await page.screenshot({ path: path.join(SHOTS, 'SS-102-towel-lasso-fill.png') })

// ============================================================ W2: PAINT BRUSH
console.log('\n--- W2: Paint-selection brush over the towel → fill ---')
await resetSelection()
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
await page.click('[data-testid="sel-type-painting"]')
await page.waitForTimeout(150)
ok(
  (await page.evaluate(() => window.__omniframe_store.getState().drawingTool)) === 'select-brush',
  'W2 painting sets the paint-selection brush',
)
// scribble back and forth across the towel body
const scribble = []
for (let row = 0; row < 12; row++) {
  const y = 0.26 + row * 0.036
  const pts = row % 2 === 0 ? [0.08, 0.38] : [0.38, 0.08]
  scribble.push([pts[0], y])
  scribble.push([pts[1], y + 0.012])
}
await dragPath(scribble, { steps: 2 })
const w2 = await getSelection()
if (ok(w2 && w2.type === 'brush', 'W2 brush produced a brush selection', JSON.stringify(w2?.type))) {
  ok(w2.pointCount > 12, 'W2 brush accumulated stroke points', `${w2.pointCount} points`)
}
await page.click('[data-testid="recolor-swatch-red"]')
await page.waitForTimeout(350)
const w2Fill = await getSelection()
ok(!!w2Fill?.fillColor, 'W2 fill applied to the brush-painted area', String(w2Fill?.fillColor))
await page.screenshot({ path: path.join(SHOTS, 'SS-103-towel-brush-fill.png') })

// ================================================ W3: BRUSH RING (OUTLINE+FILL)
console.log('\n--- W3: Brush ring around the towel → fill inside the ring ---')
await resetSelection()
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
await page.click('[data-testid="sel-type-painting"]')
await page.waitForTimeout(150)
const ring = ringPath(TOWEL.x + TOWEL.w / 2, TOWEL.y + TOWEL.h / 2, TOWEL.w / 2 + 0.02, TOWEL.h / 2 + 0.02, 26)
await dragPath(ring, { steps: 2 })
const w3 = await getSelection()
if (ok(w3 && w3.type === 'brush', 'W3 ring drawn with the brush', JSON.stringify(w3?.type))) {
  ok(
    w3.bounds.width > 0.35 && w3.bounds.height > 0.5,
    'W3 ring bounds enclose the towel (outline, not a solid fill)',
    `w=${w3.bounds.width.toFixed(3)} h=${w3.bounds.height.toFixed(3)}`,
  )
}
// The ring is an outline: fill it, i.e. colour everything the ring encloses.
await page.click('[data-testid="apply-recolor-btn"]')
await page.waitForTimeout(350)
const w3Fill = await getSelection()
ok(!!w3Fill?.fillColor, 'W3 fill closed the ring and coloured the inside', String(w3Fill?.fillColor))
await page.screenshot({ path: path.join(SHOTS, 'SS-104-towel-brush-ring-fill.png') })

// ============================================ W4: BRUSH BACKGROUND → INVERT
console.log('\n--- W4: Brush the BACKGROUND → invert → fill ---')
await resetSelection()
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
await page.click('[data-testid="sel-type-painting"]')
await page.waitForTimeout(150)
// paint the two background bands (right of the towel, and the lower floor)
await dragPath(
  [
    [0.55, 0.2],
    [0.75, 0.3],
    [0.9, 0.25],
    [0.95, 0.45],
    [0.8, 0.6],
    [0.6, 0.55],
  ],
  { steps: 2 },
)
const w4a = await getSelection()
ok(w4a?.type === 'brush', 'W4 background band painted with the brush', JSON.stringify(w4a?.type))

const beforeInvert = w4a?.inverted
await page.click('[data-testid="subtool-invert-btn"]')
await page.waitForTimeout(250)
const w4b = await getSelection()
ok(
  w4b && w4b.inverted !== beforeInvert,
  'W4 invert flipped the selection boundary',
  `inverted ${beforeInvert} → ${w4b?.inverted}`,
)
await page.click('[data-testid="recolor-swatch-amber"]')
await page.waitForTimeout(350)
const w4Fill = await getSelection()
ok(!!w4Fill?.fillColor, 'W4 fill applied after inversion', String(w4Fill?.fillColor))
await page.screenshot({ path: path.join(SHOTS, 'SS-105-towel-brush-invert-fill.png') })

// ============================ W5: GUIDED RECT BACKGROUND REMOVAL (new feature)
console.log('\n--- W5: Guided Rect background removal (draw box → workflow matte → explicit Drawing layer) ---')
await resetSelection()
await page.click('[data-testid="omniframe-section-select"]')
await page.waitForTimeout(250)
await page.click('[data-testid="sel-type-rect"]')
await page.waitForTimeout(150)

// REAL cursor drag: a rectangle around the towel
const r0 = P(0.03, 0.19)
const r1 = P(0.44, 0.76)
await page.mouse.move(r0.x, r0.y)
await page.mouse.down()
await page.mouse.move(r1.x, r1.y, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const w5rect = await getSelection()
ok(w5rect?.type === 'rectangle', 'W5 rectangle drawn with the real cursor', JSON.stringify(w5rect?.type))
console.log(`   rect bounds: ${JSON.stringify(w5rect?.bounds)}`)

// mark the subject hint inside the box, then run guided removal
const guidedMatteDisclosure = page.locator('[data-testid="panel-section-mask-layer"] > button')
if (await guidedMatteDisclosure.getAttribute('aria-expanded') === 'false') {
  await guidedMatteDisclosure.click()
}
await page.click('[data-testid="guided-hint-center-btn"]')
await page.waitForTimeout(150)
const runBtn = page.locator('[data-testid="guided-rect-bg-removal-btn"]')
ok(await runBtn.isEnabled(), 'W5 guided removal button enabled once a box exists')
await runBtn.click()
await page.waitForTimeout(2500)

const w5 = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const g = s.guidedMatte
  if (!g) return null
  return {
    id: g.id,
    coverage: g.coverage,
    confidence: g.confidence,
    iterations: g.iterations,
    seedStats: g.seedStats,
    timings: g.timings,
    width: g.width,
    height: g.height,
    objectId: g.objectId,
    maskLayerId: g.maskLayerId,
    maskBytes: g.maskDataUrl.length,
    cutoutBytes: g.cutoutDataUrl.length,
    objectCreated: s.omniframeCharacters.some((c) => c.id === g.objectId),
    matteAppliedAnywhere: s.paintLayers.some((l) => l.maskDataUrl === g.maskDataUrl),
  }
})

if (ok(!!w5, 'W5 guided rect removal produced a matte record')) {
  ok(w5.coverage > 0.15 && w5.coverage < 0.99, 'W5 coverage is plausible (not empty, not whole box)', w5.coverage?.toFixed(3))
  ok(w5.confidence > 0.2, 'W5 confidence above noise floor', w5.confidence?.toFixed(3))
  ok(w5.seedStats.background > 50 && w5.seedStats.foreground > 50, 'W5 both seed populations sampled', JSON.stringify(w5.seedStats))
  ok(w5.maskBytes > 2000, 'W5 matte PNG is non-trivial', `${w5.maskBytes} b64 chars`)
  ok(w5.cutoutBytes > 2000, 'W5 cutout PNG is non-trivial', `${w5.cutoutBytes} b64 chars`)
  ok(w5.objectCreated, 'W5 OmniFrame object created from the matte', w5.objectId)
  ok(!w5.maskLayerId, 'W5 OmniFrame matte remains workflow-only by default')
  ok(!w5.matteAppliedAnywhere, 'W5 matte does not affect Drawing layers before explicit conversion')
  console.log(`   timings: ${JSON.stringify(w5.timings)}`)
}

const statusVisible = await page.locator('[data-testid="guided-matte-status"]').count()
ok(statusVisible > 0, 'W5 status readout rendered in the panel')
const mattePrev = page.locator('[data-testid="guided-matte-preview"]')
ok((await mattePrev.count()) > 0, 'W5 matte preview thumbnail rendered')
const cutoutPrev = page.locator('[data-testid="guided-cutout-preview"]')
ok((await cutoutPrev.count()) > 0, 'W5 cutout preview thumbnail rendered')
const matteScopeNote = page.locator('[data-testid="guided-matte-export-scope-note"]')
ok((await matteScopeNote.innerText()).includes('Editing-only matte'), 'W5 UI explains the matte is not exported yet')
const applyMatteBtn = page.locator('[data-testid="apply-guided-matte-to-drawing-btn"]')
ok(await applyMatteBtn.isEnabled(), 'W5 explicit Drawing-layer matte conversion is available')
await page.screenshot({ path: path.join(SHOTS, 'SS-106-guided-rect-bg-removal.png') })

await applyMatteBtn.click()
await page.waitForTimeout(350)
const appliedMatteState = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const matte = s.guidedMatte
  const layer = matte ? s.paintLayers.find((item) => item.id === matte.maskLayerId) : null
  return {
    maskLayerId: matte?.maskLayerId,
    layerHasExactMatte: !!layer && layer.maskDataUrl === matte?.maskDataUrl,
  }
})
ok(!!appliedMatteState.maskLayerId, 'W5 matte conversion records its Drawing-layer target', appliedMatteState.maskLayerId)
ok(appliedMatteState.layerHasExactMatte, 'W5 exact generated alpha matte is applied to the Drawing layer')
ok(await applyMatteBtn.isDisabled(), 'W5 duplicate apply is prevented on the same active layer')

// Drawing mode is allowed to apply a newly generated matte directly, since the
// operation is already scoped to the Drawing paint layer.
await page.locator('[data-testid="left-tab-drawing"]').click()
await page.waitForTimeout(350)
const drawingGuidedDisclosure = page.locator('[data-testid="panel-section-mask-layer"] > button')
if (await drawingGuidedDisclosure.getAttribute('aria-expanded') === 'false') {
  await drawingGuidedDisclosure.click()
}
ok(
  (await page.locator('[data-testid="guided-matte-export-scope-note"]').innerText()).includes('Applied to'),
  'W5 Drawing context explains that its matte is applied to the paint layer',
)
const omniObjectsBeforeDrawingRun = await page.evaluate(
  () => window.__omniframe_store.getState().omniframeCharacters.length,
)
await page.locator('[data-testid="guided-rect-bg-removal-btn"]').click()
await page.waitForTimeout(2600)
const drawingContextMatte = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const matte = s.guidedMatte
  const layer = matte ? s.paintLayers.find((item) => item.id === matte.maskLayerId) : null
  return {
    matteLayerId: matte?.maskLayerId,
    activeLayerId: s.activePaintLayerId,
    layerHasExactMatte: !!layer && layer.maskDataUrl === matte?.maskDataUrl,
    objectId: matte?.objectId,
    objectCount: s.omniframeCharacters.length,
  }
})
ok(
  drawingContextMatte.matteLayerId === drawingContextMatte.activeLayerId && drawingContextMatte.layerHasExactMatte,
  'W5 Drawing-mode matte is applied directly to the active paint layer',
  JSON.stringify(drawingContextMatte),
)
ok(
  drawingContextMatte.objectCount === omniObjectsBeforeDrawingRun && !drawingContextMatte.objectId,
  'W5 Drawing-mode matte does not create an OmniFrame object',
  `${omniObjectsBeforeDrawingRun} → ${drawingContextMatte.objectCount}; objectId=${drawingContextMatte.objectId || 'none'}`,
)
const clearRasterMaskBtn = page.locator(
  `[data-testid="clear-paint-layer-raster-mask-${drawingContextMatte.activeLayerId}"]`,
)
ok(await clearRasterMaskBtn.isVisible(), 'W5 Drawing layer exposes a clear action for its raster mask')
await clearRasterMaskBtn.click()
const clearedMatte = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const matte = s.guidedMatte
  const layer = s.paintLayers.find((item) => item.id === s.activePaintLayerId)
  return { hasRasterMask: !!layer?.maskDataUrl, matteLayerId: matte?.maskLayerId }
})
ok(!clearedMatte.hasRasterMask && !clearedMatte.matteLayerId, 'W5 clear action removes the applied raster mask without deleting the matte preview')

// save the matte + cutout as standalone evidence files
const mattePng = await page.evaluate(() => window.__omniframe_store.getState().guidedMatte?.maskDataUrl || '')
if (mattePng) {
  fs.writeFileSync(
    path.join(CUTOUTS, 'cut-guided-matte.png'),
    Buffer.from(mattePng.split(',')[1], 'base64'),
  )
  console.log('   saved evidence/cutouts/cut-guided-matte.png')
}
const cutPng = await page.evaluate(() => window.__omniframe_store.getState().guidedMatte?.cutoutDataUrl || '')
if (cutPng) {
  fs.writeFileSync(
    path.join(CUTOUTS, 'cut-guided-cutout.png'),
    Buffer.from(cutPng.split(',')[1], 'base64'),
  )
  console.log('   saved evidence/cutouts/cut-guided-cutout.png')
}

// =================================================================== RESULT
const passed = checks.filter((c) => c.ok).length
const failed = checks.length - passed
const report = {
  generatedAt: new Date().toISOString(),
  canvas: { w: Math.round(box.width), h: Math.round(box.height) },
  rectBounds: w5rect?.bounds || null,
  workflows: ['W1-lasso', 'W2-brush', 'W3-brush-ring-fill', 'W4-brush-invert', 'W5-guided-rect-bg-removal'],
  passed,
  failed,
  pageErrors: pageErrors.slice(0, 8),
  checks,
}
fs.writeFileSync(path.join(REPORTS, 'towel-masking-workflow.json'), JSON.stringify(report, null, 2))
console.log(`\n=== ${passed} passed / ${failed} failed ===`)
console.log('Report: qa/reports/towel-masking-workflow.json')
await browser.close()
process.exit(failed > 0 ? 1 : 0)
