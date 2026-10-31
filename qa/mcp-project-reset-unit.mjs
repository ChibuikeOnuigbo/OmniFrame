import assert from 'node:assert/strict'
import {registry,SESSION} from '../tools/mcp/tools.mjs'
import {renderFrame} from '../tools/mcp/appRender.mjs'
const call=async(tool,params)=>{const result=await registry.call(tool,params);assert.ok(result.ok,JSON.stringify(result.data));return result.data}
await call('project_new',{w:64,h:36,duration:2,bg:'#183049'})
await call('draw_stroke',{tool:'rectangle',points:[[0,0],[64,36]],color:'#ff0000',filled:true,size:1,appearAt:0})
const before=renderFrame(SESSION.seq,1).getContext('2d').getImageData(32,18,1,1).data
assert.ok(before[0]>240&&before[2]<10,'old project has red paint')
SESSION.omniSelection={clipId:'old'};SESSION.compounds=[{id:'old'}];SESSION.seqStack=[SESSION.seq];SESSION.videoFrames={old:{}}
const templates=SESSION.templates
await call('project_new',{w:64,h:36,duration:2,bg:'#183049'})
assert.equal(SESSION.paint.strokes.length,0);assert.equal(SESSION.paint.clock,0);assert.equal(SESSION.omniSelection,null)
assert.deepEqual(SESSION.compounds,[]);assert.deepEqual(SESSION.seqStack,[]);assert.deepEqual(SESSION.videoFrames,{})
assert.equal(SESSION.templates,templates,'saved template library survives new projects')
assert.deepEqual([...renderFrame(SESSION.seq,1).getContext('2d').getImageData(32,18,1,1).data],[24,48,73,255],'new project pixels are not covered by previous paint')
console.log('PASS new project clears paint, selections, compound navigation and decoded-frame ownership; rendered pixels clean; template library preserved')
