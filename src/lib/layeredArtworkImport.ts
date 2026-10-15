import { strFromU8, unzipSync, type UnzipFileInfo } from 'fflate'
import type { LayeredArtworkAssetInfo, MediaAsset } from '../types'
import { toCanvasCompositeOperation } from './layeredArtworkMetadata'
import { uid } from './time'

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 8192
const MAX_EXTRACTED_BYTES = 768 * 1024 * 1024
const MAX_ENTRY_BYTES = 256 * 1024 * 1024
const MAX_XML_BYTES = 8 * 1024 * 1024
const MAX_DOCUMENT_PIXELS = 100_000_000
const MAX_LAYER_PIXELS = 160_000_000
const MAX_VISIBLE_LAYERS = 300
const MAX_XML_DEPTH = 32
const MAX_XML_NODES = 10_000
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export interface ArtworkImportResult {
  assets: MediaAsset[]
  sourceDocumentId: string
  notice: string
}

interface OraLayerRecord {
  src: string
  name: string
  order: number
  left: number
  top: number
  opacity: number
  blendMode: GlobalCompositeOperation
  groupPath: string[]
}

class UnsupportedOraFeatures extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedOraFeatures'
  }
}

function isSafeArchivePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || path.includes('\\') || path.includes('\0')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false
  const segments = path.split('/')
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

function extractZipEntries(
  bytes: Uint8Array,
  requested: Set<string>,
  totalBudget: number,
): Record<string, Uint8Array> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`The layered artwork file exceeds the safe ${MAX_ARCHIVE_BYTES / (1024 * 1024)} MB archive limit.`)
  }

  let entryCount = 0
  let expandedBytes = 0
  const seen = new Set<string>()
  return unzipSync(bytes, {
    filter(info: UnzipFileInfo) {
      entryCount++
      if (entryCount > MAX_ARCHIVE_ENTRIES) throw new Error(`The archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`)
      if (!requested.has(info.name)) return false
      if (!isSafeArchivePath(info.name)) throw new Error('The archive contains an unsafe path for a required file.')
      if (seen.has(info.name)) throw new Error(`The archive contains a duplicate required entry: ${info.name}`)
      seen.add(info.name)
      if (info.compression !== 0 && info.compression !== 8) {
        throw new Error(`The archive uses an unsupported compression method for ${info.name}.`)
      }
      if (!Number.isSafeInteger(info.originalSize) || info.originalSize < 0 || info.originalSize > MAX_ENTRY_BYTES) {
        throw new Error(`The expanded ${info.name} entry exceeds the safe import limit.`)
      }
      expandedBytes += info.originalSize
      if (expandedBytes > totalBudget || expandedBytes > MAX_EXTRACTED_BYTES) {
        throw new Error('The selected archive contents exceed the safe expanded-data limit.')
      }
      return true
    },
  })
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error('A required raster layer is not a valid PNG image.')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8, false) !== 13 || strFromU8(bytes.subarray(12, 16)) !== 'IHDR') {
    throw new Error('A required PNG layer has an invalid header.')
  }
  const width = view.getUint32(16, false)
  const height = view.getUint32(20, false)
  if (!width || !height || width * height > MAX_DOCUMENT_PIXELS) {
    throw new Error('A raster layer is empty or exceeds the 100-megapixel safety limit.')
  }
  return { width, height }
}

