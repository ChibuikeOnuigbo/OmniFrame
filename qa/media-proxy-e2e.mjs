import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
const root = new URL('..', import.meta.url).pathname
const out = join(root, 'qa-output/performance-20261031')
mkdirSync(out, { recursive: true })
const require = createRequire(import.meta.url)
const generated = spawnSync(require('@ffmpeg-installer/ffmpeg').path, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=24:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libvpx', '-threads', '2', '-b:v', '2M', '-c:a', 'libvorbis', '-shortest', join(out, 'proxy-source.webm')], { stdio: 'inherit' })
assert.equal(generated.status, 0)
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []; page.on('pageerror', e => errors.push(String(e)))
  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const s = window.__omniframe_store.getState()
    s.addAsset({ id: 'proxy-source', kind: 'video', name: 'Proxy test', url: '/qa-output/performance-20261031/proxy-source.webm', width: 1920, height: 1080, duration: 2, size: 100 })
    s.addClipToTrack(s.ensureTrack('video'), 'proxy-source', 0)
    window.proxies = await import('/src/lib/mediaProxies.ts')
  })
  await page.getByTestId('settings-button').click()
  await page.locator('[data-category-id="playback"]').click()
  await page.getByRole('combobox', { name: 'Proxy source video' }).selectOption('proxy-source')
  await page.getByRole('button', { name: 'Prepare proxy', exact: true }).click()
  await page.waitForFunction(() => !!window.proxies.useMediaProxies.getState().entries['proxy-source'] || !!window.proxies.useMediaProxies.getState().error, { }, { timeout: 30000 }).catch(async error => { console.log(await page.evaluate(() => window.proxies.useMediaProxies.getState())); throw error })
  assert.equal(await page.evaluate(() => window.proxies.useMediaProxies.getState().error), '')
  const proxy = await page.evaluate(() => window.proxies.useMediaProxies.getState().entries['proxy-source'])
  assert.deepEqual([proxy.width, proxy.height], [854, 480])
  assert.ok(proxy.bytes > 1000)
  await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.evaluate(() => { window.__omniframe_store.getState().setPlayhead(.5); window.__omniframe_store.getState().play() })
  await page.waitForTimeout(400)
  const active = await page.evaluate(() => [...document.querySelectorAll('video,audio')].filter(v => !v.paused).map(v => ({ kind: v.tagName, src: v.getAttribute('src'), muted: v.muted, width: v.videoWidth, time: v.currentTime })))
  assert.ok(active.some(v => v.kind === 'VIDEO' && v.src === proxy.url && v.muted && v.width === 854), JSON.stringify(active))
  assert.ok(active.some(v => v.kind === 'AUDIO' && v.src === proxy.source && !v.muted && v.time > .5), JSON.stringify(active))
  await page.evaluate(() => { const s = window.__omniframe_store.getState(); s.pause(); s.setPreviewQuality('high'); s.setPlayhead(.3) })
  // Exercise the actual export path, not only proxy URL selection.
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.getByTestId('export-video-btn').click()
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some(v => v.getAttribute('src') === '/qa-output/performance-20261031/proxy-source.webm' && v.videoWidth === 1920))
  const download = await downloadPromise
  await download.saveAs(join(out, 'proxy-export.mp4'))
  await page.waitForFunction(() => window.__omniframe_store.getState().previewQuality === 'high')
  await page.evaluate(async () => {
    const p = window.proxies
    const asset = window.__omniframe_store.getState().assets.find(a => a.id === 'proxy-source')
    const pending = p.generateProxy({ ...asset, id: 'cancel-test' })
    p.cancelProxy(); await pending
  })
  assert.equal(await page.evaluate(() => window.proxies.useMediaProxies.getState().active), null)
  assert.equal(await page.evaluate(() => !!window.proxies.useMediaProxies.getState().entries['cancel-test']), false)
  assert.deepEqual(errors, [])
  writeFileSync(join(out, 'proxy-report.json'), JSON.stringify({ dimensions: [proxy.width, proxy.height], bytes: proxy.bytes, active, originalExport: true, cancellation: true, errors }, null, 2))
  console.log('PASS real proxy preparation, reduced video decode, original audio, full-source export and cancellation')
} finally { await browser.close() }
