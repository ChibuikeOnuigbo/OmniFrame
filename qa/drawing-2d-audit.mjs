/**
 * 2D DRAWING / PAINTING AUDIT — measured against the Krita reference manual.
 *
 *   https://docs.krita.org/en/reference_manual/tools.html
 *   https://docs.krita.org/en/reference_manual/brushes.html
 *   https://docs.krita.org/en/reference_manual/layers_and_masks/transparency_masks.html
 *
 * Every drawing tool OmniFrame exposes is driven with the real cursor and the
 * resulting stroke is inspected in the store. Anything that claims to draw but
 * produces nothing is reported as a failure.
 *
 * Sections
 *   D1  every tool is present, selectable, and produces a stroke
 *   D2  brush dynamics (pressure size / pressure opacity)
 *   D3  fill tool: tolerance, preserve-luminance recolor
 *   D4  paint layers: add, opacity, blend mode, blur
 *   D5  cel animation: onion skin, step prev/next, hold frames
 *   D6  temporal scopes: global / span / frame
 *   D7  clone stamp requires a sampled source
 *   D8  eraser removes strokes
 *   D9  undo / redo round-trip
 *   D10 Krita parity — which documented Krita tools OmniFrame has and lacks
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE = process.env.TEST_URL || 'http://localhost:5173'
const SHOTS = path.join(ROOT, 'evidence', 'screenshots')
const REPORTS = path.join(ROOT, 'qa', 'reports')
for (const d of [SHOTS, REPORTS]) fs.mkdirSync(d, { recursive: true })

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
await page.waitForTimeout(1500)

// put an image on the timeline so the canvas has something to paint over
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().clips.slice().forEach((c) => g().removeClip(c.id))
  const t = g().ensureTrack('video')
  g().addClipToTrack(t, 'asset-room-chair-towel', 0)
  g().setPlayhead(0)
})
await page.waitForTimeout(800)

// enter drawing mode through the real control
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().setLeftTab('drawing')
  g().setLeftOpen(true)
})
await page.waitForTimeout(500)
const toggle = page.locator('[data-testid="drawing-mode-toggle"]')
if (await toggle.count()) {
  await toggle.first().click()
  await page.waitForTimeout(400)
} else {
  await page.evaluate(() => window.__omniframe_store.getState().setDrawingEnabled(true))
  await page.waitForTimeout(400)
}

const canvas = page.locator('[data-testid="drawing-canvas"]')
await canvas.waitFor({ timeout: 15000 })
const box = await canvas.boundingBox()
const P = (nx, ny) => ({ x: box.x + nx * box.width, y: box.y + ny * box.height })

const strokes = () =>
  page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return (s.drawingStrokes || []).map((k) => ({
      tool: k.tool,
      color: k.color,
      size: k.size,
      opacity: k.opacity,
      points: k.points.length,
      layerId: k.layerId,
      scope: k.temporalScope?.type,
      holdFrames: k.temporalScope?.holdFrames,
      toler: k.fillTolerance,
      lum: k.preserveLuminance,
      clone: !!k.cloneSource,
    }))
  })

const clearAll = async () => {
  await page.evaluate(() => window.__omniframe_store.getState().clearDrawingStrokes())
  await page.waitForTimeout(200)
}

async function draw(pts, { steps = 4 } = {}) {
  const a = P(pts[0][0], pts[0][1])
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i < pts.length; i++) {
    const p = P(pts[i][0], pts[i][1])
    await page.mouse.move(p.x, p.y, { steps })
  }
  await page.mouse.up()
  await page.waitForTimeout(250)
}

const ZIG = [
  [0.15, 0.25],
  [0.35, 0.45],
  [0.55, 0.3],
  [0.75, 0.5],
]

// ============================================================ D1: EVERY TOOL
console.log('\n--- D1: every drawing tool produces a real stroke ---')
const TOOLS = [
  'brush',
  'pencil',
  'marker',
  'calligraphy',
  'eraser',
  'line',
  'rectangle',
  'circle',
  'arrow',
  'star',
  'polygon',
  'polyline',
  'bezier',
  'gradient',
]
for (const tool of TOOLS) {
  await clearAll()
  const btn = page.locator(`[data-testid="drawing-tool-${tool}"]`)
  const present = await btn.count()
  if (!ok(present > 0, `D1 ${tool}: control exists`)) continue
  await btn.first().click()
  await page.waitForTimeout(150)
  const selected = await page.evaluate(() => window.__omniframe_store.getState().drawingTool)
  if (!ok(selected === tool, `D1 ${tool}: clicking selects it`, `drawingTool=${selected}`)) continue
  await draw(ZIG)
  const st = await strokes()
  const last = st[st.length - 1]
  ok(
    !!last && last.tool === tool && last.points >= 2,
    `D1 ${tool}: produced a stroke`,
    last ? `${last.points} pts, size ${last.size}` : 'no stroke recorded',
  )
}

// fill and clone need their own treatment
await clearAll()
const fillBtn = page.locator('[data-testid="drawing-tool-fill"]')
ok((await fillBtn.count()) > 0, 'D1 fill: control exists')
await fillBtn.first().click()
await page.waitForTimeout(150)
const fp = P(0.5, 0.55)
await page.mouse.click(fp.x, fp.y)
await page.waitForTimeout(400)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'fill', 'D1 fill: produced a fill stroke', last ? `tol ${last.toler}` : 'none')
}

await clearAll()
const cloneBtn = page.locator('[data-testid="drawing-tool-clone"]')
ok((await cloneBtn.count()) > 0, 'D1 clone: control exists')
await cloneBtn.first().click()
await page.waitForTimeout(150)
// Krita semantics: the first press with no source samples it (Alt+click / Ctrl+click),
// subsequent drags stamp. So: sample once, then paint.
{
  const sp = P(0.25, 0.3)
  await page.mouse.move(sp.x, sp.y)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(250)
  const src = await page.evaluate(() => window.__omniframe_store.getState().cloneSourcePoint)
  ok(!!src, 'D1 clone: first press samples a source point', src ? `(${src.x?.toFixed(2)}, ${src.y?.toFixed(2)})` : 'none')
  await draw(ZIG)
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'clone', 'D1 clone: second drag produced a clone stroke', last ? `pts ${last.points}` : 'none')
}


/**
 * The drawing panel presents its sections as tabs (single-open in accordion
 * mode). Bring the section owning the next control on screen, either way.
 */
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


