import { useEditor } from '../store'
import type { Transition } from '../types'
import { DEVICE_MOTIONS, prepareDeviceModels } from '../lib/device3d'
import { PanelSection } from './PanelSection'
import {DEVICE_MODEL_OPTIONS,defaultDeviceModel} from '../lib/transitionAssetCatalog'

export function DeviceTransitionInspector({ transition }: { transition: Transition }) {
  const update = useEditor(s => s.updateTransition)
  const begin = useEditor(s => s.beginHistory), end = useEditor(s => s.endHistory)
  const p = transition.parameters || {}
  const patch = (value: Record<string, unknown>) => update(transition.id, { parameters: { ...p, ...value } })
  const defaultModel=defaultDeviceModel(transition.type),selected=DEVICE_MODEL_OPTIONS.find(model=>model.id===(p.model||defaultModel)),credit=selected&&'source'in selected?selected:null
  const slider=(key:string,label:string,min:number,max:number,step:number,value:number)=><label key={key} className="block text-ink-300">{label}<output className="float-right font-mono text-ink-100">{Number(p[key] ?? value).toFixed(step<1?2:0)}</output><input aria-label={label} type="range" className="block h-6 w-full accent-brand" min={min} max={max} step={step} value={p[key] ?? value} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onBlur={end} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>
  return <PanelSection title="Device Transition" defaultOpen testId="device-transition-inspector">
    <div className="space-y-2 px-1 text-[11px]">
      <p className="text-ink-400">The incoming clip plays on the model’s screen.</p>
      <label className="block">Device model<select aria-label="Device model" className="mt-1 w-full rounded border border-ink-700 bg-ink-900 p-1.5" value={p.model || defaultModel} onChange={e => { patch({model:e.target.value}); void prepareDeviceModels().catch(()=>{}) }}>{DEVICE_MODEL_OPTIONS.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
      {credit&&<p className="text-[10px] text-ink-400"><a href={credit.source} target="_blank" rel="noreferrer" className="underline">{credit.author} · {credit.license}</a> · textured body, live video screen</p>}
      <label className="block">Motion<select aria-label="Device motion" className="mt-1 w-full rounded border border-ink-700 bg-ink-900 p-1.5" value={p.motion || 'rotate-reveal'} onChange={e=>patch({motion:e.target.value})}>{DEVICE_MOTIONS.map(id=><option key={id} value={id}>{id.replace(/-/g,' ')}</option>)}</select></label>
      <details open className="rounded border border-ink-750 p-2"><summary className="cursor-pointer font-medium text-ink-100">Screen</summary><div className="mt-2 space-y-2">
        <label className="block">Display fit<select aria-label="Device display fit" className="mt-1 w-full rounded bg-ink-900 p-1.5" value={p.fit || 'cover'} onChange={e=>patch({fit:e.target.value})}>{['cover','contain','stretch'].map(id=><option key={id}>{id}</option>)}</select></label>
        {slider('brightness','Screen brightness',0,2,.01,1)}
      </div></details>
      <details className="rounded border border-ink-750 p-2"><summary className="cursor-pointer font-medium text-ink-100">Camera & angle</summary><div className="mt-2 space-y-2">
        {slider('fov','Camera field of view',25,70,1,40)}
        {slider('cameraDistance','Camera distance',2,10,.1,5)}
        {slider('yaw','Device yaw',-180,180,1,0)}
        {slider('pitch','Device pitch',-90,90,1,0)}
        {slider('roll','Device roll',-180,180,1,0)}
        <p className="text-[10px] text-ink-400">Angles settle to a flat screen during the handoff.</p>
      </div></details>
      <details className="rounded border border-ink-750 p-2"><summary className="cursor-pointer font-medium text-ink-100">Lighting</summary><div className="mt-2 space-y-2">
        {slider('environmentLight','Environment light',0,5,.1,2)}
        {slider('keyLight','Key light',0,8,.1,3)}
        {slider('rimLight','Rim light',0,8,.1,4)}
      </div></details>
      <label className="flex items-center justify-between">Duration (s)<input aria-label="Device duration" type="number" min={.1} max={5} step={.1} className="w-20 rounded border border-ink-700 bg-ink-900 p-1" value={transition.duration} onFocus={begin} onBlur={end} onChange={e=>update(transition.id,{duration:Math.max(.1,Math.min(5,Number(e.target.value)||.1))})}/></label>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className="rounded border border-ink-700 p-1.5 hover:border-brand focus-visible:ring-2 focus-visible:ring-brand" onClick={()=>useEditor.getState().startVisualPreview({kind:'range-playback',label:'Device transition',startTime:transition.startTime,endTime:transition.startTime+transition.duration})}>Preview</button>
        <button type="button" className="rounded border border-ink-700 p-1.5 hover:border-brand focus-visible:ring-2 focus-visible:ring-brand" onClick={()=>update(transition.id,{parameters:{model:p.model||defaultModel,fit:p.fit||'cover',motion:p.motion||'rotate-reveal'}})}>Reset look</button>
      </div>
    </div>
  </PanelSection>
}
