/**
 * Timeline data model.
 *
 * Time base: every clip stores its position in *sequence frames* (integers) so that
 * trimming is frame-accurate and never drifts. `sourceIn`/`sourceOut` are frames of
 * the source asset, `start` is the frame offset on the track.
 */
import { uid } from '../core/id.js';

export type TrackKind =
  | 'video'
  | 'audio'
  | 'text'
  | 'caption'
  | 'graphics'
  | 'adjustment'
  | 'scene3d'
  | 'compound';

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'softLight' | 'hardLight'
  | 'difference' | 'add' | 'subtract' | 'darken' | 'lighten';

export interface Keyframe {
  /** frame offset from clip start */
  frame: number;
  value: number | string | number[];
  easing: KeyframeEasing;
  /** bezier handles in normalised [0..1] time, [0..1] value space */
  bezier?: { x1: number; y1: number; x2: number; y2: number };
  /** spring parameters, used when easing === 'spring' */
  spring?: { mass: number; stiffness: number; damping: number };
}

export type KeyframeEasing =
  | 'linear' | 'hold' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier' | 'spring';

export interface EffectInstance {
  id: string;
  effectId: string;
  version: number;
  enabled: boolean;
  params: Record<string, number | string | boolean | number[]>;
  /** optional keyframed parameter channels */
  keyframes: Record<string, Keyframe[]>;
  /** mask source id, if the effect is masked */
  maskId?: string;
  blend: BlendMode;
  opacity: number;
}

export interface MaskInstance {
  id: string;
  name: string;
  /** per-frame mask definition. Frames are clip-relative. */
  frames: Record<number, MaskFrameData>;
  /** frames produced by tracking (kept separate so a correction can invalidate just this) */
  trackedFrom?: { frame: number; method: string; confidence?: number };
  inverted: boolean;
  feather: number;
  grow: number;
  mode: MaskDisplayMode;
}

export type MaskDisplayMode =
  | 'red' | 'whiteMatte' | 'blackMatte' | 'alphaChecker' | 'outline'
  | 'marchingAnts' | 'sourceAndMask' | 'maskOnly' | 'edgeOnly' | 'difference';

export interface MaskFrameData {
  /** RLE-encoded runs of selected pixels: [start,length,start,length,...] */
  runs: Int32Array;
  width: number;
  height: number;
}

export interface SpeedSegment {
  /** clip-relative frame where the segment starts */
  frame: number;
  rate: number;
  ease: 'linear' | 'smooth';
}

export interface Clip {
  id: string;
  assetId: string | null;
  kind: TrackKind;
  name: string;
  /** frame on the track where this clip begins */
  start: number;
  /** first source frame shown */
  sourceIn: number;
  /** last source frame shown (exclusive) */
  sourceOut: number;
  speed: number;
  speedSegments: SpeedSegment[];
  reversed: boolean;
  frozen: { at: number; duration: number } | null;
  transform: { x: number; y: number; scale: number; rotation: number; opacity: number; anchorX: number; anchorY: number };
  blend: BlendMode;
  effects: EffectInstance[];
  masks: MaskInstance[];
  keyframes: Record<string, Keyframe[]>;
  /** audio */
  gain: number;
  pan: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
  /** omniframe operations attached to this clip */
  omniframeOpIds: string[];
  /** for compound clips: the nested sequence id */
  nestedSequenceId?: string;
  locked: boolean;
  groupId?: string;
  color: string | null;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Clip[];
  locked: boolean;
  muted: boolean;
  solo: boolean;
  hidden: boolean;
  height: number;
  /** adjustment tracks apply their effects to everything below them */
  isAdjustment?: boolean;
}

export interface Marker {
  id: string;
  frame: number;
  /** end frame for range markers (exclusive); equals frame for point markers */
  endFrame: number;
  label: string;
  comment: string;
  color: string;
}

export interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  sampleRate: number;
  tracks: Track[];
  markers: Marker[];
  duration: number;
}

