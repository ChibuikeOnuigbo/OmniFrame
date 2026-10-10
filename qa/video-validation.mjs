import { spawnSync } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

/** Check whether the optional Python dependencies for pixel inspection exist. */
export function hasOpenCvPython() {
  const result = spawnSync('python3', ['-c', 'import cv2, numpy'], { stdio: 'ignore' })
  return !result.error && result.status === 0
}

/**
 * Decode a video with the repository's bundled FFmpeg and check that it has
 * enough non-blank frames. This is the dependency-light fallback for the
 * OpenCV-backed E2E checks when Python cv2 is not installed.
 */
export function validateVideoFrames(filePath, { minFrames = 10, minAverageLuma = 10 } = {}) {
  const result = spawnSync(
    ffmpegInstaller.path,
    [
      '-nostdin',
      '-hide_banner',
      '-v',
      'info',
      '-i',
      filePath,
      '-map',
      '0:v:0',
      '-an',
      '-vf',
      'signalstats,metadata=print:key=lavfi.signalstats.YAVG',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`FFmpeg could not decode ${filePath}: ${result.stderr || `exit ${result.status}`}`)
  }

  const lumaValues = [...result.stderr.matchAll(/lavfi\.signalstats\.YAVG=([-+\d.eE]+)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
  const averageLuma = lumaValues.length
    ? lumaValues.reduce((sum, value) => sum + value, 0) / lumaValues.length
    : 0

  if (lumaValues.length < minFrames) {
    throw new Error(`FFmpeg decoded only ${lumaValues.length} frames; expected at least ${minFrames}`)
  }
  if (averageLuma <= minAverageLuma) {
    throw new Error(`FFmpeg decoded a near-blank video (average luma ${averageLuma.toFixed(2)})`)
  }

  return { frameCount: lumaValues.length, averageLuma }
}
