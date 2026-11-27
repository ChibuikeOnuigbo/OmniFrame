import assert from 'node:assert/strict'
import {loadAppTs} from '../tools/mcp/appRender.mjs'
const {cleanupAll}=await loadAppTs('src/lib/cleanup.ts')
for(let failure=0;failure<8;failure++){
 const visited=[],error=new Error(`release ${failure}`)
 assert.throws(()=>cleanupAll(...Array.from({length:8},(_,i)=>()=>{
  visited.push(i);if(i===failure)throw error
 })),e=>e===error)
 assert.deepEqual(visited,[0,1,2,3,4,5,6,7])
}
let ran=false,caught=false
try{cleanupAll(()=>{throw undefined},()=>{ran=true;throw new Error('secondary')})}catch(e){caught=true;assert.equal(e,undefined)}
assert.equal(ran,true);assert.equal(caught,true)
assert.equal(cleanupAll(),undefined)
const first=new Error('first')
assert.throws(()=>cleanupAll(()=>{throw first},()=>{throw new Error('second')}),e=>e===first)
console.log('PASS every release attempted, original thrown value retained, empty cleanup')
