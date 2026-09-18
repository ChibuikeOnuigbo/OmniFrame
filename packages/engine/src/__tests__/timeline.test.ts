import { describe, it, expect } from 'vitest';
import {
  newClip, newTrack, newSequence, clipLength, clipEnd, timelineToSource, sequenceDuration, findClipAt,
} from '../timeline/model.js';
import {
  splitClip, trimClip, rippleInsert, rippleDelete, rippleTrim, rollEdit, slipEdit, slideEdit,
  moveClip, compactGaps, duplicateClip, snapFrame, collectMagnets, buildCompound, cloneClips,
} from '../timeline/ops.js';
import { History, SetPropCommand, MacroCommand } from '../timeline/commands.js';
import {
  setKeyframe, evaluate, evaluateNumber, cubicBezier, springResponse, bake, moveKeyframe,
} from '../timeline/keyframes.js';

describe('clip maths', () => {
  it('computes length from source range and speed', () => {
    const c = newClip({ sourceIn: 0, sourceOut: 90, speed: 1 });
    expect(clipLength(c)).toBe(90);
    const slow = newClip({ sourceIn: 0, sourceOut: 90, speed: 0.5 });
    expect(clipLength(slow)).toBe(180);
  });

  it('maps timeline frames to source frames', () => {
    const c = newClip({ start: 10, sourceIn: 100, sourceOut: 200, speed: 1 });
    expect(timelineToSource(c, 10)).toBe(100);
    expect(timelineToSource(c, 20)).toBe(110);
  });

  it('reverses source order when reversed', () => {
    const c = newClip({ start: 0, sourceIn: 0, sourceOut: 100, speed: 1, reversed: true });
    expect(timelineToSource(c, 0)).toBe(100);
    expect(timelineToSource(c, 99)).toBeLessThan(100);
  });

  it('holds a freeze frame', () => {
    const c = newClip({ start: 0, sourceIn: 0, sourceOut: 60, speed: 1, frozen: { at: 30, duration: 20 } });
    expect(clipLength(c)).toBe(80);
    expect(timelineToSource(c, 35)).toBe(30);
    expect(timelineToSource(c, 49)).toBe(30);
  });

  it('respects speed segments', () => {
    const c = newClip({
      start: 0, sourceIn: 0, sourceOut: 1000, speed: 1,
      speedSegments: [{ frame: 0, rate: 1, ease: 'linear' }, { frame: 30, rate: 2, ease: 'linear' }],
    });
    expect(timelineToSource(c, 10)).toBe(10);
    // 30 frames at 1x then 10 frames at 2x = 30 + 20 source frames
    expect(timelineToSource(c, 40)).toBe(50);
  });
});

describe('trim / split', () => {
  it('trims the head, keeping the tail pinned', () => {
    const c = newClip({ start: 10, sourceIn: 50, sourceOut: 150, speed: 1 });
    const t = trimClip(c, { edge: 'head', frame: 20 })!;
    expect(t.start).toBe(20);
    expect(t.sourceIn).toBe(60);
    expect(clipEnd(t)).toBe(clipEnd(c));
  });

  it('trims the tail, keeping the head pinned', () => {
    const c = newClip({ start: 10, sourceIn: 50, sourceOut: 150, speed: 1 });
    const t = trimClip(c, { edge: 'tail', frame: 80 })!;
    expect(t.start).toBe(10);
    expect(t.sourceOut).toBe(120);
    expect(clipEnd(t)).toBe(80);
  });

  it('refuses a trim that would invert the clip', () => {
    const c = newClip({ start: 10, sourceIn: 50, sourceOut: 150, speed: 1 });
    expect(trimClip(c, { edge: 'head', frame: 200 })).toBeNull();
    expect(trimClip(c, { edge: 'tail', frame: 5 })).toBeNull();
  });

  it('splits a clip in two and conserves total length', () => {
    const c = newClip({ start: 0, sourceIn: 0, sourceOut: 100, speed: 1 });
    const [a, b] = splitClip(c, 40)!;
    expect(clipLength(a) + clipLength(b)).toBe(100);
    expect(a.sourceOut).toBe(40);
    expect(b.sourceIn).toBe(40);
    expect(b.start).toBe(40);
    expect(a.id).not.toBe(b.id);
  });

  it('refuses to split outside the clip', () => {
    const c = newClip({ start: 10, sourceIn: 0, sourceOut: 50, speed: 1 });
    expect(splitClip(c, 10)).toBeNull();
    expect(splitClip(c, 60)).toBeNull();
    expect(splitClip(c, 5)).toBeNull();
  });
});