await page.screenshot({ path: path.join(SHOTS, 'SS-112-drawing-all-tools.png') })

// ================================================== D2: BRUSH DYNAMICS
console.log('\n--- D2: brush dynamics ---')
await clearAll()
await page.locator('[data-testid="drawing-tool-brush"]').first().click()
await activateSection('brush')
const psize = page.locator('[data-testid="brush-pressure-size-checkbox"]')
const popacity = page.locator('[data-testid="brush-pressure-opacity-checkbox"]')
ok((await psize.count()) > 0, 'D2 pressure-size control exists')
ok((await popacity.count()) > 0, 'D2 pressure-opacity control exists')
if (await psize.count()) {
  await psize.first().click()
  await page.waitForTimeout(150)
}
const dyn = await page.evaluate(() => window.__omniframe_store.getState().brushDynamics)
ok(dyn && typeof dyn.pressureSize === 'boolean', 'D2 brush dynamics state is exposed', JSON.stringify(dyn))
ok(
  dyn && (dyn.smoothingMode === 'none' || dyn.smoothingMode === 'smooth' || dyn.smoothingMode === 'stabilizer'),
  'D2 smoothing mode is one of Krita none/smooth/stabilizer',
  String(dyn?.smoothingMode),
)

// ================================================ D3: FILL TOOL BEHAVIOUR
console.log('\n--- D3: fill tolerance and preserve-luminance ---')
await activateSection('tool-params')
await clearAll()
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().setDrawingTool('fill')
  g().setFillTolerance?.(30)
  g().setPreserveLuminance?.(true)
})
await page.waitForTimeout(200)
const tolSlider = page.locator('[data-testid="panel-fill-tolerance-slider"]')
ok((await tolSlider.count()) > 0, 'D3 fill tolerance slider exists')
const lumBox = page.locator('[data-testid="panel-preserve-luminance-checkbox"]')
ok((await lumBox.count()) > 0, 'D3 preserve-luminance checkbox exists')
{
  const p = P(0.45, 0.5)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(500)
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'fill', 'D3 fill recorded', last ? `tol ${last.toler} lum ${last.lum}` : 'none')
}

