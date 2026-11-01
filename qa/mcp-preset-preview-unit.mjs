import assert from 'node:assert/strict'
import { registry, SESSION } from '../tools/mcp/tools.mjs'

const call = async (name, params = {}) => {
  const result = await registry.call(name, params)
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.data)}`)
  return result.data
}
await call('project_new', { w: 64, h: 64, fps: 12, duration: 1, bg: '#000' })
const original = SESSION.seq
const effectList = await call('list_presets', { catalog: 'effect', offset: 0, limit: 3 })
const lutList = await call('list_presets', { catalog: 'lut', offset: 0, limit: 2 })
const textList = await call('list_presets', { catalog: 'text', offset: 0, limit: 2 })
assert.ok(effectList.total > 1000 && effectList.nextOffset === 3)
assert.ok(lutList.total >= 30 && textList.total > 10)
for (const request of [
  { catalog: 'effect', id: 'studio-0-0-0' },
  { catalog: 'lut', id: 'clean-neutral' },
  { catalog: 'text', id: 'cinematic-fade', text: 'PREVIEW' },
]) {
  const preview = await call('preset_preview', request)
  assert.ok(preview['data:img'].startsWith('data:image/png;base64,'), `${request.catalog} preview missing image`)
  assert.equal(preview.width, 320)
  assert.equal(SESSION.seq, original, 'preview must restore the caller project')
}
console.log(`PASS paginated preset discovery (${effectList.total} effects, ${lutList.total} LUTs, ${textList.total} text entries) and rendered MCP preview images`)
