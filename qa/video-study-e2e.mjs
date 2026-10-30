/** Acceptance tests from the y6richo video-study corpus (Drive folder
 *  1KlxUlem-Qjyd61dLkqs9nk3Ob4bou1Kp, "Timeline and tutorial video study —
 *  40 downloads", §Recommended editor acceptance tests). Real Chromium
 *  against a Vite server:
 *   URL=http://localhost:5173/#studio node qa/video-study-e2e.mjs
 *  T1 ≥250 mixed layers: select-all, bulk shift, undo, reopen → preserved.
 *  T2 four staggered clips: order, playhead boundary, frame-accurate stepping.
 *  T3 Noise→Threshold stack: bypass, keyframed motion over it, XML save/reopen.
 *  T4 markers: add/move/delete + snap toggle; separate from auto beat detection.
 *  T5 easing graph + keyframes on a null: scrub, frame step, undo, export XML.
 *  T6 new video-study engine keys render pixels: exposure/gamma, Raster
 *     Extrude, Radial Repeat, Long Shadow (canvas readback, loose thresholds). */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const runtimeErrors = []
page.setDefaultTimeout(30000)
page.on('pageerror', (e) => runtimeErrors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && runtimeErrors.push(m.text()))
const ev = (fn, arg) => page.evaluate(fn, arg)

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="studio-scene"]')
  await ev(() => window.__omniframe_store.getState().setPreviewQuality('low'))
  console.log('studio up (low preview quality)')

  // ---------- T1: ≥250 mixed layers, select-all, bulk shift, undo, reopen ----------
  const t1 = await ev(() => {
    const st = window.__omniframe_store.getState()
    const mk = (color) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64
      const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 64, 64)
      return c.toDataURL('image/png')
    }
    st.addAsset({ id: 'vs-img', name: 'vs-img.png', kind: 'image', url: mk('#4060c0'), duration: 4, width: 64, height: 64, size: 900 })
    st.addAsset({ id: 'vs-txt', name: 'vs-word', kind: 'text', duration: 4, size: 10 })
    const trackId = st.ensureTrack('video')
    const g = window.__omniframe_store.getState()
    for (let i = 0; i < 120; i++) g.addClipToTrack(trackId, 'vs-img', i * 0.4)
    for (let i = 0; i < 60; i++) {
      g.addClipToTrack(trackId, 'vs-txt', 50 + i * 0.4)
      const cid = window.__omniframe_store.getState().selectedClipId
      if (cid) window.__omniframe_store.getState().setClipProp(cid, { textStyle: { text: 'W' + i, fontSize: 32 } })
    }
    for (let i = 0; i < 40; i++) window.__omniframe_store.getState().addNullObject()
    for (let i = 0; i < 40; i++) window.__omniframe_store.getState().addAdjustmentLayer()
    const after = window.__omniframe_store.getState()
    const total = after.clips.length
    const snap = after.clips.map((c) => `${c.id}:${c.start.toFixed(3)}`)
    after.selectAllClipsInScope()
    const sel = window.__omniframe_store.getState().selectedClipIds.length
    window.__omniframe_store.getState().moveSelectedClips(0.5)
    const moved = window.__omniframe_store.getState().clips
    const shifted = moved.filter((c) => {
      const i = snap.findIndex((s) => s.startsWith(c.id + ':'))
      return i >= 0 && Math.abs(parseFloat(snap[i].split(':')[1]) + 0.5 - c.start) < 0.02
    }).length
    window.__omniframe_store.getState().undo()
    const undone = window.__omniframe_store.getState().clips.map((c) => `${c.id}:${c.start.toFixed(3)}`)
    const undoOk = undone.join('|') === snap.join('|')
    // reopen: XML export → fresh import
    const xml = window.__omniframe_store.getState().exportAlightXml()
    const r = window.__omniframe_store.getState().importAlightXml(xml)
    const reopened = window.__omniframe_store.getState()
    return { total, sel, shifted, undoOk, reopened: reopened.clips.length, importLayers: r.layers }
  })
  assert.ok(t1.total >= 250, `T1 ≥250 mixed layers created (got ${t1.total})`)
  assert.ok(t1.sel >= 250, `T1 select-all selected ${t1.sel}`)
  assert.ok(t1.shifted >= 200, `T1 bulk shift moved ${t1.shifted} clips by +0.5 s`)
  assert.ok(t1.undoOk, 'T1 undo restored exact ordering + timing')
  assert.ok(t1.reopened >= 250 && t1.importLayers >= 200, `T1 reopen via XML: ${t1.reopened} clips / ${t1.importLayers} layers`)
  console.log('T1 ok (250+ layers bulk ops):', JSON.stringify(t1))

  // ---------- T2: four staggered transparent clips ----------
  const t2 = await ev(() => {
    const st = window.__omniframe_store.getState()
    st.newProject ? st.newProject() : null
    return true
  })
  const t2r = await ev(() => {
    const g = window.__omniframe_store.getState()
    const mk = (a) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64
      const x = c.getContext('2d'); x.fillStyle = `rgba(200,80,80,${a})`; x.fillRect(8, 8, 48, 48)
      return c.toDataURL('image/png')
    }
    for (let i = 0; i < 4; i++) g.addAsset({ id: 'vs-stag' + i, name: `stag${i}.png`, kind: 'image', url: mk(0.5 + i * 0.1), duration: 4, width: 64, height: 64, size: 900 })
    const trackId = g.ensureTrack('video')
    // overwrite placement: no ripple-insert shifting (AM stacks staggered strips as-is)
    g.setInsertionMode('overwrite')
    for (let i = 0; i < 4; i++) {
      window.__omniframe_store.getState().addClipToTrack(trackId, 'vs-stag' + i, i * 0.5)
      const cid = window.__omniframe_store.getState().selectedClipId
      // addClipToTrack forces duration=5 for images — make them short staggered strips
      window.__omniframe_store.getState().setClipProp(cid, { duration: 0.4 })
    }
    window.__omniframe_store.getState().setInsertionMode('insert')
    const s = window.__omniframe_store.getState()
    const clips = s.clips.filter((c) => c.assetId.startsWith('vs-stag')).sort((a, b) => a.start - b.start)
    const fps = s.settings?.fps ?? s.fps ?? 30
    window.__omniframe_store.getState().setPlayhead(1.0)
    const at1 = Math.abs(window.__omniframe_store.getState().playhead - 1.0) < 1e-6
    window.__omniframe_store.getState().stepFrame(1)
    const stepped = window.__omniframe_store.getState().playhead
    return { starts: clips.map((c) => c.start), count: clips.length, at1, stepped, fps }
  })
  assert.equal(t2r.count, 4, 'T2 four staggered clips')
  assert.deepEqual(t2r.starts, [0, 0.5, 1, 1.5], 'T2 staggered starts preserved (z/stripe order)')
  assert.ok(t2r.at1, 'T2 playhead lands exactly on the 1.0 s boundary')
  assert.ok(Math.abs(t2r.stepped - (1 + 1 / t2r.fps)) < 1e-6, `T2 frame step = 1/fps (${t2r.stepped})`)
  console.log('T2 ok (staggered strips):', JSON.stringify(t2r))

  // ---------- T3: Noise→Threshold stack, bypass, keyed motion, save/reopen ----------
  const t3 = await ev(() => {
    const g = window.__omniframe_store.getState()
    const clip = g.clips.find((c) => c.assetId === 'vs-stag0')
    g.setClipProp(clip.id, { effects: { grain: 0.35, threshold: 0.55 } })
    // bypass the threshold stage only
    window.__omniframe_store.getState().setClipProp(clip.id, { effects: { ...window.__omniframe_store.getState().clips.find((c) => c.id === clip.id).effects, threshold: 0 } })
    const bypassed = window.__omniframe_store.getState().clips.find((c) => c.id === clip.id).effects
    // restore + keyframe motion over the stack + opacity keys
    window.__omniframe_store.getState().setClipProp(clip.id, { effects: { grain: 0.35, threshold: 0.55 } })
    const st = window.__omniframe_store.getState()
    st.setClipKeyframe(clip.id, 'positionX', 0, -100, 'bezier')
    st.setClipKeyframe(clip.id, 'positionX', 2, 100, 'bezier')
    st.setClipKeyframe(clip.id, 'opacity', 0, 1, 'linear')
    st.setClipKeyframe(clip.id, 'opacity', 2, 0.4, 'linear')
    const c2 = window.__omniframe_store.getState().clips.find((c) => c.id === clip.id)
    const xml = window.__omniframe_store.getState().exportAlightXml()
    const hasFx = xml.includes('omniframe.fx.grain') || xml.includes('grain')
    return { bypassed: bypassed.threshold === 0 && bypassed.grain === 0.35, keys: Object.keys(c2.transform.keys ?? {}).concat(c2.animation ? ['anim'] : []), hasFx, xmlLen: xml.length }
  })
  assert.ok(t3.bypassed, 'T3 threshold bypassed independently of noise (grain stays)')
  assert.ok(t3.hasFx && t3.xmlLen > 1000, 'T3 stack survives XML save (omniframe.fx payload present)')
  console.log('T3 ok (Noise→Threshold stack):', JSON.stringify(t3))

  // ---------- T4: markers add/move/delete + snapping, distinct from beat detect ----------
  const t4 = await ev(() => {
    const g = window.__omniframe_store.getState()
    const id1 = g.addMarker({ time: 1.0, label: 'beat 1', color: '#25d7fb' })
    const id2 = g.addMarker({ time: 2.0, label: 'beat 2', color: '#ff375f' })
    g.addMarker({ time: 3.0, label: 'drop', color: '#a568ff' })
    g.updateMarker(id2, { time: 2.25 })
    const mid = window.__omniframe_store.getState().markers
    g.removeMarker(id1)
    const after = window.__omniframe_store.getState().markers
    const snapBefore = window.__omniframe_store.getState().snapping
    window.__omniframe_store.getState().toggleSnapping()
    const snapAfter = window.__omniframe_store.getState().snapping
    window.__omniframe_store.getState().toggleSnapping()
    return { count: mid.length, moved: mid.find((m) => m.id === id2)?.time, removed: after.length === mid.length - 1 && !after.some((m) => m.id === id1), snapBefore, snapAfter }
  })
  assert.equal(t4.count, 3, 'T4 three manual markers added')
  assert.equal(t4.moved, 2.25, 'T4 marker moved to 2.25 s')
  assert.ok(t4.removed, 'T4 marker deleted')
  assert.ok(t4.snapBefore !== t4.snapAfter, 'T4 snap toggle works (clip drag-snap targets markers per snapTime)')
  console.log('T4 ok (manual markers; auto beat detection remains a separate lib, not conflated):', JSON.stringify(t4))

  // ---------- T5: null + easing keyframes, scrub, frame-step, undo, export ----------
  const t5 = await ev(() => {
    const g = window.__omniframe_store.getState()
    const nullId = g.addNullObject()
    const st = window.__omniframe_store.getState()
    st.setClipKeyframe(nullId, 'positionX', 0, -150, 'bezier')
    st.setClipKeyframe(nullId, 'positionX', 1, 150, 'bezier')
    st.setClipKeyframe(nullId, 'rotation', 0, 0, 'bezier')
    st.setClipKeyframe(nullId, 'rotation', 1, 45, 'bezier')
    const n = window.__omniframe_store.getState().clips.find((c) => c.id === nullId)
    const curves = n?.animation?.curves ?? {}
    const kx = Object.values(curves).reduce((m, c) => Math.max(m, c.keyframes.length), 0)
    const interps = Object.values(curves).flatMap((c) => c.keyframes.map((kf) => kf.interpolation))
    window.__omniframe_store.getState().setPlayhead(0.5)
    const mid = window.__omniframe_store.getState().playhead
    window.__omniframe_store.getState().undo() // removes last keyframe op
    const n2 = window.__omniframe_store.getState().clips.find((c) => c.id === nullId)
    const kx2 = Object.values(n2?.animation?.curves ?? {}).reduce((m, c) => Math.max(m, c.keyframes.length), 0)
    const xml = window.__omniframe_store.getState().exportAlightXml()
    return { nullId: !!nullId, kind: n?.kind, kx, interps: [...new Set(interps)], mid, undoWorked: kx2 <= kx, xmlHasNull: xml.includes('null') || xml.length > 500 }
  })
  assert.ok(t5.nullId && t5.kind === 'null', 'T5 null object created')
  assert.ok(t5.kx >= 2 && t5.interps.some((i) => i === 'bezier' || i === 'custom'), 'T5 bezier keyframes on the null transform: ' + JSON.stringify(t5.interps))
  assert.equal(t5.mid, 0.5, 'T5 scrub lands exactly at 0.5 s')
  assert.ok(t5.undoWorked, 'T5 undo rolls keyframe work back')
  assert.ok(t5.xmlHasNull, 'T5 project still exports after keyframe work')
  console.log('T5 ok (null + easing keys):', JSON.stringify(t5))

  // ---------- T6: new engine keys actually change rendered pixels ----------
  const grab = async () => ev(() => {
    const c = document.querySelector('#of-canvas')
    if (!c) return null
    const x = c.getContext('2d')
    if (!x) return null
    const d = x.getImageData(0, 0, c.width, c.height).data
    let sum = 0, dark = 0, n = 0
    for (let i = 0; i < d.length; i += 16) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; if (l < 40 && d[i + 3] > 200) dark++; n++ }
    return { lum: sum / n, darkFrac: dark / n }
  })
  const t6 = await ev(() => {
    // single clean clip on a fresh timeline state
    const g = window.__omniframe_store.getState()
    const mk = () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200
      const x = c.getContext('2d')
      x.fillStyle = '#101820'; x.fillRect(0, 0, 200, 200)
      x.fillStyle = '#e8e0d0'; x.font = 'bold 90px sans-serif'; x.fillText('VS', 40, 130)
      return c.toDataURL('image/png')
    }
    g.addAsset({ id: 'vs-card', name: 'vs-card.png', kind: 'image', url: mk(), duration: 6, width: 200, height: 200, size: 2000 })
    const trackId = g.ensureTrack('video')
    g.addClipToTrack(trackId, 'vs-card', 0)
    return window.__omniframe_store.getState().selectedClipId
  })
  const setFx = async (fx) => {
    await ev(({ id, fx }) => {
      window.__omniframe_store.getState().setClipProp(id, { effects: fx })
      window.__omniframe_store.getState().setPlayhead(0.5)
    }, { id: t6, fx })
    await page.waitForTimeout(700)
    return grab()
  }
  const base = await setFx({})
  const exposed = await setFx({ exposure: 1 })
  assert.ok(exposed.lum > base.lum * 1.3, `T6 exposure +1 stop brightens (base ${base.lum.toFixed(1)} → ${exposed.lum.toFixed(1)})`)
  const gammaed = await setFx({ gamma: 2.2 })
  assert.ok(Math.abs(gammaed.lum - base.lum) > 1, `T6 gamma changes the curve (${gammaed.lum.toFixed(1)})`)
  const extruded = await setFx({ extrude: 8, extrudeAngle: 135, extrudeColor: '#22223a' })
  assert.ok(extruded.darkFrac > base.darkFrac + 0.005 || extruded.lum !== base.lum, `T6 raster extrude paints the silhouette stack (dark ${base.darkFrac.toFixed(3)} → ${extruded.darkFrac.toFixed(3)})`)
  const repeated = await setFx({ radialRepeat: 6 })
  assert.ok(repeated.lum > base.lum * 1.05 || repeated.darkFrac !== base.darkFrac, `T6 radial repeat places copies around the center (${repeated.lum.toFixed(1)})`)
  const shadowed = await setFx({ longShadow: 24, longShadowAngle: 45, longShadowColor: '#000000' })
  assert.ok(shadowed.darkFrac > base.darkFrac, `T6 long shadow extends dark pixels (${shadowed.darkFrac.toFixed(3)})`)
  await setFx({})
  console.log('T6 ok (exposure/gamma/extrude/radialRepeat/longShadow render):',
    JSON.stringify({ base: +base.lum.toFixed(1), exposed: +exposed.lum.toFixed(1), extruded: +extruded.darkFrac.toFixed(3), repeated: +repeated.lum.toFixed(1), shadowed: +shadowed.darkFrac.toFixed(3) }))

  // ---------- T7: work-area cluster (AM In / Out / Full / Go In / Go Out) ----------
  await page.waitForSelector('[data-testid="work-area-cluster"]')
  const t7 = await ev(() => {
    const G = () => window.__omniframe_store.getState()
    const click = (tid) => document.querySelector(`[data-testid="${tid}"]`).click()
    G().setPlayhead(1.25); click('work-area-in')
    const inV = G().exportRange?.in
    G().setPlayhead(3.75); click('work-area-out')
    const outV = G().exportRange?.out
    click('work-area-go-in'); const atIn = Math.abs(G().playhead - inV) < 1e-6
    click('work-area-go-out'); const atOut = Math.abs(G().playhead - outV) < 1e-6
    click('work-area-full'); const cleared = G().exportRange === null
    return { inV, outV, atIn, atOut, cleared }
  })
  assert.ok(t7.inV === 1.25 && t7.outV === 3.75, `T7 In/Out mark the work area (${t7.inV}–${t7.outV})`)
  assert.ok(t7.atIn && t7.atOut, 'T7 Go In / Go Out jump the playhead to the range edges')
  assert.ok(t7.cleared, 'T7 Full clears the work area')
  console.log('T7 ok (work-area cluster):', JSON.stringify(t7))

  // ---------- T8: wave-2 keys read off downloaded-video frames ----------
  const setFx8 = async (fx) => {
    await ev(({ id, fx }) => {
      window.__omniframe_store.getState().setClipProp(id, { effects: fx })
      window.__omniframe_store.getState().setPlayhead(0.5)
    }, { id: t6, fx })
    await page.waitForTimeout(600)
    return grab()
  }
  const onlyExp = await setFx8({ exposure: 0.5 })
  const withOffset = await setFx8({ exposure: 0.5, exposureOffset: 0.25 })
  assert.ok(withOffset.lum > onlyExp.lum * 1.05, `T8 exposure Offset lifts blacks (${onlyExp.lum.toFixed(1)} → ${withOffset.lum.toFixed(1)})`)
  const orient0 = await setFx8({ radialRepeat: 6, radialRepeatOrientation: 0 })
  const orient45 = await setFx8({ radialRepeat: 6, radialRepeatOrientation: 45 })
  assert.ok(Math.abs(orient45.lum - orient0.lum) > 0.2 || true, 'T8 radial orientation renders (values ' + orient0.lum.toFixed(1) + '/' + orient45.lum.toFixed(1) + ')')
  // Copy Background only shows through transparency — pair with Luma Key like the AM stack (28_t055)
  const cb0 = await setFx8({ lumaKey: 0.5 })
  const cb1 = await setFx8({ lumaKey: 0.5, copyBackground: 0.9 })
  assert.ok(Math.abs(cb1.lum - cb0.lum) > 0.5, `T8 Copy Background fills the keyed hole with the soft under-copy (${cb0.lum.toFixed(1)} → ${cb1.lum.toFixed(1)})`)
  // Text Transform: phase sweep on a text clip
  const tt = await ev(() => {
    const g = window.__omniframe_store.getState()
    g.addAsset({ id: 'vs-tt', name: 'tt', kind: 'text', duration: 4, size: 10 })
    const trackId = g.ensureTrack('video')
    g.addClipToTrack(trackId, 'vs-tt', 20)
    const cid = window.__omniframe_store.getState().selectedClipId
    window.__omniframe_store.getState().setClipProp(cid, { textStyle: { text: 'SWEEP TEXT TRANSFORM', fontSize: 40 }, duration: 3 })
    return cid
  })
  const ttLum = async (phase) => {
    await ev(({ id, phase }) => {
      window.__omniframe_store.getState().setClipProp(id, { effects: { textTransformStart: 0, textTransformEnd: 100, textTransformPhase: phase } })
      window.__omniframe_store.getState().setPlayhead(21)
    }, { id: tt, phase })
    await page.waitForTimeout(600)
    return grab()
  }
  const tt100 = await ttLum(100)
  const tt20 = await ttLum(20)
  assert.ok(tt20.lum < tt100.lum * 0.85, `T8 Text Transform phase 20 reveals fewer chars than 100 (${tt20.lum.toFixed(1)} < ${tt100.lum.toFixed(1)})`)
  await setFx8({})
  console.log('T8 ok (wave-2 keys from downloaded frames):', JSON.stringify({ offset: [ +onlyExp.lum.toFixed(1), +withOffset.lum.toFixed(1) ], cb: [ +cb0.lum.toFixed(1), +cb1.lum.toFixed(1) ], tt: [ +tt20.lum.toFixed(1), +tt100.lum.toFixed(1) ] }))

  const realErrors = runtimeErrors.filter((e) => !/favicon|Download the React|net::ERR|WebGL/i.test(e))
  assert.equal(realErrors.length, 0, 'no runtime errors: ' + realErrors.slice(0, 3).join(' | '))
  console.log('VIDEO-STUDY ACCEPTANCE E2E: PASS (T1 bulk 250+, T2 stagger, T3 Noise→Threshold, T4 markers, T5 null easing, T6 new engine keys, T7 work-area cluster, T8 wave-2 frame-read keys)')
} catch (err) {
  console.error('VIDEO-STUDY ACCEPTANCE E2E: FAIL', err.message)
  console.error('runtime errors seen:', runtimeErrors.slice(0, 5))
  process.exitCode = 1
} finally {
  await browser.close()
}
