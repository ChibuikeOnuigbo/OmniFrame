import {OBJECT_ASSETS,type ObjectTransitionKind} from './transitionAssetCatalog'
export interface ObjectTransitionOptions {size?:number;turns?:number;reverse?:boolean;spread?:number;keyLight?:number;rimLight?:number}
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
export const objectParameter=(v:number|undefined,base:number,min:number,max:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):base
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)}
export function objectRigAt(type:ObjectTransitionKind,progress:number,options:ObjectTransitionOptions={}) {
  const p=Number.isFinite(progress)?clamp(progress):0,direction=options.reverse?-1:1,turns=objectParameter(options.turns,.6,0,3)
  const alpha=smooth(p/.13)*(1-smooth((p-.82)/.18))
  const rig={p,x:(p-.5)*2.7*direction,y:.035*Math.sin(Math.PI*p),rotX:turns*360*p,rotY:22*Math.sin(Math.PI*p),rotZ:options.reverse?180:0,size:objectParameter(options.size,1,.35,1.8),alpha,reveal:smooth((p-.12)/.76),direction}
  if(type==='object_shell_whip'){rig.reveal=smooth((p-.38)/.3);rig.rotX=turns*720*p;rig.rotY=-18*Math.sin(Math.PI*p);rig.size*=.7}
  if(type==='object_payphone_orbit'){rig.x=.32*Math.sin(Math.PI*2*p)*direction;rig.y=.07*Math.sin(Math.PI*p*2);rig.rotX=-8*Math.sin(Math.PI*p);rig.rotY=-65+turns*360*p;rig.rotZ=8*Math.sin(Math.PI*2*p);rig.size*=.8;rig.reveal=smooth((p-.28)/.5)}
  if(type==='object_concrete_shatter'){rig.x=0;rig.y=0;rig.rotX=0;rig.rotY=0;rig.rotZ=0;rig.alpha=1-smooth((p-.65)/.35);rig.reveal=p}
  return rig
}
export function fragmentPose(index:number,x:number,y:number,progress:number,options:ObjectTransitionOptions={}) {
  const p=Number.isFinite(progress)?clamp(progress):0,e=smooth((p-.04)/.72),spread=objectParameter(options.spread,1,.2,2.5),spin=objectParameter(options.turns,.6,0,3)
  const random=(n:number)=>{const t=Math.sin((index+1)*n)*43758.5453;return t-Math.floor(t)}
  return {x:(x*1.8+(random(17)-.5)*.7)*e*spread,y:(y*1.8+(random(31)-.5)*.7)*e*spread-e*e*.7,z:(.3+random(7))*.8*e,rx:(random(19)-.5)*Math.PI*4*spin*e,ry:(random(23)-.5)*Math.PI*4*spin*e,rz:(random(29)-.5)*Math.PI*3*spin*e}
}
type RendererModule=typeof import('./objectModelRenderer')
let module:RendererModule|null=null,pending:Promise<RendererModule>|null=null
export async function prepareObjectAssets(){
  if(typeof window==='undefined')return
  if(!pending)pending=import('./objectModelRenderer')
  module=await pending
  await Promise.all(Object.values(OBJECT_ASSETS).map(asset=>module!.preloadObjectModel(asset.model)))
}
export function objectRendererStatus(){return module?.objectModelStatus()??{webgl:false,loadedModels:0}}
export function drawObjectTransition(ctx:CanvasRenderingContext2D,w:number,h:number,type:ObjectTransitionKind,p:number,from:HTMLCanvasElement,to:HTMLCanvasElement,options:ObjectTransitionOptions={}) {
  if(p<=0){ctx.drawImage(from,0,0,w,h);return}
  if(p>=1){ctx.drawImage(to,0,0,w,h);return}
  const rig=objectRigAt(type,p,options)
  const wipe=()=>{
    ctx.drawImage(from,0,0,w,h);ctx.save();ctx.beginPath()
    if(type==='object_payphone_orbit')ctx.arc(w/2,h/2,Math.hypot(w,h)*.5*rig.reveal,0,Math.PI*2)
    else ctx.rect(options.reverse?w*(1-rig.reveal):0,0,w*rig.reveal,h)
    ctx.clip();ctx.drawImage(to,0,0,w,h);ctx.restore()
  }
  if(!module)void prepareObjectAssets().catch(()=>{})
  if(type==='object_concrete_shatter'){
    ctx.drawImage(to,0,0,w,h)
    if(!module?.drawObjectModel(ctx,w,h,type,rig,from,options))wipe()
  }else{wipe();module?.drawObjectModel(ctx,w,h,type,rig,from,options)}
}
