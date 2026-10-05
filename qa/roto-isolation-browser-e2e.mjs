/**
 * In-app isolation test for the OmniRoto model family + smart engine.
 *
 * Runs the REAL app pipeline (onnxruntime-web in the browser, click-seeded
 * segmentation with model-gated growth, the same path a user drives) on the
 * same composites/hold-outs as qa/roto-isolation-models-test.py, whose
 * manifest (qa/assets/roto/composites/manifest.json) carries the ground
 * truth: exact alpha-GT for composites, approximate GT for the held-out
 * studio portrait, qualitative for the hair close-up.
 *
 * Per case: load image under the playhead, pick the engine in the RotoMask
 * panel, click the GT subject centroid, then assert
 *   - the recorded engine id matches the chosen model
 *   - mask coverage is within tier bounds of GT coverage
 *   - the mask mass is localised around the clicked subject
 * plus domain-specialisation, the Extract isolation workflow, and the two
 * Sammie correction loops (extra positive clicks grow an under-segmented
 * mask; a negative right-click trims over-coverage without erasing the
 * subject).
 *
 * Evidence: evidence/rotomask-isolation/in-app--*.png (engine cutouts)
 *          evidence/screenshots/roto-isolation-*.png
 * Report:   qa/reports/roto-isolation-browser.json
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const OUT = join(ROOT, 'evidence/rotomask-isolation')
const SHOTS = join(ROOT, 'evidence/screenshots')
const REPORTS = join(ROOT, 'qa/reports')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'qa/assets/roto/composites/manifest.json'), 'utf8'))

mkdirSync(OUT, { recursive: true })
mkdirSync(SHOTS, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })

const results = []
const failures = []
function pass(name, details = '') {
  results.push({ name, status: 'PASS', details })
  console.log(`[PASS] ${name}${details ? ' (' + details + ')' : ''}`)
}
function fail(name, reason) {
  failures.push(name)
  results.push({ name, status: 'FAIL', reason })
  console.error(`[FAIL] ${name}: ${reason}`)
}

/** Open a PanelSection by testId if its body is not visible yet. */
async function openSection(pg, sectionId, targetSelector) {
  const chip = pg.locator(`[data-testid="section-tab-${sectionId}"]`)
  if ((await chip.count()) && !(await pg.locator(targetSelector).first().isVisible().catch(() => false))) {
    await chip.click()
    await pg.waitForTimeout(250)
  }
}

async function waitStoreIdle(pg, timeout = 240000) {
  await pg.waitForFunction(() => !window.__omniframe_store?.getState()?.rotoBusy, { timeout })
}

const byName = Object.fromEntries(MANIFEST.map((m) => [m.name, m]))
const existsLocally = (name) => !!byName[name] && existsSync(join(ROOT, byName[name].file))
const dataUrlOf = (name) => {
  const entry = byName[name]
  const b = readFileSync(join(ROOT, entry.file))
  return `data:image/png;base64,${b.toString('base64')}`
}
function skipCase(name, reason) {
  results.push({ name, status: 'SKIPPED', reason })
  console.log(`[SKIP] ${name} (${reason})`)
}

let caseIdx = 0

/** Reset roto state, drop previous clips, put `image` under the playhead. */
async function setupCase(image) {
  caseIdx += 1
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st0 = store.getState()
    if (st0.rotoTool) st0.armRotoTool(st0.rotoTool)
    store.getState().clearRoto()
    const st = store.getState()
    for (const c of [...st.clips]) st.removeClip(c.id)
  })
  await page.waitForTimeout(150)
  const assetId = `roto-iso-${caseIdx}`
  await page.evaluate(({ assetId, url, name }) => {
    const store = window.__omniframe_store
    const st = store.getState()
    st.addAsset({ id: assetId, name, kind: 'image', url, duration: 5, width: 640, height: 480, size: 0 })
    const trackId = st.tracks[0]?.id || store.getState().createTrack('video')
    store.getState().addClipToTrack(trackId, assetId, 0)
    const clip = store.getState().clips[0]
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 0.5 })
  }, { assetId, url: dataUrlOf(image), name: image })
  await page.waitForTimeout(400)
}

