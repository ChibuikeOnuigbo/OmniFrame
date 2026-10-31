/** UI proof samples from actual Playwright screenshots, not a continuous recording. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const root=path.resolve(import.meta.dirname,'..'),files=['drawer-320','drawer-390','drawer-768','drawer-1440','purple-settings','liquify-preview'].map(name=>'evidence_video/workbench/'+name+'.png')
const list=path.join(root,'.cache/workbench-ui-proof.txt');fs.mkdirSync(path.dirname(list),{recursive:true})
fs.writeFileSync(list,files.map(file=>`file '${path.join(root,file)}'\nduration 1.2`).join('\n')+`\nfile '${path.join(root,files.at(-1))}'\n`)
execFileSync(ffmpegExe(),['-y','-v','error','-f','concat','-safe','0','-i',list,'-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1','-r','24','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',path.join(root,'evidence_video/workbench-ui.mp4')])
fs.writeFileSync(path.join(root,'evidence_video/workbench-ui.json'),JSON.stringify({type:'UI diagnostic samples, not continuous interaction recording',sourceScreenshots:files},null,2))
console.log('PASS UI diagnostic MP4 from actual tested screenshot states')
