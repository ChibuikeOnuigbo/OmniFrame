// User-supplied third-party mirror study. No external requests or app assets bundled.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {chromium} from 'playwright'
import chrome,{inflate} from '@sparticuz/chromium'
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'research/new_study_vdieos/brandbird-responsive')
fs.mkdirSync(dir,{recursive:true})
await inflate(path.join(root,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH=`${path.join(os.tmpdir(),'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH||''}`
const browser=await chromium.launch({executablePath:await chrome.executablePath(),args:['--no-sandbox']})
const page=await browser.newPage(),blocked=new Set(),errors=[]
page.on('pageerror',e=>errors.push(String(e)))
await page.route('**/*',route=>{
 const u=new URL(route.request().url())
 if(u.hostname==='127.0.0.1'||u.hostname==='localhost'||u.protocol==='data:'||u.protocol==='blob:')return route.continue()
 blocked.add(u.origin+u.pathname);return route.abort()
})
try{
 const results=[]
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900})
  await page.goto(process.env.BRANDBIRD_URL||'http://127.0.0.1:5180/',{waitUntil:'networkidle'})
  const welcome=page.getByText("I'll explore on my own.",{exact:true})
  let onboardingDismissed=false
  if(await welcome.isVisible()){await welcome.click();await welcome.waitFor({state:'hidden'});onboardingDismissed=true}
  const input=page.locator('input[type="file"]').first()
  let imageLoaded=false
  if(await input.count()){
   await input.setInputFiles(path.join(root,'evidence_video/transforms/perspective.png'))
   await page.waitForTimeout(500)
   imageLoaded=await page.evaluate(()=>[...document.querySelectorAll('img')].some(e=>/^(blob:|data:image)/.test(e.src)&&e.naturalWidth>0))
  }
  let backgroundClicked=false
  const backgrounds=page.getByText('Background',{exact:true})
  for(let i=0;i<await backgrounds.count();i++){
   const background=backgrounds.nth(i)
   if(await background.isVisible()){
    await background.scrollIntoViewIfNeeded();await background.click();backgroundClicked=true;break
   }
  }
  const state=await page.evaluate(()=>({title:document.title,bodyWidth:document.body.scrollWidth,viewport:innerWidth,buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({text:e.innerText,aria:e.getAttribute('aria-label')})),canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height,cssWidth:e.getBoundingClientRect().width})),bodyText:document.body.innerText.slice(0,3500)}))
  await page.screenshot({path:path.join(dir,`viewport-${width}.png`)})
  results.push({width,onboardingDismissed,imageLoaded,backgroundClicked,...state})
 }
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({source:'User-supplied BrandBird RAR; offline local study',results,errors,blockedExternalRequests:[...blocked],scope:'Three viewport sizes, real onboarding dismissal/image-input/background clicks. Missing offline/external assets and service-worker errors are preserved; no account, network editing or export acceptance claimed.'},null,2))
 console.log(JSON.stringify({viewports:results.map(r=>r.width),errors,visibleButtonCounts:results.map(r=>r.buttons.length)}))
}finally{await browser.close()}
