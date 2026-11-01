import assert from 'node:assert/strict'
import { previewDimensions, shouldRenderPreview } from '../src/lib/previewPerformance.ts'
assert.deepEqual(previewDimensions(320, 180, 'high'), { width: 320, height: 180 })
assert.deepEqual(previewDimensions(1920, 1080, 'medium'), { width: 854, height: 480 })
assert.deepEqual(previewDimensions(1080, 1920, 'low'), { width: 240, height: 426 })
assert.deepEqual(previewDimensions(3840, 2160, 'full'), { width: 3840, height: 2160 })
assert.equal(shouldRenderPreview(100, false, false, 60), false)
assert.equal(shouldRenderPreview(250, false, false, 60), true)
assert.equal(shouldRenderPreview(1, false, true, 60), true)
assert.equal(shouldRenderPreview(60, true, false, 15), false)
assert.equal(shouldRenderPreview(67, true, false, 15), true)
console.log('PASS preview size caps, portrait aspect, full resolution, idle refresh and playback frame budget')
