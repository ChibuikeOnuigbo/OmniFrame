/**
 * Structural timeline operations. All functions are pure: they take clips and return
 * new clips, which makes undo a snapshot swap and makes the whole module unit-testable
 * without a DOM.
 *
 * Semantics follow professional NLEs (Premiere / Resolve / Kdenlive):
 *   trim   - move one edge, the other edge stays put
 *   ripple - trim/delete plus shift everything after
 *   roll   - move the join between two clips, total length unchanged
 *   slip   - shift the source window, position and length unchanged
 *   slide  - move the clip, trimming its neighbours
 */
import { Clip, Track, clipEnd, clipLength, newClip, sortClips } from './model.js';
import { uid } from '../core/id.js';

export function cloneClip(clip: Clip): Clip {
  return JSON.parse(JSON.stringify(clip, reviveTypedArrays)) as Clip;
}

function reviveTypedArrays(_key: string, value: unknown): unknown {
  return value;
}

export function cloneClips(clips: Clip[]): Clip[] {
  return clips.map((c) => ({
    ...c,
    speedSegments: c.speedSegments.map((s) => ({ ...s })),
    effects: c.effects.map((e) => ({ ...e, params: { ...e.params }, keyframes: { ...e.keyframes } })),
    masks: c.masks.map((m) => ({ ...m, frames: { ...m.frames } })),
    keyframes: { ...c.keyframes },
    transform: { ...c.transform },
    omniframeOpIds: [...c.omniframeOpIds],
  }));
}

export interface TrimOptions {
  /** 'head' moves the left edge, 'tail' moves the right edge */
  edge: 'head' | 'tail';
  /** new timeline frame for that edge */
  frame: number;
}

export function trimClip(clip: Clip, opts: TrimOptions): Clip | null {
  const len = clipLength(clip);
  const rate = clip.speed === 0 ? 1 : Math.abs(clip.speed);
  if (opts.edge === 'head') {
    const maxStart = clipEnd(clip) - 1;
    // Reject rather than silently clamp: the caller needs to be able to tell the user
    // "you have run out of media" instead of quietly getting a 1-frame clip.
    if (opts.frame < 0 || opts.frame > maxStart) return null;
    const start = opts.frame;
    const delta = start - clip.start;
    const newSourceIn = clip.sourceIn + Math.round(delta * rate);
    if (newSourceIn < 0 || newSourceIn >= clip.sourceOut) return null;
    return { ...clip, start, sourceIn: newSourceIn };
  }
  const minEnd = clip.start + 1;
  if (opts.frame < minEnd) return null;
  const end = opts.frame;
  const delta = end - clipEnd(clip);
  const newSourceOut = clip.sourceOut + Math.round(delta * rate);
  if (newSourceOut <= clip.sourceIn) return null;
  return { ...clip, sourceOut: newSourceOut };
}

/** Split at an absolute timeline frame. Returns [left, right] or null if outside. */
export function splitClip(clip: Clip, frame: number): [Clip, Clip] | null {
  const local = frame - clip.start;
  const len = clipLength(clip);
  if (local <= 0 || local >= len) return null;
  const rate = clip.speed === 0 ? 1 : Math.abs(clip.speed);
  const srcOffset = Math.round(local * rate);
  const left: Clip = { ...clip, id: clip.id, sourceOut: clip.sourceIn + srcOffset, omniframeOpIds: [...clip.omniframeOpIds] };
  const right: Clip = {
    ...clip,
    id: uid('clip'),
    start: frame,
    sourceIn: clip.sourceIn + srcOffset,
    fadeIn: 0,
    effects: cloneClips([clip])[0].effects,
    masks: cloneClips([clip])[0].masks,
    keyframes: { ...clip.keyframes },
    omniframeOpIds: [],
  };
  return [left, right];
}

