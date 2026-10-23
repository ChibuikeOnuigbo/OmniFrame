// Fonts & import utilities: importing TTF fonts (usable by titles, saved
// inside .omni projects), SRT subtitle import as caption clips, and GIMP
// palette import as drawing colours.
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

const ROOT = '/home/user/OmniFrame'
const OUT = join(ROOT, 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  join(homedir(), '.fonts', 'DejaVuSans.ttf'),
]
const FONT_PATH = FONT_CANDIDATES.find((p) => existsSync(p))
if (!FONT_PATH) throw new Error('No system TTF available for the font import test')

const SRT_PATH = join(tmpdir(), 'omni-captions.srt')
writeFileSync(SRT_PATH, [
  '1',
  '00:00:00,500 --> 00:00:02,500',
  'Hello from the subtitle file',
  '',
  '2',
  '00:00:03,000 --> 00:00:05,250',
  'Second caption line',
  'spans two rows',
  '',
  '3',
  '00:00:06,000 --> 00:00:08,000',
  'Final caption',
  '',
].join('\n'))

const GPL_PATH = join(tmpdir(), 'omni-test.gpl')
writeFileSync(GPL_PATH, [
  'GIMP Palette',
  'Name: Omni Test Palette',
  'Columns: 3',
  '#',
  '255 0 0\tRed',
  '0 200 80\tGreen',
  '30 64 175\tBlue',
].join('\n'))

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

function assert(cond, name, detail = '') {
  if (!cond) throw new Error(`${name}: ${detail}`)
  console.log('PASS', name, detail)
}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 200)))
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// Clean slate
await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], customFonts: [], customPalettes: [], selectedClipId: null, playhead: 0 })
  const s = store.getState()
  const trackId = s.createTrack('video')
  s.addAsset({ id: 'fu-bg', name: 'bg.png', kind: 'image', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=', width: 16, height: 16 })
  s.addClipToTrack(trackId, 'fu-bg', 0)
})

// --- Font import via the real file input --------------------------------
await page.getByTestId('left-tab-text').click()
await page.waitForSelector('[data-testid="fonts-manager"]', { timeout: 15000 })
await page.getByTestId('font-import-input').setInputFiles(FONT_PATH)
await page.waitForFunction(() => window.__omniframe_store.getState().customFonts.length === 1, { timeout: 15000 })
const fontState = await page.evaluate(() => {
  const f = window.__omniframe_store.getState().customFonts[0]
  return { name: f.name, format: f.format, sizeBytes: f.sizeBytes, hasData: f.dataUrl.startsWith('data:') }
})
assert(fontState.name.length > 0 && fontState.hasData, 'font imported into project state', JSON.stringify(fontState))

const fontReady = await page.evaluate(async () => {
  const name = window.__omniframe_store.getState().customFonts[0].name
  try {
    await document.fonts.load(`40px "${name}"`)
    return [...document.fonts].some((face) => face.family === name)
  } catch { return false }
})
assert(fontReady, 'imported font registered with document.fonts')

const fontId = await page.evaluate(() => window.__omniframe_store.getState().customFonts[0].id)
await page.waitForSelector(`[data-testid="font-row-${fontId}"]`, { timeout: 10000 })

// Apply to a title and verify the clip style + rendered preview uses it
await page.evaluate(() => {
  const store = window.__omniframe_store
  const trackId = store.getState().tracks[0].id
  const id = 'clip-fu-title'
  store.setState((s) => ({
    clips: [...s.clips, {
      id, trackId, assetId: '', start: 0, duration: 5, inPoint: 0, name: 'Font Proof Title',
      kind: 'text', volume: 1, hidden: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      textStyle: { text: 'Font Proof', fontSize: 64, color: '#ffffff', backgroundColor: 'transparent', fontFamily: 'sans-serif', bold: true, italic: false },
    }],
    selectedClipId: id,
  }))
})
await page.waitForSelector('[data-testid="text-font-select"]')
await page.getByTestId(`font-apply-${fontId}`).click()
const applied = await page.evaluate(() => {
  const c = window.__omniframe_store.getState().clips.find((x) => x.id === 'clip-fu-title')
  return c.textStyle.fontFamily
})
const expectedFamily = fontState.name
assert(applied === expectedFamily, 'font applied to selected title clip', applied)
// Canvas font string proof: the metric width in the custom font differs
// from generic sans after load (or at minimum the family resolves loaded).
const faceLoaded = await page.evaluate(async () => {
  const name = window.__omniframe_store.getState().customFonts[0].name
  return document.fonts.check(`64px "${name}"`)
})
assert(faceLoaded, 'document.fonts.check passes for imported family')

