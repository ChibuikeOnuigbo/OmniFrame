import assert from 'node:assert/strict'
import { DEVICE_KINDS, DEVICE_MOTIONS, rigAt } from '../src/lib/device3d.ts'
for(const kind of DEVICE_KINDS)for(const motion of DEVICE_MOTIONS){
 for(const fps of [30,60])for(let i=0;i<=fps*2;i++){
  const rig=rigAt(kind,i/(fps*2),motion)
  assert.ok(Object.values(rig).every(Number.isFinite),`${kind}/${motion} finite at ${i}/${fps}`)
  assert.ok(rig.fill>=0&&rig.fill<=1)
  if(i%2===0&&fps===60)assert.deepEqual(rig,rigAt(kind,(i/2)/60,motion),'30/60 fps pose parity')
 }
 if(motion==='pullback')assert.equal(rigAt(kind,1,motion).bodyAlpha,0)
 else assert.equal(rigAt(kind,1,motion).fill,1,`${motion} ends full-frame`)
}
console.log(`PASS ${DEVICE_KINDS.length} device kinds × ${DEVICE_MOTIONS.length} motions, 30/60 fps parity and full-frame endpoints`)
