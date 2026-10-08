/**
 * INSPECTOR AUDIO SECTION E2E
 * ===========================
 * The Audio section must appear in the clip inspector for EVERY clip that can
 * carry sound — video clips included, not just audio clips — and it hosts the
 * audio toolset: Volume, Voice Isolation (with the AI Denoise ONNX engine
 * option) and Loudness Normalization.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(REPORTS, { recursive: true })

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

const activateSection = async (id) => {
  const chip = page.locator(`[data-testid="section-tab-${id}"]`)
  if ((await chip.count()) > 0) {
    if ((await chip.getAttribute('aria-selected')) !== 'true') {
      await chip.click()
      await page.waitForTimeout(250)
    }
    return
  }
  const btn = page.locator(`[data-testid="panel-section-${id}"] > button`)
  if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') {
    await btn.click()
    await page.waitForTimeout(200)
  }
}

/**
 * Places a clip of the given kind from the store's demo assets / an imported
 * fixture, selects it, and returns the clip id.
 */
const placeClip = async (kind) => {
  if (kind === 'audio') {
    // Import the speech fixture through the real media panel.
    const input = page.getByTestId('panel-all-import-input')
    await input.setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
    await page.waitForTimeout(600)
    return page.evaluate(() => {
      const api = window.__omniframe_store.getState()
      const asset = api.assets.find((a) => a.name.includes('test-audio-6s'))
      if (!asset) throw new Error('fixture asset not imported')
      const trackId = api.ensureTrack('audio')
      api.addClipToTrack(trackId, asset.id, 0)
      const fresh = window.__omniframe_store.getState()
      const clip = fresh.clips[fresh.clips.length - 1]
      window.__omniframe_store.setState({ selectedClipId: clip.id, rightOpen: true })
      return clip.id
    })
  }
  return page.evaluate(() => {
    const api = window.__omniframe_store.getState()
    const trackId = api.ensureTrack('video')
    api.addClipToTrack(trackId, 'asset-death-note-vid', 0)
    // re-read state: the captured snapshot is stale after mutations
    const fresh = window.__omniframe_store.getState()
    const clip = fresh.clips[fresh.clips.length - 1]
    window.__omniframe_store.setState({ selectedClipId: clip.id, rightOpen: true })
    return clip.id
  })
}

