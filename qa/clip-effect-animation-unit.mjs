import assert from 'node:assert/strict'
import { clipEffectsAt, clipEffectTime, evalFxKeys, shiftClipEffectClock, validateClipEffectAnimation } from '../src/lib/clipEffectAnimation.ts'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const { mergeFxInstances } = await loadAppTs('src/lib/fxInstances.ts')
const { captureClipTemplate, templatePatch, replaceVideoPatch } = await loadAppTs('src/lib/replaceVideo.ts')
const { validateImportedProject } = await loadAppTs('src/lib/projectValidation.ts')
const clip = { id: 'grade', kind: 'adjustment', start: 4, inPoint: 0, duration: 6, effects: { boxBlur: 0, colorHold: 1, holdColor: '#ff0000' }, effectKeys: { boxBlur: [{ t: 0, v: 0 }, { t: 6, v: 60 }] } }
const saved = JSON.stringify(clip)
assert.equal(clipEffectsAt(clip, 3).boxBlur, 30)
assert.equal(clipEffectsAt(clip, -1).boxBlur, 0)
assert.equal(clipEffectsAt(clip, 100).boxBlur, 60)
assert.equal(clipEffectsAt(clip, 3).holdColor, '#ff0000')
assert.equal(evalFxKeys([{ t: 1, v: 3 }, { t: 1, v: 6 }, { t: 3, v: 12 }], 1, 0), 6)
assert.equal(evalFxKeys([{ t: NaN, v: 3 }, { t: 1, v: Infinity }], 2, 7), 7)
assert.equal(evalFxKeys([], Infinity, 7), 7)
for (let cut = .01; cut < 5.9; cut += .13) {
  const right = { ...clip, ...shiftClipEffectClock(clip, cut), start: clip.start + cut, duration: clip.duration - cut }
  for (let t = 0; t < right.duration; t += .11) assert.ok(Math.abs(mergeFxInstances(right, t).boxBlur - mergeFxInstances(clip, t + cut).boxBlur) < 1e-9)
  const restored = { ...right, ...shiftClipEffectClock(right, -cut) }
  assert.equal(clipEffectsAt(restored, 2).boxBlur, 20)
}
assert.equal(JSON.stringify(clip), saved, 'rendering never sorts or rewrites saved keys')
assert.equal(clipEffectTime({ effectSourceOffset: NaN }, 2), 2)
assert.deepEqual(shiftClipEffectClock({}, 2), {})
assert.equal(mergeFxInstances({ ...clip, fxInstances: [{ id: 'nested', enabled: true, inP: 1, duration: 2, params: { boxBlur: 5 }, keys: { boxBlur: [{ t: 0, v: 8 }, { t: 2, v: 12 }] } }] }, 2).boxBlur, 10, 'active instances override native keys')
assert.equal(mergeFxInstances({ ...clip, effects: { aura: 1 }, effectSourceOffset: 2 }, 1).motionClock, 3)
assert.equal(mergeFxInstances({ ...clip, effects: { aura: 0 }, effectKeys: { aura: [{ t: 0, v: 0 }, { t: 4, v: 1 }] }, effectSourceOffset: 2 }, 1).motionClock, 3, 'effects animated from zero acquire their source clock when active')
assert.equal(templatePatch(captureClipTemplate({ ...clip, effectSourceOffset: 2 }, 'saved')).effectSourceOffset, 2)
assert.deepEqual(templatePatch(captureClipTemplate(clip, 'saved')).effectKeys, clip.effectKeys)
assert.ok(replaceVideoPatch(clip, 'new', 10, 0, false).cleared.includes('effectKeys'))
assert.deepEqual(replaceVideoPatch(clip, 'new', 10, 0, true).cleared, [])
validateClipEffectAnimation(clip.effects, clip.effectKeys, -2)
for (const keys of [null, [], { boxBlur: null }, { boxBlur: [{ t: 0, v: Infinity }] }, { boxBlur: [{ t: '1', v: 4 }] }, { holdColor: [{ t: 0, v: 1 }] }, { missing: [] }, { constructor: [] }, JSON.parse('{"__proto__":[]}'), { boxBlur: Array(20001).fill({ t: 0, v: 0 }) }]) assert.throws(() => validateClipEffectAnimation(clip.effects, keys, 0))
assert.throws(() => validateClipEffectAnimation(clip.effects, {}, NaN))
// Nested compounds must validate before project replacement, too.
const track = { id: 'track', name: 'Track', type: 'video', height: 60, hidden: false, muted: false, locked: false, gapless: false }
const validClip = { ...clip, trackId: 'track', assetId: '', name: 'Grade', volume: 1, hidden: false, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } }
const project = { assets: [], tracks: [track], clips: [validClip] }
validateImportedProject(project, {})
const nested = { ...project, clips: [{ ...validClip, originalChildTracks: [track], originalChildClips: [{ ...validClip, effectKeys: { boxBlur: [{ t: 0, v: NaN }] } }] }] }
assert.throws(() => validateImportedProject(nested, {}), /effect animation/)
console.log('PASS native effect interpolation, cut/trim clocks, instance precedence, templates and hostile project inputs')
