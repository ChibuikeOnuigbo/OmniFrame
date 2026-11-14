import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__omniframe_store.getState().setCursorConfig({ enabled: true, showClickBurst: true }))
  await page.mouse.move(600, 350)
  await page.mouse.click(600, 350)
  await page.waitForTimeout(50)
  const burst = page.getByTestId('cursor-click-burst')
  assert.equal(await burst.count(), 1, 'one physical click creates one burst')
  await burst.evaluate(element => { element.style.animation = 'none' })
  const before = await burst.boundingBox()
  assert(before && Math.abs(before.x + before.width / 2 - 600) < 2, `burst x: ${JSON.stringify(before)}`)
  await page.mouse.move(700, 400)
  await page.waitForTimeout(50)
  const after = await burst.boundingBox()
  assert(after && Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2,
    'burst stays at the click point when the pointer moves')
  await page.waitForTimeout(650)
  assert.equal(await burst.count(), 0, 'burst timer removes the effect')
  console.log('PASS one stationary, timed click burst per pointer click')
} finally {
  await browser.close()
}
