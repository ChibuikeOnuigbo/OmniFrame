import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'qa-output', 'settings-quality')
fs.mkdirSync(out, { recursive: true })
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/#studio', { waitUntil: 'networkidle' })
  await page.getByTestId('settings-button').click()
  await page.getByTestId('settings-popup').waitFor({ state: 'visible' })
  const phase = process.env.SETTINGS_PHASE || 'after'
  await page.screenshot({ path: path.join(out, `${phase}-desktop.png`), fullPage: true })
  if (phase === 'after') {
    await page.getByRole('button', { name: /Playback & Performance/i }).click()
    await page.getByTestId('performance-profile-balanced').waitFor({ state: 'visible' })
    await page.getByRole('region', { name: 'Media proxies' }).waitFor({ state: 'attached' })
    await page.getByRole('button', { name: /AI & APIs/i }).click()
    await page.getByTestId('setting-unsplash-api-key').waitFor({ state: 'attached' })
    await page.getByTestId('setting-pexels-api-key').waitFor({ state: 'attached' })
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  await mobile.goto(process.env.URL || 'http://127.0.0.1:5173/#studio', { waitUntil: 'networkidle' })
  await mobile.getByTestId('settings-button').click()
  await mobile.getByTestId('settings-popup').waitFor({ state: 'visible' })
  await mobile.screenshot({ path: path.join(out, `${phase}-mobile.png`), fullPage: true })
  console.log(`PASS captured ${phase} Settings desktop/mobile screenshots and verified performance plus media-key controls`)
} finally {
  await browser.close()
}
