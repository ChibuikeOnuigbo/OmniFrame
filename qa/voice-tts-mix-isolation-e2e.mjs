/**
 * VOICE ISOLATION END-TO-END — TTS voice + music mix through the real UI
 * =====================================================================
 *
 * Exercises the complete product flow the study is about:
 *
 *   1. Build a real mixture in-page: the TTS "technical narration" voice
 *      mixed at 0 dB SNR with the synthesized full-band music bed (using the
 *      production encodeAudioBufferToWav from the live module).
 *   2. Import the mixture AND the music bed through the real media panel.
 *   3. Place both on the timeline (voice mix + music = combined session).
 *   4. Open the Voice Isolation modal from the Audio panel, run Keep Vocal
 *      at 0.92 strength on the mixture clip.
 *   5. Verify the synchronized isolated clip/asset and that the source clip
 *      is muted (the store's non-destructive handoff).
 *   6. Download the isolated WAV the app produced and verify with FFmpeg:
 *      stereo side energy collapsed, sub-80Hz rumble reduced, speech band
 *      preserved, air bands attenuated, duration preserved.
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const REPORTS = join(ROOT, 'qa', 'reports')
const EVIDENCE = join(ROOT, 'evidence', 'voice')
const ASSETS = join(ROOT, 'qa', 'assets', 'voice')
for (const d of [REPORTS, EVIDENCE, ASSETS]) mkdirSync(d, { recursive: true })

// Regenerate the deterministic music beds on a fresh checkout.
if (!existsSync(join(ASSETS, 'full-band.wav'))) {
  console.log('[e2e] synthesizing music beds...')
  const gen = spawnSync(process.execPath, [join('qa', 'generate-music-beds.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (gen.status !== 0) throw new Error('music bed generation failed')
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const results = []
const assert = (v, name, detail = '') => {
  if (!v) throw new Error(`${name}: ${detail}`)
  results.push({ name, status: 'PASS', detail })
  console.log('PASS', name, detail)
}

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  /* ---- 1. Build the TTS + music mixture with the production encoder ---- */
  console.log('--- Step 1: Mixing TTS voice with music bed (in-page) ---')
  const mixtureB64 = await page.evaluate(async () => {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')

    async function load(url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
      const buf = await ctx.decodeAudioData(await res.arrayBuffer())
      return buf
    }
    const voice = await load('qa/assets/voice/tts-f1-technical.mp3')
    const bed = await load('qa/assets/voice/full-band.wav')

    const len = Math.min(voice.length, bed.length)
    const norm = (buf) => {
      const L = buf.getChannelData(0)
      const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)
      let sum = 0
      for (let i = 0; i < len; i++) sum += (((L[i] + R[i]) / 2) ** 2)
      const g = Math.sqrt(sum / len) > 1e-9 ? 0.16 / Math.sqrt(sum / len) : 1
      return { L, R, g }
    }
    const v = norm(voice)
    const b = norm(bed)

    const mixBuf = ctx.createBuffer(2, len, 44100)
    const outL = mixBuf.getChannelData(0)
    const outR = mixBuf.getChannelData(1)
    for (let i = 0; i < len; i++) {
      outL[i] = v.L[i] * v.g + b.L[i] * b.g
      outR[i] = v.R[i] * v.g + b.R[i] * b.g
    }
    const blob = lib.encodeAudioBufferToWav(mixBuf)
    await ctx.close()

    // base64 the WAV
    const ab = await blob.arrayBuffer()
    const bytes = new Uint8Array(ab)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return { b64: btoa(bin), duration: len / 44100 }
  })
  const mixPath = join(ASSETS, 'mix-showcase.wav')
  writeFileSync(mixPath, Buffer.from(mixtureB64.b64, 'base64'))
  assert(true, 'TTS+music mixture built with production WAV encoder', `${mixtureB64.duration.toFixed(1)}s -> ${mixPath}`)

  /* ---- 2. Import mixture + music bed through the real media panel ---- */
  console.log('--- Step 2: Importing mixture and music via media panel ---')
  // Clicking an already-active left tab COLLAPSES the dock; open via store so
  // the media panel stays expanded for the import + add-to-timeline clicks.
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    if (st.leftTab !== 'media' || !st.leftOpen) st.setLeftTab('media')
  })
  await page.waitForTimeout(400)
  await page.getByTestId('panel-all-import-input').setInputFiles([mixPath, join(ASSETS, 'full-band.wav')])
  await page.waitForTimeout(600)

  /* ---- 3. Place both on the timeline (add + combine) ---- */
  console.log('--- Step 3: Adding mixture and music to the timeline ---')
  for (const name of ['mix-showcase.wav', 'full-band.wav']) {
    const addBtn = page.getByRole('button', { name: `Add ${name} to timeline` })
    await addBtn.waitFor({ state: 'visible', timeout: 5000 })
    await addBtn.click({ force: true })
    await page.waitForTimeout(300)
  }
  const timelineState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      clips: s.clips.map((c) => ({ id: c.id, name: c.name, kind: c.kind, start: c.start, duration: c.duration, volume: c.volume })),
      tracks: s.tracks.map((t) => ({ id: t.id, type: t.type })),
    }
  })
  const mixClip = timelineState.clips.find((c) => c.name === 'mix-showcase.wav')
  const musicClip = timelineState.clips.find((c) => c.name === 'full-band.wav')
  assert(Boolean(mixClip), 'Mixture clip placed on timeline')
  assert(Boolean(musicClip), 'Music bed clip placed on timeline')
  assert(mixClip.kind === 'audio' && musicClip.kind === 'audio', 'Both clips are audio kind')
  assert(
    timelineState.tracks.some((t) => t.type === 'audio'),
    'Audio track exists for the combined session',
  )

  /* ---- 4. Voice isolation modal on the mixture clip ---- */
  console.log('--- Step 4: Running Keep Vocal isolation through the modal ---')
  await page.evaluate(() => {
    const st = window.__omniframe_store.getState()
    if (st.leftTab !== 'audio' || !st.leftOpen) st.setLeftTab('audio')
  })
  await page.waitForTimeout(400)
  const panel = page.locator('[data-testid="voice-isolation-panel"]')
  await panel.waitFor({ state: 'visible', timeout: 5000 })
  assert(await panel.isVisible(), 'Voice Isolation panel opens from the Audio tab')

  await page.getByTestId('panel-voice-settings-btn').click()
  const modal = page.locator('[data-testid="voice-isolation-modal"]')
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  assert(await modal.isVisible(), 'Voice Isolation modal opens')

  const select = page.getByTestId('voice-isolation-clip-select')
  const optionValue = await select.locator('option', { hasText: 'mix-showcase.wav' }).getAttribute('value')
  await select.selectOption(optionValue)
  await page.locator('[data-testid="mode-keep-vocal-btn"]').click()
  await page.locator('[data-testid="voice-isolation-strength-slider"]').fill('0.92')
  assert(await page.locator('[data-testid="speech-focus-toggle"]').isChecked(), 'Speech formant bandpass enabled by default')

  await page.screenshot({ path: join(EVIDENCE, 'voice-isolation-modal-mixture.png') })
  await page.getByTestId('execute-voice-isolation-btn').click()

  // The DSP runs on a 20 s file: watch the modal until it auto-closes, then
  // poll the store briefly — clip creation is synchronous with completion,
  // but the auto-close fires 600 ms later and React batching can trail.
  let modalError = null
  for (let t = 0; t < 45; t++) {
    await page.waitForTimeout(1000)
    const visible = await modal.isVisible().catch(() => false)
    if (!visible) break
    modalError = await page
      .locator('[data-testid="voice-isolation-error-alert"]')
      .innerText()
      .catch(() => null)
    if (modalError) break
  }
  const modalGone = !(await modal.isVisible().catch(() => false))
  assert(modalGone, 'Isolation executed and modal closed on completion', modalError || '')
  await page.waitForTimeout(500)

  /* ---- 5. Store verification: synchronized clip, muted source ---- */
  console.log('--- Step 5: Verifying synchronized isolated clip and muted source ---')
  let postState = null
  for (let t = 0; t < 15; t++) {
    postState = await page.evaluate(() => {
      const s = window.__omniframe_store.getState()
      return {
        clips: s.clips.map((c) => ({ id: c.id, name: c.name, kind: c.kind, start: c.start, duration: c.duration, volume: c.volume, trackId: c.trackId })),
        assets: s.assets.filter((a) => a.kind === 'audio').map((a) => ({ id: a.id, name: a.name, url: a.url, duration: a.duration, waveformBins: a.waveform?.length || 0 })),
      }
    })
    if (postState.clips.some((c) => c.name.includes('[Vocal Isolated'))) break
    await page.waitForTimeout(1000)
  }
  assert(
    postState.clips.some((c) => c.name.includes('[Vocal Isolated')),
    'Isolation produced a clip on the timeline',
    JSON.stringify(postState.clips.map((c) => c.name)),
  )
  const isolatedClip = postState.clips.find((c) => c.name.includes('[Vocal Isolated') && c.name.includes('mix-showcase'))
  const isolatedAsset = postState.assets.find((a) => a.name.includes('[Vocal Isolated') && a.name.includes('mix-showcase'))
  assert(Boolean(isolatedClip), 'Isolated clip created on timeline', isolatedClip?.name)
  assert(Boolean(isolatedAsset), 'Isolated asset registered in media library', isolatedAsset?.name)
  assert(isolatedAsset.waveformBins === 256, 'Isolated asset has 256-bin waveform', String(isolatedAsset.waveformBins))
  const sourceClipAfter = postState.clips.find((c) => c.id === mixClip.id)
  assert(sourceClipAfter.volume === 0, 'Source mixture clip muted to volume 0 after isolation')
  assert(
    Math.abs(isolatedClip.start - sourceClipAfter.start) < 1e-6 && Math.abs(isolatedClip.duration - sourceClipAfter.duration) < 1e-6,
    'Isolated clip is sample-synced with the source clip',
    `start ${isolatedClip.start}s duration ${isolatedClip.duration}s`,
  )
  assert(
    postState.clips.filter((c) => c.kind === 'audio').length >= 3,
    'Timeline combines music bed + mixture + isolated voice',
    `${postState.clips.filter((c) => c.kind === 'audio').length} audio clips`,
  )

  await page.screenshot({ path: join(EVIDENCE, 'voice-isolation-combined-timeline.png'), fullPage: false })

  /* ---- 6. Fetch the produced WAV and verify with FFmpeg ---- */
  console.log('--- Step 6: Verifying the isolated WAV with FFmpeg ---')
  const isolatedB64 = await page.evaluate(async (url) => {
    const res = await fetch(url)
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
    }
    return btoa(bin)
  }, isolatedAsset.url)
  const isolatedPath = join(EVIDENCE, 'mix-showcase-isolated.wav')
  writeFileSync(isolatedPath, Buffer.from(isolatedB64, 'base64'))
  assert(true, 'Isolated WAV retrieved from the app', isolatedPath)

  const rmsDb = (file, filter) => {
    const out = spawnSync(
      ffmpegInstaller.path,
      ['-nostdin', '-hide_banner', '-i', file, '-af', `${filter},astats=metadata=0`, '-f', 'null', '-'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    )
    if (out.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${out.stderr.slice(-500)}`)
    const dBs = [...out.stderr.matchAll(/RMS level dB:\s*(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -200 : Number(m[1])))
    return dBs.length ? Math.max(...dBs) : -200
  }
  const durationOf = (file) => {
    const out = spawnSync(ffmpegInstaller.path, ['-nostdin', '-hide_banner', '-i', file], { encoding: 'utf8' })
    const m = out.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
  }

  const mixDur = durationOf(mixPath)
  const isoDur = durationOf(isolatedPath)
  assert(Math.abs(mixDur - isoDur) < 0.15, 'Isolated duration preserved', `${isoDur.toFixed(2)}s vs ${mixDur.toFixed(2)}s`)

  // Side channel (L-R): the keep_vocal output is dual-mono, so side energy
  // must collapse to silence while the mixture carries real stereo music.
  const sideFilter = 'pan=mono|c0=0.5*c0-0.5*c1'
  const mixSideDb = rmsDb(mixPath, sideFilter)
  const isoSideDb = rmsDb(isolatedPath, sideFilter)
  assert(
    isoSideDb < -80 && mixSideDb > -60,
    'Stereo side (instrument) channel collapsed to silence in isolated output',
    `mix side ${mixSideDb.toFixed(1)}dB -> isolated side ${isoSideDb.toFixed(1)}dB`,
  )

  // Spectral shape checks. The speech bandpass is a 2nd-order SVF (12 dB/oct)
  // and the synthesized beds carry little >7.5k energy, so absolute air-band
  // drops are small by construction; thresholds calibrated on this material.
  const monoMid = 'pan=mono|c0=0.5*c0+0.5*c1'
  const bandDb = (file, filter) => rmsDb(file, `${monoMid},${filter}`)

  // Sub-80Hz kick/rumble must be reduced by the 130Hz speech highpass.
  const subMixDb = await bandDb(mixPath, 'lowpass=f=80')
  const subIsoDb = await bandDb(isolatedPath, 'lowpass=f=80')
  assert(
    subMixDb - subIsoDb >= 4,
    'Sub-80Hz rumble/kick reduced by the 130Hz speech highpass',
    `mix ${subMixDb.toFixed(1)}dB -> isolated ${subIsoDb.toFixed(1)}dB`,
  )

  // Speech band must survive: within 3 dB of the mixture's own speech band.
  const speechFilter = 'highpass=f=300,lowpass=f=3000'
  const speechMixDb = await bandDb(mixPath, speechFilter)
  const speechIsoDb = await bandDb(isolatedPath, speechFilter)
  assert(
    Math.abs(speechIsoDb - speechMixDb) <= 3 && speechIsoDb > -30,
    'Speech band (300Hz-3kHz) preserved',
    `mix ${speechMixDb.toFixed(1)}dB -> isolated ${speechIsoDb.toFixed(1)}dB`,
  )

  // Air band above the speech bandpass corner: attenuated by the 6.5k
  // lowpass (gentle 2nd-order slope; the bed itself is quiet up here).
  const airMixDb = await bandDb(mixPath, 'highpass=f=7500')
  const airIsoDb = await bandDb(isolatedPath, 'highpass=f=7500')
  assert(
    airMixDb - airIsoDb >= 1,
    '>7.5kHz air band attenuated by the speech lowpass',
    `mix ${airMixDb.toFixed(1)}dB -> isolated ${airIsoDb.toFixed(1)}dB`,
  )
  const air10MixDb = await bandDb(mixPath, 'highpass=f=10000')
  const air10IsoDb = await bandDb(isolatedPath, 'highpass=f=10000')
  assert(
    air10MixDb - air10IsoDb >= 2,
    '>10kHz band attenuated further up the rolloff slope',
    `mix ${air10MixDb.toFixed(1)}dB -> isolated ${air10IsoDb.toFixed(1)}dB`,
  )

  assert(pageErrors.length === 0, 'Zero runtime page errors', pageErrors.join(' | '))

  writeFileSync(
    join(REPORTS, 'voice-tts-mix-isolation.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mixture: { file: mixPath, duration: mixDur },
        metrics: {
          sideRmsDb: { mix: mixSideDb, isolated: isoSideDb },
          sub80RmsDb: { mix: subMixDb, isolated: subIsoDb },
          speechBandRmsDb: { mix: speechMixDb, isolated: speechIsoDb },
          airBandRmsDb: { mix: airMixDb, isolated: airIsoDb },
          air10kRmsDb: { mix: air10MixDb, isolated: air10IsoDb },
        },
        results,
        pageErrors,
      },
      null,
      2,
    ),
  )
  console.log(`\nRESULT ${results.length} PASS — report: qa/reports/voice-tts-mix-isolation.json`)
} finally {
  await browser.close()
}
