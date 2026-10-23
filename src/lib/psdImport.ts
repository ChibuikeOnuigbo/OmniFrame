import type { Layer, Psd } from 'ag-psd'
import type { LayeredArtworkAssetInfo, MediaAsset } from '../types'
import { toCanvasCompositeOperation } from './layeredArtworkMetadata'
import { uid } from './time'

/**
 * Photoshop import is deliberately bounded. The simple RGB/8-bit raster-layer
 * path retains pixels, names, order, offsets, opacity, and pass-through groups.
 * If a feature cannot be represented safely, import Photoshop's saved merged
 * image as a flat still instead of silently dropping visible content.
 *
 * This is not a Photoshop project editor or round-trip writer; the original
 * source file is never modified and native metadata not listed above is not
 * retained in OmniFrame's current in-memory asset model.
 */
const MAX_PSD_BYTES = 256 * 1024 * 1024
const MAX_PSD_PIXELS = 100_000_000
const MAX_VISIBLE_LAYERS = 300
const MAX_TOTAL_LAYER_PIXELS = 160_000_000
const MAX_DECODED_BYTES = 768 * 1024 * 1024

export interface PsdImportResult {
  assets: MediaAsset[]
  sourceDocumentId: string
  mode: 'layers' | 'flattened'
  notice: string
}

function isPsdFile(file: File): boolean {
  return /\.psd$/i.test(file.name) || (!/\.psb$/i.test(file.name) && file.type === 'image/vnd.adobe.photoshop')
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not encode PSD raster data as PNG.'))
    }, 'image/png')
  })
}

function makeLayerCanvas(layer: Layer): HTMLCanvasElement | null {
  if (layer.canvas) return layer.canvas
  if (!layer.imageData) return null

  const canvas = document.createElement('canvas')
  canvas.width = layer.imageData.width
  canvas.height = layer.imageData.height
  const context = canvas.getContext('2d')
  if (!context) return null
  const imageData = new ImageData(
    new Uint8ClampedArray(layer.imageData.data),
    layer.imageData.width,
    layer.imageData.height,
  )
  context.putImageData(imageData, 0, 0)
  return canvas
}

function visibleUnsupportedLayerFeature(layer: Layer): string | null {
  if (layer.hidden) return null
  if (
    layer.mask || layer.realMask || layer.filterMask || layer.effects || layer.text ||
    layer.vectorFill || layer.vectorStroke || layer.vectorMask || layer.adjustment ||
    layer.placedLayer || layer.artboard || layer.filterEffectsMasks?.length ||
    layer.animationFrames?.length || layer.timeline || layer.clipping || layer.knockout ||
    layer.fillOpacity !== undefined || layer.transparencyShapesLayer ||
    layer.blendInteriorElements || layer.blendClippendElements
  ) {
    return 'masks, effects, text/vector/smart-object, adjustment, clipping, or animation content'
  }

  if (layer.children?.length) {
    if ((layer.opacity ?? 1) < 1 - 1e-6) return 'group opacity/isolation'
    if (layer.blendMode && layer.blendMode !== 'pass through') return 'isolated group compositing'
  } else if (!toCanvasCompositeOperation(layer.blendMode)) {
    return `the Photoshop “${layer.blendMode || 'unknown'}” blend mode`
  }

  return null
}

function unsupportedDocumentFeature(psd: Psd): string | null {
  if (psd.globalLayerMaskInfo) return 'a document-level layer mask'
  if (psd.artboards?.count) return 'artboards'
  if (psd.imageResources?.animations) return 'Photoshop frame animation'
  const aspect = psd.imageResources?.pixelAspectRatio?.aspect
  if (aspect !== undefined && Math.abs(aspect - 1) > 1e-6) return 'non-square pixel aspect ratio'

  const stack: Layer[] = [...(psd.children || [])]
  while (stack.length) {
    const layer = stack.pop()!
    const issue = visibleUnsupportedLayerFeature(layer)
    if (issue) return issue
    if (!layer.hidden && layer.children?.length) stack.push(...layer.children)
  }
  return null
}

