/**
 * Apps & Devices pack + Scene Recipes QA.
 * Run: URL=http://localhost:5173/#studio node qa/apps-scenes-e2e.mjs
 */
import assert from 'node:assert/strict'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.setDefaultTimeout(15000)
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await page.getByTestId('left-tab-pack').evaluate((el) => el.click())
  await page.getByTestId('desktop-pack-panel').waitFor({ state: 'visible' })

  // Sections include Apps & Devices and Scene Recipes.
  await page.getByTestId('pack-section-apps').waitFor({ state: 'visible' })
  await page.getByTestId('pack-section-scenes').waitFor({ state: 'visible' })

  // Apps: demo-text recreations add real clips.
  await page.getByTestId('pack-section-apps').click()
  await page.getByTestId('pack-asset-spotify-desktop').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId === 'pack-spotify-desktop'))
  const phoneFolder = page.getByTestId('pack-folder-toggle-apps-Phones')
  if (await phoneFolder.count()) await phoneFolder.click()
  await page.getByTestId('pack-asset-phone-android-home').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId === 'pack-phone-android-home'))
  await page.getByTestId('pack-section-windows').click()
  await page.getByTestId('pack-bundle-music-video').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.length >= 4)
  console.log('PASS apps pack assets + bundle add clips')

  // Wave-2 generated assets (demo text only) also add clips.
  const addAsset = async (id, section, folder) => {
    await page.getByTestId('pack-search').fill('')
    await page.getByTestId(`pack-section-${section}`).click()
    if (!(await page.getByTestId(`pack-asset-${id}`).isVisible().catch(() => false))) {
      const toggle = page.getByTestId(`pack-folder-toggle-${section}-${folder}`)
      if (await toggle.count()) await toggle.click()
    }
    await page.getByTestId(`pack-asset-${id}`).waitFor({ state: 'visible' })
    const b = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
    await page.getByTestId(`pack-asset-${id}`).click()
    await page.waitForFunction((n) => window.__omniframe_store.getState().clips.length === n + 1, b)
  }
  await addAsset('spotify-phone', 'apps', 'Music')
  await addAsset('vscode-window', 'apps', 'Code & Design')
  await addAsset('figma-desktop', 'apps', 'Code & Design')
  await addAsset('discord-chat', 'apps', 'Chat & Mail')
  await addAsset('chrome-webpage', 'windows', 'Browsers')
  console.log('PASS wave-2 app/window assets add clips')

  // Wave-3 generated packs: more phone/productivity scenes from the
  // screenshot gist groups, still with demo/test fields only.
  await addAsset('maps-phone', 'apps', 'Phones')
  await addAsset('photo-gallery-phone', 'apps', 'Phones')
  await addAsset('podcast-player', 'apps', 'Music')
  await addAsset('calendar-window', 'apps', 'Productivity')
  await addAsset('spreadsheet-window', 'apps', 'Productivity')
  console.log('PASS wave-3 phone/productivity assets add clips')

  await addAsset('video-call-window', 'apps', 'Creators')
  await addAsset('shopping-phone', 'apps', 'Phones')
  await addAsset('files-phone', 'apps', 'Phones')
  await addAsset('video-player-phone', 'apps', 'Phones')
  console.log('PASS wave-4 call/shopping/files/player assets add clips')

  // Wave-5: gist-led scenes (dark desktop apps + generated phone layouts,
  // since no phone screenshots were supplied) — demo/test fields only.
  await addAsset('podcast-studio-window', 'apps', 'Creators')
  await addAsset('slides-window', 'apps', 'Productivity')
  await addAsset('fitness-phone', 'apps', 'Phones')
  await addAsset('food-delivery-phone', 'apps', 'Phones')
  console.log('PASS wave-5 studio/slides/lifestyle assets add clips')

  // Wave-6: studio/editor windows and everyday phone scenes, filed into
  // the existing Explorer-style folders (Music, Code & Design,
  // Productivity, Phones) with demo/test fields only.
  await addAsset('music-studio-window', 'apps', 'Music')
  await addAsset('photo-editor-window', 'apps', 'Code & Design')
  await addAsset('doc-writer-window', 'apps', 'Productivity')
  await addAsset('banking-phone', 'apps', 'Phones')
  await addAsset('mail-phone', 'apps', 'Phones')
  await addAsset('alarm-phone', 'apps', 'Phones')
  console.log('PASS wave-6 studio/editor/phone-essentials assets add clips')

  // Podcast Studio recipe builds a full scene without a selected clip.
  await page.getByTestId('pack-section-scenes').click()
  const beforeRecipe = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
  await page.getByTestId('pack-recipe-podcast-studio-cut').click()
  await page.waitForFunction((n) => window.__omniframe_store.getState().clips.length >= n + 3, beforeRecipe)
  console.log('PASS podcast studio recipe builds a scene')

  // Seed a base clip for recipes (built-in demo image asset).
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const st = store.getState()
    const trackId = st.tracks.find((t) => t.type === 'video')?.id || st.createTrack('video')
    st.addClipToTrack(trackId, 'asset-death-note-img', 20)
    const clip = store.getState().clips.find((c) => c.start === 20)
    store.setState({ selectedClipId: clip?.id ?? null, playhead: 21 })
  })

  await page.getByTestId('pack-section-scenes').click()
  // Recipes that need a clip enable once one is selected.
  await page.getByTestId('pack-recipe-freeze-pop').waitFor({ state: 'visible' })
  assert.equal(await page.getByTestId('pack-recipe-freeze-pop').isEnabled(), true, 'freeze-pop should enable with a clip selected')

  await page.getByTestId('pack-recipe-vertical-version').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().sequenceSettings?.aspectRatio === '9:16')
  console.log('PASS vertical-version recipe switches sequence to 9:16')

  await page.getByTestId('pack-recipe-freeze-pop').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().assets.some((a) => a.id.startsWith('freeze-')))
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.assetId.startsWith('freeze-')))
  const note = await page.getByTestId('pack-recipe-note').textContent()
  assert.match(note ?? '', /Freeze-pop built/)
  console.log('PASS freeze-pop builds freeze frame + title')

  const textBefore = await page.evaluate(() => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'text').length)
  await page.getByTestId('pack-recipe-caption-burst').click()
  await page.waitForFunction((n) => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'text').length >= n + 3, textBefore)
  console.log('PASS caption-burst adds editable caption clips')

  await page.getByTestId('pack-recipe-punch-in').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => (c.transform?.scale ?? 1) > 1.1))
  console.log('PASS punch-in splits and scales the middle clip')

  // Ken Burns: keyframes a real zoom on the selected image clip.
  await page.evaluate(() => {
    const store = window.__omniframe_store
    const clip = store.getState().clips.find((c) => c.assetId === 'asset-death-note-img')
    store.setState({ selectedClipId: clip?.id ?? null })
  })
  await page.getByTestId('pack-recipe-ken-burns').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const keys = clip?.animation?.curves?.scale_x?.keyframes ?? []
    return keys.length === 2 && Math.abs(keys[keys.length - 1].value - 1.25) < 0.01
  })
  console.log('PASS ken-burns keyframes a real zoom')

  // Motion Presets (Jitter/Remotion study): named one-click animations land
  // as ordinary, editable keyframes on the selected clip.
  await page.getByTestId('pack-recipe-motion-pop-in').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const sx = clip?.animation?.curves?.scale_x?.keyframes ?? []
    const op = clip?.animation?.curves?.opacity?.keyframes ?? []
    return sx.length >= 2 && op.length >= 2 && sx.some((k) => k.interpolation === 'back')
  })
  console.log('PASS motion pop-in writes spring (back) keyframes')
  await page.getByTestId('pack-recipe-motion-fade-rise').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const py = clip?.animation?.curves?.position_y?.keyframes ?? []
    return py.length >= 2 && py.some((k) => k.interpolation === 'ease-out')
  })
  console.log('PASS motion fade-rise writes position keyframes')
  await page.getByTestId('pack-recipe-motion-drop-out').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const op = clip?.animation?.curves?.opacity?.keyframes ?? []
    const last = op[op.length - 1]
    return !!last && last.value === 0 && last.interpolation === 'ease-in'
  })
  console.log('PASS motion drop-out writes exit keyframes')
  // 3D trick presets (Gold Motion study): flip/tumble write Rotation Y/X keys.
  await page.getByTestId('pack-recipe-motion-flip-in').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const ry = clip?.animation?.curves?.rotation_y?.keyframes ?? []
    return ry.length >= 2 && ry[0].value <= -79
  })
  console.log('PASS motion flip-in writes Rotation Y keyframes (3D flip)')
  await page.getByTestId('pack-recipe-motion-tumble-in').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const rx = clip?.animation?.curves?.rotation_x?.keyframes ?? []
    return rx.length >= 2 && rx[0].value >= 69
  })
  console.log('PASS motion tumble-in writes Rotation X keyframes (3D tumble)')
  await page.getByTestId('pack-recipe-motion-swing-in').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    const clip = s.clips.find((c) => c.id === s.selectedClipId)
    const rz = clip?.animation?.curves?.rotation_z?.keyframes ?? []
    return rz.length >= 4
  })
  console.log('PASS motion swing-in writes pendulum keyframes')

  await page.getByTestId('pack-recipe-on-air').click()
  await page.waitForFunction(() => window.__omniframe_store.getState().clips.some((c) => c.kind === 'text' && c.textStyle?.text === 'ON AIR'))
  console.log('PASS on-air recipe adds its title')

  // Scene Brief Builder: a structured brief becomes editable clips through
  // real sequence, pack, title, trim and keyframe actions.
  await page.getByTestId('pack-brief-title').fill('Demo Launch Brief')
  await page.getByTestId('pack-brief-captions').fill('Open with the demo hook\nShow the phone route\nEnd with the demo result')
  await page.getByTestId('pack-brief-format').selectOption('9:16')
  await page.getByTestId('pack-brief-backdrop').selectOption('maps-phone')
  await page.getByTestId('pack-brief-style').selectOption('tutorial')
  await page.getByTestId('pack-brief-duration').fill('8')
  const briefBefore = await page.evaluate(() => window.__omniframe_store.getState().clips.length)
  await page.getByTestId('pack-brief-build').click()
  await page.waitForFunction((n) => window.__omniframe_store.getState().clips.length > n + 5, briefBefore)
  const briefState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    const texts = s.clips.filter((c) => c.kind === 'text').map((c) => c.textStyle?.text)
    const backdrop = s.clips.find((c) => c.assetId === 'pack-maps-phone')
    return {
      aspect: s.sequenceSettings?.aspectRatio,
      texts,
      hasBackdrop: Boolean(backdrop),
      hasSpotlight: s.clips.some((c) => c.assetId === 'pack-spotlight'),
      hasHighlight: s.clips.some((c) => c.assetId === 'pack-highlight-box'),
      backdropKeys: Math.max(0, ...s.clips.filter((c) => c.assetId === 'pack-maps-phone').map((c) => c.animation?.curves?.scale_x?.keyframes?.length ?? 0)),
    }
  })
  assert.equal(briefState.aspect, '9:16')
  assert.ok(briefState.texts.includes('Demo Launch Brief'), 'brief title clip created')
  assert.ok(briefState.texts.includes('Show the phone route'), 'brief caption clips created')
  assert.ok(briefState.hasBackdrop && briefState.hasSpotlight && briefState.hasHighlight, 'brief backdrop/tutorial layers created')
  assert.equal(briefState.backdropKeys, 2, 'brief backdrop receives real zoom keyframes')
  assert.match(await page.getByTestId('pack-brief-note').textContent() ?? '', /editable clips/)
  console.log('PASS scene brief builder creates an editable scene')

  // Plain-file brief exchange: an external agent can author this JSON and
  // OmniFrame builds it through the same UI path.
  await page.getByTestId('pack-brief-file').setInputFiles({
    name: 'agent-brief.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      kind: 'omniframe-scene-brief',
      version: 1,
      title: 'Imported Demo Brief',
      captions: ['Imported hook', 'Imported middle step', 'Imported ending'],
      format: '1:1',
      duration: 6,
      backdrop: 'phone-frame',
      style: 'cinematic',
    })),
  })
  await page.waitForFunction(() => document.querySelector('[data-testid="pack-brief-title"]')?.value === 'Imported Demo Brief')
  assert.match(await page.getByTestId('pack-brief-note').textContent() ?? '', /Brief loaded/)
  await page.getByTestId('pack-brief-build').click()
  await page.waitForFunction(() => {
    const s = window.__omniframe_store.getState()
    return s.sequenceSettings?.aspectRatio === '1:1' && s.clips.some((c) => c.kind === 'text' && c.textStyle?.text === 'Imported Demo Brief') && s.clips.some((c) => c.assetId === 'pack-letterbox')
  })
  console.log('PASS imported scene brief JSON builds an editable scene')

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`)
  console.log('APPS+SCENES E2E PASSED')
} finally {
  await browser.close()
}
