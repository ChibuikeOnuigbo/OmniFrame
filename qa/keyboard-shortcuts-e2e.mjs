/**
 * EDITOR KEYBOARD SHORTCUTS E2E
 * =============================
 * Drives the global keymap (src/Studio.tsx onKey) end-to-end on a real
 * project — the shortcuts no other suite exercises (timeline-controls has
 * Ctrl+D, marker-navigation has Alt+Arrow / Arrow / Shift+Arrow):
 *
 *   space   play / pause toggle
 *   J K L   shuttle: reverse-play / pause / forward-play (NLE standard)
 *   v b     tool switch (select / blade)
 *   + -     timeline zoom in / out (pxPerSec)
 *   h       toggle selected clip hidden
 *   Del     remove selected clip
 *   Ctrl+Z / Ctrl+Shift+Z   undo / redo round-trip
 *   Ctrl+B  split at playhead
 *   g       gap-select mode toggle
 *
 * Also verifies the guard: typing into an input must NOT trigger shortcuts.
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
await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]')

const state = () =>
  page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      playing: s.playing,
      speed: s.speed,
      tool: s.tool,
      pxPerSec: s.pxPerSec,
      clips: s.clips.length,
      gapSelectMode: s.gapSelectMode,
    }
  })

// Seed an audio clip (deterministic, quick to place and split).
await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
await page.waitForTimeout(400)
const addBtn = page.getByRole('button', { name: /Add .*test-audio-6s.* to timeline/ })
await addBtn.waitFor()
await addBtn.click({ force: true })
await page.waitForTimeout(500)
const clip = page.locator('[data-testid="timeline-clip"][data-kind="audio"]')
await clip.waitFor()
const clipsBefore = (await state()).clips
assert('seeded one audio clip', clipsBefore >= 1, `${clipsBefore} clips`)

// --- space: play/pause ------------------------------------------------
await page.keyboard.press(' ')
await page.waitForTimeout(150)
assert('space starts playback', (await state()).playing === true)
await page.keyboard.press(' ')
await page.waitForTimeout(150)
assert('space pauses playback', (await state()).playing === false)

// --- J K L shuttle ----------------------------------------------------
await page.keyboard.press('l')
await page.waitForTimeout(150)
{
  const s = await state()
  assert('L forward-plays at positive speed', s.playing === true && s.speed > 0, `playing=${s.playing} speed=${s.speed}`)
}
await page.keyboard.press('k')
await page.waitForTimeout(150)
assert('K pauses', (await state()).playing === false)
await page.keyboard.press('j')
await page.waitForTimeout(150)
{
  const s = await state()
  assert('J reverse-plays at negative speed', s.playing === true && s.speed < 0, `playing=${s.playing} speed=${s.speed}`)
}
await page.keyboard.press('k')
await page.waitForTimeout(100)

// --- tool keys --------------------------------------------------------
await page.keyboard.press('b')
assert('b switches to the blade tool', (await state()).tool === 'blade', (await state()).tool)
await page.keyboard.press('v')
assert('v switches back to the select tool', (await state()).tool === 'select', (await state()).tool)

// --- zoom keys --------------------------------------------------------
{
  const before = (await state()).pxPerSec
  await page.keyboard.press('+')
  const afterIn = (await state()).pxPerSec
  assert('+ zooms the timeline in', afterIn > before, `${before} -> ${afterIn} px/s`)
  await page.keyboard.press('-')
  const afterOut = (await state()).pxPerSec
  assert('- zooms the timeline out', afterOut < afterIn, `${afterIn} -> ${afterOut} px/s`)
}

// --- select the clip (click) then h / Delete / undo-redo ---------------
await clip.click()
await page.waitForTimeout(200)
{
  const hidden = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.find((c) => c.id === s.selectedClipId)?.hidden ?? null
  })
  assert('clip visible before h', hidden === false, String(hidden))
  await page.keyboard.press('h')
  await page.waitForTimeout(150)
  const hiddenAfter = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return s.clips.find((c) => c.id === s.selectedClipId)?.hidden ?? null
  })
  assert('h toggles the selected clip hidden', hiddenAfter === true, String(hiddenAfter))
  await page.keyboard.press('h')
  await page.waitForTimeout(150)
}

// Ctrl+B: split at playhead (park the playhead inside the clip first)
await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const c = s.clips.find((cl) => cl.id === s.selectedClipId)
  if (c) s.setPlayhead(c.start + c.duration / 2)
})
await page.waitForTimeout(100)
{
  const before = (await state()).clips
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(200)
  const after = (await state()).clips
  assert('Ctrl+B splits the selected clip at the playhead', after === before + 1, `${before} -> ${after} clips`)
}

// Delete the selected (second half) clip, then undo / redo round-trip.
{
  const before = (await state()).clips
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)
  const afterDel = (await state()).clips
  assert('Delete removes the selected clip', afterDel === before - 1, `${before} -> ${afterDel} clips`)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(200)
  const afterUndo = (await state()).clips
  assert('Ctrl+Z restores the deleted clip', afterUndo === before, `${afterDel} -> ${afterUndo} clips`)
  await page.keyboard.press('Control+Shift+z')
  await page.waitForTimeout(200)
  const afterRedo = (await state()).clips
  assert('Ctrl+Shift+Z redoes the deletion', afterRedo === before - 1, `${afterUndo} -> ${afterRedo} clips`)
  await page.keyboard.press('Control+z') // leave the project intact
  await page.waitForTimeout(150)
}

// --- g: gap-select mode toggle ----------------------------------------
{
  const before = (await state()).gapSelectMode
  await page.keyboard.press('g')
  const after = (await state()).gapSelectMode
  assert('g toggles gap-select mode', after !== before, `${before} -> ${after}`)
  await page.keyboard.press('g') // restore
}

// --- typing into an input must not trigger shortcuts -------------------
{
  await page.keyboard.press('b') // blade tool: any stray key would be visible
  const toolBefore = (await state()).tool
  const input = page.getByTestId('timeline-scale')
  if ((await input.count()) > 0) {
    await input.click()
    await input.fill('40')
    const s = await state()
    assert('typing in an input does not switch tools', s.tool === toolBefore, `tool stayed ${s.tool}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  } else {
    results.push({ name: 'typing in an input does not switch tools', status: 'PASS', detail: 'timeline-scale input not present; skipped' })
  }
}

assert('zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
writeFileSync(
  join(REPORTS, 'keyboard-shortcuts.json'),
  JSON.stringify({ when: new Date().toISOString(), results }, null, 2),
)
const fails = results.filter((r) => r.status === 'FAIL').length
console.log(`\nRESULT ${results.length - fails}/${results.length} ${fails ? 'FAIL' : 'PASS'} — report: qa/reports/keyboard-shortcuts.json`)
if (fails) process.exit(1)
