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
const out=path.join(root,'evidence_video/workbench');fs.mkdirSync(out,{recursive:true})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const s=window.__omniframe_store;s.setState({assets:[],clips:[],tracks:[],past:[],future:[]})
  const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');for(let j=0;j<6;j++)for(let i=0;i<10;i++){x.fillStyle=(i+j)%2?'#49deca':'#243761';x.fillRect(i*32,j*30,32,30)}x.fillStyle='#ff7354';x.fillRect(110,40,90,90)
  s.getState().addAsset({id:'workbench-plate',kind:'image',name:'Transform checkerboard',url:c.toDataURL(),duration:5,width:320,height:180,size:1000})
  s.getState().addClipToTrack(s.getState().ensureTrack('video'),'workbench-plate',0);s.getState().setSequenceAspectRatio('custom',640,360);s.getState().setPreviewQuality('low');s.getState().setPlayhead(1);s.getState().setRightOpen(false);s.getState().setLeftOpen(false)
 })
 const layouts=[]
 for(const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setRightOpen(false);s.setLeftOpen(false)})
  await page.getByTestId('left-tab-media').click()
  const panel=page.getByTestId('left-panel');await page.waitForTimeout(200)
  const result=await panel.evaluate(panel=>{
   const r=panel.getBoundingClientRect(),occlusions=[];for(const fy of [.05,.2,.5,.8,.95])for(const fx of [.1,.5,.9]){const x=r.left+r.width*fx,y=r.top+r.height*fy,hit=document.elementFromPoint(x,y);if(hit&&!panel.contains(hit))occlusions.push({x,y,tag:hit.tagName,testid:hit.getAttribute('data-testid')})}
   const body=panel.firstElementChild;return {box:{x:r.x,y:r.y,width:r.width,height:r.height},occlusions,innerWidth:body.getBoundingClientRect().width,pageOverflow:document.documentElement.scrollWidth>innerWidth}
  })
  assert.deepEqual(result.occlusions,[],JSON.stringify({viewport,result}));assert.ok(Math.abs(result.innerWidth-result.box.width)<3,'drawer inner width follows outer width')
  assert.ok(!result.pageOverflow)
  if(viewport.width<640){const options=page.getByTestId('mobile-panel-options');await options.locator('summary').click();assert.equal(await options.locator('button:visible').count(),4);await options.locator('summary').press('Escape')}
  await page.screenshot({path:path.join(out,`drawer-${viewport.width}.png`)});layouts.push({viewport,...result})
 }
 await page.setViewportSize({width:390,height:844});await page.getByTestId('mobile-workspace-tools').click();await page.getByRole('menuitem',{name:'Appearance & palette'}).click()
 await page.getByTestId('ui-palette-violet').click()
 const violet=await page.getByTestId('ui-palette-violet').evaluate(el=>getComputedStyle(el).borderTopColor)
 assert.equal(violet,'rgb(109, 94, 252)')
 await page.screenshot({path:path.join(out,'purple-settings.png')});await page.reload({waitUntil:'networkidle'})
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().uiPalette),'violet')
 // Recreate the local test plate after reload (no project autosave assumptions).
 await page.evaluate(()=>{const s=window.__omniframe_store;const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');for(let y=0;y<180;y+=20)for(let z=0;z<320;z+=20){x.fillStyle=(z/20+y/20)%2?'#49deca':'#243761';x.fillRect(z,y,20,20)}s.setState({assets:[],clips:[],tracks:[]});s.getState().addAsset({id:'plate',kind:'image',name:'Geometry test',url:c.toDataURL(),duration:5,width:320,height:180,size:100});s.getState().addClipToTrack(s.getState().ensureTrack('video'),'plate',0);s.getState().setSequenceAspectRatio('custom',640,360);s.getState().setPreviewQuality('low');s.getState().setPlayhead(1);s.getState().setLeftOpen(false);s.getState().setRightOpen(true)})
 await page.setViewportSize({width:1440,height:900})
 await page.getByTestId('section-tab-transform').click()
 await page.getByLabel('Transform mode',{exact:true}).selectOption('perspective')
 const overlay=page.getByTestId('deformation-overlay');await overlay.waitFor({state:'visible'})
 const beforePin=await page.evaluate(()=>document.getElementById('of-canvas').toDataURL())
 const corner=overlay.locator('[data-corner="0"]'),box=await corner.boundingBox();assert.ok(box)
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+55,box.y+30,{steps:6});await page.mouse.up()
 const pinned=await page.evaluate(()=>window.__omniframe_store.getState().clips[0].deformation)
 assert.ok(pinned.corners[0].x>.02)
 await page.waitForFunction(before=>document.getElementById('of-canvas').toDataURL()!==before,beforePin)
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>!!window.__omniframe_store.getState().clips[0].deformation),false)
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.redo();s.selectClip(s.clips[0].id)})
 if(!await page.getByLabel('Transform mode',{exact:true}).isVisible())await page.getByTestId('section-tab-transform').click()
 await page.getByLabel('Transform mode',{exact:true}).selectOption('liquify');const bounds=await overlay.boundingBox()
 const beforeBrush=await page.evaluate(()=>document.getElementById('of-canvas').toDataURL())
 await page.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.58,{steps:8});await page.mouse.up()
 await page.waitForFunction(before=>document.getElementById('of-canvas').toDataURL()!==before,beforeBrush)
 const dabs=await page.evaluate(()=>window.__omniframe_store.getState().clips[0].deformation.dabs.length);assert.ok(dabs>0)
 await page.screenshot({path:path.join(out,'liquify-preview.png')})
 const persistence=await page.evaluate(async()=>{const {buildOmniProjectBundle,parseOmniProjectBundle}=await import('/src/lib/omniProject.ts'),s=window.__omniframe_store.getState();const document={assets:s.assets,tracks:s.tracks,clips:s.clips,transitions:[]};const blob=await buildOmniProjectBundle(document,'Transform test'),loaded=await parseOmniProjectBundle(new File([blob],'warp.omni'));if(JSON.stringify(loaded.state.clips[0].deformation)!==JSON.stringify(s.clips[0].deformation))throw Error('deformation did not survive project round trip');const mcp=await window.omniMCP.call('edit_element',{clipId:s.clips[0].id,patch:{deformation:null}});if(!mcp.ok)throw Error(mcp.error);return true})
 assert.ok(persistence)
 const capacity=await page.evaluate(async()=>{const s=window.__omniframe_store.getState(),dabs=Array.from({length:256},(_,i)=>({x:i/256,y:.5,dx:0,dy:0,radius:.1,strength:0,mode:'push'}));const r=await window.omniMCP.call('edit_element',{clipId:s.clips[0].id,patch:{deformation:{dabs}}});if(!r.ok)throw Error(r.error);return JSON.stringify(window.__omniframe_store.getState().clips[0].deformation)})
 const cappedBox=await overlay.boundingBox();await page.mouse.move(cappedBox.x+cappedBox.width*.4,cappedBox.y+cappedBox.height*.4);await page.mouse.down();await page.mouse.move(cappedBox.x+cappedBox.width*.6,cappedBox.y+cappedBox.height*.6,{steps:4});await page.mouse.up()
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__omniframe_store.getState().clips[0].deformation)),capacity,'brush capacity preserves existing work')
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({layouts,violet,dabs,persistence,nativeCanvasChanged:true,capacityPreservesWork:true,errors},null,2));console.log('PASS drawer ownership, responsive geometry, purple persistence, real corner/liquify gestures, undo, project and live MCP')
}finally{await browser.close()}
