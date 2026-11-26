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
const out='qa-output/stress-revisit';fs.mkdirSync(out,{recursive:true})
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

 const seek=async(index,time=.25)=>{
  const url=await page.evaluate(({index,time})=>{const s=window.__omniframe_store.getState();s.pause();s.setPlayhead(index+time);return s.assets.find(a=>a.id==='stress-'+index).url},{index,time})
  await page.waitForFunction(({url,time})=>[...document.querySelectorAll('video[data-playback-cached]')].some(v=>v.src===url&&v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-time)<.04),{url,time},{timeout:15000})
  return url
 }
 await seek(0)
 await page.evaluate(()=>{window.firstDecoder=document.querySelector('video[data-playback-cached]')})
 for(let i=1;i<=25;i++)await seek(i)
 assert.equal(await page.evaluate(()=>window.firstDecoder.isConnected),false,'old decoder must be detached')
 assert.equal(await page.evaluate(()=>window.firstDecoder.getAttribute('src')),null,'old source must be unloaded')
 const revisit=[]
 for(const index of [0,99,1,98,2,97,3,96,0,99]){const start=Date.now();await seek(index);revisit.push(Date.now()-start)}
 await page.evaluate(async()=>{
  const s=window.__omniframe_store.getState()
  for(const t of [10.1,10.7,10.2,10.8,10.3]){s.setPlayhead(t);await new Promise(r=>setTimeout(r,10))}
 })
 await seek(10,.3)
 assert.ok(await page.locator('video[data-playback-cached]').count()<=16)
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setPlayhead(10.7);s.play()})
 await page.waitForTimeout(1800)
 const boundary=await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.pause();return {playhead:s.playhead,active:[...document.querySelectorAll('video[data-playback-cached]')].filter(v=>!v.paused).length}})
 assert.ok(boundary.playhead>11.5,'playback crossed clip boundaries')
 await page.waitForFunction(()=>[...document.querySelectorAll('video[data-playback-cached]')].every(v=>v.paused))
 await page.screenshot({path:out+'/revisit.png'})
 await page.evaluate(()=>window.__omniframe_store.getState().newProject())
 await page.waitForFunction(()=>document.querySelectorAll('video[data-playback-cached]').length===0)
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().clips.length),0)
 assert.deepEqual(errors,[])
 const report={...setup,revisitWaitMs:revisit,boundary,evictedSourceReleased:true,rapidSeekSettled:true,newProjectReleasedPlayback:true,errors,scope:'100 asset IDs reuse one video fixture. Decoder readiness and transport checks, not sustained audible sync or unique presented-frame verification.'}
 fs.writeFileSync(out+'/revisit.json',JSON.stringify(report,null,2));console.log(report)
}finally{await browser.close()}