function validateRasterDocument(psd: Psd): void {
  if (!psd.width || !psd.height || psd.width * psd.height > MAX_PSD_PIXELS) {
    throw new Error('This PSD canvas is empty or exceeds the 100-megapixel import limit.')
  }
  if (psd.colorMode !== 3 || psd.bitsPerChannel !== 8) {
    throw new Error('Only RGB, 8-bit-per-channel PSD documents are currently decoded safely. Convert a copy to RGB/8-bit in Photoshop or export a PNG; the original file was not changed.')
  }
}

function compositeCanvas(psd: Psd): HTMLCanvasElement | null {
  if (psd.canvas) return psd.canvas
  const pixels = psd.imageData
  if (!pixels || pixels.width !== psd.width || pixels.height !== psd.height) return null
  if (!(pixels.data instanceof Uint8Array || pixels.data instanceof Uint8ClampedArray)) return null
  if (pixels.data.length !== pixels.width * pixels.height * 4) return null

  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.putImageData(new ImageData(
    new Uint8ClampedArray(pixels.data),
    pixels.width,
    pixels.height,
  ), 0, 0)
  return canvas
}

async function makeFlattenedResult(
  psd: Psd,
  fileName: string,
  issue: string,
  sourceDocumentId: string,
): Promise<PsdImportResult> {
  validateRasterDocument(psd)
  const canvas = compositeCanvas(psd)
  if (!canvas) {
    throw new Error(`This PSD uses ${issue}, and its saved merged image could not be decoded. Open it in Photoshop and export a PNG or a simple RGB/8-bit raster-layer PSD; the source file was not changed.`)
  }
  const blob = await canvasBlob(canvas)
  const documentName = fileName.replace(/\.psd$/i, '') || 'Photoshop artwork'
  const asset: MediaAsset = {
    id: uid('asset'),
    name: `${documentName} · flattened composite`,
    kind: 'image',
    url: URL.createObjectURL(blob),
    duration: 5,
    width: psd.width,
    height: psd.height,
    size: blob.size,
  }
  return {
    assets: [asset],
    sourceDocumentId,
    mode: 'flattened',
    notice: `Opened “${fileName}” from its saved Photoshop merged image as one flattened still because ${issue}. The visible composite can be processed, but Photoshop layers, masks, editable objects, and native metadata are not imported. The original PSD was not changed; this is not a native-project save/round trip.`,
  }
}

function supportedLayerNotice(fileName: string, count: number): string {
  return `Imported ${count} visible raster layers from “${fileName}” using the bounded RGB/8-bit Photoshop raster subset. Pixels, names, order, offsets, opacity, and pass-through group names are retained; this is not a complete Photoshop project or native save/round trip. In Rigging, choose “Rig artwork layers” to set up pins/sway and part transforms, then “Place aligned artwork layers on timeline”; an active matching rig drives them in sequence playback and canvas export.`
}

