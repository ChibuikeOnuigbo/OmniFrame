import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const qaDir = import.meta.dirname
const fixedPorts = []
for (const name of readdirSync(qaDir)) {
  if (!name.endsWith('.mjs') || name === 'browser-url-portability-unit.mjs') continue
  const source = readFileSync(join(qaDir, name), 'utf8')
  if (/\.goto\(\s*['"]http:\/\/localhost:5173/.test(source)) fixedPorts.push(name)
}
assert.deepEqual(fixedPorts, [], `browser scripts ignoring URL override: ${fixedPorts.join(', ')}`)
console.log('PASS browser scripts can target a configurable dev server')
