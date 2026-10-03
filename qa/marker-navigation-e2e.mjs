/**
 * Marker Navigation E2E
 * =====================
 *
 * Guards the marker navigation added when the audit found that
 * jumpToNextMarker / jumpToPrevMarker / jumpToMarker were fully implemented
 * in the store but had no binding at all — markers were a shipped feature
 * (add button, timeline markers, snapping) with no way to move between them.
 *
 * Bindings under test:
 *   Alt+ArrowRight  -> jumpToNextMarker
 *   Alt+ArrowLeft   -> jumpToPrevMarker
 *   marker dialog   -> "Go to" button calls jumpToMarker
 *
 * Also asserts plain Arrow keys still step frames/seconds, since the
 * Alt-handling was added inside the existing ArrowLeft/ArrowRight cases and
 * must not change their behaviour.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const EVIDENCE_DIR = path.resolve('evidence/screenshots')
const REPORTS_DIR = path.resolve('qa/reports')
fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
fs.mkdirSync(REPORTS_DIR, { recursive: true })

const results = []
function check(name, pass, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  results.push({ name, pass, detail })
}

const playhead = (page) => page.evaluate(() => window.__omniframe_store.getState().playhead)

async function run() {
  console.log('=== Marker Navigation E2E ===')
  try {
    await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
    process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
  } catch (e) {
    console.log('Inflate notice:', e.message)
  }

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  try {
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    // Seed a known timeline: three clips so the timeline is live, and four
    // markers at 1s / 3s / 6s / 9s.
    const markers = await page.evaluate(() => {
      const st = window.__omniframe_store.getState()
      // Clear anything a previous state left behind.
      for (const m of [...st.markers]) st.removeMarker(m.id)
      const times = [1, 3, 6, 9]
      return times.map((t, i) =>
        st.addMarker({ time: t, label: `M${i + 1}`, color: 'blue' }),
      )
    })
    check('R1 seeded four markers at 1s/3s/6s/9s', markers.length === 4, `${markers.length} markers`)

    const count = await page.evaluate(() => window.__omniframe_store.getState().markers.length)
    check('R1b store holds exactly the seeded markers', count === 4, `${count} in store`)

    // ---- Alt+ArrowRight steps FORWARD through markers ----------------------
    await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
    await page.waitForTimeout(150)

    const seq = []
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Alt+ArrowRight')
      await page.waitForTimeout(200)
      seq.push(Number((await playhead(page)).toFixed(3)))
    }
    console.log(`   Alt+Right sequence from 0: ${JSON.stringify(seq)}`)
    check(
      'R2 Alt+ArrowRight walks forward 1 -> 3 -> 6 -> 9',
      seq[0] === 1 && seq[1] === 3 && seq[2] === 6 && seq[3] === 9,
      JSON.stringify(seq),
    )

    // Past the last marker there is nowhere to go; the playhead must not move.
    await page.keyboard.press('Alt+ArrowRight')
    await page.waitForTimeout(200)
    const afterLast = Number((await playhead(page)).toFixed(3))
    check('R3 Alt+ArrowRight past the last marker holds position', afterLast === 9, `playhead=${afterLast}`)

    // ---- Alt+ArrowLeft steps BACKWARD --------------------------------------
    const back = []
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Alt+ArrowLeft')
      await page.waitForTimeout(200)
      back.push(Number((await playhead(page)).toFixed(3)))
    }
    console.log(`   Alt+Left sequence from 9: ${JSON.stringify(back)}`)
    check(
      'R4 Alt+ArrowLeft walks backward 9 -> 6 -> 3 -> 1',
      back[0] === 6 && back[1] === 3 && back[2] === 1,
      JSON.stringify(back),
    )

    await page.keyboard.press('Alt+ArrowLeft')
    await page.waitForTimeout(200)
    const beforeFirst = Number((await playhead(page)).toFixed(3))
    check('R5 Alt+ArrowLeft before the first marker holds position', beforeFirst === 1, `playhead=${beforeFirst}`)

    // ---- REGRESSION: plain Arrow must still step frames --------------------
    await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(4))
    await page.waitForTimeout(150)
    const fps = await page.evaluate(() => window.__omniframe_store.getState().projectFps || 30)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const stepped = await playhead(page)
    const expectedStep = Number((4 + 1 / fps).toFixed(4))
    check(
      'R6 plain ArrowRight still steps one frame (Alt did not hijack it)',
      Math.abs(stepped - expectedStep) < 0.01,
      `${stepped.toFixed(4)} vs expected ${expectedStep.toFixed(4)}`,
    )

    await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(4))
    await page.waitForTimeout(150)
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.up('Shift')
    await page.waitForTimeout(200)
    const shiftStepped = await playhead(page)
    check(
      'R6b Shift+ArrowRight still steps one second',
      Math.abs(shiftStepped - 5) < 0.01,
      `${shiftStepped.toFixed(4)} vs expected 5`,
    )

    // ---- "Go to" button in the marker dialog -------------------------------
    await page.evaluate(() => window.__omniframe_store.getState().setPlayhead(0))
    await page.waitForTimeout(150)
    const lastMarkerId = await page.evaluate(() => {
      const st = window.__omniframe_store.getState()
      const m = [...st.markers].sort((a, b) => b.time - a.time)[0]
      st.setActiveMarkerModalId(m.id)
      return m.id
    })
    await page.waitForTimeout(400)

    const dialog = await page.waitForSelector('[data-testid="marker-modal"]', { timeout: 4000 })
    check('R7 marker dialog opens', !!dialog)

    const gotoBtn = await page.waitForSelector('[data-testid="goto-marker-btn"]', { timeout: 3000 })
    check('R8 dialog exposes a "Go to" button', !!gotoBtn)

    await gotoBtn.click()
    await page.waitForTimeout(300)
    const afterGoto = Number((await playhead(page)).toFixed(3))
    check('R9 "Go to" moves the playhead to that marker (9s)', afterGoto === 9, `playhead=${afterGoto}`)

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'marker-navigation.png') })
    console.log('✓ Saved marker-navigation.png')

    check('R10 no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  } catch (err) {
    console.error('FATAL:', err.message)
    check('suite completed without fatal error', false, err.message)
  } finally {
    await browser.close()
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed
  console.log(`\n=== ${passed} passed / ${failed} failed ===`)
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'marker-navigation.json'),
    JSON.stringify(results, null, 2),
  )
  process.exit(failed > 0 ? 1 : 0)
}

run()
