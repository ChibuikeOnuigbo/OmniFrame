import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const out=process.env.OUT||'qa-output/seek-ready-review';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setCustomSequenceDimensions(640,360);s.setPreviewQuality('full')
  const blob=await(await fetch('/qa/fixtures/pexels-cinematic-8s.webm')).blob()
  s.addAsset({id:'seek-proof',name:'Seek footage',kind:'video',url:URL.createObjectURL(blob),width:1280,height:720,duration:8,size:blob.size})
  s.addClipToTrack(s.ensureTrack('video'),'seek-proof',0)
  window.seekCommits=[];window.seekEvents=[]
  const canvas=document.querySelector('[data-testid="program-preview-canvas"]'),ctx=canvas.getContext('2d'),original=ctx.drawImage
  ctx.drawImage=function(...args){const result=original.apply(this,args);window.seekCommits.push({at:performance.now(),time:window.__omniframe_store.getState().playhead});return result}
  document.addEventListener('seeked',event=>{
   if(event.target.matches('video[data-playback-cached]'))window.seekEvents.push({at:performance.now(),time:event.target.currentTime})
  },true)
 })
 await page.waitForTimeout(1000)
 const samples=[]
 for(const target of [1.25,6.25,2.25,5.25,.25,4.25,1.25,6.25]){
  samples.push(await page.evaluate(async target=>{
   window.seekCommits=[];window.seekEvents=[]
   const start=performance.now();window.__omniframe_store.getState().setPlayhead(target)
   const deadline=start+10000
   while(performance.now()<deadline){
    const event=window.seekEvents.find(e=>Math.abs(e.time-target)<.04)
    const commit=event&&window.seekCommits.find(c=>c.at>=event.at&&Math.abs(c.time-target)<.001)
    if(commit)return {target,decoderMs:event.at-start,commitMs:commit.at-start,readyToCommitMs:commit.at-event.at}
    await new Promise(r=>setTimeout(r,5))
   }
   throw new Error('No committed frame for seek '+target)
  },target))
 }
 // Idle decoders must not force continuous rendering after completion.
 const idle=await page.evaluate(async()=>{
  const n=window.seekCommits.length,host=document.querySelector('[data-playback-media-host]'),unused=document.createElement('video')
  host.appendChild(unused)
  const timer=setInterval(()=>unused.dispatchEvent(new Event('seeked')),10)
  try{await new Promise(r=>setTimeout(r,1100));return window.seekCommits.length-n}
  finally{clearInterval(timer);unused.remove()}
 })
 const medianReadyMs=[...samples].map(s=>s.readyToCommitMs).sort((a,b)=>a-b)[4]
 assert.ok(medianReadyMs<100,`decoder-ready redraw median exceeded budget: ${medianReadyMs}`)
 assert.ok(idle<=6,`paused redraw budget: ${idle}`)
 assert.deepEqual(errors,[])
 await page.screenshot({path:out+'/editor.png'})
 fs.writeFileSync(out+'/report.json',JSON.stringify({samples,idleCommits:idle,errors,scope:'Single Pexels fixture; seeked to program-canvas drawImage commit, not compositor presentation. Software Chromium.'},null,2))
 console.log({samples,idleCommits:idle})
}finally{await browser.close()}
