import assert from 'node:assert/strict'
import { releaseDiscardedProjectUrls } from '../src/lib/projectLifetime.ts'

const discarded = URL.createObjectURL(new Blob(['discarded']))
const retained = URL.createObjectURL(new Blob(['retained']))
const nested = URL.createObjectURL(new Blob(['nested']))
const previous = { assets: [{ url: discarded }, { url: retained }], history: new Map([[nested, new Set([discarded])]]) }
previous.circular = previous
const current = { style: `background-image: url("${retained}")`, bytes: new Uint8Array(1_000_000) }
const revoked = []
const original = URL.revokeObjectURL
try {
  URL.revokeObjectURL = url => { revoked.push(url); original.call(URL, url) }
  releaseDiscardedProjectUrls(previous, current)
  assert.deepEqual(new Set(revoked), new Set([discarded, nested]))
  assert.equal(revoked.length, 2, 'duplicate/cyclic references must be released only once')
  assert.equal(await (await fetch(retained)).text(), 'retained', 'embedded CSS references keep shared resources alive')
  await assert.rejects(fetch(discarded))
  await assert.rejects(fetch(nested))
} finally {
  URL.revokeObjectURL = original
  original.call(URL, retained)
}
console.log('PASS discarded project media release, cyclic history, Map/Set and shared embedded URL retention')
