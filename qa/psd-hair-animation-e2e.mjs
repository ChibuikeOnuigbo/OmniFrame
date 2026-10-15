/**
 * End-to-end test for the NovaVision hair workflow: layered PSD import,
 * separate layer assets, rig seeding, three puppet pins, and sway in both the
 * Rigging preview and placed main-sequence clips.
 *
 * Usage: BASE=http://localhost:5173 node qa/psd-hair-animation-e2e.mjs
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writePsd } from 'ag-psd'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.BASE || 'http://localhost:5173'

try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch { /* already inflated */ }

const rgba = (width, height, color, alpha = 255) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = alpha
  }
  return { width, height, data }
}

const fixture = writePsd({
  width: 64,
  height: 48,
  children: [
    {
      name: 'Hair Group',
      children: [
        { name: 'Hair Strand 1', left: 26, top: 4, imageData: rgba(6, 36, [90, 210, 255]) },
        { name: 'Hidden Guide', hidden: true, imageData: rgba(8, 8, [80, 80, 80]) },
      ],
    },
    { name: 'Head', left: 12, top: 10, opacity: 0.5, imageData: rgba(30, 32, [255, 180, 120]) },
  ],
})
const psdBytes = Buffer.from(fixture)

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
  else if (message.text().startsWith('PSDDEBUG')) console.log(message.text())
})
page.on('pageerror', (error) => errors.push(String(error)))
const results = []
const ok = (name, condition, detail = '') => {
  results.push([name, !!condition, detail])
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.getByRole('button', { name: 'Open Studio' }).click()
  await page.waitForTimeout(900)

  const importInput = page.locator('#panel-all-import-input')
  await importInput.setInputFiles({
    name: 'hair-workflow-fixture.psd',
    mimeType: 'image/vnd.adobe.photoshop',
    buffer: psdBytes,
  })
  await page.waitForFunction(() => {
    const store = window.__omniframe_store?.getState?.()
    return store?.assets?.filter((asset) => asset.psdLayer?.documentName === 'hair-workflow-fixture').length === 2
  }, null, { timeout: 15000 })

  const imported = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const layers = store.assets.filter((asset) => asset.psdLayer?.documentName === 'hair-workflow-fixture')
    return {
      count: layers.length,
      names: layers.map((asset) => asset.psdLayer.layerName),
      groupPaths: layers.map((asset) => asset.layeredArtwork?.groupPath || []),
      offsets: layers.map((asset) => [asset.psdLayer.left, asset.psdLayer.top]),
      dimensions: layers.map((asset) => [asset.width, asset.height]),
      opacities: layers.map((asset) => asset.psdLayer.opacity),
      urls: layers.map((asset) => asset.url),
      notice: store.mediaImportNotice,
      timelineClips: store.clips.length,
    }
  })
  const assetPixels = await page.evaluate(async (urls) => Promise.all(urls.map((url) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      resolve({ size: [canvas.width, canvas.height], pixel: [...context.getImageData(0, 0, 1, 1).data] })
    }
    image.onerror = () => resolve({ error: true })
    image.src = url
  }))), imported.urls)
  ok('PSD import creates one asset per visible raster layer', imported.count === 2, JSON.stringify(imported.names))
  const layerPixels = assetPixels.map((asset) => asset.pixel)
  ok('PSD layer raster pixels preserve colors and per-layer alpha',
    layerPixels[0].join('|') === '90|210|255|255' && layerPixels[1][0] === 255 && Math.abs(layerPixels[1][1] - 180) <= 1 && layerPixels[1][2] === 120 && layerPixels[1][3] === 128,
    JSON.stringify(layerPixels))
  ok('PSD opacity metadata remains normalized and parent-safe',
    imported.opacities[0] === 1 && Math.abs(imported.opacities[1] - 0.5) < 1 / 255,
    JSON.stringify(imported.opacities))
  ok('nested group order is preserved and hidden layers are skipped', imported.names.join('|') === 'Hair Strand 1|Head', JSON.stringify(imported.names))
  ok('pass-through group names are retained as layer metadata', imported.groupPaths[0]?.join('/') === 'Hair Group' && imported.groupPaths[1]?.length === 0, JSON.stringify(imported.groupPaths))
  ok('PSD layer names and offsets are retained', imported.names.includes('Hair Strand 1') && imported.offsets.some(([x, y]) => x === 26 && y === 4), JSON.stringify(imported.offsets))
  ok('PSD import stays in the media library (does not auto-place clips)', imported.timelineClips === 0)
  ok('import confirmation explains the raster subset and rig/timeline workflow', imported.notice?.includes('not a complete Photoshop project') === true && imported.notice?.includes('Rig artwork layers') === true && imported.notice?.includes('Place aligned artwork layers on timeline') === true && imported.notice?.includes('sequence playback') === true, imported.notice || '')

  const compositeFixture = Buffer.from(writePsd({
    width: 4,
    height: 3,
    imageData: rgba(4, 3, [13, 71, 201]),
    children: [{
      name: 'Isolated Group',
      blendMode: 'normal',
      children: [{ name: 'Paint', imageData: rgba(4, 3, [220, 40, 90]) }],
    }],
  }))
  await importInput.setInputFiles({
    name: 'complex-photoshop-fixture.psd',
    mimeType: 'image/vnd.adobe.photoshop',
    buffer: compositeFixture,
  })
  await page.waitForFunction(() => {
    const store = window.__omniframe_store?.getState?.()
    return store?.assets?.some((asset) => asset.name === 'complex-photoshop-fixture · flattened composite') &&
      store?.mediaImportNotice?.includes('flattened still')
  }, null, { timeout: 15000 })
  const flattenedPsd = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const asset = store.assets.find((item) => item.name === 'complex-photoshop-fixture · flattened composite')
    return {
      url: asset?.url,
      width: asset?.width,
      height: asset?.height,
      layered: !!asset?.layeredArtwork || !!asset?.psdLayer,
      notice: store.mediaImportNotice,
    }
  })
  const flattenedPixels = await page.evaluate(async (url) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      resolve([...context.getImageData(0, 0, 1, 1).data])
    }
    image.onerror = () => resolve([])
    image.src = url
  }), flattenedPsd.url)
  ok('unsupported Photoshop group compositing falls back to the saved composite instead of partial layers',
    flattenedPsd.width === 4 && flattenedPsd.height === 3 && !flattenedPsd.layered && flattenedPsd.notice?.includes('not imported') === true,
    JSON.stringify({ width: flattenedPsd.width, height: flattenedPsd.height, layered: flattenedPsd.layered, notice: flattenedPsd.notice }))
  ok('flattened Photoshop fallback preserves the saved composite pixel', flattenedPixels.join('|') === '13|71|201|255', JSON.stringify(flattenedPixels))

  const blendLabelFixture = Buffer.from(writePsd({
    width: 4,
    height: 3,
    children: [{ name: 'Glow', blendMode: 'color dodge', imageData: rgba(4, 3, [80, 20, 10]) }],
  }))
  await importInput.setInputFiles({
    name: 'photoshop-blend-label-fixture.psd',
    mimeType: 'image/vnd.adobe.photoshop',
    buffer: blendLabelFixture,
  })
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((asset) => asset.layeredArtwork?.documentName === 'photoshop-blend-label-fixture'))
  const blendLabel = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const asset = store.assets.find((item) => item.layeredArtwork?.documentName === 'photoshop-blend-label-fixture')
    return { blendMode: asset?.layeredArtwork?.blendMode, notice: store.mediaImportNotice }
  })
  ok('Photoshop multiword blend labels stay in the supported layer subset', blendLabel.blendMode === 'color dodge' && blendLabel.notice?.includes('Imported 1 visible raster layers') === true, JSON.stringify(blendLabel))

  await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    store.setLeftTab('rigging')
    if (store.leftOpen === false) store.setLeftOpen(true)
  })
  await page.waitForSelector('#rig-canvas')
  await page.click('#rig-from-psd-go')
  await page.waitForFunction(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return rig?.parts?.length === 2
  })

  const rigged = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return {
      count: rig.parts.length,
      names: rig.parts.map((part) => part.name),
      hair: rig.parts.find((part) => part.kind === 'hair') || null,
      selectedPartId: store.selectedPartId,
    }
  })
  ok('one action creates a rig from the PSD layers', rigged.count === 2, JSON.stringify(rigged.names))
  ok('hair-name inference selects the strand as a hair part', rigged.hair?.name === 'Hair Strand 1' && rigged.selectedPartId === rigged.hair?.id)
  ok('the imported layer preserves its document-space position', Math.abs((rigged.hair?.bounds?.x || 0) - 26 / 64) < 1e-6, String(rigged.hair?.bounds?.x))

  const openSection = async (name) => {
    const tab = page.getByRole('tab').filter({ hasText: name }).first()
    if (await tab.count()) await tab.click()
    await page.waitForTimeout(120)
  }
  await openSection('Pins')
  await page.click('#rig-add-three-pins')
  await page.waitForFunction(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    const part = rig?.parts?.find((item) => item.id === store.selectedPartId)
    return part?.pins?.length === 3
  })
  ok('three distributed Puppet pins are added atomically', await page.locator('#rig-pin-list li').count() === 3)

  await openSection('Hair / cloth sway')
  await page.click('#rig-create-sway')
  await page.waitForFunction(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    const part = rig?.parts?.find((item) => item.id === store.selectedPartId)
    return part?.sway?.enabled === true
  })
  const swaySettings = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    const part = rig?.parts?.find((item) => item.id === store.selectedPartId)
    return { sway: part?.sway, pins: part?.pins?.length }
  })
  ok('Create sway enables animated pin deformation', swaySettings.sway?.enabled === true && swaySettings.pins === 3, JSON.stringify(swaySettings))
  ok('distance and speed adjustments are exposed', await page.locator('#rig-sway-distance').count() === 1 && await page.locator('#rig-sway-speed').count() === 1)
  ok('Create sway starts the live preview', await page.locator('#rig-play').getAttribute('aria-pressed') === 'true')

  const distanceBefore = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return rig?.parts?.find((item) => item.id === store.selectedPartId)?.sway?.distance || 0
  })
  await page.locator('#rig-sway-distance').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction((previous) => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return (rig?.parts?.find((item) => item.id === store.selectedPartId)?.sway?.distance || 0) > previous
  }, distanceBefore)
  const speedBefore = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return rig?.parts?.find((item) => item.id === store.selectedPartId)?.sway?.speed || 0
  })
  await page.locator('#rig-sway-speed').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction((previous) => {
    const store = window.__omniframe_store.getState()
    const rig = store.rigs.find((item) => item.id === store.activeRigId)
    return (rig?.parts?.find((item) => item.id === store.selectedPartId)?.sway?.speed || 0) > previous
  }, speedBefore)
  ok('distance and speed sliders change the saved sway settings', true)

  await openSection('Parts')
  await page.click('#rig-place-psd-timeline')
  await page.waitForFunction(() => {
    const store = window.__omniframe_store.getState()
    const assets = store.assets.filter((asset) => asset.psdLayer?.documentName === 'hair-workflow-fixture')
    const assetIds = new Set(assets.map((asset) => asset.id))
    return store.clips.filter((clip) => assetIds.has(clip.assetId)).length === assets.length && assets.length === 2
  }, null, { timeout: 10000 })
  const placed = await page.evaluate(() => {
    const store = window.__omniframe_store.getState()
    const layers = store.assets
      .filter((asset) => asset.psdLayer?.documentName === 'hair-workflow-fixture')
      .sort((a, b) => a.psdLayer.order - b.psdLayer.order)
    const ids = new Set(layers.map((asset) => asset.id))
    const clips = store.clips.filter((clip) => ids.has(clip.assetId))
    return {
      layerNames: layers.map((asset) => asset.psdLayer.layerName),
      clipNames: clips.map((clip) => clip.name),
      starts: clips.map((clip) => clip.start),
      durations: clips.map((clip) => clip.duration),
      trackNames: clips.map((clip) => store.tracks.find((track) => track.id === clip.trackId)?.name),
      trackIndexes: clips.map((clip) => store.tracks.findIndex((track) => track.id === clip.trackId)),
      playhead: store.playhead,
      document: layers[0]?.psdLayer,
    }
  })
  ok('timeline placement is explicit and creates one clip per visible PSD layer',
    placed.clipNames.join('|') === 'Hair Strand 1|Head' && placed.trackNames.join('|') === 'PSD · Hair Strand 1|PSD · Head',
    JSON.stringify({ names: placed.clipNames, tracks: placed.trackNames }))
  ok('PSD layer clips share one start, duration and document-space track order',
    new Set(placed.starts).size === 1 && placed.starts[0] === placed.playhead && placed.durations.every((duration) => duration === 5) && placed.trackIndexes.join('|') === '0|1',
    JSON.stringify({ starts: placed.starts, durations: placed.durations, trackIndexes: placed.trackIndexes }))

  await page.waitForFunction(() => {
    const canvas = document.querySelector('#of-canvas')
    const store = window.__omniframe_store.getState()
    const layer = store.assets.find((asset) => asset.psdLayer?.documentName === 'hair-workflow-fixture' && asset.psdLayer.layerName === 'Hair Strand 1')
    if (!canvas || !layer?.psdLayer || !canvas.width || !canvas.height) return false
    const meta = layer.psdLayer
    const scale = Math.min(canvas.width / meta.documentWidth, canvas.height / meta.documentHeight)
    const x = Math.floor(canvas.width / 2 - meta.documentWidth * scale / 2 + 28 * scale)
    const y = Math.floor(canvas.height / 2 - meta.documentHeight * scale / 2 + 20 * scale)
    const color = canvas.getContext('2d').getImageData(x, y, 1, 1).data
    return color[0] < 140 && color[1] > 180 && color[2] > 220 && color[3] > 240
  }, null, { timeout: 12000 })
  const alignedPixel = await page.evaluate(() => {
    const canvas = document.querySelector('#of-canvas')
    const meta = window.__omniframe_store.getState().assets.find((asset) => asset.psdLayer?.layerName === 'Hair Strand 1').psdLayer
    const scale = Math.min(canvas.width / meta.documentWidth, canvas.height / meta.documentHeight)
    const x = Math.floor(canvas.width / 2 - meta.documentWidth * scale / 2 + 28 * scale)
    const y = Math.floor(canvas.height / 2 - meta.documentHeight * scale / 2 + 20 * scale)
    return [...canvas.getContext('2d').getImageData(x, y, 1, 1).data]
  })
  ok('program monitor aligns cropped PSD layers and paints the front hair layer on top',
    alignedPixel[0] < 140 && alignedPixel[1] > 180 && alignedPixel[2] > 220,
    JSON.stringify(alignedPixel))

  await page.evaluate(() => window.__omniframe_store.getState().undo())
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.length === 0)
  ok('one undo removes the entire placed PSD layer group', await page.evaluate(() => window.__omniframe_store.getState().clips.length === 0))
  await page.evaluate(() => window.__omniframe_store.getState().redo())
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.length === 2)
  ok('redo restores the synchronized PSD composite', await page.evaluate(() => window.__omniframe_store.getState().clips.length === 2))

  const timelineCentroids = []
  for (const time of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
    timelineCentroids.push(await page.evaluate(async (sampleTime) => {
      const store = window.__omniframe_store.getState()
      store.setPlayhead(sampleTime)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const canvas = document.querySelector('#of-canvas')
      const asset = store.assets.find((item) => item.psdLayer?.documentName === 'hair-workflow-fixture' && item.psdLayer.layerName === 'Hair Strand 1')
      if (!canvas || !asset?.psdLayer) return null
      const meta = asset.psdLayer
      const scale = Math.min(canvas.width / meta.documentWidth, canvas.height / meta.documentHeight)
      const documentLeft = (canvas.width - meta.documentWidth * scale) / 2
      const documentTop = (canvas.height - meta.documentHeight * scale) / 2
      const left = Math.max(0, Math.floor(documentLeft + (meta.left - 6) * scale))
      const right = Math.min(canvas.width, Math.ceil(documentLeft + (meta.left + meta.width + 6) * scale))
      const top = Math.max(0, Math.floor(documentTop + (meta.top + meta.height * 0.52) * scale))
      const bottom = Math.min(canvas.height, Math.ceil(documentTop + (meta.top + meta.height) * scale))
      const data = canvas.getContext('2d').getImageData(left, top, right - left, bottom - top).data
      let sumX = 0
      let count = 0
      for (let y = 0; y < bottom - top; y++) for (let x = 0; x < right - left; x++) {
        const i = (y * (right - left) + x) * 4
        if (data[i] < 160 && data[i + 1] > 160 && data[i + 2] > 220) {
          sumX += left + x
          count++
        }
      }
      return { time: sampleTime, count, centerX: count ? sumX / count : null }
    }, time))
  }
  const validTimelineCentroids = timelineCentroids.filter((sample) => sample && sample.centerX !== null)
  const timelineSwayRange = validTimelineCentroids.length
    ? Math.max(...validTimelineCentroids.map((sample) => sample.centerX)) - Math.min(...validTimelineCentroids.map((sample) => sample.centerX))
    : 0
  ok('placed PSD hair sway renders through the Program Monitor timeline path', timelineSwayRange > 2, JSON.stringify({ rangePx: timelineSwayRange, samples: timelineCentroids }))

  const parentMotion = await page.evaluate(async () => {
    const state = window.__omniframe_store.getState()
    const rig = state.rigs.find((item) => item.id === state.activeRigId)
    const hair = rig?.parts.find((item) => item.kind === 'hair')
    const head = rig?.parts.find((item) => item.kind === 'head')
    if (!rig || !hair || !head) return { error: 'PSD rig parts missing' }
    const sample = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const canvas = document.querySelector('#of-canvas')
      const asset = state.assets.find((item) => item.id === hair.sourceAssetId)
      if (!canvas || !asset?.psdLayer) return null
      const meta = asset.psdLayer
      const scale = Math.min(canvas.width / meta.documentWidth, canvas.height / meta.documentHeight)
      const documentLeft = (canvas.width - meta.documentWidth * scale) / 2
      const documentTop = (canvas.height - meta.documentHeight * scale) / 2
      const left = Math.max(0, Math.floor(documentLeft + (meta.left - 6) * scale))
      const right = Math.min(canvas.width, Math.ceil(documentLeft + (meta.left + meta.width + 6) * scale))
      const top = Math.max(0, Math.floor(documentTop + (meta.top + meta.height * 0.52) * scale))
      const bottom = Math.min(canvas.height, Math.ceil(documentTop + (meta.top + meta.height) * scale))
      const rowWidth = right - left
      const data = canvas.getContext('2d').getImageData(left, top, rowWidth, bottom - top).data
      let sumX = 0
      let count = 0
      for (let y = 0; y < bottom - top; y++) for (let x = 0; x < rowWidth; x++) {
        const i = (y * rowWidth + x) * 4
        if (data[i] < 160 && data[i + 1] > 160 && data[i + 2] > 220) {
          sumX += left + x
          count++
        }
      }
      return count ? sumX / count : null
    }
    state.setPlayhead(0.4)
    const before = await sample()
    state.setRigPartTransform(rig.id, head.id, { x: 4 })
    const after = await sample()
    return { parentLinked: hair.parentId === head.id, before, after, delta: before !== null && after !== null ? after - before : null }
  })
  ok('PSD parent transform follows the hair layer in the timeline renderer',
    parentMotion.parentLinked && Math.abs(parentMotion.delta || 0) > 20,
    JSON.stringify(parentMotion))

  await page.waitForTimeout(250)
  const canvasLocator = page.locator('[data-puppet-part-name="Hair Strand 1"]')
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-puppet-part-name="Hair Strand 1"]')
    return canvas && canvas.width > 0 && canvas.height > 0
  })
  await page.locator('#rig-play').click()
  await page.locator('#rig-scrub').focus()
  await page.keyboard.press('Home')
  await wait(80)
  const before = await canvasLocator.evaluate((canvas) => canvas.toDataURL())
  const beforeStats = await canvasLocator.evaluate((canvas) => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    let alpha = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]) alpha++
    return { frame: canvas.dataset.swayFrame, pinCount: canvas.dataset.puppetPinCount, sway: canvas.dataset.swayEnabled, size: [canvas.width, canvas.height], alpha }
  })
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight')
  await wait(80)
  const after = await canvasLocator.evaluate((canvas) => canvas.toDataURL())
  const afterStats = await canvasLocator.evaluate((canvas) => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    let alpha = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]) alpha++
    return { frame: canvas.dataset.swayFrame, pinCount: canvas.dataset.puppetPinCount, sway: canvas.dataset.swayEnabled, size: [canvas.width, canvas.height], alpha }
  })
  ok('hair artwork is redrawn at different preview times', before !== after)

  ok('no browser errors', errors.length === 0, errors.slice(0, 4).join(' / '))
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
