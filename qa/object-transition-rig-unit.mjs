import assert from 'node:assert/strict'
import fs from 'node:fs'
import {OBJECT_ASSETS} from '../src/lib/transitionAssetCatalog.ts'
import {loadAppTs} from '../tools/mcp/appRender.mjs'
import {makeCanvas} from '../tools/mcp/core.mjs'
const {objectRigAt,fragmentPose,drawObjectTransition}=await loadAppTs('src/lib/object3d.ts')
const from=makeCanvas(64,36),to=makeCanvas(64,36)
from.getContext('2d').fillStyle='rgba(230,60,20,.4)';from.getContext('2d').fillRect(8,3,40,24)
to.getContext('2d').fillStyle='rgba(20,140,230,.7)';to.getContext('2d').fillRect(22,7,36,20)
for(const type of Object.keys(OBJECT_ASSETS)){
 for(const reverse of [false,true])for(let i=0;i<=120;i++){
  const rig=objectRigAt(type,i/120,{reverse});assert(Object.values(rig).every(Number.isFinite))
  assert(rig.alpha>=0&&rig.alpha<=1&&rig.reveal>=0&&rig.reveal<=1)
  assert.deepEqual(rig,objectRigAt(type,(i*2)/240,{reverse}),'frame-rate-independent pose')
 }
 assert.equal(objectRigAt(type,0).reveal,0);assert.equal(objectRigAt(type,1).reveal,1)
 assert(Object.values(objectRigAt(type,NaN,{size:Infinity,turns:NaN})).every(Number.isFinite))
 for(const p of [0,1]){const target=makeCanvas(64,36);drawObjectTransition(target.getContext('2d'),64,36,type,p,from,to);assert.deepEqual(target.toBuffer('image/png'),(p===0?from:to).toBuffer('image/png'),'transparent endpoint identity')}
}
for(let i=0;i<35;i++)for(const p of [0,.2,.5,.8,1,NaN]){
 const a=fragmentPose(i,.2,-.3,p);assert(Object.values(a).every(Number.isFinite));assert.deepEqual(a,fragmentPose(i,.2,-.3,p))
}
for(const name of ['arrow_oga','bullet_shell_oga','payphone_ph','concrete_shards_ph','tv_crt_knobs_ph','tv_crt_silver_ph']){
 const folder=name.startsWith('tv_')?'device_transitions':'transition_assets',file=`public/models/${folder}/${name}.glb`,data=fs.readFileSync(file)
 assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(8),data.length)
 const length=data.readUInt32LE(12),json=JSON.parse(data.subarray(20,20+length).toString())
 for(const image of json.images||[]){assert.equal(image.uri,undefined);assert(Number.isInteger(image.bufferView),'texture must be embedded')}
 if(!['arrow_oga','bullet_shell_oga'].includes(name))assert.equal(json.images.length,3,'all PBR maps retained')
 if(name==='concrete_shards_ph'){assert.equal(json.nodes.filter(n=>n.name?.startsWith('Fragment_')).length,35);assert.equal(json.nodes.filter(n=>n.name?.startsWith('VideoShard_')).length,35)}
 if(['arrow_oga','bullet_shell_oga','payphone_ph'].includes(name)){
  const a=json.meshes.flatMap(m=>m.primitives.map(p=>json.accessors[p.attributes.POSITION]))
  const lo=[0,1,2].map(i=>Math.min(...a.map(p=>p.min[i]))),hi=[0,1,2].map(i=>Math.max(...a.map(p=>p.max[i])))
  assert(lo.every((v,i)=>Math.abs((v+hi[i])/2)<.02),name+' centered from actual transformed vertices')
  const target=name==='bullet_shell_oga'?1.8:2.2
  assert(Math.abs(Math.max(...hi.map((v,i)=>v-lo[i]))-target)<.02,name+' normalized model extent')
 }
 if(name.startsWith('tv_'))assert(json.nodes.some(n=>n.name==='ScreenSurface'))
 assert(fs.statSync(`assets-source/transition-pack/${name}.blend`).size>1000)
}
console.log('PASS four deterministic object rigs, reverse paths, fragment poses, six real GLBs, embedded PBR textures and packed Blender sources')