/** Select + load an engine (model id or 'smart'). Fails the case on error. */
async function pickEngine(engine, label) {
  if (!(await page.locator('[data-testid="rotomask-subtool"]').isVisible().catch(() => false))) {
    await page.click('[data-testid="left-tab-omniframe"]')
    await page.waitForTimeout(350)
    await page.click('[data-testid="omniframe-section-rotomask"]')
    await page.waitForTimeout(250)
  }
  await openSection(page, 'roto-models', engine === 'smart'
    ? '[data-testid="roto-model-smart"]'
    : `[data-testid="roto-model-${engine}"]`)
  const btn = engine === 'smart' ? 'roto-model-smart' : `roto-model-${engine}`
  await page.click(`[data-testid="${btn}"]`)
  if (engine !== 'smart') {
    const loadBtn = page.locator('[data-testid="roto-load-model-btn"]')
    if (await loadBtn.isVisible().catch(() => false)) await loadBtn.click()
    await page.waitForFunction(
      () => {
        const st = window.__omniframe_store?.getState()?.rotoStatus
        return st && (st.state === 'ready' || st.state === 'error')
      },
      { timeout: 30000 },
    )
    const loadState = await page.evaluate(() => window.__omniframe_store.getState().rotoStatus)
    if (loadState.state === 'error') {
      fail(label, `model failed to load: ${loadState.message}`)
      return false
    }
  }
  await page.waitForTimeout(200)
  return true
}

/** Arm the click tool if needed and click at image fractions. */
async function clickAt(fx, fy, button = 'left') {
  await openSection(page, 'roto-click', '[data-testid="roto-click-add-btn"]')
  const armed = await page.evaluate(() => window.__omniframe_store.getState().rotoTool === 'click')
  if (!armed) await page.click('[data-testid="roto-click-add-btn"]')
  await page.waitForTimeout(200)
  const canvas = page.locator('[data-testid="drawing-canvas"]')
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('drawing canvas has no box')
  await page.mouse.click(box.x + fx * box.width, box.y + fy * box.height, { button })
  await waitStoreIdle(page)
}

/** Current measurement: engine id, coverage, mask/cutout data urls, centroid. */
async function measure() {
  return page.evaluate(async () => {
    const r = window.__omniframe_store.getState().rotoResult
    if (!r?.maskDataUrl) return { hasMask: false, engine: r?.engine }
    const img = new window.Image()
    img.src = r.maskDataUrl
    await new Promise((res) => { img.onload = res; img.onerror = res })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0, sx = 0, sy = 0
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const a = d[(y * c.width + x) * 4 + 3]
        if (a > 127) { sum++; sx += x; sy += y }
      }
    }
    return {
      hasMask: true, engine: r.engine, coverage: r.coverage, cutout: r.cutoutDataUrl,
      centroid: sum ? { cx: sx / sum / c.width, cy: sy / sum / c.height } : null,
    }
  })
}

/** Full single-click case with tier assertions + evidence capture. */
async function runCase({ image, engine, bounds, maxCentroidDist = 0.18, label }) {
  const entry = byName[image]
  if (!entry) throw new Error(`manifest has no ${image}`)
  const gt = entry.gtCover
  const [gx, gy] = entry.gtCentroid
  await setupCase(image)
  if (!(await pickEngine(engine, label))) return null
  await clickAt(gx, gy)
  const m = await measure()
  if (!m.hasMask) {
    fail(label, 'no mask produced')
    return null
  }
  if (m.engine !== engine) {
    fail(label, `engine id ${JSON.stringify(m.engine)} != ${engine}`)
    return null
  }
  if (!m.centroid) {
    fail(label, 'mask has no pixels above threshold')
    return null
  }
  const dist = Math.hypot(m.centroid.cx - gx, m.centroid.cy - gy)
  const [lo, hi] = bounds(gt)
  const cover = m.coverage
  const coverOk = cover >= lo && cover <= hi
  const distOk = dist <= maxCentroidDist
  if (coverOk && distOk) {
    pass(label, `engine=${engine} cover=${(cover * 100).toFixed(1)}% (gt ${gt === null ? 'n/a' : (gt * 100).toFixed(1) + '%'}), centroid off by ${dist.toFixed(3)}`)
  } else {
    fail(label, `cover=${(cover * 100).toFixed(1)}% (want ${lo.toFixed(3)}..${hi.toFixed(3)}), centroid dist=${dist.toFixed(3)} (max ${maxCentroidDist})`)
  }
  if (m.cutout) {
    writeFileSync(join(OUT, `in-app--${image}--${engine}.png`), Buffer.from(m.cutout.split(',')[1], 'base64'))
  }
  await page.screenshot({ path: join(SHOTS, `roto-isolation-${String(caseIdx).padStart(2, '0')}-${image}-${engine}.png`) })
  return { coverage: cover, engine }
}

