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
const out='qa-output/speed-review';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setIs3DMode(true);s.pause()})
 await page.locator('#of-three-canvas').waitFor()
 await page.waitForTimeout(700)
 const frames=()=>page.locator('#of-three-canvas').evaluate(c=>Number(c.dataset.renderedFrames))
 const before=await frames();await page.waitForTimeout(2000);const idle=await frames()-before
 assert.ok(idle<=10,`idle redraws: ${idle}`)
 const samples=[]
 for(let i=0;i<8;i++){
  const old=await frames(),start=Date.now()
  await page.getByTestId('grid-toggle-btn').click()
  await page.waitForFunction(old=>Number(document.getElementById('of-three-canvas').dataset.renderedFrames)>old,old)
  samples.push(Date.now()-start)
 }
 await page.screenshot({path:out+'/desktop.png'})
 await page.getByTestId('three-canvas-wrapper').focus()
 const old=await frames();await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');assert.ok(await frames()>old)
 const report={idleRedrawsInTwoSeconds:idle,gridInteractionWallMs:samples,meanInteractionWallMs:samples.reduce((a,b)=>a+b,0)/samples.length,scope:'Software Chromium; includes Playwright click and polling overhead. Not video decode, seek, 4K, or competitor benchmark.'}
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(report)
}finally{await browser.close()}
