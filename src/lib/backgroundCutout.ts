import type { BgRemovalOptions } from '../types'
import { compositeCutout, generateMattingMask } from './bgRemovalEngine'

export interface StillCutoutResult { url: string; width: number; height: number; size: number }
const cancelled = () => new DOMException('Cutout cancelled', 'AbortError')

function blobUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(cancelled()); return }
    const reader = new FileReader()
    const abort = () => { reader.abort(); reject(cancelled()) }
    const cleanup = () => signal.removeEventListener('abort', abort)
    reader.onload = () => { cleanup(); resolve(String(reader.result)) }
    reader.onerror = () => { cleanup(); reject(reader.error || new Error('Could not encode cutout')) }
    reader.onabort = cleanup
    signal.addEventListener('abort', abort, { once: true })
    reader.readAsDataURL(blob)
  })
}

async function workerBlob(bitmap: ImageBitmap, options: BgRemovalOptions, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { bitmap.close(); reject(cancelled()); return }
    let worker: Worker
    try {
      worker = new Worker(new URL('./backgroundCutout.worker.ts', import.meta.url), { type: 'module' })
    } catch (cause) { bitmap.close(); reject(cause); return }
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const fail = (cause: unknown) => { cleanup(); reject(cause) }
    const abort = () => fail(cancelled())
    const timer = setTimeout(() => fail(new Error('Cutout timed out; try a smaller image')), 30_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
      if (event.data.error || !(event.data.blob instanceof Blob)) {
        fail(new Error(event.data.error || 'Invalid cutout result')); return
      }
      cleanup()
      resolve(event.data.blob)
    }
    worker.onerror = (event) => { event.preventDefault(); fail(new Error(event.message || 'Cutout worker failed')) }
    worker.onmessageerror = () => fail(new Error('Could not read cutout worker result'))
    try { worker.postMessage({ bitmap, options }, [bitmap]) }
    catch (cause) { bitmap.close(); fail(cause) }
  })
}

/** A dedicated worker per job can be terminated immediately on close or edits. */
export async function renderStillCutoutAsync(
  image: HTMLImageElement, options: BgRemovalOptions, signal: AbortSignal,
): Promise<StillCutoutResult> {
  if (signal.aborted) throw cancelled()
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  let blob: Blob
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    const bitmap = await createImageBitmap(image, { resizeWidth: width, resizeHeight: height })
    blob = await workerBlob(bitmap, options, signal)
  } else {
    // Compatibility path for older embedded browsers without OffscreenCanvas.
    const source = document.createElement('canvas')
    source.width = width; source.height = height
    const context = source.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas processing is unavailable')
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    const mask = generateMattingMask(pixels, options.modelId, options)
    const output = document.createElement('canvas')
    compositeCutout(source, mask, options, output)
    blob = await new Promise<Blob>((resolve, reject) => output.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Could not encode cutout'))
    }, 'image/png'))
  }
  if (signal.aborted) throw cancelled()
  const url = await blobUrl(blob, signal)
  if (signal.aborted) throw cancelled()
  return { url, width, height, size: blob.size }
}
