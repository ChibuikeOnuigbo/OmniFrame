import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
import {buildStudioLooks} from '../src/lib/studioLooks.ts'
const dir='effect_vid', fps=12,duration=2
fs.mkdirSync(dir+'/clips',{recursive:true})
const call=async(name,args)=>{const r=await registry.call(name,args);if(!r.ok)throw Error(JSON.stringify(r.data));return r.data}
const source=dir+'/moving-source.mp4'
if(!fs.existsSync(source))execFileSync(ffmpegExe(),['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=2','-c:v','libx264','-pix_fmt','yuv420p',source])
const rows=[]
for(const [index,look] of buildStudioLooks().entries()){
 const out=dir+'/clips/'+look.id+'.mp4'
 await call('project_new',{w:320,h:180,fps,duration,bg:'#10151d'})
 const video=await call('import_video',{path:source,start:0,duration})
 await call('edit_element',{clipId:video.clipId,patch:{effects:look.patch,volume:0}})
 const title=await call('create_text',{text:`${index+1}/1152  ${look.name}`,preset:'plain',x:0,y:73})
 await call('edit_element',{clipId:title.clipId,patch:{textStyle:{fontSize:10,color:'#ffffff',bold:true,shadowMode:'outer',shadowColor:'#000000',shadowBlur:2}}})
 if(!fs.existsSync(out))await call('render_export',{out,fps,duration,audio:false})
 const decoded=execFileSync(ffmpegExe(),['-v','error','-i',out,'-f','framemd5','-'],{maxBuffer:2e6}).toString().split('\n').filter(l=>l&&!l.startsWith('#'))
 if(decoded.length!==24)throw Error(`${look.id}: expected24 frames, got${decoded.length}`)
 const distinct=new Set(decoded.map(l=>l.split(',').at(-1).trim())).size
 if(distinct<12)throw Error(`${look.id}: insufficient motion: ${distinct}`)
 rows.push({id:look.id,name:look.name,patch:look.patch,path:out,frames:decoded.length,distinctFrames:distinct,start:index*duration,duration,sha256:createHash('sha256').update(fs.readFileSync(out)).digest('hex')})
 if(index%12===11){fs.writeFileSync(dir+'/manifest.json',JSON.stringify({complete:false,fps,width:320,height:180,recipes:rows},null,2));console.log('Verified',index+1,'/1152')}
}
fs.writeFileSync(dir+'/concat.txt',rows.map(r=>`file 'clips/${r.id}.mp4'`).join('\n'))
execFileSync(ffmpegExe(),['-y','-v','error','-f','concat','-safe','0','-i',dir+'/concat.txt','-c','copy','-movflags','+faststart',dir+'/all-1152-studio-effects.mp4'])
fs.writeFileSync(dir+'/manifest.json',JSON.stringify({complete:true,fps,width:320,height:180,totalFrames:rows.length*24,duration:rows.length*2,recipes:rows},null,2))
console.log('COMPLETE',rows.length,'moving clips and combined video')
