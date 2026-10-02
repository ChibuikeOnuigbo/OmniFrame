/**
 * OmniFrame Recolor Blend Modes E2E
 * =================================
 *
 * Regression guard for the "the towel looks like a coloured layer sitting on
 * the image" defect.
 *
 * The old implementation swapped in one of five pre-baked flat PNGs matched by
 * colour name. Measured on `obj_towel.png`, a flat blue fill drops luminance
 * std from 63 to 27 and crushes the p5..p95 range from 29..241 to 13..103 —
 * the folds are destroyed, which is precisely what reads as "a layer".
 *
 * So the acceptance criterion here is NOT "the hue changed". It is:
 *
 *   a recolour is only acceptable if the object KEEPS its luminance
 *   structure, i.e. the folds/shadows/highlights survive the colour change.
 *
 * We assert that two ways:
 *   1. contrastRetained  = outLumStd / baseLumStd   (fold contrast kept)
 *   2. corr(base, out)   = per-pixel luminance correlation (structure kept)
 *
 * Must run with the dev server bound to 0.0.0.0:
 *   npx vite --host 0.0.0.0 --port 5173
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

/**
 * Runs IN THE PAGE. Loads the base cutout and the recoloured result and
 * compares their luminance structure over the opaque pixels only.
 */
async function analyzeInPage(urls) {
  async function load(url) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    return { px: ctx.getImageData(0, 0, c.width, c.height).data, n: c.width * c.height }
  }
  function lumOf(px, i) {
    return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
  }
  function stats(d) {
    const vals = []
    let sum = 0
    for (let i = 0; i < d.n; i++) {
      if (d.px[i * 4 + 3] < 10) continue
      const L = lumOf(d.px, i * 4)
      vals.push(L)
      sum += L
    }
    const mean = sum / vals.length
    let v = 0
    for (let i = 0; i < vals.length; i++) v += (vals[i] - mean) * (vals[i] - mean)
    return { vals, mean, std: Math.sqrt(v / vals.length) }
  }
  const base = stats(await load(urls.base))
  const out = stats(await load(urls.out))
  const n = Math.min(base.vals.length, out.vals.length)
  let sb = 0, so = 0, sb2 = 0, so2 = 0, sbso = 0
  for (let i = 0; i < n; i++) {
    const a = base.vals[i]
    const b = out.vals[i]
    sb += a
    so += b
    sb2 += a * a
    so2 += b * b
    sbso += a * b
  }
  const cov = sbso / n - (sb / n) * (so / n)
  const sd1 = Math.sqrt(Math.max(0, sb2 / n - (sb / n) ** 2))
  const sd2 = Math.sqrt(Math.max(0, so2 / n - (so / n) ** 2))
  const corr = sd1 && sd2 ? cov / (sd1 * sd2) : 0

  const outImg = await load(urls.out)
  const hues = []
  let satSum = 0
  let satN = 0
  for (let i = 0; i < outImg.n; i++) {
    if (outImg.px[i * 4 + 3] < 10) continue
    const r = outImg.px[i * 4] / 255
    const g = outImg.px[i * 4 + 1] / 255
    const b = outImg.px[i * 4 + 2] / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const d = mx - mn
    if (d > 0) {
      let h
      if (mx === r) h = 60 * (((g - b) / d) % 6)
      else if (mx === g) h = 60 * ((b - r) / d + 2)
      else h = 60 * ((r - g) / d + 4)
      if (h < 0) h += 360
      hues.push(h)
      satSum += mx === 0 ? 0 : d / mx
      satN++
    }
  }
  hues.sort((a, b) => a - b)
  return {
    baseStd: base.std,
    outStd: out.std,
    baseMean: base.mean,
    outMean: out.mean,
    contrastRetained: base.std ? out.std / base.std : 0,
    brightnessKept: base.mean ? out.mean / base.mean : 0,
    corr,
    hue: hues.length ? hues[Math.floor(hues.length / 2)] : 0,
    sat: satN ? satSum / satN : 0,
  }
}

function readTowel(page) {
  return page.evaluate(() => {
    const s = window.__omniframe_store?.getState?.()
    const c = s?.omniframeCharacters?.find((x) => x.id === 'char_towel')
    return c ? { color: c.recolorColor, url: c.recolorUrl, blend: c.recolorBlend } : null
  })
}

/** Poll until the async pixel pass has committed a recolour for `color`. */
async function waitRecolor(page, color, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const st = await readTowel(page)
    if (st && st.color === color && st.url && st.url.startsWith('data:')) return st
    await page.waitForTimeout(120)
  }
  return null
}

