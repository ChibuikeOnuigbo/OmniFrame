/**
 * Smoke test for the versioned .omni bundle: source-byte embedding, project
 * state round trip, object-URL rehydration, and media integrity rejection.
 *
 * Usage: BASE=http://localhost:5173 npm run qa:omni-project
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { writePsd } from 'ag-psd'
import { strFromU8, unzipSync, zipSync } from 'fflate'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.BASE || 'http://localhost:5173'

try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch { /* already inflated */ }

const rgba = (width, height, color, alpha = 255) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0]
    data[index + 1] = color[1]
    data[index + 2] = color[2]
    data[index + 3] = alpha
  }
  return { width, height, data }
}
const psdBytes = Buffer.from(writePsd({
  width: 3,
  height: 2,
  children: [{ name: 'Source Paint', imageData: rgba(3, 2, [42, 117, 203, 255]) }],
}))

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const results = []
const ok = (name, condition, detail = '') => {
  results.push([name, !!condition, detail])
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.getByRole('button', { name: 'Open Studio' }).click()
  await page.waitForTimeout(700)

  await page.locator('#panel-all-import-input').setInputFiles({
    name: 'bundle-source-fixture.psd',
    mimeType: 'image/vnd.adobe.photoshop',
    buffer: psdBytes,
  })
  await page.waitForFunction(() => {
    const state = window.__omniframe_store?.getState?.()
    return state?.sourceDocuments?.some((doc) => doc.fileName === 'bundle-source-fixture.psd') &&
      state?.assets?.some((asset) => asset.layeredArtwork?.documentName === 'bundle-source-fixture')
  })

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((entry) => entry.layeredArtwork?.documentName === 'bundle-source-fixture')
    const trackId = state.createTrack('video')
    state.addClipToTrack(trackId, asset.id, 0)
    state.updateScene3DObject('3d-wheel-1', { type: 'cube', color: '#1a2b3c', roughness: 0.67, metalness: 0.23 })
  })
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.length === 1)
  ok('Top bar exposes both Save and Open project controls', await page.locator('[data-testid="save-omni-project"]').count() === 1 && await page.locator('[data-testid="open-omni-project"]').count() === 1)
  const uiSaveDownloadPromise = page.waitForEvent('download', { timeout: 15000 })
  page.once('dialog', (dialog) => dialog.accept('Button Save Test'))
  await page.locator('[data-testid="save-omni-project"]').click()
  const uiSaveDownload = await uiSaveDownloadPromise
  const uiSavePath = path.join(tmpdir(), 'omniframe-ui-save-test.omni')
  await uiSaveDownload.saveAs(uiSavePath)
  const uiSaveEntries = unzipSync(await import('node:fs/promises').then(({ readFile }) => readFile(uiSavePath)))
  const uiSaveManifest = JSON.parse(strFromU8(uiSaveEntries['manifest.json']))
  ok('Save button downloads a named, valid .omni project', uiSaveDownload.suggestedFilename() === 'Button Save Test.omni' && uiSaveManifest.projectName === 'Button Save Test')

  const patchFixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 288
    const context = canvas.getContext('2d')
    const image = context.createImageData(canvas.width, canvas.height)
    let value = 0x12345678
    for (let i = 0; i < image.data.length; i += 4) {
      value = (value * 1664525 + 1013904223) >>> 0
      image.data[i] = value & 255
      image.data[i + 1] = (value >>> 8) & 255
      image.data[i + 2] = (value >>> 16) & 255
      image.data[i + 3] = 255
    }
    context.putImageData(image, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    window.__omniframe_store.setState({ drawingStrokes: [{
      id: 'smart-patch-bundle-fixture', layerId: 'default-paint-layer', tool: 'smart-patch', color: '#ffffff', size: 52, opacity: 1,
      points: [{ x: 0.5, y: 0.5, timestamp: 0 }], temporalScope: { type: 'span', startTime: 0, duration: 1 },
      smartPatchFrames: [{ time: 0, dataUrl }],
    }] })
    return { dataUrlLength: dataUrl.length }
  })
  const exported = await page.evaluate(async () => {
    const state = window.__omniframe_store.getState()
    const blob = await state.saveOmniProject('Roundtrip Fixture')
    return { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) }
  })
  const projectBytes = Buffer.from(exported.bytes)
  let zipEntries
  try { zipEntries = unzipSync(projectBytes) } catch { zipEntries = {} }
  let manifest = null
  try { manifest = JSON.parse(strFromU8(zipEntries['manifest.json'] || new Uint8Array())) } catch { /* assertion below */ }
  ok('Save .omni creates a versioned project archive', exported.type === 'application/x-omniframe-project' && manifest?.format === 'omniframe-project' && manifest?.schemaVersion === 1, JSON.stringify({ type: exported.type, format: manifest?.format, version: manifest?.schemaVersion }))
  const patchFrameRef = manifest?.state?.drawingStrokes?.find((stroke) => stroke.id === 'smart-patch-bundle-fixture')?.smartPatchFrames?.[0]?.dataUrl
  const patchAttachment = manifest?.attachments?.find((entry) => patchFrameRef?.__omniframeBundleRef === 'url' && entry.id === patchFrameRef.id)
  const patchBytes = patchAttachment ? Buffer.from(zipEntries[patchAttachment.path] || []) : Buffer.alloc(0)
  ok('Large temporal Smart Patch frames are embedded as project media attachments', patchFrameRef?.__omniframeBundleRef === 'url' && patchBytes.length > 100_000 && patchFrameRef.id === patchAttachment?.id, `data URL ${patchFixture.dataUrlLength} chars → ${patchBytes.length} attachment bytes`)

  const sourceDocument = manifest?.state?.sourceDocuments?.find((doc) => doc.fileName === 'bundle-source-fixture.psd')
  const sourceReference = sourceDocument?.url
  const sourceEntry = manifest?.attachments?.find((entry) => sourceReference?.__omniframeBundleRef === 'url' && entry.id === sourceReference.id)
  const embeddedSource = sourceEntry ? Buffer.from(zipEntries[sourceEntry.path] || []) : Buffer.alloc(0)
  ok('The original native PSD bytes are embedded exactly, alongside imported layer pixels',
    embeddedSource.equals(psdBytes) && manifest.state.assets.some((asset) => asset.layeredArtwork?.documentName === 'bundle-source-fixture'),
    JSON.stringify({ originalBytes: psdBytes.length, embeddedBytes: embeddedSource.length, attachmentCount: manifest?.attachments?.length }))
  ok('Timeline edits and source-file identity are inside the project bundle',
    manifest?.projectName === 'Roundtrip Fixture' && manifest.state.clips.length === 1 && manifest.state.tracks.length === 1 && sourceDocument?.format === 'psd')

  await page.evaluate(() => {
    window.__omniframe_store.setState({ assets: [], sourceDocuments: [], tracks: [], clips: [], projectName: 'Changed' })
  })
  await page.locator('[data-testid="omni-project-input"]').setInputFiles({
    name: 'roundtrip.omni',
    mimeType: 'application/x-omniframe-project',
    buffer: projectBytes,
  })
  await page.waitForFunction(() => {
    const state = window.__omniframe_store.getState()
    return state.projectName === 'Roundtrip Fixture' && state.clips.length === 1 && state.sourceDocuments.length === 1
  }, null, { timeout: 15000 })
  const restored = await page.evaluate(async (expectedBase64) => {
    const state = window.__omniframe_store.getState()
    const source = state.sourceDocuments[0]
    const layer = state.assets.find((asset) => asset.layeredArtwork?.documentName === 'bundle-source-fixture')
    const sourceBytes = new Uint8Array(await (await fetch(source.url)).arrayBuffer())
    const patchFrameUrl = state.drawingStrokes.find((stroke) => stroke.id === 'smart-patch-bundle-fixture')?.smartPatchFrames?.[0]?.dataUrl
    const patchBytes = patchFrameUrl ? new Uint8Array(await (await fetch(patchFrameUrl)).arrayBuffer()) : new Uint8Array()
    const expected = Uint8Array.from(atob(expectedBase64), (character) => character.charCodeAt(0))
    let pixel = []
    if (layer) {
      const image = new Image()
      image.src = layer.url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      pixel = [...context.getImageData(0, 0, 1, 1).data]
    }
    return {
      name: state.projectName,
      clips: state.clips.length,
      tracks: state.tracks.length,
      layerName: layer?.layeredArtwork?.layerName,
      sourceName: source.fileName,
      sceneObject: state.scene3DObjects[0] && { type: state.scene3DObjects[0].type, color: state.scene3DObjects[0].color, roughness: state.scene3DObjects[0].roughness, metalness: state.scene3DObjects[0].metalness },
      sourceByteExact: sourceBytes.length === expected.length && sourceBytes.every((byte, index) => byte === expected[index]),
      pixel,
      sourceUrlIsObject: source.url.startsWith('blob:'),
      patchUrlIsObject: patchFrameUrl?.startsWith('blob:'),
      patchBytes: patchBytes.length,
    }
  }, psdBytes.toString('base64'))
  ok('Open .omni restores editable state, valid media URLs, and exact source bytes',
    restored.name === 'Roundtrip Fixture' && restored.clips === 1 && restored.tracks === 1 && restored.layerName === 'Source Paint' && restored.sourceName === 'bundle-source-fixture.psd' && restored.sourceByteExact && restored.sourceUrlIsObject && restored.patchUrlIsObject && restored.patchBytes > 100_000 && restored.pixel.join('|') === '42|117|203|255' && restored.sceneObject?.type === 'cube' && restored.sceneObject?.color === '#1a2b3c' && restored.sceneObject?.roughness === 0.67 && restored.sceneObject?.metalness === 0.23,
    JSON.stringify(restored))

  await page.locator('[data-testid="export-options-toggle"]').click()
  const initialOptions = {
    video: await page.locator('[data-testid="subset-export-video-option"]').count(),
    primaryVideo: await page.locator('[data-testid="export-video-btn"]').count(),
    png: await page.locator('[data-testid="subset-export-png-option"]').count(),
    obj: await page.locator('[data-testid="subset-export-obj-option"]').count(),
  }
  ok('Image-only timeline offers PNG but exposes no video or OBJ export', initialOptions.video === 0 && initialOptions.primaryVideo === 0 && initialOptions.png === 1 && initialOptions.obj === 0, JSON.stringify(initialOptions))
  const pngDownloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('[data-testid="subset-export-png-option"]').click()
  const pngDownload = await pngDownloadPromise
  const pngPath = path.join(tmpdir(), 'omniframe-subset-still.png')
  await pngDownload.saveAs(pngPath)
  const pngBytes = await import('node:fs/promises').then(({ readFile }) => readFile(pngPath))
  ok('PNG subset export is a valid flattened still image', pngDownload.suggestedFilename().endsWith('.png') && pngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && pngBytes.length > 100, `${pngDownload.suggestedFilename()} · ${pngBytes.length} bytes`)

  await page.evaluate(() => {
    const store = window.__omniframe_store
    const imageClip = store.getState().clips[0]
    window.__omniframe_image_clip_for_export_test = imageClip
    store.setState({ clips: [{ ...imageClip, id: 'synthetic-audio-only-clip', kind: 'audio', name: 'Audio only' }], is3DMode: false })
  })
  await page.locator('[data-testid="export-options-toggle"]').click()
  const audioOnlyOptions = {
    video: await page.locator('[data-testid="subset-export-video-option"]').count(),
    primaryVideo: await page.locator('[data-testid="export-video-btn"]').count(),
    png: await page.locator('[data-testid="subset-export-png-option"]').count(),
    emptyMessage: await page.locator('[data-testid="no-subset-export"]').count(),
  }
  ok('Audio-only timeline exposes no blank video or still export', audioOnlyOptions.video === 0 && audioOnlyOptions.primaryVideo === 0 && audioOnlyOptions.png === 0 && audioOnlyOptions.emptyMessage === 1, JSON.stringify(audioOnlyOptions))
  await page.locator('[data-testid="export-options-toggle"]').click()
  await page.evaluate(() => window.__omniframe_store.setState({ clips: [window.__omniframe_image_clip_for_export_test] }))

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const imageClip = state.clips[0]
    window.__omniframe_store.setState({ clips: [...state.clips, { ...imageClip, id: 'synthetic-video-clip', kind: 'video', name: 'Video clip', start: imageClip.start + imageClip.duration + 1 }] })
  })
  await page.locator('[data-testid="export-options-toggle"]').click()
  const mixedOptions = {
    video: await page.locator('[data-testid="subset-export-video-option"]').count(),
    primaryVideo: await page.locator('[data-testid="export-video-btn"]').count(),
    png: await page.locator('[data-testid="subset-export-png-option"]').count(),
    warning: await page.locator('[data-testid="png-export-loss-warning"]').count(),
  }
  ok('Image-plus-video timeline offers video but withholds the PNG subset, with an explicit warning', mixedOptions.video === 1 && mixedOptions.primaryVideo === 1 && mixedOptions.png === 0 && mixedOptions.warning === 1, JSON.stringify(mixedOptions))
  await page.locator('[data-testid="export-options-toggle"]').click()
  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    window.__omniframe_store.setState({ clips: state.clips.filter((clip) => clip.id !== 'synthetic-video-clip'), is3DMode: true })
  })
  await page.locator('[data-testid="export-options-toggle"]').click()
  const threeDOptions = {
    obj: await page.locator('[data-testid="subset-export-obj-option"]').count(),
    png: await page.locator('[data-testid="subset-export-png-option"]').count(),
    warning: await page.locator('[data-testid="obj-export-loss-warning"]').count(),
  }
  ok('3D mode offers OBJ for the scene subset, withholds PNG, and warns about geometry-only loss', threeDOptions.obj === 1 && threeDOptions.png === 0 && threeDOptions.warning === 1, JSON.stringify(threeDOptions))
  const objDownloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('[data-testid="subset-export-obj-option"]').click()
  const objDownload = await objDownloadPromise
  const objPath = path.join(tmpdir(), 'omniframe-scene-subset.obj')
  await objDownload.saveAs(objPath)
  const objText = await import('node:fs/promises').then(({ readFile }) => readFile(objPath, 'utf8'))
  ok('OBJ subset export contains scene geometry', objDownload.suggestedFilename().endsWith('.obj') && /^v /m.test(objText) && /^f /m.test(objText), `${objDownload.suggestedFilename()} · ${objText.split('\n').length} lines`)
  await page.evaluate(() => window.__omniframe_store.setState({ is3DMode: false }))

  const tamperedEntries = { ...zipEntries }
  const mediaEntry = manifest?.attachments?.[0]
  if (mediaEntry) {
    const corruptBytes = new Uint8Array(tamperedEntries[mediaEntry.path])
    corruptBytes[0] ^= 0xff
    tamperedEntries[mediaEntry.path] = corruptBytes
    const corruptBundle = Buffer.from(zipSync(tamperedEntries, { level: 0 }))
    await page.locator('[data-testid="omni-project-input"]').setInputFiles({
      name: 'tampered.omni',
      mimeType: 'application/x-omniframe-project',
      buffer: corruptBundle,
    })
    await page.waitForFunction(() => document.querySelector('[data-testid="omni-project-status"]')?.textContent?.includes('SHA-256 check'))
    ok('Tampered project media is rejected before replacing the open project', await page.evaluate(() => {
      const state = window.__omniframe_store.getState()
      return state.projectName === 'Roundtrip Fixture' && state.clips.length === 1 && state.assets.some((asset) => asset.layeredArtwork?.documentName === 'bundle-source-fixture')
    }))
  } else {
    ok('Tampered project integrity is testable', false, 'No bundle attachments were produced')
  }

  ok('no browser errors', errors.length === 0, errors.slice(0, 4).join(' / '))
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
