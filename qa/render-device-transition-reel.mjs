/** Real PreviewEngine + decoded video + FFmpeg. Original FFmpeg testsrc footage. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync,spawn,spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
const require=createRequire(import.meta.url),ff=require('@ffmpeg-installer/ffmpeg').path
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'qa-output/device-transitions')
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'.cache'),{recursive:true})
const source=path.join(root,'qa-output/original-demo-source.webm')
execFileSync(ff,['-y','-v','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=30:duration=5','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=5','-c:v','libvpx','-threads','2','-b:v','1600k','-c:a','libvorbis','-shortest',source])
await inflate(path.join(root,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${path.join(os.tmpdir(),'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']})
const WIDTH = Number(process.env.RENDER_WIDTH || 960), HEIGHT = WIDTH*9/16
if(!Number.isInteger(WIDTH)||!Number.isInteger(HEIGHT)||WIDTH%2||HEIGHT%2)throw Error('Use an even 16:9 render width')
const jobs=[
 ['phone-pop-in','device_phone','phone_modern_black','pop-in'],
 ['phone-rotate-reveal','device_phone','phone_modern_silver','rotate-reveal'],
 ['monitor-swing-in','device_monitor','monitor_gaming_black','swing-in'],
 ['monitor-fullscreen-burst','device_monitor','monitor_clean_office','fullscreen-burst'],
 ['tv-static-reveal','device_tv','tv_flat_black','static-reveal'],
 ['laptop-open-reveal','device_laptop','laptop_open_dark','laptop-reveal'],
 ['device-to-fullframe','device_phone','phone_frameless_dark','push'],
 ['fullframe-to-device','device_monitor','monitor_clean_office','pullback'],
 ['phone-spin-reveal','device_phone','phone_modern_black','spin-reveal'],
 ['phone-barrel-roll','device_phone','phone_modern_silver','barrel-roll'],
 ['monitor-drop-bounce','device_monitor','monitor_gaming_black','drop-bounce'],
 ['multi-device-wall','device_monitor','monitor_gaming_black','device-wall'],
]
const manifest=[]
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.waitForFunction(()=>window.__omniframe_store)
 await page.evaluate(async({WIDTH,HEIGHT})=>{
  const g=window.__omniframe_store
  g.setState({clips:[],assets:[],tracks:[],transitions:[],drawingStrokes:[],playing:false,visualPreview:null,playhead:0})
  const c=document.createElement('canvas');c.width=1920;c.height=1080;const x=c.getContext('2d'),gradient=x.createLinearGradient(0,0,1920,1080);gradient.addColorStop(0,'#18263b');gradient.addColorStop(1,'#283c52');x.fillStyle=gradient;x.fillRect(0,0,1920,1080)
  x.fillStyle='#b9d8ef';x.font='bold 110px sans-serif';x.fillText('OMNIFRAME',100,200);x.font='40px sans-serif';x.fillText('Original motion and live video study',106,270)
  g.getState().addAsset({id:'qa-out',name:'Original demo title',kind:'image',url:c.toDataURL(),width:1920,height:1080,duration:3,size:5000})
  g.getState().addAsset({id:'qa-in',name:'Original moving test pattern',kind:'video',url:'/qa-output/original-demo-source.webm',width:1280,height:720,duration:5,size:500000})
  const track=g.getState().ensureTrack('video');g.getState().addClipToTrack(track,'qa-out',0);let a=g.getState().selectedClipId;g.getState().setClipProp(a,{duration:3})
  g.getState().addClipToTrack(track,'qa-in',3);let b=g.getState().selectedClipId;g.getState().setClipProp(b,{start:3,duration:3,inPoint:1})
  g.getState().setSequenceAspectRatio('custom',WIDTH,HEIGHT);g.getState().setPreviewQuality('full');g.getState().setProjectFps(30)
  g.getState().addTransition({type:'device_phone',fromClipId:a,toClipId:b,trackId:track,startTime:2.2,duration:1.6,alignment:'centered',enabled:true})
  const {prepareDeviceModels}=await import('/src/lib/device3d.ts');await prepareDeviceModels()
  g.getState().setPlayhead(2.2)
 },{WIDTH,HEIGHT})
 await page.waitForTimeout(800)
 const contactFrames=[]
 for(const [name,type,model,motion] of (process.argv.includes('--export-only') ? [] : jobs)){
  await page.evaluate(({type,model,motion})=>{const s=window.__omniframe_store.getState();s.updateTransition(s.transitions[0].id,{type,parameters:{model,motion,fit:'cover'}})}, {type,model,motion})
  const file=path.join(out,`${name}.mp4`),encoder=spawn(ff,['-y','-v','error','-f','image2pipe','-framerate','30','-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','ignore','pipe']})
  let encodingError='';encoder.stderr.on('data',d=>encodingError+=d)
  const exited=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',(code,signal)=>code===0?resolve():reject(Error(`Encoder exited ${code} (${signal}): ${encodingError}`)))})
  for(let i=0;i<49;i++){
   const t=2.2+1.6*i/48
   await page.evaluate(t=>window.__omniframe_store.getState().setPlayhead(t),t)
   await page.waitForTimeout(65)
   const frame=await page.evaluate(()=>document.querySelector('#of-canvas').toDataURL('image/png'))
   const bytes=Buffer.from(frame.split(',')[1],'base64')
   if(!encoder.stdin.write(bytes))await new Promise(resolve=>encoder.stdin.once('drain',resolve))
   if([0,7,14,24,34,41,48].includes(i)){const still=path.join(out,`${name}-${i}.png`);fs.writeFileSync(still,bytes);contactFrames.push({name,i,file:path.relative(root,still)})}
  }
  encoder.stdin.end();await exited
  execFileSync(ff,['-v','error','-i',file,'-f','null','-'],{stdio:'pipe'})
  manifest.push({file:path.relative(root,file),name,model,motion,renderer:'actual browser PreviewEngine with loaded GLB and decoded moving video',resolution:[WIDTH,HEIGHT],fps:30,frames:49,sourceLicense:'original FFmpeg testsrc2 and original title card'})
  console.log('RENDERED',name)
 }
 // Exercise the product's MediaRecorder path twice, at a lower saved preview
 // quality, to catch stale init segments and ensure quality restoration.
 await page.mouse.click(600,20)
 await page.evaluate(()=>{const g=window.__omniframe_store;g.getState().setPreviewQuality('medium');g.setState({exportRange:{in:2.2,out:3.8}})})
 const nativeExports=[]
 for(let index=1;index<=2;index++){
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.evaluate(async()=>{const {exportVideo}=await import('/src/lib/export.ts');await exportVideo()})])
  const file=path.join(out,`editor-export-${index}.${download.suggestedFilename().split('.').pop()}`);await download.saveAs(file)
  execFileSync(ff,['-v','error','-i',file,'-f','null','-'],{stdio:'pipe'})
  const probe=spawnSync(ff,['-hide_banner','-i',file,'-f','null','-'],{encoding:'utf8'})
  const m=probe.stderr.match(/Duration: (\d+):(\d+):([0-9.]+)/)
  assert.ok(m,'Export has a readable duration')
  const duration=Number(m[1])*3600+Number(m[2])*60+Number(m[3])
  assert.ok(duration>1.1&&duration<2.4,`1.6s range duration drifted: ${duration}s`)
  assert.match(probe.stderr,/Audio:/,'Every export contains audio')
  const raw=execFileSync(ff,['-v','error','-i',file,'-vn','-f','f32le','-ac','1','-ar','48000','-'])
  let energy=0;for(let i=0;i<raw.length;i+=4)energy+=raw.readFloatLE(i)**2
  const rms=Math.sqrt(energy/(raw.length/4));assert.ok(rms>.005,`Export ${index} audio must not be silent: ${rms}`)
  nativeExports.push({file:path.relative(root,file),duration,requestedDuration:1.6,audioRms:rms})
  assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().previewQuality),'medium')
 }
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(out,'native-export-manifest.json'),JSON.stringify(nativeExports,null,2))
 if(manifest.length){
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({manifest,contactFrames,pageErrors:errors,note:'Offline sequence is rendered at 960x540/30fps by default because this cloud uses software WebGL. Use RENDER_WIDTH=1920 for full-HD regeneration. Pullback puts the outgoing video on the device and reveals the incoming frame behind it.'},null,2))
 const list=path.join(root,'.cache/device-concat.txt');fs.writeFileSync(list,manifest.map(m=>`file '${path.resolve(root,m.file)}'`).join('\n'))
 execFileSync(ff,['-y','-v','error','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',path.join(out,'combined-device-demo.mp4')])
 }
 console.log('PASS actual live-video device renders and two independently decodable editor exports')
}finally{await browser.close()}