/** Poll until the committed recolour URL differs from `prevUrl` (proves re-dye). */
async function waitRecolorChanged(page, color, prevUrl, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const st = await readTowel(page)
    if (st && st.color === color && st.url && st.url.startsWith('data:') && st.url !== prevUrl) {
      return st
    }
    await page.waitForTimeout(120)
  }
  return null
}

async function run() {
  console.log('=== OmniFrame Recolor Blend Modes E2E ===')
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  try {
    await page.goto(`${BASE_URL}/#studio`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    await page.evaluate(() => {
      const st = window.__omniframe_store?.getState?.()
      if (st) {
        st.setLeftTab('omniframe')
        st.setLeftOpen(true)
      }
    })
    await page.waitForTimeout(600)

    // --- R1: the chair & towel asset loads with the towel detected -----------
    await page.waitForSelector('[data-testid="switch-asset-room-btn"]', { timeout: 5000 })
    await page.click('[data-testid="switch-asset-room-btn"]')
    await page.waitForTimeout(900)

    const hasTowel = await page.evaluate(() => {
      const s = window.__omniframe_store?.getState?.()
      return !!s?.omniframeCharacters?.some((c) => c.id === 'char_towel')
    })
    check('R1 chair & towel asset loads with char_towel detected', hasTowel)
    if (!hasTowel) throw new Error('char_towel missing — cannot continue')

    await page.evaluate(() => window.__omniframe_store.getState().setSelectedCharacterId('char_towel'))
    await page.waitForTimeout(400)

    // --- R2: blend selector is exposed with all six modes -------------------
    const sel = await page.waitForSelector('[data-testid="recolor-blend-select"]', { timeout: 5000 })
    const opts = await sel.evaluate((s) => Array.from(s.options).map((o) => o.value))
    const expected = ['dye', 'color', 'overlay', 'multiply', 'soft-light', 'hue']
    check(
      'R2 blend selector exposes all six modes',
      expected.every((e) => opts.includes(e)) && opts.length === 6,
      opts.join(','),
    )
    check('R2b overlay offered among the blend modes (user request)', opts.includes('overlay'))

    const baseUrl = await page.evaluate(() => {
      const s = window.__omniframe_store?.getState?.()
      return s?.omniframeCharacters?.find((c) => c.id === 'char_towel')?.cutoutUrl
    })

    // The store records `recolorColor` synchronously but commits `recolorUrl`
    // only after the async pixel pass. So polling on "colour + any data URL"
    // can hand back the PREVIOUS recolour's pixels. Always require the URL to
    // differ from the last one we measured against.
    let lastUrl = null
    async function applyAndMeasure(blend, color) {
      await page.selectOption('[data-testid="recolor-blend-select"]', blend)
      await page.waitForTimeout(150)
      await page.evaluate(
        ({ color, blend }) => window.__omniframe_store.getState().recolorActiveSelection(color, blend),
        { color, blend },
      )
      const rec = await waitRecolorChanged(page, color, lastUrl)
      if (!rec) return null
      lastUrl = rec.url
      const stats = await page.evaluate(analyzeInPage, { base: baseUrl, out: rec.url })
      return { ...stats, url: rec.url }
    }

    // --- R3: 'dye' keeps the folds (the core acceptance criterion) ----------
    const dye = await applyAndMeasure('dye', '#2563eb')
    check('R3 dye recolour commits and produces a data URL', !!dye)
    if (dye) {
      console.log(
        `   dye: contrastRetained=${(dye.contrastRetained * 100).toFixed(1)}% ` +
          `corr=${dye.corr.toFixed(4)} hue=${dye.hue.toFixed(0)} ` +
          `sat=${(dye.sat * 255).toFixed(0)} bright=${(dye.brightnessKept * 100).toFixed(0)}%`,
      )
      check(
        'R3a dye retains fold contrast (>=75% of original)',
        dye.contrastRetained >= 0.75,
        `${(dye.contrastRetained * 100).toFixed(1)}%`,
      )
      check(
        'R3b dye preserves luminance structure (corr >= 0.98)',
        dye.corr >= 0.98,
        dye.corr.toFixed(4),
      )
      check(
        'R3c dye beats the old flat-composite baseline (43%)',
        dye.contrastRetained > 0.43 * 1.5,
        `${(dye.contrastRetained * 100).toFixed(1)}% vs 43%`,
      )
      check(
        'R3d dye lands on the requested hue (blue ~205-245)',
        dye.hue >= 205 && dye.hue <= 245,
        `hue=${dye.hue.toFixed(0)}`,
      )
      check(
        'R3e dye keeps the object bright enough to read as lit fabric (>=55%)',
        dye.brightnessKept >= 0.55,
        `${(dye.brightnessKept * 100).toFixed(0)}%`,
      )
    }

    // --- R4: every colour works, not just five hardcoded names --------------
    for (const [name, color, lo, hi] of [
      ['teal', '#0d9488', 150, 200],
      ['magenta', '#db2777', 295, 345],
      ['olive', '#4d7c0f', 60, 110],
    ]) {
      const r = await applyAndMeasure('dye', color)
      if (!r) {
        check(`R4 arbitrary colour ${name} (${color}) applies`, false, 'no recolour committed')
        continue
      }
      check(
        `R4 arbitrary colour ${name} (${color}) applies with correct hue`,
        r.hue >= lo && r.hue <= hi && r.contrastRetained >= 0.7,
        `hue=${r.hue.toFixed(0)} contrast=${(r.contrastRetained * 100).toFixed(0)}%`,
      )
    }

    // --- R5: overlay is available and behaves as documented -----------------
    const ov = await applyAndMeasure('overlay', '#2563eb')
    if (ov) {
      console.log(
        `   overlay: contrastRetained=${(ov.contrastRetained * 100).toFixed(1)}% ` +
          `corr=${ov.corr.toFixed(4)} hue=${ov.hue.toFixed(0)}`,
      )
      check(
        'R5 overlay applies and boosts contrast (as its hint says)',
        ov.contrastRetained > dye.contrastRetained,
        `${(ov.contrastRetained * 100).toFixed(0)}% vs dye ${(dye.contrastRetained * 100).toFixed(0)}%`,
      )
      const hint = await page.textContent('[data-testid="recolor-blend-hint"]')
      check(
        'R5b overlay hint warns about crushed highlights',
        /crush/i.test(hint || ''),
        (hint || '').trim(),
      )
    }

    // --- R6: the blend choice is recorded on the character ------------------
    const rec6 = await applyAndMeasure('multiply', '#dc2626')
    const stored = await page.evaluate(() => {
      const s = window.__omniframe_store?.getState?.()
      const c = s?.omniframeCharacters?.find((x) => x.id === 'char_towel')
      return { blend: c?.recolorBlend, color: c?.recolorColor }
    })
    check(
      'R6 chosen blend mode is recorded on the character',
      stored.blend === 'multiply' && stored.color === '#dc2626',
      `${stored.blend} / ${stored.color}`,
    )
    if (rec6) {
      check(
        'R6b multiply darkens while keeping structure (corr >= 0.9, darker)',
        rec6.corr >= 0.9 && rec6.brightnessKept < 1,
        `corr=${rec6.corr.toFixed(3)} bright=${(rec6.brightnessKept * 100).toFixed(0)}%`,
      )
    }

    // --- R7: "Original" clears the dye -------------------------------------
    await page.evaluate(() => window.__omniframe_store.getState().recolorActiveSelection(''))
    await page.waitForTimeout(500)
    const cleared = await readTowel(page)
    check(
      'R7 "Original" clears the recolour back to the pristine cutout',
      !cleared.color && !String(cleared.url || '').startsWith('data:'),
      `color=${cleared.color || '(none)'}`,
    )
    // The dye is gone, so the next data URL we see is fresh regardless.
    lastUrl = null

    // --- R8: recolours do not compound into mud -----------------------------
    // Re-dyeing must always start from the pristine cutout, so dyeing blue,
    // then red, then blue again must land on exactly the same blue. (Waiting
    // for a URL *change* here would be self-contradictory: a correct re-dye
    // of the same colour produces byte-identical pixels, hence the same URL.)
    lastUrl = null
    const blueA = await applyAndMeasure('dye', '#2563eb')
    await applyAndMeasure('dye', '#dc2626')
    const blueB = await applyAndMeasure('dye', '#2563eb')
    if (blueA && blueB) {
      const bDrift = Math.abs(blueB.brightnessKept - blueA.brightnessKept)
      const cDrift = Math.abs(blueB.contrastRetained - blueA.contrastRetained)
      check(
        'R8 re-dyeing after an intermediate colour is idempotent (no compounding)',
        bDrift < 0.02 && cDrift < 0.02,
        `brightness drift ${(bDrift * 100).toFixed(2)}%, contrast drift ${(cDrift * 100).toFixed(2)}%`,
      )
    } else {
      check('R8 re-dyeing after an intermediate colour completes', false, 'a dye pass never committed')
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'recolor-blend-modes.png') })
    console.log('✓ Saved recolor-blend-modes.png')

    check('R9 no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
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
    path.join(REPORTS_DIR, 'omniframe-recolor-blend-modes.json'),
    JSON.stringify(results, null, 2),
  )
  process.exit(failed > 0 ? 1 : 0)
}

run()
