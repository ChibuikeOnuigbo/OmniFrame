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
const out='qa-output/camera-review';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.newProject();s.addScene3DObject({id:'sphere',name:'Sphere',type:'sphere',position:{x:0,y:0,z:1},rotation:{x:0,y:0,z:0},scale:{x:2,y:2,z:2},color:'#a3b1c6'});s.setIs3DMode(true)})
 await page.getByTestId('aim-object-btn').click()
 await page.waitForTimeout(300)
 const pixels=()=>page.locator('#of-three-canvas').evaluate(c=>c.toDataURL())
 const before=await pixels()
 await page.keyboard.down('w');await page.waitForTimeout(200);await page.keyboard.up('w')
 assert.equal(await pixels(),before,'toolbar focus must not move camera')
 await page.getByTestId('three-canvas-wrapper').focus()
 await page.keyboard.down('w');await page.waitForTimeout(200);await page.keyboard.up('w')
 assert.notEqual(await pixels(),before,'focused viewport owns movement')
 await page.getByTestId('aim-object-btn').click()
 await page.setViewportSize({width:390,height:844})
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setLeftOpen(false);s.setRightOpen(false)})
 await page.waitForTimeout(300)
 await page.screenshot({path:out+'/mobile.png'})
 fs.writeFileSync(out+'/canvas.png',Buffer.from((await pixels()).split(',')[1],'base64'))
 const png=PNG.sync.read(fs.readFileSync(out+'/canvas.png'));let min=png.width,max=-1
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){const i=(y*png.width+x)*4;if(Math.min(png.data[i],png.data[i+1],png.data[i+2])>85 && Math.max(png.data[i],png.data[i+1],png.data[i+2])-Math.min(png.data[i],png.data[i+1],png.data[i+2])<60){min=Math.min(min,x);max=Math.max(max,x)}}
 assert.ok(min>8&&max<png.width-8,'scaled object fits narrow viewport with margins')
 console.log('PASS scaled object framing, narrow resize, keyboard focus ownership')
}finally{await browser.close()}
