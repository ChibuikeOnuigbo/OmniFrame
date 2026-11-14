import { useEffect, useRef } from 'react'
import { useEditor } from '../store'
import { useEffectMaskEditor } from '../lib/effectMaskEditor'
import { effectMaskRegions } from '../lib/effectMask'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

/** Edit a polygon in the same normalized stage coordinates used by export. */
export function EffectMaskDrawOverlay({width,height}:{width:number;height:number}) {
  const {clipId,regionId,close,snap,freehand} = useEffectMaskEditor()
  const selectedClipId = useEditor(s=>s.selectedClipId)
  const clip = useEditor(s=>s.clips.find(c=>c.id===clipId))
  const region = clip?.adjustmentMask && effectMaskRegions(clip.adjustmentMask).find(r=>r.id===regionId)
  const drag = useRef<number|null>(null)
  const tracing = useRef(false)
  useEffect(()=>{if(clipId && selectedClipId!==clipId)close()},[clipId,selectedClipId,close])
  if(!clip||!region||region.shape!=='custom'||selectedClipId!==clipId)return null
  const points=region.points||[]
  const toPoint=(e:React.PointerEvent<SVGSVGElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect()
    const x=clamp((e.clientX-rect.left)/rect.width),y=clamp((e.clientY-rect.top)/rect.height)
    const angle=-(region.rotation||0)*Math.PI/180
    const dx=x-region.centerX,dy=y-region.centerY
    const point={x:clamp(region.centerX+dx*Math.cos(angle)-dy*Math.sin(angle)),y:clamp(region.centerY+dx*Math.sin(angle)+dy*Math.cos(angle))}
    if(snap && Math.abs(region.rotation||0)<.01){for(const axis of ['x','y'] as const){for(const guide of [0,.25,.5,.75,1])if(Math.abs(point[axis]-guide)<.014){point[axis]=guide;break}}}
    return point
  }
  const commit=(next:{x:number;y:number}[])=>{
    const s=useEditor.getState(),current=s.clips.find(c=>c.id===clipId)
    if(!current?.adjustmentMask)return
    s.setClipProp(clipId!,{adjustmentMask:{...current.adjustmentMask,regions:effectMaskRegions({...current.adjustmentMask,enabled:true}).map(r=>r.id===regionId?{...r,points:next}:r)}})
  }
  return <svg data-testid="effect-mask-draw-overlay" className="absolute inset-0 z-30 h-full w-full touch-none cursor-crosshair" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);useEditor.getState().beginHistory();const index=(e.target as SVGElement).dataset.pointIndex;const point=toPoint(e);if(index!==undefined&&!freehand)drag.current=Number(index);else if(freehand){tracing.current=true;commit([point])}else {drag.current=points.length;commit([...points,point])}}}
    onPointerMove={e=>{if(tracing.current){const next=[...(region.points||[])],point=toPoint(e),last=next[next.length-1];if(next.length<1000 && last && Math.hypot(point.x-last.x,point.y-last.y)>.008)commit([...next,point]);return}if(drag.current===null)return;const next=[...(region.points||[])];if(next[drag.current]){next[drag.current]=toPoint(e);commit(next)}}}
    onPointerUp={e=>{drag.current=null;tracing.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);useEditor.getState().endHistory()}}
    onPointerCancel={()=>{drag.current=null;tracing.current=false;useEditor.getState().endHistory()}}
    onKeyDown={e=>{if(e.key==='Escape')close()}} tabIndex={0} aria-label="Draw effect mask points on preview">
    {snap&&[.25,.5,.75].map(g=><g key={g} pointerEvents="none" stroke="#67e8f966" strokeDasharray="5 7" strokeWidth="1"><line x1={g*width} x2={g*width} y1="0" y2={height}/><line x1="0" x2={width} y1={g*height} y2={g*height}/></g>)}
    <g transform={`rotate(${region.rotation||0} ${region.centerX*width} ${region.centerY*height})`}>
    {points.length>1&&<polygon points={points.map(p=>`${p.x*width},${p.y*height}`).join(' ')} fill={points.length>=3?'#22d3ee22':'none'} stroke="#22d3ee" strokeWidth={Math.max(2,width/500)} pointerEvents="none"/>}
    {points.map((p,i)=>(!freehand || i % Math.max(1,Math.ceil(points.length/12))===0 || i===points.length-1) ? <circle key={i} data-point-index={i} cx={p.x*width} cy={p.y*height} r={Math.max(6,width/160)} fill="#061a23" stroke="#67e8f9" strokeWidth={Math.max(2,width/500)} /> : null)}
    </g>
  </svg>
}
