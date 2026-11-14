import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto('http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{const st=window.__omniframe_store;st.getState().setActiveCategory('2d');st.getState().setLeftTab('animation')})
 await page.getByTestId('animation-workspace').waitFor()
 const first=await page.evaluate(()=>{const s=window.__omniframe_store.getState();return {scope:s.drawingScope.type,enabled:s.drawingEnabled,onion:s.onionSkin.enabled}})
 assert.deepEqual(first,{scope:'frame',enabled:true,onion:true})
 await page.getByTestId('animation-workspace').getByRole('button',{name:'Curves',exact:true}).click()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().graphEditorOpen),true)
 await page.getByTestId('animation-workspace').getByRole('button',{name:'Cels',exact:true}).click()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().graphEditorOpen),false)
 await page.evaluate(()=>{const st=window.__omniframe_store,s=st.getState();s.addDrawingStroke({id:'cel-source',layerId:s.activePaintLayerId,tool:'pen',color:'#fff',size:5,opacity:1,points:[{x:.2,y:.2,timestamp:0},{x:.4,y:.4,timestamp:1}],temporalScope:{type:'frame',frame:0,holdFrames:1}})})
 await page.getByTestId('duplicate-cel').click()
 let state=await page.evaluate(()=>{const s=window.__omniframe_store.getState();return {count:s.drawingStrokes.length,frame:s.drawingStrokes.at(-1).temporalScope.frame}})
 assert.deepEqual(state,{count:2,frame:1})
 await page.getByTestId('clear-cel').click()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().drawingStrokes.length),1)
 await page.evaluate(()=>window.__omniframe_store.getState().undo())
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().drawingStrokes.length),2)
 assert.deepEqual(errors,[])
 console.log('PASS Animation entry, cels/curves, duplicate, clear and undo')
}finally{await browser.close()}
