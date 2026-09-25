import type { DrawingStroke, PaintLayer, StrokePoint, OnionSkinSettings, ActiveSelection } from '../types'

const imageCache = new Map<string, HTMLImageElement>()
let sharedOffscreenCanvas: HTMLCanvasElement | null = null
let sharedOffscreenCtx: CanvasRenderingContext2D | null = null

function getSharedOffscreen(w: number, h: number) {
  if (typeof document === 'undefined') return { canvas: null, ctx: null }
  if (!sharedOffscreenCanvas) {
    sharedOffscreenCanvas = document.createElement('canvas')
  }
  if (sharedOffscreenCanvas.width !== w || sharedOffscreenCanvas.height !== h) {
    sharedOffscreenCanvas.width = w
    sharedOffscreenCanvas.height = h
  }
  if (!sharedOffscreenCtx) {
    sharedOffscreenCtx = sharedOffscreenCanvas.getContext('2d')
  }
  sharedOffscreenCtx?.clearRect(0, 0, w, h)
  return { canvas: sharedOffscreenCanvas, ctx: sharedOffscreenCtx }
}

function parseHexOrRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('')
    }
    const num = parseInt(hex, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
  }
  return [245, 158, 11] // default amber
}

/**
 * Performs contiguous flood fill and optional luminance-preserving recolor.
 */
