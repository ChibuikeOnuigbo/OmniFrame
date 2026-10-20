/**
 * Exports one VETTING VIDEO pack per text preset into testing_asset_etc/:
 * preview.webm (raw canvas capture) + 3 stills + spec.json with sound cues.
 * qa/encode-vetting-mp4s.py then produces preview.mp4 with the cue track.
 * Run: LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/export-text-preset-videos.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(process.cwd(), 'testing_asset_etc')
mkdirSync(ROOT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.locator('[data-testid="left-tab-text"]').click()
await page.waitForTimeout(500)
const presets = await page.evaluate(() => window.__omniframe_text_presets)
if (!presets?.length) { console.error('no presets exposed'); process.exit(1) }

const cuesFor = (p) => {
  const cues = [
    { t: 0.03, kind: 'whoosh', label: 'whoosh-in' },
    { t: 0.9, kind: 'pop', label: 'settle-pop' },
    { t: 2.35, kind: 'ding', label: 'out-ding' },
  ]
  if (/Glitch/.test(p.category)) cues.splice(1, 0, { t: 0.32, kind: 'tick', label: 'glitch-tick' }, { t: 0.78, kind: 'tick', label: 'glitch-tick' })
  return cues
}

for (const p of presets) {
  const dir = join(ROOT, p.id)
  mkdirSync(dir, { recursive: true })
  const clipCount = await page.evaluate(({ id, demo }) => {
    const store = window.__omniframe_store
    store.setState({ clips: [], tracks: [], transitions: [], playhead: 0, playing: false, duration: 8 })
    const s = store.getState()
    const t = s.createTrack('video')
    const c = document.createElement('canvas'); c.width = 640; c.height = 360
    const g = c.getContext('2d'); g.fillStyle = 'rgb(14,16,24)'; g.fillRect(0, 0, 640, 360)
    s.addAsset({ id: 'vet-bg', name: 'bg.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
    s.addClipToTrack(t, 'vet-bg', 0)
    return window.__omniframe_build_text_preset(id, demo).length
  }, p)

  // stills (quick vetting thumbnails alongside the video)
  for (const [label, t] of [['frame-1-early', 0.12], ['frame-2-mid', 0.55], ['frame-3-settled', 1.8]]) {
    await page.evaluate((tt) => window.__omniframe_store.getState().setPlayhead(tt), t)
    await page.waitForTimeout(260)
    writeFileSync(join(dir, `${label}.png`), await page.locator('[data-testid="preview-stage"]').screenshot())
  }

  // video: play the timeline and capture the canvas stream
  const b64 = await page.evaluate(async () => {
    const store = window.__omniframe_store
    const canvas = document.querySelector('#of-canvas')
    const stream = canvas.captureStream(30)
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || ''
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined)
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const done = new Promise((r) => { rec.onstop = r })
    store.getState().setPlayhead(0)
    rec.start(250)
    store.setState({ playing: true })
    await new Promise((r) => setTimeout(r, 2800))
    store.setState({ playing: false })
    rec.stop()
    await done
    const blob = new Blob(chunks, { type: 'video/webm' })
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768))
    return btoa(bin)
  })
  writeFileSync(join(dir, 'preview.webm'), Buffer.from(b64, 'base64'))

  // Typewriter packs also export the fixed-at-end cursor mode.
  if (p.id.startsWith('typewriter-')) {
    await page.evaluate(({ id, demo }) => {
      const store = window.__omniframe_store
      store.setState({ clips: [], tracks: [], transitions: [], playhead: 0, playing: false, duration: 8 })
      const st = store.getState()
      const t = st.createTrack('video')
      st.addClipToTrack(t, 'vet-bg', 0)
      window.__omniframe_build_text_preset(id, demo, { seed: 7, typewriterCursor: 'end' })
    }, p)
    const b64end = await page.evaluate(async () => {
      const store = window.__omniframe_store
      const canvas = document.querySelector('#of-canvas')
      const stream = canvas.captureStream(30)
      const mime = ['video/webm;codecs=vp9', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined)
      const chunks = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      const done = new Promise((r) => { rec.onstop = r })
      store.getState().setPlayhead(0)
      rec.start(250)
      store.setState({ playing: true })
      await new Promise((r) => setTimeout(r, 2800))
      store.setState({ playing: false })
      rec.stop()
      await done
      const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768))
      return btoa(bin)
    })
    writeFileSync(join(dir, 'preview-end-mode.webm'), Buffer.from(b64end, 'base64'))
    console.log(`  + end-mode video for ${p.id}`)
  }

  const cues = cuesFor(p)
  writeFileSync(join(dir, 'spec.json'), JSON.stringify({ preset: p.id, name: p.name, category: p.category, source: p.source, idealCharacters: p.ideal, demoText: p.demo, clipsBuilt: clipCount, video: 'preview.mp4 (with sound cues) · preview.webm (raw)', cursorModes: p.id.startsWith('typewriter-') ? 'preview.mp4 = cursor follows each letter (1_ 12_ 123_); preview-end-mode.mp4 = cursor fixed at end' : undefined, soundCues: cues, frames: ['frame-1-early.png @ 0.12s', 'frame-2-mid.png @ 0.55s', 'frame-3-settled.png @ 1.8s'], recreate: 'Open OmniFrame → Text panel → Text Preset Library, type the demo text, click the preset.' }, null, 2))
  console.log(`exported ${p.id} (${clipCount} clips, webm ${(Buffer.from(b64, 'base64').length / 1024).toFixed(0)}KB)`)
}
console.log('WEBM DONE — now run: python3 qa/encode-vetting-mp4s.py')
await browser.close()
