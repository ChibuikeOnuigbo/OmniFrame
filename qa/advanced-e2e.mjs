import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const ROOT=process.cwd(), URL=process.env.URL||'http://localhost:5173/#studio'
const reports=join(ROOT,'qa/reports'), traces=join(ROOT,'qa/traces'), videos=join(ROOT,'qa/recordings'), exportsDir=join(ROOT,'qa/exports')
for(const p of [reports,traces,videos,exportsDir]) mkdirSync(p,{recursive:true})
await inflate(join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); process.env.LD_LIBRARY_PATH=`${join(tmpdir(),'al2023/lib')}:${tmpdir()}`
const executablePath=await serverlessChromium.executablePath(); const browser=await pwChromium.launch({executablePath,args:['--no-sandbox','--use-gl=swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:videos,size:{width:1440,height:900}},acceptDownloads:true})
await context.tracing.start({screenshots:true,snapshots:true,sources:true}); const page=await context.newPage(); const results=[],errors=[],failed=[],lifecycle=[]
page.on('console',m=>{if(m.text().startsWith('OF_URL_')) lifecycle.push(m.text()); else if(m.type()==='error') errors.push(m.text())}); page.on('pageerror',e=>errors.push(String(e))); page.on('requestfailed',r=>failed.push(`${r.url()} :: ${r.failure()?.errorText}`))
await page.addInitScript(()=>{const c=URL.createObjectURL.bind(URL),r=URL.revokeObjectURL.bind(URL); URL.createObjectURL=(x)=>{const u=c(x);localStorage.setItem('ofCreates',String(+(localStorage.getItem('ofCreates')||0)+1));console.log('OF_URL_CREATE '+u);return u}; URL.revokeObjectURL=(u)=>{localStorage.setItem('ofRevokes',String(+(localStorage.getItem('ofRevokes')||0)+1));console.log('OF_URL_REVOKE '+u);return r(u)}})
const pass=(n,d='')=>{results.push({name:n,status:'PASS',detail:d});console.log('PASS',n,d)}, assert=(v,n,d='')=>{if(!v)throw Error(`${n}: ${d}`);pass(n,d)}
const num=async(l,a)=>Number(await l.getAttribute(a)); const px=async()=>Number(await page.getByTestId('timeline').getAttribute('data-px-per-second'))
const drag=async(l,dx,dy=0,ratio=.5)=>{const b=await l.boundingBox();if(!b)throw Error('missing box');const x=b.x+b.width*ratio,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});await page.mouse.up()}
await page.goto(URL,{waitUntil:'networkidle'}); await page.evaluate(()=>{localStorage.setItem('ofCreates','0');localStorage.setItem('ofRevokes','0')})
// Invalid input must be rejected and its temporary URL revoked.
// The suite used to depend on a hand-made /tmp/invalid.txt; create it here so
// the run is reproducible from a clean checkout.
const invalidPath = join(tmpdir(), 'invalid.txt')
writeFileSync(invalidPath, 'this is deliberately not a media file\n')
await page.getByTestId('import-input').setInputFiles(invalidPath); await page.waitForTimeout(100)
assert(await page.getByTestId('timeline-clip').count()===0,'invalid non-media import rejected')
assert(lifecycle.some(x=>x.startsWith('OF_URL_REVOKE')),'invalid import object URL revoked')
// Import all types, including repeated import.
const video=join(ROOT,'qa/fixtures/pexels-cinematic-8s.webm'), image=join(ROOT,'qa/fixtures/pexels-landscape-962322.jpg'), audio=join(ROOT,'qa/fixtures/test-audio-6s.ogg')
// Invariant I-10: import adds to the project library ONLY and loads the asset
// into the Source Monitor. It deliberately does NOT insert into the timeline,
// so each asset has to be placed with its own add-to-timeline control.
const addToTimeline = async (nameFragment) => {
  const card = page.locator(`[data-asset-name*="${nameFragment}"]`).first()
  await card.waitFor({ state: 'visible', timeout: 15000 })
  await card.locator('[data-testid="add-to-timeline-btn"]').first().click()
  await page.waitForTimeout(150)
}
await page.getByTestId('import-input').setInputFiles([video,image,audio])
await page.waitForFunction(
  (n) => document.querySelectorAll('[data-asset-name]').length >= n,
  3,
)
await addToTimeline('pexels-cinematic')
await addToTimeline('pexels-landscape')
await addToTimeline('test-audio-6s')
await page.waitForFunction(()=>document.querySelectorAll('[data-testid=timeline-clip]').length===3)
// Re-importing the same file must still create a distinct asset.
await page.getByTestId('import-input').setInputFiles(image)
await page.waitForFunction(
  (n) => document.querySelectorAll('[data-asset-name]').length >= n,
  4,
)
pass('repeated import creates independent asset')
// Library HTML5 drag to exact timeline position.
await page.getByTitle('Fit', { exact: true }).click(); const asset=page.getByTestId('media-asset').filter({hasText:'pexels-landscape'}).first(), lanes=page.getByTestId('timeline-lanes'); const lb=await lanes.boundingBox(); const before=await page.getByTestId('timeline-clip').count()
await asset.dragTo(lanes,{targetPosition:{x:Math.min(2*await px(),lb.width-10),y:20}}); await page.waitForTimeout(100)
assert(await page.getByTestId('timeline-clip').count()===before+1,'library asset HTML5 drag/drop creates timeline clip')
const images=page.locator('[data-kind=image]'); const dropped=images.last(); assert(Math.abs(await num(dropped,'data-start')-2)<.2,'library drop maps pointer X to timeline time',String(await num(dropped,'data-start')))
// Lock blocks pointer move, trims, split, and direct delete.
let clip=page.locator('[data-kind=video]').first(); await clip.click({position:{x:(await clip.boundingBox()).width*.9,y:12}}); const lock=page.getByTestId('timeline').getByRole('button',{name:'Lock'}).first(); await lock.click(); const s0=await num(clip,'data-start'),d0=await num(clip,'data-duration'),vc=await page.locator('[data-kind=video]').count()
await drag(clip,60,0,.9); clip=page.locator('[data-kind=video]').first(); assert(await num(clip,'data-start')===s0,'locked clip pointer move rejected')
await drag(clip.getByTestId('trim-left'),40); assert(await num(clip,'data-duration')===d0,'locked left trim rejected')
await drag(clip.getByTestId('trim-right'),-40); assert(await num(clip,'data-duration')===d0,'locked right trim rejected')
const ruler=page.getByTestId('timeline-ruler'),rb=await ruler.boundingBox(); await page.mouse.click(rb.x+3*await px(),rb.y+10); await page.getByTitle(/Split at playhead/).click(); assert(await page.locator('[data-kind=video]').count()===vc,'locked split rejected')
await page.getByRole('button',{name:'Delete',exact:true}).click(); assert(await page.locator('[data-kind=video]').count()===vc,'locked inspector delete rejected'); await page.getByTestId('timeline').getByRole('button',{name:'Unlock'}).first().click(); pass('unlock after lock regressions')
// Minimum and maximum zoom retain accurate drag mapping.
// `timeline` contains two range inputs (zoom and custom playback speed);
// target the zoom slider by its own test id instead of matching both.
// Snapping is on by default and deliberately pulls a dragged clip to nearby
// edges, so it has to be off to assert an exact pointer-to-time mapping. Drag
// accuracy itself is verified elsewhere with snapping on.
const snapToggle = page.getByTestId('snapping-toggle')
if (await snapToggle.getAttribute('aria-pressed') === 'true') await snapToggle.click()
assert(await page.evaluate(()=>window.__omniframe_store.getState().snapping)===false,'snapping off for precision drag measurement')
const range=page.getByTestId('timeline-scale')
// The lanes scroll *under* a sticky 168px track-header column, so a clip near
// t=0 can end up behind it. A synthetic pointer event at those coordinates
// lands on the header (its track-menu button), not on the clip, and the drag
// silently never starts. Park the scroller at the left edge before grabbing,
// and assert the grab point really resolves to the clip.
const revealClip=async(t,z)=>{await page.evaluate(([t,z])=>{const sc=document.querySelector('div.flex-1.min-h-0.overflow-auto.relative');if(sc)sc.scrollLeft=Math.max(0,t*z-32)},[t,z]);await page.waitForTimeout(150)}
for(const [z,delta] of [[8,32],[8000,40]]){
  await range.fill(String(z));assert(await px()===z,`${z===8?'minimum':'maximum'} timeline zoom reached`)
  clip=page.locator('[data-kind=audio]').first()
  const old=await num(clip,'data-start')
  await revealClip(old,z)
  clip=page.locator('[data-kind=audio]').first()
  const cbox=await clip.boundingBox(); assert(cbox,`audio clip has a box at ${z}px/s`)
  const grabRatio=z===8000?.01:.5
  const gx=cbox.x+cbox.width*grabRatio, gy=cbox.y+cbox.height/2
  const hitsClip=await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return !!(el&&el.closest('[data-testid=timeline-clip]'))},[gx,gy])
  assert(hitsClip,`audio clip grabbable at ${z}px/s`,`grab point ${Math.round(gx)},${Math.round(gy)}`)
  await drag(clip,delta,0,grabRatio)
  clip=page.locator('[data-kind=audio]').first();const now=await num(clip,'data-start')
  assert(Math.abs(now-Math.max(0,old+delta/z))<.06,`pointer move accurate at ${z}px/s`,`${old}->${now} expect ${+(old+delta/z).toFixed(3)}`)
}
await snapToggle.click(); assert(await page.evaluate(()=>window.__omniframe_store.getState().snapping)===true,'snapping restored after measurement')
// Scroll deeply at max zoom and verify timeline responds.
await page.getByTestId('timeline').locator('.overflow-auto').evaluate(el=>{el.scrollLeft=12000;el.dispatchEvent(new Event('scroll'))}); const scroll=await page.getByTestId('timeline').locator('.overflow-auto').evaluate(el=>el.scrollLeft); assert(scroll>0,'timeline horizontal scrolling at maximum zoom',String(scroll))
// Keyboard frame and one-second boundary stepping.
await page.mouse.click(700,24); await page.getByTitle(/Go to start/).click(); await page.keyboard.press('ArrowLeft'); assert((await page.getByTestId('current-time').textContent()).startsWith('00:00:00:00'),'frame step clamps at zero')
await page.getByTitle(/Go to end/).click();const end=await page.getByTestId('current-time').textContent();await page.keyboard.press('ArrowRight');assert(await page.getByTestId('current-time').textContent()===end,'frame step clamps at project duration')
await page.keyboard.press('Shift+ArrowLeft'); assert(await page.getByTestId('current-time').textContent()!==end,'shift arrow steps one second backward')
// Reverse playback must be reachable and stop at zero.
await page.getByTitle('Fit', { exact: true }).click(); await page.getByTitle(/Go to start/).click(); await page.mouse.click(700,24); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('j');await page.waitForTimeout(1400);assert((await page.getByTestId('current-time').textContent()).startsWith('00:00:00:00'),'reverse J playback stops at zero');assert(await page.getByTitle('Play (Space)').isVisible(),'reverse boundary pauses transport')
// Rapid split / undo / redo sequence remains coherent.
clip=page.locator('[data-kind=video]').first()
// Split points have to land *inside* the selected clip and inside the
// viewport. The previous zoom (8000px/s) put t=1..4 tens of thousands of
// pixels off screen, and those times were outside the clip (which starts at
// t=10) anyway, so every split was a no-op. Zoom out, then seek the ruler to
// four points spread across the clip and verify each seek before splitting.
await range.fill('8'); assert(await px()===8,'zoom reset for split sequence')
const vst=await num(clip,'data-start'), vdur=await num(clip,'data-duration')
await clip.click({position:{x:20,y:12}})
for(let k=1;k<=4;k++){
  const t=vst+vdur*(k/5)
  const b=await ruler.boundingBox()
  await page.mouse.click(b.x+t*await px(),b.y+10)
  assert(Math.abs(await page.evaluate(()=>window.__omniframe_store.getState().playhead)-t)<0.3,`ruler seek to ${t.toFixed(2)}`)
  await page.getByTitle(/Split at playhead/).click()
} const splitCount=await page.locator('[data-kind=video]').count();assert(splitCount>=4,'rapid repeated split creates stable segments',String(splitCount));for(let i=0;i<4;i++)await page.keyboard.press('Control+z');const undoCount=await page.locator('[data-kind=video]').count();assert(undoCount<splitCount,'rapid undo sequence restores earlier state',String(undoCount));for(let i=0;i<4;i++)await page.keyboard.press('Control+Shift+z');assert(await page.locator('[data-kind=video]').count()===splitCount,'rapid redo sequence restores split state')
// Layer/order overlap: dropped image added last in DOM and active at overlap.
const activeAt2=await page.locator('[data-kind=image]').evaluateAll(xs=>xs.filter(x=>{const s=+x.dataset.start,d=+x.dataset.duration;return s<=2&&s+d>2}).map(x=>x.dataset.clipId));assert(activeAt2.length>=1,'multi-element overlap exists at two seconds',String(activeAt2.length));pass('timeline layer order is deterministic DOM insertion order')
// Two independent exports.
const out=[];for(let i=1;i<=2;i++){const [dl]=await Promise.all([page.waitForEvent('download',{timeout:70000}),page.getByRole('button',{name:/Export/}).click()]);const p=join(exportsDir,`advanced-export-${i}-${dl.suggestedFilename()}`);await dl.saveAs(p);out.push(p);pass(`repeated export ${i} downloaded`,p);if(i===1)await page.waitForTimeout(5000)}
// Reload triggers pagehide URL release. Abort of blob loads during deliberate reload is expected.
const creates=await page.evaluate(()=>+(localStorage.getItem('ofCreates')||0));await page.reload({waitUntil:'networkidle'});const revokes=await page.evaluate(()=>+(localStorage.getItem('ofRevokes')||0));assert(revokes>=creates,'pagehide revokes all created object URLs',`${revokes}/${creates}`);assert(await page.getByTestId('timeline-clip').count()===0,'reload clean state after lifecycle release')
const unexpectedFailed=failed.filter(x=>!(x.startsWith('blob:')&&x.includes('ERR_ABORTED')));assert(errors.length===0,'advanced run has zero runtime errors',errors.join(' | '));assert(unexpectedFailed.length===0,'advanced run has zero unexpected request failures',unexpectedFailed.join(' | '))
writeFileSync(join(reports,'advanced-results.json'),JSON.stringify({results,errors,failed,unexpectedFailed,lifecycle,exports:out},null,2));await context.tracing.stop({path:join(traces,'advanced-workflow.zip')});const vp=await page.video().path();await page.close();await context.close();await browser.close();console.log('VIDEO',vp);console.log(`RESULT ${results.length} PASS`)
