import assert from 'node:assert/strict'
import {createCanvas} from '@napi-rs/canvas'
import {renderAllPaintLayers,strokeRevealPoints} from '../src/lib/drawingEngine.ts'
const points=[{x:.1,y:.5,timestamp:0},{x:.5,y:.5,timestamp:500},{x:.9,y:.5,timestamp:1000}]
assert.deepEqual(strokeRevealPoints(points,0,100,100),[])
assert.equal(strokeRevealPoints(points,.5,100,100).at(-1).x,.5)
assert.equal(strokeRevealPoints(points,1,100,100),points)
const stroke={id:'s',layerId:'l',tool:'brush',color:'#ffffff',size:6,opacity:1,points,temporalScope:{type:'global'},revealStartTime:0,revealDuration:2}
const visible=time=>{const c=createCanvas(100,100);renderAllPaintLayers(c.getContext('2d'),100,100,[stroke],[{id:'l',visible:true,opacity:1,blendMode:'normal'}],time,30);return c.getContext('2d').getImageData(0,0,100,100).data}
const count=data=>{let n=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)n++;return n}
const a=count(visible(0)),b=count(visible(1)),c=count(visible(2))
assert.equal(a,0);assert(b>0&&c>b,`reveal pixel counts ${a}, ${b}, ${c}`)
console.log(`PASS freehand draw-on pixels progress ${a} → ${b} → ${c}`)
