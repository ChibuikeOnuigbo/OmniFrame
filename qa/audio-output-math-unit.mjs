import assert from 'node:assert/strict'
import { normalizeIsolationPCM, enforceAudioPeak, denoiseExponent } from '../src/lib/audioOutputMath.ts'
for (const sr of [8000, 16000, 44100, 48000, 96000]) {
  const ch = Float32Array.from({length:sr}, (_,i) => .2 + .03 * Math.sin(2*Math.PI*440*i/sr))
  normalizeIsolationPCM([ch],sr)
  const tail = ch.subarray(sr/2)
  const mean = tail.reduce((a,b)=>a+b,0)/tail.length
  assert.ok(Math.abs(mean) < .0005, `DC rejected at ${sr}Hz: ${mean}`)
  assert.ok(ch.every(Number.isFinite))
  assert.ok(ch.every(v=>Math.abs(v)<=.980001))
}
const left = new Float32Array([2, -.8, NaN]), right = new Float32Array([1,-.4,Infinity])
enforceAudioPeak([left,right]);assert.ok(Math.abs(left[0]-.98)<1e-6);assert.equal(left[0],2*right[0]);assert.equal(left[2],0);assert.equal(right[2],0)
const quiet=new Float32Array(48000).fill(.00001);normalizeIsolationPCM([quiet],48000);assert.ok(Math.max(...quiet)<.000011)
const mask=.15
assert.equal(denoiseExponent(0),0)
for (let s=0;s<1;s+=.1) assert.ok(mask**denoiseExponent(s) > mask**denoiseExponent(s+.1),'strength increases suppression')
assert.throws(()=>normalizeIsolationPCM([left],0))
console.log('PASS audio PCM: 5 sample rates, DC rejection, finite samples, stereo ratio, peak protection, silence and monotonic denoise strength')
