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
  const {denoiseAudioBuffer}=await import('/src/lib/aiDenoise.ts')
  const {finalizeIsolationOutput,encodeAudioBufferToWav,processVoiceIsolation}=await import('/src/lib/voiceIsolation.ts')
  const ac=new AudioContext({sampleRate:48000})
  try{
   const response=await fetch('/qa/assets/voice/tts-f1-technical.mp3'),decoded=await ac.decodeAudioData(await response.arrayBuffer())
   const n=Math.min(48000*4,decoded.length),clean=new Float32Array(decoded.getChannelData(0).subarray(0,n))
   let energy=0;for(const v of clean)energy+=v*v
   const rms=Math.sqrt(energy/n),mixed=ac.createBuffer(1,n,48000),samples=mixed.getChannelData(0)
   let seed=42
   for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=clean[i]+((seed/4294967296)*2-1)*Math.sqrt(3)*rms}
   const gentle=await denoiseAudioBuffer(mixed,.25),strong=await denoiseAudioBuffer(mixed,.92)
   const snr=(estimate)=>{let dot=0,rr=0;for(let i=0;i<n;i++){dot+=estimate[i]*clean[i];rr+=clean[i]*clean[i]}const a=dot/Math.max(1e-12,rr);let signal=0,noise=0;for(let i=0;i<n;i++){signal+=(a*clean[i])**2;noise+=(estimate[i]-a*clean[i])**2}return 10*Math.log10(signal/Math.max(1e-12,noise))}
   const inputSnr=snr(samples),outputSnr=snr(strong.samples)
   const norm=ac.createBuffer(1,strong.samples.length,48000);norm.copyToChannel(strong.samples,0);finalizeIsolationOutput(norm)
   const dryUrl=URL.createObjectURL(encodeAudioBufferToWav(mixed)),dry=await processVoiceIsolation(dryUrl,{mode:'keep_vocal',model:'rnnoise-xiph',strength:0})
   // processVoiceIsolation decodes at the browser's default device rate.
   // Compare like-for-like decoded PCM rather than comparing indices across
   // 44.1/48 kHz time bases (which tests resampling twice, not bypass).
   const referenceCtx=new AudioContext()
   const reference=await referenceCtx.decodeAudioData(await (await fetch(dryUrl)).arrayBuffer())
   const dryBuffer=await referenceCtx.decodeAudioData(await dry.blob.arrayBuffer()),data=dryBuffer.getChannelData(0),referenceSamples=reference.getChannelData(0)
   let dryError=0;for(let i=0;i<data.length;i++)dryError=Math.max(dryError,Math.abs(data[i]-referenceSamples[i]))
   if(data.length!==referenceSamples.length)throw Error('Bypass changed decoded duration')
   await referenceCtx.close()
   const energyOf=a=>a.reduce((sum,v)=>sum+v*v,0)
   const wav=encodeAudioBufferToWav(norm),bytes=new Uint8Array(await wav.arrayBuffer())
   let peak=0;for(const v of norm.getChannelData(0))peak=Math.max(peak,Math.abs(v))
   URL.revokeObjectURL(dryUrl);URL.revokeObjectURL(dry.url)
   return {source:'repo tts-f1-technical.mp3 + deterministic 0dB white noise; fixture coverage, not a general speech-quality benchmark',sampleRate:48000,inputSnr,outputSnr,improvementDb:outputSnr-inputSnr,gentleEnergy:energyOf(gentle.samples),strongEnergy:energyOf(strong.samples),peak,dryError,wav: Array.from(bytes)}
  }finally{await ac.close()}
 })
 assert.ok(result.improvementDb>0,`Denoising should improve fixture SI-SNR: ${result.improvementDb}dB`)
 assert.ok(result.strongEnergy<result.gentleEnergy,'Increasing strength should increase attenuation')
 assert.ok(result.peak<=.980001)
 assert.ok(result.dryError<.0001,'Zero strength should bypass the model and preserve dry PCM within WAV quantization')
 fs.mkdirSync(path.join(root,'qa-output/audio'),{recursive:true})
 fs.writeFileSync(path.join(root,'qa-output/audio/denoised-fixture.wav'),Buffer.from(result.wav));delete result.wav
 fs.writeFileSync(path.join(root,'qa-output/audio/strength-report.json'),JSON.stringify(result,null,2))
 console.log('PASS real ONNX denoise, monotonic strength, 48kHz finalization, dry bypass',result)
}finally{await browser.close()}
