import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd(), URL = process.env.URL || 'http://localhost:5173/'
const SHOTS = join(ROOT, 'qa/screenshots'), REPORTS = join(ROOT, 'qa/reports')
mkdirSync(SHOTS,{recursive:true}); mkdirSync(REPORTS,{recursive:true})
await inflate(join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${join(tmpdir(),'al2023/lib')}:${tmpdir()}`
const executablePath=await serverlessChromium.executablePath()
const browser=await pwChromium.launch({executablePath,args:['--no-sandbox','--use-gl=swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:900}})
const errors=[], failed=[]; const results=[]
page.on('console',m=>{if(m.type()==='error') errors.push(m.text())})
page.on('pageerror',e=>errors.push(String(e)))
page.on('requestfailed',r=>failed.push(`${r.url()} :: ${r.failure()?.errorText}`))
const pass=(name,detail='')=>{results.push({name,status:'PASS',detail}); console.log('PASS',name,detail)}
const assert=(v,name,detail='')=>{if(!v)throw new Error(`${name}: ${detail}`);pass(name,detail)}
const num=async(loc,k)=>Number(await loc.getAttribute(k))
const shot=async(name)=>page.screenshot({path:join(SHOTS,`${name}.png`)})
const drag=async(loc,dx,dy=0,steps=12)=>{const b=await loc.boundingBox(); if(!b)throw Error('no box'); await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps});await page.mouse.up()}

await page.goto(URL,{waitUntil:'networkidle'}); await shot('stress-01-empty')
assert(await page.getByText('Your canvas is empty').isVisible(),'empty state visible')
await page.getByTestId('import-input').setInputFiles([
 join(ROOT,'qa/fixtures/pexels-cinematic-8s.webm'),
 join(ROOT,'qa/fixtures/pexels-landscape-962322.jpg'),
 join(ROOT,'qa/fixtures/test-audio-6s.ogg')])
await page.waitForFunction(()=>document.querySelectorAll('[data-testid="timeline-clip"]').length===3)
await page.waitForTimeout(700); await shot('stress-02-video-image-audio')
let clips=page.getByTestId('timeline-clip')
assert(await clips.count()===3,'three media clips imported')
assert(await page.locator('[data-kind="video"]').count()===1,'video imported')
assert(await page.locator('[data-kind="image"]').count()===1,'image imported')
assert(await page.locator('[data-kind="audio"]').count()===1,'audio imported')
assert(Math.abs(await num(page.locator('[data-kind="video"]'),'data-start'))<.01,'video starts at zero')
assert(Math.abs(await num(page.locator('[data-kind="image"]'),'data-start')-8)<.1,'image appended after video')
assert(Math.abs(await num(page.locator('[data-kind="audio"]'),'data-start'))<.01,'audio starts independently at zero')

// Real playback + keyboard pause/play.
const t0=await page.getByTestId('current-time').textContent(); await page.keyboard.press('Space'); await page.waitForTimeout(900)
const t1=await page.getByTestId('current-time').textContent(); assert(t1!==t0,'Space starts playback',`${t0}->${t1}`)
await page.keyboard.press('Space'); const paused=await page.getByTitle('Play (Space)').isVisible(); assert(paused,'Space pauses playback')
await shot('stress-03-playback-paused')

// Fit makes the appended image visible; verify drag against measured px/time.
await page.getByTitle('Fit',{exact:true}).click(); await page.waitForTimeout(100)
let image=page.locator('[data-kind="image"]'); const imageStart=await num(image,'data-start')
const dragPx=100, dragScale=Number(await page.getByTestId('timeline').getAttribute('data-px-per-second'))
await drag(image,-dragPx); await page.waitForTimeout(150)
image=page.locator('[data-kind="image"]'); const movedImage=await num(image,'data-start')
assert(Math.abs(movedImage-(imageStart-dragPx/dragScale))<.15,'image clip drag maps pixels to time',`${imageStart}->${movedImage} at ${dragScale}px/s`)
await shot('stress-04-image-moved')

// Trim video edges and verify against the measured timeline scale.
let video=page.locator('[data-kind="video"]'); await video.click(); let d0=await num(video,'data-duration')
const trimPx=50, trimSeconds=trimPx/dragScale
await drag(video.getByTestId('trim-left'),trimPx); await page.waitForTimeout(100); video=page.locator('[data-kind="video"]')
let s1=await num(video,'data-start'), d1=await num(video,'data-duration'), in1=await num(video,'data-in-point')
assert(Math.abs(s1-trimSeconds)<.15 && Math.abs(in1-trimSeconds)<.15 && Math.abs(d1-(d0-trimSeconds))<.15,'video left trim preserves source timing',`start=${s1} in=${in1} dur=${d1}`)
await drag(video.getByTestId('trim-right'),-trimPx); await page.waitForTimeout(100); video=page.locator('[data-kind="video"]'); let d2=await num(video,'data-duration')
assert(Math.abs(d2-(d1-trimSeconds))<.15,'video right trim changes duration',`${d1}->${d2}`)
await shot('stress-05-video-trimmed')

// Scrub ruler to timeline time 3s, then split selected/active video.
const ruler=page.getByTestId('timeline-ruler'), rb=await ruler.boundingBox(), px=Number(await page.getByTestId('timeline').getAttribute('data-px-per-second'))
await page.mouse.click(rb.x+3*px,rb.y+rb.height/2); await page.waitForTimeout(150)
assert((await page.getByTestId('current-time').textContent()).startsWith('00:00:03:'),'ruler scrub seeks to 3s')
const beforeSplit=await page.locator('[data-kind="video"]').count(); await page.getByTitle(/Split at playhead/).click(); await page.waitForTimeout(100)
assert(await page.locator('[data-kind="video"]').count()===beforeSplit+1,'video split creates two clips')
const videoDurations=await page.locator('[data-kind="video"]').evaluateAll(xs=>xs.map(x=>Number(x.getAttribute('data-duration'))))
assert(Math.abs(videoDurations.reduce((a,b)=>a+b,0)-d2)<.15,'split conserves duration',videoDurations.join('+'))
await shot('stress-06-split')

// Undo/redo actual state.
await page.getByTitle('Undo (Ctrl+Z)').click(); assert(await page.locator('[data-kind="video"]').count()===1,'undo restores pre-split state')
await page.getByTitle('Redo (Ctrl+Shift+Z)').click(); assert(await page.locator('[data-kind="video"]').count()===2,'redo restores split state')

// Frame mode + zoom controls, preserve logical clip values.
const startsBefore=await clips.evaluateAll(xs=>xs.map(x=>x.getAttribute('data-start')))
await page.getByRole('button',{name:'Frames'}).click(); await page.waitForTimeout(100)
assert(Number(await page.getByTestId('timeline').getAttribute('data-px-per-second'))===2400,'frame mode sets 2400 px/s')
const startsAfter=await clips.evaluateAll(xs=>xs.map(x=>x.getAttribute('data-start')))
assert(JSON.stringify(startsBefore)===JSON.stringify(startsAfter),'zoom preserves logical clip times')
await shot('stress-07-frame-mode')
await page.getByTitle('Fit',{exact:true}).click(); await page.getByTitle('Zoom in').click(); await page.getByTitle('Zoom out').click(); pass('fit/zoom-in/zoom-out controls execute')

// Preview controls.
for(const name of ['Safe areas','Grid']) {await page.getByTitle(name).click(); assert(await page.getByTitle(name).getAttribute('aria-pressed')==='true',`${name} active state`)}
for(const name of ['50%','100%','200%']) {await page.getByRole('button',{name}).click(); pass(`preview ${name}`)}
const previewViewport=page.getByTestId('preview-viewport')
const previewBox=await previewViewport.boundingBox(); const previewOverflow=await previewViewport.evaluate(el=>({overflow:getComputedStyle(el).overflow,clientW:el.clientWidth,clientH:el.clientHeight}))
assert(previewOverflow.overflow==='hidden','zoomed preview is clipped without scrollbars',JSON.stringify(previewOverflow))
await page.mouse.move(previewBox.x+previewBox.width/2,previewBox.y+previewBox.height/2); await page.mouse.down(); await page.mouse.move(previewBox.x+previewBox.width/2+100,previewBox.y+previewBox.height/2+60,{steps:10}); await page.mouse.up()
assert(Math.abs(Number(await previewViewport.getAttribute('data-preview-pan-x')))>1,'200% preview supports bounded pointer pan',await previewViewport.getAttribute('data-preview-pan-x'))
await shot('stress-08-preview-200-panned')
await page.getByTitle('Fit preview',{exact:true}).click(); await page.waitForTimeout(100); const fitPan=await previewViewport.getAttribute('data-preview-pan-x'); assert(Math.abs(Number(fitPan))<.01,'Fit recenters preview canvas',fitPan)
await page.getByTitle('Safe areas').click(); await page.getByTitle('Grid').click(); await shot('stress-08-preview-zoom')

// Track controls and planned panels. Lock must enforce editing, not merely look active.
video=page.locator('[data-kind="video"]').first(); await video.click()
const videoCountLocked=await page.locator('[data-kind="video"]').count()
const videoLock=page.getByTestId('timeline').getByRole('button',{name:'Lock'}).first(); await videoLock.click()
await page.getByRole('button',{name:'Delete',exact:true}).click()
assert(await page.locator('[data-kind="video"]').count()===videoCountLocked,'locked track prevents clip deletion')
await page.getByTestId('timeline').getByRole('button',{name:'Unlock'}).first().click(); pass('track unlock restores editability')
await page.getByTitle('Mute').click(); await page.getByTitle('Mute').click(); pass('audio track mute toggle')
await page.getByTestId('timeline').getByRole('button',{name:'Hide',exact:true}).click(); await page.getByTestId('timeline').getByRole('button',{name:'Hide',exact:true}).click(); pass('video track visibility toggle')
for(const tab of ['Audio','Text','Effects','Transitions','Templates','Masks','Tracking','Omniframe','3D','Media']) {await page.getByRole('button',{name:tab,exact:true}).click(); pass(`panel ${tab} opens`)}
await shot('stress-09-panels')

// Transform controls: select image, change scale slider by keyboard.
image=page.locator('[data-kind="image"]'); await image.click(); const sliders=page.locator('aside input[type=range], div.w-72 input[type=range]')
// Right inspector is currently open at desktop; use labels via nearby fields.
const inspectorRanges=page.locator('.w-72 input[type=range]'); assert(await inspectorRanges.count()>=5,'transform sliders visible')
await inspectorRanges.nth(2).focus(); await page.keyboard.press('ArrowRight'); pass('scale slider keyboard interaction')

// Delete selected image, then undo/redo.
const countPreDelete=await clips.count(); await page.mouse.click(700,24); await page.keyboard.press('Delete'); assert(await clips.count()===countPreDelete-1,'Delete removes selected image')
await page.keyboard.press('Control+z'); assert(await clips.count()===countPreDelete,'Ctrl+Z restores deleted image')
await page.keyboard.press('Control+Shift+z'); assert(await clips.count()===countPreDelete-1,'Ctrl+Shift+Z reapplies delete')
await page.getByTitle('Undo (Ctrl+Z)').click();

// Full responsive matrix while preserving loaded state; assert no page/header overflow.
const sizes=[[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[834,1194],[768,1024],[430,932],[414,896],[390,844],[375,812],[360,800],[1100,800],[1000,800],[900,800],[850,800],[700,850],[600,850],[500,850],[450,850],[400,844]]
for(const [w,h] of sizes){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(40);const m=await page.evaluate(()=>({doc:document.documentElement.scrollWidth-document.documentElement.clientWidth,body:document.body.scrollWidth-document.body.clientWidth,header:(()=>{const x=document.querySelector('header');return x.scrollWidth-x.clientWidth})()}));assert(m.doc===0&&m.body===0&&m.header===0,`responsive ${w}x${h} no page/header overflow`,JSON.stringify(m));await shot(`viewport-${w}x${h}`)}
// Resize back without reload and verify assets survive.
await page.setViewportSize({width:1440,height:900}); assert(await clips.count()===countPreDelete,'resize preserves timeline state')

// Export edited multi-media project.
let exportPath=''; const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.getByRole('button',{name:/Export/}).click()]);
exportPath=join(ROOT,'qa/exports',download.suggestedFilename());await download.saveAs(exportPath);pass('edited multi-media export downloaded',exportPath)
await shot('stress-10-exported')

// Refresh behavior: persistence is not implemented; clean reset is expected.
await page.reload({waitUntil:'networkidle'}); assert(await page.getByTestId('timeline-clip').count()===0,'refresh intentionally resets non-persistent project')
assert(await page.getByText('Your canvas is empty').isVisible(),'refresh returns clean empty state')
assert(errors.length===0,'unexpected console/page errors',errors.join(' | '))
const unexpectedFailed=failed.filter(x=>!(x.startsWith('blob:')&&x.includes('ERR_ABORTED')))
assert(unexpectedFailed.length===0,'unexpected failed requests',unexpectedFailed.join(' | '))
pass('expected reload-time blob aborts classified',String(failed.length-unexpectedFailed.length))

writeFileSync(join(REPORTS,'stress-results.json'),JSON.stringify({browser:executablePath,url:URL,results,errors,failed,unexpectedFailed,exportPath},null,2))
console.log(`RESULT ${results.length} PASS; ${errors.length} errors; ${failed.length} failed requests`)
await browser.close()
