import assert from 'node:assert/strict'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { buildOmniProjectBundle, parseOmniProjectBundle } from '../src/lib/omniProject.ts'

const sentinel = 'test-only-credential-never-package'
const bundle = await buildOmniProjectBundle({ assets: [], tracks: [], clips: [], aiApiKey: sentinel }, 'Privacy fixture')
const bytes = new Uint8Array(await bundle.arrayBuffer())
const files = unzipSync(bytes)
const manifest = JSON.parse(strFromU8(files['manifest.json']))
assert.equal(Object.hasOwn(manifest.state, 'aiApiKey'), false, 'memory-only API credentials must not be saved')
assert.equal(new TextDecoder().decode(bytes).includes(sentinel), false)
manifest.state.aiApiKey = sentinel
files['manifest.json'] = strToU8(JSON.stringify(manifest))
const oldFile = new File([zipSync(files, { level: 0 })], 'old-project.omni')
const parsed = await parseOmniProjectBundle(oldFile)
assert.equal(Object.hasOwn(parsed.state, 'aiApiKey'), false, 'legacy credentials must not replace local user configuration')
parsed.dispose()
console.log('PASS API credential excluded from project bytes and ignored in legacy imports')
