import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  const result = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const { buildOmniProjectBundle } = await import('/src/lib/omniProject.ts')
    store.getState().newProject()
    const url = URL.createObjectURL(new Blob(['old media']))
    const nestedUrl = URL.createObjectURL(new Blob(['old frame']))
    store.setState({
      assets: [{ id: 'old', name: 'Old', url, kind: 'image', duration: 2, width: 1, height: 1, size: 9,
        imageSequence: { fps: 1, frames: [{ time: 0, url: nestedUrl }] } }],
      omniframeCharacters: [{ id: 'old-object', cutoutUrl: url }],
      activeSelection: { type: 'rectangle', bounds: { x: 0, y: 0, width: 1, height: 1 } },
      cloneSourcePoint: { x: 0, y: 0, sampleDataUrl: url },
      activePaintLayerId: 'old-layer', activeFx: { clipId: 'old', fxId: 'old' },
      sourcePreview: { ...store.getState().sourcePreview, assetId: 'old' },
      projectName: 'Old project', smartPatchStatus: { phase: 'processing', done: 0, total: 2, message: '' },
    })
    store.getState().newProject()
    const clean = store.getState()
    const reset = {
      characters: clean.omniframeCharacters.length, selection: clean.activeSelection,
      donor: clean.cloneSourcePoint, layer: clean.activePaintLayerId, fx: clean.activeFx,
      source: clean.sourcePreview.assetId, name: clean.projectName, patch: clean.smartPatchStatus.phase,
    }
    const revoked = await Promise.all([url, nestedUrl].map(async value => {
      try { await fetch(value); return false } catch { return true }
    }))
    const attachment = URL.createObjectURL(new Blob(['embedded source']))
    const a = await buildOmniProjectBundle({ assets: [{ id: 'embedded', url: attachment }], tracks: [], clips: [] }, 'Older load')
    URL.revokeObjectURL(attachment)
    const b = await buildOmniProjectBundle({ assets: [], tracks: [], clips: [] }, 'Newer load')
    const allocated = []
    const createUrl = URL.createObjectURL
    URL.createObjectURL = blob => { const value = createUrl.call(URL, blob); allocated.push(value); return value }
    let release
    const gate = new Promise(resolve => { release = resolve })
    const delayed = new File([a], 'a.omni')
    delayed.arrayBuffer = async () => { await gate; return a.arrayBuffer() }
    const first = store.getState().loadOmniProject(delayed).catch(error => error.name)
    await store.getState().loadOmniProject(new File([b], 'b.omni'))
    release()
    const firstOutcome = await first
    const latest = store.getState().projectName
    let releaseReset
    const resetGate = new Promise(resolve => { releaseReset = resolve })
    const pending = new File([a], 'pending.omni')
    pending.arrayBuffer = async () => { await resetGate; return a.arrayBuffer() }
    const loading = store.getState().loadOmniProject(pending).catch(error => error.name)
    store.getState().newProject()
    releaseReset()
    const resetOutcome = await loading
    URL.createObjectURL = createUrl
    const rejectedReleased = await Promise.all(allocated.map(async value => {
      try { await fetch(value); return false } catch { return true }
    }))
    const failedGeneration = store.getState().projectGeneration
    let failure = false
    try { await store.getState().loadOmniProject(new File(['broken'], 'bad.omni')) } catch { failure = true }
    const failedSafely = failure && store.getState().projectGeneration === failedGeneration
    const afterReset = store.getState().projectName
    let releaseBroken
    const brokenGate = new Promise(resolve => { releaseBroken = resolve })
    const broken = new File(['broken'], 'old-bad.omni')
    broken.arrayBuffer = async () => { await brokenGate; return new TextEncoder().encode('broken').buffer }
    const obsolete = store.getState().loadOmniProject(broken).catch(error => error.name)
    await store.getState().loadOmniProject(new File([b], 'newer.omni'))
    releaseBroken()
    const obsoleteError = await obsolete
    return { reset, revoked, latest, firstOutcome, afterReset, resetOutcome,
      rejectedReleased, failedSafely, obsoleteError }
  })
  assert.deepEqual(result.reset, { characters: 0, selection: null, donor: null, layer: 'default-paint-layer', fx: null,
    source: null, name: 'Untitled', patch: 'idle' }, 'New Project clears project-owned selections and overlays')
  assert.deepEqual(result.revoked, [true, true], 'old media and nested frame URLs are released')
  assert.equal(result.latest, 'Newer load', 'an older asynchronous load cannot replace a newer project')
  assert.equal(result.firstOutcome, 'AbortError')
  assert.equal(result.afterReset, 'Untitled', 'New Project cancels pending project opens')
  assert.equal(result.resetOutcome, 'AbortError')
  assert.deepEqual(result.rejectedReleased, [true, true], 'discarded parsed projects release their newly allocated attachments')
  assert.equal(result.failedSafely, true, 'invalid projects leave the active project intact')
  assert.equal(result.obsoleteError, 'AbortError', 'a stale load error must not overwrite the newer success message')

  // Reopen a different image with the same asset/clip IDs: inspect actual Program pixels.
  for (const color of ['#ff0000', '#0000ff']) {
    await page.evaluate(async fill => {
      const store = window.__omniframe_store
      const { buildOmniProjectBundle } = await import('/src/lib/omniProject.ts')
      const canvas = document.createElement('canvas')
      canvas.width = 128; canvas.height = 72
      const ctx = canvas.getContext('2d'); ctx.fillStyle = fill; ctx.fillRect(0, 0, 128, 72)
      const url = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve)))
      const bundle = await buildOmniProjectBundle({
        assets: [{ id: 'reused-asset', name: 'Color', kind: 'image', url, width: 128, height: 72, duration: 2, size: 100 }],
        tracks: [{ id: 'track', type: 'video', name: 'Video', height: 64, gapless: false, hidden: false, muted: false, locked: false }],
        clips: [{ id: 'reused-clip', assetId: 'reused-asset', trackId: 'track', name: 'Color', volume: 1, hidden: false, kind: 'image', start: 0, inPoint: 0, duration: 2,
          transform: { x: 0, y: 0, scale: 1, opacity: 1, rotation: 0 } }],
      }, fill)
      URL.revokeObjectURL(url)
      await store.getState().loadOmniProject(new File([bundle], 'color.omni'))
    }, color)
    await page.waitForFunction(fill => {
      const canvas = document.querySelector('[data-testid="program-preview-canvas"]')
      const pixel = canvas?.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
      return pixel && (fill === '#ff0000' ? pixel[0] > 245 && pixel[2] < 10 : pixel[2] > 245 && pixel[0] < 10)
    }, color, { timeout: 8000 }).catch(async error => {
      console.error('Preview diagnostic', color, errors, await page.evaluate(() => {
        const state = window.__omniframe_store.getState()
        const canvas = document.querySelector('[data-testid="program-preview-canvas"]')
        return { clips: state.clips, tracks: state.tracks, width: canvas?.width, height: canvas?.height,
          pixel: canvas ? [...canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data] : null }
      }))
      await page.screenshot({ path: '/tmp/omniframe-project-lifecycle-failure.png' })
      throw error
    })
  }
  const cleanup = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const asset = { id: 'movie', kind: 'video', name: 'Movie', url: '/qa/fixtures/pexels-cinematic-8s.webm', duration: 8, width: 640, height: 360, size: 100, fps: 24 }
    const mediaElements = () => [...document.querySelectorAll('video[src],audio[src]')]
      .filter(element => element.getAttribute('src') === asset.url)
    store.getState().addAsset(asset)
    const track = store.getState().createTrack('video')
    store.getState().addClipToTrack(track, asset.id, 0)
    const deadline = performance.now() + 5000
    while (!mediaElements().length && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    const oldElements = mediaElements()
    store.getState().newProject()
    return { count: oldElements.length, cached: mediaElements().length,
      released: oldElements.every(element => !element.isConnected && element.getAttribute('src') === null && element.paused) }
  })
  assert.deepEqual(errors, [])
  assert(cleanup.count > 0, 'test must decode media before resetting')
  assert.equal(cleanup.cached, 0)
  assert.equal(cleanup.released, true, 'New Project detaches and releases previous preview decoders')
  console.log('PASS project reset, nested/abandoned URL release, overlapping loads, failure safety, reused-ID Program pixels and decoder cleanup')
} finally { await browser.close() }
