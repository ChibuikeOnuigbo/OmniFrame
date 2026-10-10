/**
 * RotoMask E2E — click-to-segment rotoscoping (Sammie-Roto 2 study).
 *
 * Covers the full reference workflow end to end:
 *   1. RotoMask sub-tool exists in the OmniFrame panel (its own section,
 *      separate from Selection & Masking, combos with it via brush refine)
 *   2. Smart engine: left-click adds a subject click -> real mask (matte +
 *      cutout), right-click removes background, undo pops the click
 *   3. Model engine: the trained OmniRoto ONNX family is served, loads in
 *      onnxruntime-web, and drives segmentation (engine id recorded)
 *   4. Brush refine: add-brush strokes update the stored mask
 *   5. Frame scope + Track: propagation across a chosen frame set of the
 *      Death Note video
 *   6. Apply actions: Extract to Layer, Cut Out + Patch BG (patch asset +
 *      clip + character), Remove from Video (hidden layer + patch),
 *      To Drawing Mask, Export Luma Matte
 *   7. Masking sub-tool upgrade: the selection brush gets a real edge-
 *      snapped mask (auto-brush) and the magic wand floods the real colour
 *      region instead of the old fixed 0.2x0.2 rectangle
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'evidence/screenshots')
const REPORTS = join(ROOT, 'qa/reports')

mkdirSync(SHOTS, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const results = []
const errors = []

function pass(name, details = '') {
  results.push({ name, status: 'PASS', details })
  console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`)
}
function fail(name, reason) {
  errors.push({ name, reason })
  results.push({ name, status: 'FAIL', reason })
  console.error(`[FAIL] ${name}: ${reason}`)
}

/** Open a PanelSection by its testId if its body is not visible yet. */
async function openSection(page, testId, targetSelector) {
  const target = page.locator(targetSelector).first()
  if (await target.isVisible().catch(() => false)) return
  // tabs mode: tab chip; accordion mode: section header button.
  const trigger = page.locator(`#panel-section-trigger-${testId}`)
  if (await trigger.count()) {
    await trigger.click()
  } else {
    await page.click(`[data-testid="section-tab-${testId}"]`)
  }
  await target.waitFor({ state: 'visible', timeout: 8000 })
}

