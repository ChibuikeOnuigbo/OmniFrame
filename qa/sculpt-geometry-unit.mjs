import assert from 'node:assert/strict'
import * as THREE from 'three'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const { sculptGeometry } = await loadAppTs('src/lib/sculptGeometry.ts')
const { validateSculptDabs, MAX_SCULPT_DABS } = await loadAppTs('src/lib/sculptData.ts')
const { validateImportedProject } = await loadAppTs('src/lib/projectValidation.ts')
const dab = { mode:'raise', point:{x:0,y:0,z:.8}, normal:{x:0,y:0,z:1}, radius:.6, strength:1 }
const vertices = geometry => Array.from(geometry.getAttribute('position').array)
const base = sculptGeometry(THREE,{type:'sphere'})
const raised = sculptGeometry(THREE,{type:'sphere',sculptDabs:[dab]})
const carved = sculptGeometry(THREE,{type:'sphere',sculptDabs:[{...dab,mode:'carve'}]})
const flat = sculptGeometry(THREE,{type:'sphere',sculptDabs:[{...dab,mode:'flatten'}]})
const b=vertices(base),r=vertices(raised),c=vertices(carved),f=vertices(flat)
assert.notDeepEqual(r,b,'raise must change actual vertices')
for(let i=0;i<b.length;i+=3){
 const distance=Math.hypot(b[i],b[i+1],b[i+2]-.8)
 assert.equal(r[i],b[i]);assert.equal(r[i+1],b[i+1])
 if(distance>=dab.radius)assert.equal(r[i+2],b[i+2],'outside brush remains unchanged')
 assert.ok(r[i+2]>=b[i+2] && c[i+2]<=b[i+2],'raise/carve opposite displacement')
 assert.ok(Math.abs(f[i+2]-.8)<=Math.abs(b[i+2]-.8)+1e-7,'flatten approaches tangent plane')
}
assert.deepEqual(vertices(sculptGeometry(THREE,{type:'sphere',sculptDabs:[{...dab,strength:0}]})),b)
assert.deepEqual(vertices(sculptGeometry(THREE,{type:'sphere',sculptDabs:[dab]})),r,'deterministic replay')
const immutable=JSON.stringify(dab)
for(const type of ['cube','sphere','torus','plane','diamond']){
 const g=sculptGeometry(THREE,{type,sculptDabs:Array.from({length:MAX_SCULPT_DABS},(_,i)=>({...dab,mode:['raise','carve','flatten'][i%3]}))})
 assert.ok(vertices(g).every(v=>Number.isFinite(v)&&Math.abs(v)<=8))
 assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));assert.ok(Number.isFinite(g.boundingSphere.radius));g.dispose()
}
assert.equal(JSON.stringify(dab),immutable)
const obj={id:'s',name:'Sculpt',color:'#ffffff',type:'sphere',position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},sculptDabs:[dab]}
const doc={assets:[],tracks:[],clips:[],scene3DObjects:[obj]}
validateImportedProject(doc,{})
const malformed=[null,{},[null],[{...dab,mode:'smooth'}],[{...dab,normal:{x:0,y:0,z:0}}],[{...dab,point:{x:Infinity,y:0,z:0}}],[{...dab,radius:NaN}],[{...dab,radius:0}],[{...dab,strength:2}],[{...dab,strength:'1'}],Array(MAX_SCULPT_DABS+1).fill(dab)]
for(const strokes of malformed){
 assert.throws(()=>validateSculptDabs(strokes))
 assert.throws(()=>validateImportedProject({...doc,scene3DObjects:[{...obj,sculptDabs:strokes}]},{}))
}
for(const override of [{type:'wheel'},{modelUrl:'/test.glb'}])assert.throws(()=>validateImportedProject({...doc,scene3DObjects:[{...obj,...override}]},{}))
assert.throws(()=>sculptGeometry(THREE,{type:'wheel'}))
for(const g of [base,raised,carved,flat])g.dispose()
console.log('PASS sculpt footprint, direction, flattening, determinism, zero strength, 5 bounded primitives at capacity, 13 invalid project cases')
