/**
 * Exports one test pack per text preset into testing_asset_etc/ for human
 * vetting: three frames per preset (glitch/scramble phase, mid-settle,
 * settled) + a spec.json, plus the README index. Run:
 *   LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/export-text-preset-tests.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(process.cwd(), 'testing_asset_etc')
mkdirSync(ROOT, { recursive: true })

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })
await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.locator('[data-testid="left-tab-text"]').click()
await page.waitForTimeout(500)
const presets = await page.evaluate(() => window.__omniframe_text_presets)
if (!presets?.length) { console.error('no presets exposed'); process.exit(1) }

const rows = []
for (const p of presets) {
  const dir = join(ROOT, p.id)
  mkdirSync(dir, { recursive: true })
  const clipCount = await page.evaluate(({ id, demo }) => {
    const store = window.__omniframe_store
    store.setState({ clips: [], tracks: [], transitions: [], playhead: 0, playing: false, duration: 8 })
    const s = store.getState()
    const t = s.createTrack('video')
    const c = document.createElement('canvas'); c.width = 640; c.height = 360
    const g = c.getContext('2d'); g.fillStyle = 'rgb(14,16,24)'; g.fillRect(0, 0, 640, 360)
    s.addAsset({ id: 'vet-bg', name: 'bg.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
    s.addClipToTrack(t, 'vet-bg', 0)
    const ids = window.__omniframe_build_text_preset(id, demo)
    return ids.length
  }, p)
  const frames = []
  for (const [label, t] of [['frame-1-early', 0.12], ['frame-2-mid', 0.55], ['frame-3-settled', 1.8]]) {
    await page.evaluate((tt) => window.__omniframe_store.getState().setPlayhead(tt), t)
    await page.waitForTimeout(320)
    const shot = await page.locator('[data-testid="preview-stage"]').screenshot()
    writeFileSync(join(dir, `${label}.png`), shot)
    frames.push(`${label}.png @ ${t}s`)
  }
  writeFileSync(join(dir, 'spec.json'), JSON.stringify({ preset: p.id, name: p.name, category: p.category, source: p.source, idealCharacters: p.ideal, demoText: p.demo, clipsBuilt: clipCount, frames, recreate: 'Open OmniFrame → Text panel → Text Preset Library, type the demo text, click the preset.' }, null, 2))
  rows.push({ ...p, clipsBuilt: clipCount })
  console.log(`exported ${p.id} (${clipCount} clips)`)
}

const table = rows.map((p) => `| ${p.name} | ${p.category} | ${p.ideal[0]}–${p.ideal[1]} | ${p.clipsBuilt} | [${p.id}/](${p.id}/) · [spec](${p.id}/spec.json) · [f1](${p.id}/frame-1-early.png) [f2](${p.id}/frame-2-mid.png) [f3](${p.id}/frame-3-settled.png) | | |`).join('\n')
writeFileSync(join(ROOT, 'README.md'), `# Text preset test packs — for vetting

Every preset from the Text Preset Library, rendered with its demo text on a
dark stage. Three frames each: early (effect/scramble phase), mid (settling),
settled. Open the folder, look at the frames, and mark each row
**Perfect** or **Horrible** (or tell me in chat: "karaoke-sweep is perfect,
matrix is horrible"). Presets you approve become the app's vetted defaults;
horrible ones get rebuilt or cut.

## How the character-count problem is solved (your question)

Presets are **procedures, not recordings**: stagger/settle/wave all key off
each letter's normalized position \`u = i/(n-1)\`, so a 2-letter word and a
16-letter word run the same shape of animation. Nothing forces the same
character count as the tutorial — but every preset knows its sweet spot, the
UI says so live ("Best with 4–10 characters — yours has 2; it still maps"),
and the table below lists the ideal range per preset. Demo texts below sit
inside the sweet spot so you judge the look at its best.

## Packs

| Preset | Category | Ideal chars | Clips | Test output | Perfect? | Horrible? |
|---|---|---|---|---|---|---|
${table}

## Recreate any pack by hand

OmniFrame → Text panel → **Text Preset Library** → type the demo text →
click the preset. Change the text to anything and it remaps. Change the
seed to re-roll the randomized looks; change the accent colour to retheme.
`)
console.log(`DONE ${rows.length} packs in testing_asset_etc/`)
await browser.close()
