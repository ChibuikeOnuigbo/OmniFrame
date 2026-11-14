import type { ClipAdjustmentMask, ClipEffectMaskRegion } from '../types'

export const DEFAULT_EFFECT_MASK_REGION: ClipEffectMaskRegion = {
  id: 'effect-mask-1',
  shape: 'ellipse',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.35,
  height: 0.35,
  rotation: 0,
  feather: 24,
  opacity: 1,
}

export const DEFAULT_EFFECT_MASK: ClipAdjustmentMask = {
  shape: 'ellipse',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.35,
  height: 0.35,
  feather: 24,
  inverted: false,
  enabled: true,
  regions: [{ ...DEFAULT_EFFECT_MASK_REGION }],
}

export function effectMaskRegions(mask: ClipAdjustmentMask): ClipEffectMaskRegion[] {
  if (mask.enabled === false) return []
  if (mask.regions?.length) return mask.regions
  return [{
    id: 'effect-mask-legacy',
    shape: mask.shape,
    centerX: mask.centerX,
    centerY: mask.centerY,
    width: mask.width,
    height: mask.height,
    rotation: 0,
    feather: mask.feather,
    opacity: 1,
  }]
}

export function nextEffectMaskRegion(
  mask: ClipAdjustmentMask,
  shape: ClipEffectMaskRegion['shape'] = 'ellipse',
): ClipEffectMaskRegion {
  const used = new Set(effectMaskRegions(mask).map((region) => region.id))
  let n = used.size + 1
  while (used.has(`effect-mask-${n}`)) n += 1
  const circle = shape === 'circle'
  return {
    ...DEFAULT_EFFECT_MASK_REGION,
    id: `effect-mask-${n}`,
    shape,
    width: circle ? 0.18 : DEFAULT_EFFECT_MASK_REGION.width,
    height: circle ? 0.18 : DEFAULT_EFFECT_MASK_REGION.height,
    text: shape === 'text' ? 'MASK' : undefined,
    points: shape === 'custom'
      ? [{ x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 }, { x: 0.65, y: 0.65 }, { x: 0.35, y: 0.65 }]
      : undefined,
  }
}

/** Path centered on the region origin; caller supplies canvas transform and fill. */
export function effectMaskPolygonPath(ctx: Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'closePath'>, shape: 'star' | 'hexagon', width: number, height: number): void {
  const vertices = shape === 'star' ? 10 : 6
  ctx.beginPath()
  for (let i = 0; i < vertices; i++) {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / vertices
    const radius = shape === 'star' && i % 2 ? 0.43 : 1
    const x = Math.cos(angle) * width * radius / 2
    const y = Math.sin(angle) * height * radius / 2
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export interface MaskPathPoint { x:number; y:number; inHandle?:{x:number;y:number}; outHandle?:{x:number;y:number} }

/** Automatic handles can be overridden independently on any point. */
export function maskPointHandles(points: MaskPathPoint[], index:number, curve:number):{inHandle:{x:number;y:number};outHandle:{x:number;y:number}} {
  const n=points.length,p=points[index],prev=points[(index+n-1)%n],next=points[(index+1)%n]
  const t=Math.min(1,Math.max(0,curve))/6
  return {
    inHandle:p.inHandle||{x:p.x-(next.x-prev.x)*t,y:p.y-(next.y-prev.y)*t},
    outHandle:p.outHandle||{x:p.x+(next.x-prev.x)*t,y:p.y+(next.y-prev.y)*t},
  }
}

/** Draw a closed custom mask with optional automatic or individually edited Bezier handles. */
export function effectMaskCustomPath(
  ctx: Pick<CanvasRenderingContext2D, 'beginPath'|'moveTo'|'lineTo'|'bezierCurveTo'|'closePath'>,
  points: MaskPathPoint[], width:number,height:number,centerX:number,centerY:number,rotation=0,curve=0,
):void {
  if(points.length<3)return
  const angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle)
  const project=(p:{x:number;y:number})=>{const dx=p.x*width-centerX*width,dy=p.y*height-centerY*height;return{x:centerX*width+dx*cos-dy*sin,y:centerY*height+dx*sin+dy*cos}}
  const n=points.length,first=project(points[0]);ctx.beginPath();ctx.moveTo(first.x,first.y)
  for(let i=0;i<n;i++){
    const j=(i+1)%n,a=project(points[i]),b=project(points[j])
    const c1=project(maskPointHandles(points,i,curve).outHandle)
    const c2=project(maskPointHandles(points,j,curve).inHandle)
    if(curve||points[i].outHandle||points[j].inHandle)ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,b.x,b.y)
    else ctx.lineTo(b.x,b.y)
  }
  ctx.closePath()
}

/** Optional colored feather and contour bias. Runs only for masks that request it. */
export function tintEffectMaskFeather(
  data: Uint8ClampedArray, color: string | undefined, amount = 0, offset = 0,
): Uint8ClampedArray | null {
  const tint = Math.max(0, Math.min(1, amount))
  const bias = Math.max(-1, Math.min(1, offset))
  const match = /^#([0-9a-f]{6})$/i.exec(color || '')
  const overlay = tint && match ? new Uint8ClampedArray(data.length) : null
  const rgb = match ? [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)) : [0, 0, 0]
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    const adjusted = Math.max(0, Math.min(1, a + 2 * bias * a * (1 - a)))
    if (bias) data[i + 3] = Math.round(adjusted * 255)
    if (overlay) {
      overlay[i] = rgb[0]; overlay[i + 1] = rgb[1]; overlay[i + 2] = rgb[2]
      overlay[i + 3] = Math.round(4 * adjusted * (1 - adjusted) * tint * 255)
    }
  }
  return overlay
}