export function newClip(partial: Partial<Clip> = {}): Clip {
  return {
    id: uid('clip'),
    assetId: null,
    kind: 'video',
    name: 'Clip',
    start: 0,
    sourceIn: 0,
    sourceOut: 0,
    speed: 1,
    speedSegments: [],
    reversed: false,
    frozen: null,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5 },
    blend: 'normal',
    effects: [],
    masks: [],
    keyframes: {},
    gain: 1,
    pan: 0,
    fadeIn: 0,
    fadeOut: 0,
    muted: false,
    omniframeOpIds: [],
    locked: false,
    groupId: undefined,
    color: null,
    ...partial,
  };
}

export function newTrack(kind: TrackKind = 'video', name?: string): Track {
  return {
    id: uid('track'),
    kind,
    name: name ?? kindLabel(kind),
    clips: [],
    locked: false,
    muted: false,
    solo: false,
    hidden: false,
    height: kind === 'audio' ? 72 : 60,
    isAdjustment: kind === 'adjustment',
  };
}

export function kindLabel(kind: TrackKind): string {
  switch (kind) {
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'text': return 'Text';
    case 'caption': return 'Captions';
    case 'graphics': return 'Graphics';
    case 'adjustment': return 'Adjustment';
    case 'scene3d': return '3D';
    case 'compound': return 'Compound';
  }
}

export function newSequence(name = 'Sequence 1'): Sequence {
  return {
    id: uid('seq'),
    name,
    fps: 30,
    width: 1920,
    height: 1080,
    sampleRate: 48000,
    tracks: [newTrack('video', 'V1'), newTrack('audio', 'A1')],
    markers: [],
    duration: 0,
  };
}

/** Clip duration in timeline frames, accounting for speed and freeze frames. */
export function clipLength(clip: Clip): number {
  const src = Math.max(0, clip.sourceOut - clip.sourceIn);
  const sped = clip.speed === 0 ? src : src / Math.abs(clip.speed);
  const freeze = clip.frozen ? clip.frozen.duration : 0;
  return Math.round(sped) + freeze;
}

export function clipEnd(clip: Clip): number {
  return clip.start + clipLength(clip);
}

/** Map a timeline frame to a source frame, honouring speed segments, reverse and freeze. */
export function timelineToSource(clip: Clip, timelineFrame: number): number {
  const local = timelineFrame - clip.start;
  if (clip.frozen && local >= clip.frozen.at && local < clip.frozen.at + clip.frozen.duration) {
    return clip.frozen.at;
  }
  let cursor = 0;
  let consumed = 0;
  const segs = clip.speedSegments.length
    ? [...clip.speedSegments].sort((a, b) => a.frame - b.frame)
    : [{ frame: 0, rate: clip.speed, ease: 'linear' as const }];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const next = i + 1 < segs.length ? segs[i + 1].frame : Number.POSITIVE_INFINITY;
    const segLen = next - seg.frame;
    if (local < seg.frame + segLen) {
      const rate = seg.rate === 0 ? 1 : Math.abs(seg.rate);
      cursor += (local - seg.frame) * rate;
      break;
    }
    cursor += segLen * (seg.rate === 0 ? 1 : Math.abs(seg.rate));
    consumed += segLen;
  }
  void consumed;
  const src = clip.sourceIn + cursor;
  if (clip.reversed) {
    return Math.max(clip.sourceIn, clip.sourceOut - (src - clip.sourceIn));
  }
  return Math.min(clip.sourceOut - 1, Math.max(clip.sourceIn, Math.round(src)));
}

export function sequenceDuration(seq: Sequence): number {
  let end = 0;
  for (const t of seq.tracks) for (const c of t.clips) end = Math.max(end, clipEnd(c));
  return end;
}

export function sortClips(track: Track): void {
  track.clips.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function findClipAt(seq: Sequence, trackId: string, frame: number): Clip | undefined {
  const track = seq.tracks.find((t) => t.id === trackId);
  if (!track) return undefined;
  return track.clips.find((c) => frame >= c.start && frame < clipEnd(c));
}

export function overlaps(a: Clip, b: Clip): boolean {
  return a.start < clipEnd(b) && b.start < clipEnd(a);
}
