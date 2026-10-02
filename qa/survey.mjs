/**
 * One-off survey: enumerate every reachable UI state and count the controls in
 * each, so the strict audit knows how big the surface really is.
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import path from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs'

const ROOT = process.cwd()
try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) { /* already inflated */ }

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', () => {})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

// Enter the studio if a landing screen is showing.
const landed = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find(x => /open|studio|launch|start|get started|continue|editor/i.test(x.textContent || ''))
  if (b) { b.click(); return b.textContent.trim().slice(0, 40) }
  return null
})
console.log('landing click:', landed)
await page.waitForTimeout(2500)

const survey = await page.evaluate(() => {
  const out = { panels: [], tabs: [], totalControls: 0, sections: [] }
  // left dock tabs
  const dockBtns = [...document.querySelectorAll('button')].filter(b => b.querySelector('svg'))
  out.dockIconButtons = dockBtns.length
  return out
})
console.log(JSON.stringify(survey, null, 2))

// Enumerate left tabs by clicking each icon button and counting controls.
const n = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.querySelector('svg')).length)
const results = []
for (let i = 0; i < Math.min(n, 14); i++) {
  try {
    const info = await page.evaluate((idx) => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.querySelector('svg'))
      const b = btns[idx]
      if (!b) return null
      b.click()
      return true
    }, i)
    if (!info) continue
    await page.waitForTimeout(900)
    const snap = await page.evaluate(() => {
      const ctrl = document.querySelectorAll('button, input, select, textarea, [role="button"], [role="tab"]')
      const secs = [...document.querySelectorAll('[data-testid$="-section"]')].map(s => s.getAttribute('data-testid'))
      return { controls: ctrl.length, sections: secs }
    })
    results.push({ i, ...snap })
  } catch (e) { results.push({ i, err: e.message.slice(0, 60) }) }
}
console.log('--- per left-tab ---')
for (const r of results) console.log(`  tab#${r.i}: ${r.controls} controls, ${r.sections.length} sections`, r.err || '')

fs.writeFileSync(path.join(ROOT, 'qa/reports/survey.json'), JSON.stringify(results, null, 2))
await browser.close()