describe('ripple / roll / slip / slide', () => {
  const twoClips = () => [
    newClip({ id: 'a', start: 0, sourceIn: 0, sourceOut: 50, speed: 1 }),
    newClip({ id: 'b', start: 50, sourceIn: 0, sourceOut: 50, speed: 1 }),
  ];

  it('ripple delete closes the gap', () => {
    const out = rippleDelete(twoClips(), 'a');
    expect(out.length).toBe(1);
    expect(out[0].start).toBe(0);
  });

  it('ripple insert pushes later clips right', () => {
    const add = newClip({ id: 'x', start: 20, sourceIn: 0, sourceOut: 30, speed: 1 });
    const out = rippleInsert(twoClips(), add);
    expect(out.length).toBe(3);
    expect(out.find((c) => c.id === 'b')!.start).toBe(80);
  });

  it('ripple trim shifts the following clip by the same amount', () => {
    const out = rippleTrim(twoClips(), 'a', { edge: 'tail', frame: 30 });
    expect(out.find((c) => c.id === 'a')!.sourceOut).toBe(30);
    expect(out.find((c) => c.id === 'b')!.start).toBe(30);
  });

  it('roll moves the join without changing total length', () => {
    const out = rollEdit(twoClips(), 'a', 10)!;
    const a = out.find((c) => c.id === 'a')!;
    const b = out.find((c) => c.id === 'b')!;
    expect(a.sourceOut).toBe(60);
    expect(b.sourceIn).toBe(10);
    expect(clipEnd(a)).toBe(60);
    expect(b.start).toBe(50);
    expect(clipLength(a) + clipLength(b)).toBe(100);
  });

  it('roll refuses to eat a clip alive', () => {
    expect(rollEdit(twoClips(), 'a', 60)).toBeNull();
    expect(rollEdit(twoClips(), 'a', -60)).toBeNull();
  });

  it('slip moves the source window without moving the clip', () => {
    const out = slipEdit(twoClips(), 'b', 20)!;
    const b = out.find((c) => c.id === 'b')!;
    expect(b.start).toBe(50);
    expect(b.sourceIn).toBe(20);
    expect(b.sourceOut).toBe(70);
    expect(clipLength(b)).toBe(50);
  });

  it('slide moves the clip and trims the neighbours', () => {
    const three = [
      newClip({ id: 'a', start: 0, sourceIn: 0, sourceOut: 50, speed: 1 }),
      newClip({ id: 'b', start: 50, sourceIn: 0, sourceOut: 50, speed: 1 }),
      newClip({ id: 'c', start: 100, sourceIn: 0, sourceOut: 50, speed: 1 }),
    ];
    const out = slideEdit(three, 'b', 10)!;
    const a = out.find((c) => c.id === 'a')!;
    const b = out.find((c) => c.id === 'b')!;
    const c = out.find((c) => c.id === 'c')!;
    expect(b.start).toBe(60);
    expect(a.sourceOut).toBe(60);           // left neighbour grew
    expect(clipEnd(a)).toBe(60);
    expect(c.start).toBe(100);              // right neighbour unchanged in position
  });

  it('compacts gaps', () => {
    const clips = [
      newClip({ id: 'a', start: 0, sourceIn: 0, sourceOut: 20, speed: 1 }),
      newClip({ id: 'b', start: 90, sourceIn: 0, sourceOut: 30, speed: 1 }),
    ];
    const out = compactGaps(clips);
    expect(out[1].start).toBe(20);
  });

  it('move with ripple closes the hole it left', () => {
    const clips = [
      newClip({ id: 'a', start: 0, sourceIn: 0, sourceOut: 20, speed: 1 }),
      newClip({ id: 'b', start: 20, sourceIn: 0, sourceOut: 20, speed: 1 }),
      newClip({ id: 'c', start: 40, sourceIn: 0, sourceOut: 20, speed: 1 }),
    ];
    const out = moveClip(clips, 'a', 40, true);
    const a = out.find((c) => c.id === 'a')!;
    expect(a.start).toBe(40);
    expect(sequenceDurationOf(out)).toBe(60);
  });
});

