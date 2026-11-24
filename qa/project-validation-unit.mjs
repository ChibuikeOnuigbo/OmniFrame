import assert from 'node:assert/strict'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const { validateImportedProject } = await loadAppTs('src/lib/projectValidation.ts')

const runtime = { newProject() {}, pause() {}, loadOmniProject() {}, markers: [] }
const fixture = () => ({
  assets: [{ id: 'source', name: 'Source', kind: 'image', url: '/source.png', width: 16, height: 16, duration: 2, size: 10 }],
  tracks: [{ id: 'track', name: 'Video', type: 'video', height: 64, muted: false, hidden: false, locked: false, gapless: false }],
  clips: [{ id: 'clip', trackId: 'track', assetId: 'source', name: 'Clip', kind: 'image', start: 0, inPoint: 0, duration: 2,
    volume: 1, hidden: false, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } }],
})
const valid = fixture()
const original = JSON.stringify(valid)
validateImportedProject(valid, runtime)
assert.equal(JSON.stringify(valid), original, 'validation must not silently rewrite project content')
validateImportedProject({ assets: [], tracks: [], clips: [] }, runtime)
const compound = fixture()
compound.sequences = [{ id: 'seq', name: 'Nested', duration: 2, ...fixture() }]
compound.clips[0].originalChildTracks = fixture().tracks
compound.clips[0].originalChildClips = fixture().clips
validateImportedProject(compound, runtime)

const hostile = [
  doc => { delete doc.clips[0].volume },
  doc => { doc.clips[0].start = NaN },
  doc => { doc.clips[0].duration = Infinity },
  doc => { doc.clips[0].inPoint = -1 },
  doc => { doc.clips[0].transform = null },
  doc => { doc.clips[0].transform.scale = '1' },
  doc => { doc.clips[0].trackId = 'missing' },
  doc => { doc.clips.push({ ...doc.clips[0] }) },
  doc => { doc.tracks[0].height = 'large' },
  doc => { doc.assets[0].url = {} },
  doc => { doc.assets[0].kind = 'unknown' },
  doc => { doc.assets[0].imageSequence = { fps: 0, frames: [] } },
  doc => { doc.assets[0].imageSequence = { fps: 24, frames: [null] } },
  doc => { doc.newProject = 'overwritten' },
  doc => { doc.pause = null },
  doc => { doc.loadOmniProject = {} },
  doc => { doc.constructor = 'unsafe' },
  doc => { doc.markers = {} },
  doc => { doc.playhead = '1' },
  doc => { doc.sequenceSettings = { width: 0, height: 1080 } },
  doc => { doc.sequenceSettings = { width: 1e12, height: 1, fps: 30, label: 'Huge', aspectRatio: 'custom' } },
  doc => { doc.sequenceSettings = { width: 7680, height: 7681, fps: 30, label: 'Huge', aspectRatio: 'custom' } },
  doc => { doc.projectFps = 0 },
  doc => { doc.pxPerSec = 0 },
  doc => { doc.markers = [null] },
  doc => { doc.markers = [{ id: 'marker', time: 1, label: null, color: '#fff' }] },
  doc => { doc.paintLayers = [{ id: 'paint', name: 'Paint', opacity: 1, visible: true, locked: 'yes' }] },
  doc => { doc.sequences = [{ id: 'nested', name: 'Nested', duration: 2, tracks: doc.tracks, clips: [null] }] },
  doc => { doc.clips[0].originalChildClips = [null]; doc.clips[0].originalChildTracks = doc.tracks },
  doc => { doc.clips[0].kind = 'compound'; doc.clips[0].sourceSequenceId = 'missing' },
  doc => {
    doc.clips[0].kind = 'compound'; doc.clips[0].sourceSequenceId = 'cycle'
    doc.sequences = [{ id: 'cycle', name: 'Cycle', duration: 2, tracks: doc.tracks, clips: structuredClone(doc.clips) }]
  },
  doc => {
    doc.clips[0].kind = 'compound'; doc.clips[0].sourceSequenceId = 'a'
    doc.sequences = ['a', 'b'].map((id, index) => ({ id, name: id, duration: 2, tracks: doc.tracks,
      clips: [{ ...doc.clips[0], sourceSequenceId: index === 0 ? 'b' : 'a' }] }))
  },
  doc => {
    let parent = doc.clips[0]
    for (let depth = 0; depth < 34; depth++) {
      parent.kind = 'compound'; parent.originalChildTracks = fixture().tracks; parent.originalChildClips = fixture().clips
      parent = parent.originalChildClips[0]
    }
  },
  doc => { doc.transitions = [{ id: 'transition', type: 'wipe', startTime: 0, duration: undefined }] },
  doc => { doc.scene3DObjects = [{ id: 'cube', name: 'Cube', color: '#ffffff', type: 'cube', position: null }] },
]
for (const mutate of hostile) {
  const doc = fixture(); mutate(doc)
  assert.throws(() => validateImportedProject(doc, runtime), /project contains an invalid/, mutate.toString())
}
console.log(`PASS ${hostile.length} malformed-document cases, valid minimal/nested projects and non-mutating validation`)
