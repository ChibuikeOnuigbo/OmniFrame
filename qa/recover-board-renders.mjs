/** Replay archived user-board recipes through existing universal tools. No new task tools. */
import fs from 'node:fs'
import path from 'node:path'
import {registry} from '../tools/mcp/tools.mjs'
const root=path.resolve(import.meta.dirname,'..');process.chdir(root)
const out='qa-output/recovered-boards';fs.mkdirSync(out,{recursive:true})
const rewrite=value=>{
 if(Array.isArray(value))return value.map(rewrite)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,['out','exportMatte'].includes(key)&&typeof v==='string'?v.replace(/^test_ans_result\//,out+'/'):rewrite(v)]))
 return value
}
const previous=fs.existsSync(out+'/report.json')?JSON.parse(fs.readFileSync(out+'/report.json')):[]
const board=process.argv.find(a=>a.startsWith('--board='))?.split('=')[1]
const report=board?previous:[]
for(const file of fs.readdirSync('tools/mcp/recipes').filter(f=>/^board_[A-J]_.*\.json$/.test(f)&&(!board||f.startsWith('board_'+board+'_'))).sort()){
 const raw=JSON.parse(fs.readFileSync('tools/mcp/recipes/'+file)),recipe=rewrite(raw)
 const dest=out+'/'+file;fs.writeFileSync(dest,JSON.stringify(recipe,null,2))
 const start=Date.now(),result=await registry.call('run_recipe',{file:dest})
 const prior=report.findIndex(r=>r.source==='tools/mcp/recipes/'+file);if(prior>=0)report.splice(prior,1)
 report.push({source:'tools/mcp/recipes/'+file,ok:result.ok,result:result.data,elapsedMs:Date.now()-start,acceptance:'Machine replay only; visual match to original reference remains a separate review.'})
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2))
 console.log(result.ok?'PASS':'FAIL',file,JSON.stringify(result.data).slice(0,180))
}
if(report.some(r=>!r.ok))process.exitCode=1
