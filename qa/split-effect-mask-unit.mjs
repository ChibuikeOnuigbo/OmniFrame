import assert from 'node:assert/strict'
import { makeCanvas } from '../tools/mcp/core.mjs'
import { applyEffectMaskK } from '../tools/mcp/appRender.mjs'
function render(rotation,inverted=false){
 const c=makeCanvas(100,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,100,100)
 applyEffectMaskK(x,{enabled:true,inverted,regions:[{id:'split',shape:'split',centerX:.5,centerY:.5,width:1,height:1,feather:0,opacity:1,rotation}]},100,100)
 return (px,py)=>x.getImageData(px,py,1,1).data[3]
}
let a=render(0);assert.equal(a(10,50),0);assert.equal(a(90,50),255)
a=render(0,true);assert.equal(a(10,50),255);assert.equal(a(90,50),0)
a=render(90);assert.equal(a(50,10),0);assert.equal(a(50,90),255)
console.log('PASS split mask rotation and complement pixels')
for (const shape of ['star','hexagon']) {
 const c=makeCanvas(100,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,100,100)
 applyEffectMaskK(x,{enabled:true,inverted:false,regions:[{id:shape,shape,centerX:.5,centerY:.5,width:.8,height:.8,feather:0,opacity:1,rotation:0}]},100,100)
 const pixel=(a,b)=>x.getImageData(a,b,1,1).data[3]
 assert.equal(pixel(50,50),255,`${shape} center`)
 assert.equal(pixel(5,5),0,`${shape} outside`)
 const data=x.getImageData(0,0,100,100).data
 let area=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)area++
 assert(area>700&&area<5000,`${shape} mask area ${area}`)
 console.log(`PASS ${shape} effect mask pixels, area ${area}`)
}
for (const count of [0,1,2,3]) {
 const canvas=makeCanvas(100,100),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,100,100)
 const points=[{x:.2,y:.2},{x:.8,y:.2},{x:.5,y:.8}].slice(0,count)
 applyEffectMaskK(ctx,{enabled:true,inverted:false,regions:[{id:'draw',shape:'custom',centerX:.5,centerY:.5,width:1,height:1,feather:0,opacity:1,points}]},100,100)
 const alpha=ctx.getImageData(50,40,1,1).data[3]
 assert.equal(alpha,count===3?255:0,`custom mask ${count} points`)
}
console.log('PASS incomplete drawn masks remain transparent until third point')
const curveImage=curve=>{const c=makeCanvas(100,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,100,100);applyEffectMaskK(x,{enabled:true,inverted:false,regions:[{id:'curve',shape:'custom',centerX:.5,centerY:.5,width:1,height:1,rotation:0,feather:0,opacity:1,curve,points:[{x:.5,y:.1},{x:.9,y:.8},{x:.1,y:.8}]}]},100,100);return Buffer.from(x.getImageData(0,0,100,100).data)}
assert.notDeepEqual(curveImage(0),curveImage(1))
console.log('PASS custom mask curve changes rendered geometry')
const handled=(useHandles)=>{const c=makeCanvas(100,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,100,100);applyEffectMaskK(x,{enabled:true,inverted:false,regions:[{id:'handles',shape:'custom',centerX:.5,centerY:.5,width:1,height:1,feather:0,opacity:1,curve:0,points:[{x:.2,y:.2,...(useHandles?{outHandle:{x:.9,y:.05}}:{})},{x:.8,y:.2,...(useHandles?{inHandle:{x:.1,y:.05}}:{})},{x:.5,y:.8}]}]},100,100);return Buffer.from(x.getImageData(0,0,100,100).data)}
assert.notDeepEqual(handled(true),handled(false))
console.log('PASS individually edited Bezier handles change masked pixels')
