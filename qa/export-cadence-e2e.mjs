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
const out=process.env.OUT||'qa-output/export-cadence';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.setCustomSequenceDimensions(640,360);s.setPreviewQuality('full');s.addTextTitleClip('RENDER TEST',2)
  s.addScene3DObject({id:'cadence-cube',name:'Cube',type:'cube',position:{x:.8,y:0,z:1},rotation:{x:.2,y:.3,z:0},scale:{x:.7,y:.7,z:.7},color:'#53c7e8',roughness:.5,metalness:.1});s.setIs3DMode(true)
  window.copies=[];const draw=CanvasRenderingContext2D.prototype.drawImage
  CanvasRenderingContext2D.prototype.drawImage=function(...args){if(args[0]?.dataset?.renderSource==='3d-export')window.copies.push(performance.now());return draw.apply(this,args)}
 })
 await page.getByTestId('aim-composite-btn').click();await page.waitForTimeout(700)
 const samples=[]
 for(let i=0;i<3;i++){
  const download=page.waitForEvent('download',{timeout:30000})
  const result=await page.evaluate(async()=>{
   window.copies=[];const tasks=[],obs=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));obs.observe({entryTypes:['longtask']})
   const view=document.getElementById('of-three-canvas'),viewStart=Number(view.dataset.renderedFrames),start=performance.now();await(await import('/src/lib/export.ts')).exportVideo({format:'webm'});obs.disconnect()
   return {elapsedMs:performance.now()-start,viewportRenders:Number(view.dataset.renderedFrames)-viewStart,copies:window.copies.length,firstToLastCopyMs:window.copies.at(-1)-window.copies[0],longTasks:tasks.length,longestTaskMs:Math.max(0,...tasks)}
  })
  const file=out+'/run-'+i+'.webm';await(await download).saveAs(file)
  execFileSync(ffmpeg.path,['-v','error','-xerror','-i',file,'-vsync','0','-enc_time_base','-1','-f','null','-'])
  if(process.env.ASSERT_BUDGET==='1')assert.ok(result.copies<=Math.ceil(result.firstToLastCopyMs*30/1000)+2,'capture must respect the recorder frame budget')
  samples.push(result)
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify({samples,scope:'Three repeated native two-second 640x360 3D exports; counts rendered scene copies, not displayed FPS. Software Chromium, no concurrent test suites.'},null,2));console.log(samples)
}finally{await browser.close()}
