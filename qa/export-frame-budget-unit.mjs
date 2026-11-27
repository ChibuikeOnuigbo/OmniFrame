import assert from 'node:assert/strict'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const {nextExportFrameTime}=await loadAppTs('src/lib/exportFrameBudget.ts')
for(const hz of [60,120,144,240]){
 let previous=-Infinity,count=0
 for(let i=0;i<=hz*2;i++){const next=nextExportFrameTime(i*1000/hz,previous);if(next!==null){count++;previous=next}}
 assert.ok(count>=60&&count<=61,`${hz} Hz: ${count} captures`)
}
assert.equal(nextExportFrameTime(16,0),null)
assert.equal(nextExportFrameTime(10000,0),10000,'long stall coalesces missed slots')
assert.equal(nextExportFrameTime(10001,10000),null,'no catch-up burst')
assert.equal(nextExportFrameTime(20,33),null,'early timestamp waits')
assert.ok(nextExportFrameTime(33.1,0)>33,'sub-millisecond jitter does not halve rate')
console.log('PASS 30 fps export budget across 60/120/144/240 Hz, jitter and stalls')