const checkAudioSection = async (kind) => {
  console.log(`--- ${kind} clip selected ---`)
  const clipId = await placeClip(kind)
  await page.waitForTimeout(500)
  // Tabs mode shows the section as a chip; accordion mode as a header.
  const reachable = await page.locator('[data-testid="section-tab-audio"], [data-testid="section-header-audio"]').count()
  assert(`${kind}: inspector Audio section present`, reachable >= 1, `${reachable} surfaces`)

  await activateSection('audio')
  await page.waitForTimeout(300)

  const volume = page.locator('#left-panel ~ * , [data-testid="inspector-panel"]').locator('input[type="range"]').first()
  assert(`${kind}: Volume slider visible`, (await page.locator('[data-testid="inspector-panel"] input[type="range"]').count()) >= 1)

  assert(`${kind}: Voice Isolation option present`, (await page.locator('[data-testid="audio-voice-isolation-checkbox"]').count()) === 1)
  assert(`${kind}: Loudness Normalization present`, (await page.locator('[data-testid="audio-loudness-checkbox"]').count()) === 1)

  // Voice isolation controls: the engine dropdown is mode-gated — the
  // keep_vocal-only engines (AI Denoise ONNX, RNNoise) render only in
  // keep_vocal mode, while Demucs v4 and omni-unified-v1 work in both
  // modes. Default mode is remove_vocal, so check the gating both ways.
  await page.locator('[data-testid="audio-voice-isolation-checkbox"]').check()
  await page.waitForTimeout(300)
  const modeDropdown = page.locator('[data-testid="audio-isolation-mode-dropdown"]')
  const dropdown = page.locator('[data-testid="audio-isolation-model-dropdown"]')
  const optionsInMode = async () => (await dropdown.locator('option').allTextContents()).join(' | ')

  await modeDropdown.selectOption('remove_vocal')
  await page.waitForTimeout(300)
  const keepOnlyTexts = await optionsInMode()
  assert(
    `${kind}: keep-only engines hidden in remove_vocal`,
    !keepOnlyTexts.includes('AI Denoise ONNX') && !keepOnlyTexts.includes('RNNoise'),
    keepOnlyTexts,
  )
  assert(
    `${kind}: both-mode engines offered in remove_vocal`,
    keepOnlyTexts.includes('Demucs v4') && keepOnlyTexts.includes('omni-unified-v1'),
    keepOnlyTexts,
  )

  await modeDropdown.selectOption('keep_vocal')
  await page.waitForTimeout(300)
  const keepVocalTexts = await optionsInMode()
  assert(
    `${kind}: AI Denoise ONNX model offered in keep_vocal`,
    keepVocalTexts.includes('AI Denoise ONNX'),
    keepVocalTexts,
  )
  assert(
    `${kind}: RNNoise offered in keep_vocal`,
    keepVocalTexts.includes('RNNoise'),
    keepVocalTexts,
  )
  assert(
    `${kind}: Demucs v4 + omni-unified offered in keep_vocal`,
    keepVocalTexts.includes('Demucs v4') && keepVocalTexts.includes('omni-unified-v1'),
    keepVocalTexts,
  )
  // restore the default mode for the rest of the sweep
  await modeDropdown.selectOption('remove_vocal')

  // Loudness controls expand with target slider + measured readout
  const loudBox = page.locator('[data-testid="audio-loudness-checkbox"]')
  if (!(await loudBox.isChecked())) await loudBox.check()
  await page.waitForTimeout(300)
  assert(`${kind}: loudness target slider visible`, (await page.locator('[data-testid="audio-loudness-target-slider"]').count()) === 1)
  assert(`${kind}: loudness apply button visible`, (await page.locator('[data-testid="audio-loudness-apply-btn"]').count()) === 1)

  // Re-measure for THIS clip (the readout may hold the previous clip's value).
  await page.locator('[data-testid="audio-loudness-remasure-btn"]').click().catch(() => {})
  await page.waitForTimeout(kind === 'audio' ? 1500 : 600)

  return clipId
}

await checkAudioSection('video')
await checkAudioSection('audio')

/* Loudness measured readout works on the speech clip (async decode) */
await page.locator('[data-testid="audio-loudness-remasure-btn"]').click().catch(() => {})
await page
  .locator('[data-testid="audio-loudness-measured"]')
  .waitFor({ state: 'visible', timeout: 8000 })
  .catch(() => {})
await page.waitForTimeout(1500)
const measured = await page.locator('[data-testid="audio-loudness-measured"]').innerText().catch(() => '')
assert('Loudness measured for the selected clip', /LUFS/.test(measured), measured)

/* The left-dock Audio panel offers the same AI engine choice */
await page.locator('[data-testid="left-tab-audio"]').click()
await page.waitForTimeout(400)
const engineSelect = page.locator('[data-testid="panel-engine-select"]')
assert('Audio panel has an engine selector', (await engineSelect.count()) === 1)
await engineSelect.selectOption('neural')
await page.waitForTimeout(200)
const engineValue = await engineSelect.inputValue()
assert('Audio panel engine can select the ONNX AI Denoise', engineValue === 'neural', engineValue)
const panelVisible = await page.locator('[data-testid="voice-isolation-panel"]').isVisible()
assert('Voice Isolation panel visible with clip picker (user selects the media)', panelVisible)

assert('Zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
writeFileSync(
  join(REPORTS, 'inspector-audio-all-clips.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), results, pageErrors }, null, 2),
)
const passCount = results.filter((r) => r.status === 'PASS').length
console.log(`\nRESULT ${passCount}/${results.length} PASS — report: qa/reports/inspector-audio-all-clips.json`)