/** Insert a clip, pushing later clips to the right (ripple insert). */
export function rippleInsert(clips: Clip[], clip: Clip): Clip[] {
  const insertAt = clip.start;
  const len = clipLength(clip);
  const out = cloneClips(clips).map((c) => (c.start >= insertAt ? { ...c, start: c.start + len } : c));
  out.push({ ...clip });
  sortClips({ clips: out } as unknown as Track);
  return out;
}

/** Remove a clip and close the gap. */
export function rippleDelete(clips: Clip[], clipId: string): Clip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;
  const len = clipLength(target);
  const at = target.start;
  return cloneClips(clips)
    .filter((c) => c.id !== clipId)
    .map((c) => (c.start >= at ? { ...c, start: c.start - len } : c));
}

/** Ripple trim: trim then shift everything after the trimmed edge. */
export function rippleTrim(clips: Clip[], clipId: string, opts: TrimOptions): Clip[] {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return clips;
  const original = clips[idx];
  const trimmed = trimClip(original, opts);
  if (!trimmed) return clips;
  const before = clipLength(original);
  const after = clipLength(trimmed);
  const delta = after - before;
  return cloneClips(clips).map((c, i) => {
    if (i === idx) return trimmed;
    if (c.start >= clipEnd(original) - 1 && delta !== 0) return { ...c, start: c.start + delta };
    return c;
  });
}

/** Roll: move the join between `leftId` and its right neighbour by `delta` frames. */
export function rollEdit(
  clips: Clip[],
  leftId: string,
  delta: number,
): Clip[] | null {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((c) => c.id === leftId);
  if (idx < 0 || idx + 1 >= sorted.length) return null;
  const left = sorted[idx];
  const right = sorted[idx + 1];
  if (right.start !== clipEnd(left)) return null; // not adjacent
  const rateL = left.speed === 0 ? 1 : Math.abs(left.speed);
  const rateR = right.speed === 0 ? 1 : Math.abs(right.speed);
  const newLeftOut = left.sourceOut + Math.round(delta * rateL);
  const newRightIn = right.sourceIn + Math.round(delta * rateR);
  if (newLeftOut <= left.sourceIn || newRightIn >= right.sourceOut) return null;
  return cloneClips(clips).map((c) => {
    if (c.id === left.id) return { ...c, sourceOut: newLeftOut };
    if (c.id === right.id) return { ...c, sourceIn: newRightIn };
    return c;
  });
}

/** Slip: shift the source window by `delta` frames without moving or resizing the clip. */
export function slipEdit(clips: Clip[], clipId: string, delta: number): Clip[] | null {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const rate = clip.speed === 0 ? 1 : Math.abs(clip.speed);
  const shift = Math.round(delta * rate);
  if (clip.sourceIn + shift < 0) return null;
  return cloneClips(clips).map((c) =>
    c.id === clipId ? { ...c, sourceIn: c.sourceIn + shift, sourceOut: c.sourceOut + shift } : c,
  );
}

/**
 * Slide: move the clip by `delta`, trimming the neighbours.
 * Neighbour lengths absorb the movement so the rest of the timeline is untouched.
 */
export function slideEdit(clips: Clip[], clipId: string, delta: number): Clip[] | null {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((c) => c.id === clipId);
  if (idx < 0) return null;
  const clip = sorted[idx];
  const left = idx > 0 ? sorted[idx - 1] : undefined;
  const right = idx + 1 < sorted.length ? sorted[idx + 1] : undefined;
  const moved = { ...clip, start: clip.start + delta };
  let newLeft = left;
  let newRight = right;
  if (left && clipEnd(left) === clip.start && delta > 0) {
    const rate = left.speed === 0 ? 1 : Math.abs(left.speed);
    const grow = Math.round(delta * rate);
    if (left.sourceIn + grow >= left.sourceOut) return null;
    newLeft = { ...left, sourceOut: left.sourceOut + grow };
  }
  if (right && right.start === clipEnd(clip) && delta < 0) {
    const rate = right.speed === 0 ? 1 : Math.abs(right.speed);
    const shrink = Math.round(-delta * rate);
    if (right.sourceIn + shrink >= right.sourceOut) return null;
    newRight = { ...right, sourceIn: right.sourceIn + shrink, start: right.start - delta };
  }
  return cloneClips(clips).map((c) => {
    if (c.id === clip.id) return moved;
    if (newLeft && c.id === newLeft.id) return newLeft;
    if (newRight && c.id === newRight.id) return newRight;
    return c;
  });
}

