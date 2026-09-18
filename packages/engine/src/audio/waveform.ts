/**
 * Multiresolution waveform generation.
 *
 * A timeline zoomed to 15 frames must not read every sample, and a zoomed-out timeline
 * must not alias into noise. So we build a pyramid of peak/min-max pairs and the
 * renderer picks the level whose bucket width is closest to one pixel.
 */

export interface WaveformLevel {
  /** seconds of audio per bucket */
  secondsPerBucket: number;
  min: Float32Array;
  max: Float32Array;
  /** RMS per bucket, used for loudness-aware rendering */
  rms: Float32Array;
}

export interface Waveform {
  sampleRate: number;
  channels: number;
  duration: number;
  /** per channel, coarse to fine */
  levels: WaveformLevel[][];
}

const BASE_BUCKETS = 4096;

export function buildWaveform(
  channelData: Float32Array[],
  sampleRate: number,
  maxLevels = 6,
): Waveform {
  const channels = channelData.length;
  const frames = channelData[0]?.length ?? 0;
  const duration = sampleRate > 0 ? frames / sampleRate : 0;
  const levels: WaveformLevel[][] = [];
  for (let c = 0; c < channels; c++) {
    const data = channelData[c];
    const channelLevels: WaveformLevel[] = [];
    let buckets = Math.min(BASE_BUCKETS, Math.max(1, frames));
    for (let l = 0; l < maxLevels && buckets >= 2; l++) {
      channelLevels.push(buildLevel(data, sampleRate, buckets));
      buckets = Math.floor(buckets / 4);
    }
    levels.push(channelLevels);
  }
  return { sampleRate, channels, duration, levels };
}

function buildLevel(data: Float32Array, sampleRate: number, buckets: number): WaveformLevel {
  const min = new Float32Array(buckets).fill(1);
  const max = new Float32Array(buckets).fill(-1);
  const rms = new Float32Array(buckets);
  const per = data.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * per);
    const end = Math.min(data.length, Math.floor((b + 1) * per));
    if (end <= start) {
      min[b] = 0;
      max[b] = 0;
      continue;
    }
    let lo = Infinity, hi = -Infinity, sum = 0;
    for (let i = start; i < end; i++) {
      const v = data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sum += v * v;
    }
    min[b] = lo;
    max[b] = hi;
    rms[b] = Math.sqrt(sum / (end - start));
  }
  return { secondsPerBucket: data.length / buckets / sampleRate, min, max, rms };
}

/** Pick the level whose bucket is closest to `pixelsPerSecond` display density. */
export function pickLevel(levels: WaveformLevel[], pixelsPerSecond: number): WaveformLevel {
  if (levels.length === 0) throw new Error('Waveform has no levels');
  let best = levels[0];
  let bestErr = Infinity;
  for (const l of levels) {
    const bucketPx = l.secondsPerBucket * pixelsPerSecond;
    const err = Math.abs(Math.log(Math.max(1e-6, bucketPx)));
    if (err < bestErr) {
      bestErr = err;
      best = l;
    }
  }
  return best;
}

/** Loudness normalisation gain so a quiet clip is legible without clipping. */
export function normalisationGain(wave: Waveform, targetPeak = 0.95): number {
  let peak = 0;
  for (const ch of wave.levels) {
    const coarse = ch[0];
    if (!coarse) continue;
    for (let i = 0; i < coarse.max.length; i++) {
      peak = Math.max(peak, Math.abs(coarse.max[i]), Math.abs(coarse.min[i]));
    }
  }
  return peak > 1e-6 ? Math.min(targetPeak / peak, 8) : 1;
}

/** Detect silence runs longer than `thresholdSeconds` — used by auto-ducking and cut detection. */
export function detectSilence(
  wave: Waveform,
  channel = 0,
  thresholdDb = -50,
  thresholdSeconds = 0.25,
): Array<{ start: number; end: number }> {
  const level = wave.levels[channel]?.[0];
  if (!level) return [];
  const threshold = Math.pow(10, thresholdDb / 20);
  const out: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let i = 0; i < level.rms.length; i++) {
    const t = i * level.secondsPerBucket;
    if (level.rms[i] < threshold) {
      if (runStart < 0) runStart = t;
    } else if (runStart >= 0) {
      if (t - runStart >= thresholdSeconds) out.push({ start: runStart, end: t });
      runStart = -1;
    }
  }
  if (runStart >= 0 && wave.duration - runStart >= thresholdSeconds) {
    out.push({ start: runStart, end: wave.duration });
  }
  return out;
}

/**
 * Ducking envelope: given the times where the "ducking" source is loud, produce a gain
 * curve for the ducked track. Attack and release are in seconds.
 */
export function duckingEnvelope(
  duration: number,
  duckTimes: Array<{ start: number; end: number }>,
  opts: { attack: number; release: number; floor: number; sampleHz: number },
): Float32Array {
  const n = Math.max(1, Math.ceil(duration * opts.sampleHz));
  const env = new Float32Array(n).fill(1);
  const attack = Math.max(1, Math.round(opts.attack * opts.sampleHz));
  const release = Math.max(1, Math.round(opts.release * opts.sampleHz));
  for (const d of duckTimes) {
    const s = Math.max(0, Math.floor(d.start * opts.sampleHz));
    const e = Math.min(n - 1, Math.ceil(d.end * opts.sampleHz));
    for (let i = s; i <= e; i++) {
      const inAttack = Math.min(1, (i - s) / attack);
      const outRelease = Math.min(1, (e - i) / release);
      const k = Math.min(inAttack, outRelease);
      const g = 1 - (1 - opts.floor) * k;
      if (g < env[i]) env[i] = g;
    }
  }
  return env;
}
