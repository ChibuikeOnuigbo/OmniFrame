import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'qa/screenshots')
const REPORTS = join(ROOT, 'qa/reports')

mkdirSync(SHOTS, { recursive: true })
mkdirSync(REPORTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = []
const errors = []

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

const assert = (v, n, d = '') => {
  if (!v) throw Error(`${n}: ${d}`)
  results.push({ name: n, status: 'PASS', detail: d })
  console.log('PASS', n, d)
}

const state = () =>
  page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clips: s.clips.map((c) => ({ id: c.id, trackId: c.trackId, start: +c.start.toFixed(3), duration: +c.duration.toFixed(3) })).sort((a, b) => a.trackId.localeCompare(b.trackId) || a.start - b.start),
      targeted: s.targetedTrackIds,
      gapSelectMode: s.gapSelectMode,
      tracks: s.tracks.map((t) => ({ id: t.id, type: t.type, name: t.name })),
    }
  })

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // ---------------------------------------------------------------- seeding
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    const asset = st.assets[0]
    const vTracks = st.tracks.filter((t) => t.type === 'video')
    const trackId = vTracks.length ? vTracks[0].id : st.createTrack('video')
    const audioId = st.ensureTrack('audio')
    const mk = (id, trk, start, duration) => ({
      id,
      trackId: trk,
      assetId: asset.id,
      start,
      duration,
      inPoint: 0,
      name: id,
      kind: 'video',
      volume: 1,
      hidden: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    })
    window.__omniframe_store.setState({
      clips: [
        mk('seedA', trackId, 2, 3), // 2 -> 5
        mk('seedB', trackId, 8, 3), // 8 -> 11   (3s gap)
        mk('seedC', trackId, 14, 2), // 14 -> 16 (3s gap)
        mk('seedD', audioId, 0, 4), // 0 -> 4
        mk('seedE', audioId, 9, 2), // 9 -> 11   (5s gap)
      ],
      targetedTrackIds: [],
      gapSelectMode: false,
    })
  })
  await page.waitForTimeout(400)

  let s = await state()
  const videoTrack = s.tracks.find((t) => t.type === 'video').id
  const audioTrack = s.tracks.find((t) => t.type === 'audio').id
  const startsOf = (st, trk) =>
    st.clips.filter((c) => c.trackId === trk).sort((a, b) => a.start - b.start).map((c) => c.start)

  assert(s.clips.length === 5, 'sequence seeded with 5 clips', JSON.stringify(startsOf(s, videoTrack)))

  // ------------------------------------------------- 1. track header declutter
  const gapsButtons = await page.locator('[data-testid^="close-gaps-"]').count()
  assert(gapsButtons === 0, 'repeated per-track Close Gaps button is gone from headers', `found ${gapsButtons}`)

  const headers = await page.locator('[data-testid="track-header"]').count()
  // Scoped to headers: the toolbar's track-target-menu-btn shares the prefix.
  const targetBtns = await page
    .locator('[data-testid="track-header"] [data-testid^="track-target-"]')
    .count()
  assert(targetBtns === headers, 'every track header exposes a target control', `${targetBtns} buttons / ${headers} headers`)

  // ------------------------------------------------- 2. targeting behaviour
  await page.locator(`[data-testid="track-target-${videoTrack}"]`).click()
  await page.waitForTimeout(200)
  s = await state()
  assert(s.targeted.length === 1 && s.targeted[0] === videoTrack, 'clicking a target button targets that track', JSON.stringify(s.targeted))

  const bar = await page.locator(`[data-testid="track-scope-accent-${videoTrack}"]`).count()
  assert(bar === 1, 'targeted track shows an accent bar')

  await page.locator(`[data-testid="track-target-${videoTrack}"]`).click()
  await page.waitForTimeout(200)
  s = await state()
  assert(s.targeted.length === 0, 'clicking again clears targeting')

  // Shift-click solos one track
  await page.locator(`[data-testid="track-target-${audioTrack}"]`).click({ modifiers: ['Shift'] })
  await page.waitForTimeout(200)
  s = await state()
  assert(s.targeted.length === 1 && s.targeted[0] === audioTrack, 'Shift-click targets only that track', JSON.stringify(s.targeted))

  // ------------------------------- 3. Remove All Gaps honours targeting, and
  //                                    preserves the first clip's position
  await page.evaluate(() => window.__omniframe_store.getState().removeGaps('targeted'))
  await page.waitForTimeout(250)
  s = await state()
  // audio: D at 0 (len 4) and E at 9 -> after closing, E sits at 4.
  assert(startsOf(s, audioTrack).join() === '0,4', 'targeted scope closed the gap on the audio track only', JSON.stringify(startsOf(s, audioTrack)))
  // video untouched: 2, 8, 14
  assert(startsOf(s, videoTrack).join() === '2,8,14', 'untargeted video track was left alone', JSON.stringify(startsOf(s, videoTrack)))

  // All tracks
  await page.evaluate(() => window.__omniframe_store.getState().removeGaps('all'))
  await page.waitForTimeout(250)
  s = await state()
  // video: first clip stays at 2, then 5 and 8. audio already flush.
  assert(startsOf(s, videoTrack).join() === '2,5,8', 'all-tracks scope preserves the first clip at 2s', JSON.stringify(startsOf(s, videoTrack)))

  // ------------------------------------ 4. no-op does not touch the undo stack
  const undoDepth = () =>
    page.evaluate(() => {
      const s = window.__omniframe_store.getState()
      return Array.isArray(s.past) ? s.past.length : -1
    })
  const before = await undoDepth()
  const closed = await page.evaluate(() => window.__omniframe_store.getState().removeGaps('all'))
  const after = await undoDepth()
  assert(closed === 0, 'removeGaps reports 0 gaps when there are none', String(closed))
  assert(before === after, 'a no-op gap removal pushes no undo entry', `${before} -> ${after}`)

  // ------------------------------------------------ 5. interactive gap picker
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    const asset = st.assets[0]
    const vt = st.tracks.find((t) => t.type === 'video').id
    const mk = (id, start, duration) => ({
      id, trackId: vt, assetId: asset.id, start, duration, inPoint: 0, name: id,
      kind: 'video', volume: 1, hidden: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    })
    window.__omniframe_store.setState({
      clips: [mk('pA', 0, 3), mk('pB', 7, 2), mk('pC', 12, 2)],
      targetedTrackIds: [],
    })
    st.setGapSelectMode(true)
  })
  await page.waitForTimeout(400)

  const banner = page.locator('[data-testid="gap-select-banner"]')
  await banner.waitFor({ state: 'visible', timeout: 5000 })
  assert(await banner.isVisible(), 'Select Gaps shows a banner explaining the mode')

  const blocks = page.locator('[data-testid^="gap-block-"]')
  const blockCount = await blocks.count()
  assert(blockCount === 2, 'one hatched block per gap on the timeline', `${blockCount} blocks`)

  const hatch = await blocks.first().evaluate((el) => getComputedStyle(el).backgroundImage)
  assert(/repeating-linear-gradient/.test(hatch), 'gap blocks use diagonal hatch shading', hatch.slice(0, 60))

  await page.screenshot({ path: join(SHOTS, 'gap-select-mode.png') })

  // Clicking a gap closes just that one
  await blocks.first().click()
  await page.waitForTimeout(300)
  s = await state()
  assert(startsOf(s, videoTrack).join() === '0,3,8', 'clicking a gap closed only that gap', JSON.stringify(startsOf(s, videoTrack)))

  const remaining = await page.locator('[data-testid^="gap-block-"]').count()
  assert(remaining === 1, 'the remaining gap is still offered', `${remaining} left`)

  // ------------------------------------------------------ 6. Escape leaves mode
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  s = await state()
  assert(s.gapSelectMode === false, 'Escape exits Select Gaps mode')
  assert((await page.locator('[data-testid^="gap-block-"]').count()) === 0, 'gap blocks unmount when the mode ends')

  // ------------------------------------------------------------ 7. shortcuts
  await page.keyboard.press('g')
  await page.waitForTimeout(250)
  s = await state()
  assert(s.gapSelectMode === true, 'G opens the gap picker')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  await page.keyboard.press('Shift+G')
  await page.waitForTimeout(300)
  s = await state()
  assert(startsOf(s, videoTrack).join() === '0,3,5', 'Shift+G removes all gaps in scope', JSON.stringify(startsOf(s, videoTrack)))

  // ------------------------------------------------- 8. context menu submenu
  const lane = page.locator(`[data-testid="track-lane-${videoTrack}"]`)
  // Right-click bare lane, not a clip: a clip under the cursor opens the clip
  // menu instead of the track menu.
  const laneBox = await lane.boundingBox()
  const laneGeom = await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    return {
      px: st.pxPerSec,
      last: st.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0),
    }
  })
  const emptyX = Math.min(laneBox.width - 40, laneGeom.last * laneGeom.px + 60)
  await lane.click({ button: 'right', position: { x: emptyX, y: laneBox.height / 2 } })
  await page.waitForTimeout(400)

  // NOTE: right-clicking a track lane opens Studio's centralized menu
  // (studio-context-menu). Timeline's own empty-track menu never wins here,
  // so these ids are the Studio ones.
  const gapsItem = page.locator('[data-testid="ctx-cmd-remove-all-gaps"]')
  await gapsItem.waitFor({ state: 'visible', timeout: 5000 })
  assert(await gapsItem.isVisible(), 'Remove All Gaps appears in the track context menu')

  const selectGapsItem = page.locator('[data-testid="ctx-cmd-select-gaps"]')
  assert(await selectGapsItem.isVisible(), 'Select Gaps appears in the track context menu')

  const submenu = page.locator('[data-testid="ctx-submenu-remove-all-gaps"]')
  await gapsItem.hover()
  await submenu.waitFor({ state: 'visible', timeout: 5000 })
  const subItems = await submenu.locator('button').allTextContents()
  assert(subItems.some((t) => /This Track/.test(t)), 'submenu offers This Track', JSON.stringify(subItems))
  assert(subItems.some((t) => /All Tracks/.test(t)), 'submenu offers All Tracks', JSON.stringify(subItems))
  assert(!subItems.some((t) => /Targeted/.test(t)), 'Targeted Tracks hidden while nothing is targeted', JSON.stringify(subItems))

  await page.screenshot({ path: join(SHOTS, 'gap-context-menu.png') })

  // With targeting active a third option appears, so no confirm popup is needed
  await page.keyboard.press('Escape')
  await page.locator(`[data-testid="track-target-${audioTrack}"]`).click()
  await page.waitForTimeout(200)
  await lane.click({ button: 'right', position: { x: emptyX, y: laneBox.height / 2 } })
  await page.waitForTimeout(400)
  await page.locator('[data-testid="ctx-cmd-remove-all-gaps"]').hover()
  await page.locator('[data-testid="ctx-submenu-remove-all-gaps"]').waitFor({ state: 'visible', timeout: 5000 })
  const subItems2 = await page.locator('[data-testid="ctx-submenu-remove-all-gaps"]').locator('button').allTextContents()
  assert(subItems2.length === 3, 'three explicit scopes once a track is targeted', JSON.stringify(subItems2))
  assert(subItems2.some((t) => /Targeted Tracks/.test(t)), 'submenu offers Targeted Tracks', JSON.stringify(subItems2))

  await page.screenshot({ path: join(SHOTS, 'gap-context-menu-targeted.png') })

  // -------------------------------------------- 9. central target menu control
  await page.keyboard.press('Escape')
  await page.locator('[data-testid="track-target-menu-btn"]').click()
  await page.waitForTimeout(300)
  const menu = page.locator('[data-testid="track-target-menu"]')
  await menu.waitFor({ state: 'visible', timeout: 5000 })
  assert(await menu.isVisible(), 'central target menu opens from the toolbar')
  const allOpt = page.locator('[data-testid="track-target-all"]')
  assert(await allOpt.isVisible(), 'target menu offers an all-tracks default')
  await page.screenshot({ path: join(SHOTS, 'gap-target-menu.png') })

  assert(errors.length === 0, 'zero runtime errors', errors.join(' | '))

  writeFileSync(join(REPORTS, 'gap-tools-results.json'), JSON.stringify({ results, errors }, null, 2))
  console.log(`RESULT ${results.length} PASS`)
} finally {
  await browser.close()
}