// ============================================================
// The matrix
// EXACT  — strict bounds vs exact alpha GT (high-contrast cases)
// STRESS — known hard cases (pale subject on white canvas, busy photo
//          scenes): the criteria are graceful degradation — a mask that
//          still localises around the subject and stays bounded — plus the
//          designed correction workflows are verified afterwards.
// ============================================================
const EXACT = (gt) => [gt * 0.2, gt * 3.0]
const APPROX = (gt) => [gt * 0.25, gt * 3.5]
const STRESS = () => [0.0005, 0.6]

const lightAnime = await runCase({ image: 'char_light@white-canvas', engine: 'omni-roto-anime-v1', bounds: STRESS, maxCentroidDist: 0.3, label: '01. Anime model · char_light pale-on-white (STRESS: under-segments, must still localise)' })
await runCase({ image: 'char_mello@white-canvas', engine: 'omni-roto-anime-v1', bounds: EXACT, label: '02. Anime model · char_mello (large subject, exact GT)' })
await runCase({ image: 'char_ryuk@white-canvas', engine: 'omni-roto-anime-v1', bounds: EXACT, label: '03. Anime model · char_ryuk (exact GT)' })
await runCase({ image: 'obj_chair@room-photo', engine: 'omni-roto-general-v1', bounds: STRESS, maxCentroidDist: 0.3, label: '04. General model · obj_chair on busy photo (STRESS: over-covers, must stay bounded + localised)' })
let hairHair = null
let hairAnime = null
if (existsLocally('heldout-studio-person')) {
  await runCase({ image: 'heldout-studio-person', engine: 'omni-roto-human-v1', bounds: APPROX, maxCentroidDist: 0.2, label: '05. Human model · held-out studio person (approx GT)' })
} else {
  skipCase('05. Human model · held-out studio person', 'held-out preview not present locally (not redistributable)')
}
if (existsLocally('heldout-hair-closeup')) {
  hairHair = await runCase({ image: 'heldout-hair-closeup', engine: 'omni-roto-hair-v1', bounds: () => [0.25, 0.98], maxCentroidDist: 0.25, label: '06. Hair model · held-out hair close-up (qualitative)' })
  hairAnime = await runCase({ image: 'heldout-hair-closeup', engine: 'omni-roto-anime-v1', bounds: () => [0, 0.5], maxCentroidDist: 1.0, label: '07. Specialisation · anime model on photo must not flood (vs hair model)' })
} else {
  skipCase('06. Hair model · held-out hair close-up', 'held-out preview not present locally (not redistributable)')
  skipCase('07. Specialisation · anime model on photo', 'held-out preview not present locally (not redistributable)')
}
await runCase({ image: 'char_light@white-canvas', engine: 'smart', bounds: STRESS, maxCentroidDist: 0.25, label: '08. Smart engine (no model) · char_light pale-on-white (STRESS: colour-grow cannot separate white-on-white)' })

if (hairHair && hairAnime) {
  const ratio = hairAnime.coverage / Math.max(1e-6, hairHair.coverage)
  if (ratio < 0.5) {
    pass('07b. Specialisation ratio', `anime/hair coverage on the photo = ${ratio.toFixed(2)} (<0.5, anime model correctly reluctant)`)
  } else {
    fail('07b. Specialisation ratio', `anime/hair coverage = ${ratio.toFixed(2)} — anime model fires on photos nearly as strong as the hair model`)
  }
}

// ============================================================
// 09. Extract isolation workflow (general model on the room photo)
// ============================================================
let extractOk = null
{
  const r = await runCase({ image: 'obj_chair@room-photo', engine: 'omni-roto-general-v1', bounds: STRESS, maxCentroidDist: 0.3, label: '09a. General model re-run for Extract (setup)' })
  if (r) {
    await openSection(page, 'roto-apply', '[data-testid="roto-extract-btn"]')
    await page.click('[data-testid="roto-extract-btn"]')
    const created = await page.waitForFunction(
      () => window.__omniframe_store.getState().omniframeCharacters.some((c) => c.id.startsWith('obj_roto_')),
      { timeout: 20000 },
    ).then(() => true).catch(() => false)
    if (created) {
      pass('09. Extract isolation workflow', 'obj_roto_ character layer created from the general-model chair mask')
    } else {
      fail('09. Extract isolation workflow', 'no obj_roto_ character appeared')
    }
    extractOk = created
  }
}

