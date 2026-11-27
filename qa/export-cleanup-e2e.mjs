import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const out=process.env.OUT||'qa-output/export-cleanup';fs.mkdirSync(out,{recursive:true})
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
 const results=[]
 for(const fault of ['stop','track','disconnect','add-track','callback','project-replace','capture','connect','cancel']){
 const result=await page.evaluate(async fault=>{
  const state=()=>window.__omniframe_store.getState()
  const controller=new AbortController()
  state().setPreviewQuality('low');state().setSpeed(2)
  const originalStop=MediaStreamTrack.prototype.stop
  const originalConnect=AudioNode.prototype.connect
  const originalDisconnect=AudioNode.prototype.disconnect
  const originalAdd=MediaStream.prototype.addTrack
  const originalCapture=HTMLCanvasElement.prototype.captureStream
  const originalDestination=AudioContext.prototype.createMediaStreamDestination
  const audioTracks=[]
  AudioContext.prototype.createMediaStreamDestination=function(...args){
   const d=originalDestination.apply(this,args);audioTracks.push(...d.stream.getTracks());return d
  }
  if(fault==='stop'||fault==='project-replace')window.MediaRecorder=class extends window.NativeRecorder {
   stop(){super.stop();throw new Error('Injected recorder teardown failure')}
  }
  if(fault==='track')MediaStreamTrack.prototype.stop=function(){originalStop.call(this);throw new Error('Injected track teardown failure')}
  if(fault==='connect')AudioNode.prototype.connect=function(...args){
   if(args[0] instanceof MediaStreamAudioDestinationNode)throw new Error('Injected audio connect failure')
   return originalConnect.apply(this,args)
  }
  if(fault==='disconnect')AudioNode.prototype.disconnect=function(...args){
   originalDisconnect.apply(this,args)
   if(args[0] instanceof MediaStreamAudioDestinationNode)throw new Error('Injected audio teardown failure')
  }
  if(fault==='add-track')MediaStream.prototype.addTrack=function(){throw new Error('Injected addTrack failure')}
  if(fault==='capture')HTMLCanvasElement.prototype.captureStream=function(){throw new Error('Injected capture failure')}
  let outcome
  try {
   outcome=await window.runExport({signal:controller.signal,onStatus:status=>{
    if(status.startsWith('Recording')){
     if(fault==='callback')throw new Error('Injected status callback failure')
     if(fault==='project-replace'){
      state().newProject();state().setPreviewQuality('medium');state().setSpeed(1.5)
     }else controller.abort()
    }
   }}).then(()=>({success:true}),error=>({name:error.name,message:error.message}))
  } finally {
   window.MediaRecorder=window.NativeRecorder;MediaStreamTrack.prototype.stop=originalStop
   AudioNode.prototype.connect=originalConnect;AudioNode.prototype.disconnect=originalDisconnect;MediaStream.prototype.addTrack=originalAdd
   HTMLCanvasElement.prototype.captureStream=originalCapture
   AudioContext.prototype.createMediaStreamDestination=originalDestination
  }
  const result={fault,outcome,quality:state().previewQuality,speed:state().speed,playing:state().playing,
   tracksEnded:[...window.exportTracks,...audioTracks].every(t=>t.readyState==='ended')}
  if(fault==='project-replace'){
   state().addAsset({id:'recovery',name:'Recovery',kind:'video',url:'/qa/fixtures/pexels-cinematic-8s.webm',duration:8,width:1280,height:720})
   state().addClipToTrack(state().ensureTrack('video'),'recovery',0)
  }
  return result
 },fault)
 results.push(result)
 const expected={ 'add-track':'Injected addTrack failure',callback:'Injected status callback failure',
  'project-replace':'Project changed during export. Please export again.',capture:'Injected capture failure',connect:'Injected audio connect failure'}[fault]
 if(expected)assert.equal(result.outcome.message,expected)
 else assert.equal(result.outcome.name,'AbortError','preserve cancellation despite cleanup errors')
 assert.equal(result.quality,fault==='project-replace'?'medium':'low')
 assert.equal(result.speed,fault==='project-replace'?1.5:2)
 assert.equal(result.playing,false);assert.equal(result.tracksEnded,true)
 }
 const audioDispose=await page.evaluate(async()=>{
  const {createRecordingAudioStream}=await import('/src/lib/audioBus.ts')
  const audio=createRecordingAudioStream();audio.dispose();audio.dispose()
  return audio.stream.getTracks().every(t=>t.readyState==='ended')
 })
 assert.equal(audioDispose,true);assert.equal(downloads.length,0);assert.deepEqual(errors,[])
 fs.writeFileSync(out+'/report.json',JSON.stringify({results,audioDispose,errors},null,2));console.log(results)
}finally{await browser.close()}
