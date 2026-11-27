import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import ffmpeg from '@ffmpeg-installer/ffmpeg'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const out='qa-output/three-render-review/rotation-xy';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setIs3DMode(false);s.setCustomSequenceDimensions(1280,720);s.setPreviewQuality('full');s.addTextTitleClip('PERSPECTIVE',3)
  const c=window.__omniframe_store.getState().clips[0];s.setClipProp(c.id,{textStyle:{...c.textStyle,fontSize:90,color:'#ffffff',backgroundColor:'transparent'}})
  for(const [property,angle]of [['rotation_x',30],['rotation_y',60]]){s.setClipKeyframe(c.id,property,0,0,'ease-in-out');s.setClipKeyframe(c.id,property,1,angle,'ease-in-out');s.setClipKeyframe(c.id,property,2,0,'ease-in-out')}
  s.setPlayhead(0)
 })
 const frames=[]
 for(const t of [0,1,2]){
  await page.evaluate(t=>window.__omniframe_store.getState().setPlayhead(t),t);await page.waitForTimeout(400)
  const shot=await page.locator('#of-canvas').evaluate(c=>{
   const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);let minX=c.width,maxX=-1,minY=c.height,maxY=-1,count=0
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=(y*c.width+x)*4;if(data[p]>150&&data[p+1]>150&&data[p+2]>150){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++}}
   return {width:maxX-minX+1,height:maxY-minY+1,count,image:c.toDataURL()}
  })
  fs.writeFileSync(out+'/'+t+'.png',Buffer.from(shot.image.split(',')[1],'base64'));frames.push(shot)
 }
 assert.ok(frames[0].count>1000);assert.ok(frames[1].width<frames[0].width*.8,'Y rotation compresses projected text width');assert.equal(frames[0].image,frames[2].image,'return keys restore identical pixels')
 const d=page.waitForEvent('download',{timeout:30000});await page.evaluate(async()=>{await(await import('/src/lib/export.ts')).exportVideo({format:'webm'})});await(await d).saveAs(out+'/rotation-xy.webm')
 execFileSync(ffmpeg.path,['-v','error','-xerror','-i',out+'/rotation-xy.webm','-vsync','0','-enc_time_base','-1','-f','null','-'])
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({frames:frames.map(({image,...metrics})=>metrics),errors,scope:'Keyed projected X/Y text rotation, ease-in-out segments, exact return pose and native WebM decode; not volumetric geometry.'},null,2));console.log(frames.map(({image,...metrics})=>metrics))
}finally{await browser.close()}
