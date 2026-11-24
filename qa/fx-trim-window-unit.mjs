import assert from 'node:assert/strict'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const { trimFxInstances, fxParamsAt, fxActiveAt, clampFxToClip } = await loadAppTs('src/lib/fxInstances.ts')
const fx = { id:'active', enabled:true, inP:1, duration:8, params:{blur:0}, keys:{blur:[{t:0,v:0},{t:4,v:20},{t:8,v:0}]}, sourceOffset:2 }
const done={...fx,id:'done',inP:0,duration:1}, future={...fx,id:'future',inP:9,duration:2}
const saved=JSON.stringify([done,fx,future])
const kept=trimFxInstances([done,fx,future],3,4)
assert.deepEqual(kept.map(f=>f.id),['active'])
assert.equal(kept[0].inP,0);assert.equal(kept[0].duration,4);assert.equal(kept[0].sourceOffset,4)
for(let t=0;t<4;t+=.031)assert.ok(Math.abs(fxParamsAt(kept[0],t).blur-fxParamsAt(fx,t+3).blur)<1e-9)
const twice=trimFxInstances(kept,1,2)[0]
assert.equal(fxParamsAt(twice,.5).blur,fxParamsAt(fx,4.5).blur)
assert.equal(JSON.stringify([done,fx,future]),saved)
assert.ok(Math.abs(trimFxInstances([fx],8.98,.02)[0].duration-.02)<1e-12)
assert.deepEqual(clampFxToClip(2,3,.05),{inP:0,duration:.05})
assert.deepEqual(clampFxToClip(NaN,Infinity,2),{inP:0,duration:.1})
assert.deepEqual(clampFxToClip(2,3,0),{inP:0,duration:0})
const extended=trimFxInstances([fx],-2,14)[0]
assert.equal(extended.inP,3);assert.equal(fxActiveAt(extended,2),false)
assert.deepEqual(trimFxInstances([fx],12,2),[])
assert.equal(trimFxInstances(undefined,0,2),undefined)
console.log('PASS completed/future effects removed, surviving keys and clocks preserved, repeated trims, short fragments and extension')
