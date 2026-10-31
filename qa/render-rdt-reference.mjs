/** Reference-derived RDT recomposition, NOT a recreation from raw anime shots. */
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const source='evidence_video/reala/source/RDT_20261027_092910.mp4'
const dir='evidence_video/reala/normal edit';fs.mkdirSync(dir,{recursive:true})
const ff=ffmpegExe(),duration=752/30
const call=async(name,params={})=>{const r=await registry.call(name,params);if(!r.ok)throw Error(name+': '+JSON.stringify(r.data));return r.data}
const scene=spawnSync(ff,['-hide_banner','-i',source,'-vf',"select='gt(scene,0.22)',showinfo",'-an','-f','null','-'],{encoding:'utf8',maxBuffer:10*1024*1024})
if(scene.status!==0)throw Error(scene.stderr)
const candidates=[...scene.stderr.matchAll(/pts_time:([\d.]+)/g)].map(m=>Number(m[1]))
fs.writeFileSync('evidence_video/reala/source/analysis.json',JSON.stringify({source,sha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),bytes:fs.statSync(source).size,width:360,height:640,fps:30,frames:752,duration,audio:{codec:'AAC',channels:2,sampleRate:48000},analysis:{sceneChangeThreshold:.22,candidateTimes:candidates,warning:'Scene-change scores also respond to flashes/glitches and are not verified shot boundaries. Contact sheets sample frames at 2 fps; audio measurements are not a listening review.'},measuredLayout:{sharpBand:{x:0,y:219,width:360,height:202},outerBackground:'blurred moving duplicate'},provenance:'User-uploaded finished edit; titles, grades, transitions and scene cuts are burned in.'},null,2))
await call('project_new',{w:360,h:640,fps:30,duration,bg:'#05060c'})
const background=await call('import_video',{path:source,fps:30,fit:'contain'})
await call('edit_element',{clipId:background.clipId,patch:{transform:{scale:1.06},effects:{blur:10,brightness:.9},volume:1}})
const foreground=await call('import_video',{path:source,fps:30,fit:'contain'})
await call('edit_element',{clipId:foreground.clipId,patch:{volume:0}})
await call('mask_draw',{shape:'rectangle',x0:0,y0:219,x1:360,y1:421,feather:0})
await call('timeline_screenshot',{out:dir+'/RDT-timeline.png',playhead:8})
await call('snapshot',{time:8,out:dir+'/RDT-preview.png'})
const result=await call('render_export',{out:dir+'/RDT_recopy.mp4',fps:30,duration})
execFileSync(ff,['-y','-v','error','-i',dir+'/RDT_recopy.mp4','-vf','fps=1/3,scale=180:-2,tile=3x3','-frames:v','1',dir+'/RDT-review.png'])
const decoded=execFileSync(ff,['-v','error','-i',dir+'/RDT_recopy.mp4','-map','0:v:0','-f','framemd5','-'],{encoding:'utf8',maxBuffer:4*1024*1024})
const hashes=decoded.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim())
if(hashes.length!==752||new Set(hashes).size<500)throw Error('Export did not preserve moving footage')
const audio=file=>{const buf=execFileSync(ff,['-v','error','-i',file,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','-'],{maxBuffer:8*1024*1024});return new Float32Array(buf.buffer,buf.byteOffset,buf.length/4)}
const a=audio(source),b=audio(dir+'/RDT_recopy.mp4');let ab=0,aa=0,bb=0
for(let i=4800;i<Math.min(a.length,b.length)-4800;i++){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
const correlation=ab/Math.sqrt(aa*bb);if(correlation<.95)throw Error('Export audio did not correlate with source: '+correlation)
const manifest={output:dir+'/RDT_recopy.mp4',source,classification:'reference-derived two-layer recomposition; not an independent recreation',authoredLayers:['full reference: slight enlargement, blur and dimmed background; original audio','full reference: sharp center-band matte; volume zero to avoid doubled audio'],bakedIn:['all existing anime scene cuts','lyric typography','original glitch/flash/zoom effects','original grading and fades'],missingForIndependentRecreation:['separate original anime footage','clean typography/effect-free scene plates','original font/music/project or independently authored replacement choices'],validation:{frames:hashes.length,distinctFrameHashes:new Set(hashes).size,audioCorrelation:correlation,audioTracks:result.audio.tracks,width:360,height:640,fps:30,duration},workflow:'Universal project_new, import_video, edit_element, mask_draw, snapshot, timeline_screenshot, render_export; no external final-pixel edit'}
fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2))
console.log(JSON.stringify(manifest.validation))