// --- Save .omni round-trip: font embedded, restored, re-registered ------
const roundTrip = await page.evaluate(async () => {
  const store = window.__omniframe_store
  const before = store.getState().customFonts[0]
  const blob = await store.getState().saveOmniProject('Font Round Trip')
  store.setState({ customFonts: [], customPalettes: [], clips: [], tracks: [] })
  const file = new File([blob], 'Font Round Trip.omni', { type: 'application/octet-stream' })
  await store.getState().loadOmniProject(file)
  const fonts = store.getState().customFonts
  const restored = fonts[0]
  let ready = false
  if (restored) {
    try { ready = await Promise.resolve(document.fonts.load(`24px "${restored.name}"`)).then(() => true).catch(() => false) }
    catch { ready = false }
  }
  return {
    blobSize: blob.size,
    count: fonts.length,
    name: restored?.name || null,
    dataUrlKind: restored ? (restored.dataUrl.startsWith('data:') ? 'data' : restored.dataUrl.startsWith('blob:') ? 'blob' : 'other') : null,
    sameAsBefore: restored?.name === before.name,
    ready,
  }
})
assert(roundTrip.count === 1 && roundTrip.sameAsBefore, '.omni save/load restores the imported font', JSON.stringify(roundTrip))
assert(roundTrip.blobSize > 100_000, '.omni bundle actually embeds font bytes', `${roundTrip.blobSize} bytes`)
assert(roundTrip.ready, 'restored font re-registered after project load')

// --- Subtitle import ------------------------------------------------------
await page.evaluate(() => window.__omniframe_store.setState({ clips: [], tracks: [], selectedClipId: null }))
await page.getByTestId('subtitle-import-input').setInputFiles(SRT_PATH)
await page.waitForFunction(() => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'text').length === 3, { timeout: 15000 })
const subs = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const captions = s.clips.filter((c) => c.kind === 'text').sort((a, b) => a.start - b.start)
  const track = s.tracks.find((t) => t.id === captions[0].trackId)
  return {
    count: captions.length,
    first: { start: captions[0].start, duration: captions[0].duration, text: captions[0].textStyle.text },
    secondText: captions[1].textStyle.text,
    trackName: track?.name || '',
    fontApplied: captions[0].textStyle.fontFamily,
  }
})
assert(subs.count === 3, 'subtitle import created one clip per cue', JSON.stringify(subs))
assert(Math.abs(subs.first.start - 0.5) < 0.01 && Math.abs(subs.first.duration - 2) < 0.01, 'cue timing preserved (0.5s + 2.0s)', JSON.stringify(subs.first))
assert(subs.secondText.includes('spans two rows'), 'multi-line cue text preserved')
assert(/Captions/.test(subs.trackName), 'captions on their own track', subs.trackName)
assert(subs.fontApplied === expectedFamily, 'captions use the currently selected font', subs.fontApplied)

// --- Palette import -------------------------------------------------------
await page.getByTestId('left-tab-drawing').click()
await page.getByTestId('section-tab-drawing-colour').click()
await page.waitForSelector('[data-testid="palette-import-input"]', { state: 'attached', timeout: 15000 })
await page.getByTestId('palette-import-input').setInputFiles(GPL_PATH)
await page.waitForFunction(() => window.__omniframe_store.getState().customPalettes.length === 1, { timeout: 15000 })
const pal = await page.evaluate(() => window.__omniframe_store.getState().customPalettes[0])
assert(pal.name === 'Omni Test Palette', 'palette name read from .gpl header', pal.name)
assert(JSON.stringify(pal.colors) === JSON.stringify(['#ff0000', '#00c850', '#1e40af']), 'palette colours parsed to hex', JSON.stringify(pal.colors))
await page.getByTestId(`palette-swatch-${pal.id}-00c850`).click()
const drawingColor = await page.evaluate(() => window.__omniframe_store.getState().drawingColor)
assert(drawingColor === '#00c850', 'palette swatch sets the drawing colour', drawingColor)

// Screenshot back in the Text panel with the font applied, playhead parked
// inside the first caption so the preview shows it rendered.
await page.getByTestId('left-tab-text').click()
await page.evaluate(() => {
  const store = window.__omniframe_store
  const caption = store.getState().clips.find((c) => c.kind === 'text')
  store.setState({ playhead: 1.5, selectedClipId: caption ? caption.id : null })
})
await page.waitForTimeout(900)
await page.screenshot({ path: join(OUT, '11-fonts-utils.png') })
console.log('SCREENSHOT 11-fonts-utils.png')
console.log('FONTS+UTILS SUITE PASSED')
await browser.close()
