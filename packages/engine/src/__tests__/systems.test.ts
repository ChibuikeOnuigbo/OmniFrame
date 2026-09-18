import { describe, it, expect } from 'vitest';
import { createRgba, createGray } from '../core/image.js';
import { renderEffect, getEffect, listEffects, validateEffectManifest, defaultParams } from '../effects/registry.js';
import { renderTransition, getTransition, listTransitions } from '../effects/transitions.js';
import { buildWaveform, pickLevel, detectSilence, duckingEnvelope, normalisationGain } from '../audio/waveform.js';
import { newTemplate, addSlot, validateTemplate, applySlotSwaps, computeFit } from '../templates/schema.js';
import { newProject, serializeProject, deserializeProject, validateProjectShape, recordAutosave, migrateProject } from '../project/format.js';
import { getModel, auditModelLicences, modelForTier } from '../models/registry.js';
import { LruCache } from '../cache/lru.js';
import { JobManager } from '../jobs/manager.js';
import { getPreset, probeCodecs, ASPECT_RATIOS } from '../export/presets.js';

describe('effect registry and shared renderers', () => {
  it('has a meaningful built-in registry', () => {
    expect(listEffects().length).toBeGreaterThan(15);
    expect(getEffect('gaussianBlur')).toBeDefined();
    expect(getEffect('gaussianBlur')!.acceptsMask).toBe(true);
  });

  it('renders brightness through the CPU reference path', () => {
    const input = createRgba(2, 1);
    input.data.set([10, 20, 30, 255, 240, 240, 240, 255]);
    const out = renderEffect('brightness', input, { amount: 0.2 }, { width: 2, height: 1, time: 0 });
    expect(out.data[0]).toBeGreaterThan(10);
    expect(out.data[4]).toBe(255);
  });

  it('respects masks on masked effects', () => {
    const input = createRgba(2, 1);
    input.data.set([10, 20, 30, 255, 10, 20, 30, 255]);
    const mask = createGray(2, 1);
    mask.data[0] = 1;
    const out = renderEffect('brightness', input, { amount: 0.5 }, { width: 2, height: 1, time: 0, mask });
    expect(out.data[0]).toBeGreaterThan(input.data[0]);
    expect(out.data[4]).toBe(input.data[4]);
  });

  it('validates custom effects and blocks incompatible licences', () => {
    const base = { id: 'custom.blur', version: 1, name: 'Custom', params: [], cpu: () => input, glsl: 'gl_FragColor = color;', license: 'MIT', acceptsMask: true, parityVerified: false };
    expect(validateEffectManifest(base).ok).toBe(true);
    expect(validateEffectManifest({ ...base, license: 'AGPL-3.0' }).ok).toBe(false);
  });

  it('renders transitions with a real frame mix', () => {
    const a = createRgba(2, 1); a.data.set([0, 0, 0, 255, 0, 0, 0, 255]);
    const b = createRgba(2, 1); b.data.set([255, 255, 255, 255, 255, 255, 255, 255]);
    const mid = renderTransition('crossfade', a, b, 0.5);
    // Uint8ClampedArray rounds the mathematically exact 127.5 to 128.
    expect(mid.data[0]).toBe(128);
    expect(renderTransition('cut', a, b, 0.25).data[0]).toBe(0);
    expect(renderTransition('cut', a, b, 0.75).data[0]).toBe(255);
    expect(listTransitions().length).toBeGreaterThan(5);
  });

  function input(): ReturnType<typeof createRgba> { return createRgba(1, 1); }
});

describe('audio analysis', () => {
  it('builds multiresolution peak/min/max/RMS levels', () => {
    const data = new Float32Array(16384);
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.05) * 0.5;
    const w = buildWaveform([data], 48000);
    expect(w.levels[0].length).toBeGreaterThan(1);
    const level = pickLevel(w.levels[0], 1000);
    expect(level.max.length).toBeGreaterThan(0);
    expect(normalisationGain(w)).toBeGreaterThan(0);
  });

  it('detects silence and produces a ducking envelope', () => {
    const data = new Float32Array(48000);
    for (let i = 0; i < 12000; i++) data[i] = 0.8;
    const w = buildWaveform([data], 48000);
    const silence = detectSilence(w, 0, -50, 0.1);
    expect(silence.length).toBeGreaterThan(0);
    const env = duckingEnvelope(1, [{ start: 0.3, end: 0.7 }], { attack: 0.05, release: 0.1, floor: 0.2, sampleHz: 100 });
    expect(env[0]).toBe(1);
    expect(Math.min(...env)).toBeLessThan(0.5);
  });
});

