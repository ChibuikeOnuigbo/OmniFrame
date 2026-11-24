import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${os.tmpdir()}/al2023/lib:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 await page.goto(process.env.URL||'http://localhost:5181/#studio',{waitUntil:'networkidle'})
 const ids=await page.evaluate(()=>{
  const st=window.__omniframe_store,s=()=>st.getState();s().newProject();s().setCustomSequenceDimensions(320,180)
  const cv=document.createElement('canvas');cv.width=320;cv.height=180;const x=cv.getContext('2d');x.fillStyle='#00ff00';x.fillRect(0,0,320,180)
  s().addAsset({id:'trim-plate',name:'Trim plate',kind:'image',url:cv.toDataURL(),duration:12,width:320,height:180,size:100})
  s().addClipToTrack(s().ensureTrack('video'),'trim-plate',0);const id=s().clips[0].id;s().setClipProp(id,{duration:12})
  const fx=s().addFxInstance(id,'essential-color-hold');s().setFxRange(id,fx,1,8)
  s().setFxKey(id,fx,'colorHold',0,0);s().setFxKey(id,fx,'colorHold',4,1);s().setFxKey(id,fx,'colorHold',8,0)
  const f=s().clips[0].fxInstances[0]
  s().setClipProp(id,{fxInstances:[{...f,id:'completed',inP:0,duration:1},f,{...f,id:'future',inP:9,duration:1}]})
  s().setMonitorMode('program');s().setPlayhead(5);return {id,fx}
 })
 const gray=()=>page.waitForFunction(()=>{const c=document.getElementById('of-canvas'),p=c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data;return p[0]>170&&Math.abs(p[0]-p[1])<3})
 await gray()
 const before=await page.locator('#of-canvas').evaluate(c=>c.toDataURL())
 const result=await page.evaluate(async({id,fx})=>{
  const st=window.__omniframe_store,s=()=>st.getState(),c=()=>s().clips.find(c=>c.id===id)
  s().trimClip(id,'left',3);s().trimClip(id,'right',7)
  if(c().fxInstances.length!==1||c().fxInstances[0].sourceOffset!==2)throw Error('trim window incorrect')
  const expected=JSON.stringify(c().fxInstances)
  s().undo();s().undo();if(c().fxInstances.length!==3)throw Error('Undo lost intervals')
  s().redo();s().redo();if(JSON.stringify(c().fxInstances)!==expected)throw Error('Redo changed curve')
  const bundle=await s().saveOmniProject('Trimmed effects');s().newProject();await s().loadOmniProject(new File([bundle],'trim.omni'))
  if(JSON.stringify(c().fxInstances)!==expected)throw Error('Save/Open lost animation')
  s().setPlayhead(5);return {instances:c().fxInstances}
 },ids)
 await gray();assert.equal(await page.locator('#of-canvas').evaluate(c=>c.toDataURL()),before,'same timeline moment keeps exact preview pixels after trim/save')
 assert.equal(result.instances[0].keys.colorHold[0].t,-2)
 fs.mkdirSync('qa-output/fx-trim',{recursive:true});await page.screenshot({path:'qa-output/fx-trim/preview.png'})
 fs.writeFileSync('qa-output/fx-trim/report.json',JSON.stringify({pixelContinuity:true,undoRedo:true,roundTrip:true,...result},null,2))
 await page.evaluate(({id})=>{
  const st=window.__omniframe_store,s=()=>st.getState(),clip=()=>s().clips.find(c=>c.id===id)
  s().selectClip(id);s().trimSelectedClips('left',1)
  if(clip().fxInstances[0].sourceOffset!==3)throw Error('keyboard trim clock')
  s().undo()
  const source=clip(),f=source.fxInstances[0]
  st.setState({clips:[{...source,start:0,duration:12,fxInstances:[{...f,inP:1,duration:10,sourceOffset:0,keys:{colorHold:[{t:0,v:0},{t:10,v:1}]}}]}],insertionMode:'overwrite'})
  s().addClipToTrack(source.trackId,'trim-plate',3)
  const tail=s().clips.find(c=>c.assetId===source.assetId&&c.start>3&&c.fxInstances?.length)
  if(!tail||tail.fxInstances[0].sourceOffset!==tail.start-1)throw Error('overwrite effect tail clock')
 },ids)
 console.log('PASS actual preview pixels, completed/future interval removal, source keys, Undo/Redo and Save/Open')
} finally {await browser.close()}
