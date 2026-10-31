/** One active shared-compositor frame per recipe, not full-motion acceptance.
 * Uses universal tools exclusively. The separate kernel suite covers timing,
 * determinism, alpha and bypass; full 4s MP4s keep their own resumable queue. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawn,execFileSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe,loadImage,makeCanvas} from '../tools/mcp/core.mjs'
const call=async(tool,params={})=>{const r=await registry.call(tool,params);if(!r.ok)throw Error(`${tool}: ${r.data?.error}`);return r.data}
const entries=JSON.parse(fs.readFileSync('public/effects/glitch-recipes.json','utf8')),out='qa-output/glitch-v2'
fs.mkdirSync(out,{recursive:true});fs.mkdirSync('.cache',{recursive:true})
await call('project_new',{w:320,h:180,fps:30,duration:4,bg:'#0b1020'})
await call('new_background',{kind:'studio'})
const title=await call('create_text',{text:'OMNIFRAME',preset:'plain',x:0,y:0})
await call('edit_element',{clipId:title.clipId,patch:{textStyle:{fontSize:26,bold:true,color:'#d9efff',glowBlur:0}}})
const fx=await call('fx_add',{clipId:title.clipId,catalogId:'ng-digital-slice'})
const video=`${out}/all-5000-compositor-diagnostic.mp4`
const encoder=spawn(ffmpegExe(),['-y','-v','error','-f','image2pipe','-framerate','6','-i','-','-an','-c:v','libx264','-threads','1','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',video],{stdio:['pipe','ignore','pipe']})
let stderr='';encoder.stderr.on('data',d=>stderr+=d)
const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(Error(stderr)))})
const manifest=[],sheet=makeCanvas(1280,10*180),sx=sheet.getContext('2d')
try{
 for(const [index,e]of entries.entries()){
  await call('fx_update',{clipId:title.clipId,fxId:fx.fxId,params:e.patch})
  const time=e.patch.ngLead+e.patch.ngAttack+e.patch.ngHold*.5
  const image=await call('snapshot',{time,out:'.cache/glitch-pack-probe.png'}),bytes=fs.readFileSync(image.png)
  const im=await loadImage(bytes)
  if(im.width!==320||im.height!==180)throw Error(`${e.id}: incorrect output size`)
  manifest.push({id:e.id,name:e.name,frame:index,time,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})
  if(!encoder.stdin.write(bytes))await new Promise(resolve=>encoder.stdin.once('drain',resolve))
  if(index%125===0)sx.drawImage(im,index/125%4*320,Math.floor(index/500)*180)
  if((index+1)%250===0)console.log(`COMPOSITOR ${index+1}/5000`)
 }
 encoder.stdin.end();await done
 execFileSync(ffmpegExe(),['-v','error','-i',video,'-f','null','-'])
 fs.writeFileSync(`${out}/compositor-manifest.json`,JSON.stringify({kind:'One active frame per authored recipe through universal snapshot + shared app compositor; not full-motion or perceptual-quality acceptance',count:manifest.length,resolution:[320,180],reviewFramesPerSecond:6,manifest},null,2))
 fs.writeFileSync('qa-output/screenshots/glitch-compositor-contact-sheet.png',sheet.toBuffer('image/png'))
 console.log(`PASS ${manifest.length} shared-compositor recipe renders; diagnostic video decodes`)
}catch(error){encoder.kill();throw error}
