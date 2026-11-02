import fs from 'node:fs'
import { registry } from '../tools/mcp/tools.mjs'

const source = 'new_work_qa/scene_clips/gojo-3.mp4'
const out = 'new_work_qa/text-crop-blend-comparison.png'
const call = async (tool, params = {}) => {
  const result = await registry.call(tool, params)
  if (!result.ok) throw new Error(`${tool}: ${JSON.stringify(result.data)}`)
  return result.data
}
if (!fs.existsSync(source)) throw new Error(`Missing ${source}`)
await call('project_new', { w: 960, h: 540, fps: 24, duration: 3, bg: '#07101a' })
const plate = await call('import_video', { path: source, fps: 24, fit: 'cover' })
await call('edit_element', { clipId: plate.clipId, patch: { volume: 0, effects: { brightness: 0.72, contrast: 1.18, saturation: 1.1, blur: 3 } } })
for (const [index, item] of [
  { mode: 'source-over', label: 'NORMAL' },
  { mode: 'color-burn', label: 'COLOR BURN' },
  { mode: 'screen', label: 'SCREEN' },
].entries()) {
  const x = -320 + index * 320
  const title = await call('create_text', { text: 'ABC', preset: 'plain', x, y: -20, scale: 0.3 })
  await call('edit_element', { clipId: title.clipId, patch: { textStyle: { fontSize: 58, bold: true, color: '#f6f8ff', insideBaseAlpha: 0.04 } } })
  await call('text_crop_video', { clipId: title.clipId, video: source, invert: true, contrast: 1.32, saturation: 1.42, brightness: 1.14, baseAlpha: 0.04, blendMode: item.mode })
  const label = await call('create_text', { text: item.label, preset: 'plain', x, y: 74, scale: 0.28 })
  await call('edit_element', { clipId: label.clipId, patch: { textStyle: { fontSize: 20, bold: true, color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.62)' } } })
}
await call('snapshot', { time: 1.4, out })
console.log(`PASS rendered ${out} with Normal, Color Burn, and Screen from the same negative video text matte`)
