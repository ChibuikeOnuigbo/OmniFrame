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

/** Draw a closed custom mask with optional Catmull-Rom to Bezier smoothing. */
export function effectMaskCustomPath(
  ctx: Pick<CanvasRenderingContext2D, 'beginPath'|'moveTo'|'lineTo'|'bezierCurveTo'|'closePath'>,
  points: {x:number;y:number}[], width:number,height:number,centerX:number,centerY:number,rotation=0,curve=0,
):void {
  if(points.length<3)return
  const angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle)
  const pts=points.map(p=>{const dx=p.x*width-centerX*width,dy=p.y*height-centerY*height;return{x:centerX*width+dx*cos-dy*sin,y:centerY*height+dx*sin+dy*cos}})
  const n=pts.length,t=Math.min(1,Math.max(0,curve))/6
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y)
  for(let i=0;i<n;i++){
    const a=pts[i],b=pts[(i+1)%n]
    if(t){const prev=pts[(i+n-1)%n],next=pts[(i+2)%n]
      ctx.bezierCurveTo(a.x+(b.x-prev.x)*t,a.y+(b.y-prev.y)*t,b.x-(next.x-a.x)*t,b.y-(next.y-a.y)*t,b.x,b.y)
    }else ctx.lineTo(b.x,b.y)
  }
  ctx.closePath()
}
