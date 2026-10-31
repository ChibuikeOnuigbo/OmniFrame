/** Exhaustive shared-kernel coverage, distinct from full compositor MP4 acceptance. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { recipeFromEffect, renderGlitchRGBA } from '../src/lib/glitchNG.ts'
import { createCanvas } from '@napi-rs/canvas'
const entries=JSON.parse(fs.readFileSync('public/effects/glitch-recipes.json','utf8'))
assert.equal(entries.length,5000)
const w=96,h=54,src=new Uint8ClampedArray(w*h*4)
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;src[i]=x*2;src[i+1]=y*4;src[i+2]=(x^y)*2;src[i+3]=(x+y)%9===0?128:255}
const results=[],hashes=new Map(),sheet=createCanvas(960,540),ctx=sheet.getContext('2d')
for(const [index,e] of entries.entries()){
  const r=recipeFromEffect(e.patch),tl=r.timeline
  const times=[tl.lead+tl.attack*.5,tl.lead+tl.attack+tl.hold*.5,tl.lead+tl.attack+tl.hold+tl.decay*.5]
  const frames=times.map(t=>renderGlitchRGBA(src,w,h,t,r,{fps:30}))
  assert.deepEqual(frames[1],renderGlitchRGBA(src,w,h,times[1],r,{fps:30}),`${e.id} deterministic`)
  for(const frame of frames)for(let i=3;i<frame.length;i+=4)assert.equal(frame[i],src[i],`${e.id} alpha`)
  assert.deepEqual(renderGlitchRGBA(src,w,h,times[1],recipeFromEffect({...e.patch,ngIntensity:0})),src,`${e.id} bypass`)
  const hash=crypto.createHash('sha256');for(const f of frames)hash.update(f)
  const key=hash.digest('hex'),duplicateOf=hashes.get(key)??null
  if(!duplicateOf)hashes.set(key,e.id)
  results.push({id:e.id,family:r.family,times,sha256:key,duplicateOf})
  if(index%50===0){const c=createCanvas(w,h),x=c.getContext('2d'),im=x.createImageData(w,h);im.data.set(frames[1]);x.putImageData(im,0,0);ctx.drawImage(c,index/50%10*w,Math.floor(index/500)*h)}
}
fs.mkdirSync('qa-output/glitch-v2',{recursive:true});fs.mkdirSync('qa-output/screenshots',{recursive:true})
fs.writeFileSync('qa-output/screenshots/glitch-pack-contact-sheet.png',sheet.toBuffer('image/png'))
fs.writeFileSync('qa-output/glitch-v2/coverage.json',JSON.stringify({kind:'shared-kernel diagnostic; not full MP4 or in-app visual acceptance',count:entries.length,uniqueThreeFrameHashes:hashes.size,resolution:[w,h],fps:30,results},null,2))
console.log(`PASS ${entries.length} authored recipes: determinism, alpha and zero-intensity bypass; ${hashes.size} unique three-frame diagnostic hashes`)
