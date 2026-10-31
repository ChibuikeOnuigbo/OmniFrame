/** Decode the actual regenerated board videos for review. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createCanvas,loadImage} from '@napi-rs/canvas'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'qa-output/recovered-boards'),cache=path.join(root,'.cache/board-review');fs.mkdirSync(cache,{recursive:true})
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):e.name.endsWith('.mp4')?[path.join(p,e.name)]:[])
const files=walk(dir).sort(),sheet=createCanvas(1280,Math.ceil(files.length/4)*208),ctx=sheet.getContext('2d');ctx.fillStyle='#11151b';ctx.fillRect(0,0,sheet.width,sheet.height)
for(const [index,file]of files.entries()){
 const frame=path.join(cache,index+'.png');execFileSync(ffmpegExe(),['-y','-v','error','-ss','0.5','-i',file,'-frames:v','1','-vf','scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2',frame])
 ctx.drawImage(await loadImage(frame),index%4*320,Math.floor(index/4)*208,320,180);ctx.fillStyle='#eef4fa';ctx.font='10px sans-serif';ctx.fillText(path.relative(dir,file),index%4*320+5,Math.floor(index/4)*208+195,310)
}
fs.writeFileSync(path.join(dir,'contact-sheet.png'),sheet.toBuffer('image/png'));console.log(`Decoded ${files.length} actual MP4s into recovered-boards/contact-sheet.png; visual acceptance remains per source task`)
