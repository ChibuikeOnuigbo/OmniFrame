/**
 * Downloads the Demucs v4 (htdemucs) ONNX weights into public/models/.
 *
 * The weights ship inside the MIT-licensed `demucs` npm package (a JS/ONNX
 * port of Meta's Demucs v4). We fetch the package tarball straight from the
 * npm registry — no Hugging Face / fbaipublicfiles access needed — and
 * extract only htdemucs.onnx (≈174 MB).
 *
 * The file is git-ignored (too large for the repo); run this once after
 * `npm install`:
 *
 *   npm run fetch:demucs
 *
 * Weights license: derived from weights provided by Meta, available for
 * personal and research use only (src/lib/demucs/LICENSE.md).
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const ROOT = process.cwd()
const OUT = join(ROOT, 'public/models/htdemucs.onnx')
const PKG = 'demucs@1.0.0'

if (existsSync(OUT) && statSync(OUT).size > 100_000_000) {
  console.log(`public/models/htdemucs.onnx already present (${(statSync(OUT).size / 1e6).toFixed(0)} MB) — nothing to do.`)
  process.exit(0)
}
mkdirSync(join(ROOT, 'public/models'), { recursive: true })

// 1) Ask the registry for the tarball URL (works in restricted networks
//    where only registry.npmjs.org is reachable; `npm pack` also works).
const meta = await (await fetch('https://registry.npmjs.org/demucs/1.0.0')).json()
const tarball = meta.dist.tarball
console.log(`downloading demucs@${meta.version} tarball from ${tarball} …`)

const tmpTgz = join(tmpdir(), `demucs-${Date.now()}.tgz`)
const res = await fetch(tarball)
if (!res.ok) throw new Error(`tarball fetch failed: HTTP ${res.status}`)
await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpTgz))
console.log('tarball downloaded, extracting htdemucs.onnx …')

// 2) Extract only package/htdemucs.onnx with tar.
const tmpOut = join(tmpdir(), `demucs-extract-${Date.now()}`)
mkdirSync(tmpOut, { recursive: true })
const tar = spawnSync('tar', ['-xzf', tmpTgz, '-C', tmpOut, 'package/htdemucs.onnx'], { stdio: 'inherit' })
if (tar.status !== 0) throw new Error('tar extraction failed')
const extracted = join(tmpOut, 'package/htdemucs.onnx')
const move = spawnSync('mv', [extracted, OUT], { stdio: 'inherit' })
if (move.status !== 0) throw new Error('move failed')
unlinkSync(tmpTgz)

const size = statSync(OUT).size
if (size < 100_000_000) throw new Error(`extracted file looks wrong: ${size} bytes`)
console.log(`wrote ${OUT} (${(size / 1e6).toFixed(0)} MB) — Demucs v4 voice isolation ready.`)
