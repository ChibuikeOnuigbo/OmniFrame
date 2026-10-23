import type { RigPin, RigSway } from '../types'
import { deformPuppetPoint } from './rigging'

export interface PuppetWarpTarget {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Rasterize one Puppet-warped cutout into the target rectangle.
 *
 * The same mesh routine drives the Rigging preview and sequence renderer, so
 * pins/sway have consistent phase and geometry in preview and canvas export.
 * `dpr` is the target canvas' device-pixel ratio (1 for offscreen sequence
 * buffers).
 */
export function drawPuppetWarp(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  pins: RigPin[],
  sway: RigSway | undefined,
  time: number,
  seed: number,
  target: PuppetWarpTarget,
  dpr = 1,
): void {
  if (imageWidth <= 0 || imageHeight <= 0 || target.width <= 0 || target.height <= 0) return

  const columns = Math.max(4, Math.min(20, Math.ceil(imageWidth / 32)))
  const rows = Math.max(4, Math.min(28, Math.ceil(imageHeight / 32)))
  const vertices = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: columns + 1 }, (_, column) => {
      const x = (imageWidth * column) / columns
      const y = (imageHeight * row) / rows
      const warped = deformPuppetPoint(x, y, imageWidth, imageHeight, pins, sway, time, seed)
      return {
        source: { x, y },
        target: {
          x: target.x + warped.x * (target.width / imageWidth),
          y: target.y + warped.y * (target.height / imageHeight),
        },
      }
    }),
  )

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const tl = vertices[row][column]
      const tr = vertices[row][column + 1]
      const bl = vertices[row + 1][column]
      const br = vertices[row + 1][column + 1]
      drawTriangle(context, image, [tl.source, tr.source, bl.source], [tl.target, tr.target, bl.target], dpr)
      drawTriangle(context, image, [tr.source, br.source, bl.source], [tr.target, br.target, bl.target], dpr)
    }
  }
}

function drawTriangle(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: Array<{ x: number; y: number }>,
  target: Array<{ x: number; y: number }>,
  dpr: number,
): void {
  const [p0, p1, p2] = source
  const [q0, q1, q2] = target
  const denominator = p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y)
  if (Math.abs(denominator) < 1e-8) return

  const a = (q0.x * (p1.y - p2.y) + q1.x * (p2.y - p0.y) + q2.x * (p0.y - p1.y)) / denominator
  const c = (q0.x * (p2.x - p1.x) + q1.x * (p0.x - p2.x) + q2.x * (p1.x - p0.x)) / denominator
  const e = (q0.x * (p1.x * p2.y - p2.x * p1.y) + q1.x * (p2.x * p0.y - p0.x * p2.y) + q2.x * (p0.x * p1.y - p1.x * p0.y)) / denominator
  const b = (q0.y * (p1.y - p2.y) + q1.y * (p2.y - p0.y) + q2.y * (p0.y - p1.y)) / denominator
  const d = (q0.y * (p2.x - p1.x) + q1.y * (p0.x - p2.x) + q2.y * (p1.x - p0.x)) / denominator
  const f = (q0.y * (p1.x * p2.y - p2.x * p1.y) + q1.y * (p2.x * p0.y - p0.x * p2.y) + q2.y * (p0.x * p1.y - p1.x * p0.y)) / denominator

  context.save()
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.beginPath()
  context.moveTo(q0.x, q0.y)
  context.lineTo(q1.x, q1.y)
  context.lineTo(q2.x, q2.y)
  context.closePath()
  context.clip()
  context.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr)
  context.drawImage(image, 0, 0)
  context.restore()
}
