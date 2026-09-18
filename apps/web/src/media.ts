import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { createGray, decodeRle, renderEffect, type Rgba, type Gray } from '@omniframe/engine';
import type { Clip } from '@omniframe/engine';

export interface MediaMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
  sampleRate: number;
  channels: number;
}

export interface ExportProgressView {
  stage: 'preparing' | 'rendering' | 'encoding' | 'audio' | 'muxing' | 'done' | 'failed' | 'cancelled';
  frame: number;
  totalFrames: number;
  elapsedMs: number;
  bytesWritten: number;
  message: string;
}

export interface Mp4ExportRequest {
  sourceUrl: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  bitrate: number;
  audioBitrate: number;
  videoCodec: string;
  audioCodec: string;
  clip?: Clip | null;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgressView) => void;
}

export interface Mp4ExportResult {
  blob: Blob;
  videoFrames: number;
  audioSamples: number;
  elapsedMs: number;
  hasAudio: boolean;
}

export async function inspectMedia(file: File, url: string): Promise<MediaMetadata> {
  if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file);
    const result = { width: bitmap.width, height: bitmap.height, duration: 5, fps: 30, sampleRate: 0, channels: 0 };
    bitmap.close();
    return result;
  }
  if (file.type.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    await waitForMediaMetadata(audio);
    return { width: 0, height: 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0, fps: 0, sampleRate: 48000, channels: 2 };
  }
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await waitForMediaMetadata(video);
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      fps: 30,
      sampleRate: 48000,
      channels: 2,
    };
  }
  return { width: 0, height: 0, duration: 0, fps: 0, sampleRate: 0, channels: 0 };
}

function waitForMediaMetadata(media: HTMLMediaElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('The browser could not read this media file.')); };
    const cleanup = () => {
      media.removeEventListener('loadedmetadata', done);
      media.removeEventListener('error', fail);
    };
    media.addEventListener('loadedmetadata', done, { once: true });
    media.addEventListener('error', fail, { once: true });
    if (media.readyState >= 1) done();
  });
}

export class VideoGrayProvider {
  readonly count: number;
  readonly width: number;
  readonly height: number;
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private loaded: Promise<void>;
  private readonly fps: number;

  constructor(private readonly sourceUrl: string, duration: number, fps = 30, maxDimension = 640, sourceWidth = 16, sourceHeight = 9) {
    this.fps = fps;
    this.video = document.createElement('video');
    this.video.preload = 'auto';
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.src = sourceUrl;
    this.canvas = document.createElement('canvas');
    this.loaded = waitForMediaMetadata(this.video);
    this.count = Math.max(1, Math.ceil(duration * fps));
    const sourceScale = Math.min(1, maxDimension / Math.max(1, sourceWidth), maxDimension / Math.max(1, sourceHeight));
    this.width = Math.max(1, Math.round(sourceWidth * sourceScale));
    this.height = Math.max(1, Math.round(sourceHeight * sourceScale));
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The browser did not provide a 2D canvas context.');
    this.ctx = context;
  }

  async frame(index: number): Promise<Gray> {
    await this.loaded;
    const frame = Math.max(0, Math.min(this.count - 1, index));
    const time = frame / this.fps;
    await seekVideo(this.video, time);
    const sourceWidth = this.video.videoWidth || this.width;
    const sourceHeight = this.video.videoHeight || this.height;
    const scale = Math.min(1, this.width / sourceWidth, this.height / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(this.video, 0, 0, width, height);
    const pixels = this.ctx.getImageData(0, 0, width, height).data;
    const gray = createGray(width, height);
    for (let i = 0, p = 0; i < gray.data.length; i++, p += 4) {
      gray.data[i] = (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
    }
    return gray;
  }

  dispose(): void {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
  }
}

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : time;
  const target = Math.max(0, Math.min(Math.max(0, duration - 0.001), time));
  if (Math.abs(video.currentTime - target) < 1 / 120 && video.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('The browser could not decode a requested video frame.')); };
    const cleanup = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
    };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    video.currentTime = target;
  });
}

