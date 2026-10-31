/**
 * New Glitch BATCH QUEUE (resumable): renders the next slice of the 5,000
 * recipe definitions in new_glitch/presets.ndjson through the REAL in-app
 * effect graph (Glitch NG catalog → glitchNG kernel), one mp4 each, with
 * perceptual dedupe (32x18 grayscale MAD) so near-identical outputs are not
 * counted twice. Checkpoint: new_glitch/batch/checkpoint.json — re-running
 * this script continues where it stopped. Per-batch manifest + combined
 * review reel are written at the end of every run.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { registry } from '../tools/mcp/tools.mjs'
import { ffmpegExe } from '../tools/mcp/core.mjs'
import { execFileSync } from 'child_process'
import { videoSignature, sameSignature } from './glitch-video-signature.mjs'

const START = 13 // recipes 1-12 already rendered by qa/board-T-glitch.mjs
const countArg = process.argv.find(a => a.startsWith('--count='))?.split('=')[1]
const COUNT = Number(countArg ?? process.env.SLICE ?? 88)
if (!Number.isInteger(COUNT) || COUNT < 1) throw new Error('--count must be a positive integer')
const OUT = 'new_glitch/batch'
fs.mkdirSync(OUT, { recursive: true })
const CK = path.join(OUT, 'checkpoint.json')
const ck = fs.existsSync(CK) ? JSON.parse(fs.readFileSync(CK, 'utf8')) : { next: START, kept: [], dups: [], failed: [] }
const lines = fs.readFileSync('new_glitch/presets.ndjson', 'utf8').trim().split('\n')
const pack = JSON.parse(fs.readFileSync('public/effects/glitch-recipes.json','utf8'))
// Both historical runners used this file but disagreed about index bases.
// Recover from completed recipe IDs rather than trusting an ambiguous cursor.
const completed = new Set([...ck.kept.map(k => k.n), ...ck.dups])
ck.next = START
while(completed.has(ck.next)) ck.next++
ck.cursorConvention = 'next 1-based recipe number'
let stopRequested = false
process.on('SIGTERM', () => { stopRequested = true })
process.on('SIGINT', () => { stopRequested = true })

const step = async (t, a = {}) => { const r = await registry.call(t, a); if (!r.ok) throw new Error(`${t}: ${r.data?.error ?? 'unknown failure'}`); return r }
const save = () => { fs.writeFileSync(CK + '.tmp', JSON.stringify(ck)); fs.renameSync(CK + '.tmp', CK) }

// Historical runners used incompatible 8,640-element extractors. Never compare
// those arrays as if they were the same metric. Re-seed from actual retained
// videos, using one extractor/version for all comparisons.
const SIGF = path.join(OUT,'signatures-v2.json')
const cache = fs.existsSync(SIGF) ? JSON.parse(fs.readFileSync(SIGF,'utf8')) : {version:2,metric:'3 frames, cropped 96x30 area-scaled luma; mean absolute difference < 0.6/255',entries:[]}
if(cache.version!==2)throw Error('Unsupported signature cache version')
const cached = new Map(cache.entries.map(entry=>[entry.key,entry]))
const records=[]
const sigs=[]
let position=0
const rebuild = async()=>{
 while(position<ck.kept.length){
  const k=ck.kept[position++]
  if(!fs.existsSync(k.file))throw Error(`Retained video is missing: ${k.file}`)
  const key=k.file+':'+crypto.createHash('sha256').update(fs.readFileSync(k.file)).digest('hex')
  let entry=cached.get(key)
  if(!entry)entry={key,signature:(await videoSignature(k.file)).toString('base64')}
  records.push(entry);sigs.push(Buffer.from(entry.signature,'base64'))
 }
}
await Promise.all([rebuild(),rebuild()])
cache.entries=records
const saveSignatures=()=>{fs.writeFileSync(SIGF+'.tmp',JSON.stringify(cache));fs.renameSync(SIGF+'.tmp',SIGF)}
saveSignatures()
ck.signatureVersion=2
ck.historicalDuplicateNote='Earlier duplicate decisions are preserved as history; new comparisons use uniformly rebuilt v2 signatures from retained videos.'

const end = Math.min(lines.length, ck.next + COUNT - 1)
for (let number = ck.next; number <= end; number++) {
  if (completed.has(number)) continue
  const idx = number - 1
  try {
  const r = JSON.parse(lines[idx])
  const p = r.parameters || {}, tl = r.timeline || {}, pal = r.palette || {}
  const pri = pal.primary || '#a568ff', sec = pal.secondary || '#15e4f3'
  const dur = Math.min(4, Math.max(2, Number(r.duration) || 4))
  await step('project_new', { w: 480, h: 270, fps: 30, duration: dur, bg: pal.bg || '#0b0912' })
  const bed = await step('new_background', { kind: 'studio' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: dur })
  await step('edit_element', { clipId: bed.data.clipId, patch: { effects: { temp: -0.3, sat: 0.5 } } })
  const ring = await step('create_text', { text: 'OF', preset: 'plain', x: 0, y: -46 })
  await step('clip_stretch', { clipId: ring.data.clipId, duration: dur })
  await step('edit_element', { clipId: ring.data.clipId, patch: { textStyle: { fontSize: 54, color: pri, glowColor: sec, glowBlur: 14 } } })
  const title = await step('create_text', { text: 'OMNIFRAME', preset: 'plain', x: 0, y: 14 })
  await step('clip_stretch', { clipId: title.data.clipId, duration: dur })
  await step('edit_element', { clipId: title.data.clipId, patch: { textStyle: { fontSize: 34, bold: true, color: '#f4f6ff', letterSpacing: 2, glowColor: sec, glowBlur: 8 } } })
  const params = pack[idx].patch
  for (const c of [title, ring]) await step('fx_add', { clipId: c.data.clipId, catalogId: `ng-${r.family}`, params })
  const file = `${OUT}/b${String(idx + 1).padStart(4, '0')}_${r.family}.mp4`
  const ex = await step('render_export', { out: file, fps: 12, duration: dur })
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error('Export produced no video')
  const sig = await videoSignature(file,dur)
  const dup = sigs.find(s => sameSignature(s,sig))
  if (dup) { fs.unlinkSync(file); if (fs.existsSync(file.replace(/\.mp4$/, '.json'))) fs.unlinkSync(file.replace(/\.mp4$/, '.json')); ck.dups.push(idx + 1) } else {
    sigs.push(sig)
    cache.entries.push({key:file+':'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),signature:sig.toString('base64')})
    ck.kept.push({ n: idx + 1, id: r.id, family: r.family, palette: `${pri}/${sec}`, seed: r.seed, file, sha256_16: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16) })
  }
  completed.add(idx + 1)
  ck.next = START; while(completed.has(ck.next)) ck.next++
  delete ck.lastError
  save()
  saveSignatures()
  console.log(`batch ${idx + 1}/${end} ${r.family} ${dup ? 'DUP-skipped' : 'kept'}`)
  if (stopRequested) break
  } catch (error) {
    // Keep the failed item pending: a tool/encoder error must never silently
    // advance the checkpoint and permanently lose a recipe.
    ck.lastError = { recipe: idx + 1, message: String(error), at: new Date().toISOString() }; save();
    console.error(ck.lastError); process.exitCode = 1; break
  }
}

// per-run manifest + combined review reel of everything kept so far
const md = ['# New Glitch batch manifest (rendered through the shared headless app engine)', '',
  `Checkpoint: recipe ${ck.next} of ${lines.length} queued next · kept ${ck.kept.length} · dup-skipped ${ck.dups.length} · failed ${ck.failed.length}`, '',
  '| # | recipe | family | palette | seed | file | sha256:16 |', '|---|---|---|---|---|---|---|']
for (const k of ck.kept) md.push(`| ${k.n} | ${k.id} | ${k.family} | ${k.palette} | ${k.seed} | [${path.basename(k.file)}](${path.basename(k.file)}) | ${k.sha256_16} |`)
fs.writeFileSync(`${OUT}/batch-manifest.md`, md.join('\n') + '\n')
const reelList = ck.kept.filter(k => fs.existsSync(k.file)).map(k => `file '${path.resolve(k.file)}'`).join('\n')
fs.mkdirSync('.cache', { recursive: true })
fs.writeFileSync('.cache/reel.txt', reelList + '\n')
if (ck.kept.length) execFileSync(ffmpegExe(), ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.resolve('.cache/reel.txt'), '-c', 'copy', 'new_glitch/batch_reel.mp4'])
console.log('BATCH RUN DONE kept', ck.kept.length, 'dups', ck.dups.length, 'next', ck.next)
