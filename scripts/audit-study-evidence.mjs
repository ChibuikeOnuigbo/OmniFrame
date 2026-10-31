/** Read actual stored frames; surface weak evidence without inventing watched totals. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {createCanvas,loadImage} from '@napi-rs/canvas'
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'youtube-audit/runner')
const inventory=JSON.parse(fs.readFileSync(path.join(dir,'inventory.json'))),records=inventory.videos||[],results=[]
const canvas=createCanvas(64,36),ctx=canvas.getContext('2d')
for(const record of records){
 const folder=path.join(dir,'evidence',record.id)
 const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>/^[us]\d+\.jpg$/.test(f)).sort():[]
 const frames=[]
 for(const file of files){
  try{
   const image=await loadImage(path.join(folder,file));ctx.clearRect(0,0,64,36);ctx.drawImage(image,0,0,64,36)
   const rgba=ctx.getImageData(0,0,64,36).data,luma=[]
   for(let i=0;i<rgba.length;i+=4)luma.push(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2])
   const mean=luma.reduce((a,b)=>a+b,0)/luma.length,sd=Math.sqrt(luma.reduce((a,b)=>a+(b-mean)**2,0)/luma.length)
   frames.push({file,width:image.width,height:image.height,mean:Math.round(mean*100)/100,sd:Math.round(sd*100)/100,nearUniform:sd<2,sha256:crypto.createHash('sha256').update(rgba).digest('hex')})
  }catch(error){frames.push({file,error:String(error)})}
 }
 const hashes=new Set(frames.map(f=>f.sha256).filter(Boolean)),flags=[]
 if((record.status==='FOOTAGE_ACQUIRED'||frames.length>0)&&!(Number(record.duration)>0))flags.push('zero_or_unknown_recorded_duration')
 if(record.status==='FOOTAGE_ACQUIRED'&&!frames.length)flags.push('no_stored_frames')
 if(frames.length&&hashes.size<3)flags.push('fewer_than_three_distinct_sample_images')
 if(frames.length&&frames.filter(f=>f.nearUniform).length===frames.length)flags.push('all_stored_frames_near_uniform')
 if(frames.some(f=>f.error))flags.push('frame_decode_error')
 results.push({id:record.id,url:record.url,historicalStatus:record.status,recordedDuration:record.duration,frames:frames.length,distinctDecodedImages:hashes.size,nearUniformFrames:frames.filter(f=>f.nearUniform).length,flags,status:flags.length?'needs_source_and_sampling_review':'stored_evidence_available_not_a_watching_claim',samples:frames})
}
const out=path.join(root,'reports/repo-audit');fs.mkdirSync(out,{recursive:true})
const summary={generatedAt:new Date().toISOString(),records:results.length,recordsWithFrames:results.filter(r=>r.frames).length,flagged:results.filter(r=>r.flags.length).length,flags:Object.fromEntries([...new Set(results.flatMap(r=>r.flags))].map(flag=>[flag,results.filter(r=>r.flags.includes(flag)).length])),method:'64×36 decoded RGBA SHA-256 and luma standard deviation; near-uniform threshold 2/255; flags require review, not proof of fabricated media. Acquisition is not visual/audio review.'}
fs.writeFileSync(path.join(out,'study-evidence.json'),JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary,null,2))