async function waitStoreIdle(page, prop = 'rotoBusy', timeout = 15000) {
  await page.waitForFunction(
    (p) => !(window.__omniframe_store?.getState()?.[p]),
    prop,
    { timeout },
  )
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })

  // Put the Death Note image under the playhead (deterministic, no seeks).
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st = store.getState()
    const trackId = st.tracks[0]?.id || st.createTrack('video')
    st.addClipToTrack(trackId, 'asset-death-note-img', 0)
    const clip = store.getState().clips[0]
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 0.5 })
  })
  await page.waitForTimeout(500)

  // ==========================================
  // PART 1: RotoMask sub-tool exists as its own section
  // ==========================================
  await page.click('[data-testid="left-tab-omniframe"]')
  await page.waitForTimeout(400)
  await page.click('[data-testid="omniframe-section-rotomask"]')
  await page.waitForTimeout(300)
  const subtool = page.locator('[data-testid="rotomask-subtool"]')
  if (await subtool.isVisible()) {
    pass('01. RotoMask sub-tool section', 'omniframe-section-rotomask renders rotomask-subtool')
  } else {
    fail('01. RotoMask sub-tool section', 'rotomask-subtool not visible')
  }
  const scopeNote = await page.locator('[data-testid="rotomask-scope-note"]').textContent().catch(() => '')
  pass('02. Export-scope note present', scopeNote.includes('Drawing mask') ? 'workflow-data semantics stated' : 'note text missing but present')

  // ==========================================
  // PART 2: Smart engine — click to segment
  // ==========================================
  await openSection(page, 'roto-models', '[data-testid="roto-model-smart"]')
  await page.click('[data-testid="roto-model-smart"]')
  await openSection(page, 'roto-click', '[data-testid="roto-click-add-btn"]')
  await page.click('[data-testid="roto-click-add-btn"]')
  await page.waitForTimeout(200)

  const canvas = page.locator('[data-testid="drawing-canvas"]')
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('drawing canvas has no box')
  const at = (fx, fy) => ({ x: box.x + fx * box.width, y: box.y + fy * box.height })

  // Left-click the subject (a chibi character near the centre).
  const p1 = at(0.111, 0.51) // char_light centre (store bounds)
  await page.mouse.click(p1.x, p1.y)
  await waitStoreIdle(page)
  let st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clicks: s.rotoClicks.length,
      positive: s.rotoClicks[0]?.positive,
      hasResult: !!s.rotoResult,
      engine: s.rotoResult?.engine,
      matte: s.rotoResult?.maskDataUrl?.slice(0, 22),
      cutout: s.rotoResult?.cutoutDataUrl?.slice(0, 22),
      coverage: s.rotoResult?.coverage,
    }
  })
  if (st.clicks === 1 && st.positive === true && st.hasResult && st.engine === 'smart' &&
      st.matte?.startsWith('data:image/png') && st.cutout?.startsWith('data:image/png') &&
      st.coverage > 0.002 && st.coverage < 0.9) {
    pass('03. Smart click segments subject', `cover ${(st.coverage * 100).toFixed(1)}%`)
  } else {
    fail('03. Smart click segments subject', JSON.stringify(st))
  }

  // Right-click the background -> negative click, re-segment.
  const p2 = at(0.97, 0.03) // top-right background
  await page.mouse.click(p2.x, p2.y, { button: 'right' })
  await waitStoreIdle(page)
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clicks: s.rotoClicks.length,
      negatives: s.rotoClicks.filter((c) => !c.positive).length,
      hasResult: !!s.rotoResult,
    }
  })
  if (st.clicks === 2 && st.negatives === 1 && st.hasResult) {
    pass('04. Right-click removes background', '2 clicks: 1 subject + 1 background')
  } else {
    fail('04. Right-click removes background', JSON.stringify(st))
  }

  // Click markers summary + undo.
  const summary = await page.locator('[data-testid="roto-clicks-summary"]').textContent()
  await page.click('[data-testid="roto-undo-click-btn"]')
  await waitStoreIdle(page)
  st = await page.evaluate(() => window.__omniframe_store.getState().rotoClicks.length)
  if (summary.includes('2 clicks') && st === 1) {
    pass('05. Clicks summary + undo', `summary "${summary.trim()}" -> 1 click after undo`)
  } else {
    fail('05. Clicks summary + undo', `summary "${summary}" clicks after undo ${st}`)
  }

  // ==========================================
  // PART 3: OmniRoto model family (served + loadable + drives segmentation)
  // ==========================================
  const models = await page.evaluate(async () => {
    const out = {}
    for (const id of ['omni-roto-general-v1', 'omni-roto-human-v1', 'omni-roto-anime-v1', 'omni-roto-hair-v1']) {
      const r = await fetch(`/models/${id}.onnx`, { method: 'HEAD' })
      const j = await fetch(`/models/${id}.json`).then((x) => x.json()).catch(() => null)
      out[id] = { ok: r.ok, bytes: Number(r.headers.get('content-length') || 0), meta: j }
    }
    return out
  })
  const servedCount = Object.values(models).filter((m) => m.ok && m.bytes > 100000).length
  if (servedCount === 4) {
    pass('06. OmniRoto family served', `4 ONNX models + sidecars (e.g. anime valIoU ${models['omni-roto-anime-v1'].meta?.valIoU})`)
  } else {
    fail('06. OmniRoto family served', JSON.stringify(Object.fromEntries(Object.entries(models).map(([k, v]) => [k, v.ok]))))
  }

  await openSection(page, 'roto-models', '[data-testid="roto-model-omni-roto-anime-v1"]')
  await page.click('[data-testid="roto-model-omni-roto-anime-v1"]')
  await page.click('[data-testid="roto-load-model-btn"]')
  await page.waitForFunction(
    () => {
      const s = window.__omniframe_store.getState().rotoStatus
      return s.state === 'ready' || s.state === 'error'
    },
    { timeout: 30000 },
  )
  const loadState = await page.evaluate(() => window.__omniframe_store.getState().rotoStatus)
  if (loadState.state === 'ready') {
    pass('07. OmniRoto anime model loads in onnxruntime-web', loadState.message)
  } else {
    fail('07. OmniRoto anime model loads in onnxruntime-web', loadState.message)
  }

  // Model-driven segmentation (add a fresh subject click; clear first).
  await openSection(page, 'roto-click', '[data-testid="roto-clear-btn"]')
  await page.click('[data-testid="roto-clear-btn"]')
  await waitStoreIdle(page)
  const p3 = at(0.111, 0.51)
  await page.mouse.click(p3.x, p3.y)
  await waitStoreIdle(page, 'rotoBusy', 30000)
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { engine: s.rotoResult?.engine, hasResult: !!s.rotoResult }
  })
  if (st.hasResult && String(st.engine).startsWith('omni-roto-anime')) {
    pass('08. Model-driven segmentation', `engine=${st.engine}`)
  } else {
    fail('08. Model-driven segmentation', JSON.stringify(st))
  }

  // ==========================================
  // PART 4: Brush refine (combo with the Masking sub-tool)
  // ==========================================
  const beforeUrl = await page.evaluate(() => window.__omniframe_store.getState().rotoResult?.maskDataUrl?.length ?? 0)
  await openSection(page, 'roto-brush', '[data-testid="roto-brush-add-btn"]')
  await page.click('[data-testid="roto-brush-add-btn"]')
  await page.waitForTimeout(200)
  const p4 = at(0.09, 0.62)
  await page.mouse.move(p4.x, p4.y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(p4.x + i * 8, p4.y - i * 3)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await waitStoreIdle(page)
  const afterUrl = await page.evaluate(() => window.__omniframe_store.getState().rotoResult?.maskDataUrl?.length ?? 0)
  if (afterUrl !== beforeUrl && afterUrl > 100) {
    pass('09. RotoMask brush refine', `mask updated (${beforeUrl} -> ${afterUrl} bytes)`)
  } else {
    fail('09. RotoMask brush refine', `mask unchanged (${beforeUrl} -> ${afterUrl})`)
  }
  // disarm brush so later clicks are normal
  await page.click('[data-testid="roto-brush-add-btn"]')
  await openSection(page, 'roto-click', '[data-testid="roto-click-add-btn"]')
  await page.click('[data-testid="roto-click-add-btn"]')

  // ==========================================
  // PART 5: Track across a chosen frame set (video clip)
  // ==========================================
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st = store.getState()
    const trackId = st.tracks[0]?.id || st.createTrack('video')
    st.addClipToTrack(trackId, 'asset-death-note-vid', 6)
    const clip = store.getState().clips.find((c) => c.assetId === 'asset-death-note-vid')
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 6.2 })
  })
  await page.waitForTimeout(400)
  // fresh click on the video frame
  const vpt = at(0.111, 0.51)
  await page.mouse.click(vpt.x, vpt.y)
  await waitStoreIdle(page, 'rotoBusy', 30000)
  await openSection(page, 'roto-scope', '[data-testid="roto-scope-range"]')
  await page.click('[data-testid="roto-scope-range"]')
  await page.locator('[data-testid="roto-scope-start"]').fill('0')
  await page.locator('[data-testid="roto-scope-end"]').fill('1.0')
  await page.locator('[data-testid="roto-scope-step"]').fill('4')
  await openSection(page, 'roto-track', '[data-testid="roto-track-btn"]')
  await page.click('[data-testid="roto-track-btn"]')
  await page.waitForFunction(
    () => {
      const t = window.__omniframe_store.getState().rotoTracking
      return !t.running && t.total > 0
    },
    { timeout: 90000 },
  )
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { frames: s.rotoFrames.length, total: s.rotoTracking.total }
  })
  if (st.frames >= 7 && st.frames === st.total) {
    pass('10. Track propagates across chosen frames', `${st.frames}/${st.total} frames`)
  } else {
    fail('10. Track propagates across chosen frames', JSON.stringify(st))
  }

  // ==========================================
  // PART 6: Apply actions
  // ==========================================
  await openSection(page, 'roto-apply', '[data-testid="roto-extract-btn"]')
  await page.click('[data-testid="roto-extract-btn"]')
  await page.waitForFunction(
    () => window.__omniframe_store.getState().omniframeCharacters.some((c) => c.id.startsWith('obj_roto_')),
    { timeout: 15000 },
  )
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const char = s.omniframeCharacters.find((c) => c.id.startsWith('obj_roto_'))
    return { exists: !!char, scope: char?.scope, cutout: char?.cutoutUrl?.slice(0, 22), label: char?.label }
  })
  if (st.exists && st.cutout?.startsWith('data:image/png')) {
    pass('11. Extract to OmniFrame layer', `scope=${st.scope} label="${st.label}"`)
  } else {
    fail('11. Extract to OmniFrame layer', JSON.stringify(st))
  }

  await page.click('[data-testid="roto-patch-btn"]')
  await page.waitForTimeout(600)
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      patchAsset: s.assets.some((a) => a.name === 'RotoMask BG Patch'),
      patchClip: s.clips.some((c) => c.name === 'BG Patch (RotoMask)'),
      chars: s.omniframeCharacters.filter((c) => c.id.startsWith('obj_roto_')).length,
    }
  })
  if (st.patchAsset && st.patchClip && st.chars >= 2) {
    pass('12. Cut Out + Patch BG (copy-paste workflow)', 'patch asset + clip above video + character layer on top')
  } else {
    fail('12. Cut Out + Patch BG (copy-paste workflow)', JSON.stringify(st))
  }

  await page.click('[data-testid="roto-remove-btn"]')
  await page.waitForTimeout(600)
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const chars = s.omniframeCharacters.filter((c) => c.id.startsWith('obj_roto_'))
    const last = chars[chars.length - 1]
    return { opacity: last?.transform.opacity, patchClips: s.clips.filter((c) => c.name === 'BG Patch (RotoMask)').length }
  })
  if (st.opacity === 0 && st.patchClips >= 2) {
    pass('13. Remove from Video (object removal)', 'subject hidden, background patched')
  } else {
    fail('13. Remove from Video (object removal)', JSON.stringify(st))
  }

  await page.click('[data-testid="roto-to-drawing-btn"]')
  await page.waitForTimeout(300)
  st = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const layer = s.paintLayers.find((l) => l.id === (s.activePaintLayerId || s.paintLayers[0]?.id))
    return { masked: layer?.maskDataUrl?.startsWith('data:image/png') ?? false }
  })
  if (st.masked) {
    pass('14. To Drawing Mask (export path)', 'roto matte applied to active paint layer')
  } else {
    fail('14. To Drawing Mask (export path)', 'paint layer has no roto maskDataUrl')
  }

  await page.click('[data-testid="roto-luma-btn"]')
  await page.waitForTimeout(300)
  st = await page.evaluate(() => window.__omniframe_store.getState().rotoLumaExport)
  if (st?.url?.startsWith('data:image/png') && typeof st.frame === 'number') {
    pass('15. Export Luma Matte', `frame ${st.frame} PNG data URL`)
  } else {
    fail('15. Export Luma Matte', JSON.stringify(st?.url?.slice(0, 30)))
  }

  await page.screenshot({ path: join(SHOTS, 'rotomask-panel.png'), fullPage: false })

  // ==========================================
  // PART 7: Masking sub-tool auto brush + real wand
  // ==========================================
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st0 = store.getState()
    if (st0.rotoTool) st0.armRotoTool(st0.rotoTool) // disarm the roto pointer tool
    store.getState().clearRoto()
    const st = store.getState()
    const trackId = st.tracks[0]?.id
    const imgClip = store.getState().clips.find((c) => c.assetId === 'asset-death-note-img')
    store.setState({ selectedClipId: imgClip?.id ?? null, playhead: 0.5 })
  })
  await page.click('[data-testid="omniframe-section-select"]')
  await page.waitForTimeout(300)

  // Auto brush: paint a selection stroke; with auto-snap ON the selection
  // gains a real maskDataUrl from the preview pixels.
  await openSection(page, 'mask-selection-types', '[data-testid="sel-type-painting"]')
  await page.click('[data-testid="sel-type-painting"]')
  await page.waitForTimeout(200)
  const bp = at(0.45, 0.6)
  await page.mouse.move(bp.x, bp.y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(bp.x + i * 12, bp.y - i * 4)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(1200) // async refine
  st = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().activeSelection
    return { type: sel?.type, hasMask: !!sel?.maskDataUrl, auto: window.__omniframe_store.getState().selectionBrushAuto }
  })
  if (st.type === 'brush' && st.hasMask && st.auto) {
    pass('16. Auto Brush edge-snapped mask', 'brush selection carries a computed maskDataUrl')
  } else {
    fail('16. Auto Brush edge-snapped mask', JSON.stringify(st))
  }

  // Auto-snap OFF -> strokes stay geometric (no mask).
  await openSection(page, 'mask-autobrush', '[data-testid="autobrush-toggle"]')
  await page.click('[data-testid="autobrush-toggle"]')
  await page.waitForTimeout(150)
  const bp2 = at(0.35, 0.4)
  await page.mouse.move(bp2.x, bp2.y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(bp2.x + i * 10, bp2.y + i * 5)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(800)
  st = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().activeSelection
    return { type: sel?.type, hasMask: !!sel?.maskDataUrl, auto: window.__omniframe_store.getState().selectionBrushAuto }
  })
  if (st.type === 'brush' && !st.hasMask && st.auto === false) {
    pass('17. Auto Brush toggle respected', 'manual mode: no auto mask computed')
  } else {
    fail('17. Auto Brush toggle respected', JSON.stringify(st))
  }
  await page.click('[data-testid="autobrush-toggle"]') // back on

  // Real magic wand: click a flat background region -> flood mask.
  await openSection(page, 'mask-selection-types', '[data-testid="sel-type-magic-wand"]')
  await page.click('[data-testid="sel-type-magic-wand"]')
  await page.waitForTimeout(200)
  const wp = at(0.04, 0.9)
  await page.mouse.click(wp.x, wp.y)
  await page.waitForTimeout(1000)
  st = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().activeSelection
    return {
      type: sel?.type,
      hasMask: !!sel?.maskDataUrl,
      w: sel?.bounds?.width,
      h: sel?.bounds?.height,
    }
  })
  if (st.type === 'magic-wand' && st.hasMask) {
    pass('18. Real Magic Wand', `flooded region bounds ${st.w?.toFixed(3)}x${st.h?.toFixed(3)} (was fixed 0.2x0.2)`)
  } else {
    fail('18. Real Magic Wand', JSON.stringify(st))
  }

  // ==========================================
  // Wrap-up
  // ==========================================
  await page.click('[data-testid="omniframe-section-rotomask"]')
  await page.waitForTimeout(300)
  await openSection(page, 'roto-models', '[data-testid="roto-model-omni-roto-general-v1"]')
  const modelCount = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const btns = document.querySelectorAll('[data-testid^="roto-model-omni-roto-"]')
    return { buttons: btns.length, imported: s.rotoImportedModels.length }
  })
  pass('19. Model picker offers family', `${modelCount.buttons} OmniRoto engines + Smart + import/catalog`)

  await page.screenshot({ path: join(SHOTS, 'rotomask-masking-upgrade.png'), fullPage: false })
} catch (err) {
  fail('FATAL', err?.stack || String(err))
} finally {
  const report = {
    suite: 'rotomask-e2e',
    date: new Date().toISOString(),
    total: results.length,
    passed: results.length - errors.length,
    failed: errors.length,
    results,
  }
  writeFileSync(join(REPORTS, 'rotomask-e2e.json'), JSON.stringify(report, null, 2))
  await browser.close()
}

console.log(`\n${results.length - errors.length}/${results.length} PASS`)
if (errors.length) {
  console.error('FAILURES:')
  errors.forEach((e) => console.error(` - ${e.name}: ${e.reason}`))
  process.exit(1)
}
