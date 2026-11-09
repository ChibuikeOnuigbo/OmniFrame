import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox']})
fs.mkdirSync('qa-output/square-preview',{recursive:true})
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto('http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const st=window.__omniframe_store; st.setState({clips:[],tracks:[],assets:[],markers:[],past:[],future:[],visualPreview:null})
  const c=document.createElement('canvas');c.width=640;c.height=360; const x=c.getContext('2d');x.fillStyle='#197ab5';x.fillRect(0,0,640,360);x.fillStyle='white';x.font='50px sans-serif';x.fillText('PREVIEW TEST',80,180)
  st.getState().addAsset({id:'fixture',kind:'image',name:'Preview fixture',url:c.toDataURL(),duration:10,width:640,height:360,size:100})
  const t=st.getState().ensureTrack('video');st.getState().addClipToTrack(t,'fixture',0);st.getState().addClipToTrack(t,'fixture',10)
  st.getState().setLeftTab('effects');st.getState().setLeftOpen(true);st.getState().setPlayhead(1)
 })
 await page.waitForFunction(()=>document.querySelector('[data-testid="fx-catalog-count"]')?.textContent.includes('305,000'))
 await page.getByTestId('fx-catalog-search').fill('tilt-focus-diagonal-center-narrow')
 const tile=page.getByTestId('fx-tile-tilt-focus-diagonal-center-narrow');await tile.waitFor()
 const box=await tile.boundingBox();assert(Math.abs(box.width-box.height)<2)
 const before=await page.evaluate(()=>JSON.stringify(window.__omniframe_store.getState().clips))
 await tile.click();await page.waitForTimeout(250)
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__omniframe_store.getState().clips)),before,'single click does not mutate clips')
 const scrub=page.getByTestId('scrub-fx-tile-tilt-focus-diagonal-center-narrow');const b=await scrub.boundingBox()
 await page.mouse.move(b.x+b.width*.75,b.y+10);await page.mouse.down();await page.waitForTimeout(100)
 const seek=await page.evaluate(()=>{const s=window.__omniframe_store.getState();return {p:s.playhead,start:s.visualPreview.startTime,end:s.visualPreview.endTime,scrubbing:s.scrubbing}})
 assert(seek.scrubbing);assert(Math.abs(seek.p-(seek.start+(seek.end-seek.start)*.75))<.1)
 await page.mouse.up();assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().scrubbing),false)
 await page.screenshot({path:'qa-output/square-preview/active-square.png'})
 await page.evaluate(()=>window.__omniframe_store.getState().pause())
 const insertion=await page.evaluate(()=>window.__omniframe_store.getState().playhead)
 await page.getByTestId('add-fx-tile-tilt-focus-diagonal-center-narrow').click()
 const added=await page.evaluate(()=>window.__omniframe_store.getState().clips.at(-1));assert.equal(added.kind,'adjustment');assert(Math.abs(added.start-insertion)<.05)
 await tile.dblclick();assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().clips.filter(c=>c.kind==='adjustment').length),2)
 // Timeline ruler, marker finder, top-layer playhead.
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.stopVisualPreview();s.pause();s.setZoom(32000);s.addMarker({time:2,label:'Opening cue',notes:'piano entrance',color:'#38bdf8'});s.setPlayhead(0)})
 assert.equal(await page.getByTestId('timeline').getAttribute('data-ruler-mode'),'millisecond')
 const line=await page.getByTestId('timeline-playhead-line').evaluate(e=>({z:getComputedStyle(e).zIndex,w:e.getBoundingClientRect().width}));assert.equal(line.z,'80');assert.equal(line.w,3)
 await page.getByTestId('marker-search-btn').click();await page.getByTestId('marker-search-input').fill('piano');await page.getByTestId('marker-search-result').click()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().playhead),2)
 await page.getByTestId('marker-close-btn').click()
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setZoom(50);s.setPlayhead(0);s.setLeftTab('effects')})
 await page.getByTestId('fx-catalog-search').fill('');await page.waitForTimeout(700)
 await page.screenshot({path:'qa-output/square-preview/catalog.png'})
 await page.evaluate(()=>{const st=window.__omniframe_store;const clips=st.getState().clips.filter(c=>c.kind==='image');clips[1]={...clips[1],start:clips[0].start+clips[0].duration};st.setState({clips,transitions:[],selectedClipId:clips[0].id,selectedClipIds:[clips[0].id]});st.getState().setPlayhead(clips[1].start);st.getState().setLeftTab('transitions')})
 const transition=page.locator('[data-testid^="transition-card-"]').first();await transition.waitFor();const tid=await transition.getAttribute('data-testid');await transition.click();await page.getByTestId(`scrub-${tid}`).waitFor()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions.length),0)
 await page.getByTestId(`add-${tid}`).click();assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions.length),1)
 await page.screenshot({path:'qa-output/square-preview/transitions.png'})
 assert.deepEqual(errors,[])
 fs.writeFileSync('qa-output/square-preview/report.json',JSON.stringify({loadedRecipes:305000,square:true,nonDestructivePreview:true,scrub:true,addAtPlayhead:true,doubleClick:true,markerSearch:true,millisecondRuler:true,playhead:line,errors},null,2))
 console.log('PASS square previews, scrub/resume, add, double click, 305K loaded, marker finder, ruler and playhead')
}finally{await browser.close()}
