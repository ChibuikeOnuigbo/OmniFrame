/**
 * Export presets and capability probing.
 *
 * Codec support genuinely varies by browser and OS, so nothing here is hard-coded:
 * `probeCodecs()` asks VideoEncoder.isConfigSupported and the UI shows only what this
 * machine can actually produce.
 */

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  codec: string;
  /** H.264 profile-level string used with VideoEncoder */
  codecString: string;
  bitrate: number;
  audioCodec: string;
  audioBitrate: number;
  container: 'mp4' | 'webm';
  /** 0..1 quality hint passed to the encoder when bitrate mode is 'quality' */
  quality: number;
  pixelFormat: 'yuv420p' | 'yuv420p10';
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'yt1080', name: 'YouTube 1080p', description: 'H.264 High, 8 Mbps — the safe universal upload.',
    width: 1920, height: 1080, fps: 30, codec: 'avc1', codecString: 'avc1.640028',
    bitrate: 8_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 192_000, container: 'mp4',
    quality: 0.85, pixelFormat: 'yuv420p',
  },
  {
    id: 'yt4k', name: 'YouTube 4K', description: 'H.264 High 5.1, 45 Mbps for 3840x2160.',
    width: 3840, height: 2160, fps: 30, codec: 'avc1', codecString: 'avc1.640033',
    bitrate: 45_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 256_000, container: 'mp4',
    quality: 0.9, pixelFormat: 'yuv420p',
  },
  {
    id: 'shorts', name: 'Shorts 1080x1920', description: 'Vertical 9:16 for Shorts / Reels / TikTok.',
    width: 1080, height: 1920, fps: 30, codec: 'avc1', codecString: 'avc1.640028',
    bitrate: 10_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 192_000, container: 'mp4',
    quality: 0.87, pixelFormat: 'yuv420p',
  },
  {
    id: 'tiktok', name: 'TikTok', description: 'Vertical, 60 fps, mobile-first bitrate.',
    width: 1080, height: 1920, fps: 60, codec: 'avc1', codecString: 'avc1.640028',
    bitrate: 12_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 192_000, container: 'mp4',
    quality: 0.85, pixelFormat: 'yuv420p',
  },
  {
    id: 'ig11', name: 'Instagram 1:1', description: 'Square 1080x1080.',
    width: 1080, height: 1080, fps: 30, codec: 'avc1', codecString: 'avc1.640028',
    bitrate: 8_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 192_000, container: 'mp4',
    quality: 0.85, pixelFormat: 'yuv420p',
  },
  {
    id: 'ig45', name: 'Instagram 4:5', description: 'Portrait 1080x1350.',
    width: 1080, height: 1350, fps: 30, codec: 'avc1', codecString: 'avc1.640028',
    bitrate: 9_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 192_000, container: 'mp4',
    quality: 0.85, pixelFormat: 'yuv420p',
  },
  {
    id: 'hevc4k', name: 'HEVC 4K (where supported)', description: 'Roughly half the size of H.264 4K.',
    width: 3840, height: 2160, fps: 30, codec: 'hev1', codecString: 'hev1.1.6.L153.B0',
    bitrate: 25_000_000, audioCodec: 'mp4a.40.2', audioBitrate: 256_000, container: 'mp4',
    quality: 0.9, pixelFormat: 'yuv420p',
  },
  {
    id: 'av1web', name: 'AV1 WebM', description: 'Best compression for web delivery where AV1 encodes.',
    width: 1920, height: 1080, fps: 30, codec: 'av01', codecString: 'av01.0.08M.08',
    bitrate: 4_000_000, audioCodec: 'opus', audioBitrate: 128_000, container: 'webm',
    quality: 0.85, pixelFormat: 'yuv420p',
  },
];

export function getPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find((p) => p.id === id);
}

export interface AspectRatio {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: '16:9', label: '16:9 Widescreen', width: 1920, height: 1080 },
  { id: '9:16', label: '9:16 Vertical', width: 1080, height: 1920 },
  { id: '1:1', label: '1:1 Square', width: 1080, height: 1080 },
  { id: '4:5', label: '4:5 Portrait', width: 1080, height: 1350 },
  { id: '4:3', label: '4:3 Classic', width: 1440, height: 1080 },
  { id: '21:9', label: '21:9 Cinematic', width: 2560, height: 1080 },
];

export interface CodecSupport {
  codecString: string;
  supported: boolean;
  /** reported reason when unsupported */
  reason: string;
}

/**
 * Ask the platform which codecs it can really encode. Never assume: HEVC and AV1 are
 * present on some machines and absent on others, and reporting a preset that cannot
 * encode is worse than not offering it.
 */
export async function probeCodecs(candidates: string[] = EXPORT_PRESETS.map((p) => p.codecString)): Promise<CodecSupport[]> {
  const g = globalThis as { VideoEncoder?: { isConfigSupported(c: unknown): Promise<{ supported?: boolean }> } };
  if (typeof g.VideoEncoder?.isConfigSupported !== 'function') {
    return candidates.map((c) => ({ codecString: c, supported: false, reason: 'WebCodecs VideoEncoder is not available in this browser' }));
  }
  const out: CodecSupport[] = [];
  for (const codecString of candidates) {
    try {
      const res = await g.VideoEncoder.isConfigSupported({ codec: codecString, width: 1920, height: 1080, bitrate: 5_000_000, framerate: 30 });
      out.push({ codecString, supported: res.supported === true, reason: res.supported ? '' : 'The platform rejected this encoder configuration' });
    } catch (err) {
      out.push({ codecString, supported: false, reason: (err as Error).message });
    }
  }
  return out;
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'muxing' | 'done' | 'failed' | 'cancelled';
  frame: number;
  totalFrames: number;
  fps: number;
  etaMs: number | null;
  elapsedMs: number;
  bytesWritten: number;
  message: string;
}

export function makeProgress(stage: ExportProgress['stage'], frame: number, totalFrames: number, startedAt: number, bytes: number, fps: number, message = ''): ExportProgress {
  const elapsedMs = Date.now() - startedAt;
  const etaMs = frame > 0 && totalFrames > frame ? (elapsedMs / frame) * (totalFrames - frame) : null;
  return { stage, frame, totalFrames, fps, etaMs, elapsedMs, bytesWritten: bytes, message };
}
