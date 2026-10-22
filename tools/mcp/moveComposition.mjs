// Board E, the OmniFrame way: NO new elements. The existing black rectangle in
// the source image is isolated with the masking sub-tool (rectangle mask drawn
// over it), then position keyframes are set — key 1 at its original position,
// end key at the destination rectangle — and the FULL composition (plate +
// masked layer + keyframes + curve) is rendered. Descriptors use the app's own
// shapes: ClipVisualMask (src/types.ts) and ClipAnimation/PropertyCurve
// (src/lib/animation/CurveEngine.ts). Easing resolves through the app's
// speed-curve library (src/lib/speedCurves.ts).
import fs from 'fs'
import path from 'path'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { transform } from 'sucrase'
import { loadImage, makeCanvas } from './core.mjs'

async function loadAppSpeedCurves() {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/lib/speedCurves.ts'), 'utf8')
  const { code } = transform(src, { transforms: ['typescript'] })
  const f = join(mkdtempSync(join(tmpdir(), 'sc-')), 'speedCurves.mjs')
  writeFileSync(f, code)
  return import(f)
}

export class MaskedKeyframeMover {
  constructor(imagePath, { duration = 2, curve = 'ease-in-out-cubic', fps = 24 } = {}) {
    this.imagePath = imagePath; this.duration = duration; this.curve = curve; this.fps = fps
  }

  async analyze() {
    const img = await loadImage(fs.readFileSync(this.imagePath))
    const c = makeCanvas(img.width, img.height), x = c.getContext('2d')
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, img.width, img.height).data
    // masking sub-tool pass: find the existing black-stroked rectangle (left)
    // and the red destination rectangle (right) by threshold scan.
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1, rx0 = 1e9, ry0 = 1e9, rx1 = -1, ry1 = -1
    for (let y = 0; y < img.height; y += 2) for (let xx = 0; xx < img.width; xx += 2) {
      const i = (y * img.width + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2]
      const dark = r < 90 && g < 90 && b < 90
      const red = r > 150 && g < 100 && b < 100 && y > img.height * 0.4 // exclude arrow + label strokes
      if (dark && xx < img.width * 0.45) { if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (y < by0) by0 = y; if (y > by1) by1 = y }
      if (red) { if (xx < rx0) rx0 = xx; if (xx > rx1) rx1 = xx; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y }
    }
    this.img = img
    this.maskRectPx = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }
    this.destRectPx = { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 }
    // app-format rectangle mask (normalized, exactly covering the existing rect)
    this.mask = {
      shape: 'rectangle', kind: 'shape',
      centerX: (bx0 + bx1) / 2 / img.width, centerY: (by0 + by1) / 2 / img.height,
      width: (bx1 - bx0) / img.width, height: (by1 - by0) / img.height,
    }
    const dx = (rx0 + rx1) / 2 - (bx0 + bx1) / 2
    const dy = (ry0 + ry1) / 2 - (by0 + by1) / 2
    const kf = (id, prop, ch, val, label, color) => ({
      id, property: prop, channel: ch, label, color, defaultValue: 0, unit: 'px',
      keyframes: [
        { id: `${id}-k1`, time: 0, value: 0, interpolation: 'bezier', easingPreset: this.curve },
        { id: `${id}-k2`, time: this.duration, value: val, interpolation: 'bezier', easingPreset: this.curve },
      ],
    })
    this.animation = { curves: { position_x: kf('position_x', 'position', 'X', dx, 'Position X', '#ff5a5a'), position_y: kf('position_y', 'position', 'Y', dy, 'Position Y', '#8ef0c0') } }
    this.delta = { dx, dy }
    const sc = await loadAppSpeedCurves()
    this.evalCurve = (t) => sc.evaluateSpeedCurve(this.curve, t)
    return this
  }

  evalPosition(t) {
    const u = this.evalCurve(t / this.duration)
    return { x: this.delta.dx * u, y: this.delta.dy * u, u }
  }

  /** Full composition frame: plate (whole image) + masked layer at key offset. */
  drawFrame(x, W, H, t, sx, sy) {
    x.drawImage(this.img, 0, 0, W, H)
    const m = this.maskRectPx
    const off = this.evalPosition(t)
    x.save()
    x.beginPath()
    x.rect((m.x + off.x / 1) * sx, (m.y + off.y / 1) * sy, m.w * sx, m.h * sy)
    x.clip()
    x.drawImage(this.img, off.x * sx, off.y * sy, W, H)
    x.restore()
    return off
  }

  descriptor() {
    return {
      mode: 'omniframe',
      workflow: ['masking sub-tool: rectangle drawn over existing rect in image', 'keyframe pos1 @ t=0 (original position)', 'end key @ destination rect center', 'full composition render with keys + curve'],
      clips: [
        { name: 'plate (source image, unmasked)', asset: path.basename(this.imagePath), mask: null, animation: null },
        { name: 'masked mover (same image, rect mask)', asset: path.basename(this.imagePath), mask: this.mask, animation: this.animation },
      ],
      maskRectPx: this.maskRectPx, destRectPx: this.destRectPx, delta: this.delta,
      curve: this.curve, duration: this.duration, fps: this.fps,
    }
  }
}
