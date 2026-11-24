import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { makeClip, renderFrame } from '../tools/mcp/appRender.mjs'
import { ffmpegExe } from '../tools/mcp/core.mjs'
const out = 'qa-output/native-effect-keyframes'
fs.mkdirSync(out, { recursive: true })
const call = async (tool, params) => { const r = await registry.call(tool, params); assert.ok(r.ok, JSON.stringify(r.data)); return r.data }
await call('project_new', { w: 64, h: 36, fps: 12, duration: 6, bg: '#000000' })
const plate = makeClip({ id: 'plate', name: 'Plate', natW: 64, natH: 36, duration: 6, draw: x => { x.fillStyle = '#00ff00'; x.fillRect(0, 0, 64, 36) } })
const fx = makeClip({ id: 'native-fx', name: 'Color Hold', natW: 64, natH: 36, duration: 6, draw: () => {} }); fx.kind = 'adjustment'
SESSION.seq.addClip(plate); SESSION.seq.addClip(fx)
const keys = { colorHold: [{ t: 0, v: 0 }, { t: 2, v: 1 }, { t: 4, v: 0 }, { t: 6, v: 1 }] }
const mask = { enabled: true, inverted: false, shape: 'rectangle', centerX: .5, centerY: .25, width: 1, height: .5, feather: 0 }
await call('edit_element', { clipId: fx.id, patch: { effects: { colorHold: 0, holdColor: '#ff0000' }, effectKeys: keys, adjustmentMask: mask } })
const px = (time, y) => [...renderFrame(SESSION.seq, time).getContext('2d').getImageData(32, y, 1, 1).data]
assert.deepEqual(px(0, 7), [0, 255, 0, 255])
assert.deepEqual(px(2, 7), [182, 182, 182, 255])
assert.deepEqual(px(2, 29), [0, 255, 0, 255], 'standalone effect mask preserves the footage outside')
fx.adjustmentMask = { ...mask, regions: [{ ...mask, id: 'half', opacity: .5 }] }
const half = px(2, 7)
assert.ok(Math.abs(half[0] - 91) <= 1 && Math.abs(half[1] - 218) <= 1 && half[3] === 255, `partly masked grade keeps opaque footage: ${half}`)
fx.adjustmentMask = mask
const expected = renderFrame(SESSION.seq, 1.5).toBuffer('image/png')
await call('edit_element', { clipId: fx.id, patch: { effectSourceOffset: 1 } })
fx.start = 1; fx.duration = 5
assert.deepEqual(renderFrame(SESSION.seq, 1.5).toBuffer('image/png'), expected, 'a split tail renders exactly the same pixels')
const before = JSON.stringify(fx)
for (const patch of [{ effectKeys: { colorHold: [{ t: 0, v: 1, unsafe: () => {} }] } }, { effectKeys: null }, { effectKeys: { colorHold: [{ t: 1, v: NaN }] } }, { effectSourceOffset: Infinity }, { effects: { colorHold: 'bad' } }]) {
  const bad = await registry.call('edit_element', { clipId: fx.id, patch: { volume: .2, ...patch } })
  assert.equal(bad.ok, false); assert.equal(JSON.stringify(fx), before, 'invalid headless edit is atomic')
}
const overlay = makeClip({ id: 'above', name: 'Unaffected overlay', natW: 64, natH: 36, duration: 6, draw: x => { x.fillStyle = '#00ff00'; x.fillRect(0, 0, 64, 36) } })
SESSION.seq.addClip(overlay)
assert.deepEqual(px(2, 7), [0, 255, 0, 255], 'elements above the effect are not graded')
// LUTs precede pixel effects on adjustment layers: a combined layer must match
// the same two operations in separate layers with that order.
SESSION.seq.clips = [plate, fx]; fx.start = 0; fx.effectSourceOffset = 0; fx.duration = 6; delete fx.adjustmentMask
fx.adjustment = { luts: [{ builtin: 'tymm-5', intensity: 1, enabled: true }] }
const combined = renderFrame(SESSION.seq, 2).toBuffer('image/png')
const lutLayer = makeClip({ id: 'lut', name: 'LUT', natW: 64, natH: 36, duration: 6, draw: () => {} }); lutLayer.kind = 'adjustment'; lutLayer.adjustment = fx.adjustment
delete fx.adjustment; SESSION.seq.clips = [plate, lutLayer, fx]
assert.deepEqual(renderFrame(SESSION.seq, 2).toBuffer('image/png'), combined, 'adjustment LUT/pixel order matches separate layers')
// Real photo, one native effect clip, a masked animation, fixed-rate shared-engine export.
await call('project_new', { w: 320, h: 180, fps: 12, duration: 6, bg: '#000000' })
const photo = await loadImage('public/assets/effect-subjects/pexels-car.jpg')
const source = makeClip({ id: 'car', name: 'Car', natW: 320, natH: 180, duration: 6, draw: (x, w, h) => x.drawImage(photo, 0, 0, w, h) })
const effect = makeClip({ id: 'native-photo-fx', name: 'Animated blur and color', natW: 320, natH: 180, duration: 6, draw: () => {} }); effect.kind = 'adjustment'
SESSION.seq.addClip(source); SESSION.seq.addClip(effect)
const patch = { effects: { boxBlur: 0, colorHold: 0, holdColor: '#ff0000', holdSimilarity: .15, holdSoftness: .2 }, effectKeys: { ...keys, boxBlur: [{ t: 0, v: 0 }, { t: 2, v: 16 }, { t: 4, v: 0 }, { t: 6, v: 24 }] }, adjustmentMask: { ...mask, centerY: .5, centerX: .75, height: 1, width: .5 } }
await call('edit_element', { clipId: effect.id, patch })
const sheet = createCanvas(960, 412), sx = sheet.getContext('2d')
for (const [i, t] of [0, 1, 2, 3, 4, 5.75].entries()) {
  const x = i % 3 * 320, y = Math.floor(i / 3) * 206
  sx.drawImage(renderFrame(SESSION.seq, t), x, y); sx.fillStyle = '#111827'; sx.fillRect(x, y + 180, 320, 26)
  sx.fillStyle = '#ffffff'; sx.font = '14px sans-serif'; sx.fillText(`${t}s · right half animated`, x + 10, y + 198)
}
fs.writeFileSync(path.join(out, 'contact-sheet.png'), sheet.toBuffer('image/png'))
await call('render_export', { out: `${out}/native-keyframes.mp4`, fps: 12, duration: 6, audio: false })
const decoded = execFileSync(ffmpegExe(), ['-v', 'error', '-i', `${out}/native-keyframes.mp4`, '-f', 'framemd5', '-'], { encoding: 'utf8' })
const hashes = decoded.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(',').at(-1).trim())
assert.equal(hashes.length, 72); assert.ok(new Set(hashes).size >= 30)
fs.writeFileSync(`${out}/report.json`, JSON.stringify({ workflow: 'Native effect clip → shared compositor → render_export → decoded framemd5', frames: hashes.length, distinctDecodedFrames: new Set(hashes).size, maskedKeyframes: 'pass', splitContinuity: 'exact PNG match', higherLayerUnaffected: true, atomicInvalidEdits: true, adjustmentLutOrder: 'pass', photo: 'Existing credited Pexels car subject', patch }, null, 2) + '\n')
console.log(`PASS native masked keyframes: ${hashes.length} exported frames, ${new Set(hashes).size} distinct; split, layer order and invalid inputs verified`)
