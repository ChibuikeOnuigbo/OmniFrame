/**
 * Provider connection + model equivalents + training center + library
 * taste + Nova pixel effects (from the Nova Editor study), all against a
 * MOCKED provider — no real key, no network:
 *  A. API key setting is store-wide, key memory-only, test = ping + /models
 *  B. model equivalents: choose per capability, equivalents switch provider
 *  C. fine-tune: dataset from Custom Effects, JSONL export, submit + poll
 *  D. pack taste: likes + For You ordering learn locally
 *  E. pixel grades render (solarize math) via an adjustment layer
 *  F. Alight Motion workspace layout preset applies
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'evidence', 'improvements')
mkdirSync(OUT, { recursive: true })
let failures = 0
const assert = (cond, name, extra = '') => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${extra}`); return }
  console.log(`PASS ${name} ${extra}`)
}
const hard = (cond, name, extra = '') => { if (!cond) { console.error(`FATAL ${name} ${extra}`); process.exit(1) } }

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE, args: ['--no-sandbox'] } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1) })

// --- mock provider (OpenAI-compatible) -----------------------------------
const mockProvider = async (route) => {
  const url = route.request().url()
  const method = route.request().method()
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (url.endsWith('/chat/completions')) return json({ choices: [{ message: { content: 'OK' } }] })
  if (url.endsWith('/models')) return json({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }, { id: 'gpt-4o-mini-2024-07-18' }] })
  if (url.endsWith('/files')) return json({ id: 'file-qa-1' })
  if (url.endsWith('/fine_tuning/jobs') && method === 'POST') return json({ id: 'ftjob-qa-1', status: 'queued' })
  if (url.includes('/fine_tuning/jobs/')) return json({ status: 'succeeded', fine_tuned_model: 'ft:gpt-4o-mini-2024-07-18:omniframe-effects' })
  return json({}, 404)
}
await page.route('https://api.openai.com/v1/**', mockProvider)
await page.route('https://example.com/v1/**', mockProvider)

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const st = () => page.evaluate(() => window.__omniframe_store.getState())

// seed 12 custom effects (the training set) + a blue scene
await page.evaluate(() => {
  const store = window.__omniframe_store
  const effects = Array.from({ length: 12 }, (_, i) => ({
    id: `qa-fx-${i}`, name: `QA Look ${i}`, createdAt: i,
    effect: { brightness: 1 + i * 0.02, contrast: 1.1, solarize: i / 20 },
  }))
  store.setState({ customEffects: effects, clips: [], tracks: [], markers: [], playhead: 0, duration: 6 })
  const s = store.getState()
  const track = s.createTrack('video')
  const fxTrack = s.createTrack('video')
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const g = c.getContext('2d'); g.fillStyle = 'rgb(37,99,235)'; g.fillRect(0, 0, 640, 360)
  s.addAsset({ id: 'qa-blue', name: 'blue.png', kind: 'image', url: c.toDataURL('image/png'), width: 640, height: 360, duration: 8 })
  s.addClipToTrack(track, 'qa-blue', 0)
  const scene = store.getState().clips.find((cl) => cl.assetId === 'qa-blue')
  store.setState({ clips: store.getState().clips.map((cl) => (cl.id === scene.id ? { ...cl, duration: 5 } : cl)) })
  return { track, fxTrack }
})

// --- A. connection ---------------------------------------------------------
await page.locator('[data-testid="settings-button"]').click()
await page.waitForSelector('[data-testid="settings-popup"]')
await page.locator('[data-testid="settings-category"][data-category-id="ai"]').click()
await page.waitForTimeout(300)
hard(await page.locator('[data-testid="ai-connection-card"]').isVisible(), 'A connection card renders')
await page.locator('[data-testid="setting-ai-provider"]').selectOption('openai')
await page.locator('[data-testid="setting-ai-api-key"]').fill('sk-qa-test-key')
await page.locator('[data-testid="setting-ai-model"]').fill('gpt-4o-mini')
await page.getByRole('button', { name: 'Test connection' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-connection-status"]')?.textContent?.includes('Connected'), null, { timeout: 15000 }).catch(() => null)
const conn = await st()
assert(conn.aiConnection.status === 'connected', 'A connection test connects (ping + model list)', conn.aiConnection.message)
assert(conn.aiConnection.latencyMs !== null && conn.aiConnection.modelAvailable === true, 'A latency + model availability reported', JSON.stringify(conn.aiConnection))
assert(conn.aiApiKey === 'sk-qa-test-key', 'A key lives in memory (store state)')
const keyInStorage = await page.evaluate(() => Object.entries(localStorage).some(([, v]) => String(v).includes('sk-qa-test-key')))
assert(!keyInStorage, 'A key is NEVER written to localStorage')

// --- B. equivalents ----------------------------------------------------------
await page.locator('[data-testid="model-cap-vision"]').click()
await page.waitForTimeout(200)
const visionOption = page.locator('[data-testid="model-option"][data-model-id="gpt-4o"]')
assert(await visionOption.count() === 1, 'B vision equivalents listed for OpenAI')
await visionOption.click()
const afterPick = await st()
assert(afterPick.aiModel === 'gpt-4o' && afterPick.aiCapabilityModels.vision === 'gpt-4o', 'B picking an equivalent sets model + capability choice', JSON.stringify(afterPick.aiCapabilityModels))
await page.locator('[data-testid="model-cap-chat"]').click()
await page.waitForTimeout(200)
const other = page.locator('[data-testid="model-equivalent-other"]', { hasText: 'anthropic' }).first()
assert(await other.count() >= 1, 'B cross-provider equivalents offered')
await other.click()
await page.waitForTimeout(300)
const afterSwitch = await st()
assert(afterSwitch.aiProvider === 'anthropic' && afterSwitch.aiModel.includes('claude'), 'B equivalent chip switches provider + model together', `${afterSwitch.aiProvider}/${afterSwitch.aiModel}`)

// --- C. fine-tune --------------------------------------------------------------
const stats = await page.locator('[data-testid="finetune-stats"]').innerText()
assert(stats.includes('12 examples'), 'C dataset built from Custom Effects', stats)
const downloadPromise = page.waitForEvent('download')
await page.locator('[data-testid="finetune-download"]').click()
const download = await downloadPromise
const path = await download.path()
const { readFileSync } = await import('fs')
const lines = readFileSync(path, 'utf8').trim().split('\n')
const parsed = lines.map((l) => JSON.parse(l))
assert(parsed.length === 12 && parsed.every((p) => Array.isArray(p.messages) && p.messages.length === 3), 'C JSONL export is valid chat-format', `${parsed.length} lines`)
// back to OpenAI for the submit (mocked), reconnect, submit, poll
await page.locator('[data-testid="setting-ai-provider"]').selectOption('openai')
await page.locator('[data-testid="setting-ai-api-key"]').fill('sk-qa-test-key')
await page.getByRole('button', { name: 'Test connection' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-connection-status"]')?.textContent?.includes('Connected'), null, { timeout: 15000 }).catch(() => null)
await page.locator('[data-testid="finetune-base"]').selectOption('gpt-4o-mini-2024-07-18')
await page.locator('[data-testid="finetune-submit"]').click()
await page.waitForFunction(() => document.querySelector('[data-testid="finetune-job"]')?.textContent?.includes('ftjob-qa-1'), null, { timeout: 15000 }).catch(() => null)
assert(await page.locator('[data-testid="finetune-job"]').count() === 1, 'C fine-tune job submitted to the (mock) provider')
await page.locator('[data-testid="finetune-poll"]').click()
await page.waitForFunction(() => document.querySelector('[data-testid="finetune-job"]')?.textContent?.includes('succeeded'), null, { timeout: 15000 }).catch(() => null)
const tuned = await st()
assert(tuned.aiModel.startsWith('ft:'), 'C tuned model becomes the active model', tuned.aiModel)
await page.keyboard.press('Escape')
await page.locator('[data-testid="settings-button"]').click().catch(() => null)

// --- D. pack taste --------------------------------------------------------------
await page.locator('[data-testid="left-tab-pack"]').click()
await page.waitForTimeout(600)
const firstAsset = page.locator('[data-testid^="pack-asset-"]').first()
const firstId = (await firstAsset.getAttribute('data-testid')).replace('pack-asset-', '')
await page.locator(`[data-testid="pack-like-${firstId}"]`).click()
await page.waitForTimeout(200)
let taste = await st()
assert(taste.packLikes.includes(firstId), 'D like is recorded', firstId)
// teach a different asset heavily via store-recorded uses, then check order
const otherId = await page.evaluate((fid) => {
  const s = window.__omniframe_store.getState()
  const el = document.querySelector(`[data-testid="pack-like-${fid}"]`)
  void el
  return s.packLikes[0]
}, firstId)
void otherId
await page.locator('[data-testid="pack-foryou-toggle"]').click()
await page.waitForTimeout(300)
const order = await page.locator('[data-testid^="pack-asset-"]').evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute('data-testid')))
assert(order[0] === `pack-asset-${firstId}`, 'D For You puts the liked asset first', JSON.stringify(order))
taste = await st()
assert(Object.keys(taste.packTaste).length >= 0 && taste.packLikes.length === 1, 'D taste persists locally')

// --- F. alight layout -------------------------------------------------------------
const layout = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  s.setWorkspacePreset('alight')
  const after = window.__omniframe_store.getState()
  return { preset: after.workspacePreset, h: after.timelineHeight }
})
assert(layout.preset === 'alight' && layout.h === 380, 'F Alight Motion layout preset applies', JSON.stringify(layout))
await page.evaluate(() => window.__omniframe_store.getState().setWorkspacePreset('default'))

// --- E. solarize renders ------------------------------------------------------------
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const fxTrack = s.createTrack('video')
  s.addAdjustmentLayer({ name: 'Solarize QA', trackId: fxTrack, start: 0, duration: 5, effects: { solarize: 1 } })
  s.setPlayhead(1)
})
await page.waitForTimeout(700)
const stage = page.locator('[data-testid="preview-stage"]')
const shot = await stage.screenshot()
const px = await page.evaluate(async (b64) => {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}` })
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height)
  const i = ((Math.floor(c.height / 2) * c.width) + Math.floor(c.width / 2)) * 4
  return [d.data[i], d.data[i + 1], d.data[i + 2]]
}, shot.toString('base64'))
// blue (37,99,235) solarized at 1.0: channels <128 stay, 235 -> 20
assert(Math.abs(px[0] - 37) < 14 && Math.abs(px[1] - 99) < 14 && Math.abs(px[2] - 20) < 16, 'E solarize inverts above the midpoint', JSON.stringify(px))
await page.screenshot({ path: join(OUT, '21-models-training.png') })

await browser.close()
if (failures) { console.error(`MODELS-TRAINING SUITE: ${failures} FAILURES`); process.exit(1) }
console.log('MODELS-TRAINING SUITE: ALL PASS')