export function applyClipEffectsToCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, clip: Clip | null | undefined, timeSeconds: number, localFrame?: number): void {
  if (!clip?.effects.length) return;
  let rgba: Rgba = { width, height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) };
  const encodedMask = localFrame === undefined ? undefined : clip.masks[0]?.frames[Math.max(0, Math.round(localFrame))];
  const mask = encodedMask ? resizeGray(decodeRle({ ...encodedMask, runs: Array.from(encodedMask.runs) }), width, height) : undefined;
  for (const effect of clip.effects) {
    if (!effect.enabled) continue;
    const params: Record<string, number> = {};
    for (const [key, value] of Object.entries(effect.params)) if (typeof value === 'number') params[key] = value;
    rgba = renderEffect(effect.effectId, rgba, params, { width, height, time: timeSeconds, mask });
  }
  ctx.putImageData(new ImageData(rgba.data as unknown as ImageDataArray, width, height), 0, 0);
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  clip?: Clip | null,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const sourceWidth = getSourceWidth(source);
  const sourceHeight = getSourceHeight(source);
  const fit = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const scale = fit * (clip?.transform.scale ?? 1);
  const x = width / 2 + (clip?.transform.x ?? 0) * width / Math.max(1, sourceWidth);
  const y = height / 2 + (clip?.transform.y ?? 0) * height / Math.max(1, sourceHeight);
  ctx.translate(x, y);
  ctx.rotate(((clip?.transform.rotation ?? 0) * Math.PI) / 180);
  ctx.globalAlpha = clip?.transform.opacity ?? 1;
  ctx.drawImage(source, -sourceWidth * scale / 2, -sourceHeight * scale / 2, sourceWidth * scale, sourceHeight * scale);
  ctx.restore();
}

function getSourceWidth(source: CanvasImageSource): number {
  if (source instanceof HTMLVideoElement) return source.videoWidth || source.clientWidth;
  if (source instanceof HTMLImageElement) return source.naturalWidth || source.width;
  if (source instanceof ImageBitmap) return source.width;
  if (source instanceof HTMLCanvasElement) return source.width;
  return 1;
}

function getSourceHeight(source: CanvasImageSource): number {
  if (source instanceof HTMLVideoElement) return source.videoHeight || source.clientHeight;
  if (source instanceof HTMLImageElement) return source.naturalHeight || source.height;
  if (source instanceof ImageBitmap) return source.height;
  if (source instanceof HTMLCanvasElement) return source.height;
  return 1;
}

function resizeGray(source: Gray, width: number, height: number): Gray {
  if (source.width === width && source.height === height) return source;
  const out = createGray(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.width - 1, Math.round(x * source.width / width));
    const sy = Math.min(source.height - 1, Math.round(y * source.height / height));
    out.data[y * width + x] = source.data[sy * source.width + sx];
  }
  return out;
}

/**
 * Encode a local source through WebCodecs and mux H.264 + AAC into a real MP4.
 * The function refuses to silently omit a track: if either encoder is unavailable,
 * it throws a user-readable capability error instead of creating a misleading file.
 */
export async function exportMp4(request: Mp4ExportRequest): Promise<Mp4ExportResult> {
  const G = globalThis as unknown as {
    VideoEncoder?: any;
    VideoFrame?: any;
    AudioEncoder?: any;
    AudioData?: any;
    AudioContext?: any;
    webkitAudioContext?: any;
  };
  if (!G.VideoEncoder || !G.VideoFrame) throw new Error('WebCodecs H.264 video encoding is not available in this browser.');
  if (!G.AudioEncoder || !G.AudioData) throw new Error('WebCodecs AAC audio encoding is not available in this browser.');
  const startedAt = performance.now();
  const totalFrames = Math.max(1, Math.round(request.duration * request.fps));
  request.onProgress?.({ stage: 'preparing', frame: 0, totalFrames, elapsedMs: 0, bytesWritten: 0, message: 'Decoding the source audio track' });
  const sourceAudio = await decodeAudioSource(request.sourceUrl, G);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: request.width, height: request.height, frameRate: request.fps },
    audio: { codec: 'aac', numberOfChannels: Math.min(2, Math.max(1, sourceAudio.numberOfChannels)), sampleRate: 48000 },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let videoFrames = 0;
  let videoError: Error | null = null;
  const videoSupport = await G.VideoEncoder.isConfigSupported({ codec: request.videoCodec, width: request.width, height: request.height, bitrate: request.bitrate, framerate: request.fps });
  if (!videoSupport?.supported) throw new Error(`The platform rejected H.264 configuration ${request.videoCodec}.`);
  const videoEncoder = new G.VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, meta),
    error: (error: Error) => { videoError = error; },
  });
  videoEncoder.configure({ codec: request.videoCodec, width: request.width, height: request.height, bitrate: request.bitrate, framerate: request.fps, latencyMode: 'quality' });

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = request.sourceUrl;
  await waitForMediaMetadata(video);
  const canvas = document.createElement('canvas');
  canvas.width = request.width;
  canvas.height = request.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The browser did not provide a canvas encoder surface.');

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (request.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const sourceFrame = frame + (request.clip?.sourceIn ?? 0);
      await seekVideo(video, sourceFrame / request.fps);
      drawImageCover(ctx, video, request.width, request.height, request.clip);
      applyClipEffectsToCanvas(ctx, request.width, request.height, request.clip, frame / request.fps, frame);
      const vf = new G.VideoFrame(canvas, { timestamp: Math.round(frame * 1_000_000 / request.fps), duration: Math.round(1_000_000 / request.fps) });
      videoEncoder.encode(vf, { keyFrame: frame === 0 || frame % Math.max(1, Math.round(request.fps * 2)) === 0 });
      vf.close();
      videoFrames++;
      if (frame % 4 === 0) {
        request.onProgress?.({ stage: 'encoding', frame, totalFrames, elapsedMs: performance.now() - startedAt, bytesWritten: 0, message: `H.264 frame ${frame + 1} of ${totalFrames}` });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    await videoEncoder.flush();
    videoEncoder.close();
    if (videoError) throw videoError;

    request.onProgress?.({ stage: 'audio', frame: 0, totalFrames, elapsedMs: performance.now() - startedAt, bytesWritten: 0, message: 'Encoding AAC audio track' });
    const audioResult = await encodeAudioTrack(request, muxer, sourceAudio, startedAt, totalFrames);
    muxer.finalize();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) throw new Error('The MP4 muxer produced no output bytes.');
    request.onProgress?.({ stage: 'done', frame: totalFrames, totalFrames, elapsedMs: performance.now() - startedAt, bytesWritten: buffer.byteLength, message: 'H.264 + AAC MP4 ready' });
    return { blob: new Blob([buffer], { type: 'video/mp4' }), videoFrames, audioSamples: audioResult.samples, elapsedMs: performance.now() - startedAt, hasAudio: true };
  } catch (error) {
    try { videoEncoder.close(); } catch { /* encoder may already be closed */ }
    if ((error as DOMException).name === 'AbortError') {
      request.onProgress?.({ stage: 'cancelled', frame: videoFrames, totalFrames, elapsedMs: performance.now() - startedAt, bytesWritten: 0, message: 'Export cancelled' });
    }
    throw error;
  } finally {
    video.pause();
    video.removeAttribute('src');
  }
}

