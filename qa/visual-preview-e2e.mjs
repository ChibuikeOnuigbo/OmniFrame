/**
 * Temporary visual audition regression test.
 *
 * Clicking an effect/LUT/transition should play a bounded timeline window
 * without creating or modifying timeline items. Apply commits; Stop restores.
 *
 * Run with a Vite server at localhost:5173:
 *   URL=http://localhost:5173/#studio node qa/visual-preview-e2e.mjs
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

const frames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
let samplePoint = null
const sampleCenter = () => page.evaluate((point) => {
  const canvas = document.querySelector('#of-canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Preview canvas is missing')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Preview canvas has no 2D context')
  const x = point?.x ?? Math.floor(canvas.width / 2)
  const y = point?.y ?? Math.floor(canvas.height / 2)
  return Array.from(context.getImageData(x, y, 1, 1).data)
}, samplePoint)
const sampleGrid = () => page.evaluate(() => {
  const canvas = document.querySelector('#of-canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Preview canvas is missing')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Preview canvas has no 2D context')
  const points = []
  for (let y = 24; y < canvas.height; y += 24) {
    for (let x = 24; x < canvas.width; x += 24) {
      points.push({ x, y, pixel: Array.from(context.getImageData(x, y, 1, 1).data) })
    }
  }
  return points
})
const channelDistance = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.evaluate(() => window.__omniframe_store.getState().setPreviewQuality('low'))
  await page.waitForFunction(() => document.querySelector('#of-canvas')?.width === 426)

  const seeded = await page.evaluate(() => {
    const store = window.__omniframe_store
    const state = store.getState()
    const firstImage = state.assets.find((asset) => asset.id === 'asset-death-note-img')
    const secondImage = state.assets.find((asset) => asset.id === 'asset-room-chair-towel')
    if (!firstImage || !secondImage) throw new Error('Bundled transition fixtures are missing')

    const longTrackId = state.createTrack('video')
    state.addClipToTrack(longTrackId, firstImage.id, 0)
    state.addClipToTrack(longTrackId, secondImage.id, 5)
    let clips = store.getState().clips.filter((clip) => clip.trackId === longTrackId).sort((a, b) => a.start - b.start)
    if (clips.length !== 2) throw new Error('Could not seed the long adjacent pair')
    const [longFrom, longTo] = clips

    const shortTrackId = state.createTrack('video')
    state.addClipToTrack(shortTrackId, firstImage.id, 12)
    clips = store.getState().clips.filter((clip) => clip.trackId === shortTrackId)
    const shortFrom = clips[0]
    store.getState().setClipProp(shortFrom.id, { duration: 0.4 })
    store.getState().addClipToTrack(shortTrackId, secondImage.id, 12.4)
    const shortTo = store.getState().clips.find((clip) => clip.trackId === shortTrackId && clip.id !== shortFrom.id)
    if (!shortTo) throw new Error('Could not seed the short adjacent pair')
    store.getState().setClipProp(shortTo.id, { duration: 0.4 })

    // The short cut is nearest and selected, but neither side has the 0.5s
    // handle required by a 1s centred transition. The finder must skip it.
    store.getState().selectClip(shortTo.id)
    store.getState().setPlayhead(12.4)
    return { longFromId: longFrom.id, longToId: longTo.id, shortToId: shortTo.id, clipCount: store.getState().clips.length }
  })

  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(4.5))
  await frames()
  const fromGrid = await sampleGrid()
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(5.5))
  await frames()
  const toGrid = await sampleGrid()
  const contrastPoint = fromGrid
    .map((point, index) => ({ ...point, toPixel: toGrid[index].pixel, distance: channelDistance(point.pixel, toGrid[index].pixel) }))
    .sort((a, b) => b.distance - a.distance)[0]
  samplePoint = { x: contrastPoint.x, y: contrastPoint.y }
  const fromPixel = contrastPoint.pixel
  const toPixel = contrastPoint.toPixel
  assert.ok(channelDistance(fromPixel, toPixel) > 20, 'transition fixtures render visibly different frames')
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(12.4))

  await page.getByTestId('left-tab-transitions').click()
  await page.getByTestId('transition-pillar-dissolve').click()
  await page.getByTestId('transition-card-cross_dissolve').waitFor({ state: 'visible' })
  await page.getByTestId('apply-trans-btn-cross_dissolve').click()

  const transitionAudition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return {
      preview: state.visualPreview,
      transitionCount: state.transitions.length,
      clipCount: state.clips.length,
      playing: state.playing,
    }
  })
  assert.equal(transitionAudition.preview?.kind, 'transition')
  assert.equal(transitionAudition.preview.transition.fromClipId, seeded.longFromId, 'nearest usable cut skips the too-short selected pair')
  assert.equal(transitionAudition.preview.transition.toClipId, seeded.longToId)
  assert.equal(transitionAudition.preview.startTime, 4.5)
  assert.equal(transitionAudition.transitionCount, 0, 'transition audition creates no timeline transition')
  assert.equal(transitionAudition.clipCount, seeded.clipCount, 'transition audition creates no timeline clip')
  assert.equal(transitionAudition.playing, true, 'transition audition starts playing immediately')

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.pause()
    state.setPlayhead(4.75)
  })
  await frames()
  const blendedPixel = await sampleCenter()
  assert.ok(channelDistance(blendedPixel, fromPixel) > 5, 'transition audition changes the outgoing frame')
  assert.ok(channelDistance(blendedPixel, toPixel) > 5, 'transition audition has not jumped to the incoming frame')
  assert.ok(channelDistance(blendedPixel, fromPixel) < channelDistance(blendedPixel, toPixel), 'quarter-progress cross dissolve remains closer to outgoing media')

  mkdirSync(join(process.cwd(), 'evidence/screenshots'), { recursive: true })
  await page.screenshot({ path: join(process.cwd(), 'evidence/screenshots/omniframe-visual-preview-audition.png'), fullPage: false })

  await page.getByTestId('stop-visual-preview').click()
  const stoppedTransition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { preview: state.visualPreview, transitionCount: state.transitions.length, playhead: state.playhead, playing: state.playing }
  })
  assert.deepEqual(stoppedTransition, { preview: null, transitionCount: 0, playhead: 12.4, playing: false }, 'Stop discards the transition and restores the prior playhead')

  await page.getByTestId('apply-trans-btn-cross_dissolve').click()
  await page.getByTestId('apply-visual-preview').click()
  const committedTransition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { preview: state.visualPreview, transitions: state.transitions, playhead: state.playhead }
  })
  assert.equal(committedTransition.preview, null)
  assert.equal(committedTransition.transitions.length, 1, 'Apply commits exactly one transition')
  assert.equal(committedTransition.transitions[0].fromClipId, seeded.longFromId)
  assert.equal(committedTransition.transitions[0].toClipId, seeded.longToId)
  assert.equal(committedTransition.playhead, 12.4, 'Apply also returns to the pre-audition playhead')
  const placedTransitionId = committedTransition.transitions[0].id

  // A placed transition can be replayed from its own start without duplicating it.
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(9))
  await page.getByTestId(`preview-existing-transition-${placedTransitionId}`).click()
  const placedReplay = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { preview: state.visualPreview, transitionCount: state.transitions.length, playhead: state.playhead }
  })
  assert.equal(placedReplay.preview?.kind, 'range-playback')
  assert.ok(placedReplay.playhead >= 4.5 && placedReplay.playhead < 4.65, 'placed transition replay starts at its transition window')
  assert.equal(placedReplay.transitionCount, 1)
  assert.equal(await page.getByTestId('apply-visual-preview').count(), 0, 'replaying a placed transition offers no duplicate Apply action')
  await page.getByTestId('stop-visual-preview').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().playhead), 9)

  // Clip effect presets render temporarily and revert on Stop.
  await page.evaluate((clipId) => {
    const state = window.__omniframe_store.getState()
    state.selectClip(clipId)
    state.setPlayhead(2)
  }, seeded.longFromId)
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.1))
  await frames()
  const cleanPixel = await sampleCenter()
  await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(2))
  await page.getByTestId('left-tab-effects').click()
  await page.getByTestId('section-tab-adjustment-controls').click()
  await page.getByTestId('effect-preset-invert').click()
  const effectAudition = await page.evaluate((clipId) => {
    const state = window.__omniframe_store.getState()
    const clip = state.clips.find((item) => item.id === clipId)
    return { preview: state.visualPreview, committedInvert: clip?.effects?.invert || 0 }
  }, seeded.longFromId)
  assert.equal(effectAudition.preview?.kind, 'clip-effect')
  assert.equal(effectAudition.committedInvert, 0, 'effect preset is not committed during audition')
  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.pause()
    state.setPlayhead(0.1)
  })
  await frames()
  const invertedPixel = await sampleCenter()
  assert.ok(Math.abs(invertedPixel[0] - (255 - cleanPixel[0])) <= 4, 'Invert audition renders inverted red channel')
  assert.ok(Math.abs(invertedPixel[1] - (255 - cleanPixel[1])) <= 4, 'Invert audition renders inverted green channel')
  assert.ok(Math.abs(invertedPixel[2] - (255 - cleanPixel[2])) <= 4, 'Invert audition renders inverted blue channel')
  await page.getByTestId('stop-visual-preview').click()
  await frames()
  assert.deepEqual(await sampleCenter(), cleanPixel, 'Stopping the effect audition restores the clean frame')
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().playhead), 2, 'Stopping the effect audition restores the playhead')

  // Quick layers are virtual during audition and become clips only on Apply.
  await page.getByTestId('section-tab-adjustment-layers').click()
  await page.getByTestId('effect-layer-blur').click()
  const layerAudition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return { preview: state.visualPreview, adjustmentCount: state.clips.filter((clip) => clip.kind === 'adjustment').length }
  })
  assert.equal(layerAudition.preview?.kind, 'adjustment-layer')
  assert.equal(layerAudition.adjustmentCount, 0, 'quick-layer audition creates no timeline clip')
  await page.getByTestId('apply-visual-preview').click()
  const layerCommitted = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return state.clips.filter((clip) => clip.kind === 'adjustment').map((clip) => ({ start: clip.start, duration: clip.duration, blur: clip.effects?.blur }))
  })
  assert.deepEqual(layerCommitted, [{ start: 0, duration: 5, blur: 6 }], 'Apply creates the quick layer over the auditioned clip')

  // Title presets are virtual overlay clips during audition.
  const clipsBeforeTitle = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
  await page.getByTestId('left-tab-text').click()
  await page.getByTestId('text-submode-presets-btn').click()
  await page.getByTestId('text-preset-cinematic-title').click()
  const titleAudition = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return {
      preview: state.visualPreview,
      clipCount: state.clips.length,
      textClipCount: state.clips.filter((clip) => Boolean(clip.textStyle)).length,
      playing: state.playing,
    }
  })
  assert.equal(titleAudition.preview?.kind, 'text-clip')
  assert.equal(titleAudition.preview.clip.textStyle.text, 'EPISODE ONE')
  assert.equal(titleAudition.clipCount, clipsBeforeTitle, 'title audition creates no timeline clip')
  assert.equal(titleAudition.textClipCount, 0)
  assert.equal(titleAudition.playing, true, 'title audition starts playing immediately')
  await page.screenshot({ path: join(process.cwd(), 'evidence/screenshots/omniframe-text-preview-audition.png'), fullPage: false })
  await page.getByTestId('stop-visual-preview').click()
  assert.equal(await page.evaluate(() => window.__omniframe_store.getState().clips.filter((clip) => Boolean(clip.textStyle)).length), 0, 'Stop discards the title audition')
  await page.getByTestId('text-preset-cinematic-title').click()
  await page.getByTestId('apply-visual-preview').click()
  const titleCommitted = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const clip = state.clips.find((item) => Boolean(item.textStyle))
    return clip ? { text: clip.textStyle.text, fontSize: clip.textStyle.fontSize, duration: clip.duration, selected: state.selectedClipId === clip.id } : null
  })
  assert.deepEqual(titleCommitted, { text: 'EPISODE ONE', fontSize: 56, duration: 4, selected: true }, 'Apply creates and selects the auditioned title clip')

  assert.deepEqual(runtimeErrors, [], `No browser errors: ${runtimeErrors.join('\n')}`)
  console.log('PASS: transition finder skips cuts without enough handle and plays the nearest usable cut')
  console.log('PASS: transition/effect auditions render temporarily, Stop restores, and Apply commits once')
  console.log('PASS: placed transitions replay without duplication and quick layers stay virtual until Apply')
  console.log('PASS: title presets audition as virtual overlay clips and become real clips only on Apply')
} finally {
  await browser.close()
}
