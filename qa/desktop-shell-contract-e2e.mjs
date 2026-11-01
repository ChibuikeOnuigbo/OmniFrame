import assert from 'node:assert/strict'
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
  await page.addInitScript(() => {
    window.__desktopCalls = []
    let fullscreen = false
    window.__TAURI_INTERNALS__ = {
      invoke: async (command) => {
        window.__desktopCalls.push(command)
        if (command === 'omniframe_desktop_info') return { os: 'linux', arch: 'x86_64', appVersion: '0.1.0', fullscreen }
        if (command === 'omniframe_toggle_fullscreen') return (fullscreen = !fullscreen)
        if (command === 'omniframe_ping') return 'pong'
        throw new Error(`Unexpected desktop command: ${command}`)
      },
    }
  })
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  const badge = page.getByTestId('desktop-badge')
  await badge.waitFor({ state: 'visible' })
  assert.match(await badge.textContent(), /Desktop.*linux/i)
  const ping = await page.evaluate(async () => (await import('/src/lib/desktop.ts')).pingDesktop())
  assert.equal(ping, 'pong')
  await badge.click()
  await page.waitForFunction(() => window.__desktopCalls.includes('omniframe_toggle_fullscreen'))
  const calls = await page.evaluate(() => window.__desktopCalls)
  assert.ok(calls.includes('omniframe_desktop_info'))
  console.log('PASS desktop frontend detected Tauri, rendered its badge, and completed info/ping/fullscreen IPC contracts')
} finally { await browser.close() }
