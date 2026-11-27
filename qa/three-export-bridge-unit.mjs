import assert from 'node:assert/strict'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const {beginThreeExport,registerThreeExportFactory}=await loadAppTs('src/lib/threeExportBridge.ts')
assert.throws(()=>beginThreeExport(640,360),/not ready/)
let calls=0
const old={canvas:{},render(){},dispose(){}}
const next={canvas:{},render(){},dispose(){}}
const unregisterOld=registerThreeExportFactory(()=>{calls++;return old})
assert.equal(beginThreeExport(640,360),old)
for(const pair of [[0,1],[1,-1],[NaN,1],[Infinity,1],[640.5,360]])assert.throws(()=>beginThreeExport(...pair),/Invalid/)
assert.equal(calls,1,'invalid dimensions must not allocate a renderer')
const unregisterNext=registerThreeExportFactory(()=>next)
unregisterOld()
assert.equal(beginThreeExport(720,1280),next,'old viewport cleanup must not detach a replacement viewport')
unregisterNext();unregisterNext()
assert.throws(()=>beginThreeExport(640,360),/not ready/)
console.log('PASS lazy 3D export ownership, dimensions and replacement cleanup')
