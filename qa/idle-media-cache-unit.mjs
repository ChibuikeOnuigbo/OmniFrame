import assert from 'node:assert/strict'
import {loadAppTs} from '../tools/mcp/appRender.mjs'
const {pruneIdleMedia}=await loadAppTs('src/lib/idleMediaCache.ts')
const values=Array.from({length:100},(_,id)=>({id})), cache=new Map(values.map(v=>[String(v.id),v])),released=[]
pruneIdleMedia(cache,new Set([values[0],values[99]]),v=>released.push(v))
assert.equal(cache.size,16);assert.equal(released.length,84);assert.ok(cache.has('0')&&cache.has('99'));assert.ok(!cache.has('1'))
const active=new Set(cache.values());pruneIdleMedia(cache,active,()=>assert.fail('released active media'),2);assert.equal(cache.size,16)
pruneIdleMedia(cache,new Set(),()=>{},0);assert.equal(cache.size,0)
console.log('PASS bounded inactive cache, oldest eviction, active-layer retention and empty cleanup')
