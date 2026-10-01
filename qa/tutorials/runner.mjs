/**
 * TUTORIAL REPLICATION RUNNER
 *
 * Takes published tutorials for CapCut, Premiere Pro, After Effects, Photoshop,
 * Krita and DaVinci Resolve, and replicates each procedure step-by-step inside
 * OmniFrame. Every step is recorded as PASS / FAIL / BLOCKED — FAIL means
 * OmniFrame cannot perform that step, which is the honest point of the exercise.
 *
 * Usage:  node qa/tutorials/runner.mjs [tutorialId ...]
 * Output: qa/tutorials/results/<id>.json
 *         evidence/tutorials/<id>-<n>.png
 *         qa/tutorials/results/summary.json
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const BASE = process.env.TEST_URL || 'http://localhost:5173'
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa/tutorials/registry.json'), 'utf8'))
const OUT = path.join(ROOT, 'qa/tutorials/results')
const SHOTS = path.join(ROOT, 'evidence/tutorials')
for (const d of [OUT, SHOTS]) fs.mkdirSync(d, { recursive: true })

try {
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${path.join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
} catch (e) {
  console.log('Inflate notice:', e.message)
}

const only = process.argv.slice(2)
const tutorials = only.length ? REG.tutorials.filter((t) => only.includes(t.id)) : REG.tutorials

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
await page.goto(`${BASE}/#studio`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// ---------------------------------------------------------------- page helpers
const HELPERS = `
  window.__t = {
    S: () => window.__omniframe_store.getState(),
    clips: () => window.__omniframe_store.getState().clips,
    tracks: () => window.__omniframe_store.getState().tracks,
    selectedClipIds: () => window.__omniframe_store.getState().selectedClipIds,
    paintLayers: () => window.__omniframe_store.getState().paintLayers || [],
    strokes: () => window.__omniframe_store.getState().drawingStrokes || [],
    trackPoints: () => window.__omniframe_store.getState().trackPoints || [],
    trackingSessions: () => window.__omniframe_store.getState().trackingSessions || [],
    guidedMatte: () => window.__omniframe_store.getState().guidedMatte || null,
    maskDisplayMode: () => (window.__omniframe_store.getState().activeSelection || {}).maskDisplayMode || null,
    clipMasks: () => window.__omniframe_store.getState().clipMasks || [],
    hasTestid: (id) => document.querySelectorAll('[data-testid="' + id + '"]').length > 0,
    grepDom: (reSrc) => {
      const re = new RegExp(reSrc, 'i')
      const text = document.body.innerText || ''
      const attrs = Array.from(document.querySelectorAll('[data-testid],[aria-label],[title]'))
        .map((n) => (n.getAttribute('data-testid') || '') + ' ' + (n.getAttribute('aria-label') || '') + ' ' + (n.getAttribute('title') || ''))
        .join(' ')
      return re.test(text) || re.test(attrs)
    },
  }
`
await page.evaluate(HELPERS)
await page.evaluate(HELPERS) // re-inject after any HMR reload

const HELPER_NAMES = [
  'S', 'clips', 'tracks', 'selectedClipIds', 'paintLayers', 'strokes',
  'trackPoints', 'trackingSessions', 'guidedMatte', 'maskDisplayMode', 'clipMasks',
  'hasTestid', 'grepDom',
]

async function expr(code) {
  const preamble = `const { ${HELPER_NAMES.join(', ')} } = window.__t;`
  return page.evaluate(`(() => { ${preamble}\nreturn (${code}) })()`)
}

const actions = {
  async resetProject() {
    await page.evaluate(() => {
      const g = window.__omniframe_store.getState
      g().clips.slice().forEach((c) => g().removeClip(c.id))
      g().clearGuidedMatte?.()
      g().selectClips([])
      g().setPlayhead(0)
    })
    await page.waitForTimeout(250)
  },
  async addClip(assetId, start, duration) {
    await page.evaluate(
      ([assetId, start, duration]) => {
        const g = window.__omniframe_store.getState
        const track = g().ensureTrack('video')
        const before = new Set(g().clips.map((c) => c.id))
        g().addClipToTrack(track, assetId, start)
        const added = g().clips.find((c) => !before.has(c.id))
        if (added) g().setClipProp(added.id, { duration })
      },
      [assetId, start, duration],
    )
    await page.waitForTimeout(200)
  },
  async addClipOnNewTrack(assetId, start, duration) {
    await page.evaluate(
      ([assetId, start, duration]) => {
        const g = window.__omniframe_store.getState
        const base = g().ensureTrack('video')
        const track = g().createTrack('video', 'above', base)
        const before = new Set(g().clips.map((c) => c.id))
        g().addClipToTrack(track, assetId, start)
        const added = g().clips.find((c) => !before.has(c.id))
        if (added) g().setClipProp(added.id, { duration })
      },
      [assetId, start, duration],
    )
    await page.waitForTimeout(200)
  },
  async selectClip(i) {
    await page.evaluate((i) => {
      const g = window.__omniframe_store.getState
      const c = g().clips[i]
      if (c) g().selectClip(c.id)
    }, i)
    await page.waitForTimeout(150)
  },
  async setPlayhead(t) {
    await page.evaluate((t) => window.__omniframe_store.getState().setPlayhead(t), t)
    await page.waitForTimeout(150)
  },
  async selectionRect(x, y, w, h) {
    await page.evaluate(
      (r) => {
        const g = window.__omniframe_store.getState
        g().setSelectionMode?.('rect')
        g().setActiveSelection?.({ type: 'rectangle', bounds: r })
      },
      { x, y, width: w, height: h },
    )
    await page.waitForTimeout(200)
  },
  async openOmniFrameSelection() {
    await page.evaluate(() => {
      const g = window.__omniframe_store.getState
      g().setLeftTab?.('omniframe')
      g().setLeftOpen?.(true)
      g().setSelectionMode?.('rect')
    })
    await page.waitForTimeout(400)
  },
  async enableDrawing() {
    await page.evaluate(() => {
      const g = window.__omniframe_store.getState
      g().setDrawingEnabled?.(true)
      g().setDrawingTool?.('brush')
    })
    await page.waitForTimeout(300)
  },
}

// ------------------------------------------------------------------- executor
const allResults = []

for (const tut of tutorials) {
  console.log(`\n===== ${tut.app} — ${tut.title} =====`)
  console.log(`  source: ${tut.source}`)
  await page.evaluate(HELPERS)
  const steps = []
  let shotN = 0

  for (const step of tut.steps) {
    const row = { kind: step.kind, label: step.label || step.fn || step.sel || step.keys || '', status: 'PASS', detail: '' }
    try {
      if (step.kind === 'setup') {
        await actions[step.fn]()
        row.detail = step.fn
      } else if (step.kind === 'store') {
        const m = /^([a-zA-Z]+)\((.*)\)$/.exec(step.fn)
        const name = m ? m[1] : step.fn
        const raw = m && m[2].trim() ? m[2].trim() : ''
        // registry args are written in JS style (single quotes); normalise to JSON
        const args = raw
          ? JSON.parse('[' + raw.replace(/'/g, '"') + ']')
          : []
        if (!actions[name]) throw new Error(`unknown action ${name}`)
        await actions[name](...args)
        row.detail = step.fn
      } else if (step.kind === 'click') {
        const el = page.locator(step.sel)
        const n = await el.count()
        if (!n) {
          row.status = step.optional ? 'BLOCKED' : 'FAIL'
          row.detail = `control not found: ${step.sel}`
        } else {
          await el.first().click({ timeout: 5000 })
          await page.waitForTimeout(250)
          row.detail = step.sel
        }
      } else if (step.kind === 'keys') {
        await page.keyboard.press(step.keys)
        await page.waitForTimeout(300)
        row.detail = step.keys
      } else if (step.kind === 'wait') {
        await page.waitForTimeout(step.ms)
        row.detail = `${step.ms}ms`
      } else if (step.kind === 'assert') {
        const v = await expr(step.expr)
        row.status = v ? 'PASS' : 'FAIL'
        row.detail = step.expr
      } else if (step.kind === 'probe') {
        const v = await expr(step.expr)
        row.status = v ? 'PASS' : 'FAIL'
        row.detail = step.expr
      } else if (step.kind === 'shot') {
        shotN += 1
        const p = path.join(SHOTS, `${step.name}-${shotN}.png`)
        await page.screenshot({ path: p })
        row.detail = path.relative(ROOT, p)
      } else if (step.kind === 'paint') {
        const canvas = page.locator('[data-testid="drawing-canvas"]')
        if (!(await canvas.count())) {
          row.status = 'BLOCKED'
          row.detail = 'drawing canvas not present'
        } else {
          const b = await canvas.boundingBox()
          const P = ([nx, ny]) => ({ x: b.x + nx * b.width, y: b.y + ny * b.height })
          const a = P(step.from)
          const z = P(step.to)
          await page.mouse.move(a.x, a.y)
          await page.mouse.down()
          for (let i = 1; i <= 10; i++) {
            await page.mouse.move(a.x + ((z.x - a.x) * i) / 10, a.y + ((z.y - a.y) * i) / 10, { steps: 2 })
          }
          await page.mouse.up()
          await page.waitForTimeout(300)
          row.detail = `stroke ${step.from} -> ${step.to}`
        }
      }
    } catch (e) {
      row.status = step.kind === 'assert' || step.kind === 'probe' ? 'FAIL' : 'BLOCKED'
      row.detail = String(e).split('\n')[0].slice(0, 160)
    }
    steps.push(row)
    console.log(`  ${row.status === 'PASS' ? '✓' : row.status === 'FAIL' ? '✗' : '~'} [${row.status}] ${row.label}${row.detail && row.status !== 'PASS' ? ` — ${row.detail}` : ''}`)
  }

  const counts = steps.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {})
  const verdict = counts.FAIL || counts.BLOCKED ? (counts.PASS ? 'PARTIAL' : 'NOT SUPPORTED') : 'REPLICATED'
  const result = {
    id: tut.id,
    app: tut.app,
    title: tut.title,
    source: tut.source,
    procedure: tut.procedure,
    verdict,
    counts: { PASS: 0, FAIL: 0, BLOCKED: 0, ...counts },
    steps,
  }
  fs.writeFileSync(path.join(OUT, `${tut.id}.json`), JSON.stringify(result, null, 2))
  allResults.push(result)
  console.log(`  → ${verdict} (${JSON.stringify(result.counts)})`)
}

const summary = {
  generatedAt: new Date().toISOString(),
  tutorials: allResults.length,
  replicated: allResults.filter((r) => r.verdict === 'REPLICATED').length,
  partial: allResults.filter((r) => r.verdict === 'PARTIAL').length,
  notSupported: allResults.filter((r) => r.verdict === 'NOT SUPPORTED').length,
  stepTotals: allResults.reduce(
    (a, r) => {
      for (const k of ['PASS', 'FAIL', 'BLOCKED']) a[k] = (a[k] || 0) + (r.counts[k] || 0)
      return a
    },
    { PASS: 0, FAIL: 0, BLOCKED: 0 },
  ),
  pageErrors: pageErrors.slice(0, 10),
  byApp: allResults.map((r) => ({ id: r.id, app: r.app, title: r.title, verdict: r.verdict, counts: r.counts })),
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))

console.log('\n================ SUMMARY ================')
for (const r of allResults) {
  console.log(`  ${r.verdict.padEnd(14)} ${r.app.padEnd(22)} ${r.title}`)
}
console.log(`\nSteps: ${JSON.stringify(summary.stepTotals)}`)
console.log(`Replicated ${summary.replicated}/${summary.tutorials} · partial ${summary.partial} · not supported ${summary.notSupported}`)
console.log('Results: qa/tutorials/results/summary.json')
await browser.close()
