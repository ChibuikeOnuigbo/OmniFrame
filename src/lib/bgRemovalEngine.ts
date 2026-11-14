// Local color-edge cutout. This is a fast heuristic for still images, not an
// inference implementation of the model IDs retained for project compatibility.

import type { BgRemovalModelId, BgRemovalOptions } from '../types'

export interface SegmentationMask {
  width: number
  height: number
  data: Uint8ClampedArray // Alpha values 0..255
}

// Flood from the image corners through pixels that resemble the corner colors.
// This works well for a subject on a fairly uniform backdrop and deliberately
// leaves isolated foreground pixels alone. Complex backgrounds need guided roto.
export function generateMattingMask(
  imageData: ImageData,
  modelId: BgRemovalModelId,
  options: BgRemovalOptions
): SegmentationMask {
  const { width, height, data } = imageData
  const pixelCount = width * height
  if (!pixelCount) return { width, height, data: new Uint8ClampedArray(0) }
  const mask = new Uint8ClampedArray(pixelCount)
  mask.fill(255)
  const tolerance = modelId === 'modnet-photographic' ? 25
    : modelId === 'isnet-anime' ? 55
    : modelId === 'slimsam-fast' ? 75 : 40
  const corners = [0, width - 1, (height - 1) * width, pixelCount - 1]
  const colors = corners.map((index) => {
    const offset = index * 4
    return [data[offset], data[offset + 1], data[offset + 2]]
  })
  const seen = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  let tail = 0
  let head = 0
  const matches = (index: number) => {
    const offset = index * 4
    if (data[offset + 3] < 32) return true
    return colors.some(([r, g, b]) =>
      Math.abs(data[offset] - r) + Math.abs(data[offset + 1] - g) + Math.abs(data[offset + 2] - b) <= tolerance * 3)
  }
  const enqueue = (index: number) => {
    if (seen[index] || !matches(index)) return
    seen[index] = 1
    queue[tail++] = index
    mask[index] = 0
  }
  for (const index of corners) enqueue(index)
  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    if (x > 0) enqueue(index - 1)
    if (x + 1 < width) enqueue(index + 1)
    if (index >= width) enqueue(index - width)
    if (index + width < pixelCount) enqueue(index + width)
  }

  // Refine mask: Edge Choke / Expand & Feathering
  return refineAlphaMask(mask, width, height, options.chokeExpand ?? 0, options.featherRadius ?? 0)
}

// Morphological Choke/Expand and Box-blur Feathering
export function refineAlphaMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  choke: number,
  feather: number
): SegmentationMask {
  let output = new Uint8ClampedArray(mask)
  if (w <= 0 || h <= 0 || output.length !== w * h) return { width: w, height: h, data: output }

  // Square morphology is separable: two short passes rather than a quadratic
  // window per pixel. Clamp at the image edge instead of leaving a hard rim.
  const morphRadius = Math.min(10, Math.abs(Math.round(choke || 0)))
  if (morphRadius > 0) {
    const expand = choke > 0
    const horizontal = new Uint8ClampedArray(output.length)
    const vertical = new Uint8ClampedArray(output.length)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let value = expand ? 0 : 255
      for (let dx = -morphRadius; dx <= morphRadius; dx++) {
        const sample = output[y * w + Math.max(0, Math.min(w - 1, x + dx))]
        value = expand ? Math.max(value, sample) : Math.min(value, sample)
      }
      horizontal[y * w + x] = value
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let value = expand ? 0 : 255
      for (let dy = -morphRadius; dy <= morphRadius; dy++) {
        const sample = horizontal[Math.max(0, Math.min(h - 1, y + dy)) * w + x]
        value = expand ? Math.max(value, sample) : Math.min(value, sample)
      }
      vertical[y * w + x] = value
    }
    output = vertical
  }

  const blurRadius = Math.min(10, Math.max(0, Math.round(feather || 0)))
  if (blurRadius > 0) {
    const windowSize = blurRadius * 2 + 1
    const horizontal = new Float32Array(output.length)
    const vertical = new Uint8ClampedArray(output.length)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0
      for (let dx = -blurRadius; dx <= blurRadius; dx++) {
        sum += output[y * w + Math.max(0, Math.min(w - 1, x + dx))]
      }
      horizontal[y * w + x] = sum / windowSize
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        sum += horizontal[Math.max(0, Math.min(h - 1, y + dy)) * w + x]
      }
      vertical[y * w + x] = Math.round(sum / windowSize)
    }
    output = vertical
  }

  return { width: w, height: h, data: output }
}

// Composite foreground with selected background mode into a destination canvas
export function compositeCutout(
  sourceCanvas: HTMLCanvasElement,
  mask: SegmentationMask,
  options: BgRemovalOptions,
  destCanvas: HTMLCanvasElement
) {
  const srcCtx = sourceCanvas.getContext('2d')
  if (!srcCtx) return
  const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const { mode, solidColor, blurRadius } = options
  let background: HTMLCanvasElement | null = null
  if (mode === 'blur') {
    background = document.createElement('canvas')
    background.width = sourceCanvas.width
    background.height = sourceCanvas.height
    background.getContext('2d')?.putImageData(srcData, 0, 0)
  }
  destCanvas.width = sourceCanvas.width
  destCanvas.height = sourceCanvas.height
  const ctx = destCanvas.getContext('2d')
  if (!ctx) return
  const destData = ctx.createImageData(sourceCanvas.width, sourceCanvas.height)

  // Draw background first
  if (mode === 'solid') {
    ctx.fillStyle = solidColor || '#00FF00'
    ctx.fillRect(0, 0, destCanvas.width, destCanvas.height)
  } else if (mode === 'blur' && background) {
    ctx.filter = `blur(${blurRadius || 12}px)`
    ctx.drawImage(background, 0, 0)
    ctx.filter = 'none'
  }

  // Read current background pixels from dest
  const currentBg = mode === 'transparent' ? null : ctx.getImageData(0, 0, destCanvas.width, destCanvas.height)

  for (let i = 0; i < mask.data.length; i++) {
    const idx = i * 4
    const a = mask.data[i] / 255

    if (mode === 'transparent') {
      destData.data[idx] = srcData.data[idx]
      destData.data[idx + 1] = srcData.data[idx + 1]
      destData.data[idx + 2] = srcData.data[idx + 2]
      destData.data[idx + 3] = Math.round(srcData.data[idx + 3] * a)
    } else {
      // Blend source over background
      destData.data[idx] = Math.round(srcData.data[idx] * a + (currentBg?.data[idx] || 0) * (1 - a))
      destData.data[idx + 1] = Math.round(srcData.data[idx + 1] * a + (currentBg?.data[idx + 1] || 0) * (1 - a))
      destData.data[idx + 2] = Math.round(srcData.data[idx + 2] * a + (currentBg?.data[idx + 2] || 0) * (1 - a))
      destData.data[idx + 3] = 255
    }
  }

  ctx.putImageData(destData, 0, 0)
}
