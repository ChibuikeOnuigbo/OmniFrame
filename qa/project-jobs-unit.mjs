import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadModule(path, dependencies, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, ...globals })
  return exports
}

// Resolve real async slice calls in hostile order; no DOM/decoder timing guesses.
const patches = []
let snapshots = 0
let state
const { createSmartPatchSlice } = loadModule('../src/store/smartPatch.ts', {
  '../lib/smartPatch': { buildSmartPatchFrame: () => new Promise((resolve, reject) => patches.push({ resolve, reject })) },
  '../lib/time': { uid: () => 'patch' }, './rotoMask': {},
}, { Image: class { complete = true; naturalWidth = 16; naturalHeight = 16 } })
const reset = () => {
  const slice = createSmartPatchSlice(patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) } },
    () => state, () => snapshots++)
  state = { ...slice, projectGeneration: 0, clips: [{ id: 'clip', assetId: 'image', start: 0, duration: 2 }],
    assets: [{ id: 'image', kind: 'image' }], projectFps: 30, playhead: 0, selectedClipId: 'clip',
    drawingStrokes: [], activePaintLayerId: 'paint', cloneSourcePoint: { x: 1, y: 1, sampleDataUrl: 'donor' } }
  snapshots = 0
}
const draw = () => state.applySmartPatch([{ x: 2, y: 2 }])
reset()
const stale = draw()
state = { ...state, projectGeneration: 1, smartPatchStatus: { phase: 'idle' } }
patches.shift().resolve('old-patch')
assert.equal(await stale, false, 'a patch from a replaced project must be discarded even when clip IDs recur')
assert.equal(state.drawingStrokes.length, 0)
assert.equal(snapshots, 0, 'stale patches must not pollute Undo')
assert.equal(state.smartPatchStatus.phase, 'idle', 'stale progress must not overwrite new status')

reset()
const older = draw()
const latest = draw()
patches.pop().resolve('latest-patch')
assert.equal(await latest, true)
patches.shift().reject(new Error('late failure'))
assert.equal(await older, false)
assert.equal(state.smartPatchStatus.phase, 'done', 'older failures cannot overwrite a completed newer job')
assert.equal(state.drawingStrokes[0].smartPatchFrames[0].dataUrl, 'latest-patch')
assert.equal(snapshots, 1)

for (const change of ['delete', 'replace', 'move']) {
  reset()
  const pending = draw()
  if (change === 'delete') state = { ...state, clips: [] }
  if (change === 'replace') state = { ...state, assets: [{ ...state.assets[0], url: 'replacement' }] }
  if (change === 'move') state = { ...state, clips: [{ ...state.clips[0], start: 10 }] }
  patches.shift().resolve('obsolete-patch')
  assert.equal(await pending, false, `${change} invalidates pending patches`)
  assert.equal(state.drawingStrokes.length, 0)
  assert.equal(snapshots, 0)
  assert.notEqual(state.smartPatchStatus.phase, 'processing', 'cancelled current job must release busy status')
}
console.log('PASS Smart Patch project replacement, overlapping jobs, deleted/moved clips and replaced sources')

let project = { projectGeneration: 0, label: 'old' }
let listener
const frameCallbacks = []
const engines = []
class PreviewEngine {
  disposed = false
  constructor() { engines.push(this) }
  renderClipTile(_clip, _time, current) {
    assert.equal(this.disposed, false, 'disposed sampler cannot be rendered again')
    this.label = current.label
    return true
  }
  sampleElements() { return [{ seeking: false, readyState: 2 }] }
  sampleCanvas() { return { toDataURL: () => this.label } }
  dispose() { this.disposed = true }
}
const { renderClipFilmstrip } = loadModule('../src/lib/clipFilmstrip.ts', {
  './playback': { PreviewEngine },
  '../store': { useEditor: { getState: () => project, subscribe: fn => { listener = fn } } },
}, { document: { createElement: () => ({}) }, performance, setTimeout,
  requestAnimationFrame: fn => frameCallbacks.push(fn) })
const clip = { id: 'same-clip', assetId: 'same-asset', kind: 'video', start: 0, inPoint: 0, duration: 2 }
const oldRender = renderClipFilmstrip(clip, 120)
const queuedRender = renderClipFilmstrip({ ...clip, id: 'queued', start: 1 }, 120)
await Promise.resolve()
const previous = project
project = { projectGeneration: 1, label: 'new' }
listener(project, previous)
assert(engines[0].disposed, 'switching projects must release the old sampling decoder')
const newRender = renderClipFilmstrip(clip, 120)
for (let turn = 0; turn < 12; turn++) {
  await new Promise(resolve => setImmediate(resolve))
  frameCallbacks.splice(0).forEach(fn => fn())
}
assert.equal((await oldRender).length, 0)
assert.equal((await queuedRender).length, 0)
assert((await newRender).every(tile => tile.dataUrl === 'new'), 'reused media IDs cannot reuse old pictures')
assert((await renderClipFilmstrip(clip, 120)).every(tile => tile.dataUrl === 'new'), 'only current pictures enter cache')
assert.equal(engines.length, 2, 'new requests share one fresh sampler')
console.log('PASS filmstrip cancellation, decoder cleanup, queue restart and cache isolation across projects')
