import assert from 'node:assert/strict'
import fs from 'node:fs'
import {loadAppTs} from '../tools/mcp/appRender.mjs'
const {clamp, maxTimelineZoom, timelineRulerMode}=await loadAppTs('src/lib/time.ts')
const {resolveMarkerTime,searchMarkers}=await loadAppTs('src/lib/markers.ts')
const started=performance.now();let count=0
// 200 durations × 100 starts × 1000 pointer positions = 20 million
// numerical boundary cases, not browser interactions or rendered exports.
for(let d=1;d<=200;d++)for(let start=0;start<100;start++)for(let pointer=-100;pointer<900;pointer++){
 const duration=d/4, value=start/10+pointer/100, t=clamp(value,0,duration)
 assert(Number.isFinite(t)&&t>=0&&t<=duration)
 if(value>=0&&value<=duration)assert.equal(t,value)
 count++
}
for(const fps of [23.976,24,25,29.97,30,50,59.94,60,120])for(const zoom of [8,50,300,8000,12000,32000])assert(['clock','frame','millisecond'].includes(timelineRulerMode(zoom,fps)))
assert.equal(maxTimelineZoom(20),32000)
const clips=[{id:'c',start:8,name:'Piano'}], markers=[{id:'m',time:2,label:'Opening cue',notes:'Entrance',clipId:'c',clipOffset:1,color:'#fff'}]
assert.equal(resolveMarkerTime(markers[0],clips),9)
assert.equal(searchMarkers(markers,clips,'piano entrance')[0].time,9)
const result={numericBoundaryCases:count,failed:0,elapsedMs:performance.now()-started,scope:'seek clamping only; not 20 million UI scenarios'}
fs.mkdirSync('ultimate tests',{recursive:true});fs.writeFileSync('ultimate tests/numeric-matrix.json',JSON.stringify(result,null,2));console.log(result)
