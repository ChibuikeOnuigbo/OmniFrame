import {useEffect,useState} from 'react'
import {useEditor} from '../store'
import type {Transition} from '../types'
import {OBJECT_ASSETS,isObjectTransition} from '../lib/transitionAssetCatalog'
import {prepareObjectAssets} from '../lib/object3d'
import {PanelSection} from './PanelSection'
export function ObjectTransitionInspector({transition}:{transition:Transition}){
  const update=useEditor(s=>s.updateTransition),begin=useEditor(s=>s.beginHistory),end=useEditor(s=>s.endHistory)
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false)
  const load=()=>{setLoading(true);setFailed(false);return prepareObjectAssets().then(()=>setLoading(false),()=>{setLoading(false);setFailed(true)})}
  useEffect(()=>{void load()},[])
  if(!isObjectTransition(transition.type))return null
  const asset=OBJECT_ASSETS[transition.type],p=transition.parameters||{},fracture=transition.type==='object_concrete_shatter'
  const patch=(next:Record<string,unknown>)=>update(transition.id,{parameters:{...p,...next}})
  const slider=(key:string,label:string,min:number,max:number,step:number,value:number)=><label className="block">{label}<output className="float-right font-mono text-ink-200">{Number(p[key]??value).toFixed(1)}</output><input aria-label={label} className="block h-7 w-full accent-brand" type="range" min={min} max={max} step={step} value={p[key]??value} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onBlur={end} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>
  return <PanelSection title="3D Object Transition" defaultOpen testId="object-transition-inspector"><div className="space-y-3 px-1 text-[11px] text-ink-300">
    <div><p className="font-medium text-ink-100">{asset.name}</p><p className="mt-1 text-ink-400">{asset.note}</p><a href={asset.source} target="_blank" rel="noreferrer" className="text-[10px] underline">{asset.author} · {asset.license}</a></div>
    {loading&&<p role="status">Loading 3D models…</p>}
    {failed&&<button className="rounded border border-ink-700 p-2" onClick={()=>void load()}>Couldn’t load 3D models. Retry</button>}
    {!fracture&&slider('size','Prop size',.35,1.8,.05,1)}
    {slider('turns',fracture?'Fragment spin':'Spin',0,3,.1,.6)}
    {fracture?slider('spread','Fragment spread',.2,2.5,.1,1):<label className="flex items-center gap-2"><input aria-label="Reverse direction" type="checkbox" checked={!!p.reverse} onChange={e=>patch({reverse:e.target.checked})}/>Reverse direction</label>}
    <details className="rounded border border-ink-750 p-2"><summary className="cursor-pointer">Lighting</summary><div className="mt-2 space-y-2">{slider('keyLight','Key light',0,8,.1,4)}{slider('rimLight','Rim light',0,8,.1,4)}</div></details>
    <label className="flex items-center justify-between">Duration (s)<input aria-label="Object transition duration" className="w-20 rounded border border-ink-700 bg-ink-900 p-1" type="number" min={.1} max={5} step={.1} value={transition.duration} onFocus={begin} onBlur={end} onChange={e=>update(transition.id,{duration:Math.max(.1,Math.min(5,Number(e.target.value)||.1))})}/></label>
    <div className="grid grid-cols-2 gap-2"><button className="rounded border border-ink-700 p-2" onClick={()=>useEditor.getState().startVisualPreview({kind:'range-playback',label:asset.name,startTime:transition.startTime,endTime:transition.startTime+transition.duration})}>Preview</button><button className="rounded border border-ink-700 p-2" onClick={()=>update(transition.id,{parameters:{}})}>Reset look</button></div>
  </div></PanelSection>
}
