import assert from 'node:assert/strict'
import {FXI,loadAppTs} from '../tools/mcp/appRender.mjs'
const NG=await loadAppTs('src/lib/glitchNG.ts')
const source=new Uint8ClampedArray(32*24*4);for(let i=0;i<source.length;i++)source[i]=i%4===3?255:i%251
const inst={id:'ng',catalogId:'ng-digital-slice',name:'NG',inP:1,duration:4,enabled:true,params:{ngFamily:'digital-slice',ngLead:0,ngAttack:0,ngHold:8,ngDecay:0,ngSeed:17,ngOpacity:.8,ngIntensity:1},keys:{ngIntensity:[{t:0,v:0},{t:4,v:1}]}}
const clip={start:3,effects:{brightness:1},fxInstances:[inst]},split=FXI.splitFxInstances([inst],2)
const right={...clip,start:5,fxInstances:split.right},left={...clip,fxInstances:split.left}
const pixels=(c,globalTime)=>NG.renderGlitchRGBA(source,32,24,globalTime,NG.recipeFromEffect(FXI.mergeFxInstances(c,globalTime-c.start)))
for(const t of [5,5.1,5.5,6,7])assert.deepEqual(pixels(right,t),pixels(clip,t),`right split continuity at ${t}`)
for(const t of [4,4.2,4.8])assert.deepEqual(pixels(left,t),pixels(clip,t),`left split continuity at ${t}`)
assert.equal(split.right[0].keys.ngIntensity[0].v,.25)
const base={start:10,effects:inst.params}
assert.deepEqual(pixels(base,11),NG.renderGlitchRGBA(source,32,24,1,NG.recipeFromEffect(inst.params)),'standalone NG follows clip-local time')
console.log('PASS split effect keys, source clock, left/right pixel continuity and standalone clip-local NG timing')
