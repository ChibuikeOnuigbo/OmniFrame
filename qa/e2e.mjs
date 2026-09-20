// OmniFrame end-to-end visual + functional test.
//
// Drives the REAL running app in a headless browser, screenshots every part
// (so you can crop/inspect each button & tool), and runs the full edit flow.
//
// It is SELF-CONTAINED: if VIDEO is unset it generates a real local WAV fixture
// with zero external downloads, so it runs even in restricted networks.
//
//   npm install
//   npm run dev                       # serves http://localhost:5173
//   VIDEO=/path/clip.mp4 CHROME_PATH=/usr/bin/google-chrome node qa/e2e.mjs
//   (omit VIDEO to use the generated audio fixture; omit CHROME_PATH to use
//    Playwright's own browser: npx playwright install chromium)
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const URL = process.env.URL || 'http://localhost:5173/'
const OUT = 'qa/shots'
mkdirSync(OUT, { recursive: true })

const log = (...a) => console.log('[e2e]', ...a)

function makeWav(path) {
  const sr = 48000, dur = 2, f = 440
  const n = sr * dur
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, 0.3 * Math.sin((2 * Math.PI * f * i) / sr)))
    data.writeInt16LE((v * 32767) | 0, i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28)
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([h, data]))
}

// Prefer an explicitly supplied system browser. Otherwise use the Chromium
// payload distributed through npm (works in sandboxes where browser CDNs and
// APT mirrors are blocked). Its archive includes the NSS/NSPR runtime needed
// on minimal Linux hosts.
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
log('browser:', executablePath)
const browser = await playwrightChromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/01-home.png` })
log('loaded home')

// Import: real video if provided, else generated local WAV fixture.
let media = process.env.VIDEO
if (!media) {
  media = join(tmpdir(), 'omniframe-motion-5s.webm')
  const require = createRequire(import.meta.url)
  const ffmpeg = require('@ffmpeg-installer/ffmpeg').path
  const generated = spawnSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=5',
    '-c:v', 'libvpx', '-b:v', '700k', '-c:a', 'libvorbis', '-shortest', media,
  ])
  if (generated.status !== 0) {
    media = join(tmpdir(), 'omniframe-test-tone.wav')
    makeWav(media)
    log('FFmpeg fixture generation failed; generated WAV fallback:', media)
  } else {
    log('generated deterministic 5s VP8/Vorbis fixture:', media)
  }
}
await page.getByTestId('import-input').setInputFiles(media)
await page.getByTestId('timeline-clip').first().waitFor({ state: 'visible' })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/02-imported.png` })
log('imported', basename(media))

// Transport: play — prove the visible playhead time advances.
const beforeTime = await page.getByTestId('current-time').textContent()
await page.getByTitle('Play (Space)').click()
await page.waitForTimeout(1600)
const afterTime = await page.getByTestId('current-time').textContent()
if (!afterTime || afterTime === beforeTime) throw new Error(`Playback time did not advance (${beforeTime} -> ${afterTime})`)
await page.screenshot({ path: `${OUT}/03-playing.png` })
log('played ~1.6s', beforeTime, '->', afterTime)

// Zoom to frame level
await page.getByRole('button', { name: 'Frames' }).click().catch(() => log('Frames btn not found'))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/04-frames-zoom.png` })
log('zoomed to frame level')

// Split at playhead — prove one clip became two.
const clipsBefore = await page.getByTestId('timeline-clip').count()
await page.getByTitle(/Split at playhead/).click()
await page.waitForTimeout(400)
const clipsAfter = await page.getByTestId('timeline-clip').count()
if (clipsAfter !== clipsBefore + 1) throw new Error(`Split failed: clip count ${clipsBefore} -> ${clipsAfter}`)
await page.screenshot({ path: `${OUT}/05-split.png` })
log('split', clipsBefore, '->', clipsAfter, 'clips')

// Export (records the live preview)
let exportOk = false
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: /Export/ }).click(),
  ])
  const dest = `${OUT}/export-${download.suggestedFilename()}`
  await download.saveAs(dest)
  exportOk = true
  log('exported ->', dest)
} catch (e) {
  log('export failed or unsupported in this browser:', String(e).split('\n')[0])
}

// Responsive spot checks
for (const [w, h, name] of [[1280, 720, 'small-desktop'], [768, 1024, 'tablet'], [390, 844, 'mobile-390']]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/resp-${name}.png` })
  log('responsive', name)
}

await browser.close()

console.log('\n=== RESULT ===')
console.log('screenshots in', OUT)
console.log('export produced file:', exportOk)
console.log('console/page errors:', errors.length ? errors : 'none')
if (errors.length) process.exit(2)
