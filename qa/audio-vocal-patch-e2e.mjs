import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = '/home/user/OmniFrame'
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  const result = await page.evaluate(async () => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const store = window.__omniframe_store
    const state = store.getState()
    const ctx = new AudioContext({ sampleRate: 44100 })
    const n = 44100 * 2
    const source = ctx.createBuffer(2, n, 44100)
    const donor = ctx.createBuffer(2, n, 44100)
    for (let c = 0; c < 2; c++) {
      const a = source.getChannelData(c)
      const b = donor.getChannelData(c)
      for (let i = 0; i < n; i++) {
        a[i] = 0.2 * Math.sin(2 * Math.PI * 220 * i / 44100)
        b[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / 44100)
      }
    }
    const patched = lib.patchVocalIntervalsWithInstrumental(ctx, source, donor, [{ start: 0.5, end: 1.5 }], 80)
    const patchStart = Math.floor(0.5 * 44100)
    const patchEnd = Math.floor(1.5 * 44100)
    const from = Math.floor(0.8 * 44100)
    const to = Math.floor(1.2 * 44100)
    let centerErrorEnergy = 0
    let outsideError = 0
    for (let i = 0; i < n; i++) {
      const actual = patched.getChannelData(0)[i]
      if (i >= patchStart && i < patchEnd) {
        if (i >= from && i < to) {
          const delta = actual - donor.getChannelData(0)[i]
          centerErrorEnergy += delta * delta
        }
      } else {
        outsideError = Math.max(outsideError, Math.abs(actual - source.getChannelData(0)[i]))
      }
    }
    const centerErrorToDonor = Math.sqrt(centerErrorEnergy / (to - from))
    const patchAsset = { id: 'patch-smoke-asset', name: 'patch.wav', kind: 'audio', url: 'data:audio/wav;base64,', duration: 2, width: 0, height: 0, size: 0 }
    const extra = { id: 'patch-smoke-extra', name: 'instrumental.wav', kind: 'audio', url: 'data:audio/wav;base64,', duration: 2, width: 0, height: 0, size: 0 }
    const trackAsset = { ...patchAsset, id: 'patch-smoke-track-asset' }
    state.addAsset({ id: 'patch-smoke-source', name: 'source.wav', kind: 'audio', url: 'data:audio/wav;base64,', duration: 2, width: 0, height: 0, size: 0 })
    const trackId = state.ensureTrack('audio')
    state.addClipToTrack(trackId, 'patch-smoke-source', 0)
    const sourceClip = store.getState().clips.find((c) => c.assetId === 'patch-smoke-source')
    const added = store.getState().addGeneratedAudioTracks([
      { asset: trackAsset, trackName: 'Vocals · smoke', clip: { id: 'patch-smoke-output', assetId: trackAsset.id, start: 0, duration: 2, inPoint: 0, name: trackAsset.name, kind: 'audio', volume: 1, hidden: false, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } } },
    ], { extraAssets: [extra], muteClipIds: [sourceClip.id], selectedClipId: sourceClip.id })
    const after = store.getState()
    const sourceMuted = after.clips.find((c) => c.id === sourceClip.id)?.volume === 0
    const groupStored = after.assets.some((a) => a.id === extra.id)
    await ctx.close()
    return { duration: patched.duration, centerErrorToDonor, outsideError, sourceMuted, groupStored, addedTracks: added.trackIds.length, addedClips: added.clipIds.length }
  })
  assert.equal(result.duration, 2, 'patch keeps the source duration')
  assert.equal(result.outsideError, 0, 'samples outside the selected range are unchanged')
  assert(result.centerErrorToDonor < 1e-5, `the center of a selected range uses the time-matched instrumental (RMS error ${result.centerErrorToDonor})`)
  assert(result.sourceMuted, 'generated stems can mute the original in one store operation')
  assert(result.groupStored, 'the extra instrumental reference asset is stored with the stem set')
  assert.equal(result.addedTracks, 1)
  assert.equal(result.addedClips, 1)
  console.log('[PASS] Patch DSP is full-length, preserves untouched audio, uses the aligned donor, and adds synchronized stem state.')
} finally {
  await browser.close()
}
