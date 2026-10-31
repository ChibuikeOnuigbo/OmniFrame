/** Original word-stagger study, authored only through universal editor tools. */
import fs from 'node:fs'
import {registry} from '../tools/mcp/tools.mjs'
const out='evidence_video/reala/motion design';fs.mkdirSync(out,{recursive:true})
const call=async(t,p={})=>{const r=await registry.call(t,p);if(!r.ok)throw Error(t+': '+JSON.stringify(r.data));return r.data}
await call('project_new',{w:640,h:360,fps:24,duration:3,bg:'#111827'})
await call('new_background',{kind:'studio'})
for(const [text,delay,y,color]of [['OMNI',0,-45,'#a89bff'],['FRAME',.3,40,'#f4f7ff']]){
 const title=await call('create_text',{text,preset:'plain',x:0,y});await call('select',{clipId:title.clipId})
 await call('clip_move_time',{clipId:title.clipId,start:delay})
 await call('edit_element',{clipId:title.clipId,patch:{textStyle:{fontSize:62,bold:true,color,glowColor:color,glowBlur:8},effects:{chromatic:1.2}}})
 await call('keyframe_set',{property:'position',channel:'X',time:0,value:-240,interpolation:'back-out'})
 await call('keyframe_set',{property:'position',channel:'X',time:.75,value:0,interpolation:'ease-out'})
 await call('keyframe_set',{property:'opacity',time:0,value:0,interpolation:'linear'})
 await call('keyframe_set',{property:'opacity',time:.3,value:1,interpolation:'linear'})
}
await call('timeline_screenshot',{out:out+'/word-stagger-timeline.png',playhead:.6})
await call('snapshot',{time:1.2,out:out+'/word-stagger.png'})
await call('render_export',{out:out+'/word-stagger.mp4',fps:24,duration:3})
fs.writeFileSync(out+'/README.md','# Original motion-design proof\n\n`word-stagger.mp4` is an original two-word motion study using staggered text clips, back/ease curves, opacity and light/chromatic styling, authored through existing universal tools. It is inspired by the observed word-level timeline grammar in the supplied short; it is not a source-accurate recreation of that short or the unavailable RDT clip.\n')
console.log('PASS original word-stagger MP4 and timeline through universal editor tools')
