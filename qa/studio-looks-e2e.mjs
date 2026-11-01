import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
const out = join(root, 'qa-output/studio-looks-20261101')
mkdirSync(out, { recursive: true })
try {
 const page = await browser.newPage({viewport:{width:1440,height:900}})
 await page.goto('http://localhost:5173/#studio',{waitUntil:'networkidle'})
 const result = await page.evaluate(async () => {
  const {getFxCatalog,paramsForPatch,loadGlitchRecipeCatalog} = await import('/src/lib/effectCatalog.ts')
  const {applyPixelGrade} = await import('/src/lib/pixelGrade.ts')
  await loadGlitchRecipeCatalog()
  const looks=getFxCatalog().filter(e=>e.id.startsWith('studio-'))
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),src=ctx.createImageData(96,64)
  for(let y=0;y<64;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;src.data[i]=x*2.6;src.data[i+1]=y*4;src.data[i+2]=(x*13+y*7)%256;src.data[i+3]=255}
  const signatures=new Set(), patches=new Set(),failures=[]
  const hash=data=>{let h=2166136261;for(const b of data)h=Math.imul(h^b,16777619);return h>>>0}
  const original=hash(src.data)
  const sheet=document.createElement('canvas');sheet.width=384;sheet.height=264;const sc=sheet.getContext('2d')
  for(let n=0;n<looks.length;n++){
   const e=looks[n];patches.add(JSON.stringify(e.patch))
   for(const p of paramsForPatch(e.patch))if(p.kind==='number'&&(e.patch[p.key]<p.min||e.patch[p.key]>p.max))failures.push(e.id+':bounds:'+p.key)
   ctx.putImageData(src,0,0);applyPixelGrade(canvas,e.patch,24)
   const signature=hash(ctx.getImageData(0,0,96,64).data);signatures.add(signature)
   if(signature===original)failures.push(e.id+':unchanged')
   if(n%96===0){const j=n/96,x=j%4*96,y=Math.floor(j/4)*88;sc.drawImage(canvas,x,y);sc.fillStyle='white';sc.font='9px sans-serif';sc.fillText(e.name.split(' · ')[0],x,y+76)}
  }
  const store=window.__omniframe_store;ctx.putImageData(src,0,0)
  store.getState().addAsset({id:'look-source',kind:'image',name:'Studio fixture',url:canvas.toDataURL(),width:96,height:64,duration:5,size:100})
  store.getState().addClipToTrack(store.getState().ensureTrack('video'),'look-source',0)
  store.getState().setLeftTab('effects')
  return {count:looks.length,total:getFxCatalog().length,uniqueIds:new Set(looks.map(x=>x.id)).size,patches:patches.size,pixelSignatures:signatures.size,failures,sheet:sheet.toDataURL()}
 })
 assert.equal(result.count,1152);assert.equal(result.uniqueIds,1152);assert.equal(result.patches,1152);assert.deepEqual(result.failures,[])
 assert.ok(result.pixelSignatures>1000,JSON.stringify({...result,sheet:undefined}))
 await page.getByLabel('Effect collection',{exact:true}).selectOption('studio')
 assert.match(await page.getByTestId('fx-catalog-count').textContent(),/^1152\//)
 await page.getByTestId('fx-catalog-search').fill('Cinema · Ember · Whisper')
 await page.getByRole('button',{name:'Favorite Cinema · Ember · Whisper',exact:true}).click()
 await page.getByLabel('Effect collection',{exact:true}).selectOption('favorites')
 assert.equal(await page.getByTestId('fx-tile-studio-0-0-0').count(),1)
 await page.getByRole('button',{name:'Preview Cinema · Ember · Whisper',exact:true}).click()
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().visualPreview?.kind),'clip-effect')
 await page.evaluate(()=>window.__omniframe_store.getState().stopVisualPreview())
 await page.getByTestId('fx-tile-studio-0-0-0').click()
 const applied=await page.evaluate(()=>window.__omniframe_store.getState().clips.find(c=>c.assetId==='look-source').fxInstances)
 assert.equal(applied.at(-1).catalogId,'studio-0-0-0')
 await page.evaluate(()=>window.__omniframe_store.getState().undo())
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().clips.find(c=>c.assetId==='look-source').fxInstances?.length||0),0)
 await page.evaluate(()=>window.__omniframe_store.getState().redo())
 await page.screenshot({path:join(out,'catalog.png')})
 const bundle = await page.evaluate(async()=>Array.from(new Uint8Array(await (await window.__omniframe_store.getState().saveOmniProject('Studio Looks Test')).arrayBuffer())))
 await page.getByTestId('omni-project-input').setInputFiles({name:'studio.omni',mimeType:'application/x-omniframe-project',buffer:Buffer.from(bundle)})
 await page.waitForFunction(()=>window.__omniframe_store.getState().projectName==='Studio Looks Test')
 assert.equal(await page.evaluate(()=>window.__omniframe_store.getState().clips.find(c=>c.assetId==='look-source').fxInstances[0].catalogId),'studio-0-0-0')
 await page.evaluate(()=>{
  const store=window.__omniframe_store,s=store.getState()
  store.setState({assets:s.assets.map(a=>a.id==='look-source'?{...a,kind:'video',url:'/qa/fixtures/pexels-cinematic-8s.webm',duration:8}:a),clips:s.clips.map(c=>c.assetId==='look-source'?{...c,kind:'video',duration:2}:c),duration:2,playhead:0,sequenceSettings:{...s.sequenceSettings,width:320,height:180}})
 })
 await page.waitForTimeout(500)
 const downloadPromise=page.waitForEvent('download',{timeout:30000})
 await page.getByTestId('export-video-btn').click()
 const download=await downloadPromise;await download.saveAs(join(out,'studio-look-export.mp4'))
 await page.reload({waitUntil:'networkidle'})
 await page.evaluate(()=>window.__omniframe_store.getState().setLeftTab('effects'))
 await page.getByLabel('Effect collection',{exact:true}).selectOption('favorites')
 assert.equal(await page.getByTestId('fx-tile-studio-0-0-0').count(),1)
 result.projectRoundTrip=true;result.videoExport=true;result.favoriteReload=true

 writeFileSync(join(out,'contact-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet
 writeFileSync(join(out,'report.json'),JSON.stringify(result,null,2))
 console.log('PASS',result,'catalog filter, favorites, audition, apply, undo/redo')
}finally{await browser.close()}
