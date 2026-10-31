/** Uniform, versioned temporal-luma signatures; no workstation Python dependency. */
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const run=promisify(execFile)
export async function videoSignature(file,duration=4,fps=12){
 const frames=[.3,.55,.8].map(p=>Math.round(duration*fps*p))
 const select=frames.map(n=>`eq(n\\,${n})`).join('+')
 const {stdout}=await run(ffmpegExe(),['-v','error','-threads','1','-i',file,'-vf',`select=${select},crop=iw:floor(ih*.55):0:floor(ih*.3),scale=96:30:flags=area,format=gray`,'-vsync','0','-f','rawvideo','-'],{encoding:'buffer',maxBuffer:1024*1024})
 if(stdout.length!==8640)throw Error(`${file}: expected three complete signature frames, got ${stdout.length} bytes`)
 return stdout
}
export function sameSignature(a,b,threshold=.6){
 if(a.length!==b.length)return false
 let sum=0,limit=threshold*a.length
 for(let i=0;i<a.length;i++){sum+=Math.abs(a[i]-b[i]);if(sum>limit)return false}
 return true
}
