import { useEditor } from '../store'
import type { Clip, ClipEffect, ClipLut, TextStyle } from '../types'
import type { VisualPreviewWindow } from './visualPreview'

function clipWindow(clip: Clip, fps: number): VisualPreviewWindow {
  const startTime = clip.start
  const lastVisibleFrame = clip.start + clip.duration - 1 / Math.max(1, fps)
  return {
    label: clip.name || 'Timeline clip',
    startTime,
    endTime: Math.max(startTime + 0.05, lastVisibleFrame),
  }
}

function activeAdjustmentClip() {
  const state = useEditor.getState()
  return state.clips
    .filter((clip) => {
      const track = state.tracks.find((item) => item.id === clip.trackId)
      return track?.type === 'video' && !track.hidden && !clip.hidden && clip.kind === 'adjustment' &&
        state.playhead >= clip.start && state.playhead < clip.start + clip.duration
    })
    .sort((a, b) => state.tracks.findIndex((track) => track.id === a.trackId) - state.tracks.findIndex((track) => track.id === b.trackId))[0]
}

/** Match addAdjustmentLayer's no-selection target: lowest visible footage clip at the playhead. */
function activeFootageAnchor() {
  const state = useEditor.getState()
  return state.clips
    .filter((clip) => {
      const track = state.tracks.find((item) => item.id === clip.trackId)
      return track?.type === 'video' && !track.hidden && !clip.hidden && clip.kind !== 'adjustment' &&
        clip.kind !== 'audio' && clip.kind !== 'text' && !clip.textStyle &&
        state.playhead >= clip.start && state.playhead < clip.start + clip.duration
    })
    .sort((a, b) => state.tracks.findIndex((track) => track.id === b.trackId) - state.tracks.findIndex((track) => track.id === a.trackId))[0]
}

function selectedVisualClip() {
  const state = useEditor.getState()
  const selected = state.clips.find((clip) => clip.id === state.selectedClipId)
  if (!selected || selected.hidden || selected.kind === 'audio') return undefined
  const track = state.tracks.find((item) => item.id === selected.trackId)
  return track?.type === 'video' && !track.hidden ? selected : undefined
}

export function previewClipPlayback(clipId: string, label = 'Current clip look') {
  const state = useEditor.getState()
  const clip = state.clips.find((item) => item.id === clipId)
  if (!clip) return false
  const window = clipWindow(clip, state.projectFps)
  state.startVisualPreview({ kind: 'clip-playback', clipId, ...window, label })
  return true
}

export function previewClipEffect(clipId: string, label: string, effect: ClipEffect) {
  const state = useEditor.getState()
  const clip = state.clips.find((item) => item.id === clipId)
  if (!clip) return false
  state.startVisualPreview({ kind: 'clip-effect', clipId, effect, ...clipWindow(clip, state.projectFps), label })
  return true
}

export function previewLut(lut: Pick<ClipLut, 'name' | 'builtin' | 'cubeText'>) {
  const state = useEditor.getState()
  const grade = { ...lut, intensity: 1, enabled: true }
  const selected = selectedVisualClip()
  const target = selected ?? activeAdjustmentClip()
  if (target) {
    state.startVisualPreview({
      kind: 'clip-lut',
      clipId: target.id,
      lut: grade,
      ...clipWindow(target, state.projectFps),
      label: lut.name,
    })
    return true
  }

  const anchor = activeFootageAnchor()
  if (!anchor) return false
  state.startVisualPreview({
    kind: 'adjustment-layer',
    anchorClipId: anchor.id,
    afterTrackId: anchor.trackId,
    lut: grade,
    ...clipWindow(anchor, state.projectFps),
    label: lut.name,
  })
  return true
}

export function previewTextClip(label: string, text: string, style?: Partial<TextStyle>, duration = 4) {
  const state = useEditor.getState()
  const safeText = text.trim() || 'Title'
  const start = Math.max(0, state.playhead)
  const videoTracks = state.tracks.filter((track) => track.type === 'video')
  const overlaps = (trackId: string) => state.clips.some(
    (clip) => clip.trackId === trackId && !(clip.start + clip.duration <= start || clip.start >= start + duration),
  )
  const baseTrack = videoTracks[0]
  const targetTrack = baseTrack && !overlaps(baseTrack.id)
    ? baseTrack
    : videoTracks.find((track) => !overlaps(track.id)) ?? baseTrack

  const clip: Clip = {
    id: 'visual-preview-text',
    trackId: targetTrack?.id ?? '',
    assetId: 'text-asset',
    start,
    duration,
    inPoint: 0,
    name: safeText,
    kind: 'text',
    volume: 1,
    hidden: false,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    textStyle: {
      fontSize: 48,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      fontFamily: 'sans-serif',
      bold: true,
      italic: false,
      ...style,
      text: safeText,
    },
  }

  state.startVisualPreview({
    kind: 'text-clip',
    clip,
    label,
    startTime: start,
    endTime: start + duration - 1 / Math.max(1, state.projectFps),
  })
  return true
}

export function previewEffectLayer(label: string, effect: ClipEffect) {
  const state = useEditor.getState()
  const selected = selectedVisualClip()
  const activeAdjustment = selected ? undefined : activeAdjustmentClip()
  const existingLayer = selected?.kind === 'adjustment' ? selected : activeAdjustment
  if (existingLayer) {
    state.startVisualPreview({
      kind: 'clip-effect',
      clipId: existingLayer.id,
      effect,
      ...clipWindow(existingLayer, state.projectFps),
      label,
    })
    return true
  }

  const selectedAnchor = selected && selected.kind !== 'adjustment' && selected.kind !== 'text' && !selected.textStyle
    ? selected
    : undefined
  const anchor = selectedAnchor ?? activeFootageAnchor()
  if (!anchor) return false
  state.startVisualPreview({
    kind: 'adjustment-layer',
    anchorClipId: anchor.id,
    afterTrackId: anchor.trackId,
    effect,
    ...clipWindow(anchor, state.projectFps),
    label,
  })
  return true
}
