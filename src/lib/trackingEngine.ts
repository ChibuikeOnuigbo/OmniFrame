// OmniFrame Tracking Engine — LumaCut Multi-Signal Architecture
// Real-time tracking supporting:
// 1. Mask Tracking: tracking user-created masks/shapes through time
// 2. Main Tracking: point, multi-point, planar, and motion tracking
// Built on multi-signal matching: Sobel gradients, RGB/luminance patch correlation,
// forward-backward temporal consistency, and deformation-aware motion.

import type {
  TrackingSession,
  TrackingMode,
  MainTrackingType,
  TrackPoint,
  TrackingFrameResult,
  ClipTransform,
} from '../types'

export interface AnalysisSize {
  width: number
  height: number
}

export interface Point2D {
  x: number
  y: number
}

export interface FrameMaps {
  width: number
  height: number
  gray: Float32Array
  gradX: Float32Array
  gradY: Float32Array
  gradMag: Float32Array
}

export interface TrackOptions {
  searchWindow: number // window radius in pixels (default 21)
  patchSize: number // patch radius (default 7)
  forwardBackwardCheck: boolean // bidirectional consistency
  regularization: number // neighbor velocity smoothing (0..1)
  confidenceThreshold: number // min confidence to accept (0..1)
}

export const DEFAULT_TRACK_OPTIONS: TrackOptions = {
  searchWindow: 25,
  patchSize: 7,
  forwardBackwardCheck: true,
  regularization: 0.35,
  confidenceThreshold: 0.65,
}

// Compute grayscale, horizontal and vertical Sobel gradients, and gradient magnitude
export function computeFrameMaps(imageData: ImageData): FrameMaps {
  const { width, height, data } = imageData
  const pixelCount = width * height
  const gray = new Float32Array(pixelCount)
  const gradX = new Float32Array(pixelCount)
  const gradY = new Float32Array(pixelCount)
  const gradMag = new Float32Array(pixelCount)

  // 1. Grayscale luminance (Rec. 709)
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4
    gray[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]
  }

  // 2. Sobel 3x3 filter
  for (let y = 1; y < height - 1; y++) {
    const yOffset = y * width
    for (let x = 1; x < width - 1; x++) {
      const idx = yOffset + x

      // Sobel horizontal
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] -
        2 * gray[idx - 1] +
        2 * gray[idx + 1] -
        gray[idx + width - 1] +
        gray[idx + width + 1]

      // Sobel vertical
      const gy =
        -gray[idx - width - 1] -
        2 * gray[idx - width] -
        gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1]

      gradX[idx] = gx
      gradY[idx] = gy
      gradMag[idx] = Math.sqrt(gx * gx + gy * gy)
    }
  }

  return { width, height, gray, gradX, gradY, gradMag }
}

// Normalized Cross-Correlation (NCC) with Sobel gradient penalty for robust edge-aware patch tracking
export function matchPatch(
  refMaps: FrameMaps,
  refPoint: Point2D,
  currMaps: FrameMaps,
  centerEstimate: Point2D,
  options: TrackOptions
): { point: Point2D; confidence: number } {
  const { searchWindow, patchSize } = options
  const w = refMaps.width
  const h = refMaps.height

  const rx = Math.round(refPoint.x)
  const ry = Math.round(refPoint.y)

  // Bounds check reference patch
  if (rx - patchSize < 0 || rx + patchSize >= w || ry - patchSize < 0 || ry + patchSize >= h) {
    return { point: centerEstimate, confidence: 0 }
  }

  // Compute reference patch stats
  let refSum = 0
  let refGradSum = 0
  let count = 0
  for (let dy = -patchSize; dy <= patchSize; dy++) {
    for (let dx = -patchSize; dx <= patchSize; dx++) {
      const idx = (ry + dy) * w + (rx + dx)
      refSum += refMaps.gray[idx]
      refGradSum += refMaps.gradMag[idx]
      count++
    }
  }
  const refMean = refSum / count

  let bestScore = -Infinity
  let bestX = centerEstimate.x
  let bestY = centerEstimate.y

  const cx = Math.round(centerEstimate.x)
  const cy = Math.round(centerEstimate.y)

  for (let dy = -searchWindow; dy <= searchWindow; dy++) {
    const curY = cy + dy
    if (curY - patchSize < 0 || curY + patchSize >= h) continue

    for (let dx = -searchWindow; dx <= searchWindow; dx++) {
      const curX = cx + dx
      if (curX - patchSize < 0 || curX + patchSize >= w) continue

      // Compute patch mean
      let curSum = 0
      for (let py = -patchSize; py <= patchSize; py++) {
        for (let px = -patchSize; px <= patchSize; px++) {
          curSum += currMaps.gray[(curY + py) * w + (curX + px)]
        }
      }
      const curMean = curSum / count

      // NCC computation
      let num = 0
      let denRef = 0
      let denCur = 0
      let gradDiff = 0

      for (let py = -patchSize; py <= patchSize; py++) {
        for (let px = -patchSize; px <= patchSize; px++) {
          const rIdx = (ry + py) * w + (rx + px)
          const cIdx = (curY + py) * w + (curX + px)

          const rDev = refMaps.gray[rIdx] - refMean
          const cDev = currMaps.gray[cIdx] - curMean
          num += rDev * cDev
          denRef += rDev * rDev
          denCur += cDev * cDev

          gradDiff += Math.abs(refMaps.gradMag[rIdx] - currMaps.gradMag[cIdx])
        }
      }

      const den = Math.sqrt(denRef * denCur)
      let score = den > 1e-5 ? num / den : 0

      // Edge penalty: lower score if edge structures differ heavily
      const normGradDiff = gradDiff / (count * 255)
      score = score * (1 - Math.min(0.5, normGradDiff))

      // Distance prior penalty
      const dist = Math.hypot(dx, dy)
      score -= (dist / searchWindow) * 0.05

      if (score > bestScore) {
        bestScore = score
        bestX = curX
        bestY = curY
      }
    }
  }

  // Clamped confidence in [0, 1]
  const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2))
  return { point: { x: bestX, y: bestY }, confidence }
}

