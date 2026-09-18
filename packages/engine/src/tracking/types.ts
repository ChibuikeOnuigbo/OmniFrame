/** Shared tracking vocabulary. */
import { Vec2 } from '../core/geometry.js';

export interface TrackPoint {
  id: number;
  /** current position in the analysed frame */
  pos: Vec2;
  /** position in the reference (first) frame */
  ref: Vec2;
  /** last observed displacement per frame */
  velocity: Vec2;
  /** per-point photometric + consistency confidence in [0,1] */
  confidence: number;
  /** forward/backward reprojection error in pixels */
  fbError: number;
  occluded: boolean;
  /** how many consecutive frames this point has been lost */
  lostFrames: number;
  /** normalised distance to the mask boundary (0 = on edge, 1 = deep inside) */
  edgeProximity: number;
}

export type TrackQuality = 'excellent' | 'good' | 'uncertain' | 'lost';

export interface FrameTrack {
  frame: number;
  points: TrackPoint[];
  /** global camera motion for this frame pair (affine, 6 params) */
  camera: { matrix: number[]; inliers: number; residual: number };
  /** non-rigid displacement used to warp the mask */
  warpValid: boolean;
  quality: TrackQuality;
  metrics: TrackMetrics;
  reinitialised: number;
}

export interface TrackMetrics {
  /** mean forward/backward reprojection error (px) */
  fbError: number;
  /** fraction of points that survived the consistency test */
  inlierRatio: number;
  /** how much the tracked area changed vs the reference */
  areaDrift: number;
  /** std-dev of consecutive boundary positions (jitter) */
  boundaryJitter: number;
  /** number of points re-detected mid-track */
  reinitialised: number;
  /** median point displacement magnitude */
  displacement: number;
  /** confidence score in [0,1] derived from the above — never invented */
  confidence: number;
}

export const EMPTY_METRICS: TrackMetrics = {
  fbError: 0,
  inlierRatio: 1,
  areaDrift: 0,
  boundaryJitter: 0,
  reinitialised: 0,
  displacement: 0,
  confidence: 1,
};

export function qualityFromConfidence(c: number, inlierRatio: number): TrackQuality {
  if (inlierRatio < 0.15 || c < 0.2) return 'lost';
  if (c >= 0.85 && inlierRatio >= 0.7) return 'excellent';
  if (c >= 0.6 && inlierRatio >= 0.45) return 'good';
  return 'uncertain';
}

export type TrackDirection = 'forward' | 'backward' | 'both';
export type TrackPreset = 'fast' | 'balanced' | 'quality' | 'all';

export interface TrackOptions {
  /** how many feature points to seed inside the region */
  featureCount: number;
  /** half-window for Lucas-Kanade */
  windowSize: number;
  /** pyramid levels (0 = single scale) */
  pyramidLevels: number;
  /** LK iterations per level */
  iterations: number;
  /** reject a point when the forward/backward error exceeds this (px) */
  fbThreshold: number;
  /** run a forward->backward consistency pass */
  forwardBackward: boolean;
  /** estimate and remove global camera motion before local tracking */
  globalMotion: boolean;
  /** robust outlier rejection */
  robustOutliers: boolean;
  /** re-detect features when confidence drops below this */
  reinitThreshold: number;
  /** allow the non-rigid (deformable) warp instead of a single affine */
  nonRigid: boolean;
  /** boundary refinement radius in pixels */
  boundaryRefine: number;
  /** occlusion handling */
  occlusion: boolean;
  /** analysis resolution — full-res 4K tracking is never the default */
  analysisScale: number;
  seed?: number;
}

export const DEFAULT_TRACK_OPTIONS: TrackOptions = {
  featureCount: 220,
  windowSize: 11,
  pyramidLevels: 3,
  iterations: 20,
  fbThreshold: 2.5,
  forwardBackward: true,
  globalMotion: true,
  robustOutliers: true,
  reinitThreshold: 0.45,
  nonRigid: true,
  boundaryRefine: 4,
  occlusion: true,
  analysisScale: 0.5,
  seed: 20240613,
};

export function presetOptions(preset: TrackPreset): TrackOptions {
  switch (preset) {
    case 'fast':
      return { ...DEFAULT_TRACK_OPTIONS, featureCount: 90, windowSize: 7, pyramidLevels: 2, iterations: 10, nonRigid: false, boundaryRefine: 0, analysisScale: 0.35 };
    case 'balanced':
      return { ...DEFAULT_TRACK_OPTIONS };
    case 'quality':
      return { ...DEFAULT_TRACK_OPTIONS, featureCount: 480, windowSize: 15, pyramidLevels: 4, iterations: 30, boundaryRefine: 8, analysisScale: 0.75 };
    case 'all':
      return { ...DEFAULT_TRACK_OPTIONS, featureCount: 640, windowSize: 15, pyramidLevels: 4, iterations: 30, boundaryRefine: 8, analysisScale: 1 };
  }
}
