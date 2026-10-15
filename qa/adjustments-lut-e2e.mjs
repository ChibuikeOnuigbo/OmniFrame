/**
 * Adjustment-layer and LUT workflow regression test.
 *
 * Run with a Vite server at localhost:5173:
 *   URL=http://localhost:5173/#studio node qa/adjustments-lut-e2e.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}

const browser = await playwrightChromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const runtimeErrors = []
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(20000)
page.on('pageerror', (error) => runtimeErrors.push(String(error)))
page.on('console', (message) => message.type() === 'error' && runtimeErrors.push(message.text()))
const waitForState = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000 })

try {
  console.log('Loading editor')
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.evaluate(() => window.__omniframe_store.getState().setPreviewQuality('low'))
  await page.waitForFunction(() => document.querySelector('#of-canvas')?.width === 426, null, { timeout: 15000 })
  console.log('Editor ready at low preview quality for deterministic LUT rendering')

  const seeded = await page.evaluate(() => {
    const store = window.__omniframe_store
    const state = store?.getState?.()
    if (!state) throw new Error('Editor store was not exposed')
    const image = state.assets.find((asset) => asset.id === 'asset-death-note-img')
    if (!image) throw new Error('Bundled image fixture is missing')
    const baseTrackId = state.createTrack('video')
    state.addClipToTrack(baseTrackId, image.id, 0)
    const baseClip = store.getState().clips.find((clip) => clip.trackId === baseTrackId)
    if (!baseClip) throw new Error('Could not seed base image clip')
    store.getState().addTextTitleClip('TOP TITLE', 4)
    const textClip = store.getState().clips.find((clip) => clip.textStyle?.text === 'TOP TITLE')
    if (!textClip) throw new Error('Could not seed upper text clip')
    store.getState().setClipProp(textClip.id, {
      textStyle: { ...textClip.textStyle, fontSize: 90, color: '#ffffff', backgroundColor: '#00ff00' },
    })
    store.getState().selectClip(baseClip.id)
    return { baseClipId: baseClip.id, baseTrackId, textClipId: textClip.id }
  })
  console.log('Seeded base footage and upper title')

  const samplePreviewPixels = () => page.evaluate(() => {
    const canvas = document.querySelector('#of-canvas')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Preview canvas is missing')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Preview canvas has no 2D context')
    const pixel = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data)
    // (100, 180) is uncovered footage; (213, 120) is inside the upper title.
    // The other two points test matte coverage outside/inside its default ellipse.
    return {
      footage: pixel(100, 180),
      title: pixel(213, 120),
      maskOutside: pixel(10, 10),
      maskInside: pixel(160, 180),
    }
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#of-canvas')
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width !== 426) return false
    const context = canvas.getContext('2d')
    if (!context) return false
    const title = context.getImageData(213, 120, 1, 1).data
    return title[1] > 200 && title[0] < 160 && title[2] < 160
  }, null, { timeout: 15000 })
  const previewBeforeGrade = await samplePreviewPixels()

  // Built-in catalog: exactly 25 real 3D cube files.
  const catalogResponse = await page.request.get(new globalThis.URL('/luts/manifest.json', URL).toString(), { timeout: 15000 })
  assert.equal(catalogResponse.status(), 200, 'LUT manifest is served')
  const catalog = await catalogResponse.json()
  assert.equal(catalog.count, 25)
  assert.equal(catalog.luts.length, 25)
  assert.equal(new Set(catalog.luts.map((look) => look.id)).size, 25)
  for (const look of catalog.luts) {
    const response = await page.request.get(new globalThis.URL(`/${look.file}`, URL).toString(), { timeout: 15000 })
    assert.equal(response.status(), 200, `${look.file} is served`)
    const text = await response.text()
    const size = Number(text.match(/^LUT_3D_SIZE\s+(\d+)$/m)?.[1])
    assert.ok(size >= 2, `${look.file} declares a 3D size`)
    const values = text.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim()
      return trimmed && !trimmed.startsWith('#') && !/^(TITLE|LUT_|DOMAIN_)/.test(trimmed)
    })
    assert.equal(values.length, size ** 3, `${look.file} has a complete RGB cube`)
  }
  console.log('Validated all 25 complete LUT assets')

  const adjustmentEntry = page.getByTestId('left-tab-effects')
  assert.equal(await adjustmentEntry.getAttribute('aria-label'), 'LUT — LUTs & Adjustments', 'the side rail names the color workflow explicitly (visible LUT label leads the accessible name)')
  const lutRailLabel = page.getByTestId('left-tab-effects-lut-label')
  assert.equal(await lutRailLabel.innerText(), 'LUT', 'the side rail shows a persistent LUT badge')
  assert.ok(await lutRailLabel.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize) >= 9), 'the visible side-rail LUT badge is at least 9px, not an imperceptible tooltip-only label')
  await adjustmentEntry.click()
  await page.getByTestId('section-tab-adjustment-looks').waitFor({ state: 'visible' })
  assert.match(await page.getByTestId('section-tab-adjustment-looks').innerText(), /^LUT looks/, 'the first adjustment section advertises the LUT gallery')
  assert.equal(await page.locator('[data-testid^="lut-tile-"]').count(), 12, 'the default gallery stays compact while surfacing a dozen looks')
  const showAllLooks = page.getByTestId('lut-show-all')
  assert.equal(await showAllLooks.innerText(), 'Show all 25 looks', 'all catalog looks remain available on demand')
  await showAllLooks.click()
  assert.equal(await showAllLooks.getAttribute('aria-expanded'), 'true', 'the expanded catalog state is accessible')
  assert.equal(await page.locator('[data-testid^="lut-tile-"]').count(), 25, 'all 25 built-in looks appear when expanded')
  const cleanPreview = page.getByTestId('lut-preview-clean-neutral')
  const tealPreview = page.getByTestId('lut-preview-teal-amber')
  await cleanPreview.waitFor({ state: 'visible' })
  await tealPreview.waitFor({ state: 'visible' })
  assert.notEqual(await cleanPreview.getAttribute('src'), await tealPreview.getAttribute('src'), 'each LUT thumbnail renders its own color transform')
  assert.equal(await cleanPreview.evaluate((el) => getComputedStyle(el).objectFit), 'cover', 'sample imagery is cropped to fill the preview without stretching')
  mkdirSync(join(process.cwd(), 'evidence/screenshots'), { recursive: true })
  await page.screenshot({ path: join(process.cwd(), 'evidence/screenshots/omniframe-lut-gallery-live.png'), fullPage: false })
  const lookDescription = page.getByTestId('lut-look-description')
  assert.match(await lookDescription.innerText(), /^Clean Neutral — Balanced Rec\.709-style color/, 'the shared description panel preserves the first look description')
  const tealAmberTile = page.getByTestId('lut-tile-teal-amber')
  const tealDescId = await tealAmberTile.getAttribute('aria-describedby')
  assert.ok(tealDescId, 'each look wires its description for assistive technology')
  assert.match(await page.locator(`#${tealDescId}`).innerText(), /Cooler shadows and a restrained amber highlight split/, 'each look exposes its complete description to assistive technology')
  await tealAmberTile.focus()
  await page.waitForFunction(() => document.querySelector('[data-testid="lut-look-description"]')?.textContent?.includes('Teal / Amber'))
  assert.match(await lookDescription.innerText(), /Cooler shadows and a restrained amber highlight split/, 'keyboard focus updates the shared visible look description')
  console.log('LUT gallery and keyboard/focus descriptions rendered')

  // Clicking a look starts a temporary clip-scoped audition, not a new layer.
  await page.getByTestId('lut-tile-teal-amber').click()
  const audition = await page.evaluate((clipId) => {
    const state = window.__omniframe_store.getState()
    const clip = state.clips.find((item) => item.id === clipId)
    return {
      previewKind: state.visualPreview?.kind,
      previewClipId: state.visualPreview?.clipId,
      committedLuts: clip?.adjustment?.luts?.length || 0,
      clipCount: state.clips.length,
    }
  }, seeded.baseClipId)
  assert.deepEqual(audition, { previewKind: 'clip-lut', previewClipId: seeded.baseClipId, committedLuts: 0, clipCount: 2 })
  await page.getByTestId('visual-preview-actions').waitFor({ state: 'visible' })
  await page.getByTestId('apply-visual-preview').click()
  const clipGrade = await page.evaluate((clipId) => {
    const clip = window.__omniframe_store.getState().clips.find((item) => item.id === clipId)
    return { name: clip?.adjustment?.luts?.[0]?.name, builtin: clip?.adjustment?.luts?.[0]?.builtin }
  }, seeded.baseClipId)
  assert.deepEqual(clipGrade, { name: 'Teal / Amber', builtin: 'teal-amber' })
  await page.evaluate(async () => {
    const lutEngine = await import('/src/lib/lutEngine.ts')
    if (!lutEngine.resolveLutRef({ builtin: 'teal-amber' })) await lutEngine.whenLutsLoaded()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const previewAfterGrade = await samplePreviewPixels()
  assert.notDeepEqual(previewAfterGrade.footage, previewBeforeGrade.footage, 'the LUT changes rendered footage pixels')
  assert.deepEqual(previewAfterGrade.title, previewBeforeGrade.title, 'the upper title pixels remain ungraded')
  console.log('Clip-scoped LUT applied and rendered; upper title stayed unchanged')

  // Keep the test preview light in software-rendered Chromium: move the layer
  // placement point beyond the seeded clips, then return the playhead to zero
  // before adding LUTs to the inactive test layer.
  await page.evaluate(() => window.__omniframe_store.setState({ duration: 120, playhead: 60 }))

  // A quick layer first auditions as a virtual layer; Apply creates the clip.
  await page.getByTestId('section-tab-adjustment-layers').click()
  await page.getByTestId('effect-layer-blur').click()
  const layerAudition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return {
      previewKind: state.visualPreview?.kind,
      adjustmentClips: state.clips.filter((clip) => clip.kind === 'adjustment').length,
    }
  })
  assert.deepEqual(layerAudition, { previewKind: 'adjustment-layer', adjustmentClips: 0 })
  await page.getByTestId('apply-visual-preview').click()
  const layer = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const adjustment = state.clips.find((clip) => clip.kind === 'adjustment')
    const text = state.clips.find((clip) => clip.textStyle?.text === 'TOP TITLE')
    const base = state.clips.find((clip) => clip.name === 'Death Note Chibi - 5 Characters.jfif')
    const result = {
      clip: adjustment,
      trackOrder: state.tracks.map((track) => track.id),
      textTrack: text?.trackId,
      baseTrack: base?.trackId,
    }
    window.__omniframe_store.setState({ playhead: 60 })
    return result
  })
  assert.ok(layer.clip, 'effect preset created an adjustment clip')
  assert.equal(layer.clip.kind, 'adjustment')
  assert.equal(layer.clip.effects.blur, 6)
  assert.equal(layer.clip.start, 0)
  assert.equal(layer.clip.duration, 5)
  assert.ok(layer.trackOrder.indexOf(layer.textTrack) < layer.trackOrder.indexOf(layer.clip.trackId), 'title track stays above the adjustment')
  assert.ok(layer.trackOrder.indexOf(layer.clip.trackId) < layer.trackOrder.indexOf(layer.baseTrack), 'adjustment sits above the base footage')
  console.log('Adjustment layer inserted in the correct track order')

  const effectTimelineClip = page.locator(`[data-testid="timeline-clip"][data-clip-id="${layer.clip.id}"]`)
  await effectTimelineClip.waitFor({ state: 'visible' })
  assert.match(await effectTimelineClip.getAttribute('class'), /border-2 border-cyan-300/, 'selected adjustment has a distinct timeline border')
  await page.getByTestId('section-tab-adjustment-controls').click()
  await page.getByTestId('clip-effects-controls').waitFor({ state: 'visible' })

  // Upload two .cube files at once; both validate and stack on the selected layer.
  const cube = (title, invert = false) => {
    const rows = []
    for (const r of [0, 1]) for (const g of [0, 1]) for (const b of [0, 1]) {
      rows.push(invert ? `${1 - r} ${1 - g} ${1 - b}` : `${r} ${g} ${b}`)
    }
    return `TITLE "${title}"\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n${rows.join('\n')}\n`
  }
  await page.getByTestId('section-tab-adjustment-looks').click()
  await page.locator('[data-testid="upload-lut-input"]').setInputFiles([
    { name: 'Test Identity.cube', mimeType: 'text/plain', buffer: Buffer.from(cube('Test Identity')) },
    { name: 'Test Invert.cube', mimeType: 'text/plain', buffer: Buffer.from(cube('Test Invert', true)) },
  ])
  await waitForState(() => window.__omniframe_store.getState().userLuts.length === 2)
  const importedOnly = await page.evaluate((layerId) => {
    const state = window.__omniframe_store.getState()
    const layer = state.clips.find((clip) => clip.id === layerId)
    return { uploads: state.userLuts.length, stack: layer?.adjustment?.luts?.map((lut) => lut.name) || [] }
  }, layer.clip.id)
  assert.equal(importedOnly.uploads, 2)
  assert.deepEqual(importedOnly.stack, [], 'uploading imports catalog entries without silently placing them')
  // Preview and Apply each uploaded look in turn; both then stack on the layer.
  for (let index = 0; index < 2; index++) {
    await page.locator('[data-testid^="lut-tile-user-"]').nth(index).locator('button').first().click()
    await page.getByTestId('apply-visual-preview').click()
  }
  const stacks = await page.evaluate((layerId) => {
    const state = window.__omniframe_store.getState()
    const layer = state.clips.find((clip) => clip.id === layerId)
    return { uploads: state.userLuts.length, stack: layer?.adjustment?.luts?.map((lut) => lut.name) }
  }, layer.clip.id)
  assert.equal(stacks.uploads, 2)
  assert.deepEqual(stacks.stack, ['Test Identity', 'Test Invert'])
  const persistedUploads = await page.evaluate(() => JSON.parse(localStorage.getItem('omniframe.userLuts') || '[]').map((lut) => lut.name))
  assert.deepEqual(persistedUploads, ['Test Identity', 'Test Invert'], 'multiple uploaded looks persist in this browser')

  await page.getByTestId('section-tab-adjustment-layers').click()
  const layerCard = page.getByTestId(`placed-adjustment-${layer.clip.id}`)
  await layerCard.waitFor({ state: 'visible' })
  const identityLut = await page.evaluate((layerId) => window.__omniframe_store.getState().clips.find((clip) => clip.id === layerId)?.adjustment?.luts?.[0]?.id, layer.clip.id)
  const identityStrength = page.getByTestId(`lut-intensity-${identityLut}`)
  await identityStrength.evaluate((element) => {
    const input = element
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '0.35')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitForState(({ layerId, lutId }) => {
    const lut = window.__omniframe_store.getState().clips.find((clip) => clip.id === layerId)?.adjustment?.luts?.find((item) => item.id === lutId)
    return lut?.intensity === 0.35
  }, { layerId: layer.clip.id, lutId: identityLut })

  // Render the layer over footage at the preview playhead. The uploaded
  // invert LUT should change lower footage, but the title track must remain
  // pixel-identical because it sits above the adjustment track.
  await page.evaluate(async () => {
    const lutEngine = await import('/src/lib/lutEngine.ts')
    await lutEngine.whenLutsLoaded()
    window.__omniframe_store.setState({ playhead: 0 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const previewWithLayer = await samplePreviewPixels()
  assert.notDeepEqual(previewWithLayer.footage, previewAfterGrade.footage, 'the adjustment layer grades lower-track footage')
  assert.deepEqual(previewWithLayer.title, previewAfterGrade.title, 'the title above the adjustment remains ungraded')
  console.log('Uploaded LUT stack rendered on the layer; upper title remained unchanged')

  await page.getByTestId('adjustment-layer-scope-note').waitFor({ state: 'visible' })
  await page.getByTestId('section-tab-effect-mask').click()
  await page.getByTestId('add-adjustment-mask-btn').click()
  await page.getByTestId('adjustment-mask-controls').waitFor({ state: 'visible' })
  assert.equal(await page.getByTestId('adjustment-mask-shape').inputValue(), 'ellipse')
  await page.evaluate(async () => {
    const lutEngine = await import('/src/lib/lutEngine.ts')
    await lutEngine.whenLutsLoaded()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const previewWithMask = await samplePreviewPixels()
  assert.deepEqual(previewWithMask.maskOutside, previewAfterGrade.maskOutside, 'the mask protects footage outside its ellipse')
  assert.notDeepEqual(previewWithMask.maskOutside, previewWithLayer.maskOutside, 'the mask removes the full-frame effect outside its region')
  assert.notDeepEqual(previewWithMask.maskInside, previewAfterGrade.maskInside, 'the effect remains active inside the ellipse')
  assert.deepEqual(previewWithMask.title, previewAfterGrade.title, 'the upper title remains untouched by masked grading')
  console.log('Adjustment-layer ellipse matte grades only its masked region')

  // Blank track click hides the selection treatment; clicking a listed placed
  // layer restores its highlight and inspector controls.
  const layerLane = page.locator(`[data-testid="track-lane-${layer.clip.trackId}"]`)
  const laneBox = await layerLane.boundingBox()
  assert.ok(laneBox && laneBox.width > 1)
  await layerLane.click({ position: { x: Math.max(1, laneBox.width - 5), y: Math.max(1, laneBox.height / 2) } })
  await waitForState(() => window.__omniframe_store.getState().selectedClipId === null)
  assert.doesNotMatch(await effectTimelineClip.getAttribute('class'), /border-2 border-cyan-300/, 'blank track click hides the selected border')
  await page.getByTestId(`placed-adjustment-${layer.clip.id}`).getByRole('button').first().click()
  await waitForState((id) => window.__omniframe_store.getState().selectedClipId === id, layer.clip.id)
  assert.match(await effectTimelineClip.getAttribute('class'), /border-2 border-cyan-300/, 'selecting the placed layer restores its border')
  await page.getByTestId('section-tab-clip').click()
  await page.getByTestId('adjustment-layer-scope-note').waitFor({ state: 'visible' })
  await page.getByTestId('delete-adjustment-layer-btn').click()
  await waitForState((id) => !window.__omniframe_store.getState().clips.some((clip) => clip.id === id), layer.clip.id)

  assert.deepEqual(runtimeErrors, [], `No browser errors: ${runtimeErrors.join('\n')}`)
  console.log('PASS: exactly 25 bundled cubes parse and are served')
  console.log('PASS: clip-scoped LUT and ordered adjustment layer preserve the upper title')
  console.log('PASS: two uploaded LUTs stack, expose strength controls, and persist in local storage')
  console.log('PASS: ellipse masks feather/invert the adjustment region without touching upper text')
  console.log('PASS: selection border toggles, placed layers reselect, and inspector deletes the layer')
} finally {
  await browser.close()
}
