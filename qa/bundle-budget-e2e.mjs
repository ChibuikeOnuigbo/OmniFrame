/**
 * BUNDLE BUDGET E2E
 * =================
 * Guards the initial-payload budget of the PRODUCTION build (vite build +
 * vite preview), so a stray static import cannot silently re-inline a
 * heavyweight dependency:
 *
 *  1. The initial load fetches exactly ONE JavaScript file (code splitting
 *     stays flat; no surprise chunk fan-out on boot).
 *  2. Initial decoded JS payload stays under budget (1.6 MB decoded /
 *     480 KB compressed — the lazy-ORT win of 2026-10-09 put us at
 *     ~1.44 MB / ~375 KB; the budget leaves headroom without letting a
 *     400 KB dependency re-inline unnoticed).
 *  3. onnxruntime-web (404 KB minified) is NOT fetched on boot — it must
 *     only load when a neural feature actually runs.
 *  4. First contentful paint happens (the app really renders).
 *
 * Builds and serves itself: `node qa/bundle-budget-e2e.mjs`.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(REPORTS, { recursive: true })

const JS_BUDGET_DECODED = 1.6 * 1024 * 1024
const JS_BUDGET_TRANSFER = 480 * 1024
const PORT = 4179

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'pipe' })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${out.slice(-2000)}`))))
  })

console.log('building production bundle…')
await run('npx', ['vite', 'build'])

console.log('serving preview…')
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' })
try {
  // wait for the preview server to accept connections
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    up = await fetch(`http://localhost:${PORT}/`).then(() => true).catch(() => false)
    if (!up) await new Promise((r) => setTimeout(r, 250))
  }
  if (!up) throw new Error('vite preview did not come up')

  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  const jsRequests = []
  page.on('request', (r) => { if (r.url().endsWith('.js')) jsRequests.push(r.url().split('/').pop()) })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#studio`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const metrics = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js'))
    const paint = performance.getEntriesByType('paint')
    return {
      jsCount: res.length,
      decoded: res.reduce((s, e) => s + (e.decodedBodySize || 0), 0),
      transfer: res.reduce((s, e) => s + (e.transferSize || 0), 0),
      fcp: paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null,
    }
  })
  assert('initial load fetches exactly one JS file', metrics.jsCount === 1, `${metrics.jsCount}: ${jsRequests.join(', ')}`)
  assert(
    'initial decoded JS under budget',
    metrics.decoded > 0 && metrics.decoded < JS_BUDGET_DECODED,
    `${(metrics.decoded / 1024).toFixed(0)} KB decoded (budget ${(JS_BUDGET_DECODED / 1024).toFixed(0)} KB)`,
  )
  assert(
    'initial JS transfer (compressed) under budget',
    metrics.transfer > 0 && metrics.transfer < JS_BUDGET_TRANSFER,
    `${(metrics.transfer / 1024).toFixed(0)} KB transferred (budget ${(JS_BUDGET_TRANSFER / 1024).toFixed(0)} KB)`,
  )
  assert('onnxruntime-web NOT fetched on boot', !jsRequests.some((f) => f.startsWith('ort.bundle')), jsRequests.join(', '))
  assert('app renders (FCP recorded)', metrics.fcp !== null && metrics.fcp < 10000, `FCP ${metrics.fcp ? Math.round(metrics.fcp) : 'n/a'} ms`)
  assert('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))
  await browser.close()
} finally {
  preview.kill('SIGTERM')
}

writeFileSync(
  join(REPORTS, 'bundle-budget.json'),
  JSON.stringify({ when: new Date().toISOString(), budgets: { JS_BUDGET_DECODED, JS_BUDGET_TRANSFER }, results }, null, 2),
)
const fails = results.filter((r) => r.status === 'FAIL').length
console.log(`\nRESULT ${results.length - fails}/${results.length} ${fails ? 'FAIL' : 'PASS'} — report: qa/reports/bundle-budget.json`)
if (fails) process.exit(1)
