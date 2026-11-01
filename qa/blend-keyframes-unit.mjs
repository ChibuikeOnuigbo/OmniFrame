import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { blendAt, putBlendKey } from '../src/lib/blendModes.ts'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { makeClip, renderFrame } from '../tools/mcp/appRender.mjs'

let keys = putBlendKey([], 1, 'screen')
keys = putBlendKey(keys, 0, 'multiply')
keys = putBlendKey(keys, 1, 'color-burn')
assert.deepEqual(keys, [{ time: 0, mode: 'multiply' }, { time: 1, mode: 'color-burn' }])
const model = { start: 4, blendMode: 'source-over', blendKeys: keys }
assert.equal(blendAt(model, 3.9), 'source-over')
assert.equal(blendAt(model, 4.5), 'multiply')
assert.equal(blendAt(model, 5.2), 'color-burn')
assert.throws(() => putBlendKey([], -1, 'screen'))
assert.throws(() => putBlendKey([], 0, 'made-up-mode'))

const call = async (name, params = {}) => {
  const result = await registry.call(name, params)
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.data)}`)
  return result.data
}
await call('project_new', { w: 96, h: 54, fps: 12, duration: 2, bg: '#182239' })
const solid = (id, color) => makeClip({ id, name: id, asset: id, natW: 96, natH: 54, duration: 2, draw: (context, width, height) => { context.fillStyle = color; context.fillRect(0, 0, width, height) } })
SESSION.seq.addClip(solid('base', 'rgb(40,90,150)'))
const topClip = solid('top', 'rgb(220,80,45)')
SESSION.seq.addClip(topClip)
SESSION.selection = topClip
const top = { clipId: topClip.id }
await call('blend_set', { mode: 'multiply', time: 0 })
await call('blend_set', { mode: 'screen', time: 1 })
const digest = (time) => createHash('sha256').update(renderFrame(SESSION.seq, time).toBuffer('image/png')).digest('hex')
const animated = [digest(0.5), digest(1.5)]
await call('edit_element', { clipId: top.clipId, patch: { blendKeys: [{ time: 0, mode: 'source-over' }, { time: 1, mode: 'source-over' }] } })
const normal = [digest(0.5), digest(1.5)]
assert.notEqual(animated[0], normal[0], 'multiply key must change rendered pixels')
assert.notEqual(animated[1], normal[1], 'screen key must change rendered pixels')
const dump = await call('data_dump', {})
assert.equal(dump.clips.find((clip) => clip.id === top.clipId).blendKeys.length, 2)
console.log('PASS blend hold-key evaluation, validation, MCP edit/dump, and rendered pixels')
