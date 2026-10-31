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
 await page.evaluate(async()=>{
  const bus=await import('/src/lib/audioBus.ts'),{encodeAudioBufferToWav}=await import('/src/lib/voiceIsolation.ts')
  const ac=new AudioContext({sampleRate:48000}),buffer=ac.createBuffer(2,48000*3,48000)
  for(let i=0;i<buffer.length;i++){const wave=Math.sin(2*Math.PI*440*i/48000);buffer.getChannelData(0)[i]=wave*.1;buffer.getChannelData(1)[i]=wave*.05}
  const audio=new Audio(URL.createObjectURL(encodeAudioBufferToWav(buffer)));audio.loop=true
  const button=document.createElement('button');button.id='qa-audio-play';button.textContent='Play calibration tone';button.style.cssText='position:fixed;top:0;left:0;z-index:999999;background:white;color:black'
  button.onclick=()=>{bus.attachAudioElements([audio]);void audio.play()};document.body.appendChild(button)
  window.__qaAudio=audio;window.__qaBus=bus;await ac.close()
 })
 await page.click('#qa-audio-play');await page.waitForTimeout(250)
 const before=await page.evaluate(()=>window.__qaBus.readAudioLevels())
 await page.evaluate(()=>window.__qaAudio.volume=.5);await page.waitForTimeout(180)
 const after=await page.evaluate(()=>window.__qaBus.readAudioLevels())
 assert.ok(Math.abs(before.leftDb+23.01)<.5,`actual left RMS dBFS: ${before.leftDb}`)
 assert.ok(Math.abs(before.rightDb+29.03)<.5,`actual right RMS dBFS: ${before.rightDb}`)
 assert.ok(Math.abs(before.leftPeakDb+20)<.2)
 assert.ok(Math.abs((after.leftDb-before.leftDb)+6.02)<.5,'half volume gives -6.02dB')
 fs.mkdirSync(path.join(root,'qa-output/audio'),{recursive:true});fs.writeFileSync(path.join(root,'qa-output/audio/meter-report.json'),JSON.stringify({before,after},null,2))
 console.log('PASS real stereo RMS/peak metering and element-volume tracking',before,after)
}finally{await browser.close()}
