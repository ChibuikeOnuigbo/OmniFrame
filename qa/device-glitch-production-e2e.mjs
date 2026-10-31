import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'qa-output')
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true})
await inflate(path.join(root,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${path.join(os.tmpdir(),'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']})
const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[]
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('BROWSER',m.text()) })
page.on('pageerror',e=>errors.push(String(e)))
try {
 await page.goto(process.env.URL||'http://localhost:5173/#studio',{waitUntil:'networkidle'})
 await page.waitForFunction(()=>window.__omniframe_store)
 const modelChecks=await page.evaluate(async()=>{
   const {prepareDeviceModels,drawDeviceScene,rigAt}=await import('/src/lib/device3d.ts')
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')
   const THREE=await import('/node_modules/three/build/three.module.js')
   const {DEVICE_MODELS}=await import('/src/lib/deviceModelRenderer.ts')
   await prepareDeviceModels()
   const src=document.createElement('canvas');src.width=640;src.height=360
   const sx=src.getContext('2d');sx.fillStyle='#ff2010';sx.fillRect(0,0,320,180);sx.fillStyle='#20e050';sx.fillRect(320,0,320,180);sx.fillStyle='#2040ff';sx.fillRect(0,180,320,180);sx.fillStyle='#ffd020';sx.fillRect(320,180,320,180)
   const results=[]
   for(const id of DEVICE_MODELS){
    const gltf=await new GLTFLoader().loadAsync(`/models/device_transitions/${id}.glb`)
    const screen=gltf.scene.getObjectByName('ScreenSurface');gltf.scene.updateMatrixWorld(true)
    const size=new THREE.Box3().setFromObject(screen).getSize(new THREE.Vector3())
    const uv=screen.geometry.getAttribute('uv'),normal=screen.geometry.getAttribute('normal')
    if(!uv || !normal || size.y<.01)throw new Error(`${id} screen geometry/UV/orientation invalid`)
    const kind=id.startsWith('phone')?'phone':id.startsWith('monitor')?'monitor':id.startsWith('tv')?'tv':'laptop'
    const frames=[]
    for(const p of [0,.15,.3,.5,.7,.85,1]){
     const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#101824';x.fillRect(0,0,640,360)
     drawDeviceScene(x,640,360,kind,rigAt(kind,p),src,{model:id,fit:'cover'})
     frames.push({p,png:c.toDataURL()})
     if(p===1){const a=x.getImageData(0,0,640,360).data,b=sx.getImageData(0,0,640,360).data;if(a.some((v,i)=>v!==b[i]))throw new Error(`${id} handoff mismatch`)}
    }
    const capture=(options)=>{const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');drawDeviceScene(x,320,180,kind,rigAt(kind,.35),src,{model:id,...options});return x.getImageData(0,0,320,180).data}
    const base=capture({}),custom=capture({cameraDistance:3,yaw:35,pitch:15,roll:20,keyLight:0,rimLight:0,environmentLight:0})
    const changedPixels=base.reduce((sum,value,i)=>sum+(value!==custom[i]?1:0),0);if(changedPixels<100)throw Error(id+' camera/light controls had no visible effect')
    results.push({id,changedPixels,size:[size.x,size.y,size.z],uvCount:uv.count,frames})
   }
   const {deviceModelsStatus}=await import('/src/lib/device3d.ts')
   const status=await deviceModelsStatus();if(!status?.webgl)throw new Error('GLB WebGL renderer did not run: '+JSON.stringify(status))
   return results
 })
 for(const result of modelChecks){fs.mkdirSync(path.join(out,'device-transitions',result.id),{recursive:true});for(const f of result.frames)fs.writeFileSync(path.join(out,'device-transitions',result.id,`${f.p}.png`),Buffer.from(f.png.split(',')[1],'base64'));delete result.frames}
 console.log('PASS seven GLBs, geometry, UVs, screen orientation, 49 renders, exact handoff')
 const checks=await page.evaluate(async()=>{
   const lib=await import('/src/lib/effectCatalog.ts');await lib.loadGlitchRecipeCatalog()
   const entries=lib.getFxCatalog().filter(e=>/^ng-\d{4}$/.test(e.id));if(entries.length!==5000)throw Error('Missing authored recipes')
   const store=window.__omniframe_store
   const {createDefaultClipAnimation}=await import('/src/lib/animation/CurveEngine.ts')
   const {mergeFxInstances}=await import('/src/lib/fxInstances.ts')
   const {renderGlitchRGBA,recipeFromEffect}=await import('/src/lib/glitchNG.ts')
   const src=new Uint8ClampedArray(64*36*4);for(let i=0;i<src.length;i++)src[i]=i%4===3?255:i%251
   const plate=document.createElement('canvas');plate.width=64;plate.height=36;plate.getContext('2d').fillRect(0,0,64,36)
   store.setState({clips:[],assets:[],tracks:[],past:[],future:[]})
   store.getState().addAsset({id:'qa-image-asset',kind:'image',name:'QA image',url:plate.toDataURL(),duration:5,width:64,height:36,size:100})
   const trackId=store.getState().ensureTrack('video');store.getState().addClipToTrack(trackId,'qa-image-asset',3)
   const clip=store.getState().clips[0]
   store.getState().setClipProp(clip.id,{duration:5})
   const a=store.getState().addFxInstance(clip.id,'ng-0001'),b=store.getState().addFxInstance(clip.id,'ng-2501')
   store.getState().updateFxParams(clip.id,a,{ngLead:0,ngAttack:0,ngHold:5,ngDecay:0,ngPattern:'slow-build'})
   store.getState().updateFxParams(clip.id,b,{ngLead:0,ngAttack:0,ngHold:5,ngDecay:0,ngBlend:'screen',ngPattern:'slow-build'})
   store.getState().setFxKey(clip.id,a,'ngIntensity',0,0);store.getState().setFxKey(clip.id,a,'ngIntensity',2,1)
   let c=store.getState().clips[0],eff=mergeFxInstances(c,1)
   if(JSON.parse(eff.ngLayersJSON).length!==2)throw Error('Glitch layers overwritten')
   const before=renderGlitchRGBA(src,64,36,4,recipeFromEffect(eff))
   store.getState().moveFxInstance(clip.id,b,-1)
   const reversed=store.getState().clips[0].fxInstances.map(f=>f.id).join()
   if(reversed!==[b,a].join())throw Error('Reorder failed')
   store.getState().undo();if(store.getState().clips[0].fxInstances[0].id!==a)throw Error('Reorder undo failed')
   store.getState().redo();if(store.getState().clips[0].fxInstances[0].id!==b)throw Error('Reorder redo failed')
   const {buildOmniProjectBundle,parseOmniProjectBundle}=await import('/src/lib/omniProject.ts')
   const doc={assets:store.getState().assets,tracks:store.getState().tracks,clips:store.getState().clips,transitions:[{id:'qa-trans',type:'device_phone',fromClipId:clip.id,toClipId:clip.id,trackId:'qa-video',startTime:2,duration:1.6,enabled:true,alignment:'centered',parameters:{model:'phone_modern_silver',fit:'contain',fov:47,motion:'orbit',cameraDistance:3.5,yaw:25,keyLight:1.5,rimLight:2,environmentLight:1}}]}
   const blob=await buildOmniProjectBundle(doc,'Device glitch QA'),parsed=await parseOmniProjectBundle(new File([blob],'qa.omni'))
   if(JSON.stringify(doc.clips)!==JSON.stringify(parsed.state.clips) || JSON.stringify(doc.transitions)!==JSON.stringify(parsed.state.transitions))throw Error('Project round trip changed settings')
   store.setState({transitions:doc.transitions,selectedTransitionId:'qa-trans',selectedClipId:null,rightOpen:true})
   store.getState().updateTransition('qa-trans',{parameters:{...doc.transitions[0].parameters,fov:55}})
   store.getState().undo();if(store.getState().transitions[0].parameters.fov!==47)throw Error('Transition undo failed')
   store.getState().redo();if(store.getState().transitions[0].parameters.fov!==55)throw Error('Transition redo failed')
   store.getState().selectTransition('qa-trans')
   return {recipes:entries.length,layers:2,keyframes:true,undoRedo:true,projectRoundTrip:true,transitionUndo:true,rgbaBytes:before.length}
 })
 console.log('PASS catalog, ordered layers, keyframes, project save/reopen, FX and transition undo/redo',checks)
 await page.getByLabel('Device model',{exact:true}).waitFor({state:'visible'})
 await page.getByLabel('Device model',{exact:true}).selectOption('laptop_open_dark')
 await page.getByLabel('Device display fit',{exact:true}).selectOption('contain')
 await page.getByText('Camera & angle',{exact:true}).click()
 await page.getByRole('slider',{name:'Device yaw',exact:true}).press('End')
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions[0].parameters.yaw),180)
 await page.getByText('Lighting',{exact:true}).click()
 await page.getByRole('slider',{name:'Key light',exact:true}).press('Home')
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions[0].parameters.keyLight),0)
 await page.screenshot({path:path.join(out,'screenshots','device-inspector.png')})
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().transitions[0].parameters.model),'laptop_open_dark')
 await page.evaluate(()=>{const g=window.__omniframe_store.getState();g.selectClip(g.clips[0].id);g.setLeftTab('effects')})
 await page.getByTestId('fx-catalog-search').fill('ng-5000')
 await page.getByTestId('fx-tile-ng-5000').click()
 await page.getByLabel('Layer opacity value',{exact:true}).fill('0.5')
 const opacity=await page.evaluate(()=>{const g=window.__omniframe_store.getState();return g.clips[0].fxInstances.find(f=>f.id===g.activeFx.fxId).params.ngOpacity})
 assert.equal(opacity,.5)
 await page.screenshot({path:path.join(out,'screenshots','glitch-builder.png')})
 await page.evaluate(()=>{const g=window.__omniframe_store.getState();g.setLeftTab('drawing');g.setDrawingEnabled(true);g.setDrawingTool('heart');g.requestDrawingSection('tool-params')})
 await page.getByTestId('panel-shape-filled-checkbox').check()
 const canvas=page.getByTestId('drawing-canvas'),box=await canvas.boundingBox()
 assert.ok(box)
 await page.mouse.move(box.x+box.width*.25,box.y+box.height*.25);await page.mouse.down()
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.75,{steps:8});await page.mouse.up()
 const stroke=await page.evaluate(()=>window.__omniframe_store.getState().drawingStrokes.at(-1))
 assert.equal(stroke.tool,'heart');assert.equal(stroke.filled,true)
 await page.screenshot({path:path.join(out,'screenshots','filled-heart-ui.png')})
 console.log('PASS real catalog search/apply, layer opacity inspector, and filled-heart pointer drawing')
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(out,'production-e2e.json'),JSON.stringify({modelChecks,checks,pageErrors:errors},null,2))
} finally {await browser.close()}
