/**
 * Interoperability smoke test for OpenRaster (.ora) layered import and the
 * conservative flattened-composite path for Krita .kra documents.
 *
 * Usage: BASE=http://localhost:5173 npm run qa:artwork-import
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { deflateSync } from 'node:zlib'
import { strToU8, zipSync } from 'fflate'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.BASE || 'http://localhost:5173'
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let value = n
  for (let k = 0; k < 8; k++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
  crcTable[n] = value >>> 0
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const value of bytes) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([length, typeBytes, data, crc])
}

function rgbaPng(width, height, color, pixelOverrides = {}) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const rows = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4)
    rows[row] = 0 // PNG filter None
    for (let x = 0; x < width; x++) {
      const pixel = row + 1 + x * 4
      const pixelColor = pixelOverrides[`${x},${y}`] || color
      rows[pixel] = pixelColor[0]
      rows[pixel + 1] = pixelColor[1]
      rows[pixel + 2] = pixelColor[2]
      rows[pixel + 3] = pixelColor[3]
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const headPng = rgbaPng(2, 2, [255, 150, 30, 255], { '1,0': [255, 150, 30, 128] })
const hairPng = rgbaPng(2, 2, [30, 190, 250, 255])
const backgroundPng = rgbaPng(4, 3, [24, 30, 40, 255])
const compositePng = rgbaPng(4, 3, [90, 30, 170, 255])
const blendBackdropPng = rgbaPng(4, 3, [200, 100, 50, 255])
const blendShadePng = rgbaPng(4, 3, [128, 200, 64, 255])

const oraStack = `<?xml version="1.0" encoding="UTF-8"?>
<image version="0.0.6" w="4" h="3">
  <stack>
    <layer name="Head" src="data/head.png" x="1" y="0" opacity="0.5" visibility="visible" composite-op="svg:src-over"/>
    <stack name="Character" opacity="1" visibility="visible" composite-op="svg:src-over">
      <layer name="Hair Strand 1" src="data/hair.png" x="0" y="1" opacity="1" visibility="visible" composite-op="svg:src-over"/>
      <layer name="Hidden guide" src="data/hidden.png" x="0" y="0" opacity="1" visibility="hidden" composite-op="svg:src-over"/>
    </stack>
    <layer name="Backdrop" src="data/background.png" x="0" y="0" opacity="1" visibility="visible" composite-op="svg:src-over"/>
  </stack>
</image>`
const oraFixture = Buffer.from(zipSync({
  mimetype: [strToU8('image/openraster'), { level: 0 }],
  'stack.xml': strToU8(oraStack),
  'data/head.png': headPng,
  'data/hair.png': hairPng,
  'data/hidden.png': rgbaPng(1, 1, [255, 0, 255, 255]),
  'data/background.png': backgroundPng,
  'mergedimage.png': compositePng,
}))

const blendOraFixture = Buffer.from(zipSync({
  mimetype: [strToU8('image/openraster'), { level: 0 }],
  'stack.xml': strToU8(`<?xml version="1.0"?><image version="0.0.6" w="4" h="3"><stack><layer name="Shade" src="data/shade.png" composite-op="svg:multiply"/><layer name="Backdrop" src="data/backdrop.png" composite-op="svg:src-over"/></stack></image>`),
  'data/shade.png': blendShadePng,
  'data/backdrop.png': blendBackdropPng,
  'mergedimage.png': rgbaPng(4, 3, [100, 78, 13, 255]),
}))

const unsupportedOra = Buffer.from(zipSync({
  mimetype: [strToU8('image/openraster'), { level: 0 }],
  'stack.xml': strToU8(`<?xml version="1.0"?><image version="0.0.6" w="4" h="3"><stack><layer name="Unsupported blend" src="data/head.png" composite-op="krita:grain-merge"/></stack></image>`),
  'data/head.png': headPng,
  'mergedimage.png': compositePng,
}))

const kraFixture = Buffer.from(zipSync({
  mimetype: [strToU8('application/x-krita'), { level: 0 }],
  'maindoc.xml': strToU8('<DOC><IMAGE width="4" height="3"><layers/></IMAGE></DOC>'),
  'mergedimage.png': compositePng,
}))

try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch { /* already inflated */ }

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
const results = []
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', (error) => errors.push(String(error)))
const ok = (name, condition, detail = '') => {
  results.push([name, !!condition, detail])
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Open Studio' }).click()
  await page.waitForTimeout(900)
  const input = page.locator('#panel-all-import-input')

  await input.setInputFiles({ name: 'character-fixture.ora', mimeType: 'image/openraster', buffer: oraFixture })
  await page.waitForFunction(() => window.__omniframe_store?.getState?.().assets?.some((asset) => asset.layeredArtwork?.documentName === 'character-fixture'))
  const oraState = await page.evaluate(async () => {
    const state = window.__omniframe_store.getState()
    const layers = state.assets.filter((asset) => asset.layeredArtwork?.documentName === 'character-fixture').sort((a, b) => a.layeredArtwork.order - b.layeredArtwork.order)
    const pixels = await Promise.all(layers.map((asset) => new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        canvas.getContext('2d').drawImage(image, 0, 0)
        const context = canvas.getContext('2d')
        resolve({ first: [...context.getImageData(0, 0, 1, 1).data], alphaAtTopRight: context.getImageData(1, 0, 1, 1).data[3] })
      }
      image.onerror = () => resolve(null)
      image.src = asset.url
    })))
    return {
      layers: layers.map((asset) => ({
        name: asset.layeredArtwork.layerName,
        format: asset.layeredArtwork.sourceFormat,
        order: asset.layeredArtwork.order,
        offset: [asset.layeredArtwork.left, asset.layeredArtwork.top],
        opacity: asset.layeredArtwork.opacity,
        groupPath: asset.layeredArtwork.groupPath,
        opacityBaked: asset.layeredArtwork.opacityBaked,
        pixel: pixels[layers.indexOf(asset)]?.first,
        alphaAtTopRight: pixels[layers.indexOf(asset)]?.alphaAtTopRight,
      })),
      notice: state.mediaImportNotice,
      clips: state.clips.length,
    }
  })
  ok('OpenRaster imports visible raster layers as separate Media assets', oraState.layers.length === 3, JSON.stringify(oraState.layers.map((layer) => layer.name)))
  ok('OpenRaster preserves top-first order, signed offsets, group path, and opacity metadata',
    oraState.layers.map((layer) => layer.name).join('|') === 'Head|Hair Strand 1|Backdrop' &&
      oraState.layers[1].groupPath?.join('/') === 'Character' &&
      oraState.layers[1].offset[0] === 0 && oraState.layers[1].offset[1] === 1 &&
      oraState.layers[0].opacity === 0.5 && oraState.layers[0].opacityBaked === false,
    JSON.stringify(oraState.layers.map(({ name, order, offset, opacity, groupPath }) => ({ name, order, offset, opacity, groupPath }))))
  ok('OpenRaster preserves embedded PNG RGB and per-pixel alpha through the asset URL', oraState.layers[0].pixel?.join('|') === '255|150|30|255' && oraState.layers[0].alphaAtTopRight === 128, JSON.stringify({ first: oraState.layers[0].pixel, alphaAtTopRight: oraState.layers[0].alphaAtTopRight }))
  ok('OpenRaster import remains library-only until explicit placement', oraState.clips === 0)

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.setLeftTab('rigging')
    if (state.leftOpen === false) state.setLeftOpen(true)
  })
  await page.waitForSelector('#rig-canvas')
  const sourceOption = await page.locator('#rig-source-psd').textContent()
  ok('Rigging lists imported OpenRaster documents', sourceOption?.includes('ORA') === true, sourceOption || '')
  await page.click('#rig-from-psd-go')
  await page.waitForFunction(() => {
    const state = window.__omniframe_store.getState()
    const rig = state.rigs.find((candidate) => candidate.id === state.activeRigId)
    return rig?.sourceFormat === 'ora' && rig.parts.length === 3
  })
  ok('one action builds a document-space rig from OpenRaster raster layers', await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const rig = state.rigs.find((candidate) => candidate.id === state.activeRigId)
    return rig?.sourceFormat === 'ora' && rig.canvasWidth === 4 && rig.canvasHeight === 3 && rig.parts.some((part) => part.sourceOpacity === 0.5)
  }))
  await page.click('#rig-place-psd-timeline')
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.filter((clip) => clip.name === 'Head' || clip.name === 'Hair Strand 1' || clip.name === 'Backdrop').length === 3)
  const placement = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const clips = state.clips.filter((clip) => ['Head', 'Hair Strand 1', 'Backdrop'].includes(clip.name))
    return {
      names: clips.map((clip) => clip.name),
      starts: clips.map((clip) => clip.start),
      tracks: clips.map((clip) => state.tracks.find((track) => track.id === clip.trackId)?.name),
      indexes: clips.map((clip) => state.tracks.findIndex((track) => track.id === clip.trackId)),
    }
  })
  ok('OpenRaster placement creates synchronized clips on named stacked tracks',
    placement.names.join('|') === 'Head|Hair Strand 1|Backdrop' && new Set(placement.starts).size === 1 && placement.tracks[0].startsWith('ORA ·') && placement.indexes.join('|') === '0|1|2',
    JSON.stringify(placement))
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#of-canvas')
    return canvas?.width > 0 && canvas?.height > 0
  })
  const opacityPixel = await page.evaluate(() => {
    const canvas = document.querySelector('#of-canvas')
    const scale = Math.min(canvas.width / 4, canvas.height / 3)
    const x = Math.floor(canvas.width / 2 - 4 * scale / 2 + 1.5 * scale)
    const y = Math.floor(canvas.height / 2 - 3 * scale / 2 + 1.5 * scale)
    return [...canvas.getContext('2d').getImageData(x, y, 1, 1).data]
  })
  ok('OpenRaster opacity and layer alignment reach Program Monitor rendering', opacityPixel[0] > 70 && opacityPixel[0] < 255 && opacityPixel[1] > 30 && opacityPixel[2] > 30 && opacityPixel[3] === 255, JSON.stringify(opacityPixel))

  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.setLeftTab('media')
    if (state.leftOpen === false) state.setLeftOpen(true)
  })
  await page.waitForFunction(() => !!document.querySelector('#panel-all-import-input'))

  await input.setInputFiles({ name: 'blend-fixture.ora', mimeType: 'image/openraster', buffer: blendOraFixture })
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((asset) => asset.layeredArtwork?.documentName === 'blend-fixture'))
  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const layer = state.assets.find((asset) => asset.layeredArtwork?.documentName === 'blend-fixture')
    state.placeLayeredArtworkOnTimeline(layer.layeredArtwork.documentId, 0)
  })
  await page.waitForTimeout(120)
  const blendResult = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const shade = state.assets.find((asset) => asset.layeredArtwork?.documentName === 'blend-fixture' && asset.layeredArtwork.layerName === 'Shade')
    const canvas = document.querySelector('#of-canvas')
    const scale = Math.min(canvas.width / 4, canvas.height / 3)
    const x = Math.floor(canvas.width / 2 - 4 * scale / 2 + 1.5 * scale)
    const y = Math.floor(canvas.height / 2 - 3 * scale / 2 + 1.5 * scale)
    return { blendMode: shade?.layeredArtwork.blendMode, pixel: [...canvas.getContext('2d').getImageData(x, y, 1, 1).data] }
  })
  ok('OpenRaster Canvas-supported blend modes reach timeline compositing', blendResult.blendMode === 'multiply' && blendResult.pixel[0] >= 90 && blendResult.pixel[0] <= 110 && blendResult.pixel[1] >= 70 && blendResult.pixel[1] <= 90 && blendResult.pixel[2] >= 8 && blendResult.pixel[2] <= 20, JSON.stringify(blendResult))

  await input.setInputFiles({ name: 'unsupported-blend.ora', mimeType: 'image/openraster', buffer: unsupportedOra })
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((asset) => asset.name === 'unsupported-blend · flattened composite'))
  const fallback = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((candidate) => candidate.name === 'unsupported-blend · flattened composite')
    return { exists: !!asset, layered: !!asset?.layeredArtwork, size: [asset?.width, asset?.height], notice: state.mediaImportNotice }
  })
  ok('Unsupported OpenRaster blend modes safely fall back to the source merged composite', fallback.exists && !fallback.layered && fallback.size.join('x') === '4x3' && /composite/i.test(fallback.notice), JSON.stringify(fallback))

  await input.setInputFiles({ name: 'krita-fixture.kra', mimeType: 'application/x-krita', buffer: kraFixture })
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((asset) => asset.name === 'krita-fixture · Krita composite'))
  const kra = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((candidate) => candidate.name === 'krita-fixture · Krita composite')
    return { kind: asset?.kind, size: [asset?.width, asset?.height], layered: !!asset?.layeredArtwork, notice: state.mediaImportNotice }
  })
  ok('Krita KRA safely opens its saved merged image as one processable flat still', kra.kind === 'image' && kra.size.join('x') === '4x3' && !kra.layered && /flattened composite/i.test(kra.notice), JSON.stringify(kra))

  const unsupportedNativeCases = [
    { extension: 'xcf', app: 'GIMP', conversion: 'OpenRaster (.ora)' },
    { extension: 'clip', app: 'Clip Studio Paint', conversion: 'PSD/ORA' },
    { extension: 'cmc', app: 'Clip Studio Paint', conversion: 'PSD/ORA' },
    { extension: 'procreate', app: 'Procreate', conversion: 'PSD/ORA' },
    { extension: 'afphoto', app: 'Affinity Photo', conversion: 'PSD/ORA' },
    { extension: 'afdesign', app: 'Affinity Designer', conversion: 'PSD/ORA' },
    { extension: 'pdn', app: 'Paint.NET', conversion: 'PNG' },
    { extension: 'mdp', app: 'FireAlpaca/MediBang', conversion: 'PNG' },
    { extension: 'rif', app: 'Corel Painter', conversion: 'PNG' },
    { extension: 'ai', app: 'Adobe Illustrator', conversion: 'PDF, SVG, or PNG' },
    { extension: 'psb', app: 'Photoshop PSB', conversion: 'PNG' },
  ]
  for (const sample of unsupportedNativeCases) {
    await input.setInputFiles({
      name: `unsupported.${sample.extension}`,
      mimeType: sample.extension === 'psb' ? 'image/vnd.adobe.photoshop' : 'application/octet-stream',
      buffer: Buffer.from('not a supported image'),
    })
    await page.waitForFunction((app) => window.__omniframe_store.getState().mediaImportNotice?.includes(`${app} native files are not safely decoded`), sample.app)
    const notice = await page.evaluate(() => window.__omniframe_store.getState().mediaImportNotice)
    ok(`${sample.app} ${sample.extension} fails safely with conversion guidance`, notice.includes(sample.conversion) && notice.includes('not safely decoded'))
  }

  ok('no browser errors', errors.length === 0, errors.slice(0, 5).join(' / '))
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result[1])
console.log(`\n=== ${results.length - failed.length} passed / ${failed.length} failed ===`)
if (failed.length) process.exit(1)
