import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import ffmpeg from '@ffmpeg-installer/ffmpeg'
import {PNG} from 'pngjs'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const out='qa-output/clean-three-export';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setPreviewQuality('full');s.setCustomSequenceDimensions(1280,720)
  const media=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob()
  s.addAsset({id:'coast',name:'Coast footage',kind:'video',url:URL.createObjectURL(media),duration:8,width:1280,height:720,size:media.size});s.addClipToTrack(s.ensureTrack('video'),'coast',0)
  const c=window.__omniframe_store.getState().clips[0];s.setClipProp(c.id,{duration:2});s.recomputeDuration()
  s.setClipKeyframe(c.id,'wheel_rotation',0,0,'linear');s.setClipKeyframe(c.id,'wheel_rotation',2,180,'linear')
  s.addScene3DObject({id:'clean-cube',name:'Clean cube',type:'cube',position:{x:.7,y:0,z:1},rotation:{x:.2,y:.3,z:0},scale:{x:.7,y:.7,z:.7},color:'#53c7e8',roughness:.5,metalness:.1});s.setIs3DMode(true);s.setPlayhead(0)
 })
 await page.getByTestId('aim-composite-btn').click();await page.waitForTimeout(900)
 await page.evaluate(async()=>{window.threeBridge=await import('/src/lib/threeExportBridge.ts')})
 const direct=await page.evaluate(()=>{
  const view=document.getElementById('of-three-canvas'),before=view.toDataURL(),size=[view.width,view.height]
  window.cleanSession=window.threeBridge.beginThreeExport(1280,720);window.cleanSession.render()
  const landscape=window.cleanSession.canvas.toDataURL()
  return {landscape,viewportUnchanged:before===view.toDataURL(),viewportSize:size,outputSize:[window.cleanSession.canvas.width,window.cleanSession.canvas.height]}
 })
 assert.equal(direct.viewportUnchanged,true);assert.deepEqual(direct.outputSize,[1280,720])
 fs.writeFileSync(out+'/landscape.png',Buffer.from(direct.landscape.split(',')[1],'base64'))
 await page.getByTestId('grid-toggle-btn').click();await page.waitForTimeout(250)
 const guidesOff=await page.evaluate(()=>{window.cleanSession.render();return window.cleanSession.canvas.toDataURL()})
 assert.equal(guidesOff,direct.landscape,'export must be identical regardless of working grid visibility')
 await page.getByTestId('grid-toggle-btn').click();await page.waitForTimeout(250)
 const repeat=await page.evaluate(()=>{window.cleanSession.render();const same=window.cleanSession.canvas.toDataURL();window.cleanSession.dispose();window.cleanSession.dispose();let disposedRejects=false;try{window.cleanSession.render()}catch{disposedRejects=true}return {same,disposedRejects}})
 assert.equal(repeat.same,direct.landscape);assert.equal(repeat.disposedRejects,true)
 const portrait=await page.evaluate(()=>{const session=window.threeBridge.beginThreeExport(720,1280);try{session.render();return session.canvas.toDataURL()}finally{session.dispose()}})
 fs.writeFileSync(out+'/portrait.png',Buffer.from(portrait.split(',')[1],'base64'))
 for(const name of ['landscape','portrait']){
  const p=PNG.sync.read(fs.readFileSync(out+'/'+name+'.png'))
  const pixel=(x,y)=>Array.from(p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+3))
  for(const [x,y]of [[1,1],[p.width-2,1],[1,p.height-2],[p.width-2,p.height-2]])assert.ok(pixel(x,y).some(v=>v>2),'scene background must fill corners, without black padding')
 }
 await page.screenshot({path:out+'/working-viewport.png'})
 const exports=[]
 for(const [width,height]of [[1280,720],[720,1280]]){
  await page.evaluate(({width,height})=>{const s=window.__omniframe_store.getState();s.setCustomSequenceDimensions(width,height);s.setPlayhead(0)},{width,height});await page.waitForTimeout(300)
  const next=page.waitForEvent('download',{timeout:30000}),start=Date.now()
  await page.evaluate(async()=>{await(await import('/src/lib/export.ts')).exportVideo({format:'webm'})})
  const d=await next,file=out+'/'+width+'x'+height+'.webm';await d.saveAs(file);const exportMs=Date.now()-start
  execFileSync(ffmpeg.path,['-v','error','-xerror','-i',file,'-vsync','0','-enc_time_base','-1','-f','null','-'])
  execFileSync(ffmpeg.path,['-v','error','-y','-ss','1','-i',file,'-frames:v','1',out+'/'+width+'x'+height+'-frame.png'])
  const decoded=PNG.sync.read(fs.readFileSync(out+'/'+width+'x'+height+'-frame.png'));assert.equal(decoded.width,width);assert.equal(decoded.height,height)
  exports.push({width,height,exportMs,exportAndVerificationMs:Date.now()-start})
 }
 const cancelled=await page.evaluate(async()=>{const s=window.__omniframe_store.getState();s.setPreviewQuality('low');const controller=new AbortController();const message=await(await import('/src/lib/export.ts')).exportVideo({signal:controller.signal,onStatus:status=>{if(status.startsWith('Recording'))controller.abort()}}).then(()=> 'unexpected success',e=>e.name);return {message,quality:window.__omniframe_store.getState().previewQuality}})
 assert.deepEqual(cancelled,{message:'AbortError',quality:'low'})
 await page.evaluate(()=>{window.orphanSession=window.threeBridge.beginThreeExport(640,360)})
 const closedDuringExport=await page.evaluate(async()=>{
  return(await import('/src/lib/export.ts')).exportVideo({onStatus:status=>{if(status.startsWith('Recording'))window.__omniframe_store.getState().setIs3DMode(false)}}).then(()=> 'unexpected success',e=>e.message)
 })
 assert.match(closedDuringExport,/3D export renderer is unavailable/)

 await page.waitForTimeout(300)
 const unmounted=await page.evaluate(()=>{let disposed=false,unregistered=false;try{window.orphanSession.render()}catch{disposed=true}try{window.threeBridge.beginThreeExport(640,360)}catch{unregistered=true}return {disposed,unregistered}})
 assert.deepEqual(unmounted,{disposed:true,unregistered:true})
 assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/report.json',JSON.stringify({viewportUnchanged:direct.viewportUnchanged,viewportSize:direct.viewportSize,outputSize:direct.outputSize,guidesInvariant:true,disposedRejects:true,cancelled,closedDuringExport,unmounted,exports,errors,scope:'Same live Three.js scene, separate output camera and renderer; one cube and real video plane in software Chromium.'},null,2));console.log({exports,cancelled,unmounted})
}finally{await browser.close()}
