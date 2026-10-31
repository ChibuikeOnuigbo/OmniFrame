/** Real media sampling through universal tools: all 15 shared source clocks. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
import {SPEED_CURVES,remapClipLocal} from '../src/lib/speedCurves.ts'
const dir='evidence_video/speed-curves',cache='.cache/speed-clock-qa'
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(cache,{recursive:true})
const call=async(name,p={})=>{const r=await registry.call(name,p);assert(r.ok,JSON.stringify(r.data));return r.data}
execFileSync(ffmpegExe(),['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=4','-c:v','libx264','-pix_fmt','yuv420p',cache+'/moving-source.mp4'])
const names=await call('list_presets',{catalog:'speed',limit:30})
assert.deepEqual(names.entries.map(c=>c.id),SPEED_CURVES.map(c=>c.id))
const manifest=[]
for(const {id} of SPEED_CURVES){
 await call('project_new',{w:320,h:180,fps:24,duration:2.25})
 const base=await call('import_video',{path:cache+'/moving-source.mp4',fps:24,fit:'contain'})
 const clip=await call('duplicate_paste',{copy:true})
 await call('clip_move_time',{clipId:clip.clipId,start:.25});await call('clip_stretch',{clipId:clip.clipId,duration:2})
 await call('edit_element',{clipId:clip.clipId,patch:{inPoint:.5,speedCurve:id}})
 const comparisons=[]
 for(const local of [.23,.61,1.1,1.7]){
  const expectedSource=.5+remapClipLocal({speedCurve:id,duration:2},local)
  for(const layered of [false,true]){
   await call('select',{clipId:clip.clipId})
   if(layered)await call('mask_draw',{shape:'rectangle',x0:0,y0:0,x1:320,y1:180})
   else await call('mask_clear')
   await call('edit_element',{clipId:base.clipId,patch:{opacity:0}})
   await call('edit_element',{clipId:clip.clipId,patch:{opacity:1}})
   await call('snapshot',{time:.25+local,out:cache+'/actual.png'})
   await call('edit_element',{clipId:clip.clipId,patch:{opacity:0}})
   await call('edit_element',{clipId:base.clipId,patch:{opacity:1}})
   await call('snapshot',{time:expectedSource,out:cache+'/expected.png'})
   assert.deepEqual(fs.readFileSync(cache+'/actual.png'),fs.readFileSync(cache+'/expected.png'),`${id} / ${local} / layered=${layered}`)
   comparisons.push({local,expectedSource,layered,exactPixels:true})
  }
 }
 await call('edit_element',{clipId:base.clipId,patch:{opacity:0}});await call('edit_element',{clipId:clip.clipId,patch:{opacity:1}})
 await call('select',{clipId:clip.clipId});await call('mask_clear')
 const invalid=await registry.call('edit_element',{clipId:clip.clipId,patch:{speedCurve:'typo',inPoint:99}});assert(!invalid.ok)
 const inspect=await call('inspect');assert.equal(inspect.clips.find(c=>c.id===clip.clipId).inPoint,.5)
 await call('timeline_screenshot',{out:dir+'/'+id+'-timeline.png',playhead:1})
 await call('render_export',{out:dir+'/'+id+'.mp4',fps:24,duration:2.25,audio:false})
 const decoded=execFileSync(ffmpegExe(),['-v','error','-i',dir+'/'+id+'.mp4','-map','0:v:0','-f','framemd5','-'],{encoding:'utf8'})
 const hashes=decoded.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim())
 assert.equal(hashes.length,54);assert(new Set(hashes).size>8,'moving source unexpectedly static')
 manifest.push({id,comparisons,frames:hashes.length,distinctFrameHashes:new Set(hashes).size,file:dir+'/'+id+'.mp4',audio:'silent diagnostic; nonlinear audio time remapping remains unsupported'})
 console.log('PASS source clock pixels and moving export',id)
}
fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2))
console.log('PASS all 15 clocks: 120 exact media-pixel comparisons and 15 actual moving-video exports')