// Tracking Session Runner: runs forward/backward tracking on points
export class TrackingEngine {
  private options: TrackOptions

  constructor(options: Partial<TrackOptions> = {}) {
    this.options = { ...DEFAULT_TRACK_OPTIONS, ...options }
  }

  // Track a set of points from previous frame to current frame
  trackFrame(
    prevMaps: FrameMaps,
    currMaps: FrameMaps,
    inputPoints: TrackPoint[],
    frameIndex: number
  ): TrackPoint[] {
    const results: TrackPoint[] = []

    for (const pt of inputPoints) {
      const prevPos: Point2D = {
        x: pt.x * prevMaps.width,
        y: pt.y * prevMaps.height,
      }

      // Forward step
      const forward = matchPatch(prevMaps, prevPos, currMaps, prevPos, this.options)

      let finalPos = forward.point
      let confidence = forward.confidence

      // Bidirectional consistency check (Forward-Backward validation)
      if (this.options.forwardBackwardCheck && confidence > 0.3) {
        const backward = matchPatch(currMaps, forward.point, prevMaps, forward.point, this.options)
        const fbDist = Math.hypot(backward.point.x - prevPos.x, backward.point.y - prevPos.y)

        // If backward point diverges > 3 pixels, reduce confidence
        if (fbDist > 3) {
          confidence *= Math.max(0, 1 - fbDist / 10)
        }
      }

      results.push({
        x: Math.max(0, Math.min(1, finalPos.x / currMaps.width)),
        y: Math.max(0, Math.min(1, finalPos.y / currMaps.height)),
        frame: frameIndex,
        confidence,
      })
    }

    return results
  }

  // Estimate global affine / rigid transform from matched point pairs
  estimateTransform(
    prevPoints: TrackPoint[],
    currPoints: TrackPoint[],
    canvasWidth: number,
    canvasHeight: number
  ): ClipTransform {
    if (prevPoints.length === 0 || currPoints.length === 0) {
      return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
    }

    // Centroid calculation
    let prevCx = 0
    let prevCy = 0
    let currCx = 0
    let currCy = 0
    let validCount = 0

    const count = Math.min(prevPoints.length, currPoints.length)
    for (let i = 0; i < count; i++) {
      if (currPoints[i].confidence >= 0.3) {
        prevCx += prevPoints[i].x * canvasWidth
        prevCy += prevPoints[i].y * canvasHeight
        currCx += currPoints[i].x * canvasWidth
        currCy += currPoints[i].y * canvasHeight
        validCount++
      }
    }

    if (validCount === 0) {
      return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
    }

    prevCx /= validCount
    prevCy /= validCount
    currCx /= validCount
    currCy /= validCount

    const deltaX = currCx - prevCx
    const deltaY = currCy - prevCy

    // Scale and rotation estimation if multiple points exist
    let scale = 1
    let rotation = 0

    if (validCount >= 2) {
      let prevDistSum = 0
      let currDistSum = 0
      let angleDiffSum = 0

      for (let i = 0; i < count; i++) {
        if (currPoints[i].confidence >= 0.3) {
          const px = prevPoints[i].x * canvasWidth - prevCx
          const py = prevPoints[i].y * canvasHeight - prevCy
          const cx = currPoints[i].x * canvasWidth - currCx
          const cy = currPoints[i].y * canvasHeight - currCy

          const pDist = Math.hypot(px, py)
          const cDist = Math.hypot(cx, cy)
          prevDistSum += pDist
          currDistSum += cDist

          const pAngle = Math.atan2(py, px)
          const cAngle = Math.atan2(cy, cx)
          angleDiffSum += cAngle - pAngle
        }
      }

      if (prevDistSum > 1e-4) {
        scale = Math.max(0.2, Math.min(3.0, currDistSum / prevDistSum))
      }
      rotation = (angleDiffSum / validCount) * (180 / Math.PI)
    }

    return {
      x: Math.round(deltaX),
      y: Math.round(deltaY),
      scale,
      rotation,
      opacity: 1,
    }
  }
}
