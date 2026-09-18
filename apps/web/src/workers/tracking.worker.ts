/**
 * Browser worker boundary for expensive tracking.
 *
 * Frames arrive as transferable Float32Array planes; no VideoFrame->PNG->ImageData
 * round-trip is required. The UI can terminate this worker to cancel the current job.
 */
import {
  StaticFrames,
  trackMask,
  type Gray,
  type TrackDirection,
  type TrackOptions,
} from '@omniframe/engine';

type Request = {
  type: 'track-mask';
  id: string;
  frames: Array<{ width: number; height: number; data: Float32Array }>;
  mask: { width: number; height: number; data: Float32Array };
  start: number;
  end: number;
  direction: TrackDirection;
  options?: Partial<TrackOptions>;
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let active: AbortController | null = null;

ctx.onmessage = async (event: MessageEvent<Request | { type: 'cancel'; id: string }>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    active?.abort();
    return;
  }
  if (message.type !== 'track-mask') return;
  active?.abort();
  active = new AbortController();
  const provider = new StaticFrames(message.frames.map((frame) => ({ width: frame.width, height: frame.height, data: frame.data } as Gray)));
  const mask = { width: message.mask.width, height: message.mask.height, data: message.mask.data } as Gray;
  try {
    const result = await trackMask(provider, mask, message.start, message.end, message.direction, message.options, {
      signal: active.signal,
      onProgress: (p) => ctx.postMessage({ type: 'progress', id: message.id, ...p }),
    });
    const payload = [...result.masks.entries()].map(([frame, value]) => ({ frame, width: value.width, height: value.height, data: value.data }));
    const transfers = payload.map((item) => item.data.buffer as ArrayBuffer);
    ctx.postMessage({ type: 'complete', id: message.id, masks: payload, metrics: result.metrics, reinitialisedFrames: result.reinitialisedFrames }, transfers);
  } catch (error) {
    ctx.postMessage({ type: 'error', id: message.id, message: (error as Error).message });
  } finally {
    active = null;
  }
};
