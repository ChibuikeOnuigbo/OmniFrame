/**
 * AXE ACCESSIBILITY E2E
 * =====================
 * Standard-rule accessibility scan (axe-core) on the app's main surfaces,
 * complementing the hand-rolled rules in qa/ui-strict-audit.mjs:
 *
 *   - studio boot (empty project)
 *   - seeded project with a selected clip (inspector open)
 *   - each left-dock tab
 *   - mobile viewport (390) for the boot + media tab
 *
 * Serious violations (critical/serious impact) fail the run; moderate
 * findings are reported for triage. Rules that require sighted judgement
 * or are known-noisy for canvas editors (e.g. color-contrast on timeline
 * thumbnails, region rules on the canvas app shell) are individually
 * disabled with a reason — the list is auditable, not a blanket skip.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(REPORTS, { recursive: true })

const AXE_SRC = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')

// Individually-disabled rules — each with a reason.
const DISABLED_RULES = [
  // The studio is a canvas editor: the stage is one big <canvas> region and
  // the app shell intentionally has no <main>/<nav> landmarks per-region.
  'region',
  'landmark-one-nested',
  'page-has-heading-one',
  // Timeline thumbnails/cel frames are user content rendered to canvas;
  // text alternatives are handled at the clip level (aria-labels on clips).
  'canvas-name',
  // Custom cursor replaces the system cursor in drawing modes; focus
  // indication is handled by the custom :focus-visible ring styles.
  'focus-order-semantics',
]

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

async function scanSurface(page, name) {
  const report = await page.evaluate(
    ({ axeSrc, disabled }) => {
      // eslint-disable-next-line no-eval
      (0, eval)(axeSrc)
      const known = new Set(window.axe.getRules().map((r) => r.ruleId))
      const rules = Object.fromEntries(disabled.filter((r) => known.has(r)).map((r) => [r, { enabled: false }]))
      return window.axe
        .run(document, { rules })
        .then((r) => ({
          violations: r.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            sample: v.nodes[0]?.target?.[0],
          })),
          incomplete: r.incomplete.length,
        }))
    },
    { axeSrc: AXE_SRC, disabled: DISABLED_RULES },
  )
  const serious = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  const moderate = report.violations.filter((v) => v.impact !== 'critical' && v.impact !== 'serious')
  assert(
    `${name}: zero critical/serious axe violations`,
    serious.length === 0,
    serious.map((v) => `${v.id}(${v.impact})×${v.nodes} [${v.sample}]`).join(' | ') || 'clean',
  )
  if (moderate.length) console.log(`  … ${name}: ${moderate.length} moderate/minor finding(s): ${moderate.map((v) => v.id).join(', ')}`)
  return report
}

// Desktop sweep
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]')
  await scanSurface(page, 'studio boot')

  // Seed + select a clip so the inspector + timeline render fully.
  await page.getByTestId('panel-all-import-input').setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
  await page.waitForTimeout(400)
  const addBtn = page.getByRole('button', { name: /Add .*test-audio-6s.* to timeline/ })
  await addBtn.waitFor()
  await addBtn.click({ force: true })
  await page.waitForTimeout(500)
  const clip = page.locator('[data-testid="timeline-clip"][data-kind="audio"]')
  await clip.waitFor()
  await clip.click()
  await page.waitForTimeout(500)
  await scanSurface(page, 'project with selected clip')

  for (const tab of ['media', 'text', 'transitions', 'effects', 'audio', 'relationships', 'drawing', 'omniframe', 'tracking', 'threed']) {
    const btn = page.getByTestId(`left-tab-${tab}`)
    if (!(await btn.count())) continue
    await btn.click()
    await page.waitForTimeout(400)
    await scanSurface(page, `left tab: ${tab}`)
  }
  assert('desktop sweep: zero page errors', pageErrors.length === 0, pageErrors.join(' | '))
  await page.close()
}

// Mobile sweep
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]')
  await scanSurface(page, 'mobile 390 boot')
  await page.close()
}

await browser.close()
writeFileSync(
  join(REPORTS, 'axe-a11y.json'),
  JSON.stringify({ when: new Date().toISOString(), disabledRules: DISABLED_RULES, results }, null, 2),
)
const fails = results.filter((r) => r.status === 'FAIL').length
console.log(`\nRESULT ${results.length - fails}/${results.length} ${fails ? 'FAIL' : 'PASS'} — report: qa/reports/axe-a11y.json`)
if (fails) process.exit(1)
