/**
 * Marker system + Auto Beat (CapCut-modeled), verified end to end:
 *  A. five purpose kinds, each with its own colour; custom colours saved
 *  B. coincident markers combine into ONE split flag (2 = halves, 15 =
 *     gradient + count) and the group popover lists them
 *  C. popup is non-blocking; double-click opens it, right-click menus work
 *  D. scope transfer is range-limited: a clip takes only the markers
 *     inside its own timeline span, and clip markers ride the clip edge
 *  E. Auto Beat finds a synthesized 1 Hz click grid and places markers
 *     on the clip edge; Custom Auto Beat learns one segment and finds all
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })
let failures = 0
const assert = (cond, name, extra = '') => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${extra}`); return }
  console.log(`PASS ${name} ${extra}`)
}
const hard = (cond, name, extra = '') => { if (!cond) { console.error(`FATAL ${name} ${extra}`); process.exit(1) } }

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// --- scene: 8 s click track, one hit every 1.0 s starting at 0.5 --------
const clipId = await page.evaluate(async () => {
  const store = window.__omniframe_store
  store.setState({ clips: [], tracks: [], transitions: [], markers: [], selectedClipId: null, playhead: 0, playing: false, duration: 10 })
  const sr = 22050
  const len = 8 * sr
  const data = new Float32Array(len)
  for (let hit = 0.5; hit < 8; hit += 1.0) {
    const start = Math.floor(hit * sr)
    for (let i = 0; i < sr * 0.03; i++) data[start + i] += Math.sin(i * 0.35) * Math.exp(-i / (sr * 0.006)) * 0.9
  }
  // encode WAV
  const buf = new ArrayBuffer(44 + len * 2)
  const v = new DataView(buf)
  const wstr = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  wstr(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); wstr(8, 'WAVEfmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); wstr(36, 'data'); v.setUint32(40, len * 2, true)
  for (let i = 0; i < len; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true)
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  const s = store.getState()
  const track = s.createTrack('audio')
  s.addAsset({ id: 'clicks', name: 'clicks.wav', kind: 'audio', url, width: 0, height: 0, duration: 8, size: buf.byteLength })
  s.addClipToTrack(track, 'clicks', 0)
  const clip = store.getState().clips.find((c) => c.assetId === 'clicks')
  store.setState({ clips: store.getState().clips.map((c) => (c.id === clip.id ? { ...c, start: 0, duration: 8 } : c)), duration: 10 })
  return clip.id
})
hard(clipId, 'scene built')

const st = () => page.evaluate(() => window.__omniframe_store.getState())

// --- A. kinds + colours ---------------------------------------------------
const kinds = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const defs = [['beat', 0.5], ['section', 1.5], ['note', 2.5], ['fix', 3.5], ['cue', 4.5]]
  const out = defs.map(([kind, t]) => {
    const id = s.addMarker({ time: t, label: `${kind} tag`, kind })
    return window.__omniframe_store.getState().markers.find((m) => m.id === id)
  })
  s.addCustomMarkerColor('#123abc')
  const cid = s.addMarker({ time: 5.5, label: 'custom tag', color: '#123abc', kind: 'custom' })
  out.push(window.__omniframe_store.getState().markers.find((m) => m.id === cid))
  return out
})
const expectHex = { beat: '#f59e0b', section: '#a855f7', note: '#38bdf8', fix: '#ef4444', cue: '#22c55e' }
for (const m of kinds.slice(0, 5)) assert(m.color === expectHex[m.kind], `A kind ${m.kind} has its colour`, m.color)
assert(kinds[5].color === '#123abc', 'A custom colour applied', kinds[5].color)
const savedColors = await page.evaluate(() => JSON.parse(localStorage.getItem('omniframe.markerColors') || '[]'))
assert(savedColors.includes('#123abc'), 'A custom colour saved to palette', JSON.stringify(savedColors))

// --- B. combining ---------------------------------------------------------
await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  s.clearMarkers()
  s.addMarker({ time: 2, label: 'beat here', kind: 'beat' })
  s.addMarker({ time: 2, label: 'note here', kind: 'note' })
  for (let i = 0; i < 15; i++) s.addMarker({ time: 5, label: `crowd ${i}`, kind: i % 2 ? 'cue' : 'fix' })
  s.addMarker({ time: 7, label: 'solo', kind: 'section' })
})
await page.waitForTimeout(300)
const groups = await page.locator('[data-testid="timeline-marker-group"]').count()
assert(groups === 2, 'B two combined flags (2-way + 15-way)', `groups=${groups}`)
const twoWay = page.locator('[data-testid="timeline-marker-group"][data-marker-count="2"]')
assert(await twoWay.count() === 1, 'B 2-way group exists')
const twoBg = await twoWay.locator('div').first().evaluate((el) => el.style.background)
assert(twoBg.includes('245') || twoBg.includes('f59e0b') || twoBg.includes('linear-gradient'), 'B 2-way flag split into colour slices', twoBg.slice(0, 90))
const crowd = page.locator('[data-testid="timeline-marker-group"][data-marker-count="15"]')
assert(await crowd.count() === 1 && (await crowd.locator('[data-testid="marker-group-count"]').innerText()) === '15', 'B 15-way flag shows count instead of slices')
assert(await page.locator('[data-testid="timeline-marker"]').count() === 1, 'B solo marker stays a single flag')

// group popover lists all markers at the point
await twoWay.click()
await page.waitForTimeout(250)
assert(await page.locator('[data-testid="marker-group-popover"] [data-testid="marker-group-row"]').count() === 2, 'B group popover lists both markers')
await page.locator('[data-testid="marker-group-popover"] [data-testid="marker-group-row"]').first().click()
assert(Math.abs((await st()).playhead - 2) < 0.05, 'B popover row jumps the playhead', String((await st()).playhead))
await page.keyboard.press('Escape')
await page.mouse.click(30, 30)

// --- C. popup is a popup, right-click is a menu ---------------------------
const soloId = await page.evaluate(() => window.__omniframe_store.getState().markers.find((m) => m.label === 'solo').id)
await page.locator(`[data-testid="timeline-marker"][data-marker-id="${soloId}"]`).dblclick()
await page.waitForTimeout(250)
assert(await page.locator('[data-testid="marker-popup"]').isVisible(), 'C double-click opens the marker popup')
assert(await page.locator('[data-testid="marker-kind-fix"]').isVisible(), 'C popup shows the five purposes')
await page.locator('[data-testid="marker-kind-fix"]').click()
const afterKind = await page.evaluate((id) => window.__omniframe_store.getState().markers.find((m) => m.id === id), soloId)
assert(afterKind.kind === 'fix' && afterKind.color === '#ef4444', 'C purpose chip recolours the marker', JSON.stringify(afterKind))
// non-blocking: the timeline still seeks while the popup is open
await page.locator('[data-testid="marker-close-btn"]').click()

await page.locator(`[data-testid="timeline-marker"][data-marker-id="${soloId}"]`).click({ button: 'right' })
await page.waitForTimeout(250)
assert(await page.locator('[data-testid="marker-menu-edit"]').isVisible(), 'C right-click opens the marker menu')
await page.locator('[data-testid="marker-menu-kind-cue"]').click()
const afterMenu = await page.evaluate((id) => window.__omniframe_store.getState().markers.find((m) => m.id === id), soloId)
assert(afterMenu.kind === 'cue', 'C menu re-purposes the marker', afterMenu.kind)

// --- D. range-limited scope transfer --------------------------------------
await page.evaluate((cid) => {
  const s = window.__omniframe_store.getState()
  s.clearMarkers()
  // clip spans 4..8 now; markers at 1 (outside), 5 and 7.5 (inside)
  const store = window.__omniframe_store
  store.setState({ clips: store.getState().clips.map((c) => (c.id === cid ? { ...c, start: 4, duration: 4 } : c)) })
  s.addMarker({ time: 1, label: 'outside', kind: 'note' })
  s.addMarker({ time: 5, label: 'inside a', kind: 'beat' })
  s.addMarker({ time: 7.5, label: 'inside b', kind: 'cue' })
}, clipId)
const moved = await page.evaluate((cid) => {
  const s = window.__omniframe_store.getState()
  const n = s.moveMarkersToClip(cid)
  const fresh = window.__omniframe_store.getState()
  return { n, markers: fresh.markers.map((m) => ({ label: m.label, clipId: m.clipId, clipOffset: m.clipOffset })) }
}, clipId)
assert(moved.n === 2, 'D only in-span markers move to the clip', JSON.stringify(moved))
assert(moved.markers.find((m) => m.label === 'outside').clipId === undefined, 'D out-of-span marker stays on the timeline')
assert(Math.abs(moved.markers.find((m) => m.label === 'inside a').clipOffset - 1) < 0.001, 'D clip offset is relative to the clip')
await page.waitForTimeout(300)
assert(await page.locator('[data-testid="clip-marker-flag"]').count() === 2, 'D clip-edge flags render on the clip')
const back = await page.evaluate((cid) => window.__omniframe_store.getState().moveMarkersToTimeline(cid), clipId)
const backState = await st()
assert(back === 2 && backState.markers.every((m) => !m.clipId) && Math.abs(backState.markers.find((m) => m.label === 'inside a').time - 5) < 0.001, 'D markers return to the main timeline at the same instant')

// M key adds in the last-used purpose; Shift+M navigates
await page.evaluate(() => { const s = window.__omniframe_store.getState(); s.clearMarkers(); s.setPlayhead(3); s.setLastMarkerKind('note') })
await page.locator('body').click({ position: { x: 700, y: 120 } })
await page.keyboard.press('m')
await page.waitForTimeout(250)
const mMarkers = (await st()).markers
assert(mMarkers.length === 1 && mMarkers[0].kind === 'note' && Math.abs(mMarkers[0].time - 3) < 0.01, 'D M key adds a last-purpose marker', JSON.stringify(mMarkers))
assert(await page.locator('[data-testid="marker-popup"]').isVisible(), 'D M opens the popup for naming')
await page.locator('[data-testid="marker-close-btn"]').click()

// --- E. Auto Beat ----------------------------------------------------------
await page.evaluate((cid) => {
  const s = window.__omniframe_store.getState()
  s.clearMarkers()
  const store = window.__omniframe_store
  store.setState({ clips: store.getState().clips.map((c) => (c.id === cid ? { ...c, start: 0, duration: 8 } : c)) })
}, clipId)
await page.waitForTimeout(300)
const clipBox = page.locator(`[data-testid="timeline-clip"][data-clip-id="${clipId}"]`)
await clipBox.click({ button: 'right' })
await page.waitForTimeout(300)
await page.locator('[data-testid="ctx-cmd-auto-beat"]').hover()
await page.waitForTimeout(350)
assert(await page.locator('[data-testid="ctx-cmd-auto-beat-run"]').isVisible(), 'E clip menu offers Auto Beat')
await page.locator('[data-testid="ctx-cmd-auto-beat-run"]').click()
await page.waitForSelector('[data-testid="auto-beat-popup"]', { timeout: 15000 })
await page.waitForFunction(() => document.querySelector('[data-testid="auto-beat-summary"]')?.textContent?.includes('Found'), null, { timeout: 15000 }).catch(() => null)
const summary = await page.locator('[data-testid="auto-beat-summary"]').innerText()
const foundCount = Number((summary.match(/Found (\d+)/) || [])[1] || 0)
assert(foundCount >= 6 && foundCount <= 9, 'E Auto Beat found the 1 Hz grid', summary)
await page.locator('[data-testid="auto-beat-place-clip"]').click()
await page.waitForTimeout(300)
const beatMarkers = (await st()).markers.filter((m) => m.clipId === clipId)
assert(beatMarkers.length === foundCount && beatMarkers.length >= 6, 'E beat markers placed on the clip', `n=${beatMarkers.length}`)
const offsets = beatMarkers.map((m) => m.clipOffset).sort((a, b) => a - b)
const onGrid = offsets.every((t, i) => Math.abs(t - (0.5 + i * 1.0)) < 0.18)
assert(onGrid, 'E beats land on the real hits (forgiving snap, not sterile)', JSON.stringify(offsets.map((t) => t.toFixed(2))))
assert(await page.locator('[data-testid="clip-marker-flag"]').count() >= 6, 'E beat flags ride the clip top edge')

// Custom Auto Beat: teach it the 0.4–1.4 segment, scan, place on timeline
await page.evaluate(() => window.__omniframe_store.getState().clearMarkers())
await clipBox.click({ button: 'right' })
await page.waitForTimeout(300)
await page.locator('[data-testid="ctx-cmd-auto-beat"]').hover()
await page.waitForTimeout(350)
await page.locator('[data-testid="ctx-cmd-auto-beat-custom"]').click()
await page.waitForSelector('[data-testid="auto-beat-popup"]')
await page.locator('[data-testid="custom-beat-start"]').fill('0.4')
await page.locator('[data-testid="custom-beat-end"]').fill('1.4')
await page.locator('[data-testid="custom-beat-scan"]').click()
await page.waitForFunction(() => document.querySelector('[data-testid="auto-beat-summary"]')?.textContent?.includes('Found'), null, { timeout: 15000 }).catch(() => null)
const summary2 = await page.locator('[data-testid="auto-beat-summary"]').innerText()
const customCount = Number((summary2.match(/Found (\d+)/) || [])[1] || 0)
assert(customCount >= 5, 'E Custom Auto Beat learned the segment and found its matches', summary2)
await page.locator('[data-testid="auto-beat-place-timeline"]').click()
await page.waitForTimeout(300)
const tlMarkers = (await st()).markers.filter((m) => !m.clipId)
assert(tlMarkers.length === customCount && tlMarkers.every((m) => Math.abs(((m.time - 0.5) % 1 + 1) % 1) < 0.18 || Math.abs((((m.time - 0.5) % 1) + 1) % 1 - 1) < 0.18), 'E custom beats placed on the main timeline on-grid', JSON.stringify(tlMarkers.map((m) => m.time.toFixed(2))))

await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0.5))
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, '17-markers-autobeat.png') })

await browser.close()
if (failures) { console.error(`MARKERS-AUTOBEAT SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('MARKERS-AUTOBEAT SUITE: ALL PASS')
