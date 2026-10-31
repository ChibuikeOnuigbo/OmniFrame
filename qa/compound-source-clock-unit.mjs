import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const dir='.cache/speed-clock-qa';fs.mkdirSync(dir,{recursive:true})
if(!fs.existsSync(dir+'/moving-source.mp4'))execFileSync(ffmpegExe(),['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=4','-c:v','libx264','-pix_fmt','yuv420p',dir+'/moving-source.mp4'])
const call=async(name,p={})=>{const r=await registry.call(name,p);assert(r.ok,JSON.stringify(r.data));return r.data}
await call('project_new',{w:320,h:180,duration:4,fps:24})
const clip=await call('import_video',{path:dir+'/moving-source.mp4',fps:24,fit:'contain'})
await call('clip_stretch',{clipId:clip.clipId,duration:2});await call('clip_move_time',{clipId:clip.clipId,start:.75})
await call('snapshot',{time:.75,out:dir+'/compound-first.png'})
await call('snapshot',{time:1.25,out:dir+'/compound-before.png'})
const comp=await call('compound_clip_create',{ids:[clip.clipId],name:'clock test',nest:true})
await call('snapshot',{time:1.25,out:dir+'/compound-after.png'})
assert.deepEqual(fs.readFileSync(dir+'/compound-after.png'),fs.readFileSync(dir+'/compound-before.png'),'compound created after zero preserves media timing')
await call('clip_move_time',{clipId:comp.id,start:1.5})
await call('edit_element',{clipId:comp.id,patch:{speedCurve:'hold-then-go'}})
await call('snapshot',{time:2,out:dir+'/compound-hold.png'})
assert.deepEqual(fs.readFileSync(dir+'/compound-hold.png'),fs.readFileSync(dir+'/compound-first.png'),'compound curve remaps nested sequence clock')
assert.equal((await registry.call('uncompound_clip',{id:comp.id})).ok,false,'retimed ungroup must not silently discard source timing')
await call('edit_element',{clipId:comp.id,patch:{speedCurve:null}})
await call('uncompound_clip',{id:comp.id})
const state=await call('inspect');assert.equal(state.clips[0].start,1.5)
await call('snapshot',{time:2,out:dir+'/compound-restored.png'})
assert.deepEqual(fs.readFileSync(dir+'/compound-restored.png'),fs.readFileSync(dir+'/compound-before.png'),'ungroup restores new timeline position')
console.log('PASS nonzero compound creation, nested hold clock, safe retime rejection and moved ungroup timing')
