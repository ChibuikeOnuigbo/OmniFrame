import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const out='qa-output/seek-ready-review/toolbar';fs.mkdirSync(out,{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 const field=page.getByRole('spinbutton',{name:'Preview zoom percent'}),slider=page.getByTestId('preview-zoom-slider'),fit=page.getByRole('button',{name:'Auto fit preview',exact:true})
 await field.fill('133');await field.press('Enter');assert.equal(await slider.inputValue(),'133')
 await field.fill('999');await field.press('Enter');assert.equal(await field.inputValue(),'200')
 await field.fill('999');await field.press('Enter');assert.equal(await field.inputValue(),'200')
 await field.fill('1');await field.press('Enter');assert.equal(await slider.inputValue(),'25')
 await field.fill('');await field.press('Enter');assert.equal(await field.inputValue(),'25')
 await fit.click();const fitValue=await field.inputValue()
 await field.fill('70');await field.press('Escape');assert.equal(await field.inputValue(),fitValue);assert.equal(await fit.getAttribute('aria-pressed'),'true')
 await field.focus();await field.press('Tab');assert.equal(await fit.getAttribute('aria-pressed'),'true')
 assert.equal(await page.getByRole('group',{name:'Composition guides'}).count(),1)
 await page.screenshot({path:out+'/desktop.png'})
 await page.getByTestId('toggle-3d-btn').click();await page.waitForTimeout(800);await page.screenshot({path:out+'/three-d.png'})
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300)
 assert.equal(await field.isVisible(),false)
 const box=await page.getByRole('group',{name:'Composition guides'}).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390)
 await page.screenshot({path:out+'/mobile.png'})
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({exactZoom:true,clamps:true,repeatedClamp:true,emptySafe:true,escapePreservesFit:true,blurPreservesFit:true,mobileGuidesInViewport:true,errors},null,2));console.log('PASS preview zoom and grouped guides')
}finally{await browser.close()}
