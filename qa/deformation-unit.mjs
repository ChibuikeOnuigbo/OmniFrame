import assert from 'node:assert/strict'
import {UNIT_QUAD,inverseCornerPin,validWarpQuad,deformRGBA,mapWarpPoint,invertWarpMatrix} from '../src/lib/deformation.ts'
const w=96,h=54,source=new Uint8ClampedArray(w*h*4)
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;source[i]=x*2;source[i+1]=y*4;source[i+2]=(x%12<6)!==(y%12<6)?255:0;source[i+3]=x<3?0:255}
assert.deepEqual(deformRGBA(source,w,h,{}),source)
assert.deepEqual(deformRGBA(source,w,h,{corners:UNIT_QUAD}),source)
const quad=[{x:.12,y:.08},{x:.94,y:.2},{x:.82,y:.95},{x:.04,y:.84}],m=inverseCornerPin(quad)
assert.ok(m);UNIT_QUAD.forEach((point,i)=>{const p=mapWarpPoint(invertWarpMatrix(m),point);assert.ok(Math.abs(p.x-quad[i].x)<1e-8&&Math.abs(p.y-quad[i].y)<1e-8)});quad.forEach((p,i)=>{const z=m[6]*p.x+m[7]*p.y+1;assert.ok(Math.abs((m[0]*p.x+m[1]*p.y+m[2])/z-UNIT_QUAD[i].x)<1e-8);assert.ok(Math.abs((m[3]*p.x+m[4]*p.y+m[5])/z-UNIT_QUAD[i].y)<1e-8)})
assert.equal(validWarpQuad([quad[0],quad[2],quad[1],quad[3]]),false)
const pinned=deformRGBA(source,w,h,{corners:quad});assert.equal(pinned[3],0);assert.notDeepEqual(pinned,source)
for(const mode of ['push','bulge','pinch','twirl']){
 const spec={dabs:[{x:.5,y:.5,dx:.1,dy:.08,radius:.3,strength:.7,mode}]},a=deformRGBA(source,w,h,spec)
 assert.notDeepEqual(a,source,mode+' changes pixels');assert.deepEqual(a,deformRGBA(source,w,h,spec),'cached field deterministic')
 assert.deepEqual([...a.slice(0,20)],[...source.slice(0,20)],'outside brush support unchanged')
}
assert.throws(()=>deformRGBA(source,w,h,{corners:[quad[0],quad[2],quad[1],quad[3]]}))
console.log('PASS identity, inverse homography, folded-quad rejection, alpha and four deterministic cached liquify modes')
