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
 * Krita-style ghost tinting: blends a stroke's original color toward the
 * onion-skin tint by `strength` (1 = full silhouette tint, 0 = original color).
 * Unparseable colors fall back to the tint when strength > 0.5.
 */
export function blendGhostColor(color: string, tint: string, strength: number): string {
  const s = Math.min(1, Math.max(0, strength))
  if (s >= 1) return tint
  const parse = (c: string): [number, number, number] | null => {
    const hex = c.trim()
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map((ch) => ch + ch).join('') : m[1]
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(hex)
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
    return null
  }
  const from = parse(color)
  const to = parse(tint)
  if (!from || !to) return s > 0.5 ? tint : color
  const mix = from.map((v, i) => Math.round(v + (to[i] - v) * s))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
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
        color: blendGhostColor(stroke.color, settings.tintBefore || '#ef4444', settings.tintStrength ?? 1),
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
        color: blendGhostColor(stroke.color, settings.tintAfter || '#10b981', settings.tintStrength ?? 1),
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
  // Radial / symmetry ruler (ibisPaint X): the same stroke repeated rotated
  // around a centre — sun rays, mandalas, kaleidoscopic skies.
  // Krita Multibrush mirror modes: reflect the stroke across centre axes
  // (X, Y, or both) — mirror-drawing sub-tool parity.
  const mx = !!stroke.mirrorX
  const my = !!stroke.mirrorY
  if (mx || my) {
    const variants: [number, number][] = [[1, 1]]
    if (mx) variants.push([-1, 1])
    if (my) variants.push([1, -1])
    if (mx && my) variants.push([-1, -1])
    for (const [sx, sy] of variants) {
      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(sx, sy)
      ctx.translate(-width / 2, -height / 2)
      renderStrokeCore(ctx, stroke, width, height)
      ctx.restore()
    }
    return
  }
  // Krita Multibrush Translate mode: constant ring offsets around the path —
  // every copy traces the same stroke shifted by (R·cosθ, R·sinθ).
  const trn = Math.floor(stroke.translateCopies || 0)
  if (trn >= 2) {
    const R = Math.max(2, stroke.translateRadius ?? 24)
    for (let i = 0; i < trn; i++) {
      const ang = (i * Math.PI * 2) / trn
      ctx.save()
      ctx.translate(Math.cos(ang) * R, Math.sin(ang) * R)
      renderStrokeCore(ctx, stroke, width, height)
      ctx.restore()
    }
    return
  }
  const n = Math.max(1, Math.floor(stroke.radialCopies || 1))
  if (n > 1) {
    const [cx, cy] = [
      (stroke.radialCenter?.[0] ?? 0.5) * width,
      (stroke.radialCenter?.[1] ?? 0.5) * height,
    ]
    for (let i = 0; i < n; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((i * Math.PI * 2) / n)
      ctx.translate(-cx, -cy)
      renderStrokeCore(ctx, stroke, width, height)
      ctx.restore()
    }
    return
  }
  renderStrokeCore(ctx, stroke, width, height)
}

const FREEHAND_TOOLS = new Set(['brush', 'pencil', 'marker', 'calligraphy', 'eraser', 'smudge'])

/** Krita Freehand Brush smoothing/stabilizer: weighted moving-average pass over
 *  the sampled points (shake correction). 0 = raw tablet input. */
function smoothedPoints(stroke: DrawingStroke): DrawingStroke['points'] | null {
  const s = Math.min(1, Math.max(0, stroke.smoothing ?? 0))
  if (s <= 0.01 || !FREEHAND_TOOLS.has(stroke.tool) || stroke.points.length < 3) return null
  let pts = stroke.points.map((p) => ({ ...p }))
  const passes = 2
  const k = 0.5 * s
  for (let pass = 0; pass < passes; pass++) {
    const src = pts
    pts = src.map((p, i) => {
      if (i === 0 || i === src.length - 1) return p
      const a = src[i - 1], b = src[i + 1]
      return { ...p, x: p.x * (1 - k) + ((a.x + b.x) / 2) * k, y: p.y * (1 - k) + ((a.y + b.y) / 2) * k }
    })
  }
  return pts
}

