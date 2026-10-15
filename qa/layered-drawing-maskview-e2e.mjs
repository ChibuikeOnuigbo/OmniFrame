/**
 * View-as-layers drawing, Convert drawing to clips, Video Mask View,
 * docker customization, drawing flyout, right sub-tool dock, and compound
 * cut voids — end-to-end (qa/layered-drawing-maskview-e2e.mjs).
 *
 * Pixel checks run on the program canvas (#of-canvas) with solid-colour
 * clips: top = red, bottom = blue, drawing = green.
 */
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const sampleAt = (fx, fy) =>
  page.evaluate(([x, y]) => {
    const canvas = document.querySelector('#of-canvas')
    const context = canvas.getContext('2d')
    return Array.from(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data)
  }, [fx, fy])
const isColor = (px, [r, g, b], tol = 40) => Math.abs(px[0] - r) <= tol && Math.abs(px[1] - g) <= tol && Math.abs(px[2] - b) <= tol
const RED = [220, 40, 40]
const BLUE = [40, 80, 220]
const GREEN = [40, 200, 90]
const pass = (label) => console.log(`[PASS] ${label}`)

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.waitForFunction(() => Boolean(window.__omniframe_store))

  // ---- Seed: blue bottom clip, red top clip -------------------------------
  const seed = await page.evaluate(() => {
    const store = window.__omniframe_store
    const s = store.getState()
    const mk = (id, color) => {
      const c = document.createElement('canvas')
      c.width = 64; c.height = 64
      c.getContext('2d').fillStyle = color
      c.getContext('2d').fillRect(0, 0, 64, 64)
      s.addAsset({ id, name: id, kind: 'image', url: c.toDataURL('image/png'), duration: 10, width: 64, height: 64, size: 100 })
    }
    mk('asset-solid-red', '#dc2828')
    mk('asset-solid-blue', '#2850dc')
    store.setState({ clips: [], tracks: [], drawingStrokes: [], omniframeCharacters: [] })
    const bottom = s.createTrack('video')
    const top = s.createTrack('video')
    s.addClipToTrack(bottom, 'asset-solid-blue', 0)
    s.addClipToTrack(top, 'asset-solid-red', 0)
    const clips = store.getState().clips
    const blue = clips.find((c) => c.assetId === 'asset-solid-blue')
    const red = clips.find((c) => c.assetId === 'asset-solid-red')
    store.getState().setPlayhead(1)
    return { blueId: blue.id, redId: red.id, topTrack: top, bottomTrack: bottom }
  })
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), RED), 'top clip covers frame')
  pass('seeded red-over-blue stack')

  const drawLine = async (yFrac = 0.5) => {
    const box = await page.locator('[data-testid="drawing-canvas"]').boundingBox()
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * yFrac)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * yFrac, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(150)
  }

  // ---- View as layers: drawing under a blocking clip ----------------------
  await page.evaluate((blueId) => {
    const s = window.__omniframe_store.getState()
    s.selectClip(blueId)
    s.setLeftTab('drawing')
    s.setDrawingEnabled(true)
    s.setDrawingScope({ type: 'global' })
    s.setDrawingColor('#28c85a')
    s.setDrawingSize(26)
  }, seed.blueId)
  await page.getByTestId('view-as-layers-toggle').click()
  await drawLine()
  const layeredStroke = await page.evaluate(() => {
    const st = window.__omniframe_store.getState().drawingStrokes.at(-1)
    return { layered: st?.layered, anchors: st?.anchorClipIds }
  })
  assert.equal(layeredStroke.layered, true, 'stroke stamped layered')
  assert.deepEqual(layeredStroke.anchors, [seed.blueId], 'stroke passes through exactly the selected clip')
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), RED), 'top clip covers drawing made on the clip below')
  pass('view-as-layers: drawing on lower clip is covered by the clip above')

  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.setViewVideosAsLayers(false)
    s.setPlayhead(1.01)
  })
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), GREEN), 'mode off: drawing floats on top')
  pass('view-as-layers off: drawing returns on top of all video')

  // Both selected: the line passes through both.
  await page.evaluate((ids) => {
    const s = window.__omniframe_store.getState()
    s.setViewVideosAsLayers(true)
    window.__omniframe_store.setState({ selectedClipIds: ids, selectedClipId: ids[0], drawingStrokes: [] })
  }, [seed.blueId, seed.redId])
  await drawLine()
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(1.02))
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), GREEN), 'line visible through all selected clips')
  pass('multi-select: one line passes through every selected clip')

  // Masked view bounds: drawing outside the 20% view window lands nowhere.
  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.addClipMask(redId)
    s.updateClipMask(redId, { kind: 'shape', centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.2, enabled: true })
    s.setMaskEditClip(null) // exit mask-edit mode so the monitor accepts drawing
    window.__omniframe_store.setState({ selectedClipIds: [redId], selectedClipId: redId, drawingStrokes: [] })
  }, seed.redId)
  await drawLine(0.1) // across the top, outside the centred 20% window
  const outsideStrokes = await page.evaluate(() => window.__omniframe_store.getState().drawingStrokes.length)
  assert.equal(outsideStrokes, 0, 'no stroke lands outside the masked view')
  await drawLine(0.5)
  const insideStroke = await page.evaluate(() => window.__omniframe_store.getState().drawingStrokes.at(-1))
  assert.ok(insideStroke && insideStroke.points.every((p) => p.x >= 0.4 && p.x <= 0.6), 'stroke kept inside the view window')
  pass('masked view bounds: 100x100 masked to a window draws only inside it')
  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.removeClipMask(redId)
    s.setViewVideosAsLayers(false)
    window.__omniframe_store.setState({ drawingStrokes: [] })
  }, seed.redId)

  // ---- Convert drawing to clips -------------------------------------------
  const beforePx = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const layerId = s.paintLayers[0]?.id || 'default-paint-layer'
    const mkStroke = (id, scope) => ({
      id, layerId, tool: 'brush', color: '#28c85a', size: 26, opacity: 1,
      points: [{ x: 0.2, y: 0.5, timestamp: 0 }, { x: 0.8, y: 0.5, timestamp: 16 }],
      temporalScope: scope,
    })
    s.addDrawingStroke(mkStroke('conv-a', { type: 'frame', frame: 1, holdFrames: 15 }))
    s.addDrawingStroke(mkStroke('conv-b', { type: 'frame', frame: 123, holdFrames: 4 }))
    s.addDrawingStroke(mkStroke('conv-c', { type: 'span', startTime: 2, duration: 1 }))
    s.setPlayhead(0.2)
    return true
  })
  assert.ok(beforePx)
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), GREEN), 'drawing visible before conversion')
  const pxBefore = await sampleAt(0.5, 0.5)
  await page.getByTestId('convert-drawing-to-clips-btn').click()
  const converted = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clips: s.clips.filter((c) => c.kind === 'drawing').map((c) => ({ start: c.start, duration: c.duration, strokes: c.drawingStrokeIds })),
      marked: s.drawingStrokes.filter((x) => x.convertedClipId).length,
    }
  })
  assert.equal(converted.clips.length, 3, 'frames 1-15, frames 123-126, and the 2s span stay three clips')
  const byStart = [...converted.clips].sort((a, b) => a.start - b.start)
  assert.ok(Math.abs(byStart[0].start - 1 / 30) < 1e-6 && Math.abs(byStart[0].duration - 15 / 30) < 1e-6, 'first clip covers exactly frames 1-15')
  assert.ok(Math.abs(byStart[1].start - 2) < 1e-6 && Math.abs(byStart[1].duration - 1) < 1e-6, 'span clip covers exactly 2s-3s')
  assert.ok(Math.abs(byStart[2].start - 123 / 30) < 1e-6 && Math.abs(byStart[2].duration - 4 / 30) < 1e-6, 'second clip covers exactly frames 123-126')
  assert.equal(converted.marked, 3, 'all strokes marked converted')
  await frames()
  const pxAfter = await sampleAt(0.5, 0.5)
  assert.ok(isColor(pxAfter, GREEN) && Math.abs(pxAfter[1] - pxBefore[1]) <= 2, 'appearance identical after conversion')
  pass('convert drawing to clips: exact frame spans, identical pixels')

  await page.evaluate(() => window.__omniframe_store.getState().undo())
  const undone = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { drawingClips: s.clips.filter((c) => c.kind === 'drawing').length, marked: s.drawingStrokes.filter((x) => x.convertedClipId).length }
  })
  assert.deepEqual(undone, { drawingClips: 0, marked: 0 }, 'conversion is one undo step')
  pass('conversion undo restores strokes')

  // ---- Video Mask View ------------------------------------------------------
  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.selectClip(redId)
    s.setLeftTab('media')
    s.addClipMask(redId)
    window.__omniframe_store.setState({ drawingStrokes: [] })
  }, seed.redId)
  await page.locator('[data-testid="section-tab-video-mask-view"]').first().click()
  await page.getByTestId('mask-view-kind-split').click()
  await page.getByTestId('mask-view-split-pos').waitFor({ state: 'visible' }).catch(() => {})
  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.updateClipMask(redId, { kind: 'split', splitPos: 0.5, splitAngle: 0, feather: 0, opacity: 1, inverted: false, enabled: true })
  }, seed.redId)
  await frames()
  const leftPx = await sampleAt(0.25, 0.5)
  const rightPx = await sampleAt(0.75, 0.5)
  assert.ok(
    (isColor(leftPx, RED) && isColor(rightPx, BLUE)) || (isColor(leftPx, BLUE) && isColor(rightPx, RED)),
    'split view: one side red, other side blue',
  )
  await page.getByTestId('mask-view-flip-side').click()
  await frames()
  const leftPx2 = await sampleAt(0.25, 0.5)
  assert.ok(isColor(leftPx2, isColor(leftPx, RED) ? BLUE : RED), 'flip side swaps the visible side')
  pass('video mask view: split line + flip side')

  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.updateClipMask(redId, { kind: 'custom', curved: false, inverted: false, points: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }] })
  }, seed.redId)
  await frames()
  assert.ok(isColor(await sampleAt(0.5, 0.5), RED), 'custom shape keeps its inside')
  assert.ok(isColor(await sampleAt(0.1, 0.1), BLUE), 'custom shape hides outside')
  pass('video mask view: custom shape')

  // Keyframes move the view window with easing.
  await page.evaluate((redId) => {
    const s = window.__omniframe_store.getState()
    s.updateClipMask(redId, {
      kind: 'shape', shape: 'rectangle', inverted: false, centerX: 0.5, centerY: 0.5, width: 0.2, height: 1, feather: 0,
      keyframes: [
        { time: 0, centerX: 0.5, centerY: 0.5, width: 0.2, height: 1, rotation: 0, easing: 'linear' },
        { time: 2, centerX: 0.5, centerY: 0.5, width: 0.8, height: 1, rotation: 0, easing: 'linear' },
      ],
    })
    s.setPlayhead(1) // clip starts at 0, local t=1 -> width ~0.5
  }, seed.redId)
  await frames()
  assert.ok(isColor(await sampleAt(0.2, 0.5), BLUE), 'mid-keyframe: x=0.2 still outside the growing view')
  assert.ok(isColor(await sampleAt(0.5, 0.5), RED), 'mid-keyframe: centre visible')
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2.5))
  await frames()
  assert.ok(isColor(await sampleAt(0.2, 0.5), RED), 'after last keyframe the wide view holds')
  pass('video mask view: keyframed window with easing')

  // ---- Dockers, flyout, right sub-tool dock --------------------------------
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.setActiveCategory('all')
    s.setLeftTab('media')
  })
  await page.getByTestId('settings-button').click()
  await page.locator('[data-testid="settings-category"]', { hasText: 'dockers' }).first().click()
  await page.getByTestId('settings-dockers').waitFor({ state: 'visible' })
  assert.ok((await page.getByTestId('dockers-active-mode').innerText()).length > 0, 'active mode shown')
  await page.getByTestId('docker-toggle-left-audio').uncheck()
  await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-testid="left-tab-audio"]').count(), 0, 'audio hidden from rail')
  await page.getByTestId('docker-toggle-left-audio').check()
  await page.getByTestId('docker-toggle-right-masking').uncheck()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  assert.equal(await page.locator('[data-testid="right-subtool-masking"]').count(), 0, 'masking removed from right dock')
  pass('settings > dockers customizes both rails without obstructing')

  await page.evaluate(() => window.__omniframe_store.getState().setDockerPref('rightSubtools', 'masking', true))
  await page.getByTestId('right-subtool-masking').click()
  await page.getByTestId('right-subtool-masking-body').waitFor({ state: 'visible' })
  pass('right panel hosts the masking sub-tool')

  await page.getByTestId('left-tab-drawing-chevron').click()
  await page.getByTestId('drawing-flyout').waitFor({ state: 'visible' })
  await page.getByTestId('drawing-flyout-smart-patch').click()
  await page.getByTestId('smart-patch-subtool').waitFor({ state: 'visible' })
  const toolNow = await page.evaluate(() => window.__omniframe_store.getState().drawingTool)
  assert.equal(toolNow, 'smart-patch', 'flyout picks the tool and opens its docker')
  pass('drawing rail flyout collects the drawing sub-tools')

  // ---- In/Out range export (linked CapCut tutorial) -------------------------
  await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    s.setPlayhead(2)
    s.setExportIn()
    s.setPlayhead(4)
    s.setExportOut()
  })
  const range = await page.evaluate(() => window.__omniframe_store.getState().exportRange)
  assert.deepEqual(range, { in: 2, out: 4 }, 'I/O keys mark the export range at the playhead')
  await page.getByTestId('export-range-shade-l').waitFor({ state: 'visible' })
  await page.getByTestId('export-range-shade-r').waitFor({ state: 'visible' })
  await page.getByTestId('export-range-clear').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().exportRange), null, 'Cancel chip clears the range')
  pass('in/out range export: marked, shaded, cleared')

  // ---- Compound cut voids ----------------------------------------------------
  const compound = await page.evaluate(() => {
    const store = window.__omniframe_store
    const s = store.getState()
    store.setState({ clips: [], tracks: [], selectedClipIds: [], selectedClipId: null })
    const t = s.createTrack('video')
    s.addClipToTrack(t, 'asset-solid-blue', 0)
    s.addClipToTrack(t, 'asset-solid-red', 0)
    const placed = store.getState().clips
    store.setState({ clips: placed.map((c, i) => ({ ...c, start: i === 0 ? 2 : 5, duration: 1 })) })
    const [c1, c2] = store.getState().clips
    const inner = { c1s: c1.start, c2s: c2.start }
    const compoundId = s.createCompoundClip([c1.id, c2.id])
    const clip = store.getState().clips.find((c) => c.id === compoundId)
    const childSeq = store.getState().sequences.find((seq) => seq.id === clip.sourceSequenceId)
    return { compoundId, seqId: clip.sourceSequenceId, childStarts: childSeq.clips.map((c) => c.start).sort((a, b) => a - b), total: childSeq.duration, inner, start: clip.start, duration: clip.duration }
  })
  assert.deepEqual(compound.childStarts, [0, 3], 'inside timeline rebases to 0 keeping exact distances')
  assert.equal(compound.start, 2, 'compound sits at the earliest selected clip')
  await page.evaluate(({ compoundId, seqId }) => {
    const store = window.__omniframe_store
    store.setState({ clips: store.getState().clips.map((c) => (c.id === compoundId ? { ...c, inPoint: 0.5, duration: c.duration - 1 } : c)) })
    store.getState().openSequence(seqId)
  }, compound)
  await page.getByTestId('compound-cut-void-head').waitFor({ state: 'visible' })
  await page.getByTestId('compound-cut-void-tail').waitFor({ state: 'visible' })
  pass('compound: trimmed head/tail show as cut voids inside')
  await page.evaluate(() => window.__omniframe_store.getState().navigateBreadcrumb('main'))
  await page.waitForTimeout(300)
  assert.equal(await page.locator('[data-testid="compound-cut-void-head"]').count(), 0, 'voids gone back on main timeline')
  pass('compound: back button returns to the original timeline')

  await page.evaluate(() => window.__omniframe_store.getState().setLeftTab('drawing'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'evidence/screenshots/omniframe-layered-drawing-maskview.png' })
  assert.equal(errors.length, 0, `page errors: ${errors.slice(0, 2).join(' | ')}`)
  console.log('layered-drawing-maskview-e2e: passed')
} catch (err) {
  console.error('[FAIL]', err)
  process.exitCode = 1
} finally {
  await browser.close()
}
