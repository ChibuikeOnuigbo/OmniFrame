import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { SESSION, registry } from '../tools/mcp/tools.mjs'
import { makeClip, renderFrame, loadAppTs } from '../tools/mcp/appRender.mjs'
const { trimFxInstances } = await loadAppTs('src/lib/fxInstances.ts')
const image=await loadImage('public/assets/effect-subjects/pexels-car.jpg')
assert.ok((await registry.call('project_new',{w:320,h:180,fps:12,duration:10})).ok)
const clip=makeClip({id:'car',name:'Car',natW:320,natH:180,start:0,duration:10,draw:(x,w,h)=>x.drawImage(image,0,0,w,h)})
clip.fxInstances=[{id:'fx',name:'Hold',catalogId:'essential-color-hold',enabled:true,inP:1,duration:8,params:{colorHold:0,holdColor:'#ff0000'},keys:{colorHold:[{t:0,v:0},{t:4,v:1},{t:8,v:0}]}}]
SESSION.seq.addClip(clip)
const originals=[3,4,5,6].map(t=>renderFrame(SESSION.seq,t).toBuffer('image/png'))
clip.fxInstances=trimFxInstances(clip.fxInstances,3,4);clip.start=3;clip.duration=4
const sheet=createCanvas(640,720),ctx=sheet.getContext('2d')
for(const [i,t]of [3,4,5,6].entries()){
 const rendered=renderFrame(SESSION.seq,t),buf=rendered.toBuffer('image/png')
 assert.deepEqual(buf,originals[i],`headless trim continuity at ${t}s`)
 ctx.drawImage(await loadImage(originals[i]),0,i*180);ctx.drawImage(rendered,320,i*180)
}
fs.mkdirSync('qa-output/fx-trim',{recursive:true})
fs.writeFileSync('qa-output/fx-trim/export-comparison.png',sheet.toBuffer('image/png'))
console.log('PASS four exact headless frame comparisons: original left, trimmed right')
