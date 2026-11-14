import assert from 'node:assert/strict'
import {makeCanvas} from '../tools/mcp/core.mjs'
import {applyEffectMaskK} from '../tools/mcp/appRender.mjs'
import {effectMaskFeatherBounds} from '../src/lib/effectMask.ts'
const local = effectMaskFeatherBounds([{id:'r',shape:'circle',centerX:.5,centerY:.5,width:.3,height:.3,feather:24,opacity:1}],3840,2160)
assert(local.width < 3840 && local.height < 2160, `expected a cropped 4K readback: ${JSON.stringify(local)}`)
const split = effectMaskFeatherBounds([{id:'r',shape:'split',centerX:.5,centerY:.5,width:.3,height:.3,feather:24,opacity:1}],3840,2160)
assert.deepEqual(split,{x:0,y:0,width:3840,height:2160})
const render=(featherTint=0,featherOffset=0)=>{const c=makeCanvas(100,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,100,100);applyEffectMaskK(x,{enabled:true,inverted:false,featherColor:'#0000ff',featherTint,featherOffset,regions:[{id:'r',shape:'circle',centerX:.5,centerY:.5,width:.5,height:.5,feather:10,opacity:1}]},100,100);return Array.from(x.getImageData(74,50,1,1).data)}
const plain=render(),blue=render(1),inside=render(0,-1),outside=render(0,1)
assert.equal(plain[0],255)
assert(blue[2]>blue[0]+150,`blue feather ${blue}`)
assert(inside[3]<plain[3]&&plain[3]<outside[3],`offset alpha ${inside[3]} < ${plain[3]} < ${outside[3]}`)
console.log('PASS colored feather and biased soft edge pixels')
// Small deterministic comparison for human review; generated entirely by the renderer.
const sheet=makeCanvas(900,300),sh=sheet.getContext('2d')
sh.fillStyle='#1a2232';sh.fillRect(0,0,900,300)
for(const [i,color] of ['#ffffff','#3b82f6','#000000'].entries()){
 const canvas=makeCanvas(300,300),ctx=canvas.getContext('2d')
 ctx.fillStyle='#fda4af';ctx.fillRect(0,0,300,300)
 applyEffectMaskK(ctx,{enabled:true,inverted:false,featherColor:color,featherTint:i?1:0,regions:[{id:'r',shape:'circle',centerX:.5,centerY:.5,width:.55,height:.55,feather:26,opacity:1}]},300,300)
 sh.drawImage(canvas,i*300,0);sh.fillStyle='#fff';sh.font='20px sans-serif';sh.fillText(['Plain','Blue','Black'][i],i*300+15,35)
}
const fs=await import('node:fs')
fs.mkdirSync('qa-output/effect-mask-feather',{recursive:true})
fs.writeFileSync('qa-output/effect-mask-feather/contact.png',sheet.toBuffer('image/png'))
