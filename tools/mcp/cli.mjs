#!/usr/bin/env node
// MCP utility CLI: node tools/mcp/cli.mjs <tool> --params '{"..":..}' [--chunks]
// Prints the ToolResult JSON plus its chunk manifest; --chunks streams the
// payload chunk-by-chunk (reassemble with ChunkedPayload.reassemble).
import { registry } from './tools.mjs'

const [name, ...rest] = process.argv.slice(2)
if (!name || name === 'list') { console.log(JSON.stringify(registry.list(), null, 1)); process.exit(0) }
let params = {}
const i = rest.indexOf('--params')
if (i >= 0) params = JSON.parse(rest[i + 1])
const wantChunks = rest.includes('--chunks')
const res = await registry.call(name, params)
const cm = res.chunkManifest(1500)
if (wantChunks && res.ok) {
  for (const [k, ch] of cm.chunks.entries()) console.log(JSON.stringify({ chunk: k, total: cm.chunks.length, sha256: cm.sha256, data: ch }))
} else {
  console.log(JSON.stringify({ ok: res.ok, meta: res.meta, chunkManifest: { bytes: cm.bytes, chunks: cm.chunks.length, sha256: cm.sha256, reassemble: 'ChunkedPayload.reassemble(chunks)' }, data: res.data }, null, 1))
}
process.exit(res.ok ? 0 : 1)
