import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createCanvas} from '@napi-rs/canvas'
import {renderStroke} from '../src/lib/drawingEngine.ts'
const shapes=['rectangle','rounded-rectangle','circle','triangle','diamond','pentagon','hexagon','octagon','heart','chevron','star','polygon']
const sheet=createCanvas(960,600),x=sheet.getContext('2d');x.fillStyle='#111b2b';x.fillRect(0,0,960,600)
for(const [index,tool]of shapes.entries()){
 const c=createCanvas(240,180),ctx=c.getContext('2d')
 const stroke={id:tool,layerId:'paint-1',tool,color:'#49d2cf',size:6,opacity:1,filled:true,polygonSides:7,points:[{x:.15,y:.12,timestamp:0},{x:.85,y:.88,timestamp:1}],temporalScope:{type:'global'}}
 renderStroke(ctx,stroke,240,180)
 const image=ctx.getImageData(0,0,240,180).data;let painted=0
 for(let i=3;i<image.length;i+=4)if(image[i]>0)painted++
 assert.ok(painted>1500,`${tool} must render a filled shape, not a missing tool`)
 // Reversed dragging must preserve geometry for these bounding-box shapes.
 const reverse=createCanvas(240,180);renderStroke(reverse.getContext('2d'),{...stroke,points:[...stroke.points].reverse()},240,180)
 assert.deepEqual(Buffer.from(c.toBuffer('image/png')),Buffer.from(reverse.toBuffer('image/png')),`${tool}: reversed drag parity`)
 const col=index%4,row=Math.floor(index/4);x.drawImage(c,col*240,row*200);x.fillStyle='#f2f8ff';x.font='14px sans-serif';x.fillText(tool,col*240+12,row*200+192)
}
fs.mkdirSync('qa-output/screenshots',{recursive:true});fs.writeFileSync('qa-output/screenshots/drawing-shapes.png',sheet.toBuffer('image/png'))
console.log(`PASS ${shapes.length} drawing shapes, fill visibility and reversed-drag geometry`)
