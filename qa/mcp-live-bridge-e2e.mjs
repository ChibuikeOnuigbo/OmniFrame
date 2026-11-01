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
 const page=await browser.newPage();await page.goto(process.env.URL||'http://localhost:5173/#studio',{waitUntil:'networkidle'})
 const result=await page.evaluate(async()=>{
  const store=window.__omniframe_store,call=(tool,params)=>window.omniMCP.call(tool,params)
  store.setState({assets:[],clips:[],tracks:[],past:[],future:[]})
  const cv=document.createElement('canvas');cv.width=320;cv.height=180
  store.getState().addAsset({id:'mcp-plate',kind:'image',name:'MCP plate',url:cv.toDataURL(),duration:5,width:320,height:180,size:100})
  const track=store.getState().ensureTrack('video');store.getState().addClipToTrack(track,'mcp-plate',0)
  store.getState().addClipToTrack(track,'mcp-plate',5)
  const id=store.getState().clips[0].id
  const checked=async(name,params)=>{const r=await call(name,params);if(!r.ok)throw Error(name+': '+r.error);return r.out}
  await checked('select',{clipId:id})
  const previewBefore=JSON.stringify(store.getState().clips)
  const presetPreview=await checked('preset_preview',{catalog:'effect',id:'studio-0-0-0'})
  if(!presetPreview['data:img']?.startsWith('data:image/png;base64,')||previewBefore!==JSON.stringify(store.getState().clips))throw Error('non-destructive MCP preset preview failed')
  for(const request of [{catalog:'transition',id:'cross_dissolve'},{catalog:'lut',id:'clean-neutral'},{catalog:'text',id:'cinematic-fade',text:'PREVIEW'}]){
   const preview=await checked('preset_preview',request)
   if(!preview['data:img']?.startsWith('data:image/png;base64,')||previewBefore!==JSON.stringify(store.getState().clips))throw Error(request.catalog+' MCP preset preview failed')
  }
  await checked('mask_draw',{x0:10,y0:20,x1:200,y1:120})
  const mask=store.getState().clips[0].mask
  if(mask.rotation!==0 || mask.opacity!==1 || mask.expansion!==0)throw Error('missing mask defaults')
  await checked('mask_clear',{});store.getState().undo()
  if(!store.getState().clips[0].mask)throw Error('mask undo failed')
  await checked('select',{clipId:id});await checked('clip_stretch',{duration:12});store.getState().undo()
  if(store.getState().clips[0].duration===12)throw Error('stretch undo failed')
  await checked('select',{clipId:id});await checked('omniframe_move',{t:2,x:80,y:40})
  let clip=store.getState().clips[0]
  if(!clip.animation.curves.position_x.keyframes.some(k=>k.time===2&&k.value===80&&k.interpolation==='constant'))throw Error('move key missing')
  await checked('keyframe_set',{property:'position',channel:'X',time:3,value:160})
  await checked('curve_set',{property:'position',channel:'X',interpolation:'ease-in-out'})
  clip=store.getState().clips[0]
  if(clip.animation.curves.position_x.keyframes.some(k=>k.interpolation!=='ease-in-out'))throw Error('curve update discarded')
  await checked('edit_element',{clipId:id,patch:{speedCurve:'hold-then-go',inPoint:1,volume:.35}})
  clip=store.getState().clips[0]
  if(clip.speedCurve!=='hold-then-go'||clip.inPoint!==1||clip.volume!==.35)throw Error('source clock/volume edit discarded')
  store.getState().undo();clip=store.getState().clips[0]
  if(clip.speedCurve||clip.inPoint!==0||clip.volume!==1)throw Error('source clock edit undo failed')
  store.getState().redo()
  store.getState().setClipBlend(id,'multiply',0)
  store.getState().setClipBlend(id,'screen',1)
  clip=store.getState().clips[0]
  if(clip.blendKeys?.length!==2||clip.blendKeys[1].mode!=='screen')throw Error('blend keys were not stored')
  store.getState().undo();if(store.getState().clips[0].blendKeys?.length!==1)throw Error('blend-key undo failed')
  store.getState().redo();if(store.getState().clips[0].blendKeys?.length!==2)throw Error('blend-key redo failed')
  const before=JSON.stringify(store.getState().clips[0]),badClock=await call('edit_element',{clipId:id,patch:{speedCurve:'unknown',inPoint:4}}),badVolume=await call('edit_element',{clipId:id,patch:{volume:-1}})
  if(badClock.ok||badVolume.ok||before!==JSON.stringify(store.getState().clips[0]))throw Error('bad source edit partially mutated clip')
  const {buildOmniProjectBundle,parseOmniProjectBundle}=await import('/src/lib/omniProject.ts')
  const state=store.getState(),bundle=await buildOmniProjectBundle({assets:state.assets,tracks:state.tracks,clips:state.clips,transitions:[]},'MCP clock test'),loaded=await parseOmniProjectBundle(new File([bundle],'clock.omni'))
  if(loaded.state.clips[0].speedCurve!=='hold-then-go'||loaded.state.clips[0].inPoint!==1||loaded.state.clips[0].volume!==.35||loaded.state.clips[0].blendKeys?.length!==2)throw Error('source clock/blend project round trip failed')
  await checked('edit_element',{clipId:id,patch:{speedCurve:null}})
  if(store.getState().clips[0].speedCurve!==undefined)throw Error('source clock clear failed')
  const missing=await call('select',{clipId:'missing'}),bad=await call('clip_stretch',{duration:NaN}),invalidTrack=await call('track_assign',{track:'missing'})
  if(missing.ok||bad.ok||invalidTrack.ok)throw Error('invalid inputs reported success')
  const dump=await checked('dump',{}),timeline=await checked('timeline_screenshot',{})
  return {catalog:(await checked('help',{})).catalog,dump,timeline,mask,invalidInputsRejected:true,undo:true,sourceClockVolumePersistence:true,blendKeyPersistence:true,presetPreview:true}
 })
 fs.mkdirSync(path.join(root,'qa-output/mcp'),{recursive:true})
 fs.writeFileSync(path.join(root,'qa-output/mcp/live-timeline.png'),Buffer.from(result.timeline['data:img'].split(',')[1],'base64'));delete result.timeline
 fs.writeFileSync(path.join(root,'qa-output/mcp/live-bridge-report.json'),JSON.stringify(result,null,2))
 console.log('PASS live app MCP: mask defaults, undo, move/keyframe/curve persistence, invalid inputs, timeline; '+result.catalog.length+' tools')
}finally{await browser.close()}
