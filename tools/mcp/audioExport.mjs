// Audio for universal headless exports. Video pixels still come from appRender.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ffmpegExe } from './core.mjs'

export function hasAudio(source) {
  try {
    execFileSync(ffmpegExe(), ['-v', 'error', '-i', source, '-map', '0:a:0', '-t', '0.001', '-f', 'null', '-'], { stdio: 'pipe' })
    return true
  } catch (error) {
    if (/matches no streams|does not contain any stream/.test(String(error.stderr))) return false
    throw error
  }
}

export function audioMixPlan(sequence, duration) {
  const clips = []
  for (const clip of sequence.clips) {
    if (clip.volume === 0) continue
    if (clip.childSeq) {
      if (audioMixPlan(clip.childSeq, clip.childSeq.duration).length) throw new Error('Headless compound audio is not supported yet; export its audio clips at the top level or use audio:false explicitly')
      continue
    }
    if (!clip.sourceVideo?.hasAudio) continue
    const volume = clip.volume ?? 1
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Audio volume must be between 0 and 1')
    if (clip.speedCurve && clip.speedCurve !== 'linear') throw new Error('Headless audio speed curves are not supported yet')
    const timeKeys = ['reverse', 'freezeHold', 'timeQuantization']
    const timeEffect = timeKeys.some(key => clip.effects?.[key]) || (clip.fxInstances || []).some(fx => fx.enabled !== false && timeKeys.some(key => fx.params?.[key] || fx.keys?.[key]?.length))
    if (timeEffect) throw new Error('Headless audio time effects are not supported yet; use audio:false explicitly for a silent export')
    const start = Math.max(0, clip.start)
    const length = Math.min(clip.duration, duration - start)
    if (length <= 0) continue
    clips.push({ source: clip.sourceVideo.path, start, duration: length, inPoint: clip.inPoint || 0, volume })
  }
  return clips
}

export function muxAudio(video, destination, clips, duration) {
  const inputs = clips.flatMap(c => ['-i', c.source])
  const graph = clips.map((c, i) => `[${i + 1}:a:0]atrim=start=${c.inPoint}:duration=${c.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${c.volume},adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)},apad,atrim=duration=${duration}[a${i}]`)
  // The pinned FFmpeg predates amix's normalize option. Padding every branch
  // to the export duration keeps its divisor constant; restore summed gain.
  graph.push(`${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:duration=longest:dropout_transition=0,volume=${clips.length},apad=pad_len=240,alimiter=limit=0.98:level=0,atrim=start=0.005,asetpts=PTS-STARTPTS,apad,atrim=duration=${duration}[mix]`)
  // libavfilter's lookahead limiter introduces latency. Compensate it so a
  // one-clip export remains aligned with the app's video source clock.
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  execFileSync(ffmpegExe(), ['-y', '-v', 'error', '-i', video, ...inputs, '-filter_complex', graph.join(';'), '-map', '0:v:0', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-movflags', '+faststart', destination], { stdio: 'pipe' })
  return { tracks: clips.length, sampleRate: 48000, channels: 2 }
}