/** Import a PSD as a supported raster-layer stack or a safe saved composite. */
export async function importPsdDocument(file: File): Promise<PsdImportResult> {
  if (!isPsdFile(file)) throw new Error('Choose a Photoshop .psd file.')
  if (file.size > MAX_PSD_BYTES) {
    throw new Error(`This PSD is ${(file.size / (1024 * 1024)).toFixed(0)} MB. The current safe import limit is 256 MB.`)
  }

  const buffer = await file.arrayBuffer()
  const { readPsd } = await import('ag-psd')
  const documentName = file.name.replace(/\.psd$/i, '') || 'Layered artwork'
  const documentId = uid('psd')
  let psd: Psd
  let parserIssue: string | null = null

  try {
    psd = readPsd(buffer, {
      skipThumbnail: true,
      useImageData: true,
      totalMemoryLimit: MAX_DECODED_BYTES,
      throwForMissingFeatures: true,
      logMissingFeatures: false,
    })
  } catch {
    // Retry only the Photoshop-rendered composite. If a feature parser fails
    // while reading layers but the saved merged image is valid, keep the
    // visible artwork usable without pretending the layer tree was recovered.
    try {
      psd = readPsd(buffer, {
        skipLayerImageData: true,
        skipThumbnail: true,
        useImageData: true,
        totalMemoryLimit: MAX_DECODED_BYTES,
        throwForMissingFeatures: false,
        logMissingFeatures: false,
      })
      parserIssue = 'an unsupported or malformed editable Photoshop layer feature'
    } catch {
      throw new Error('This PSD could not be decoded safely. Open it in Photoshop and export a standard RGB/8-bit PSD or PNG; the original file was not changed.')
    }
  }

  validateRasterDocument(psd)
  const issue = parserIssue || unsupportedDocumentFeature(psd)
  if (issue) return makeFlattenedResult(psd, file.name, issue, documentId)

  const assets: MediaAsset[] = []
  const layerStack: Array<{
    layer: Layer
    parentOpacity: number
    groupPath: string[]
  }> = []
  for (const layer of [...(psd.children || [])].reverse()) {
    layerStack.push({ layer, parentOpacity: 1, groupPath: [] })
  }

  let totalLayerPixels = 0
  try {
    while (layerStack.length) {
      const { layer, parentOpacity, groupPath } = layerStack.pop()!
      if (layer.hidden) continue

      // Pass-through groups have no isolation/opacity effect, so their names
      // can be retained as metadata while their raster children stay editable.
      const opacity = parentOpacity * Math.min(1, Math.max(0, layer.opacity ?? 1))
      if (layer.children?.length) {
        const nextPath = layer.name?.trim() ? [...groupPath, layer.name.trim()] : groupPath
        for (let childIndex = layer.children.length - 1; childIndex >= 0; childIndex--) {
          layerStack.push({ layer: layer.children[childIndex], parentOpacity: opacity, groupPath: nextPath })
        }
        continue
      }

      const source = makeLayerCanvas(layer)
      if (!source?.width || !source?.height) continue
      if (assets.length >= MAX_VISIBLE_LAYERS) {
        throw new Error(`This PSD has more than ${MAX_VISIBLE_LAYERS} visible raster layers. Import fewer layers or split the document.`)
      }
      totalLayerPixels += source.width * source.height
      if (totalLayerPixels > MAX_TOTAL_LAYER_PIXELS) {
        throw new Error('The visible PSD layers exceed the 160-megapixel aggregate raster limit. Hide or split the document and try again.')
      }

      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = source.height
      const context = canvas.getContext('2d')
      if (!context) continue
      context.globalAlpha = opacity
      context.drawImage(source, 0, 0)
      context.globalAlpha = 1

      const blob = await canvasBlob(canvas)
      const layerName = (layer.name || '').trim() || `Layer ${assets.length + 1}`
      const info: LayeredArtworkAssetInfo = {
        sourceFormat: 'psd',
        documentId,
        documentName,
        layerName,
        order: assets.length,
        documentWidth: psd.width,
        documentHeight: psd.height,
        left: layer.left ?? 0,
        top: layer.top ?? 0,
        width: source.width,
        height: source.height,
        opacity,
        opacityBaked: true,
        groupPath,
        blendMode: layer.blendMode,
      }

      assets.push({
        id: uid('asset'),
        name: `${documentName} / ${layerName}`,
        kind: 'image',
        url: URL.createObjectURL(blob),
        duration: 5,
        width: source.width,
        height: source.height,
        size: blob.size,
        layeredArtwork: info,
        // Preserve this alias for existing saved-state migration and the
        // established PSD E2E contract; new code reads layeredArtwork.
        psdLayer: { ...info, sourceFormat: 'psd' },
      })
    }
  } catch (error) {
    for (const asset of assets) URL.revokeObjectURL(asset.url)
    throw error
  }

  if (assets.length === 0) {
    return makeFlattenedResult(psd, file.name, 'no supported visible raster layers', documentId)
  }

  return {
    assets,
    sourceDocumentId: documentId,
    mode: 'layers',
    notice: supportedLayerNotice(file.name, assets.length),
  }
}
