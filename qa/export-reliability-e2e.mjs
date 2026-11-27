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
const out=process.env.OUT||'qa-output/export-reliability';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],downloads=[]
 page.on('pageerror',e=>errors.push(String(e)));page.on('download',d=>downloads.push(d))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setCustomSequenceDimensions(640,360)
  const blob=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob()
  s.addAsset({id:'export-source',name:'Export source',kind:'video',url:URL.createObjectURL(blob),width:1280,height:720,duration:8,size:blob.size})
  s.addClipToTrack(s.ensureTrack('video'),'export-source',0)
  const c=window.__omniframe_store.getState().clips[0];s.setClipProp(c.id,{duration:2});s.recomputeDuration();s.setPreviewQuality('low');s.setSpeed(2)
  window.runExport=(await import('/src/lib/export.ts')).exportVideo
  window.NativeRecorder=window.MediaRecorder
  window.exportTracks=[]
  const capture=HTMLCanvasElement.prototype.captureStream
  HTMLCanvasElement.prototype.captureStream=function(...args){const stream=capture.apply(this,args);window.exportTracks.push(...stream.getTracks());return stream}
 })
 await page.waitForTimeout(500)
 const failures=await page.evaluate(async()=>{
  const results={};const state=()=>window.__omniframe_store.getState()
  const checkCleanup=()=>{if(state().previewQuality!=='low'||state().speed!==2||state().playing)throw new Error('export state not restored');if(window.exportTracks.some(t=>t.readyState!=='ended'))throw new Error('capture tracks leaked')}
  const controller=new AbortController();let competing
  const run=window.runExport({signal:controller.signal,onStatus:s=>{if(s.startsWith('Recording')){competing=window.runExport().then(()=> 'unexpected success',e=>e.message);setTimeout(()=>controller.abort(),150)}}})
  results.cancel=await run.then(()=> 'unexpected success',e=>e.name);results.concurrent=await competing;checkCleanup()
  window.MediaRecorder=class extends window.NativeRecorder {start(...args){super.start(...args);setTimeout(()=>this.dispatchEvent(new Event('error')),100)}}
  try{results.encoder=await window.runExport().then(()=> 'unexpected success',e=>e.message)}finally{window.MediaRecorder=window.NativeRecorder}checkCleanup()
  results.interrupted=await window.runExport({onStatus:s=>{if(s.startsWith('Recording'))setTimeout(()=>state().pause(),150)}}).then(()=> 'unexpected success',e=>e.message);checkCleanup()
  // Native-style stop with no data must never produce a successful empty download.
  window.MediaRecorder=class {
   static isTypeSupported(type){return window.NativeRecorder.isTypeSupported(type)}
   state='inactive';start(){this.state='recording'};stop(){this.state='inactive';setTimeout(()=>this.onstop?.(new Event('stop')),0)}
  }
  try{results.empty=await window.runExport().then(()=> 'unexpected success',e=>e.message)}finally{window.MediaRecorder=window.NativeRecorder}checkCleanup()
  return results
 })
 assert.equal(failures.cancel,'AbortError');assert.match(failures.concurrent,/already running/);assert.match(failures.encoder,/encoder failed/);assert.match(failures.interrupted,/Playback stopped/);assert.match(failures.empty,/empty file/)
 assert.equal(downloads.length,0,'failure paths must not download partial files')
 fs.writeFileSync(out+'/failure-paths.json',JSON.stringify(failures,null,2))
 // Exercise the actual user-facing cancel control.
 await page.getByTestId('export-video-btn').click();await page.getByTestId('cancel-video-export').click()
 await page.getByText('Export cancelled',{exact:true}).waitFor();await page.screenshot({path:out+'/cancelled.png'})
 await page.waitForTimeout(2700);assert.equal(downloads.length,0)
 const exports=[]
 for(const format of ['auto','webm','auto','webm','auto','webm']){
  const next=page.waitForEvent('download',{timeout:30000})
  if(exports.length===5){
   await page.getByTestId('export-options-toggle').click();await page.getByTestId('export-webm-option').click()
  }else await page.evaluate(format=>window.runExport({format}),format)
  const d=await next,file=out+'/'+exports.length+'-'+d.suggestedFilename();await d.saveAs(file)
  let decoded=true,detail='',decodedSeconds=0
  try{const progress=execFileSync(ffmpeg.path,['-v','error','-xerror','-i',file,'-vsync','0','-enc_time_base','-1','-progress','pipe:1','-nostats','-f','null','-'],{encoding:'utf8',stdio:'pipe'});decodedSeconds=Math.max(...[...progress.matchAll(/out_time_ms=(\d+)/g)].map(m=>Number(m[1])/1e6))}catch(e){decoded=false;detail=String(e.stderr)}
  exports.push({format,file,bytes:fs.statSync(file).size,decoded,detail,decodedSeconds});if(decoded)assert.ok(decodedSeconds>1.5&&decodedSeconds<2.5,`short export includes padding: ${decodedSeconds}`)
 }
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setPlayhead(0);s.setExportIn();s.setPlayhead(4);s.setExportOut()})
 const rangeDownload=page.waitForEvent('download',{timeout:30000})
 await page.evaluate(()=>window.runExport({format:'webm'}));await(await rangeDownload).saveAs(out+'/explicit-range.webm')
 const rangeProgress=execFileSync(ffmpeg.path,['-v','error','-i',out+'/explicit-range.webm','-vsync','0','-enc_time_base','-1','-progress','pipe:1','-nostats','-f','null','-'],{encoding:'utf8',stdio:'pipe'})
 const rangeSeconds=Math.max(...[...rangeProgress.matchAll(/out_time_ms=(\d+)/g)].map(m=>Number(m[1])/1e6))
 assert.ok(rangeSeconds>3.5&&rangeSeconds<4.5,'explicit range must preserve requested empty tail')
 await page.evaluate(()=>window.__omniframe_store.getState().clearExportRange())
 const replaced=await page.evaluate(async()=>{
  const s=()=>window.__omniframe_store.getState()
  const message=await window.runExport({onStatus:status=>{if(status.startsWith('Recording')){
   s().newProject();s().setPreviewQuality('medium');s().setSpeed(1.5)
  }}}).then(()=> 'unexpected success',e=>e.message)
  return {message,quality:s().previewQuality,speed:s().speed,clips:s().clips.length,tracksEnded:window.exportTracks.every(t=>t.readyState==='ended')}
 })
 assert.match(replaced.message,/Project changed/);assert.equal(replaced.quality,'medium');assert.equal(replaced.speed,1.5);assert.equal(replaced.clips,0);assert.equal(replaced.tracksEnded,true)
 assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/report.json',JSON.stringify({failures,replaced,exports,rangeSeconds,errors,scope:'640x360 native recordings, one reused Pexels source; synthetic recorder faults and real cancellation UI. Six sequential exports.'},null,2))
 console.log({failures,exports})
 assert.ok(exports.filter(x=>x.format==='webm').every(x=>x.decoded),'WebM exports must decode')
}finally{await browser.close()}
