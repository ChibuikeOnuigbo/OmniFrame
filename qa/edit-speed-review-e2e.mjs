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
const out=process.env.OUT||'qa-output/edit-speed-review';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const media=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob()
  const s=()=>window.__omniframe_store.getState();s().newProject();s().setCustomSequenceDimensions(1280,720)
  s().addAsset({id:'coast',name:'Coast footage',kind:'video',url:URL.createObjectURL(media),width:1280,height:720,duration:8,size:media.size})
  const track=s().ensureTrack('video')
  for(let i=0;i<3;i++){
   s().addClipToTrack(track,'coast',i*2);const c=s().clips.filter(c=>c.kind==='video').at(-1)
   s().setClipProp(c.id,{start:i*2,duration:2,inPoint:i*2,effects:{...c.effects,blur:0},effectKeys:{blur:[{t:0,v:6},{t:.3,v:0},{t:1.8,v:0},{t:2,v:4}]}})
  }
  for(const [i,text] of ['COAST','BREATHE','RESET'].entries()){
   s().setPlayhead(i*2);s().addTextTitleClip(text,2);const c=s().clips.find(c=>c.id===s().selectedClipId)
   s().setClipProp(c.id,{textStyle:{...c.textStyle,fontSize:64,bold:true,color:'#ffffff',backgroundColor:'rgba(0,0,0,0.35)'}})
   s().setClipKeyframe(c.id,'position_y',0,60,'linear');s().setClipKeyframe(c.id,'position_y',.4,0,'linear')
   s().setClipKeyframe(c.id,'opacity',0,0,'linear');s().setClipKeyframe(c.id,'opacity',.25,1,'linear');s().setClipKeyframe(c.id,'opacity',1.7,1,'linear');s().setClipKeyframe(c.id,'opacity',2,0,'linear')
  }
  s().setPlayhead(0)
 })
 const results=[]
 for(const quality of (process.env.ORDER==='reverse'?['full','low']:['low','full'])){
  results.push(await page.evaluate(async quality=>{
   const s=window.__omniframe_store.getState(),p=await import('/src/lib/performanceSettings.ts');s.pause();s.setPreviewQuality(quality);s.setPlayhead(0);await new Promise(r=>setTimeout(r,400))
   const tasks=[],samples=[],observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']})
   let previous=p.previewMetrics.frames;const startFrames=previous,start=performance.now()
   const timer=setInterval(()=>{if(p.previewMetrics.frames!==previous){samples.push(p.previewMetrics.renderMs);previous=p.previewMetrics.frames}},10)
   s.play();await new Promise(r=>setTimeout(r,4500));s.pause();clearInterval(timer);observer.disconnect()
   samples.sort((a,b)=>a-b)
   return {quality,elapsedMs:performance.now()-start,renderedFrames:p.previewMetrics.frames-startFrames,renderMsP50:samples[Math.floor(samples.length*.5)],renderMsP95:samples[Math.floor(samples.length*.95)],longTasks:tasks.length,longestTaskMs:Math.max(0,...tasks),sampledFrames:samples.length}
  },quality))
 }
 const seekStart=Date.now()
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setPlayhead(3)})
 await page.waitForFunction(()=>[...document.querySelectorAll('video[data-playback-cached]')].some(v=>v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-3)<.04),null,{timeout:15000})
 const seekReadyMs=Date.now()-seekStart
 await page.waitForTimeout(300);await page.screenshot({path:out+'/editor.png'})
 for(const result of results){assert.ok(result.sampledFrames>0,'preview must render');assert.ok(Number.isFinite(result.renderMsP95),'render timing must be finite')}
 const downloadPromise=page.waitForEvent('download',{timeout:60000}),start=Date.now()
 await page.evaluate(async()=>{const {exportVideo}=await import('/src/lib/export.ts');await exportVideo()})
 const download=await downloadPromise;await download.saveAs(out+'/coast-edit.mp4')
 const exportWallMs=Date.now()-start
 const project=await page.evaluate(async()=>Array.from(new Uint8Array(await(await window.__omniframe_store.getState().saveOmniProject('Coast edit')).arrayBuffer())))
 fs.writeFileSync(out+'/coast-edit.omni',Buffer.from(project))
 const reopened=await page.evaluate(async bytes=>{
  const s=()=>window.__omniframe_store.getState();s().newProject()
  await s().loadOmniProject(new File([new Uint8Array(bytes)],'coast-edit.omni'))
  return {clips:s().clips.length,assets:s().assets.length,blurKeys:s().clips.filter(c=>c.kind==='video').map(c=>c.effectKeys?.blur?.length)}
 },project)
 assert.equal(reopened.clips,6);assert.equal(reopened.assets,1);assert.deepEqual(reopened.blurKeys,[4,4,4])
 // Preserve VFR source time base; a nominal-rate null sink rounds distinct timestamps together.
 execFileSync(ffmpeg.path,['-v','error','-xerror','-i',out+'/coast-edit.mp4','-vsync','0','-enc_time_base','-1','-f','null','-'])
 execFileSync(ffmpeg.path,['-y','-v','error','-ss','3','-i',out+'/coast-edit.mp4','-frames:v','1',out+'/export-frame.png'])
 assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/report.json',JSON.stringify({results,exportWallMs,seekReadyMs,reopened,errors,scope:'One six-second 720p edit: three footage cuts, keyed blur and three animated titles. Same source, software Chromium. Render submissions are not unique presented frames; not a 4K benchmark.'},null,2));console.log({results,exportWallMs})
}finally{await browser.close()}