function sequenceDurationOf(clips: ReturnType<typeof newClip>[]): number {
  return Math.max(...clips.map(clipEnd));
}

describe('snapping and magnets', () => {
  it('snaps to the nearest magnet within threshold', () => {
    expect(snapFrame(51, [0, 50, 100], 3)).toBe(50);
    expect(snapFrame(60, [0, 50, 100], 3)).toBe(60);
  });

  it('collects clip edges as magnets', () => {
    const clips = [newClip({ start: 10, sourceIn: 0, sourceOut: 20, speed: 1 })];
    const m = collectMagnets(clips);
    expect(m).toContain(0);
    expect(m).toContain(10);
    expect(m).toContain(30);
  });
});

describe('compound clips', () => {
  it('nests the chosen clips and preserves their effects', () => {
    const clips = [
      newClip({ id: 'a', start: 10, sourceIn: 0, sourceOut: 20, speed: 1 }),
      newClip({ id: 'b', start: 30, sourceIn: 0, sourceOut: 30, speed: 1 }),
      newClip({ id: 'keep', start: 0, sourceIn: 0, sourceOut: 10, speed: 1 }),
    ];
    clips[0].effects.push({
      id: 'e1', effectId: 'brightness', version: 1, enabled: true,
      params: { amount: 0.2 }, keyframes: {}, blend: 'normal', opacity: 1,
    });
    const res = buildCompound(clips, ['a', 'b'], 'nested-1')!;
    expect(res.outer.length).toBe(2);
    expect(res.nested.length).toBe(2);
    expect(res.nested[0].start).toBe(0);
    expect(res.nested[0].effects.length).toBe(1);
    expect(res.outer.find((c) => c.kind === 'compound')!.nestedSequenceId).toBe('nested-1');
  });
});

describe('history', () => {
  it('undoes and redoes a property change', () => {
    const obj = { opacity: 1 };
    const h = new History();
    h.execute(new SetPropCommand(obj, 'opacity', 0.5, 'Set opacity'));
    expect(obj.opacity).toBe(0.5);
    expect(h.undo()).toBe('Set opacity');
    expect(obj.opacity).toBe(1);
    expect(h.redo()).toBe('Set opacity');
    expect(obj.opacity).toBe(0.5);
  });

  it('collapses a batch into one user-visible undo', () => {
    const obj = { a: 0, b: 0 };
    const h = new History();
    h.beginBatch('Omniframe move');
    h.execute(new SetPropCommand(obj, 'a', 1, 'set a'));
    h.execute(new SetPropCommand(obj, 'b', 2, 'set b'));
    h.endBatch();
    expect(h.entries().undo.length).toBe(1);
    expect(h.undo()).toBe('Omniframe move');
    expect(obj.a).toBe(0);
    expect(obj.b).toBe(0);
  });

  it('clears the redo stack on a new command', () => {
    const obj = { a: 0 };
    const h = new History();
    h.execute(new SetPropCommand(obj, 'a', 1, 'one'));
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.execute(new SetPropCommand(obj, 'a', 5, 'two'));
    expect(h.canRedo()).toBe(false);
  });

  it('merges scrubbed commands', () => {
    const obj = { a: 0 };
    const h = new History();
    h.execute(new SetPropCommand(obj, 'a', 1, 'scrub'));
    h.execute(new SetPropCommand(obj, 'a', 2, 'scrub'));
    expect(h.undo()).toBe('scrub');
    expect(obj.a).toBe(0);
    h.redo();
    expect(obj.a).toBe(2);
    expect(h.entries().undo.length).toBe(1);
    expect(obj.a).toBe(2);
  });
});