function renderStrokeCore(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  width: number,
  height: number,
) {
  const sm = smoothedPoints(stroke)
  if (sm) stroke = { ...stroke, points: sm }
  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? 1.0

  if (stroke.tool === 'smudge') {
    // ibisPaint smudge/blur brush: drag what is already on the canvas along
    // the stroke path (blurred re-stamp of the pixels under the previous point)
    const r = Math.max(2, stroke.size / 2)
    const pts = stroke.points
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i]
      const sx = p0.x * width
      const sy = p0.y * height
      const dx = p1.x * width
      const dy = p1.y * height
      const snap = ctx.getImageData(Math.max(0, Math.round(sx - r)), Math.max(0, Math.round(sy - r)), Math.ceil(r * 2), Math.ceil(r * 2))
      const tmp = document.createElement('canvas')
      tmp.width = snap.width; tmp.height = snap.height
      tmp.getContext('2d')!.putImageData(snap, 0, 0)
      ctx.save()
      ctx.globalAlpha = (stroke.opacity ?? 1) * 0.55
      ctx.filter = `blur(${Math.max(1, r * 0.35)}px)`
      ctx.beginPath()
      ctx.arc(dx, dy, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(tmp, dx - r, dy - r)
      ctx.restore()
      ctx.filter = 'none'
    }
    ctx.restore()
    return
  }
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
  } else if (stroke.tool === 'pencil') {
    ctx.imageSmoothingEnabled = false
    ctx.lineCap = 'square'
    ctx.lineJoin = 'miter'
    ctx.lineWidth = Math.max(1, Math.round(stroke.size * (width / 1280) * 0.4))
    ctx.beginPath()
    ctx.moveTo(pts[0].x * width, pts[0].y * height)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * width, pts[i].y * height)
    }
    ctx.stroke()
  } else if (stroke.tool === 'marker') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = Math.min(1.0, 0.45 * (stroke.opacity ?? 1.0))
    ctx.lineCap = 'square'
    ctx.lineJoin = 'bevel'
    ctx.lineWidth = Math.max(8, stroke.size * 2 * (width / 1280))
    ctx.beginPath()
    ctx.moveTo(pts[0].x * width, pts[0].y * height)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * width, pts[i].y * height)
    }
    ctx.stroke()
  } else if (stroke.tool === 'calligraphy') {
    const angleRad = Math.PI / 4 // 45 degrees
    const baseWidth = Math.max(2, stroke.size * (width / 1280))
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const cx = p.x * width
      const cy = p.y * height
      ctx.beginPath()
      ctx.ellipse(cx, cy, baseWidth, baseWidth * 0.25, angleRad, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (stroke.tool === 'star') {
    const start = pts[0]
    const end = pts[pts.length - 1]
    const cx = ((start.x + end.x) / 2) * width
    const cy = ((start.y + end.y) / 2) * height
    const rOuter = (Math.abs(end.x - start.x) / 2) * width
    const rInner = rOuter * 0.45
    const spikes = 5
    let rot = (Math.PI / 2) * 3
    const step = Math.PI / spikes

    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    ctx.moveTo(cx, cy - rOuter)
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * rOuter
      let y = cy + Math.sin(rot) * rOuter
      ctx.lineTo(x, y)
      rot += step

      x = cx + Math.cos(rot) * rInner
      y = cy + Math.sin(rot) * rInner
      ctx.lineTo(x, y)
      rot += step
    }
    ctx.lineTo(cx, cy - rOuter)
    ctx.closePath()
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
    if (stroke.filled) ctx.fill()
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
  } else if (stroke.tool === 'polygon') {
    // Krita Polygon Tool: regular N-gon inscribed in the drag bounding box.
    const start = pts[0]
    const end = pts[pts.length - 1]
    const cx = ((start.x + end.x) / 2) * width
    const cy = ((start.y + end.y) / 2) * height
    const rx = (Math.abs(end.x - start.x) / 2) * width
    const ry = (Math.abs(end.y - start.y) / 2) * height
    const sides = Math.max(3, Math.min(12, stroke.polygonSides ?? 5))
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * Math.PI * 2
      const px = cx + Math.cos(a) * rx
      const py = cy + Math.sin(a) * ry
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    if (stroke.filled) {
      ctx.fillStyle = stroke.color
      ctx.globalAlpha = stroke.opacity
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.stroke()
  } else if (stroke.tool === 'polyline') {
    // Krita Polyline Tool: straight segments through every recorded vertex.
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0].x * width, pts[0].y * height)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * width, pts[i].y * height)
    ctx.stroke()
  } else if (stroke.tool === 'bezier') {
    // Krita Bezier Curve / Freehand Path Tool: Catmull-Rom spline converted to
    // cubic beziers so the curve passes through every sampled point.
    ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (pts.length < 3) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x * width, pts[0].y * height)
      ctx.lineTo(pts[pts.length - 1].x * width, pts[pts.length - 1].y * height)
      ctx.stroke()
    } else {
      const cl = (i: number) => Math.max(0, Math.min(pts.length - 1, i))
      const X = (i: number) => pts[cl(i)].x * width
      const Y = (i: number) => pts[cl(i)].y * height
      ctx.beginPath()
      ctx.moveTo(X(0), Y(0))
      for (let i = 0; i < pts.length - 1; i++) {
        const x0 = X(i - 1), y0 = Y(i - 1)
        const x1 = X(i), y1 = Y(i)
        const x2 = X(i + 1), y2 = Y(i + 1)
        const x3 = X(i + 2), y3 = Y(i + 2)
        const t = 6
        ctx.bezierCurveTo(
          x1 + (x2 - x0) / t, y1 + (y2 - y0) / t,
          x2 - (x3 - x1) / t, y2 - (y3 - y1) / t,
          x2, y2,
        )
      }
      ctx.stroke()
    }
  } else if (stroke.tool === 'gradient') {
    // Krita Gradient Tool: linear ramp between the stroke colour and the
    // secondary colour across the drag vector.
    const gStart = pts[0]
    const gEnd = pts[pts.length - 1]
    const grad = stroke.gradientShape === 'radial'
      ? ctx.createRadialGradient(
          gStart.x * width, gStart.y * height, 0,
          gStart.x * width, gStart.y * height,
          Math.max(4, Math.hypot((gEnd.x - gStart.x) * width, (gEnd.y - gStart.y) * height)),
        )
      : ctx.createLinearGradient(
          gStart.x * width, gStart.y * height,
          gEnd.x * width, gEnd.y * height,
        )
    const gc = stroke.gradientColor || 'rgba(0,0,0,0)'
    const rep = stroke.gradientRepeat ?? 'none'
    if (rep === 'none') {
      grad.addColorStop(0, stroke.color)
      grad.addColorStop(1, gc)
    } else {
      // Krita Gradient repeat: Forward = saw (hard jump each cycle),
      // Alternating = triangle (mirrored cycle).
      const cycles = 3
      for (let ci = 0; ci < cycles; ci++) {
        const a0 = ci / cycles
        const a1 = (ci + 1) / cycles
        const fwd = rep === 'forward' ? true : ci % 2 === 0
        grad.addColorStop(a0, fwd ? stroke.color : gc)
        grad.addColorStop(Math.min(1, Math.max(0, a1 - 0.0001)), fwd ? gc : stroke.color)
      }
    }
    ctx.save()
    ctx.globalAlpha = stroke.opacity
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  } else if (stroke.tool === 'clone' || stroke.tool === 'smart-patch') {
    if (stroke.cloneSource?.sampleDataUrl) {
      let img = imageCache.get(stroke.cloneSource.sampleDataUrl)
      if (!img) {
        img = new Image()
        img.src = stroke.cloneSource.sampleDataUrl
        imageCache.set(stroke.cloneSource.sampleDataUrl, img)
      }
      if (img.complete && img.naturalWidth > 0) {
        const radius = Math.max(2, (stroke.size * (width / 1280)) / 2)
        const offsetX = (pts[0].x - stroke.cloneSource.x) * width
        const offsetY = (pts[0].y - stroke.cloneSource.y) * height

        ctx.save()
        // Clip to the stamp brush path
        ctx.beginPath()
        for (const p of pts) {
          ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2)
        }
        ctx.clip()

        // Draw the sampled canvas offset by clone displacement
        ctx.drawImage(img, offsetX, offsetY, width, height)
        ctx.restore()
      }
    } else {
      // Fallback: render crisp pattern
      ctx.lineWidth = Math.max(1, stroke.size * (width / 1280))
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(pts[0].x * width, pts[0].y * height)
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * width, pts[i].y * height)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
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

  if (selection.feather && selection.feather > 0) {
    ctx.filter = `blur(${Math.min(32, selection.feather)}px)`
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
  } else if ((selection.type === 'lasso' || selection.type === 'polygon' || selection.type === 'brush') && selection.points && selection.points.length > 1) {
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
 * Renders dual-phase marching ants along the perimeter of an active selection,
 * and optional non-destructive mask preview / colorization fill.
 */
export function renderSelectionMarchingAnts(
  ctx: CanvasRenderingContext2D,
  selection: ActiveSelection,
  width: number,
  height: number,
  timeMs: number,
) {
  ctx.save()

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
    } else if (
      (selection.type === 'lasso' || selection.type === 'polygon' || selection.type === 'brush') &&
      selection.points &&
      selection.points.length > 1
    ) {
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

  // Non-destructive Mask Visualization Mode (LumaCut / Photoshop Quick Mask)
  if (selection.showMaskOnly || selection.maskDisplayMode === 'matte') {
    ctx.save()
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    drawBoundary()
    ctx.fill()
    ctx.restore()
  } else if (selection.maskDisplayMode === 'rubylith') {
    ctx.save()
    ctx.fillStyle = 'rgba(239, 68, 68, 0.42)'
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'destination-out'
    drawBoundary()
    ctx.fill()
    ctx.restore()
  }

  // Live Recolor / Tint Preview if fillColor is set
  if (selection.fillColor) {
    ctx.save()
    ctx.fillStyle = selection.fillColor.length === 7 ? selection.fillColor + '99' : selection.fillColor
    drawBoundary()
    ctx.fill()
    ctx.restore()
  }

  // Marching Ants Boundary Strokes
  ctx.lineWidth = 1.5
  const dashOffset = (timeMs / 40) % 8

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

/** Resolve a Smart Patch's frame-addressed raster and composite it at the requested time. */
function renderStrokeAtTime(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  width: number,
  height: number,
  time: number,
  fps: number,
) {
  if (!isStrokeVisibleAtTime(stroke, time, fps)) return
  if (stroke.tool === 'smart-patch') {
    const frame = (stroke.smartPatchFrames || []).reduce<{ time: number; dataUrl: string } | null>(
      (current, candidate) => (candidate.time <= time + 0.5 / fps ? candidate : current),
      null,
    )
    if (!frame) return
    renderStroke(ctx, { ...stroke, tool: 'fill', maskDataUrl: frame.dataUrl }, width, height)
    return
  }
  renderStroke(ctx, stroke, width, height)
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

    // A stroke belongs to the mask pass only when its mask id is the mask that
    // is actually mounted on this layer. Any other maskId -- a clip-mask id, or
    // one left behind by a mask that has since been removed -- must fall back to
    // the layer base, otherwise the stroke is excluded from both passes and is
    // rendered nowhere: it exists in the store but is invisible on canvas.
    const mountedMaskId = layer.transparencyMask?.id
    const maskStrokes = layerStrokes.filter(
      (s) => s.maskId && mountedMaskId && s.maskId === mountedMaskId,
    )
    const baseStrokes = layerStrokes.filter((s) => !maskStrokes.includes(s))

    // Krita-Style Transparency Mask: Non-destructive luminance-to-alpha masking
    if (
      layer.transparencyMask &&
      layer.transparencyMask.enabled &&
      (maskStrokes.length > 0 || layer.transparencyMask.dataUrl)
    ) {
      if (typeof document !== 'undefined') {
        const layerCanvas = document.createElement('canvas')
        layerCanvas.width = width
        layerCanvas.height = height
        const layerCtx = layerCanvas.getContext('2d')

        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = width
        maskCanvas.height = height
        const maskCtx = maskCanvas.getContext('2d')

        if (layerCtx && maskCtx) {
          // 1. Render layer base strokes
          for (const stroke of baseStrokes) {
            if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
            renderStrokeAtTime(layerCtx, stroke, width, height, time, fps)
          }

          // 2. Render mask canvas: Default filled with solid white (100% opaque / visible in Krita)
          maskCtx.fillStyle = '#ffffff'
          maskCtx.fillRect(0, 0, width, height)

          for (const stroke of maskStrokes) {
            if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
            // In Krita, using the eraser on a transparency mask restores opacity by painting white
            if (stroke.tool === 'eraser') {
              const whiteStroke = { ...stroke, tool: 'brush' as const, color: '#ffffff' }
              renderStrokeAtTime(maskCtx, whiteStroke, width, height, time, fps)
            } else {
              renderStrokeAtTime(maskCtx, stroke, width, height, time, fps)
            }
          }

          // 3. Pixel-level non-destructive luminance multiplication
          const lImgData = layerCtx.getImageData(0, 0, width, height)
          const mImgData = maskCtx.getImageData(0, 0, width, height)
          const lData = lImgData.data
          const mData = mImgData.data
          const inverted = layer.transparencyMask.inverted
          const maskStrength = layer.transparencyMask.opacity ?? 1
          const len = lData.length

          for (let i = 0; i < len; i += 4) {
            if (lData[i + 3] === 0) continue
            // Standard perceptual luminance: 0.299*R + 0.587*G + 0.114*B
            let lum = (0.299 * mData[i] + 0.587 * mData[i + 1] + 0.114 * mData[i + 2]) / 255.0
            if (inverted) lum = 1.0 - lum
            if (maskStrength < 1.0) {
              lum = 1.0 - (1.0 - lum) * maskStrength
            }
            lData[i + 3] = Math.round(lData[i + 3] * Math.max(0, Math.min(1, lum)))
          }
          layerCtx.putImageData(lImgData, 0, 0)

          // A raster selection/AI matte can coexist with a painted transparency
          // mask. Apply its PNG alpha after the child-mask luminance pass so
          // converting an external matte does not get silently ignored.
          if (layer.maskDataUrl) {
            let rasterMask = imageCache.get(layer.maskDataUrl)
            if (!rasterMask) {
              rasterMask = new Image()
              rasterMask.src = layer.maskDataUrl
              imageCache.set(layer.maskDataUrl, rasterMask)
            }
            if (rasterMask.complete && rasterMask.naturalWidth > 0) {
              layerCtx.save()
              layerCtx.globalCompositeOperation = 'destination-in'
              layerCtx.drawImage(rasterMask, 0, 0, width, height)
              layerCtx.restore()
            }
          }

          // 4. Composite masked layer result
          ctx.save()
          if (layer.blendMode) ctx.globalCompositeOperation = layer.blendMode
          if (typeof layer.opacity === 'number') ctx.globalAlpha = layer.opacity
          if (layer.blur && layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`
          ctx.drawImage(layerCanvas, 0, 0)
          ctx.restore()
          continue
        }
      }
    }

    // If layer has an active legacy raster mask, render strokes to offscreen buffer first, then clip with mask
    if (layer.maskDataUrl) {
      const { canvas: offCanvas, ctx: offCtx } = getSharedOffscreen(width, height)
      if (offCanvas && offCtx) {
        for (const stroke of baseStrokes) {
          if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
          renderStrokeAtTime(offCtx, stroke, width, height, time, fps)
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

    for (const stroke of baseStrokes) {
      if (!isStrokeVisibleAtTime(stroke, time, fps)) continue
      renderStrokeAtTime(ctx, stroke, width, height, time, fps)
    }

    ctx.restore()
  }
}