export function floodFillRegion(
  sourceCanvas: HTMLCanvasElement,
  seedNormX: number,
  seedNormY: number,
  options: {
    threshold: number // 1 to 100
    fillColor: string
    preserveLuminance: boolean
    grow?: number // 0 to 3 pixels dilation
  },
): string | null {
  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) return null

  const srcImgData = srcCtx.getImageData(0, 0, width, height)
  const src = srcImgData.data

  const seedX = Math.max(0, Math.min(width - 1, Math.round(seedNormX * width)))
  const seedY = Math.max(0, Math.min(height - 1, Math.round(seedNormY * height)))
  const seedIdx = (seedY * width + seedX) * 4

  const targetR = src[seedIdx]
  const targetG = src[seedIdx + 1]
  const targetB = src[seedIdx + 2]
  const targetA = src[seedIdx + 3]

  // If clicked completely transparent pixel, do not fill
  if (targetA < 10) return null

  const [fillR, fillG, fillB] = parseHexOrRgb(options.fillColor)
  // Max color distance = sqrt(255^2 * 3) ~ 441.67
  const maxDist = (options.threshold / 100) * 441.67

  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let qHead = 0
  let qTail = 0

  const startPos = seedY * width + seedX
  queue[qTail++] = startPos
  visited[startPos] = 1

  // Create destination offscreen buffer
  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) return null
  const outImgData = outCtx.createImageData(width, height)
  const dst = outImgData.data

  const filledIndices: number[] = []

  while (qHead < qTail) {
    const pos = queue[qHead++]
    const x = pos % width
    const y = Math.floor(pos / width)
    const idx = pos * 4

    filledIndices.push(pos)

    if (options.preserveLuminance) {
      // Calculate original luminance Y in [0, 255]
      const origR = src[idx]
      const origG = src[idx + 1]
      const origB = src[idx + 2]
      const lum = 0.299 * origR + 0.587 * origG + 0.114 * origB
      const scale = lum / 128.0

      dst[idx] = Math.min(255, Math.round(fillR * scale))
      dst[idx + 1] = Math.min(255, Math.round(fillG * scale))
      dst[idx + 2] = Math.min(255, Math.round(fillB * scale))
      dst[idx + 3] = 255
    } else {
      dst[idx] = fillR
      dst[idx + 1] = fillG
      dst[idx + 2] = fillB
      dst[idx + 3] = 255
    }

    // 4-directional neighbors
    const neighbors = [
      x > 0 ? pos - 1 : -1,
      x < width - 1 ? pos + 1 : -1,
      y > 0 ? pos - width : -1,
      y < height - 1 ? pos + width : -1,
    ]

    for (const n of neighbors) {
      if (n === -1 || visited[n] === 1) continue
      const nIdx = n * 4
      const dr = src[nIdx] - targetR
      const dg = src[nIdx + 1] - targetG
      const db = src[nIdx + 2] - targetB
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)

      if (dist <= maxDist) {
        visited[n] = 1
        queue[qTail++] = n
      }
    }
  }

  // Morphological dilation (grow by 1px) to prevent white halos around dark borders
  const grow = options.grow ?? 1
  if (grow > 0 && filledIndices.length > 0) {
    for (const pos of filledIndices) {
      const x = pos % width
      const y = Math.floor(pos / width)
      const offsets = [-1, 1, -width, width]
      for (const off of offsets) {
        const n = pos + off
        if (n >= 0 && n < width * height && dst[n * 4 + 3] === 0) {
          // Check if neighbor is not a dark contour line
          const nIdx = n * 4
          const lineLum = 0.299 * src[nIdx] + 0.587 * src[nIdx + 1] + 0.114 * src[nIdx + 2]
          if (lineLum > 40) {
            dst[nIdx] = dst[pos * 4]
            dst[nIdx + 1] = dst[pos * 4 + 1]
            dst[nIdx + 2] = dst[pos * 4 + 2]
            dst[nIdx + 3] = 220
          }
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0)
  return outCanvas.toDataURL('image/png')
}

/**
 * Evaluates whether a stroke is visible at the given playhead time in seconds.
 */
export function isStrokeVisibleAtTime(stroke: DrawingStroke, time: number, fps: number = 30): boolean {
  const scope = stroke.temporalScope
  if (!scope || scope.type === 'global') return true

  if (scope.type === 'span') {
    const start = scope.startTime ?? 0
    const dur = scope.duration ?? 0
    return time >= start && time <= start + dur
  }

  if (scope.type === 'frame') {
    const frameIndex = scope.frame ?? 0
    const hold = Math.max(1, scope.holdFrames ?? 1)
    const start = frameIndex / fps
    const end = (frameIndex + hold) / fps
    const frameDelta = 1 / (2 * fps)
    return time >= start - frameDelta && time < end - frameDelta
  }

  return true
}

/**
 * Renders onion skin ghost cels of previous and next animation frames.
 */
export function renderOnionSkin(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  currentFrame: number,
  fps: number,
  settings: OnionSkinSettings,
) {
  if (!settings.enabled || strokes.length === 0) return

  // Render prior frames (e.g. currentFrame - 1, currentFrame - 2)
  for (let delta = settings.beforeFrames; delta >= 1; delta--) {
    const targetFrame = currentFrame - delta
    if (targetFrame < 0) continue

    const priorStrokes = strokes.filter((s) => {
      const sc = s.temporalScope
      if (!sc || sc.type !== 'frame') return false
      const f = sc.frame ?? 0
      const hold = Math.max(1, sc.holdFrames ?? 1)
      return targetFrame >= f && targetFrame < f + hold
    })

    if (priorStrokes.length === 0) continue

    ctx.save()
    ctx.globalAlpha = settings.opacity / delta
    for (const stroke of priorStrokes) {
      const ghostStroke: DrawingStroke = {
        ...stroke,
        color: settings.tintBefore || '#ef4444',
      }
      renderStroke(ctx, ghostStroke, width, height)
    }
    ctx.restore()
  }

  // Render future frames (e.g. currentFrame + 1, currentFrame + 2)
  for (let delta = 1; delta <= settings.afterFrames; delta++) {
    const targetFrame = currentFrame + delta

    const futureStrokes = strokes.filter((s) => {
      const sc = s.temporalScope
      if (!sc || sc.type !== 'frame') return false
      const f = sc.frame ?? 0
      const hold = Math.max(1, sc.holdFrames ?? 1)
      return targetFrame >= f && targetFrame < f + hold
    })

    if (futureStrokes.length === 0) continue

    ctx.save()
    ctx.globalAlpha = settings.opacity / delta
    for (const stroke of futureStrokes) {
      const ghostStroke: DrawingStroke = {
        ...stroke,
        color: settings.tintAfter || '#10b981',
      }
      renderStroke(ctx, ghostStroke, width, height)
    }
    ctx.restore()
  }
}

/**
 * Draws a single vector stroke or raster fill patch onto a target Canvas 2D rendering context.
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  width: number,
  height: number,
) {
  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? 1.0

  if (stroke.tool === 'fill' && stroke.maskDataUrl) {
    let img = imageCache.get(stroke.maskDataUrl)
    if (!img) {
      img = new Image()
      img.src = stroke.maskDataUrl
      imageCache.set(stroke.maskDataUrl, img)
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, width, height)
    } else {
      img.onload = () => {
        // Cached on load
      }
    }
    ctx.restore()
    return
  }

  const pts = stroke.points
  if (!pts || pts.length === 0) {
    ctx.restore()
    return
  }

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.fillStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (stroke.tool === 'brush' || stroke.tool === 'eraser') {
    if (pts.length === 1) {
      const p = pts[0]
      const r = ((stroke.size * (p.pressure ?? 0.5)) / 2) * (width / 1280)
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, Math.max(1, r), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    ctx.moveTo(pts[0].x * width, pts[0].y * height)

    for (let i = 1; i < pts.length - 1; i++) {
      const pCurrent = pts[i]
      const pNext = pts[i + 1]
      const midX = ((pCurrent.x + pNext.x) / 2) * width
      const midY = ((pCurrent.y + pNext.y) / 2) * height
      ctx.quadraticCurveTo(pCurrent.x * width, pCurrent.y * height, midX, midY)
    }

    const last = pts[pts.length - 1]
    ctx.lineTo(last.x * width, last.y * height)
    ctx.stroke()
  } else if (stroke.tool === 'line') {
    const start = pts[0]
    const end = pts[pts.length - 1]
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    ctx.moveTo(start.x * width, start.y * height)
    ctx.lineTo(end.x * width, end.y * height)
    ctx.stroke()
  } else if (stroke.tool === 'rectangle') {
    const start = pts[0]
    const end = pts[pts.length - 1]
    const x = Math.min(start.x, end.x) * width
    const y = Math.min(start.y, end.y) * height
    const w = Math.abs(end.x - start.x) * width
    const h = Math.abs(end.y - start.y) * height
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.strokeRect(x, y, w, h)
  } else if (stroke.tool === 'circle') {
    const start = pts[0]
    const end = pts[pts.length - 1]
    const cx = ((start.x + end.x) / 2) * width
    const cy = ((start.y + end.y) / 2) * height
    const rx = (Math.abs(end.x - start.x) / 2) * width
    const ry = (Math.abs(end.y - start.y) / 2) * height
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (stroke.tool === 'arrow') {
    const start = pts[0]
    const end = pts[pts.length - 1]
    const x1 = start.x * width
    const y1 = start.y * height
    const x2 = end.x * width
    const y2 = end.y * height
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const headLen = Math.max(12, stroke.size * 3 * (width / 1280))

    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
    )
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
    )
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Generates a PNG mask Data URL from an active selection.
 * Transparent/Black outside the selection, solid white inside (or inverted).
 */
export function createSelectionMask(
  selection: ActiveSelection,
  width: number,
  height: number,
): string {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  if (selection.inverted) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000000'
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
  }

  if (selection.type === 'rectangle') {
    const rx = Math.round(selection.bounds.x * canvas.width)
    const ry = Math.round(selection.bounds.y * canvas.height)
    const rw = Math.round(selection.bounds.width * canvas.width)
    const rh = Math.round(selection.bounds.height * canvas.height)
    ctx.fillRect(rx, ry, rw, rh)
  } else if (selection.type === 'ellipse') {
    const cx = (selection.bounds.x + selection.bounds.width / 2) * canvas.width
    const cy = (selection.bounds.y + selection.bounds.height / 2) * canvas.height
    const rx = Math.max(1, (selection.bounds.width / 2) * canvas.width)
    const ry = Math.max(1, (selection.bounds.height / 2) * canvas.height)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (selection.type === 'lasso' && selection.points && selection.points.length > 2) {
    ctx.beginPath()
    ctx.moveTo(selection.points[0].x * canvas.width, selection.points[0].y * canvas.height)
    for (let i = 1; i < selection.points.length; i++) {
      ctx.lineTo(selection.points[i].x * canvas.width, selection.points[i].y * canvas.height)
    }
    ctx.closePath()
    ctx.fill()
  } else {
    const rx = Math.round(selection.bounds.x * canvas.width)
    const ry = Math.round(selection.bounds.y * canvas.height)
    const rw = Math.round(selection.bounds.width * canvas.width)
    const rh = Math.round(selection.bounds.height * canvas.height)
    ctx.fillRect(rx, ry, rw, rh)
  }

  return canvas.toDataURL('image/png')
}

/**
 * Renders dual-phase marching ants along the perimeter of an active selection.
 */
export function renderSelectionMarchingAnts(
  ctx: CanvasRenderingContext2D,
  selection: ActiveSelection,
  width: number,
  height: number,
  timeMs: number,
) {
  ctx.save()
  ctx.lineWidth = 1.5
  const dashOffset = (timeMs / 40) % 8

  const drawBoundary = () => {
    ctx.beginPath()
    if (selection.type === 'rectangle') {
      const rx = selection.bounds.x * width
      const ry = selection.bounds.y * height
      const rw = selection.bounds.width * width
      const rh = selection.bounds.height * height
      ctx.rect(rx, ry, rw, rh)
    } else if (selection.type === 'ellipse') {
      const cx = (selection.bounds.x + selection.bounds.width / 2) * width
      const cy = (selection.bounds.y + selection.bounds.height / 2) * height
      const rx = Math.max(1, (selection.bounds.width / 2) * width)
      const ry = Math.max(1, (selection.bounds.height / 2) * height)
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    } else if (selection.type === 'lasso' && selection.points && selection.points.length > 1) {
      ctx.moveTo(selection.points[0].x * width, selection.points[0].y * height)
      for (let i = 1; i < selection.points.length; i++) {
        ctx.lineTo(selection.points[i].x * width, selection.points[i].y * height)
      }
      ctx.closePath()
    } else {
      const rx = selection.bounds.x * width
      const ry = selection.bounds.y * height
      const rw = selection.bounds.width * width
      const rh = selection.bounds.height * height
      ctx.rect(rx, ry, rw, rh)
    }
  }

  // Phase 1: Black dash
  ctx.strokeStyle = '#000000'
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = dashOffset
  drawBoundary()
  ctx.stroke()

  // Phase 2: White dash (offset by 4px)
  ctx.strokeStyle = '#ffffff'
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = (dashOffset + 4) % 8
  drawBoundary()
  ctx.stroke()

  ctx.restore()
}

/**
 * Composites all active paint layers and their visible strokes onto a canvas context.
 */
export function renderAllPaintLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  layers: PaintLayer[],
  time: number,
  fps: number = 30,
) {
  if (!strokes || strokes.length === 0) return

  // Render layer by layer
  for (const layer of layers) {
    if (!layer.visible) continue

    const layerStrokes = strokes.filter((s) => (s.layerId || 'default-paint-layer') === layer.id)
    if (layerStrokes.length === 0) continue

    // If layer has an active mask, render strokes to offscreen buffer first, then clip with mask
    if (layer.maskDataUrl) {
      const { canvas: offCanvas, ctx: offCtx } = getSharedOffscreen(width, height)
      if (offCanvas && offCtx) {
        for (const stroke of layerStrokes) {
          if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
          renderStroke(offCtx, stroke, width, height)
        }

        let maskImg = imageCache.get(layer.maskDataUrl)
        if (!maskImg) {
          maskImg = new Image()
          maskImg.src = layer.maskDataUrl
          imageCache.set(layer.maskDataUrl, maskImg)
        }

        if (maskImg.complete && maskImg.naturalWidth > 0) {
          offCtx.save()
          offCtx.globalCompositeOperation = 'destination-in'
          offCtx.drawImage(maskImg, 0, 0, width, height)
          offCtx.restore()
        }

        ctx.save()
        if (layer.blendMode) {
          ctx.globalCompositeOperation = layer.blendMode
        }
        if (typeof layer.opacity === 'number') {
          ctx.globalAlpha = layer.opacity
        }
        if (layer.blur && layer.blur > 0) {
          ctx.filter = `blur(${layer.blur}px)`
        }
        ctx.drawImage(offCanvas, 0, 0)
        ctx.restore()
        continue
      }
    }

    ctx.save()
    if (layer.blendMode) {
      ctx.globalCompositeOperation = layer.blendMode
    }
    if (typeof layer.opacity === 'number') {
      ctx.globalAlpha = layer.opacity
    }
    if (layer.blur && layer.blur > 0) {
      ctx.filter = `blur(${layer.blur}px)`
    }

    for (const stroke of layerStrokes) {
      if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
      renderStroke(ctx, stroke, width, height)
    }

    ctx.restore()
  }
}
