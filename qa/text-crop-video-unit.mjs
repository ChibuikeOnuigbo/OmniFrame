import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { renderFrame } from '../tools/mcp/appRender.mjs'

const call = async (tool, params = {}) => {
  const result = await registry.call(tool, params)
  if (!result.ok) throw new Error(`${tool}: ${JSON.stringify(result.data)}`)
  return result.data
}
const source = 'effect_vid/moving-source.mp4'
await call('project_new', { w: 320, h: 180, fps: 12, duration: 2, bg: '#22385a' })
await call('import_video', { path: source, fps: 12, fit: 'cover' })
const title = await call('create_text', { text: 'VIDEO', preset: 'plain' })
await call('edit_element', { clipId: title.clipId, patch: { textStyle: { fontSize: 72, bold: true, color: '#ffffff' } } })
const hash = (time) => createHash('sha256').update(renderFrame(SESSION.seq, time).toBuffer('image/png')).digest('hex')
const plain = hash(0.5)
await call('text_crop_video', { clipId: title.clipId, video: source, invert: true, contrast: 1.3, saturation: 1.4, baseAlpha: 0.04, blendMode: 'screen' })
const croppedA = hash(0.5)
const croppedB = hash(1.25)
assert.notEqual(croppedA, plain, 'video matte must change the title pixels')
assert.notEqual(croppedA, croppedB, 'moving source must remain moving inside the glyphs')
const clip = SESSION.seq.clips.find((item) => item.id === title.clipId)
assert.equal(clip.textStyle.insideVideo, source)
assert.equal(clip.textStyle.insideInvert, true)
assert.equal(clip.blendMode, 'screen')
console.log('PASS moving-video text crop, inside-only negative processing, and blend assignment')