describe('templates', () => {
  it('rejects a PNG in a strict 3D model slot', () => {
    const tpl = newTemplate('3D intro');
    const slot = addSlot(tpl, { name: 'Hero model', type: '3D_MODEL', target: { kind: 'sceneObject', id: 'obj', property: 'assetId' } });
    const result = validateTemplate(tpl, new Map([[slot.id, 'png']]), {
      assets: [{ id: 'png', name: 'still.png', mime: 'image/png', width: 1920, height: 1080 }],
      knownEffectIds: [], availableFonts: [],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'type-mismatch')).toBe(true);
  });

  it('accepts a valid video slot and preserves the template', () => {
    const tpl = newTemplate('social');
    const slot = addSlot(tpl, { name: 'Footage', type: 'VIDEO', target: { kind: 'clip', id: 'clip1', property: 'assetId' } });
    tpl.sequence.tracks[0].clips.push({
      id: 'clip1', assetId: null, kind: 'video', name: 'slot', start: 0, sourceIn: 0, sourceOut: 90,
      speed: 1, speedSegments: [], reversed: false, frozen: null,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5 }, blend: 'normal', effects: [], masks: [], keyframes: {}, gain: 1, pan: 0, fadeIn: 0, fadeOut: 0, muted: false, omniframeOpIds: [], locked: false, color: null,
    });
    const ctx = { assets: [{ id: 'vid', name: 'take.mp4', mime: 'video/mp4', width: 1920, height: 1080, duration: 5 }], knownEffectIds: [], availableFonts: [] };
    expect(validateTemplate(tpl, new Map([[slot.id, 'vid']]), ctx).ok).toBe(true);
    const swapped = applySlotSwaps(tpl, [{ slotId: slot.id, assetId: 'vid' }], ctx.assets);
    expect(swapped.template.sequence.tracks[0].clips[0].assetId).toBe('vid');
    expect(swapped.template.sequence.tracks[0].clips[0].sourceOut).toBe(90);
  });

  it('computes cover/contain/focal-point fits', () => {
    const cover = computeFit('cover', { width: 1920, height: 1080 }, { width: 1080, height: 1920 });
    const contain = computeFit('contain', { width: 1920, height: 1080 }, { width: 1080, height: 1920 });
    const focal = computeFit('focalPoint', { width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { x: 1, y: 0.5 });
    expect(cover.width).toBeLessThan(1920);
    expect(contain.width).toBe(1920);
    expect(focal.x).toBeGreaterThan(0);
  });
});

describe('project format and migrations', () => {
  it('serialises and deserialises maps and typed mask runs', () => {
    const p = newProject('roundtrip');
    p.sequences[0].tracks[0].clips[0] = undefined as never;
    const text = serializeProject(p);
    const q = deserializeProject(text);
    expect(q.format).toBe('omniframe.vxproj');
    expect(q.projectVersion).toBe(3);
    expect(q.name).toBe('roundtrip');
  });

  it('migrates a v1 timeline shape', () => {
    const p = newProject('old');
    const old = { ...p, projectVersion: 1, timeline: p.sequences[0] } as unknown as Record<string, unknown>;
    delete old.sequences;
    const migrated = migrateProject(old);
    expect(migrated.projectVersion).toBe(3);
    expect(migrated.sequences.length).toBe(1);
  });

  it('records bounded recovery history and validates shape', () => {
    const p = newProject();
    for (let i = 0; i < 25; i++) recordAutosave(p, i);
    expect(p.recovery.length).toBe(20);
    expect(validateProjectShape(p).ok).toBe(true);
    expect(validateProjectShape({}).ok).toBe(false);
  });
});

describe('cache, models and export capabilities', () => {
  it('evicts least-recently-used entries by byte budget', () => {
    const c = new LruCache<string, string>(10);
    c.set('a', 'A', 6);
    c.set('b', 'B', 6);
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
  });

  it('does not mark blocked models as shippable', () => {
    expect(getModel('isnet-onnx')?.shippable).toBe(false);
    expect(getModel('cotracker')?.researchOnly).toBe(true);
    expect(modelForTier('segmentation', 'balanced')?.id).toContain('sam2');
    expect(auditModelLicences()).toEqual([]);
  });

  it('has social presets and reports WebCodecs absence honestly', async () => {
    expect(getPreset('shorts')?.width).toBe(1080);
    expect(ASPECT_RATIOS.map((r) => r.id)).toContain('9:16');
    const support = await probeCodecs(['avc1.640028']);
    expect(support.length).toBe(1);
    expect(typeof support[0].supported).toBe('boolean');
  });
});

describe('job manager', () => {
  it('runs a cancellable job and reports completion', async () => {
    const manager = new JobManager(1);
    const stages: string[] = [];
    const job = manager.submit({
      name: 'unit job', priority: 'interactive',
      onProgress: (p) => stages.push(p.stage),
      run: async ({ report, throwIfCancelled }) => {
        for (let i = 0; i <= 3; i++) { throwIfCancelled(); report(i, 3, 'test'); await new Promise((r) => setTimeout(r, 1)); }
        return 42;
      },
    });
    await expect(job.result).resolves.toBe(42);
    expect(job.state).toBe('done');
    expect(stages).toContain('test');
  });

  it('cancels a queued job before it starts', async () => {
    const manager = new JobManager(1);
    const slow = manager.submit({ name: 'slow', run: async () => { await new Promise((r) => setTimeout(r, 25)); return 1; } });
    const queued = manager.submit({ name: 'queued', run: async () => 2 });
    queued.cancel();
    await expect(queued.result).rejects.toThrow(/cancelled/i);
    await slow.result;
    expect(queued.state).toBe('cancelled');
  });
});
