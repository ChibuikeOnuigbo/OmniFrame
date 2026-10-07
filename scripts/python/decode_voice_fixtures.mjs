#!/usr/bin/env node
/**
 * Decode the TTS voice fixtures (qa/assets/voice/tts-*.mp3) to 16-bit PCM
 * wav so the Python trainer (scripts/python/train_unified.py) can read them
 * with the stdlib wave module. Idempotent; run whenever the mp3s change.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path
const dir = join(process.cwd(), 'qa/assets/voice')
const mp3s = readdirSync(dir).filter((f) => /^tts-.*\.mp3$/.test(f))
for (const f of mp3s) {
  const out = join(dir, f.replace(/\.mp3$/, '.wav'))
  if (existsSync(out)) {
    console.log(`skip ${f} (wav exists)`)
    continue
  }
  execFileSync(ffmpeg, ['-i', join(dir, f), '-ar', '16000', '-ac', '1', '-y', out], { stdio: 'ignore' })
  console.log(`decoded ${f} -> 16k mono wav`)
}
console.log(`done (${mp3s.length} fixtures)`)
