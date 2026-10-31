import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store'
import type { Clip } from '../types'
import { evaluateClipAnimation, rotationXYMatrix } from '../lib/animation/CurveEngine'
import { PW, PH } from '../lib/playback'
import { UNIT_QUAD, validWarpQuad, inverseCornerPin, invertWarpMatrix, mapWarpPoint, type WarpQuad, type WarpPoint } from '../lib/deformation'

export function TransformModes({clip}: {clip:Clip}) {
  const mode=useEditor(s=>s.transformToolMode),radius=useEditor(s=>s.liquifyRadius),strength=useEditor(s=>s.liquifyStrength),tool=useEditor(s=>s.liquifyTool)
  const [error,setError]=useState('')
  const parented=useEditor(s=>s.parentRelationships.some(r=>r.childId===clip.id))
  const raster=clip.kind==='image'||clip.kind==='video'
  const edit=(value:Partial<Clip>)=>{const s=useEditor.getState();s.beginHistory();try{s.setClipProp(clip.id,value)}finally{s.endHistory()}}
  return <div data-testid="transform-workbench" className="space-y-2 pb-3">
    <label className="block text-[10px] text-ink-400">Transform mode<select aria-label="Transform mode" className="mt-1 h-9 w-full rounded-md border border-ink-700 bg-ink-900 px-2 text-xs text-ink-100" value={mode} onChange={event=>{
      const value=event.target.value as typeof mode,s=useEditor.getState();s.endHistory();s.armRotoTool(null);s.setDrawingEnabled(value==='marquee');useEditor.setState({transformToolMode:value,pivotEditEnabled:false})
      if(value==='marquee')s.setDrawingTool('select-rect')
      if(value==='roto')s.armRotoTool('brush-add')
    }}>
      <option value="free">Free transform</option><option value="perspective" disabled={!raster}>Perspective / corner pin</option><option value="liquify" disabled={!raster}>Liquify brush</option><option value="marquee">Marquee selection</option><option value="roto">Roto brush</option>
    </select></label>
    {mode==='perspective'&&raster&&<><p className="text-[10px] text-ink-400">Drag the four corners on the preview, or enter percentages. Crossed corners are rejected.</p><div className="grid grid-cols-2 gap-2">{(clip.deformation?.corners||UNIT_QUAD).map((point,i)=><fieldset key={i} className="min-w-0 rounded border border-ink-700 p-1.5"><legend className="text-[9px] text-ink-400">{['Top left','Top right','Bottom right','Bottom left'][i]}</legend>{(['x','y']as const).map(axis=><label key={axis} className="flex items-center gap-1 text-[10px]">{axis.toUpperCase()}<input aria-label={`Corner ${i+1} ${axis}`} type="number" min={-25} max={125} step={1} value={Math.round(point[axis]*100)} className="h-7 w-full min-w-0 rounded bg-ink-900 px-1" onChange={event=>{const q=structuredClone(clip.deformation?.corners||UNIT_QUAD);q[i][axis]=Number(event.target.value)/100;if(validWarpQuad(q)){setError('');edit({deformation:{...clip.deformation,corners:q}})}else setError('Keep the four corners in a convex shape.')}}/></label>)}</fieldset>)}</div></>}
    {mode==='liquify'&&raster&&<><div className="grid grid-cols-2 gap-1">{(['push','bulge','pinch','twirl']as const).map(value=><button key={value} type="button" aria-pressed={tool===value} onClick={()=>useEditor.setState({liquifyTool:value})} className={`h-8 rounded border text-[11px] capitalize ${tool===value?'border-brand bg-brand/20 text-brand-200':'border-ink-700 text-ink-300'}`}>{value}</button>)}</div><label className="block text-[10px]">Brush radius: {Math.round(radius*100)}%<input aria-label="Liquify radius" type="range" min={.03} max={.4} step={.01} value={radius} className="w-full accent-brand" onChange={e=>useEditor.setState({liquifyRadius:Number(e.target.value)})}/></label><label className="block text-[10px]">Strength: {Math.round(strength*100)}%<input aria-label="Liquify strength" type="range" min={.05} max={1} step={.05} value={strength} className="w-full accent-brand" onChange={e=>useEditor.setState({liquifyStrength:Number(e.target.value)})}/></label><p className="text-[10px] text-ink-400">Drag on the preview to reshape the clip. Undo reverses the last gesture.</p></>}
    {mode==='marquee'&&<p className="text-[10px] text-ink-400">Draw a marquee in the preview. The shared selection tools support masks, cut-outs, fill and patching.</p>}
    {mode==='roto'&&<div className="space-y-1"><p className="text-[10px] text-ink-400">Paint foreground with the existing RotoMask brush.</p><div className="flex gap-1"><button type="button" className="h-8 flex-1 rounded border border-ink-700 text-xs" onClick={()=>useEditor.getState().armRotoTool('brush-add')}>Add foreground</button><button type="button" className="h-8 flex-1 rounded border border-ink-700 text-xs" onClick={()=>useEditor.getState().armRotoTool('brush-remove')}>Subtract</button></div></div>}
    {parented&&['perspective','liquify'].includes(mode)&&<p className="text-[10px] text-ink-400">Unlink this clip from its parent to edit its geometry on the canvas.</p>}
    {(clip.deformation?.dabs?.length||0)>=256&&<p role="status" className="text-[10px] text-ink-300">Brush limit reached. Undo or reset the deformation to continue.</p>}
    {error&&<p role="status" className="text-[10px] text-red-300">{error}</p>}
    {raster&&clip.deformation&&<button type="button" className="h-8 w-full rounded border border-ink-700 text-[11px] text-ink-300 hover:border-brand" onClick={()=>edit({deformation:undefined})}>Reset deformation</button>}
  </div>
}