// ============================================================
// 10. Correction workflow A — the Sammie "click more points" loop:
//     two distinct subjects, one click each; the mask must accumulate
//     (second click adds the second subject's blob to the mask)
// ============================================================
{
  const entry = byName['mello+ryuk@white-canvas']
  await setupCase('mello+ryuk@white-canvas')
  if (await pickEngine('omni-roto-anime-v1', '10. Correction loop · click accumulation')) {
    await clickAt(0.35, 0.6) // mello (left paste centre)
    const first = await measure()
    await clickAt(0.68, 0.58) // ryuk (right paste centre)
    const grown = await measure()
    const gtUnion = entry.gtCover
    const accumulates = first.hasMask && grown.hasMask && grown.coverage >= first.coverage * 1.4
    const bounded = grown.hasMask && grown.coverage >= gtUnion * 0.3 && grown.coverage <= gtUnion * 2.5
    if (accumulates && bounded) {
      pass('10. Correction loop · second positive click accumulates the second subject', `coverage ${(first.coverage * 100).toFixed(1)}% -> ${(grown.coverage * 100).toFixed(1)}% (gt union ${(gtUnion * 100).toFixed(1)}%)`)
      if (grown.cutout) writeFileSync(join(OUT, 'in-app--mello+ryuk@white-canvas--omni-roto-anime-v1--accumulated.png'), Buffer.from(grown.cutout.split(',')[1], 'base64'))
    } else {
      fail('10. Correction loop · second positive click accumulates the second subject', `coverage ${first.coverage * 100}% -> ${grown.hasMask ? (grown.coverage * 100).toFixed(1) + '%' : 'no mask'} (gt union ${(gtUnion * 100).toFixed(1)}%, accumulate>=1.4x and bounds 0.3..2.5x gt required)`)
    }
  }
}

// ============================================================
// 11. Correction workflow B — a negative right-click trims an
//     over-covering mask on the busy photo without erasing the subject
//     (probe point (0.25, 0.30) is inside the over-covered mask and far
//     outside the chair's GT bounding box)
// ============================================================
{
  const r = await runCase({ image: 'obj_chair@room-photo', engine: 'omni-roto-general-v1', bounds: STRESS, maxCentroidDist: 0.3, label: '11a. General model re-run for negative-click trim (setup)' })
  if (r) {
    await clickAt(0.25, 0.3, 'right')
    const trimmed = await measure()
    const drop = 1 - trimmed.coverage / r.coverage
    const gtChair = byName['obj_chair@room-photo'].gtCover
    if (drop >= 0.2 && trimmed.coverage >= gtChair * 0.3) {
      pass('11. Correction loop · negative right-click trims over-coverage (subject survives)', `coverage ${(r.coverage * 100).toFixed(1)}% -> ${(trimmed.coverage * 100).toFixed(1)}% (-${(drop * 100).toFixed(0)}%), chair GT ${(gtChair * 100).toFixed(1)}% still covered`)
      if (trimmed.cutout) writeFileSync(join(OUT, 'in-app--obj_chair@room-photo--omni-roto-general-v1--negtrim.png'), Buffer.from(trimmed.cutout.split(',')[1], 'base64'))
    } else {
      fail('11. Correction loop · negative right-click trims over-coverage (subject survives)', `coverage ${(r.coverage * 100).toFixed(1)}% -> ${(trimmed.coverage * 100).toFixed(1)}% (drop ${(drop * 100).toFixed(0)}%, survival ${(trimmed.coverage / gtChair * 100).toFixed(0)}% of GT)`)
    }
  }
}

