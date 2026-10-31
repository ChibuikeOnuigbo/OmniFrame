import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {ffmpegExe} from '../tools/mcp/core.mjs'
import {registry} from '../tools/mcp/tools.mjs'
import {hasAudio,audioMixPlan} from '../tools/mcp/audioExport.mjs'
const dir='.cache/audio-export-qa';fs.mkdirSync(dir,{recursive:true})
const ff=(args)=>execFileSync(ffmpegExe(),['-v','error',...args],{maxBuffer:20*1024*1024})
const call=async(name,p={})=>{const r=await registry.call(name,p);assert(r.ok,JSON.stringify(r.data));return r.data}
const audible={sourceVideo:{path:'fixture.mp4',hasAudio:true},start:0,duration:1,volume:1}
assert.throws(()=>audioMixPlan({clips:[{...audible,speedCurve:'ramp'}]},1),/speed curves/)
assert.throws(()=>audioMixPlan({clips:[{...audible,effects:{freezeHold:.5}}]},1),/audio time effects/)
assert.throws(()=>audioMixPlan({clips:[{childSeq:{clips:[audible],duration:1}}]},1),/compound audio/)
assert.deepEqual(audioMixPlan({clips:[{volume:0,childSeq:{clips:[audible],duration:1}}]},1),[])
ff(['-y','-f','lavfi','-i','testsrc2=size=96x64:rate=12:duration=2','-f','lavfi','-i','aevalsrc=0.2*sin(2*PI*(220*t+110*t*t)):s=48000:d=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',dir+'/source.mp4'])
await call('project_new',{w:96,h:64,fps:12,duration:2.5})
const a=await call('import_video',{path:dir+'/source.mp4',fps:12});assert(a.hasAudio)
await call('edit_element',{clipId:a.clipId,patch:{inPoint:.5,volume:.25}})
await call('clip_move_time',{clipId:a.clipId,start:.25});await call('clip_stretch',{clipId:a.clipId,duration:1})
const b=await call('import_video',{path:dir+'/source.mp4',fps:12})
await call('edit_element',{clipId:b.clipId,patch:{inPoint:.25,volume:.5}})
await call('clip_move_time',{clipId:b.clipId,start:.75});await call('clip_stretch',{clipId:b.clipId,duration:.5})
await call('render_export',{out:dir+'/mixed.mp4'})
const floats=(file)=>{const buf=ff(['-i',file,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','-']);return new Float32Array(buf.buffer,buf.byteOffset,buf.length/4)}
const source=floats(dir+'/source.mp4'), mixed=floats(dir+'/mixed.mp4')
const rms=(x,a,b)=>Math.sqrt(x.subarray(Math.round(a*48000),Math.round(b*48000)).reduce((s,v)=>s+v*v,0)/Math.round((b-a)*48000))
assert(rms(mixed,.03,.2)<.001,'leading silence')
assert(rms(mixed,1.35,2.3)<.001,'trailing silence')
assert(Math.abs(rms(mixed,.35,.65)/rms(source,.6,.9)-.25)<.025,'clip gain and unnormalized mix')
let dot=0,aa=0,bb=0
for(let i=4800;i<19200;i++){const x=source[24000+i]*.25,y=mixed[12000+i];dot+=x*y;aa+=x*x;bb+=y*y}
const correlation=dot/Math.sqrt(aa*bb);assert(correlation>.98,`trim/delay audio correlation ${correlation}`)
let mixError=0,mixSignal=0
for(let i=40800;i<55200;i++){
  const expected=source[i-12000+24000]*.25+source[i-36000+12000]*.5
  mixError+=(mixed[i]-expected)**2;mixSignal+=expected**2
}
assert(mixError/mixSignal<.01,'overlapping clips retain summed gain and independent source offsets')
// A source trim must select the same moving pixels, in fast and layered paths.
await call('select',{clipId:a.clipId});await call('edit_element',{clipId:b.clipId,patch:{opacity:0}})
await call('snapshot',{time:.25,out:dir+'/trimmed.png'})
await call('edit_element',{clipId:a.clipId,patch:{inPoint:0}})
await call('snapshot',{time:.75,out:dir+'/untrimmed.png'})
assert.deepEqual(fs.readFileSync(dir+'/trimmed.png'),fs.readFileSync(dir+'/untrimmed.png'))
await call('mask_draw',{shape:'rectangle',x0:8,y0:8,x1:88,y1:56})
await call('snapshot',{time:.75,out:dir+'/layer-untrimmed.png'})
await call('edit_element',{clipId:a.clipId,patch:{inPoint:.5}})
await call('snapshot',{time:.25,out:dir+'/layer-trimmed.png'})
assert.deepEqual(fs.readFileSync(dir+'/layer-trimmed.png'),fs.readFileSync(dir+'/layer-untrimmed.png'))
for(const id of [a.clipId,b.clipId])await call('edit_element',{clipId:id,patch:{volume:0}})
const muted=await call('render_export',{out:dir+'/muted.mp4'});assert.equal(muted.audio.tracks,0)
assert.equal(hasAudio(dir+'/muted.mp4'),false)
const invalid=await registry.call('edit_element',{clipId:a.clipId,patch:{volume:-1}});assert(!invalid.ok)
await call('project_new',{w:96,h:64,fps:12,duration:2})
const original=await call('import_video',{path:dir+'/source.mp4',fps:12})
await call('snapshot',{time:1,out:dir+'/expected-offset.png'})
const copy=await call('duplicate_paste',{copy:true})
await call('edit_element',{clipId:copy.clipId,patch:{inPoint:1}})
await call('snapshot',{time:0,out:dir+'/copy-offset.png'})
assert.deepEqual(fs.readFileSync(dir+'/copy-offset.png'),fs.readFileSync(dir+'/expected-offset.png'),'duplicate owns its source offset')
await call('edit_element',{clipId:copy.clipId,patch:{opacity:0,volume:0}})
// Replacement window clamps to clip length; shorten first to expose its offset.
await call('clip_stretch',{clipId:original.clipId,duration:1})
await call('replace_video',{clipId:original.clipId,path:dir+'/source.mp4',windowStart:1,fps:12})
await call('snapshot',{time:0,out:dir+'/replacement-offset.png'})
assert.deepEqual(fs.readFileSync(dir+'/replacement-offset.png'),fs.readFileSync(dir+'/expected-offset.png'),'replacement uses its source window')
const replaced=await call('render_export',{out:dir+'/replacement.mp4',duration:1});assert.equal(replaced.audio.tracks,1)
console.log(JSON.stringify({pass:true,correlation,relativeOverlapError:mixError/mixSignal,leadingRms:rms(mixed,.03,.2),trailingRms:rms(mixed,1.35,2.3),gain:rms(mixed,.35,.65)/rms(source,.6,.9),mutedTracks:muted.audio.tracks}))
