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
const out=process.env.OUT||'qa-output/three-render-review';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setCustomSequenceDimensions(1280,720);s.setPreviewQuality('full');s.addTextTitleClip('3D MOTION',4)
  s.addScene3DObject({id:'render-object',name:'Render cube',type:'cube',position:{x:0,y:0,z:1},rotation:{x:.2,y:.3,z:.1},scale:{x:1,y:1,z:1},color:'#53c7e8',roughness:.5,metalness:.1});s.setIs3DMode(true);s.setPlayhead(0)
 })
 await page.getByTestId('aim-object-btn').click();await page.waitForTimeout(700)
 const canvas=page.locator('#of-three-canvas'),frame=()=>canvas.evaluate(c=>c.toDataURL())
 const initial=await frame();await page.evaluate(()=>window.__omniframe_store.getState().play());await page.waitForTimeout(800)
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.pause();s.setPlayhead(0)});await page.waitForTimeout(500)
 const rewound=await frame(),rewindMatches=initial===rewound
 fs.writeFileSync(out+'/initial.png',Buffer.from(initial.split(',')[1],'base64'));fs.writeFileSync(out+'/rewound.png',Buffer.from(rewound.split(',')[1],'base64'))
 fs.writeFileSync(out+'/rewind.json',JSON.stringify({rewindMatches,scope:'Static title plane and fixed camera; compare actual WebGL canvas pixels at t=0 before/after playback.'},null,2))
 if(process.env.BASELINE==='1'){console.log({rewindMatches});process.exitCode=0}else{
  assert.equal(rewindMatches,true,'rewinding must restore the same 3D pose and pixels')
  const results=[]
  for(const quality of ['low','full']){
   await page.evaluate(q=>{const s=window.__omniframe_store.getState();s.pause();s.setPreviewQuality(q);s.setPlayhead(0)},quality);await page.waitForTimeout(400)
   results.push(await page.evaluate(async quality=>{
    const s=window.__omniframe_store.getState(),c=document.getElementById('of-three-canvas'),tasks=[],observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)))
    observer.observe({entryTypes:['longtask']});const n=Number(c.dataset.renderedFrames),start=performance.now();s.play();await new Promise(r=>setTimeout(r,2500));s.pause();observer.disconnect()
    return {quality,elapsedMs:performance.now()-start,renderSubmissions:Number(c.dataset.renderedFrames)-n,longTasks:tasks.length,maxLongTaskMs:Math.max(0,...tasks),width:c.width,height:c.height}
   },quality))
  }
  await page.evaluate(()=>{const s=window.__omniframe_store.getState(),clip=s.clips[0];s.setClipKeyframe(clip.id,'wheel_rotation',0,0,'linear');s.setClipKeyframe(clip.id,'wheel_rotation',4,360,'linear');s.setPlayhead(1)})
  await page.waitForTimeout(400);const keyed=await frame();await page.evaluate(()=>window.__omniframe_store.getState().setPlayhead(2));await page.waitForTimeout(400);assert.notEqual(await frame(),keyed,'keyed rotation changes 3D pixels')
  await page.evaluate(()=>window.__omniframe_store.getState().setPlayhead(1));await page.waitForTimeout(400);assert.equal(await frame(),keyed,'keyed pose is seek-stable')
  await page.evaluate(async()=>{
   const s=window.__omniframe_store.getState(),blob=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob()
   s.addAsset({id:'plane-video',name:'Video plane',kind:'video',url:URL.createObjectURL(blob),width:1280,height:720,duration:8,size:blob.size});s.addClipToTrack(s.createTrack('video','below',s.clips[0].trackId),'plane-video',0)
   const c=window.__omniframe_store.getState().clips.find(c=>c.assetId==='plane-video');s.setClipProp(c.id,{duration:4});s.setClipKeyframe(c.id,'wheel_rotation',0,0,'linear');s.setClipKeyframe(c.id,'wheel_rotation',4,360,'linear');s.recomputeDuration();s.setPlayhead(0)
  })
  // Isolate the plane so object rotation cannot fake a moving-footage pass.
  await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.updateScene3DObject('render-object',{position:{x:20,y:0,z:1}});s.setPlayhead(1)})
  await page.getByTestId('aim-video-btn').click();await page.waitForTimeout(700)
  const planeFirst=await frame();await page.evaluate(()=>window.__omniframe_store.getState().setPlayhead(2));await page.waitForTimeout(700)
  const planeSecond=await frame();assert.notEqual(planeFirst,planeSecond,'isolated 2.5D plane must show distinct decoded footage')
  fs.writeFileSync(out+'/plane-1.png',Buffer.from(planeFirst.split(',')[1],'base64'));fs.writeFileSync(out+'/plane-2.png',Buffer.from(planeSecond.split(',')[1],'base64'))
  await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.updateScene3DObject('render-object',{position:{x:0,y:0,z:1}});s.setPlayhead(0)})
  await page.getByTestId('aim-composite-btn').click();await page.waitForTimeout(600)
  const beforeVideo=await frame();await page.evaluate(()=>window.__omniframe_store.getState().play());await page.waitForTimeout(900);await page.evaluate(()=>window.__omniframe_store.getState().pause());assert.notEqual(await frame(),beforeVideo)
  await page.screenshot({path:out+'/composite.png'})
  const downloadPromise=page.waitForEvent('download',{timeout:30000}),start=Date.now()
  await page.evaluate(async()=>{await(await import('/src/lib/export.ts')).exportVideo({format:'webm'})})
  const download=await downloadPromise;await download.saveAs(out+'/three-composite.webm');const exportMs=Date.now()-start
  execFileSync(ffmpeg.path,['-v','error','-xerror','-i',out+'/three-composite.webm','-vsync','0','-enc_time_base','-1','-f','null','-'])
  execFileSync(ffmpeg.path,['-y','-v','error','-ss','1','-i',out+'/three-composite.webm','-frames:v','1',out+'/export-frame.png'])
  const project=await page.evaluate(async()=>Array.from(new Uint8Array(await(await window.__omniframe_store.getState().saveOmniProject('3D motion review')).arrayBuffer())))
  fs.writeFileSync(out+'/three-composite.omni',Buffer.from(project))
  const sculpt=await page.evaluate(async()=>{
   const s=window.__omniframe_store.getState(),dabs=Array.from({length:256},(_,i)=>({mode:i%2?'raise':'carve',point:{x:.65*Math.cos(i*.4),y:.35*Math.sin(i*.7),z:.3},normal:{x:0,y:0,z:1},radius:.2,strength:.15}))
   s.updateScene3DObject('render-object',{type:'sphere'});s.updateScene3DObject('render-object',{sculptDabs:dabs});s.setPlayhead(0)
   await new Promise(r=>setTimeout(r,500))
   const c=document.getElementById('of-three-canvas'),n=Number(c.dataset.renderedFrames),start=performance.now();s.play();await new Promise(r=>setTimeout(r,2000));s.pause()
   const extra=s.appendSceneSculpt('render-object',dabs[0])
   return {dabs:window.__omniframe_store.getState().scene3DObjects[0].sculptDabs.length,extraAccepted:extra,elapsedMs:performance.now()-start,renderSubmissions:Number(c.dataset.renderedFrames)-n}
  })
  assert.equal(sculpt.dabs,256);assert.equal(sculpt.extraAccepted,false);assert.ok(sculpt.renderSubmissions>0)
  await page.screenshot({path:out+'/sculpt-limit.png'})
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({rewindMatches,keyedSeekStable:true,isolatedPlaneChanges:true,sculpt,results,exportMs,errors,scope:'One cube, static title then one moving composite video plane; software WebGL. Submissions are not GPU completion or unique displayed FPS.'},null,2));console.log({results,exportMs})
 }
}finally{await browser.close()}