async function decodeAudioSource(
  sourceUrl: string,
  G: { AudioContext?: any; webkitAudioContext?: any },
): Promise<AudioBuffer> {
  const AudioContextCtor = G.AudioContext ?? G.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Local AAC export requires a browser AudioContext to decode the source audio track.');
  const context = new AudioContextCtor();
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`The source audio could not be read (${response.status}).`);
    const raw = await response.arrayBuffer();
    return await context.decodeAudioData(raw.slice(0));
  } catch (error) {
    throw new Error(`The selected video has no browser-decodable audio track; OmniFrame will not create a silent AAC substitute. ${(error as Error).message}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function encodeAudioTrack(
  request: Mp4ExportRequest,
  muxer: Muxer<ArrayBufferTarget>,
  buffer: AudioBuffer,
  startedAt: number,
  totalFrames: number,
): Promise<{ samples: number }> {
  const sampleRate = 48000;
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const sourceOffsetSeconds = (request.clip?.sourceIn ?? 0) / request.fps;
  const samples = Math.max(1, Math.min(Math.round(request.duration * sampleRate), Math.max(1, Math.ceil((buffer.duration - sourceOffsetSeconds) * sampleRate))));
  const encoder = new (globalThis as any).AudioEncoder({
    output: (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata) => muxer.addAudioChunk(chunk, meta),
    error: (error: Error) => { throw error; },
  });
  const support = await (globalThis as any).AudioEncoder.isConfigSupported({ codec: request.audioCodec, sampleRate, numberOfChannels: channels, bitrate: request.audioBitrate });
  if (!support?.supported) throw new Error(`The platform rejected AAC configuration ${request.audioCodec}.`);
  encoder.configure({ codec: request.audioCodec, sampleRate, numberOfChannels: channels, bitrate: request.audioBitrate });
  const chunkSize = 1024;
  for (let offset = 0; offset < samples; offset += chunkSize) {
    if (request.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const frames = Math.min(chunkSize, samples - offset);
    const planar = new Float32Array(frames * channels);
    for (let channel = 0; channel < channels; channel++) {
      const destination = planar.subarray(channel * frames, (channel + 1) * frames);
      const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      for (let i = 0; i < frames; i++) {
        const sourceIndex = Math.min(source.length - 1, Math.max(0, Math.floor((sourceOffsetSeconds * buffer.sampleRate) + (offset + i) * buffer.sampleRate / sampleRate)));
        destination[i] = source[sourceIndex] ?? 0;
      }
    }
    const audio = new (globalThis as any).AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: frames, numberOfChannels: channels, timestamp: Math.round(offset * 1_000_000 / sampleRate), data: planar.buffer });
    encoder.encode(audio);
    audio.close();
    if (offset % (chunkSize * 16) === 0) {
      request.onProgress?.({ stage: 'audio', frame: Math.round(offset / samples * totalFrames), totalFrames, elapsedMs: performance.now() - startedAt, bytesWritten: 0, message: `AAC samples ${offset} of ${samples}` });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  await encoder.flush();
  encoder.close();
  return { samples };
}
