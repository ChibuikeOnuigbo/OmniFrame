import type { ClipEffect } from '../types'

/** Convert an editor colour to rgba while keeping alpha bounded. */
export function lightColorWithAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((ch) => ch + ch).join('') : hex[1]
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color.trim())
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`
  return `rgba(255, 217, 160, ${a})`
}

function directionalBeam(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: ClipEffect,
  color: string,
  intensity: number,
): void {
  const angle = ((effect.lightAngle ?? 35) * Math.PI) / 180
  const nx = -Math.sin(angle)
  const ny = Math.cos(angle)
  const span = Math.hypot(width, height)
  const cx = (effect.lightX ?? 0.5) * width
  const cy = (effect.lightY ?? 0.4) * height
  const widthRatio = Math.max(0.03, Math.min(1, effect.lightWidth ?? 0.28))
  const softness = Math.max(0.01, Math.min(1, effect.lightSoftness ?? 0.4))
  const halfCore = widthRatio * 0.34
  const feather = Math.max(0.01, widthRatio * (0.15 + softness * 0.75))
  const grad = ctx.createLinearGradient(
    cx - nx * span / 2,
    cy - ny * span / 2,
    cx + nx * span / 2,
    cy + ny * span / 2,
  )
  const outerA = Math.max(0, 0.5 - halfCore - feather)
  const innerA = Math.max(outerA + 0.001, 0.5 - halfCore)
  const innerB = Math.min(0.999, 0.5 + halfCore)
  const outerB = Math.min(1, 0.5 + halfCore + feather)
  grad.addColorStop(0, lightColorWithAlpha(color, 0))
  grad.addColorStop(outerA, lightColorWithAlpha(color, 0))
  grad.addColorStop(innerA, lightColorWithAlpha(color, Math.min(1, intensity)))
  grad.addColorStop(innerB, lightColorWithAlpha(color, Math.min(1, intensity)))
  grad.addColorStop(outerB, lightColorWithAlpha(color, 0))
  grad.addColorStop(1, lightColorWithAlpha(color, 0))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

/** Shared preview/export light compositor. */
export function applyLightComposite(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect?: ClipEffect,
): void {
  const intensity = effect?.lightIntensity ?? 0
  if (!effect || intensity <= 0) return
  const color = effect.lightColor || '#ffd9a0'
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  if (effect.lightType === 'directional') {
    directionalBeam(ctx, width, height, effect, color, intensity)
    ctx.restore()
    return
  }
  const cx = (effect.lightX ?? 0.5) * width
  const cy = (effect.lightY ?? 0.4) * height
  const radius = Math.max(24, (effect.lightFalloff ?? 0.45) * Math.max(width, height))
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  gradient.addColorStop(0, lightColorWithAlpha(color, Math.min(1, intensity)))
  gradient.addColorStop(1, lightColorWithAlpha(color, 0))
  if (effect.lightType === 'spot') {
    ctx.translate(cx, cy)
    ctx.rotate(((effect.lightAngle ?? 0) * Math.PI) / 180)
    ctx.scale(1, 0.55)
    ctx.translate(-cx, -cy)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