/** Move a clip to a new start frame; when `ripple` is set, later clips shift to keep gaps closed. */
export function moveClip(clips: Clip[], clipId: string, newStart: number, ripple = false): Clip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;
  const clamped = Math.max(0, newStart);
  if (!ripple) {
    return cloneClips(clips).map((c) => (c.id === clipId ? { ...c, start: clamped } : c));
  }
  const oldStart = target.start;
  const rest = cloneClips(clips).filter((c) => c.id !== clipId);
  // Close the hole the clip left, but keep a genuine leading gap: the origin is the
  // earliest of the removed clip's old start and whatever remains before it.
  const origin = rest.length ? Math.min(oldStart, ...rest.map((c) => c.start)) : 0;
  const out = compactFrom(rest, origin);
  out.push({ ...cloneClips([target])[0], start: clamped });
  out.sort((a, b) => a.start - b.start);
  // Push anything the moved clip now overlaps to the right.
  let cursor = out[0].start;
  for (const c of out) {
    if (c.start < cursor) c.start = cursor;
    cursor = c.start + clipLength(c);
  }
  return out;
}

/** Close every gap on a track, preserving order, packing against frame 0. */
export function compactGaps(clips: Clip[]): Clip[] {
  return compactFrom(clips, 0);
}

/** Pack clips back-to-back starting at `origin`, preserving their order. */
export function compactFrom(clips: Clip[], origin: number): Clip[] {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  let cursor = Math.max(0, origin);
  return sorted.map((c) => {
    const out = { ...c, start: cursor };
    cursor += clipLength(c);
    return out;
  });
}

export function duplicateClip(clip: Clip): Clip {
  const copy = cloneClips([clip])[0];
  copy.id = uid('clip');
  copy.start = clipEnd(clip);
  copy.name = `${clip.name} copy`;
  copy.masks = copy.masks.map((m) => ({ ...m, id: uid('mask') }));
  return copy;
}

/** Snap a frame to the nearest magnet within `threshold` frames. */
export function snapFrame(frame: number, magnets: number[], threshold: number): number {
  let best = frame;
  let bestDist = threshold + 1;
  for (const m of magnets) {
    const d = Math.abs(m - frame);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function collectMagnets(clips: Clip[], extra: number[] = []): number[] {
  const out = new Set<number>([0, ...extra]);
  for (const c of clips) {
    out.add(c.start);
    out.add(clipEnd(c));
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Build a compound clip: the selected clips are replaced by one clip that references a
 * nested sequence. Effects, masks, keyframes and audio settings are preserved because the
 * clips themselves move into the nested sequence untouched.
 */
export function buildCompound(
  clips: Clip[],
  ids: string[],
  nestedSequenceId: string,
  name = 'Compound Clip',
): { outer: Clip[]; nested: Clip[] } | null {
  const chosen = clips.filter((c) => ids.includes(c.id));
  if (chosen.length === 0) return null;
  const start = Math.min(...chosen.map((c) => c.start));
  const end = Math.max(...chosen.map(clipEnd));
  const nested = chosen.map((c) => ({ ...c, start: c.start - start }));
  const outer: Clip = newClip({
    name,
    kind: 'compound',
    start,
    sourceIn: 0,
    sourceOut: end - start,
    nestedSequenceId,
  });
  return {
    outer: cloneClips(clips).filter((c) => !ids.includes(c.id)).concat([outer]),
    nested,
  };
}
