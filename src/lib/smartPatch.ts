export interface SmartPatchTarget {
  points: { x: number; y: number }[]
  /** Full-canvas alpha mask from an active selection, when available. */
  maskDataUrl?: string
  bounds?: { x: number; y: number; width: number; height: number }
  shape?: 'rectangle' | 'ellipse'
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the Smart Patch source image'))
    image.src = url
  })
}

/**
 * Clone a user-selected donor point onto a painted, clicked, or masked target.
 * The returned PNG is transparent outside the target so it can live on a
 * normal Drawing paint layer and render/export with the rest of the timeline.
 */
export async function buildSmartPatchFrame(opts: {
  source: CanvasImageSource
  width: number
  height: number
  sourcePoint: { x: number; y: number }
  target: SmartPatchTarget
  brushRadius: number
  feather: number
}): Promise<string> {
  const { source, width, height, sourcePoint, target, brushRadius, feather } = opts
  const points = target.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (!points.length || width < 1 || height < 1) throw new Error('Smart Patch needs a target point')

  const donor = document.createElement('canvas')
  donor.width = width
  donor.height = height
  const donorCtx = donor.getContext('2d')
  if (!donorCtx) throw new Error('2D canvas is unavailable')
  donorCtx.drawImage(source, 0, 0, width, height)

  const targetMask = document.createElement('canvas')
  targetMask.width = width
  targetMask.height = height
  const maskCtx = targetMask.getContext('2d')
  if (!maskCtx) throw new Error('2D canvas is unavailable')
  maskCtx.clearRect(0, 0, width, height)

  if (target.maskDataUrl) {
    const maskImage = await loadImage(target.maskDataUrl)
    maskCtx.drawImage(maskImage, 0, 0, width, height)
  } else if (target.bounds) {
    const { x, y, width: boxWidth, height: boxHeight } = target.bounds
    maskCtx.fillStyle = '#fff'
    if (target.shape === 'ellipse') {
      maskCtx.beginPath()
      maskCtx.ellipse(
        (x + boxWidth / 2) * width,
        (y + boxHeight / 2) * height,
        Math.max(1, (boxWidth * width) / 2),
        Math.max(1, (boxHeight * height) / 2),
        0,
        0,
        Math.PI * 2,
      )
      maskCtx.fill()
    } else {
      maskCtx.fillRect(x * width, y * height, boxWidth * width, boxHeight * height)
    }
  } else {
    const radius = Math.max(2, (brushRadius * width) / 1280)
    maskCtx.strokeStyle = '#fff'
    maskCtx.fillStyle = '#fff'
    maskCtx.lineCap = 'round'
    maskCtx.lineJoin = 'round'
    maskCtx.lineWidth = radius * 2
    if (points.length === 1) {
      maskCtx.beginPath()
      maskCtx.arc(points[0].x * width, points[0].y * height, radius, 0, Math.PI * 2)
      maskCtx.fill()
    } else {
      maskCtx.beginPath()
      maskCtx.moveTo(points[0].x * width, points[0].y * height)
      for (const point of points.slice(1)) maskCtx.lineTo(point.x * width, point.y * height)
      maskCtx.stroke()
      for (const point of points) {
        maskCtx.beginPath()
        maskCtx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2)
        maskCtx.fill()
      }
    }
  }

  const softMask = document.createElement('canvas')
  softMask.width = width
  softMask.height = height
  const softCtx = softMask.getContext('2d')
  if (!softCtx) throw new Error('2D canvas is unavailable')
  const featherPx = Math.max(0, Math.min(36, (feather * width) / 1280))
  if (featherPx > 0) softCtx.filter = `blur(${featherPx}px)`
  softCtx.drawImage(targetMask, 0, 0)

  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const outCtx = output.getContext('2d')
  if (!outCtx) throw new Error('2D canvas is unavailable')
  const firstTarget = points[0]
  const dx = (firstTarget.x - sourcePoint.x) * width
  const dy = (firstTarget.y - sourcePoint.y) * height
  outCtx.drawImage(donor, dx, dy)
  outCtx.globalCompositeOperation = 'destination-in'
  outCtx.drawImage(softMask, 0, 0)
  outCtx.globalCompositeOperation = 'source-over'
  return output.toDataURL('image/png')
}

export async function buildSmartPatchFrameFromUrl(opts: {
  sourceUrl: string
  width: number
  height: number
  sourcePoint: { x: number; y: number }
  target: SmartPatchTarget
  brushRadius: number
  feather: number
}): Promise<string> {
  const source = await loadImage(opts.sourceUrl)
  return buildSmartPatchFrame({ ...opts, source })
}