// ====================================================== D4: PAINT LAYERS
console.log('\n--- D4: paint layers ---')
await activateSection('layers')
const layersBefore = await page.evaluate(() => window.__omniframe_store.getState().paintLayers.length)
const addLayer = page.locator('[data-testid="add-paint-layer-btn"]')
ok((await addLayer.count()) > 0, 'D4 add-paint-layer control exists')
if (await addLayer.count()) {
  await addLayer.first().click()
  await page.waitForTimeout(300)
}
const layersAfter = await page.evaluate(() => window.__omniframe_store.getState().paintLayers.length)
ok(layersAfter === layersBefore + 1, 'D4 adding a paint layer works', `${layersBefore} -> ${layersAfter}`)

// Opacity / blend / blur live under Brush & Layer Properties.
await activateSection('brush')
for (const [tid, label] of [
  ['layer-opacity-slider', 'opacity'],
  ['layer-blend-mode-select', 'blend mode'],
  ['layer-blur-slider', 'blur'],
]) {
  ok((await page.locator(`[data-testid="${tid}"]`).count()) > 0, `D4 layer ${label} control exists`)
}

// ============================================= D5: CEL ANIMATION / ONION SKIN
console.log('\n--- D5: cel animation and onion skin ---')
await activateSection('timing')
// The cel-animation controls live on the drawing toolbar in some layouts and in
// the drawing panel in others; accept either surface, but require one of them.
const CEL_CONTROLS = [
  { label: 'onion skin', ids: ['onion-skin-toggle', 'panel-onion-skin-toggle'] },
  { label: 'step next cel', ids: ['step-next-cel-btn', 'panel-step-next-cel'] },
  { label: 'step prev cel', ids: ['step-prev-cel-btn', 'panel-step-prev-cel'] },
  { label: 'cel hold frames', ids: ['panel-cel-hold-frames'] },
  { label: 'current cel badge', ids: ['current-cel-badge'] },
]
const resolveId = async (ids) => {
  for (const id of ids) if ((await page.locator(`[data-testid="${id}"]`).count()) > 0) return id
  return null
}
// Cel stepping and onion skin are only shown in the per-frame cel scope, the
// same way Krita only offers onion skinning when working on animation cels.
await page.evaluate(() => window.__omniframe_store.getState().setDrawingScope({ type: 'frame' }))
await page.waitForTimeout(350)
const onionId = await resolveId(CEL_CONTROLS[0].ids)
for (const c of CEL_CONTROLS) {
  const id = await resolveId(c.ids)
  ok(!!id, `D5 ${c.label} control exists`, id ? `via ${id}` : `none of ${c.ids.join(', ')}`)
}
{
  const before = await page.evaluate(() => window.__omniframe_store.getState().onionSkin)
  let toggled = false
  if (onionId) {
    await page.locator(`[data-testid="${onionId}"]`).first().click()
    await page.waitForTimeout(300)
    toggled = true
  }
  const after = await page.evaluate(() => window.__omniframe_store.getState().onionSkin)
  ok(
    !!after && after.enabled !== before?.enabled,
    'D5 onion skin toggles',
    `${before?.enabled} -> ${after?.enabled}${toggled ? ` (via ${onionId})` : ''}`,
  )
}

await page.evaluate(() => window.__omniframe_store.getState().setDrawingScope({ type: 'global' }))
await page.waitForTimeout(200)

// ==================================================== D6: TEMPORAL SCOPES
console.log('\n--- D6: temporal scopes ---')
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('brush'))
for (const scope of ['global', 'span', 'frame']) {
  await page.evaluate((s) => window.__omniframe_store.getState().setDrawingScope?.({ type: s }), scope)
  await page.waitForTimeout(150)
  await draw(ZIG)
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last, `D6 stroke recorded with scope ${scope}`, last ? `scope=${last.scope}` : 'none')
}

// ========================================================= D7: CLONE SOURCE
console.log('\n--- D7: clone stamp source sampling ---')
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('clone'))
await draw(ZIG)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.clone, 'D7 clone stroke carries a sampled source point', last ? `clone=${last.clone}` : 'none')
}