async function validatePng(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const dimensions = pngDimensions(bytes)
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/png' })
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const decoded = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    if (decoded.width !== dimensions.width || decoded.height !== dimensions.height) {
      throw new Error('The PNG decoder reported dimensions that do not match its header.')
    }
  } else {
    const url = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (image.naturalWidth !== dimensions.width || image.naturalHeight !== dimensions.height) {
        throw new Error('The PNG decoder reported dimensions that do not match its header.')
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return dimensions
}

function makeImageAsset(
  name: string,
  bytes: Uint8Array,
  dimensions: { width: number; height: number },
  layeredArtwork?: LayeredArtworkAssetInfo,
): MediaAsset {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/png' })
  return {
    id: uid('asset'),
    name,
    kind: 'image',
    url: URL.createObjectURL(blob),
    duration: 5,
    width: dimensions.width,
    height: dimensions.height,
    size: blob.size,
    ...(layeredArtwork ? { layeredArtwork } : {}),
  }
}

function imageRoot(xml: string): { root: Element; imageWidth: number; imageHeight: number; rootStack: Element } {
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml)) {
    throw new UnsupportedOraFeatures('OpenRaster XML declarations are not supported.')
  }
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) throw new UnsupportedOraFeatures('The OpenRaster layer list is malformed.')
  const root = document.documentElement
  if (root.localName !== 'image') throw new UnsupportedOraFeatures('The OpenRaster layer list has no image root.')
  const imageWidth = Number(root.getAttribute('w'))
  const imageHeight = Number(root.getAttribute('h'))
  if (!Number.isSafeInteger(imageWidth) || !Number.isSafeInteger(imageHeight) || imageWidth <= 0 || imageHeight <= 0 || imageWidth * imageHeight > MAX_DOCUMENT_PIXELS) {
    throw new Error('This OpenRaster canvas is empty or exceeds the 100-megapixel safety limit.')
  }
  const rootStack = Array.from(root.children).find((child) => child.localName === 'stack')
  if (!rootStack) throw new UnsupportedOraFeatures('The OpenRaster file has no layer stack.')
  return { root, imageWidth, imageHeight, rootStack }
}

function parseVisibility(element: Element): boolean {
  const value = element.getAttribute('visibility')
  if (value === null || value === '' || value === 'visible') return true
  if (value === 'hidden') return false
  throw new UnsupportedOraFeatures(`Unsupported OpenRaster visibility value: ${value}`)
}

function parseOpacity(element: Element, isGroup: boolean): number {
  const raw = element.getAttribute('opacity')
  if (raw === null || raw === '') return 1
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new UnsupportedOraFeatures('The OpenRaster file contains an invalid opacity value.')
  }
  if (isGroup && value > 0 && value < 1) {
    throw new UnsupportedOraFeatures('Partially transparent OpenRaster groups require group compositing and are imported as a flattened composite.')
  }
  return value
}

function parseOraLayers(
  xml: string,
  documentWidth: number,
  documentHeight: number,
): OraLayerRecord[] {
  const { rootStack } = imageRoot(xml)
  let visited = 0
  const layers: OraLayerRecord[] = []

  const walk = (stack: Element, visibleFromParent: boolean, groupPath: string[], depth: number) => {
    if (depth > MAX_XML_DEPTH) throw new UnsupportedOraFeatures('OpenRaster group nesting is deeper than the safe import limit.')
    const children = Array.from(stack.children)
    for (const child of children) {
      visited++
      if (visited > MAX_XML_NODES) throw new UnsupportedOraFeatures('The OpenRaster layer list is larger than the safe import limit.')
      if (child.localName === 'stack') {
        // The root stack has no layer compositing attributes. Nested group
        // opacity or non-normal group blending needs isolated group rendering,
        // so keep the source's mergedimage instead of approximating it.
        const isRootStack = child === rootStack
        const visible = visibleFromParent && parseVisibility(child)
        if (!visible) continue
        if (!isRootStack) {
          const isolation = child.getAttribute('isolation')
          if (isolation && isolation !== 'auto' && isolation !== 'isolate') {
            throw new UnsupportedOraFeatures(`Unsupported OpenRaster group isolation value: ${isolation}`)
          }
          const opacity = parseOpacity(child, true)
          if (opacity === 0) continue
          const groupBlend = toCanvasCompositeOperation(child.getAttribute('composite-op') || 'svg:src-over')
          if (!groupBlend || groupBlend !== 'source-over') {
            throw new UnsupportedOraFeatures('Non-normal OpenRaster group blending requires group compositing and is imported as a flattened composite.')
          }
          const groupName = (child.getAttribute('name') || '').trim()
          walk(child, visible, groupName ? [...groupPath, groupName] : groupPath, depth + 1)
        } else {
          walk(child, visible, groupPath, depth + 1)
        }
        continue
      }
      if (child.localName !== 'layer') {
        throw new UnsupportedOraFeatures(`OpenRaster ${child.localName || 'unknown'} layers are imported from the merged composite.`)
      }
      if (!visibleFromParent || !parseVisibility(child)) continue
      if (child.children.length > 0) {
        throw new UnsupportedOraFeatures('Nested mask/filter/extension content on an OpenRaster layer is imported from the merged composite.')
      }

      const rawSrc = child.getAttribute('src') || ''
      if (!isSafeArchivePath(rawSrc) || !/\.png$/i.test(rawSrc)) {
        throw new UnsupportedOraFeatures('Visible vector, text, or external OpenRaster layers are imported from the merged composite.')
      }
      const blendMode = toCanvasCompositeOperation(child.getAttribute('composite-op') || 'svg:src-over')
      if (!blendMode) throw new UnsupportedOraFeatures('This OpenRaster blend mode is not supported by the Canvas renderer; the merged composite will be used.')
      if (groupPath.length > 0 && blendMode !== 'source-over') {
        throw new UnsupportedOraFeatures('Blended layers inside OpenRaster groups require isolated group rendering; the merged composite will be used.')
      }
      const left = Number(child.getAttribute('x') || 0)
      const top = Number(child.getAttribute('y') || 0)
      if (!Number.isSafeInteger(left) || !Number.isSafeInteger(top)) {
        throw new UnsupportedOraFeatures('This OpenRaster layer has a non-integer offset and is imported from the merged composite.')
      }
      const opacity = parseOpacity(child, false)
      if (opacity === 0) continue
      if (layers.length >= MAX_VISIBLE_LAYERS) throw new Error(`This OpenRaster file has more than ${MAX_VISIBLE_LAYERS} visible raster layers.`)
      const fallbackName = `Layer ${layers.length + 1}`
      layers.push({
        src: rawSrc,
        name: (child.getAttribute('name') || '').trim() || fallbackName,
        order: layers.length,
        left,
        top,
        opacity,
        blendMode,
        groupPath,
      })
    }
  }

  // The first child in a stack is topmost in OpenRaster.
  walk(rootStack, true, [], 0)
  if (layers.length === 0) throw new UnsupportedOraFeatures('No visible PNG raster layers were found.')
  const bottomLayer = layers[layers.length - 1]
  if (bottomLayer.groupPath.length > 0 && bottomLayer.blendMode !== 'source-over') {
    throw new UnsupportedOraFeatures('The bottom layer of a nested OpenRaster stack needs group compositing; the merged composite will be used.')
  }
  // The OpenRaster root stack is isolated; its bottommost direct layer's own
  // blend operator has no backdrop to blend against and therefore resolves as
  // normal source-over.
  if (bottomLayer.groupPath.length === 0) bottomLayer.blendMode = 'source-over'

  // The shared document bounds are retained for placement; PNG layers may
  // legitimately extend beyond them, including at negative offsets.
  void documentWidth
  void documentHeight
  return layers
}

