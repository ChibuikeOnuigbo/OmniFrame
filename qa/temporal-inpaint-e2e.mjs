/** Temporal Analyze & Inpaint E2E: scans donor frames, previews candidates, and applies a frame-addressed patch sequence. */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const ROOT = process.cwd()
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

async function openSection(page, testId, targetSelector) {
  const target = page.locator(targetSelector).first()
  if (await target.isVisible().catch(() => false)) return
  const trigger = page.locator(`#panel-section-trigger-${testId}`)
  if (await trigger.count()) await trigger.click()
  else await page.click(`[data-testid="section-tab-${testId}"]`)
  await target.waitFor({ state: 'visible', timeout: 8000 })
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })
  await page.evaluate(async () => {
    const store = window.__omniframe_store
    const state = store.getState()
    const trackId = state.ensureTrack('video')
    store.setState({ clips: [] })
    state.addClipToTrack(trackId, 'asset-death-note-vid', 0)
    const clip = store.getState().clips.find((candidate) => candidate.assetId === 'asset-death-note-vid')
    store.setState({
      clips: store.getState().clips.map((candidate) => candidate.id === clip?.id ? { ...candidate, duration: 1 } : candidate),
      selectedClipId: clip?.id ?? null,
      playhead: 0.2,
      rotoScope: { mode: 'range', start: 0, end: 0.3, step: 1 },
    })
    await store.getState().addRotoClick(0.111, 0.51, true)
  })

  await page.click('[data-testid="left-tab-omniframe"]')
  await page.waitForTimeout(250)
  await page.click('[data-testid="omniframe-section-rotomask"]')
  const analyze = page.locator('[data-testid="roto-inpaint-analyze"]')
  await openSection(page, 'roto-inpaint', '[data-testid="roto-inpaint-analyze"]')
  await analyze.click()
  await page.waitForFunction(
    () => ['ready', 'error'].includes(window.__omniframe_store.getState().rotoInpaint.phase),
    { timeout: 180000 },
  )

  const analysis = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    return {
      phase: state.rotoInpaint.phase,
      candidates: state.rotoInpaint.candidates.length,
      targets: state.rotoInpaint.targetFrames.length,
      donorAssignments: state.rotoInpaint.donorByTarget.filter((entry) => entry.donorFrame !== null).length,
      message: state.rotoInpaint.message,
    }
  })
  if (analysis.phase !== 'ready' || analysis.candidates < 1 || analysis.targets < 8 || analysis.donorAssignments < 1) {
    throw new Error(`Temporal analysis did not produce reviewable donors: ${JSON.stringify(analysis)}`)
  }

  mkdirSync(join(ROOT, 'evidence/screenshots'), { recursive: true })
  await page.locator('[data-testid="roto-inpaint-candidates"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(ROOT, 'evidence/screenshots/omniframe-temporal-inpaint-review.png'), fullPage: false })
  await page.locator('[data-testid="roto-inpaint-auto-source"]').click()
  await page.locator('[data-testid="roto-inpaint-apply"]').click()
  await page.waitForFunction(
    () => ['done', 'error'].includes(window.__omniframe_store.getState().rotoInpaint.phase),
    { timeout: 180000 },
  )
  const result = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((candidate) => candidate.name === 'Temporal Inpaint Patch')
    const clip = state.clips.find((candidate) => candidate.name === 'Temporal Inpaint (RotoMask)')
    return {
      phase: state.rotoInpaint.phase,
      frames: asset?.imageSequence?.frames?.length ?? 0,
      clipDuration: clip?.duration ?? 0,
      clipId: clip?.id ?? null,
      message: state.rotoInpaint.message,
    }
  })
  if (result.phase !== 'done' || result.frames < 8 || !result.clipId || result.clipDuration < 0.25) {
    throw new Error(`Temporal patch sequence was not applied: ${JSON.stringify(result)}`)
  }
  console.log(`PASS Analyze & Inpaint: ${analysis.candidates} donor previews, ${result.frames} target frames, ${result.clipDuration.toFixed(2)}s patch clip`)

  const resetReview = await page.evaluate(() => {
    const store = window.__omniframe_store
    store.getState().setRotoScope({ end: 0.4 })
    const inpaint = store.getState().rotoInpaint
    return { phase: inpaint.phase, candidates: inpaint.candidates.length, targets: inpaint.targetFrames.length }
  })
  if (resetReview.phase !== 'idle' || resetReview.candidates || resetReview.targets) {
    throw new Error(`Changing the frame scope must invalidate stale donor review: ${JSON.stringify(resetReview)}`)
  }
  console.log('PASS changing the frame scope clears stale donor/target review')
} finally {
  await browser.close()
}
