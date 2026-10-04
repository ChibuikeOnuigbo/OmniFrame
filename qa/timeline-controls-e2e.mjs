import { chromium as pwChromium } from 'playwright'
import serverlessChromium,{inflate} from '@sparticuz/chromium'
import {tmpdir} from 'node:os';import{join}from'node:path';import{mkdirSync,writeFileSync}from'node:fs'
const ROOT=process.cwd(),URL=process.env.URL||'http://localhost:5173/#studio',REPORTS=join(ROOT,'qa/reports');mkdirSync(REPORTS,{recursive:true});await inflate(join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH=`${join(tmpdir(),'al2023/lib')}:${tmpdir()}`
const browser=await pwChromium.launch({executablePath:await serverlessChromium.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:760}}),results=[],errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));const ok=(v,n,d='')=>{if(!v)throw Error(`${n}: ${d}`);results.push({n,d});console.log('PASS',n,d)}
await page.goto(URL,{waitUntil:'networkidle'})
// I-10: media import only adds to the project library and loads the Source
// Monitor; it places no clip. Add the imported asset explicitly, and open the
// left dock first so its add button is not clipped.
await page.evaluate(()=>window.__omniframe_store.getState().setLeftOpen(true))
await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT,'qa/fixtures/pexels-cinematic-8s.webm'))
await page.getByRole('button',{name:/Add .*pexels-cinematic-8s\.webm.* to timeline/}).click({force:true})
const clip=page.getByTestId('timeline-clip').first();await clip.waitFor()
await page.getByTestId('tool-menu-button').click();const tools=page.getByTestId('tool-menu');ok(await tools.getByRole('menuitemradio').count()===2,'one compact tool menu exposes select and blade');// The app hides the native cursor and draws its own, so elements compute to
// cursor:none. The blade pointer is the custom cursor's own state, which it
// publishes on custom-cursor-container, and it resolves on pointer move.
await tools.getByRole('menuitemradio',{name:/Blade/}).click()
const cursorEl=page.getByTestId('custom-cursor-container'), cbox=await clip.boundingBox()
await page.mouse.move(cbox.x+cbox.width/2,cbox.y+cbox.height/2); await page.waitForTimeout(150)
const bladeCursor=await cursorEl.getAttribute('data-cursor-state');ok(bladeCursor==='blade','blade tool uses custom blade cursor',String(bladeCursor))
await page.keyboard.press('v'); await page.mouse.move(cbox.x+cbox.width/2+1,cbox.y+cbox.height/2); await page.waitForTimeout(150)
ok((await cursorEl.getAttribute('data-cursor-state'))!=='blade','select tool restores selection cursor',String(await cursorEl.getAttribute('data-cursor-state')))
const snap=page.getByTestId('snapping-toggle');ok(await snap.getAttribute('aria-pressed')==='true','snapping starts enabled');await snap.click();ok(await snap.getAttribute('aria-pressed')==='false','snapping can be disabled');await snap.click();ok(await snap.getAttribute('aria-pressed')==='true','snapping can be re-enabled');await page.getByTestId('timeline-scale').fill('40');await clip.click();await page.keyboard.press('Control+d');const moved=page.getByTestId('timeline-clip').last()
// A pointer move only becomes a drag past 5px, and snapping grabs anything
// within 8px, so the nudge has to sit between the two: 7px is a real drag
// that snapping can still pull back to the neighbouring edge at 8s. The old
// 3px/4px nudges never left click mode, so both checks passed vacuously.
// At this viewport the clip runs under the right inspector, so grabbing its
// midpoint lands on the inspector, not the clip. Grab near its left edge and
// confirm the point really resolves to the clip before dragging.
const nudge=async(dx)=>{
  const b=await moved.boundingBox()
  const gx=b.x+b.width*0.12, gy=b.y+b.height/2
  const onClip=await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('[data-testid=timeline-clip]'))},[gx,gy])
  ok(onClip,`grab point is on the clip (x=${Math.round(gx)})`)
  await page.mouse.move(gx,gy);await page.mouse.down();await page.mouse.move(gx+dx,gy,{steps:6});await page.mouse.up();await page.waitForTimeout(250)
}
await nudge(7);ok(Math.abs(Number(await moved.getAttribute('data-start'))-8)<.01,'enabled snapping attracts clip to neighboring edge',await moved.getAttribute('data-start'))
await snap.click();ok(await snap.getAttribute('aria-pressed')==='false','snapping disabled for the unsnapped check')
await nudge(7);ok(Number(await moved.getAttribute('data-start'))>8.05,'disabled snapping preserves unsnapped movement',await moved.getAttribute('data-start'))
await page.getByTestId('speed-menu-button').click();const speed=page.getByTestId('speed-menu');await speed.getByRole('button',{name:'0.5×'}).click();ok((await page.getByTestId('speed-menu-button').textContent()).includes('0.50×'),'compact speed menu applies 0.5x');await speed.getByLabel('Custom playback speed').fill('1.35');ok((await page.getByTestId('speed-menu-button').textContent()).includes('1.35×'),'custom speed applies within safe range')
await page.getByTitle('Play (Space)').click();const ruler=page.getByTestId('timeline-ruler'),box=await ruler.boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+12);await page.mouse.down();for(const x of [.35,.5,.65])await page.mouse.move(box.x+box.width*x,box.y+12,{steps:3});ok(await page.getByTitle('Pause (Space)').count()===1,'playback remains active while playhead is dragged');await page.mouse.up();await page.waitForTimeout(80);ok(await page.getByTitle('Pause (Space)').count()===1,'playback resumes continuously after scrub release')
ok(errors.length===0,'zero runtime errors',errors.join(' | '));writeFileSync(join(REPORTS,'timeline-controls-results.json'),JSON.stringify({results,errors},null,2));console.log(`RESULT ${results.length} PASS`);await browser.close()