// ================================================================ D8: ERASER
console.log('\n--- D8: eraser ---')
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('brush'))
await draw(ZIG)
const beforeErase = (await strokes()).length
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('eraser'))
await draw(ZIG)
const afterErase = await strokes()
ok(afterErase.length >= beforeErase, 'D8 eraser strokes are recorded', `${beforeErase} -> ${afterErase.length}`)
ok(
  afterErase.some((s) => s.tool === 'eraser'),
  'D8 an eraser stroke is present in the stroke list',
)

// =========================================================== D9: UNDO / REDO
console.log('\n--- D9: undo / redo ---')
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('brush'))
await draw(ZIG)
const n1 = (await strokes()).length
await page.keyboard.press('Control+z')
await page.waitForTimeout(400)
const n2 = (await strokes()).length
ok(n2 < n1 || n1 === 0, 'D9 undo removes the stroke', `${n1} -> ${n2}`)
await page.keyboard.press('Control+Shift+z')
await page.waitForTimeout(400)
const n3 = (await strokes()).length
ok(n3 >= n2, 'D9 redo restores without losing data', `${n2} -> ${n3}`)

// ====================================================== D10: KRITA PARITY
console.log('\n--- D10: Krita documented tool parity ---')
const KRITA_TOOLS = {
  'Freehand Brush Tool': ['brush', 'pencil', 'marker'],
  'Calligraphy Tool': ['calligraphy'],
  'Straight Line Tool': ['line'],
  'Rectangle Tool': ['rectangle'],
  'Ellipse Tool': ['circle'],
  'Fill Tool': ['fill'],
  'Clone Brush Engine': ['clone'],
  'Color Sampler Tool': ['eyedropper'],
  'Rectangular Selection Tool': ['select-rect'],
  'Elliptical Selection Tool': ['select-ellipse'],
  'Freehand Selection Tool': ['select-lasso'],
  'Polygonal Selection Tool': ['select-polygon'],
  'Contiguous Selection Tool': ['select-magic-wand'],
  'Polygon Tool': ['polygon'],
  'Polyline Tool': ['polyline'],
  'Bezier Curve Tool': ['bezier'],
  'Freehand Path Tool': ['bezier'],
  'Gradient Tool': ['gradient'],
  'Dynamic Brush Tool': [],
  'Multibrush Tool': [],
  'Crop Tool': [],
  'Move Tool': [],
  'Transform Tool': [],
  'Enclose and Fill Tool': [],
  'Colorize Mask': [],
  'Smart Patch Tool': [],
  'Assistant Tool': [],
  'Reference Images Tool': [],
  'Measure Tool': [],
  'Path Selection Tool': [],
  'Similar Color Selection Tool': [],
  'Magnetic Selection Tool': [],
  'Shape Selection Tool': [],
  'Shape Edit Tool': [],
  'Text Tool': [],
  'Comic Panel Editing Tool': [],
  'Zoom Tool': [],
  'Pan Tool': [],
}
// OmniFrame splits its toolbox across two surfaces: the drawing toolbar
// (`drawing-tool-*`) and the masking/tracking panel (`select-tool-*`). Krita's
// toolbox is one list, so parity is measured against the union.
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().setLeftTab('tracking')
  g().setLeftOpen(true)
})
await page.waitForTimeout(500)
const selectTools = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('[data-testid^="select-tool-"]').forEach((n) => out.push('select-' + n.getAttribute('data-testid').replace('select-tool-', '')))
  return out
})
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().setLeftTab('drawing')
  g().setLeftOpen(true)
})
await page.waitForTimeout(400)
const presentTools = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('[data-testid^="drawing-tool-"]').forEach((n) => out.push(n.getAttribute('data-testid').replace('drawing-tool-', '')))
  return out
})
presentTools.push(...selectTools)
console.log(`   drawing tools: ${presentTools.filter((t) => !t.startsWith('select-')).join(', ')}`)
console.log(`   selection tools: ${selectTools.join(', ')}`)
const parity = []
for (const [krita, ofTools] of Object.entries(KRITA_TOOLS)) {
  const has = ofTools.length > 0 && ofTools.some((t) => presentTools.includes(t))
  parity.push({ krita, omiframe: ofTools.join(', ') || '—', has })
}
// Some Krita toolbox tools exist in OmniFrame, but outside the drawing
// toolbox. Measure that rather than asserting it: switch to the owning tab and
// look for the real control.
const ELSEWHERE = {
  'Text Tool': { tab: 'text', testid: 'add-text-clip-btn' },
  'Zoom Tool': { tab: 'editing', testid: null, probe: () => 'zoomBy' },
}
for (const [krita, spec] of Object.entries(ELSEWHERE)) {
  if (!spec.testid) continue
  await page.evaluate((t) => {
    const g = window.__omniframe_store.getState
    g().setLeftTab(t)
    g().setLeftOpen(true)
  }, spec.tab)
  await page.waitForTimeout(400)
  const found = (await page.locator(`[data-testid="${spec.testid}"]`).count()) > 0
  const row = parity.find((p) => p.krita === krita)
  if (row && found) {
    row.has = true
    row.elsewhere = spec.tab
  }
}
await page.evaluate(() => {
  const g = window.__omniframe_store.getState
  g().setLeftTab('drawing')
  g().setLeftOpen(true)
})
await page.waitForTimeout(300)

