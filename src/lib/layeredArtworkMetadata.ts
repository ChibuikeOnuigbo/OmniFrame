import type { LayeredArtworkAssetInfo, MediaAsset, PsdLayerAssetInfo } from '../types'

/** Read current generic metadata, with a safe bridge for old saved PSD assets. */
export function getLayeredArtworkInfo(
  asset: Pick<MediaAsset, 'layeredArtwork' | 'psdLayer'>,
): LayeredArtworkAssetInfo | undefined {
  if (asset.layeredArtwork) return asset.layeredArtwork
  const legacy = asset.psdLayer as PsdLayerAssetInfo | undefined
  if (!legacy) return undefined
  return {
    ...legacy,
    sourceFormat: 'psd',
    // Older PSD imports already rendered effective opacity into the PNG.
    opacityBaked: legacy.opacityBaked ?? true,
  }
}

const COMPOSITE_ALIASES: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  'source-over': 'source-over',
  'src-over': 'source-over',
  'svg:src-over': 'source-over',
  'svg:normal': 'source-over',
  'krita:normal': 'source-over',
  pass: 'source-over',
}

const CANVAS_BLEND_MODES = new Set<string>([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
])

/**
 * Convert common PSD/ORA blend labels to operations implemented by Canvas 2D.
 * Unknown modes deliberately return undefined; importers can then use the
 * source application's merged composite instead of silently changing a grade.
 */
export function toCanvasCompositeOperation(value?: string): GlobalCompositeOperation | undefined {
  if (!value) return 'source-over'
  const key = value.trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (COMPOSITE_ALIASES[key]) return COMPOSITE_ALIASES[key]
  if (CANVAS_BLEND_MODES.has(key)) return key as GlobalCompositeOperation
  if (key.startsWith('svg:')) {
    const mode = key.slice(4)
    if (CANVAS_BLEND_MODES.has(mode)) return mode as GlobalCompositeOperation
  }
  return undefined
}

export type CssArtworkBlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference'
  | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

/** CSS mix-blend-mode counterpart for the DOM-based Rigging canvas. */
export function toCssArtworkBlendMode(value?: string): CssArtworkBlendMode {
  const operation = toCanvasCompositeOperation(value)
  if (!operation || operation === 'source-over') return 'normal'
  return CANVAS_BLEND_MODES.has(operation) ? operation as CssArtworkBlendMode : 'normal'
}
