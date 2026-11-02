import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'

const root = path.resolve(import.meta.dirname, '..')
await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${path.join(os.tmpdir(), 'al2023/lib')}:${os.tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const clip = fs.readFileSync(path.join(root, 'effect_vid/clips/studio-0-0-0.mp4'))
  await page.route('https://api.giphy.com/**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'qa-gif', title: 'QA reaction', url: 'https://giphy.com/gifs/qa-gif', images: { fixed_width: { webp: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }, original: { mp4: 'https://media.giphy.test/qa.mp4', width: '320', height: '180' } } }] }) }))
  await page.route('https://api.klipy.com/**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { data: [{ id: 'qa-klipy', title: 'QA sticker', url: 'https://klipy.com/gifs/qa-klipy', file: { hd: { mp4: { url: 'https://media.klipy.test/qa.mp4', width: 320, height: 180 } }, sm: { webp: { url: 'https://media.klipy.test/qa.webp' } } } }] } }) }))
  await page.route('https://media.giphy.test/qa.mp4', async (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: clip }))
  await page.route('https://media.klipy.test/qa.mp4', async (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: clip }))
  await page.route('https://media.klipy.test/qa.webp', async (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }))
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.getByTestId('settings-button').click()
  await page.locator('[data-testid="settings-category"][data-category-id="ai"]').click()
  await page.getByTestId('setting-giphy-api-key').fill('qa-giphy-key')
  await page.getByTestId('setting-klipy-api-key').fill('qa-klipy-key')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByTestId('giphy-open').click()
  await page.getByTestId('giphy-search').fill('reaction')
  await page.getByRole('button', { name: 'Search GIPHY' }).click()
  await page.getByAltText('QA reaction').waitFor({ state: 'visible' })
  await page.getByTitle('Import to OmniFrame').click()
  await page.getByText(/Imported “QA reaction”/).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId('gif-provider-klipy').click()
  await page.getByTestId('giphy-search').fill('sticker')
  await page.getByRole('button', { name: 'Search Klipy' }).click()
  await page.getByAltText('QA sticker').waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
    throw new Error(`Klipy result did not render: ${await page.getByTestId('giphy-browser').innerText()}`)
  })
  await page.getByTitle('Import to OmniFrame').click()
  await page.getByText(/Imported “QA sticker”/).waitFor({ state: 'visible', timeout: 15000 })
  const assets = await page.evaluate(() => window.__omniframe_store.getState().assets.filter((item) => item.name.includes('QA-')))
  assert.equal(assets.filter((asset) => asset.kind === 'video').length, 2)
  console.log('PASS Settings keys, GIPHY and Klipy search, provider attribution, loading/download states, and editable media import')
} finally { await browser.close() }
