import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error(`PAGEERROR ${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') console.error(`CONSOLE ${message.text()}`) })
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.getByTestId('panel-all-import-input').setInputFiles(path.join(root, 'qa/fixtures/pexels-cinematic-8s.webm'))
  await page.waitForFunction(() => {
    const state = window.__omniframe_store.getState()
    return state.assets.some((asset) => asset.kind === 'video') && state.monitorMode === 'source'
  })
  const result = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const state = store.getState()
    const asset = state.assets.find((item) => item.kind === 'video')
    const track = state.ensureTrack('video')
    state.addClipToTrack(track, asset.id, 0)
    store.setState({ playhead: 0.5 })
    store.getState().addTextTitleClip('SUN ABC', 3)
    const title = store.getState().clips.find((clip) => clip.kind === 'text')
    const cropped = await window.omniMCP.call('text_crop_video', { clipId: title.id, assetId: asset.id, invert: true, contrast: 1.3, saturation: 1.4, baseAlpha: 0.04, blendMode: 'screen' })
    if (!cropped.ok) throw new Error(cropped.error)
    store.getState().setMonitorMode('program')
    store.setState({ playing: false })
    store.getState().setPlayhead(0.8)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const a = await window.omniMCP.call('snapshot', {})
    if (!a.ok) throw new Error(`snapshot A: ${a.error}; monitor=${store.getState().monitorMode}; viewport=${Boolean(document.querySelector('[data-testid="preview-viewport"]'))}; stage=${Boolean(document.querySelector('[data-testid="preview-stage"]'))}`)
    store.getState().togglePlay()
    await new Promise((resolve) => setTimeout(resolve, 900))
    if (store.getState().playing) store.getState().togglePlay()
    await new Promise((resolve) => setTimeout(resolve, 150))
    const b = await window.omniMCP.call('snapshot', {})
    if (!b.ok) throw new Error(`snapshot B: ${b.error}`)
    return { clip: store.getState().clips.find((clip) => clip.id === title.id), a: a.out?.['data:img'], b: b.out?.['data:img'] }
  })
  assert.equal(result.clip.textStyle.insideInvert, true)
  assert.equal(result.clip.blendMode, 'screen')
  assert.ok(result.a?.startsWith('data:image/png;base64,'))
  assert.ok(result.a !== result.b, 'the real video inside the text should move during program playback')
  await page.getByTestId('section-tab-text-&-title').click()
  assert.equal(await page.getByTestId('text-video-fill-controls').isVisible(), true)
  assert.equal(await page.getByTestId('text-video-fill-negative').isChecked(), true)
  console.log('PASS live app video-inside-text matte, negative processing, Screen blend, and moving preview pixels')
} finally { await browser.close() }