describe('keyframes', () => {
  it('holds the first value before the first key', () => {
    const ch = [{ frame: 10, value: 5, easing: 'linear' as const }];
    expect(evaluateNumber(ch, 0)).toBe(5);
  });

  it('interpolates linearly', () => {
    const ch = [
      { frame: 0, value: 0, easing: 'linear' as const },
      { frame: 10, value: 100, easing: 'linear' as const },
    ];
    expect(evaluateNumber(ch, 5)).toBe(50);
  });

  it('holds on a hold keyframe', () => {
    const ch = [
      { frame: 0, value: 0, easing: 'hold' as const },
      { frame: 10, value: 100, easing: 'linear' as const },
    ];
    expect(evaluateNumber(ch, 9)).toBe(0);
    expect(evaluateNumber(ch, 10)).toBe(100);
  });

  it('interpolates arrays componentwise', () => {
    const ch = [
      { frame: 0, value: [0, 10], easing: 'linear' as const },
      { frame: 10, value: [10, 20], easing: 'linear' as const },
    ];
    expect(evaluate(ch, 5)).toEqual([5, 15]);
  });

  it('cubic-bezier endpoints are exact and the curve is monotonic', () => {
    const f = cubicBezier(0.42, 0, 0.58, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      const v = f(i / 10);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('spring settles at 1 and overshoots when underdamped', () => {
    const s = springResponse(1, { mass: 1, stiffness: 100, damping: 10, duration: 1 });
    expect(s).toBeGreaterThan(0.95);
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, springResponse(i / 100, { mass: 1, stiffness: 100, damping: 4, duration: 1 }));
    expect(peak).toBeGreaterThan(1.05);
  });

  it('bakes a channel to per-frame values', () => {
    const ch = [
      { frame: 0, value: 0, easing: 'linear' as const },
      { frame: 4, value: 40, easing: 'linear' as const },
    ];
    expect(bake(ch, 0, 5)).toEqual([0, 10, 20, 30, 40]);
  });

  it('moves the nearest keyframe', () => {
    const ch = [
      { frame: 0, value: 0, easing: 'linear' as const },
      { frame: 10, value: 1, easing: 'linear' as const },
    ];
    const out = moveKeyframe(ch, 11, 20);
    expect(out[1].frame).toBe(20);
  });

  it('replaces an existing keyframe instead of duplicating it', () => {
    const ch = setKeyframe([], { frame: 5, value: 1, easing: 'linear' });
    const ch2 = setKeyframe(ch, { frame: 5, value: 2, easing: 'linear' });
    expect(ch2.length).toBe(1);
    expect(ch2[0].value).toBe(2);
  });
});

describe('sequence', () => {
  it('reports duration as the latest clip end', () => {
    const s = newSequence();
    s.tracks[0].clips.push(newClip({ start: 0, sourceIn: 0, sourceOut: 100, speed: 1 }));
    s.tracks[0].clips.push(newClip({ start: 120, sourceIn: 0, sourceOut: 30, speed: 1 }));
    expect(sequenceDuration(s)).toBe(150);
  });

  it('finds the clip under a frame', () => {
    const s = newSequence();
    const c = newClip({ start: 10, sourceIn: 0, sourceOut: 20, speed: 1 });
    s.tracks[0].clips.push(c);
    expect(findClipAt(s, s.tracks[0].id, 15)?.id).toBe(c.id);
    expect(findClipAt(s, s.tracks[0].id, 5)).toBeUndefined();
  });

  it('cloneClips is a deep copy', () => {
    const c = newClip({ start: 0, sourceIn: 0, sourceOut: 10, speed: 1 });
    c.effects.push({ id: 'e', effectId: 'x', version: 1, enabled: true, params: { a: 1 }, keyframes: {}, blend: 'normal', opacity: 1 });
    const copy = cloneClips([c])[0];
    copy.effects[0].params.a = 99;
    expect(c.effects[0].params.a).toBe(1);
  });

  it('duplicates after the original', () => {
    const c = newClip({ start: 0, sourceIn: 0, sourceOut: 40, speed: 1 });
    const d = duplicateClip(c);
    expect(d.start).toBe(40);
    expect(d.id).not.toBe(c.id);
  });

  it('creates one track per kind with the right label', () => {
    const s = newSequence();
    expect(s.tracks.map((t) => t.kind)).toEqual(['video', 'audio']);
  });
});
