// Original word-stack motion study from observed timeline grammar; not a full source remake.
import fs from 'node:fs'
import {registry} from '../tools/mcp/tools.mjs'
const out='evidence_video/reala/motion design'
fs.mkdirSync(out,{recursive:true})
const call=async(name,p={})=>{const r=await registry.call(name,p);if(!r.ok)throw Error(JSON.stringify(r.data));return r.data}
await call('project_new',{w:540,h:960,fps:24,duration:4.5,bg:'#0c1016'})
const bed=await call('new_background',{kind:'studio'})
await call('edit_element',{clipId:bed.clipId,patch:{effects:{brightness:.3,particleFx:'sparkles',particleDensity:.12,particleTint:'#f6c18a'}}})
const members=[]
for(const [i,text] of ['HEY!','YOU','LOST','YOUR','EARRINGS'].entries()){
 const delay=i*.22,title=await call('create_text',{text,preset:'plain',x:0,y:-220+i*110})
 members.push(title.clipId)
 await call('edit_element',{clipId:title.clipId,patch:{textStyle:{fontSize:i===4?65:90,bold:true,color:i===4?'#f4b173':'#f5f6fa',shadowMode:'outer',shadowColor:'#05080d',shadowOffsetX:2,shadowOffsetY:4,shadowBlur:2}}})
 await call('clip_move_time',{clipId:title.clipId,start:delay})
 await call('clip_stretch',{clipId:title.clipId,duration:4.5-delay})
 await call('keyframe_set',{property:'position',channel:'X',time:delay,value:i%2?420:-420,interpolation:'back-out'})
 await call('keyframe_set',{property:'position',channel:'X',time:delay+.6,value:0,interpolation:'ease-out'})
 await call('keyframe_set',{property:'rotation',channel:'Z',time:delay,value:i%2?12:-12,interpolation:'ease-out'})
 await call('keyframe_set',{property:'rotation',channel:'Z',time:delay+.65,value:0,interpolation:'ease-out'})
 await call('keyframe_set',{property:'opacity',time:delay,value:0,interpolation:'linear'})
 await call('keyframe_set',{property:'opacity',time:delay+.12,value:1,interpolation:'linear'})
}
const group=await call('compound_clip_create',{ids:members,name:'Staggered word stack',nest:true})
await call('select',{clipId:group.id})
for(const channel of ['X','Y']){
 await call('keyframe_set',{property:'scale',channel,time:0,value:.9,interpolation:'ease-in-out'})
 await call('keyframe_set',{property:'scale',channel,time:3.8,value:1.04,interpolation:'ease-in-out'})
}
await call('keyframe_set',{property:'rotation',channel:'Z',time:0,value:-2,interpolation:'ease-in-out'})
await call('keyframe_set',{property:'rotation',channel:'Z',time:3.8,value:2,interpolation:'ease-in-out'})
await call('timeline_screenshot',{out:out+'/kinetic-word-stack-timeline.png',playhead:1.8})
await call('snapshot',{time:2.2,out:out+'/kinetic-word-stack.png'})
const result=await call('render_export',{out:out+'/kinetic-word-stack.mp4',fps:24,duration:4.5,audio:false})
fs.writeFileSync(out+'/kinetic-word-stack-manifest.json',JSON.stringify({classification:'Original source-inspired typography study; not a full source recreation',source:'8hjWrzum_vQ user-provided Drive copy; sampled at 3 and 18 seconds',tools:'Universal text clips, staggered timing, position/rotation/opacity curves, real nested group and gentle group scale/rotation, shared particle background',frames:result.frames,fps:24,duration:4.5,width:540,height:960,audio:'silent original motion study; no source music copied'},null,2))
console.log('PASS kinetic word stack through universal editor tools:',result.frames,'frames')
