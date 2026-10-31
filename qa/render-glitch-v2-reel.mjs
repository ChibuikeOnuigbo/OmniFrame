/** Actual shared app compositor renders via universal tools. Original text/bed. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const call=async(t,p={})=>{const r=await registry.call(t,p);if(!r.ok)throw Error(`${t}: ${r.data?.error}`);return r.data}
const out='qa-output/glitch-v2';fs.mkdirSync(out,{recursive:true})
const jobs=[
 ['rgb-split','rgb-shock',{ngChroma:16,ngSliceAmp:0,ngNoise:.02,ngScanOpacity:0}],
 ['digital-tear','digital-slice',{ngSliceAmp:44,ngSliceDensity:24,ngChroma:5,ngScanOpacity:.2,ngNoise:.04}],
 ['vhs-tracking','vhs-tear',{ngRoll:30,ngNoise:.18,ngScanOpacity:.4,ngSliceAmp:32}],
 ['block-corruption','pixel-collapse',{ngBlock:42,ngBlockRate:.7,ngSliceAmp:28,ngChroma:0,ngNoise:.03}],
 ['temporal-echo','phantom-echo',{ngGhost:.28,ngGhostDelay:6,ngSliceAmp:4,ngNoise:.02}],
]
const manifest=[]
for(const [name,family,patch]of jobs){
 await call('project_new',{w:960,h:540,fps:30,duration:2,bg:'#0a1222'})
 await call('new_background',{kind:'studio'})
 const title=await call('create_text',{text:'OMNIFRAME',preset:'plain',x:0,y:0})
 await call('edit_element',{clipId:title.clipId,patch:{textStyle:{fontSize:72,bold:true,color:'#edf6ff',glowBlur:0},effects:name==='temporal-echo'?{echo:4,echoDecay:.55,echoSpacing:.12}:{}}})
 await call('keyframe_set',{clipId:title.clipId,property:'position',channel:'X',time:0,value:-160,interpolation:'linear'})
 await call('keyframe_set',{clipId:title.clipId,property:'position',channel:'X',time:2,value:160,interpolation:'linear'})
 await call('fx_add',{clipId:title.clipId,catalogId:`ng-${family}`,params:{ngIntensity:1,ngSeed:8156,ngPrimary:'#9256ff',ngSecondary:'#35e2ef',ngLead:0,ngAttack:.05,ngHold:1.8,ngDecay:.15,...patch}})
 const file=`${out}/${name}.mp4`,render=await call('render_export',{out:file,fps:30,duration:2})
 const hashes=execFileSync(ffmpegExe(),['-v','error','-i',file,'-f','framemd5','-']).toString().split('\n').filter(l=>l&&!l.startsWith('#'))
 if(hashes.length!==60 || new Set(hashes.map(l=>l.split(',').pop().trim())).size<2)throw Error(`${name}: missing frames or motion`)
 manifest.push({name,file,family,fps:30,frames:60,resolution:[960,540],renderer:'universal render_export / shared app compositor',temporalEcho:name==='temporal-echo'?'Existing pfxEchoTimes evaluates prior animated clip poses; additional Glitch NG spatial ghosts are also applied':undefined})
 console.log('RENDERED',name,render.frames)
}
fs.mkdirSync('.cache',{recursive:true})
const list='.cache/glitch-demo-concat.txt';fs.writeFileSync(list,manifest.map(m=>`file '${path.resolve(m.file)}'`).join('\n'))
execFileSync(ffmpegExe(),['-y','-v','error','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',`${out}/combined-glitch-demo.mp4`])
fs.writeFileSync(`${out}/demo-manifest.json`,JSON.stringify({manifest,note:'960x540 QA delivery; effects use the same renderer at sequence output resolution. Diagnostics are distinct from full-motion visual acceptance of all 5000 recipes.'},null,2))
console.log('PASS five moving glitch demonstrations and combined reel')