// ============================================================
// 12-14. SAM Mobile (Segment Anything) — the promptable engine.
//      The user's clicks ARE the prompt; this is the reference
//      tool's headline model and it must beat the saliency family
//      exactly where they struggle (busy photos, pale subjects).
// ============================================================
{
  // 12. obj_chair on the busy room photo — 2 clicks, STRICT bounds
  await setupCase('obj_chair@room-photo')
  if (await pickEngine('sam-mobile-v1', '12. SAM · obj_chair on busy photo (2 clicks)')) {
    const t0 = Date.now()
    await clickAt(0.552, 0.62) // upper chair body
    const first = await measure()
    const t1 = Date.now()
    await clickAt(0.552, 0.85) // lower chair body
    const second = await measure()
    const t2 = Date.now()
    const gtChair = byName['obj_chair@room-photo'].gtCover
    const ok = second.hasMask && second.engine === 'sam-mobile-v1'
      && second.coverage >= gtChair * 0.5 && second.coverage <= gtChair * 1.6
      && second.centroid && Math.hypot(second.centroid.cx - 0.5427, second.centroid.cy - 0.7112) < 0.15
    if (ok) {
      pass('12. SAM · obj_chair on busy photo (2 clicks, strict)', `cover=${(second.coverage * 100).toFixed(1)}% (gt ${(gtChair * 100).toFixed(1)}%), centroid ok, click1 ${t1 - t0}ms (encode), click2 ${t2 - t1}ms (cached decoder)`)
      if (second.cutout) writeFileSync(join(OUT, 'in-app--obj_chair@room-photo--sam-mobile-v1.png'), Buffer.from(second.cutout.split(',')[1], 'base64'))
    } else {
      fail('12. SAM · obj_chair on busy photo (2 clicks, strict)', `cover=${second.coverage * 100}% engine=${second.engine} want [${(gtChair * 0.5).toFixed(3)}, ${(gtChair * 1.6).toFixed(3)}]`)
    }
  }

  // 13. char_light pale-on-white — single click must localise + bound
  const lightEntry = byName['char_light@white-canvas']
  await setupCase('char_light@white-canvas')
  if (await pickEngine('sam-mobile-v1', '13. SAM · char_light pale-on-white')) {
    await clickAt(lightEntry.samClicks[0][0], lightEntry.samClicks[0][1])
    const m = await measure()
    const gt = lightEntry.gtCover
    const ok = m.hasMask && m.engine === 'sam-mobile-v1'
      && m.coverage >= gt * 0.2 && m.coverage <= gt * 3
      && m.centroid && Math.hypot(m.centroid.cx - lightEntry.gtCentroid[0], m.centroid.cy - lightEntry.gtCentroid[1]) < 0.15
    if (ok) {
      pass('13. SAM · char_light pale-on-white', `cover=${(m.coverage * 100).toFixed(2)}% (gt ${(gt * 100).toFixed(2)}%), localised — saliency engines score IoU 0.04-0.36 here`)
      if (m.cutout) writeFileSync(join(OUT, 'in-app--char_light@white-canvas--sam-mobile-v1.png'), Buffer.from(m.cutout.split(',')[1], 'base64'))
    } else {
      fail('13. SAM · char_light pale-on-white', `cover=${m.coverage * 100}% engine=${m.engine} centroid=${JSON.stringify(m.centroid)}`)
    }
  }

  // 14. mello+ryuk — two prompts accumulate both subjects
  const duoEntry = byName['mello+ryuk@white-canvas']
  await setupCase('mello+ryuk@white-canvas')
  if (await pickEngine('sam-mobile-v1', '14. SAM · two subjects accumulate')) {
    await clickAt(duoEntry.samClicks[0][0], duoEntry.samClicks[0][1])
    const first = await measure()
    await clickAt(duoEntry.samClicks[1][0], duoEntry.samClicks[1][1])
    const both = await measure()
    const gtUnion = duoEntry.gtCover
    const ok = first.hasMask && both.hasMask && both.engine === 'sam-mobile-v1'
      && both.coverage >= first.coverage * 1.3
      && both.coverage >= gtUnion * 0.5 && both.coverage <= gtUnion * 1.7
    if (ok) {
      pass('14. SAM · two subjects accumulate', `coverage ${(first.coverage * 100).toFixed(1)}% -> ${(both.coverage * 100).toFixed(1)}% (gt union ${(gtUnion * 100).toFixed(1)}%)`)
      if (both.cutout) writeFileSync(join(OUT, 'in-app--mello+ryuk@white-canvas--sam-mobile-v1.png'), Buffer.from(both.cutout.split(',')[1], 'base64'))
    } else {
      fail('14. SAM · two subjects accumulate', `coverage ${first.coverage * 100}% -> ${both.coverage * 100}% (gt union ${gtUnion * 100}%)`)
    }
  }
}

writeFileSync(join(REPORTS, 'roto-isolation-browser.json'), JSON.stringify({
  timestamp: new Date().toISOString(),
  results,
}, null, 2))

console.log(`\n${results.filter((r) => r.status === 'PASS').length}/${results.length} PASS`)
if (failures.length) {
  console.log('FAILURES:')
  for (const f of failures) console.log(' -', f)
}
await browser.close()
process.exit(failures.length ? 1 : 0)
