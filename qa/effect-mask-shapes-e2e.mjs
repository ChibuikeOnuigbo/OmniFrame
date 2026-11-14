import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox']})
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}})
 page.setDefaultTimeout(12000)
 const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto('http://localhost:5173/#studio',{waitUntil:'domcontentloaded'})
 await page.evaluate(()=>{const st=window.__omniframe_store;st.setState({assets:[],clips:[],tracks:[],selectedClipId:null,selectedClipIds:[],rightOpen:true,sidebarSectionMode:'tabs'});const c=document.createElement('canvas');c.width=320;c.height=180;st.getState().addAsset({id:'plate',kind:'image',name:'Plate',url:c.toDataURL(),duration:5,width:320,height:180,size:100});const t=st.getState().ensureTrack('video');st.getState().addClipToTrack(t,'plate',0);st.getState().selectClip(st.getState().clips[0].id)})
 await page.getByTestId('section-tab-effect-mask').click()
 await page.getByLabel('New mask shape').selectOption('star')
 await page.getByTestId('add-effect-mask-btn').click()
 await page.getByTestId('add-effect-mask-hexagon').click()
 await page.getByTestId('add-effect-mask-text').click()
 await page.getByLabel('Effect mask font',{exact:true}).selectOption('cursive')
 await page.getByTestId('add-effect-mask-custom').click()
 await page.getByLabel('Point 1 X').fill('42')
 const r=await page.evaluate(()=>window.__omniframe_store.getState().clips[0].adjustmentMask.regions)
 assert.deepEqual(r.map(x=>x.shape),['star','hexagon','text','custom'])
 assert.equal(r[2].fontFamily,'cursive');assert.equal(r[3].points[0].x,.42)
 assert.deepEqual(errors,[])
 console.log('PASS live star/hexagon/text font/polygon point controls')
}finally{await browser.close()}