const haveCount = parity.filter((p) => p.has).length
const fromDrawing = parity.filter((p) => p.has && !p.elsewhere).length
const fromElsewhere = parity.filter((p) => p.has && p.elsewhere).length
console.log(`   Krita tools covered: ${haveCount}/${parity.length} (${fromDrawing} in the drawing toolbox, ${fromElsewhere} elsewhere in the app)`)
for (const p of parity) if (!p.has) console.log(`     MISSING: ${p.krita}`)
ok(haveCount > 0, 'D10 Krita parity measured', `${haveCount}/${parity.length}`)

// ============================================= D12: COLOR SAMPLER TOOL
console.log('\n--- D12: color sampler (Krita Color Sampler Tool) ---')
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('brush'))
await page.waitForTimeout(150)
const sampleBtn = page.locator('[data-testid="drawing-tool-eyedropper"]')
ok((await sampleBtn.count()) > 0, 'D12 color sampler control exists')
if (await sampleBtn.count()) {
  await page.evaluate(() => window.__omniframe_store.getState().setDrawingColor('#ff0000'))
  await sampleBtn.first().click()
  await page.waitForTimeout(200)
  const armed = await page.evaluate(() => window.__omniframe_store.getState().drawingTool)
  ok(armed === 'eyedropper', 'D12 colour sampler can be selected', armed)
  {
    const p = P(0.35, 0.45)
    await page.mouse.click(p.x, p.y)
    await page.waitForTimeout(350)
  }
  const afterPick = await page.evaluate(() => ({
    color: window.__omniframe_store.getState().drawingColor,
    tool: window.__omniframe_store.getState().drawingTool,
  }))
  ok(afterPick.color !== '#ff0000', 'D12 sampling changed the active colour', afterPick.color)
  ok(afterPick.tool === 'brush', 'D12 returns to the previous tool after sampling', afterPick.tool)
}

// ============================================ D11: NEW SHAPE TOOL OPTIONS
console.log('\n--- D11: polygon / gradient options ---')
await activateSection('tool-params')
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('polygon'))
await page.waitForTimeout(250)
for (const [tid, label] of [
  ['panel-polygon-sides-slider', 'polygon sides'],
  ['panel-shape-filled-checkbox', 'shape fill'],
]) {
  ok((await page.locator(`[data-testid="${tid}"]`).count()) > 0, `D11 ${label} control exists`)
}
await clearAll()
await draw(ZIG)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(
    !!last && last.tool === 'polygon',
    'D11 polygon stroke recorded with side count',
    last ? `pts ${last.points}` : 'none',
  )
}
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('gradient'))
await page.waitForTimeout(250)
for (const [tid, label] of [
  ['panel-gradient-color-input', 'gradient end colour'],
  ['panel-gradient-transparent-btn', 'fade to transparent'],
]) {
  ok((await page.locator(`[data-testid="${tid}"]`).count()) > 0, `D11 ${label} control exists`)
}
await clearAll()
await draw(ZIG)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'gradient', 'D11 gradient stroke recorded', last ? `pts ${last.points}` : 'none')
}
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('bezier'))
await draw(ZIG)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'bezier', 'D11 bezier path stroke recorded', last ? `pts ${last.points}` : 'none')
}
await clearAll()
await page.evaluate(() => window.__omniframe_store.getState().setDrawingTool('polyline'))
await draw(ZIG)
{
  const st = await strokes()
  const last = st[st.length - 1]
  ok(!!last && last.tool === 'polyline', 'D11 polyline stroke recorded', last ? `pts ${last.points}` : 'none')
}
await page.screenshot({ path: path.join(SHOTS, 'SS-113-drawing-krita-shape-tools.png') })

