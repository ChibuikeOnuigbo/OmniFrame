/** Moving video proofs via existing universal editor tools, no task-shaped tools. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {registry} from '../tools/mcp/tools.mjs'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const root=path.resolve(import.meta.dirname,'..');process.chdir(root)
const out='evidence_video/transforms';fs.mkdirSync(out,{recursive:true})
const call=async(tool,params)=>{const result=await registry.call(tool,params);if(!result.ok)throw Error(tool+': '+JSON.stringify(result.data));return result.data}
const jobs=[['perspective',{corners:[{x:.14,y:.08},{x:.94,y:.2},{x:.84,y:.95},{x:.03,y:.8}]}],...['push','bulge','pinch','twirl'].map(mode=>['liquify-'+mode,{dabs:[{x:.52,y:.48,dx:.14,dy:.06,radius:.36,strength:.85,mode}]}])]
const manifest=[]
for(const [name,deformation]of jobs){
 await call('project_new',{w:640,h:360,fps:12,duration:2,bg:'#151c2c'})
 const source=await call('import_video',{path:'qa-output/original-demo-source.webm',fps:12,fit:'cover'})
 await call('edit_element',{clipId:source.clipId,patch:{deformation}})
 await call('snapshot',{time:.7,out:out+'/'+name+'.png'})
 await call('timeline_screenshot',{out:out+'/'+name+'-timeline.png'})
 const file=out+'/'+name+'.mp4';await call('render_export',{out:file,fps:12,duration:2})
 const decoded=execFileSync(ffmpegExe(),['-v','error','-i',file,'-f','framemd5','-'],{encoding:'utf8'}),hashes=decoded.split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split(',').at(-1).trim())
 if(hashes.length!==24||new Set(hashes).size<8)throw Error(name+' did not render the moving source')
 manifest.push({file,source:'original FFmpeg testsrc2 footage; no Drive source-match claim',deformation,frames:hashes.length,distinctFrameHashes:new Set(hashes).size,workflow:'project_new -> import_video -> edit_element -> snapshot/timeline_screenshot -> render_export'})
 console.log('PASS moving video',name)
}
fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2))
