import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT=process.cwd(), URL=process.env.URL||'http://localhost:5173/'
const SHOTS=join(ROOT,'qa/screenshots'), REPORTS=join(ROOT,'qa/reports'); mkdirSync(SHOTS,{recursive:true});mkdirSync(REPORTS,{recursive:true})
await inflate(join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH=`${join(tmpdir(),'al2023/lib')}:${tmpdir()}`
const browser=await pwChromium.launch({executablePath:await serverlessChromium.executablePath(),args:['--no-sandbox','--use-gl=swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[],failed=[]
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(`${r.url()} :: ${r.failure()?.errorText}`))
const pass=(name,detail='')=>{results.push({name,status:'PASS',detail});console.log('PASS',name,detail)},assert=(v,n,d='')=>{if(!v)throw Error(`${n}: ${d}`);pass(n,d)}
await page.goto(URL,{waitUntil:'networkidle'});assert(await page.getByTestId('landing-page').isVisible(),'landing page opens by default');assert(await page.getByRole('heading',{name:/Edit video/}).isVisible(),'concise hero visible');assert(await page.getByRole('button',{name:'Open Studio'}).isVisible(),'single studio CTA visible');assert(await page.getByRole('link',{name:/Open source/}).getAttribute('href')==='https://github.com/ChibuikeOnuigbo/OmniFrame','open-source link is real')
await page.screenshot({path:join(SHOTS,'landing-1440x900.png')})
for(const [w,h] of [[1920,1080],[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,800]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(80);const m=await page.evaluate(()=>({doc:document.documentElement.scrollWidth-document.documentElement.clientWidth,body:document.body.scrollWidth-document.body.clientWidth}));assert(m.doc===0&&m.body===0,`landing ${w}x${h} has no horizontal overflow`,JSON.stringify(m))}
await page.screenshot({path:join(SHOTS,'landing-360x800.png')})
await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Open Studio'}).click();await page.waitForTimeout(180);assert(await page.locator('.of-studio-wipe').isVisible(),'studio transition animation plays');await page.screenshot({path:join(SHOTS,'landing-transition.png')});await page.getByText('Your canvas is empty').waitFor({state:'visible',timeout:2000});assert(page.url().endsWith('/#studio'),'studio route updates hash',page.url());assert(await page.getByTestId('timeline').isVisible(),'studio mounts after transition')
await page.goBack();await page.getByTestId('landing-page').waitFor({state:'visible'});assert(await page.getByTestId('landing-page').isVisible(),'browser back returns to landing')
assert(errors.length===0,'landing has zero runtime errors',errors.join(' | '));assert(failed.length===0,'landing has zero failed requests',failed.join(' | '));writeFileSync(join(REPORTS,'landing-results.json'),JSON.stringify({results,errors,failed},null,2));console.log(`RESULT ${results.length} PASS`);await browser.close()
