/** Real loaded GLBs, live video, PreviewEngine and the product recorder export. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'evidence_video/asset-transitions')
fs.mkdirSync(out,{recursive:true})
await inflate(path.join(root,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${path.join(os.tmpdir(),'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']})
const errors=[],jobs=['device_tv_crt_knobs','device_tv_crt_silver','object_arrow_sweep','object_shell_whip','object_payphone_orbit','object_concrete_shatter']
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}});page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(process.env.URL||'http://localhost:5176/#studio',{waitUntil:'networkidle'})
 const checks=await page.evaluate(async()=>{
  const {prepareDeviceModels,drawDeviceScene}=await import('/src/lib/device3d.ts')
  const {prepareObjectAssets,drawObjectTransition,objectRendererStatus}=await import('/src/lib/object3d.ts')
  const {OBJECT_ASSETS}=await import('/src/lib/transitionAssetCatalog.ts')
  await prepareDeviceModels();await prepareObjectAssets()
  const make=()=>{const c=document.createElement('canvas');c.width=640;c.height=360;return c},from=make(),to=make()
  const a=from.getContext('2d'),b=to.getContext('2d');a.fillStyle='#293c59';a.fillRect(0,0,640,360);a.fillStyle='#edb66d';a.fillRect(20,40,260,260)
  b.fillStyle='#a64d9e';b.fillRect(0,0,640,360);b.fillStyle='#28dfb9';b.fillRect(320,0,320,180)
  const results=[]
  for(const type of Object.keys(OBJECT_ASSETS)){
   const snaps=[]
   for(const p of [0,.25,.5,.75,1]){
    const c=make(),x=c.getContext('2d');drawObjectTransition(x,640,360,type,p,from,to)
    if(p===0||p===1){const target=(p===0?a:b).getImageData(0,0,640,360).data,data=x.getImageData(0,0,640,360).data;if(data.some((v,i)=>v!==target[i]))throw Error(type+' endpoint mismatch')}
    snaps.push({p,png:c.toDataURL()})
   }
   const capture=options=>{const c=make(),x=c.getContext('2d');drawObjectTransition(x,640,360,type,.43,from,to,options);return x.getImageData(0,0,640,360).data}
   const normal=capture({}),custom=capture(type==='object_concrete_shatter'?{spread:2,turns:1.3}:{size:1.6,turns:1.3})
   const changed=normal.reduce((n,v,i)=>n+(v!==custom[i]?1:0),0);if(changed<100)throw Error(type+' geometry controls did not affect actual pixels')
   results.push({type,changed,frames:snaps})
  }
  for(const id of ['tv_crt_knobs_ph','tv_crt_silver_ph']){
   const c=make(),x=c.getContext('2d');drawDeviceScene(x,640,360,'tv',{rotX:0,rotY:0,scale:1,x:0,y:0,fill:0,bodyAlpha:1},to,{model:id,fit:'cover'})
   const pixels=x.getImageData(0,0,640,360).data;let brightGreen=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<80&&pixels[i+1]>150&&pixels[i+2]>100)brightGreen++
   if(brightGreen<100)throw Error(id+' live screen is missing/occluded')
   results.push({type:id,brightGreen,frames:[{p:0,png:c.toDataURL()}]})
  }
  const status=objectRendererStatus();if(!status.webgl||status.loadedModels!==4)throw Error('Actual object WebGL renderer unavailable '+JSON.stringify(status))
  return {results,status}
 })
 const thumbnails=path.join(root,'public/models/transition_assets/thumbnails');fs.mkdirSync(thumbnails,{recursive:true})
 for(const result of checks.results){
  for(const f of result.frames){
   const bytes=Buffer.from(f.png.split(',')[1],'base64');fs.writeFileSync(path.join(out,`${result.type}-pose-${f.p}.png`),bytes)
   if((result.type.startsWith('object_')&&f.p===.5)||result.type.startsWith('tv_')){
    const name=result.type==='tv_crt_knobs_ph'?'device_tv_crt_knobs':result.type==='tv_crt_silver_ph'?'device_tv_crt_silver':result.type
    fs.writeFileSync(path.join(thumbnails,name+'.png'),bytes)
   }
  }
  delete result.frames
 }
 await page.evaluate(async()=>{
  const store=window.__omniframe_store
  store.setState({assets:[],clips:[],tracks:[],transitions:[],drawingStrokes:[],past:[],future:[],playing:false,visualPreview:null,playhead:0})
  store.getState().setSequenceAspectRatio('custom',640,360);store.getState().setPreviewQuality('full');store.getState().setProjectFps(30)
  const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#101d32');g.addColorStop(1,'#38314a');x.fillStyle=g;x.fillRect(0,0,1280,720)
  x.strokeStyle='#fc9b56';x.lineWidth=4;x.strokeRect(60,60,1160,600);x.fillStyle='#f4f6ff';x.font='bold 100px sans-serif';x.fillText('OMNIFRAME',90,340);x.font='34px sans-serif';x.fillStyle='#ffb27c';x.fillText('TEXTURED 3D TRANSITIONS',96,410)
  store.getState().addAsset({id:'asset-title',kind:'image',name:'Original transition title',url:c.toDataURL(),width:1280,height:720,duration:3,size:1000})
  store.getState().addAsset({id:'asset-video',kind:'video',name:'User-provided RDT edit (reference footage)',url:'/evidence_video/reala/source/RDT_20261027_092910.mp4',width:360,height:640,duration:25.067,size:1454482})
  const track=store.getState().ensureTrack('video');store.getState().addClipToTrack(track,'asset-title',0);const from=store.getState().selectedClipId;store.getState().setClipProp(from,{duration:3})
  store.getState().addClipToTrack(track,'asset-video',3);const to=store.getState().selectedClipId;store.getState().setClipProp(to,{duration:3,inPoint:8,volume:.4})
  store.getState().addTransition({type:'object_arrow_sweep',fromClipId:from,toClipId:to,trackId:track,startTime:2.2,duration:1.6,enabled:true,alignment:'centered'})
  store.getState().setPlayhead(2.2);store.getState().selectTransition(store.getState().transitions[0].id);store.getState().setRightOpen(true)
 })
 await page.waitForTimeout(500)
 await page.evaluate(()=>window.__omniframe_store.getState().setLeftTab('transitions'))
 await page.getByTestId('transition-pillar-object').click()
 assert.equal(await page.locator('[data-testid^="transition-card-object_"]').count(),4)
 await page.screenshot({path:path.join(out,'object-library.png')})
 const manifest=[]
 for(const type of jobs){
  await page.evaluate(type=>{const s=window.__omniframe_store.getState();s.updateTransition(s.transitions[0].id,{type,parameters:{}});s.selectTransition(s.transitions[0].id)},type)
  const file=path.join(out,type+'.mp4'),encoder=spawn(ffmpegExe(),['-y','-v','error','-f','image2pipe','-framerate','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',file],{stdio:['pipe','ignore','pipe']})
  let err='';encoder.stderr.on('data',d=>err+=d)
  const finished=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(Error(err)))})
  const videoTimes=[]
  for(let i=0;i<49;i++){
   await page.evaluate(time=>window.__omniframe_store.getState().setPlayhead(time),2.2+1.6*i/48);await page.waitForTimeout(80)
   const data=await page.evaluate(()=>({png:document.querySelector('#of-canvas').toDataURL(),times:[...document.querySelectorAll('video')].map(v=>v.currentTime)}))
   const buffer=Buffer.from(data.png.split(',')[1],'base64');if(!encoder.stdin.write(buffer))await new Promise(resolve=>encoder.stdin.once('drain',resolve))
   if([0,12,24,36,48].includes(i)){fs.writeFileSync(path.join(out,`${type}-frame-${i}.png`),buffer);videoTimes.push({i,times:data.times})}
  }
  encoder.stdin.end();await finished
  const decoded=execFileSync(ffmpegExe(),['-v','error','-i',file,'-map','0:v:0','-f','framemd5','-'],{encoding:'utf8'}),hashes=decoded.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim())
  assert.equal(hashes.length,49);assert(new Set(hashes).size>35)
  assert(videoTimes.at(-1).times.some((value,index)=>value-(videoTimes[0].times[index]||0)>.8),'Decoded footage clock did not advance')
  manifest.push({type,file:path.relative(root,file),frames:hashes.length,distinctHashes:new Set(hashes).size,resolution:[640,360],fps:30,videoTimes,source:'Original title + user-provided finished RDT edit; source cuts/effects remain baked in',renderer:'Actual PreviewEngine with loaded GLBs and live decoded video',audio:'Silent offline frame-sequence proof'})
  console.log('RENDERED',type)
 }
 // Exercise actual inspector controls, undo, generic transition API and save/reopen.
 await page.evaluate(()=>{const s=window.__omniframe_store.getState();s.selectTransition(s.transitions[0].id);s.setRightOpen(true)})
 await page.getByRole('slider',{name:'Fragment spread',exact:true}).press('End')
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions[0].parameters.spread),2.5)
 const persistence=await page.evaluate(async()=>{
  const state=window.__omniframe_store.getState(),s=window.__omniframe_store;state.undo();if(s.getState().transitions[0].parameters?.spread===2.5)throw Error('object control undo failed');s.getState().redo()
  const {buildOmniProjectBundle,parseOmniProjectBundle}=await import('/src/lib/omniProject.ts'),now=s.getState(),blob=await buildOmniProjectBundle({assets:now.assets,tracks:now.tracks,clips:now.clips,transitions:now.transitions},'3D asset test'),loaded=await parseOmniProjectBundle(new File([blob],'assets.omni'))
  if(loaded.state.transitions[0].type!=='object_concrete_shatter'||loaded.state.transitions[0].parameters.spread!==2.5)throw Error('object transition project data lost')
  const {TRANSITION_PRESETS}=await import('/src/lib/transitionPresets.ts');return {projectRoundTrip:true,undo:true,newPresets:TRANSITION_PRESETS.filter(p=>p.category==='Object 3D'||p.id.startsWith('device_tv_crt')).length}
 })
 await page.screenshot({path:path.join(out,'object-inspector.png')})
 // Native product export retains the source audio; not the offline PNG encoder above.
 await page.mouse.click(600,20)
 const agentApi=await page.evaluate(()=>{
  const api=window.__omniframe_transitions,list=api.list()
  if(list.presets.filter(p=>p.category==='Object 3D'||p.id.startsWith('device_tv_crt')).length!==6)throw Error('New presets missing from generic agent API')
  api.clear();const result=api.apply('object_arrow_sweep',1.6);if(!result.ok)throw Error(result.error)
  window.__omniframe_store.setState({exportRange:{in:2.2,out:3.8}})
  return {listed:true,apply:true,type:result.transition.type}
 })
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.evaluate(async()=>{const {exportVideo}=await import('/src/lib/export.ts');await exportVideo()})])
 const nativeFile=path.join(out,'editor-export.'+download.suggestedFilename().split('.').pop());await download.saveAs(nativeFile)
 const audio=execFileSync(ffmpegExe(),['-v','error','-i',nativeFile,'-vn','-ac','1','-ar','48000','-f','f32le','-']);let energy=0;for(let i=0;i<audio.length;i+=4)energy+=audio.readFloatLE(i)**2
 const rms=Math.sqrt(energy/(audio.length/4));assert(rms>.005,'Native recorder lost source sound')
 const nativeDecoded=execFileSync(ffmpegExe(),['-v','error','-i',nativeFile,'-map','0:v:0','-vsync','0','-f','framemd5','-'],{encoding:'utf8'})
 const nativeHashes=nativeDecoded.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim())
 assert(nativeHashes.length>2&&new Set(nativeHashes).size>2,'Native export video is empty/static')
 assert.deepEqual(errors,[])
 const reelList=path.join(root,'.cache/asset-transition-reel.txt');fs.mkdirSync(path.dirname(reelList),{recursive:true});fs.writeFileSync(reelList,manifest.map(item=>`file '${path.join(root,item.file)}'`).join('\n'))
 execFileSync(ffmpegExe(),['-y','-v','error','-f','concat','-safe','0','-i',reelList,'-c','copy','-movflags','+faststart',path.join(out,'six-asset-reel.mp4')])
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({checks,manifest,persistence,agentApi,combinedReel:'evidence_video/asset-transitions/six-asset-reel.mp4',nativeExport:{file:path.relative(root,nativeFile),audioRms:rms,frames:nativeHashes.length,distinctFrames:new Set(nativeHashes).size,note:'Realtime MediaRecorder output; software GPU capture does not establish fixed frame rate'},pageErrors:errors,scope:'Browser/WebGL source-texture and transition proofs; not native desktop, physical fracture simulation or a faithful RDT recreation'},null,2))
 console.log('PASS loaded geometry/PBR, endpoints, controls, save/undo and native video/audio export')
}finally{await browser.close()}
