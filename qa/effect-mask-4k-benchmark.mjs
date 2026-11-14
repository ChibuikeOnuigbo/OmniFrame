// Run with: node --expose-gc qa/effect-mask-4k-benchmark.mjs
import { performance } from 'node:perf_hooks'
import { makeCanvas } from '../tools/mcp/core.mjs'
import { applyEffectMaskK } from '../tools/mcp/appRender.mjs'

const width = 3840, height = 2160
const inverted = process.argv.includes('--inverted')
const mask = {
  enabled: true, inverted, featherColor: '#3b82f6', featherTint: 1,
  regions: [{ id: 'r', shape: 'circle', centerX: .5, centerY: .5,
    width: .3, height: .3, feather: 24, opacity: 1 }],
}
const timings = []
for (let i = 0; i < 3; i++) {
  global.gc?.()
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const start = performance.now()
  applyEffectMaskK(ctx, mask, width, height)
  timings.push(Math.round(performance.now() - start))
}
const rss = Math.round(process.memoryUsage().rss / 1048576)
console.log(JSON.stringify({ resolution: `${width}x${height}`, inverted, timesMs: timings, rssMiB: rss }))
