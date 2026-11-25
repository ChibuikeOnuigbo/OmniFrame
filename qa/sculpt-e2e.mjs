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
const out='qa-output/sculpt';fs.mkdirSync(out,{recursive:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5183/#studio',{waitUntil:'networkidle'})
 await page.evaluate(()=>{
  const s=window.__omniframe_store.getState();s.newProject();s.addScene3DObject({id:'sculpt',name:'Sculpt sphere',type:'sphere',position:{x:0,y:0,z:1},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},color:'#a3b1c6',roughness:.7,metalness:.1});s.setIs3DMode(true)
 })
 await page.getByTestId('blender-mode-sculpt').click()
 await page.getByTestId('aim-object-btn').click()
 await page.waitForFunction(()=>Number(document.getElementById('of-three-canvas')?.dataset.renderedFrames)>0)
 const canvas=page.locator('#of-three-canvas'),box=await canvas.boundingBox()
 assert.ok(box)
 const dimensions=await page.evaluate(()=>{const c=document.getElementById('of-three-canvas'),p=c.parentElement;return {w:c.clientWidth,h:c.clientHeight,pw:p.clientWidth,ph:p.clientHeight}})
 assert.equal(dimensions.w,dimensions.pw);assert.equal(dimensions.h,dimensions.ph,'canvas must fit its real pointer surface')
 const before=await canvas.evaluate(c=>c.toDataURL())
 fs.writeFileSync(`${out}/before.png`,Buffer.from(before.split(',')[1],'base64'))
 const history=await page.evaluate(()=>window.__omniframe_store.getState().past.length)
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5)
 await page.mouse.down()
 await page.getByTestId('three-canvas-wrapper').dispatchEvent('pointerdown',{pointerId:999,button:0,clientX:box.x+box.width*.5,clientY:box.y+box.height*.5})
 for(let i=1;i<=8;i++){await page.mouse.move(box.x+box.width*.5+i*7,box.y+box.height*.5+i*2);await page.waitForTimeout(50)}
 await page.mouse.up()
 await page.waitForFunction(()=>window.__omniframe_store.getState().scene3DObjects[0]?.sculptDabs?.length>2)
 await page.waitForTimeout(150)
 const after=await canvas.evaluate(c=>c.toDataURL());assert.notEqual(after,before,'brush gesture changes rendered pixels')
 fs.writeFileSync(`${out}/after.png`,Buffer.from(after.split(',')[1],'base64'))
 const result=await page.evaluate(async history=>{
  const s=()=>window.__omniframe_store.getState(),obj=()=>s().scene3DObjects[0],check=(v,m)=>{if(!v)throw Error(m)}
  const {exportPrimitiveSceneObj}=await import('/src/lib/projectSubsets.ts')
  const sculpted=JSON.stringify(obj().sculptDabs),count=obj().sculptDabs.length
  check(!s().inInteraction,'gesture leaked history transaction');check(s().past.length===history+1,'gesture must be one Undo step')
  const exported=await(await exportPrimitiveSceneObj(s().scene3DObjects)).text()
  s().undo();check(!obj().sculptDabs?.length,'Undo failed')
  const plain=await(await exportPrimitiveSceneObj(s().scene3DObjects)).text();check(plain!==exported,'OBJ export ignored deformation')
  s().redo();check(JSON.stringify(obj().sculptDabs)===sculpted,'Redo failed')
  const bundle=await s().saveOmniProject('Sculpt demo');s().newProject();await s().loadOmniProject(new File([bundle],'sculpt.omni'))
  check(JSON.stringify(obj().sculptDabs)===sculpted,'Save/Open changed brush work')
  check(await(await exportPrimitiveSceneObj(s().scene3DObjects)).text()===exported,'Save/Open changed exported geometry')
  s().resetSceneSculpt('sculpt');check(!obj().sculptDabs,'Reset failed');s().undo();check(JSON.stringify(obj().sculptDabs)===sculpted,'Reset Undo failed')
  s().addScene3DObject({...obj(),id:'second',name:'Second'});s().setSelected3DObjectId('sculpt');s().removeScene3DObject('sculpt')
  check(s().selected3DObjectId==='second','Delete selected stale object');s().undo();check(s().selected3DObjectId==='sculpt'&&s().scene3DObjects.length===2,'Undo delete lost object/selection');s().undo();check(s().scene3DObjects.length===1,'Undo add lost scene')
  const bad={...obj().sculptDabs[0],radius:Infinity},unchanged=JSON.stringify(obj())
  let rejected=false;try{s().appendSceneSculpt('sculpt',bad)}catch{rejected=true}check(rejected&&JSON.stringify(obj())===unchanged,'invalid dab mutated scene')
  s().beginHistory();for(let i=count;i<256;i++)s().appendSceneSculpt('sculpt',obj().sculptDabs[0]);s().endHistory()
  check(!s().appendSceneSculpt('sculpt',obj().sculptDabs[0])&&obj().sculptDabs.length===256,'capacity discards old work');s().undo()
  s().updateScene3DObject('sculpt',{type:'cube'});check(!obj().sculptDabs,'new shape reused old dabs');s().undo();check(JSON.stringify(obj().sculptDabs)===sculpted,'Undo shape changed strokes')
  s().setIs3DMode(true);s().setActiveBlenderMode('sculpt')
  return {count,exported,checks:['actual pointer gesture changes pixels','one gesture / one Undo','Redo','save/open','OBJ deformation and round trip','Reset Undo','add/delete Undo with valid selection','invalid input atomic rejection','capacity preserves earlier work','shape replacement invalidates dabs']}
 },history)
 fs.writeFileSync(`${out}/sculpt.obj`,result.exported)
 delete result.exported
 await page.waitForTimeout(200)
 await page.screenshot({path:`${out}/editor.png`})
 // Capture loss must close the transaction, so later edits remain undoable.
 await page.getByTestId('aim-object-btn').click()
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down()
 await page.getByTestId('three-canvas-wrapper').evaluate(el=>{if(el.hasPointerCapture(1))el.releasePointerCapture(1)})
 await page.mouse.move(box.x+box.width*.5+1,box.y+box.height*.5)
 await page.waitForFunction(()=>!window.__omniframe_store.getState().inInteraction)
 await page.mouse.up()
 // Actual app MediaRecorder export, not a separate recording implementation.
 await page.evaluate(()=>{
  const s=window.__omniframe_store.getState();s.setCustomSequenceDimensions(640,360)
  const c=document.createElement('canvas');c.width=320;c.height=180
  s.addAsset({id:'backdrop',name:'Backdrop',kind:'image',url:c.toDataURL(),width:320,height:180,duration:2,size:100})
  s.addClipToTrack(s.ensureTrack('video'),'backdrop',0)
  s.setClipProp(window.__omniframe_store.getState().clips[0].id,{duration:2})
 })
 const downloadPromise=page.waitForEvent('download')
 await page.evaluate(async()=>{const {exportVideo}=await import('/src/lib/export.ts');await exportVideo()})
 const download=await downloadPromise,videoPath=`${out}/`+download.suggestedFilename()
 await download.saveAs(videoPath)
 const frame=PNG.sync.read(execFileSync(ffmpeg.path,['-v','error','-ss','0.6','-i',videoPath,'-frames:v','1','-f','image2pipe','-vcodec','png','-'],{maxBuffer:8e6}))
 assert.equal(frame.width,640);assert.equal(frame.height,360)
 let centerBright=0,edgeBright=0
 for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
  const i=(y*frame.width+x)*4,bright=Math.max(...frame.data.subarray(i,i+3))>40
  if(x<15||x>625){if(bright)edgeBright++}else if(bright)centerBright++
 }
 assert.ok(centerBright>2000,'export contains rendered geometry');assert.equal(edgeBright,0,'different-shaped viewport is letterboxed rather than stretched')
 fs.writeFileSync(`${out}/export-frame.png`,PNG.sync.write(frame))
 result.checks.push('second pointer leaves gesture ownership intact','capture loss closes history','native browser video export contains geometry with preserved aspect')
 await page.getByTestId('sculpt-controls').getByRole('button',{name:'Sculpt',exact:true}).click()
 assert.equal(await page.getByLabel('Sculpt radius').count(),0,'brush controls collapse to free canvas space')
 const layouts=[]
 for(const viewport of [{width:390,height:844},{width:768,height:900}]){
  await page.setViewportSize(viewport)
  await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.setLeftOpen(false);s.setRightOpen(false)})
  await page.waitForTimeout(200)
  const layout=await page.evaluate(()=>{
   const bounds=id=>document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(),stage=bounds('three-viewer-container'),hud=bounds('three-hud-toolbar'),modes=bounds('blender-modes-toolbar')
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,withinStage:[hud,modes].every(b=>b.left>=stage.left&&b.right<=stage.right+1),canvasFits:(()=>{const c=document.getElementById('of-three-canvas');return c.clientWidth===c.parentElement.clientWidth&&c.clientHeight===c.parentElement.clientHeight})()}
  })
  assert.ok(!layout.overflow&&layout.withinStage&&layout.canvasFits,JSON.stringify(layout))
  await page.screenshot({path:`${out}/editor-${viewport.width}.png`});layouts.push({viewport,...layout})
 }
 result.layouts=layouts
 assert.deepEqual(errors,[],'no browser exceptions')
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({...result,errors},null,2));console.log(JSON.stringify(result,null,2))
}finally{await browser.close()}
