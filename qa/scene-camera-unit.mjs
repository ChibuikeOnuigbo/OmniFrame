import assert from 'node:assert/strict'
import {loadAppTs} from '../tools/mcp/appRender.mjs'
const {sphereFitDistance}=await loadAppTs('src/lib/sceneCamera.ts')
for(const aspect of [.2,.5,1,16/9,4])for(const radius of [.1,1,20]){
 const d=sphereFitDistance(radius,45,aspect)
 const angle=Math.asin(radius/d)
 assert.ok(angle<Math.PI/8)
 assert.ok(angle<Math.atan(Math.tan(Math.PI/8)*aspect))
}
for(const args of [[NaN,45,1],[1,0,1],[1,45,0],[-1,45,1],[1,45,1,.5]])assert.throws(()=>sphereFitDistance(...args))
console.log('PASS 15 perspective fits and invalid bounds')
