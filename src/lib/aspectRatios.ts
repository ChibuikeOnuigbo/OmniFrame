import type { AspectRatioType, RatioPreset } from '../types'

export const RATIO_PRESETS: RatioPreset[] = [
  {
    id: 'source',
    label: 'Original / Source',
    aspectRatio: 'source',
    width: 1920,
    height: 1080,
    platforms: ['Source Dimensions', 'Camera Native'],
    description: 'Matches the native resolution of primary media asset.',
    platformIcon: 'source',
  },
  {
    id: '16:9',
    label: '16:9',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    platforms: ['YouTube', 'Vimeo', 'Landscape Video'],
    description: 'Standard widescreen HD / 4K landscape format.',
    platformIcon: 'youtube',
  },
  {
    id: '9:16',
    label: '9:16',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    platforms: ['YouTube Shorts', 'TikTok', 'Instagram Reels'],
    description: 'Fullscreen vertical mobile format.',
    platformIcon: 'youtube-tiktok',
  },
  {
    id: '1:1',
    label: '1:1',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    platforms: ['Instagram Square', 'Facebook', 'X / Twitter'],
    description: 'Square feed video format.',
    platformIcon: 'instagram',
  },
  {
    id: '4:5',
    label: '4:5',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    platforms: ['Instagram Portrait', 'Facebook Mobile'],
    description: 'Vertical portrait format optimized for Instagram feeds.',
    platformIcon: 'instagram',
  },
  {
    id: '3:4',
    label: '3:4',
    aspectRatio: '3:4',
    width: 1080,
    height: 1440,
    platforms: ['Instagram Grid', 'Instagram Feed', 'iPad Video'],
    description: 'Instagram profile grid and tall vertical feed format.',
    platformIcon: 'instagram',
  },
  {
    id: '4:3',
    label: '4:3',
    aspectRatio: '4:3',
    width: 1440,
    height: 1080,
    platforms: ['Classic TV', 'Retro Cinema', 'Presentation'],
    description: 'Standard definition broadcast format.',
    platformIcon: 'tv',
  },
  {
    id: '3:2',
    label: '3:2',
    aspectRatio: '3:2',
    width: 1620,
    height: 1080,
    platforms: ['DSLR Photo', 'Photography Portfolios'],
    description: 'Classic 35mm photography format.',
    platformIcon: 'camera',
  },
  {
    id: '2:3',
    label: '2:3',
    aspectRatio: '2:3',
    width: 1080,
    height: 1620,
    platforms: ['Pinterest Pin', 'Portrait Photo'],
    description: 'Official Pinterest pin format and vertical photography.',
    platformIcon: 'pinterest',
  },
  {
    id: '5:4',
    label: '5:4',
    aspectRatio: '5:4',
    width: 1350,
    height: 1080,
    platforms: ['Monitors', 'Medium Format Photo'],
    description: 'Large display monitor format.',
    platformIcon: 'tv',
  },
  {
    id: '21:9',
    label: '21:9',
    aspectRatio: '21:9',
    width: 2560,
    height: 1080,
    platforms: ['Cinemascope', 'Ultra Wide Monitors', 'Anamorphic Film'],
    description: 'Ultrawidescreen cinematic presentation.',
    platformIcon: 'film',
  },
  {
    id: 'custom',
    label: 'Custom',
    aspectRatio: 'custom',
    width: 1920,
    height: 1080,
    platforms: ['Custom Dimensions'],
    description: 'User specified pixel width and height.',
    platformIcon: 'custom',
  },
]

export const MIN_DIMENSION = 64
export const MAX_DIMENSION = 7680

export function validateDimensions(w: number, h: number): { valid: boolean; error?: string } {
  if (typeof w !== 'number' || typeof h !== 'number') {
    return { valid: false, error: 'Dimensions must be numeric' }
  }
  if (!Number.isFinite(w) || !Number.isFinite(h) || Number.isNaN(w) || Number.isNaN(h)) {
    return { valid: false, error: 'Dimensions cannot be NaN or Infinite' }
  }
  if (w <= 0 || h <= 0) {
    return { valid: false, error: 'Dimensions must be strictly positive' }
  }
  if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
    return { valid: false, error: `Dimensions must be at least ${MIN_DIMENSION}px` }
  }
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    return { valid: false, error: `Dimensions cannot exceed ${MAX_DIMENSION}px` }
  }
  return { valid: true }
}
