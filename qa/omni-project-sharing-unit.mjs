import assert from 'node:assert/strict'
import { buildOmniProjectBundle, parseOmniProjectBundle } from '../src/lib/omniProject.ts'
const shared = { effectKeys: { blur: [{ t: 0, v: 0 }, { t: 2, v: 12 }] }, bytes: new Uint8Array([1, 2, 3]) }
const state = { assets: [], tracks: [], clips: [{ id: 'left', ...shared }, { id: 'right', ...shared }], nested: new Map([['a', shared], ['b', shared]]), list: new Set([shared, { ...shared }]) }
const bundle = await buildOmniProjectBundle(state, 'Shared clip data')
const project = await parseOmniProjectBundle(new File([bundle], 'shared.omni'))
assert.deepEqual(project.state.clips[0].effectKeys, shared.effectKeys)
assert.deepEqual(project.state.clips[1].effectKeys, shared.effectKeys)
assert.deepEqual([...project.state.clips[1].bytes], [1, 2, 3])
project.dispose()
for (const cyclic of [{}, [], new Map(), new Set()]) {
  if (cyclic instanceof Map) cyclic.set('self', cyclic)
  else if (cyclic instanceof Set) cyclic.add(cyclic)
  else if (Array.isArray(cyclic)) cyclic.push(cyclic)
  else cyclic.self = cyclic
  await assert.rejects(buildOmniProjectBundle({ nested: cyclic }, 'Invalid'), /cyclic object/)
}
console.log('PASS split/shared objects, shared typed data, Map/Set reuse and true cycle rejection')
