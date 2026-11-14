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