export function DeformationOverlay({width,height}: {width:number;height:number}) {
  const store=useEditor(),drag=useRef<{corner?:number;last:WarpPoint}|null>(null),[cursor,setCursor]=useState<WarpPoint|null>(null)
  useEffect(()=>()=>{if(drag.current){drag.current=null;useEditor.getState().endHistory()}},[store.selectedClipId,store.transformToolMode])
  const clip=store.clips.find(c=>c.id===store.selectedClipId),asset=store.assets.find(a=>a.id===clip?.assetId)
  if(!clip||!asset||store.parentRelationships.some(r=>r.childId===clip.id)||!['image','video'].includes(clip.kind)||!['perspective','liquify'].includes(store.transformToolMode)||store.playhead<clip.start||store.playhead>=clip.start+clip.duration)return null
  const ev=evaluateClipAnimation(clip,store.playhead),cover=Math.max(width/(asset.width||width),height/(asset.height||height)),dw=(asset.width||width)*cover,dh=(asset.height||height)*cover
  const pvx=(ev.pivotX-.5)*dw,pvy=(ev.pivotY-.5)*dh,r=rotationXYMatrix(ev.rotationX,ev.rotationY)
  const matrix=new DOMMatrix().translate(width/2+ev.x*width/PW,height/2+ev.y*height/PH).translate(pvx,pvy).rotate(ev.rotationZ).multiply(new DOMMatrix([r.a,r.b,r.c,r.d,0,0])).scale(ev.scaleX,ev.scaleY).translate(-pvx-dw/2,-pvy-dh/2).scale(dw,dh)
  const inverse=matrix.inverse(),quad=clip.deformation?.corners||UNIT_QUAD
  const pinInverse=inverseCornerPin(quad);if(!pinInverse)return null
  const pinForward=invertWarpMatrix(pinInverse)
  const local=(event:React.PointerEvent<SVGSVGElement>)=>{const box=event.currentTarget.getBoundingClientRect();const p=new DOMPoint((event.clientX-box.left)*width/box.width,(event.clientY-box.top)*height/box.height).matrixTransform(inverse);return{x:p.x,y:p.y}}
  const display=(point:WarpPoint)=>new DOMPoint(point.x,point.y).matrixTransform(matrix)
  const finish=(event:React.PointerEvent<SVGSVGElement>)=>{if(drag.current){drag.current=null;useEditor.getState().endHistory();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
  return <svg tabIndex={0} data-testid="deformation-overlay" aria-label={`${store.transformToolMode} canvas controls`} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 z-[35] h-full w-full touch-none overflow-visible" style={{cursor:store.transformToolMode==='liquify'?'crosshair':'default'}} onPointerDown={event=>{
    if(event.button!==0)return
    event.currentTarget.focus()
    const raw=local(event),point=store.transformToolMode==='liquify'?mapWarpPoint(pinInverse,raw):raw;if(![point.x,point.y].every(Number.isFinite))return
    const corner=(event.target as Element).getAttribute('data-corner')
    if(store.transformToolMode==='perspective'&&corner===null)return
    useEditor.getState().beginHistory();drag.current={last:point,corner:corner===null?undefined:Number(corner)};event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation()
  }} onPointerMove={event=>{
    const raw=local(event),point=store.transformToolMode==='liquify'?mapWarpPoint(pinInverse,raw):raw;setCursor(raw);const active=drag.current;if(!active||![point.x,point.y].every(Number.isFinite))return
    const state=useEditor.getState(),current=state.clips.find(c=>c.id===clip.id);if(!current)return
    if(active.corner!==undefined){const next=structuredClone(current.deformation?.corners||UNIT_QUAD);next[active.corner]={x:Math.max(-.25,Math.min(1.25,point.x)),y:Math.max(-.25,Math.min(1.25,point.y))};if(validWarpQuad(next))state.setClipProp(clip.id,{deformation:{...current.deformation,corners:next}})}
    else if(Math.hypot((point.x-active.last.x)*dw,(point.y-active.last.y)*dh)>=Math.max(3,state.liquifyRadius*Math.min(dw,dh)*.12)){if((current.deformation?.dabs?.length||0)>=256)return;const pressure=event.pointerType==='pen'?Math.max(.1,event.pressure):1;state.setClipProp(clip.id,{deformation:{...current.deformation,dabs:[...(current.deformation?.dabs||[]),{...active.last,dx:point.x-active.last.x,dy:point.y-active.last.y,radius:state.liquifyRadius,strength:state.liquifyStrength*pressure,mode:state.liquifyTool}]}});active.last=point}
  }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{drag.current=null;useEditor.getState().endHistory()}} onPointerLeave={()=>setCursor(null)}>
    {store.transformToolMode==='perspective'&&<><polygon points={quad.map(p=>{const q=display(p);return`${q.x},${q.y}`}).join(' ')} fill="none" stroke="#6ee7d0" strokeWidth={1.5}/>{quad.map((p,i)=>{const q=display(p);return<circle key={i} data-corner={i} aria-label={`Perspective corner ${i+1}`} cx={q.x} cy={q.y} r={7} fill="#101824" stroke="#6ee7d0" strokeWidth={2} style={{cursor:'move'}}/>})}</>}
    {store.transformToolMode==='liquify'&&cursor&&(()=>{const center=mapWarpPoint(pinInverse,cursor),radius=store.liquifyRadius*Math.min(dw,dh);const points=Array.from({length:40},(_,i)=>{const angle=i/40*Math.PI*2;const p=display(mapWarpPoint(pinForward,{x:center.x+Math.cos(angle)*radius/dw,y:center.y+Math.sin(angle)*radius/dh}));return `${p.x},${p.y}`}).join(' ');return<polygon points={points} fill="none" stroke="white" strokeWidth={1} pointerEvents="none"/>})()}
  </svg>
}
