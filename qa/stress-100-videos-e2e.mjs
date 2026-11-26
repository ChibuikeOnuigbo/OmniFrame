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
const out='qa-output/stress-100';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 const setup=await page.evaluate(async()=>{
  const st=window.__omniframe_store,s=()=>st.getState();s().newProject();s().setPreviewQuality('low');s().setCustomSequenceDimensions(640,360)
  const blob=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob(),track=s().ensureTrack('video'),start=performance.now()
  for(let i=0;i<100;i++){
   s().addAsset({id:'stress-'+i,name:'Video '+i,kind:'video',url:URL.createObjectURL(blob),width:1280,height:720,duration:8,size:blob.size})
   s().addClipToTrack(track,'stress-'+i,i)
   const clip=s().clips.find(c=>c.assetId==='stress-'+i);s().setClipProp(clip.id,{duration:1,start:i,effects:{...clip.effects,blur:1}})
   s().addFxInstance(clip.id,'essential-color-hold')
  }
  return {loadMs:performance.now()-start,assets:s().assets.length,clips:s().clips.length,effectInstances:s().clips.reduce((n,c)=>n+(c.fxInstances?.length||0),0)}
 })
 assert.equal(setup.assets,100);assert.equal(setup.clips,100);assert.equal(setup.effectInstances,100)
 const seeks=[]
 for(let i=0;i<100;i++){
  const start=Date.now()
  const url=await page.evaluate(i=>{const s=window.__omniframe_store.getState();s.setPlayhead(i+.25);return s.assets.find(a=>a.id==='stress-'+i).url},i)
  await page.waitForFunction(url=>[...document.querySelectorAll('video')].some(v=>v.src===url&&v.readyState>=2&&!v.seeking&&v.currentTime>.1),url,{timeout:15000})
  seeks.push(Date.now()-start)
 }
 await page.waitForTimeout(350)
 const retained=await page.locator('video').count()
 const playbackDecoders=await page.locator('video[data-playback-cached]').count()
 await page.screenshot({path:out+'/'+(process.env.PHASE||'after')+'.png'})
 const playback=await page.evaluate(async()=>{
  const s=window.__omniframe_store.getState(),p=await import('/src/lib/performanceSettings.ts');s.setPlayhead(10);const frames=p.previewMetrics.frames,start=performance.now();s.play();await new Promise(r=>setTimeout(r,3000));s.pause();return {elapsedMs:performance.now()-start,renderedFrames:p.previewMetrics.frames-frames,playhead:window.__omniframe_store.getState().playhead}
 })
 const layered=await page.evaluate(async()=>{
  const st=window.__omniframe_store,s=()=>st.getState(),base=s().tracks[0],extra=Array.from({length:10},(_,i)=>({...base,id:'layer-'+i,name:'Layer '+i})),p=await import('/src/lib/performanceSettings.ts')
  st.setState({tracks:[...extra,...s().tracks],clips:s().clips.map((c,i)=>i<10?{...c,start:0,duration:3,trackId:extra[i].id}:c)})
  s().setPlayhead(.25);const frames=p.previewMetrics.frames,start=performance.now();s().play();await new Promise(r=>setTimeout(r,1500));s().pause()
  return {layers:10,renderedFrames:p.previewMetrics.frames-frames,elapsedMs:performance.now()-start,playhead:s().playhead}
 })
 await page.screenshot({path:out+'/layers-'+(process.env.PHASE||'after')+'.png'})
 const sorted=[...seeks].sort((a,b)=>a-b),report={...setup,retainedVideoElements:retained,playbackDecoders,layered,seekWallMs:{p50:sorted[50],p95:sorted[95],max:sorted[99]},playback,errors,scope:'100 distinct asset IDs/blob URLs reuse one authorized 8-second fixture; 100 sequential one-second clips, blur plus one catalog effect per clip. Not 100 unique movies or 100 simultaneous decoders. Software Chromium, automated seek waits include polling.'}
 assert.deepEqual(errors,[])
 if(process.env.PHASE!=='before')assert.ok(playbackDecoders<=16,`inactive decoders should be bounded: ${playbackDecoders}`)
 fs.writeFileSync(out+'/'+(process.env.PHASE||'after')+'.json',JSON.stringify(report,null,2));console.log(report)
}finally{await browser.close()}