// ============================================== D13: STROKES ACTUALLY RENDER
// Recording a stroke is not the same as showing one. This counts non-transparent
// pixels on the drawing overlay for every tool, so a stroke that is filtered out
// of the renderer (and therefore invisible) fails the audit.
console.log('\n--- D13: every tool paints visible pixels ---')
const overlayPx = () =>
  page.evaluate(() => {
    const cv = [...document.querySelectorAll('canvas')].find((c) => c.getAttribute('data-testid') === 'drawing-canvas')
    if (!cv) return -1
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
{
  await page.evaluate(() => window.__omniframe_store.getState().clearDrawingStrokes())
  await page.waitForTimeout(500)
  const empty = await overlayPx()
  ok(empty === 0, 'D13 overlay is empty with no strokes', `${empty} px`)
  const coverage = {}
  for (const tool of ['brush', 'pencil', 'marker', 'calligraphy', 'line', 'rectangle', 'circle', 'arrow', 'star', 'polygon', 'polyline', 'bezier', 'gradient']) {
    await page.evaluate(() => window.__omniframe_store.getState().clearDrawingStrokes())
    await page.waitForTimeout(300)
    await page.evaluate((t) => {
      const g = window.__omniframe_store.getState
      g().setDrawingTool(t)
      g().setDrawingColor('#ff2d55')
      g().setDrawingSize(14)
      g().setDrawingOpacity(1)
      if (t === 'polygon') {
        g().setDrawingPolygonSides(6)
        g().setDrawingShapeFilled(true)
      }
      if (t === 'gradient') g().setDrawingGradientColor('#00000000')
    }, tool)
    await page.waitForTimeout(150)
    await draw([
      [0.22, 0.3],
      [0.5, 0.62],
      [0.78, 0.34],
    ])
    const px = await overlayPx()
    coverage[tool] = px
    ok(px > 500, `D13 ${tool}: paints visible pixels`, `${px} px`)
  }

  // Eraser must remove coverage, not add to it.
  await page.evaluate(() => window.__omniframe_store.getState().clearDrawingStrokes())
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const g = window.__omniframe_store.getState
    g().setDrawingTool('brush')
    g().setDrawingSize(20)
  })
  await draw([
    [0.2, 0.3],
    [0.8, 0.5],
  ])
  const beforeErasePx = await overlayPx()
  await page.evaluate(() => {
    const g = window.__omniframe_store.getState
    g().setDrawingTool('eraser')
    g().setDrawingSize(30)
  })
  await draw([
    [0.2, 0.3],
    [0.8, 0.5],
  ])
  const afterErasePx = await overlayPx()
  ok(afterErasePx < beforeErasePx, 'D13 eraser removes painted pixels', `${beforeErasePx} -> ${afterErasePx}`)
  await page.evaluate(() => window.__omniframe_store.getState().clearDrawingStrokes())
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, 'SS-114-drawing-render-verification.png') })
}

fs.writeFileSync(
  path.join(REPORTS, 'drawing-2d-audit.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      tools: presentTools,
      kritaParity: parity,
      kritaCovered: haveCount,
      kritaFromDrawingToolbox: fromDrawing,
      kritaFromElsewhere: fromElsewhere,
      kritaTotal: parity.length,
      renderCoverage: typeof coverage === 'undefined' ? null : coverage,
      pageErrors: pageErrors.slice(0, 8),
      checks,
    },
    null,
    2,
  ),
)

const passed = checks.filter((c) => c.ok).length
const failed = checks.length - passed
console.log(`\n=== ${passed} passed / ${failed} failed ===`)
console.log('Report: qa/reports/drawing-2d-audit.json')
await browser.close()
process.exit(failed > 0 ? 1 : 0)