async function loadMergedComposite(
  bytes: Uint8Array,
  documentName: string,
  reason: string,
  sourceDocumentId: string,
): Promise<ArtworkImportResult> {
  const archive = extractZipEntries(bytes, new Set(['mergedimage.png']), MAX_ENTRY_BYTES)
  const composite = archive['mergedimage.png']
  if (!composite) {
    throw new Error(`${reason} This file has no readable mergedimage.png composite; export a PNG or OpenRaster copy from the source application.`)
  }
  const dimensions = await validatePng(composite)
  const asset = makeImageAsset(`${documentName} · flattened composite`, composite, dimensions)
  return {
    assets: [asset],
    sourceDocumentId,
    notice: `${reason} Imported the saved merged composite as one image. Original layers, masks, animation, and editor-specific effects are not editable in OmniFrame.`,
  }
}

export async function importKritaDocument(file: File): Promise<ArtworkImportResult> {
  if (!/\.kra$/i.test(file.name)) throw new Error('Choose a Krita .kra document.')
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('This Krita document exceeds the safe 256 MB archive limit.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sourceDocumentId = uid('kra')
  const archive = extractZipEntries(bytes, new Set(['mimetype', 'mergedimage.png']), MAX_ENTRY_BYTES)
  const mime = archive.mimetype ? strFromU8(archive.mimetype).trim() : ''
  if (mime && mime !== 'application/x-krita') throw new Error('This .kra file does not identify itself as a Krita document.')
  const composite = archive['mergedimage.png']
  if (!composite) {
    throw new Error('This Krita document has no readable mergedimage.png preview. Save/export a PNG, or export the layer stack as OpenRaster (.ora).')
  }
  const dimensions = await validatePng(composite)
  const documentName = file.name.replace(/\.kra$/i, '') || 'Krita artwork'
  const asset = makeImageAsset(`${documentName} · Krita composite`, composite, dimensions)
  return {
    assets: [asset],
    sourceDocumentId,
    notice: `Opened “${file.name}” from Krita as its saved flattened composite. The rendered image is available for editing, but the KRA layer tree, animation, masks, filters, and profile data are not imported. Export as .ora for supported raster layers.`,
  }
}

export async function importOpenRasterDocument(file: File): Promise<ArtworkImportResult> {
  if (!/\.ora$/i.test(file.name)) throw new Error('Choose an OpenRaster .ora document.')
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('This OpenRaster file exceeds the safe 256 MB archive limit.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sourceDocumentId = uid('ora')
  const header = extractZipEntries(bytes, new Set(['mimetype', 'stack.xml']), MAX_XML_BYTES + 1024)
  const mime = header.mimetype ? strFromU8(header.mimetype).trim() : ''
  if (mime && mime !== 'image/openraster') throw new Error('This .ora file does not identify itself as an OpenRaster document.')
  const stackBytes = header['stack.xml']
  if (!stackBytes) {
    return loadMergedComposite(bytes, file.name.replace(/\.ora$/i, ''), 'The OpenRaster layer list is missing.', sourceDocumentId)
  }
  if (stackBytes.byteLength > MAX_XML_BYTES) throw new Error('The OpenRaster layer list exceeds the 8 MB safety limit.')

  const documentName = file.name.replace(/\.ora$/i, '') || 'OpenRaster artwork'
  const documentId = sourceDocumentId
  let parsed: OraLayerRecord[]
  let documentWidth: number
  let documentHeight: number
  try {
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(stackBytes)
    const rootInfo = imageRoot(xml)
    documentWidth = rootInfo.imageWidth
    documentHeight = rootInfo.imageHeight
    parsed = parseOraLayers(xml, documentWidth, documentHeight)
  } catch (error) {
    if (error instanceof Error && !(error instanceof UnsupportedOraFeatures)) throw error
    const reason = error instanceof Error ? error.message : 'The OpenRaster layer features are not supported.'
    return loadMergedComposite(bytes, documentName, `${reason}`, sourceDocumentId)
  }

  const requested = new Set(parsed.map((layer) => layer.src))
  const layerBytes = extractZipEntries(bytes, requested, MAX_EXTRACTED_BYTES)
  const assets: MediaAsset[] = []
  let layerPixels = 0
  try {
    for (const layer of parsed) {
      const raster = layerBytes[layer.src]
      if (!raster) throw new UnsupportedOraFeatures(`The referenced OpenRaster layer “${layer.src}” is missing.`)
      let dimensions: { width: number; height: number }
      try {
        dimensions = await validatePng(raster)
      } catch {
        throw new UnsupportedOraFeatures(`The referenced OpenRaster layer “${layer.src}” is not a decodable PNG; the merged composite will be used.`)
      }
      layerPixels += dimensions.width * dimensions.height
      if (layerPixels > MAX_LAYER_PIXELS) throw new Error('The OpenRaster layers exceed the 160-megapixel aggregate safety limit.')
      const info: LayeredArtworkAssetInfo = {
        sourceFormat: 'ora',
        documentId,
        documentName,
        layerName: layer.name,
        order: layer.order,
        documentWidth,
        documentHeight,
        left: layer.left,
        top: layer.top,
        width: dimensions.width,
        height: dimensions.height,
        opacity: layer.opacity,
        opacityBaked: false,
        groupPath: layer.groupPath,
        blendMode: layer.blendMode,
      }
      assets.push(makeImageAsset(`${documentName} / ${layer.name}`, raster, dimensions, info))
    }
  } catch (error) {
    for (const asset of assets) URL.revokeObjectURL(asset.url)
    if (error instanceof UnsupportedOraFeatures) {
      return loadMergedComposite(bytes, documentName, error.message, sourceDocumentId)
    }
    throw error
  }

  return {
    assets,
    sourceDocumentId,
    notice: `Imported ${assets.length} visible OpenRaster raster layers from “${file.name}”. Names, stack order, document offsets, opacity, group labels, and supported Canvas blend modes are retained. Vector/text layers, hidden layers, unsupported group compositing, profiles, and editor-specific extensions are not imported.`,
  }
}

export async function importArtworkArchive(file: File): Promise<ArtworkImportResult> {
  if (/\.kra$/i.test(file.name)) return importKritaDocument(file)
  if (/\.ora$/i.test(file.name)) return importOpenRasterDocument(file)
  throw new Error('Supported layered-art archives are Krita .kra (flattened composite) and OpenRaster .ora (supported raster layer stack).')
}
