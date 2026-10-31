/** Rebuild review sheets from actual renderer outputs, never placeholder art. */
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createCanvas,loadImage} from '@napi-rs/canvas'
import {ffmpegExe} from '../tools/mcp/core.mjs'
const root=path.resolve(import.meta.dirname,'..'),shots=path.join(root,'qa-output/screenshots')
fs.mkdirSync(shots,{recursive:true});fs.mkdirSync(path.join(root,'.cache'),{recursive:true})
const previews=path.join(root,'qa-output/device-transitions/model-previews')
if(fs.existsSync(previews)){
 const files=fs.readdirSync(previews).filter(f=>f.endsWith('.png')).sort(),c=createCanvas(768,Math.ceil(files.length/3)*280),x=c.getContext('2d')
 x.fillStyle='#141820';x.fillRect(0,0,c.width,c.height)
 for(const[i,file]of files.entries()){const image=await loadImage(path.join(previews,file)),col=i%3,row=Math.floor(i/3);x.drawImage(image,col*256,row*280,256,256);x.fillStyle='white';x.font='11px sans-serif';x.fillText(file.replace('.png',''),col*256+4,row*280+271)}
 fs.writeFileSync(path.join(shots,'device-model-contact-sheet.png'),c.toBuffer('image/png'))
}
const deviceManifest=path.join(root,'qa-output/device-transitions/manifest.json')
if(fs.existsSync(deviceManifest)){
 const {manifest,contactFrames}=JSON.parse(fs.readFileSync(deviceManifest,'utf8')),c=createCanvas(1400,manifest.length*138),x=c.getContext('2d')
 x.fillStyle='#111820';x.fillRect(0,0,c.width,c.height)
 for(const[row,item]of manifest.entries())for(const[col,f]of contactFrames.filter(f=>f.name===item.name).entries()){
  const image=await loadImage(path.join(root,'qa-output/device-transitions',path.basename(f.file)));x.drawImage(image,col*200,row*138,200,112.5);x.fillStyle='white';x.font='10px sans-serif';x.fillText(`${col===0?item.name+' ':''}${Math.round(f.i/48*100)}%`,col*200+3,row*138+127)
 }
 fs.writeFileSync(path.join(shots,'device-contact-sheet.png'),c.toBuffer('image/png'))
}
const glitchManifest=path.join(root,'qa-output/glitch-v2/demo-manifest.json')
if(fs.existsSync(glitchManifest)){
 const {manifest}=JSON.parse(fs.readFileSync(glitchManifest,'utf8')),indices=[0,9,30,48,59],c=createCanvas(1000,manifest.length*138),x=c.getContext('2d')
 x.fillStyle='#111820';x.fillRect(0,0,c.width,c.height)
 for(const[row,item]of manifest.entries())for(const[col,index]of indices.entries()){
  const png=path.join(root,'.cache',`glitch-${item.name}-${index}.png`)
  execFileSync(ffmpegExe(),['-y','-v','error','-i',path.resolve(root,item.file),'-ss',String(index/30),'-frames:v','1',png])
  x.drawImage(await loadImage(png),col*200,row*138,200,112.5);x.fillStyle='white';x.font='11px sans-serif';x.fillText(`${col===0?item.name+' ':''}${index}/60`,col*200+3,row*138+128)
 }
 fs.writeFileSync(path.join(shots,'glitch-contact-sheet.png'),c.toBuffer('image/png'))
}
console.log('Created contact sheets from available device and glitch render manifests')
