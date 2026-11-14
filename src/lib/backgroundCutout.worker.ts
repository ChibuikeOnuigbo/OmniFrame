import { compositeCutout, generateMattingMask } from './bgRemovalEngine'
import type { BgRemovalOptions } from '../types'

const worker = self as unknown as Worker
worker.onmessage = async (event: MessageEvent<{ bitmap: ImageBitmap; options: BgRemovalOptions }>) => {
  const { bitmap, options } = event.data
  try {
    const source = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = source.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas processing is unavailable')
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, source.width, source.height)
    const mask = generateMattingMask(pixels, options.modelId, options)
    const output = new OffscreenCanvas(source.width, source.height)
    compositeCutout(source, mask, options, output)
    const blob = await output.convertToBlob({ type: 'image/png' })
    worker.postMessage({ blob })
  } catch (cause) {
    worker.postMessage({ error: cause instanceof Error ? cause.message : String(cause) })
  } finally {
    bitmap.close()
  }
}
