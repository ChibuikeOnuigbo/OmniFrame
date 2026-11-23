import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { makeClip, renderFrame, loadAppTs, setPaintGetter } from '../tools/mcp/appRender.mjs'
import { ffmpegExe } from '../tools/mcp/core.mjs'

const out = path.resolve('qa-output/editor-capabilities')
fs.mkdirSync(out, { recursive: true })
const call = async (tool, params) => { const r = await registry.call(tool, params); assert.ok(r.ok, JSON.stringify(r.data)); return r.data }
const catalog = await loadAppTs('src/lib/effectCatalog.ts')
const entries = catalog.queryFxCatalog({ collection: 'essentials', limit: 100 }).entries.filter(e => e.id.startsWith('essential-'))
const photo = await loadImage('public/assets/effect-subjects/pexels-car.jpg')
await call('project_new', { w: 320, h: 180, fps: 12, duration: entries.length * 2 + 2, bg: '#0b0f17' })
for (const [index, entry] of entries.entries()) {
  const clip = makeClip({ id: entry.id, name: entry.name, asset: 'local-photo', natW: 320, natH: 180, start: index * 2, duration: 2,
    draw: (x, w, h) => x.drawImage(photo, 0, 0, w, h) })
  const amount = Object.keys(entry.patch)[0]
  clip.fxInstances = [{ id: `fx-${index}`, catalogId: entry.id, name: entry.name, inP: 0, duration: 2, enabled: true,
    params: entry.patch, keys: { [amount]: [{ t: 0, v: 0 }, { t: 1.25, v: Number(entry.patch[amount]) }] } }]
  SESSION.seq.addClip(clip)
}
const trimStart = entries.length * 2
const stroke = { id: 'trim-proof', layerId: 'ink', tool: 'brush', color: '#6ee7b7', size: 6, opacity: 1,
  temporalScope: { type: 'span', startTime: trimStart, duration: 2 },
  points: Array.from({ length: 100 }, (_, i) => ({ x: .1 + i / 125, y: .5 + Math.sin(i / 10) * .2, timestamp: i * 10 })),
  pathTrim: { start: 0, end: 1, offset: 0, keys: { end: [{ t: trimStart, v: 0 }, { t: trimStart + 1.9, v: 1 }] } } }
setPaintGetter(() => ({ strokes: [stroke], layers: [{ id: 'ink', visible: true, opacity: 1, blendMode: 'normal' }] }))
const sheet = createCanvas(960, 3 * 206), sx = sheet.getContext('2d')
const names = [...entries.map(e => e.name), 'Trim Path']
for (const [index, name] of names.entries()) {
  const frame = renderFrame(SESSION.seq, index * 2 + 1.5)
  const x = index % 3 * 320, y = Math.floor(index / 3) * 206
  sx.drawImage(frame, x, y); sx.fillStyle = '#111827'; sx.fillRect(x, y + 180, 320, 26)
  sx.fillStyle = '#fff'; sx.font = '14px sans-serif'; sx.fillText(name, x + 10, y + 198)
}
fs.writeFileSync(path.join(out, 'contact-sheet.png'), sheet.toBuffer('image/png'))
await call('render_export', { out: 'qa-output/editor-capabilities/effects-and-trim.mp4', fps: 12, duration: names.length * 2, audio: false })
const decoded = execFileSync(ffmpegExe(), ['-v', 'error', '-i', path.join(out, 'effects-and-trim.mp4'), '-f', 'framemd5', '-'], { encoding: 'utf8' })
const hashes = decoded.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(',').at(-1).trim())
assert.equal(hashes.length, names.length * 24)
assert.ok(new Set(hashes).size > 100, 'keyframed effects and the path must produce moving frames')

// Full compositor: retain source pixels outside the mask and honor channel/key/alpha operations.
await call('project_new', { w: 64, h: 36, duration: 2, bg: '#000000' })
setPaintGetter(() => null)
const solid = makeClip({ id: 'probe', name: 'probe', asset: 'probe', natW: 64, natH: 36, duration: 2,
  draw: x => { x.fillStyle = '#00ff00'; x.fillRect(0, 0, 64, 36) } })
SESSION.seq.addClip(solid)
solid.effects = { colorHold: 1, holdColor: '#ff0000' }
solid.adjustmentMask = { enabled: true, inverted: false, shape: 'rectangle', centerX: .5, centerY: .25, width: 1, height: .5, feather: 0 }
let context = renderFrame(SESSION.seq, 1).getContext('2d')
assert.deepEqual([...context.getImageData(48, 7, 1, 1).data], [182, 182, 182, 255])
assert.deepEqual([...context.getImageData(48, 29, 1, 1).data], [0, 255, 0, 255])
delete solid.adjustmentMask
solid.effects = { lumaRange: 1, lumaLow: .9, lumaHigh: 1, lumaFeather: 0 }
context = renderFrame(SESSION.seq, 1).getContext('2d')
assert.deepEqual([...context.getImageData(32, 18, 1, 1).data], [0, 0, 0, 255], 'luma matte reveals the black sequence background')
solid.effects = { despill: 1, despillLuma: 0 }
assert.deepEqual([...renderFrame(SESSION.seq, 1).getContext('2d').getImageData(32, 18, 1, 1).data], [0, 0, 0, 255])
solid.effects = { channelMixer: 1, mixRG: 1, mixGG: 0 }
assert.deepEqual([...renderFrame(SESSION.seq, 1).getContext('2d').getImageData(32, 18, 1, 1).data], [255, 0, 0, 255])
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ workflow: 'Shared headless app compositor → render_export → decoded framemd5', presets: names, frames: hashes.length, distinctDecodedFrames: new Set(hashes).size, maskedColorHold: 'pass', lumaAlpha: 'pass', despill: 'pass', channelMixer: 'pass', source: 'Existing Pexels car subject; see public/assets/effect-subjects credits' }, null, 2) + '\n')
console.log(`PASS headless export: ${hashes.length} frames, ${new Set(hashes).size} distinct, masked and keyed compositor checks`)
