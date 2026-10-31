import assert from 'node:assert/strict'
import {registry,SESSION} from '../tools/mcp/tools.mjs'
import {makeClip,renderFrame} from '../tools/mcp/appRender.mjs'
const call=async(tool,params)=>{const r=await registry.call(tool,params);assert.ok(r.ok,JSON.stringify(r.data));return r.data}
for(const strategy of ['clone','gradient','blur']){
 await call('project_new',{w:64,h:36,duration:2})
 const c=makeClip({id:'patch-plate',name:'Patch plate',asset:'qa-original',natW:64,natH:36,duration:2,draw:(x)=>{x.fillStyle='#1020d0';x.fillRect(0,0,64,36);x.fillStyle='#e02010';x.fillRect(20,14,20,16)}})
 SESSION.seq.addClip(c);SESSION.selection=c
 const before=renderFrame(SESSION.seq,0).getContext('2d').getImageData(0,0,64,36).data
 await call('smart_patch',{x0:20,y0:14,x1:40,y1:30,donor:[0,0],feather:2,brushRadius:20,strategy})
 const after=renderFrame(SESSION.seq,0).getContext('2d').getImageData(0,0,64,36).data
 const i=(22*64+30)*4
 assert.ok(after[i]<before[i]-100,`${strategy} must affect actual compositor pixels without any other effects or mask`)
 assert.deepEqual([...after.slice(0,4)],[...before.slice(0,4)],'outside region preserved')
 assert.ok(after.every(Number.isFinite));assert.equal(after[i+3],255)
}
const invalid=await registry.call('smart_patch',{x0:NaN,y0:0,x1:20,y1:20});assert.equal(invalid.ok,false)
console.log('PASS standalone smart-patch compositor path: clone, gradient and four-tap blur alter target pixels, preserve outside region and alpha')
