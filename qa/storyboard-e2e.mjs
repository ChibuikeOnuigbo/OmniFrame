// Storyboard panel: shot cards in timeline order, per-shot notes saved on
// clips, click-to-jump selection/playhead, compound open-through.
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'

const ROOT = '/home/user/OmniFrame'
const OUT = join(ROOT, 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })

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
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 160)))
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1300)

// Seed three shots (image, text-less video-kind image, compound of two)
const seed = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], selectedClipId: null, playhead: 0 })
  const s = store.getState()
  const mk = (color) => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    const g = c.getContext('2d')
    g.fillStyle = color
    g.fillRect(0, 0, 320, 180)
    return c.toDataURL('image/png')
  }
  s.addAsset({ id: 'sb-a', name: 'opening.png', kind: 'image', url: mk('#1d4ed8'), width: 320, height: 180 })
  s.addAsset({ id: 'sb-b', name: 'chase.png', kind: 'image', url: mk('#b91c1c'), width: 320, height: 180 })
  s.addAsset({ id: 'sb-c', name: 'finale.png', kind: 'image', url: mk('#15803d'), width: 320, height: 180 })
  const trk = s.ensureTrack('video')
  s.addClipToTrack(trk, 'sb-a', 0)
  s.addClipToTrack(trk, 'sb-b', 5)
  s.addClipToTrack(trk, 'sb-c', 10)
  const st = store.getState()
  const [a, b, c] = ['sb-a', 'sb-b', 'sb-c'].map((id) => st.clips.find((cl) => cl.assetId === id))
  const compoundId = st.createCompoundClip([b.id, c.id], 'Chase + Finale')
  return { aId: a.id, compoundId }
})
assert(seed.aId && seed.compoundId, 'seeded shots incl. compound', JSON.stringify(seed))

// Open the Storyboard tab
await page.getByTestId('left-tab-storyboard').click()
await page.getByTestId('storyboard-panel').waitFor({ state: 'visible' })
await page.waitForTimeout(400)

const summary = await page.getByTestId('storyboard-summary').innerText()
assert(summary.includes('2 shots'), 'summary counts shots after compounding', summary)

const cards = await page.locator('[data-testid^="storyboard-card-"]').count()
assert(cards === 2, 'one card per shot', `${cards} cards`)

// Order: opening (S1) before compound (S2)
const order = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[data-testid^="storyboard-card-"]')]
  return els.map((el) => el.textContent.slice(0, 40))
})
assert(order[0].includes('S1') && order[1].includes('S2'), 'cards in timeline order', order.join(' | '))

// Note round-trip: type into the first card's note -> stored on the clip
await page.getByTestId(`storyboard-note-${seed.aId}`).fill('Open wide — establish the city at dawn.')
await page.waitForTimeout(250)
const note = await page.evaluate((id) => window.__omniframe_store.getState().clips.find((c) => c.id === id)?.notes, seed.aId)
assert(note === 'Open wide — establish the city at dawn.', 'note saved on the clip', note)

// Click the compound card -> selects it and moves playhead to its start (5s)
await page.locator(`[data-testid="storyboard-card-${seed.compoundId}"] > button`).first().click()
await page.waitForTimeout(300)
const sel = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { selected: s.selectedClipId, playhead: s.playhead }
})
assert(sel.selected === seed.compoundId && Math.abs(sel.playhead - 5) < 0.05, 'card click selects shot + jumps playhead', JSON.stringify(sel))

// Compound card can open its nested sequence
await page.getByTestId(`storyboard-open-${seed.compoundId}`).click()
await page.waitForTimeout(400)
const inside = await page.evaluate(() => window.__omniframe_store.getState().activeSequenceId)
assert(inside !== 'main', 'open nested sequence from storyboard', inside)
await page.evaluate(() => window.__omniframe_store.getState().openSequence('main'))
await page.waitForTimeout(300)

await page.screenshot({ path: join(OUT, '10-storyboard.png') })
console.log('SCREENSHOT 10-storyboard.png')

await browser.close()
console.log('STORYBOARD SUITE PASSED')
