import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = '/home/user/OmniFrame'
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const FIXTURE = join(ROOT, 'evidence/voice/mix-showcase-clean-voice.wav')
if (!existsSync(FIXTURE)) throw new Error('missing local voice/music smoke fixture at evidence/voice/mix-showcase-input.wav')

function trimWavToDataUrl(path, seconds = 6) {
  const src = readFileSync(path)
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength)
  let offset = 12
  let dataOffset = -1
  let dataChunkOffset = -1
  let channels = 0
  let sampleRate = 0
  let bits = 0
  while (offset < src.length - 8) {
    const chunkId = src.toString('ascii', offset, offset + 4)
    const size = view.getUint32(offset + 4, true)
    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bits = view.getUint16(offset + 22, true)
    }
    if (chunkId === 'data') {
      dataChunkOffset = offset
      dataOffset = offset + 8
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (dataOffset < 0 || !channels || !sampleRate || !bits) throw new Error('unsupported WAV fixture')
  const frameBytes = channels * bits / 8
  const keepBytes = Math.min(src.length - dataOffset, Math.floor(seconds * sampleRate) * frameBytes)
  const out = Buffer.concat([src.subarray(0, dataOffset), src.subarray(dataOffset, dataOffset + keepBytes)])
  const outView = new DataView(out.buffer, out.byteOffset, out.byteLength)
  outView.setUint32(4, out.length - 8, true)
  outView.setUint32(dataChunkOffset + 4, keepBytes, true)
  return { dataUrl: `data:audio/wav;base64,${out.toString('base64')}`, duration: keepBytes / frameBytes / sampleRate }
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(900_000)
// The test intentionally runs with a fake Worker, so model weights are not
// required. Only the availability HEAD probe is answered positively.
await page.addInitScript(() => {
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (resource, init) => {
    const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url
    const method = (init?.method || (resource instanceof Request ? resource.method : 'GET')).toUpperCase()
    if (url.includes('/models/htdemucs.onnx') && method === 'HEAD') {
      return Promise.resolve(new Response(null, { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': '174000000' } }))
    }
    return nativeFetch(resource, init)
  }
})
const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(err.message))
try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  const { dataUrl, duration } = trimWavToDataUrl(FIXTURE)
  console.log('Running the four-stem timeline/VAD/patch workflow with deterministic mocked separator output (not a model-quality test)…')
  const result = await page.evaluate(async ({ dataUrl, duration }) => {
    const store = window.__omniframe_store
    const state = store.getState()
    const assetId = 'audio-demucs-stems-smoke-source'
    state.addAsset({ id: assetId, name: 'voice-music-smoke.wav', kind: 'audio', url: dataUrl, duration, width: 0, height: 0, size: 0 })
    const trackId = state.ensureTrack('audio')
    state.addClipToTrack(trackId, assetId, 0)
    const sourceClip = store.getState().clips.find((clip) => clip.assetId === assetId)
    const lib = await import('/src/lib/voiceIsolation.ts')
    const updates = []
    // Keep this integration test safe for the constrained headless renderer:
    // model inference is separately covered by the real-model QA. Here the
    // fake Worker returns a deterministic four-stem layout so the production
    // time-alignment, VAD, store transaction and patch code all run normally.
    const NativeWorker = window.Worker
    window.Worker = class {
      constructor() { this.onmessage = null; this.onerror = null; this.terminated = false }
      postMessage({ channelData, sampleRate }) {
        const count = channelData[0]?.length || 0
        const silent = channelData.map(() => new Float32Array(count))
        const stems = {
          vocals: { channelData: channelData.map((channel) => new Float32Array(channel)), sampleRate },
          drums: { channelData: silent.map((channel) => new Float32Array(channel)), sampleRate },
          bass: { channelData: silent.map((channel) => new Float32Array(channel)), sampleRate },
          other: { channelData: silent.map((channel) => new Float32Array(channel)), sampleRate },
        }
        setTimeout(() => { if (!this.terminated) this.onmessage?.({ data: { type: 'done', stems } }) }, 0)
      }
      terminate() { this.terminated = true }
    }
    try {
      const stems = await lib.executeDemucsStemSeparationForClip(sourceClip.id, { strength: 0.1, speedFactorOverride: 1.25 }, (pct, status) => {
        updates.push({ pct, status })
      })
      const separated = store.getState()
      const stemClips = separated.clips.filter((clip) => stems.stemClipIds.includes(clip.id))
      const stemAssets = Object.values(stems.stemAssetIds).map((id) => separated.assets.find((asset) => asset.id === id))
      const sourceMutedAfterSplit = separated.clips.find((clip) => clip.id === sourceClip.id)?.volume === 0
      const patched = stems.intervals.length > 0
        ? await lib.executeVocalPatchForClip(sourceClip.id, stems.instrumentalAssetId, stems.intervals, {
            crossfadeMs: 80,
            stemClipIds: stems.stemClipIds,
            groupId: stems.groupId,
          })
        : null
      const finalState = store.getState()
      return {
        intervals: stems.intervals,
        speedFactor: stems.speedFactor,
        stemRoles: stemAssets.map((asset) => asset?.audioStemRole),
        stemDurations: stemAssets.map((asset) => asset?.duration),
        stemClipCount: stemClips.length,
        trackCount: new Set(stemClips.map((clip) => clip.trackId)).size,
        sourceMutedAfterSplit,
        sourceStillSelected: finalState.selectedClipId === sourceClip.id,
        patchedClipExists: !!patched && finalState.clips.some((clip) => clip.id === patched.clipId),
        patchRole: patched && finalState.assets.find((asset) => asset.id === patched.assetId)?.audioStemRole,
        sourceAndStemsMutedAfterPatch: !!patched && [sourceClip.id, ...stems.stemClipIds].every((id) => finalState.clips.find((clip) => clip.id === id)?.volume === 0),
        tailProgress: updates.slice(-4),
      }
    } finally {
      window.Worker = NativeWorker
    }
  }, { dataUrl, duration })

  console.log(`Four stems: ${result.stemRoles.join(', ')} · ${result.stemDurations.map((d) => d.toFixed(2)).join('/')} s`)
  console.log(`Vocal ranges: ${result.intervals.map((r) => `${r.start.toFixed(2)}–${r.end.toFixed(2)}s`).join(', ') || 'none'}`)
  assert.deepEqual(result.stemRoles.slice().sort(), ['bass', 'drums', 'other', 'vocals'])
  assert.equal(result.stemClipCount, 4)
  assert.equal(result.trackCount, 4)
  assert.equal(result.speedFactor, 1.25, 'manual slowed-track correction factor is honored')
  assert(result.stemDurations.every((value) => Math.abs(value - duration) < 0.03), 'every speed-restored output stem stays aligned to the source duration')
  assert(result.intervals.every((range) => range.start >= 0 && range.end <= duration + 0.03), 'vocal review ranges map back to source-media time')
  assert(result.sourceMutedAfterSplit, 'original source audio is muted when four synchronized stems are added')
  assert(result.sourceStillSelected, 'source clip remains selected after separation')
  assert(result.intervals.length > 0, 'voice fixture produces at least one reviewed vocal range')
  assert(result.patchedClipExists && result.patchRole === 'patched-mix', 'patch action creates a synchronized patched-mix asset')
  assert(result.sourceAndStemsMutedAfterPatch, 'patch mix is active without doubling the source or the four stems')
  assert.equal(pageErrors.length, 0, `no uncaught page errors: ${pageErrors.join('; ')}`)
  console.log('[PASS] Four-stem timeline/VAD/patch workflow passed with mocked inference output; this does not score separation quality.')
} finally {
  await browser.close()
}
