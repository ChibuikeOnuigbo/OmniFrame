import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
const root=path.resolve(import.meta.dirname,'..')
await inflate(path.join(root,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${path.join(os.tmpdir(),'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox']})
try{
 const page=await browser.newPage({viewport:{width:390,height:640}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const store=window.__omniframe_store;store.setState({clips:[],assets:[],tracks:[]})
  const cv=document.createElement('canvas');cv.width=320;cv.height=180
  store.getState().addAsset({id:'menu-plate',kind:'video',name:'Popup test',url:'/qa-output/original-demo-source.webm',duration:5,width:320,height:180,size:100})
  store.getState().addClipToTrack(store.getState().ensureTrack('video'),'menu-plate',0)
 })
 const results=[]
 for(const viewport of [{width:390,height:640},{width:1024,height:500},{width:1440,height:900}]){
  await page.setViewportSize(viewport)
  const clip=page.getByTestId('timeline-clip').first();await clip.click({button:'right'})
  const menu=page.getByTestId('studio-context-menu');await menu.waitFor({state:'visible'})
  const box=await menu.boundingBox()
  assert.ok(box.x>=7&&box.y>=7&&box.x+box.width<=viewport.width-7&&box.y+box.height<=viewport.height-7,JSON.stringify({viewport,box}))
  const submenu=menu.locator('button[aria-haspopup="true"]').first();assert.ok(await submenu.count(),'video menu exposes actual audio submenus');if(await submenu.count()){await submenu.focus();await submenu.press('ArrowRight');const sub=menu.locator('[role="group"]').first();await sub.waitFor({state:'visible'});const subBox=await sub.boundingBox();assert.ok(subBox.x>=0&&subBox.x+subBox.width<=viewport.width);const expanded=await menu.boundingBox();assert.ok(expanded.y>=7&&expanded.y+expanded.height<=viewport.height-7);await submenu.press('ArrowLeft')}
  await page.keyboard.press('Home')
  const first=await page.evaluate(()=>document.activeElement.textContent)
  await page.keyboard.press('End')
  assert.equal(await page.evaluate(()=>{const buttons=[...document.querySelectorAll('[data-testid="studio-context-menu"] button:not(:disabled)')].filter(b=>b.getClientRects().length);return document.activeElement===buttons.at(-1)}),true)
  await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.textContent),first)
  await page.keyboard.press('ArrowDown');assert.notEqual(await page.evaluate(()=>document.activeElement.textContent),first)
  fs.mkdirSync(path.join(root,'qa-output/popups'),{recursive:true});await page.screenshot({path:path.join(root,`qa-output/popups/menu-${viewport.width}.png`)})
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'})
  results.push({viewport,box,keyboard:true})
 }
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(root,'qa-output/popups/report.json'),JSON.stringify(results,null,2));console.log('PASS measured context menus, mobile/short desktop bounds, scroll and keyboard Home/End/arrows/Escape')
}finally{await browser.close()}
