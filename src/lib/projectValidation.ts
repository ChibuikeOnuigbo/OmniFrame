import { validateSculptDabs } from './sculptData'
import { validateClipEffectAnimation } from './clipEffectAnimation'
/** Validate the core document before it can replace a live editor session. */
type RecordValue = Record<string, unknown>
const mediaKinds = new Set(['video', 'image', 'audio', 'text', 'threed', 'compound', 'adjustment', 'drawing', 'null'])

function invalid(path: string): never {
  throw new Error(`The project contains an invalid ${path}. The current project was kept.`)
}
function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid(path)
  return value as RecordValue
}
function string(value: unknown, path: string, nonempty = false): void {
  if (typeof value !== 'string' || (nonempty && !value.trim())) invalid(path)
}
function number(value: unknown, path: string, min = -Infinity): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) invalid(path)
}
function boolean(value: unknown, path: string): void {
  if (typeof value !== 'boolean') invalid(path)
}
function collection(value: unknown, path: string): RecordValue[] {
  if (!Array.isArray(value)) invalid(path)
  const ids = new Set<string>()
  return value.map((item, index) => {
    const entry = record(item, `${path}[${index}]`)
    string(entry.id, `${path}[${index}].id`, true)
    const id = entry.id as string
    if (ids.has(id)) invalid(`${path} duplicate ID`)
    ids.add(id)
    return entry
  })
}

function timeline(tracksValue: unknown, clipsValue: unknown, path: string, depth = 0): void {
  if (depth > 32) invalid(`${path} nesting depth`)
  const tracks = collection(tracksValue, `${path}.tracks`)
  const trackIds = new Set(tracks.map(track => track.id))
  for (const track of tracks) {
    if (track.type !== 'video' && track.type !== 'audio') invalid(`${path}.track type`)
    string(track.name, `${path}.track name`)
    number(track.height, `${path}.track height`, 0)
    for (const key of ['muted', 'hidden', 'locked', 'gapless']) boolean(track[key], `${path}.track ${key}`)
  }
  const clips = collection(clipsValue, `${path}.clips`)
  for (const clip of clips) {
    if (!trackIds.has(clip.trackId)) invalid(`${path}.clip track reference`)
    string(clip.assetId, `${path}.clip asset reference`)
    string(clip.name, `${path}.clip name`)
    if (!mediaKinds.has(clip.kind as string)) invalid(`${path}.clip kind`)
    for (const key of ['start', 'duration', 'inPoint', 'volume']) number(clip[key], `${path}.clip ${key}`, 0)
    try { validateClipEffectAnimation(clip.effects, clip.effectKeys, clip.effectSourceOffset) } catch { invalid(`${path}.effect animation`) }
    boolean(clip.hidden, `${path}.clip visibility`)
    const transform = record(clip.transform, `${path}.clip transform`)
    for (const key of ['x', 'y', 'scale', 'rotation', 'opacity']) number(transform[key], `${path}.clip transform ${key}`)
    if (clip.sourceSequenceId !== undefined) string(clip.sourceSequenceId, `${path}.compound source`, true)
    if (clip.originalChildClips !== undefined || clip.originalChildTracks !== undefined) {
      timeline(clip.originalChildTracks, clip.originalChildClips, `${path}.compound`, depth + 1)
    }
  }
}

function compoundGraph(document: RecordValue): void {
  const sequences = new Map(((document.sequences ?? []) as RecordValue[]).map(sequence => [sequence.id, sequence]))
  const visiting = new Set<unknown>()
  const depths = new Map<unknown, number>()
  const clipsDepth = (clips: RecordValue[], level: number): number => {
    if (level > 32) invalid('compound nesting depth')
    let depth = 0
    for (const clip of clips) {
      if (clip.kind !== 'compound') continue
      const sequence = sequences.get(clip.sourceSequenceId)
      let childDepth = 0
      if (sequence) {
        if (visiting.has(sequence.id)) invalid('cyclic compound sequence')
        const cached = depths.get(sequence.id)
        if (cached !== undefined) childDepth = cached
        else {
          visiting.add(sequence.id)
          childDepth = clipsDepth(sequence.clips as RecordValue[], level + 1)
          visiting.delete(sequence.id)
          depths.set(sequence.id, childDepth)
        }
      } else if (clip.originalChildClips) childDepth = clipsDepth(clip.originalChildClips as RecordValue[], level + 1)
      else if (clip.sourceSequenceId !== undefined) invalid('missing compound sequence')
      depth = Math.max(depth, childDepth + 1)
      if (depth > 32) invalid('compound nesting depth')
    }
    return depth
  }
  clipsDepth(document.clips as RecordValue[], 0)
  for (const sequence of sequences.values()) clipsDepth(sequence.clips as RecordValue[], 0)
}

export function validateImportedProject(document: RecordValue, runtime: object): void {
  const current = new Map(Object.entries(runtime))
  // Serialized data must never replace actions such as pause/newProject/save.
  for (const key of Object.keys(document)) {
    if (typeof current.get(key) === 'function' || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid(`reserved field ${key}`)
    if (Array.isArray(current.get(key)) && !Array.isArray(document[key])) invalid(`${key} collection`)
  }
  const assets = collection(document.assets, 'assets')
  for (const asset of assets) {
    string(asset.name, 'asset name')
    string(asset.url, 'asset URL')
    if (!mediaKinds.has(asset.kind as string)) invalid('asset kind')
    for (const key of ['width', 'height', 'duration', 'size']) number(asset[key], `asset ${key}`, 0)
    if (asset.imageSequence !== undefined) {
      const sequence = record(asset.imageSequence, 'image sequence')
      number(sequence.fps, 'image sequence fps', Number.MIN_VALUE)
      if (!Array.isArray(sequence.frames)) invalid('image sequence frames')
      for (const value of sequence.frames) {
        const frame = record(value, 'image sequence frame')
        number(frame.time, 'image sequence frame time', 0)
        string(frame.url, 'image sequence frame URL')
      }
    }
  }
  timeline(document.tracks, document.clips, 'timeline')
  if (document.sequences !== undefined) {
    for (const sequence of collection(document.sequences, 'sequences')) {
      string(sequence.name, 'sequence name')
      number(sequence.duration, 'sequence duration', 0)
      timeline(sequence.tracks, sequence.clips, 'sequence')
    }
  }
  compoundGraph(document)
  for (const key of ['duration', 'playhead']) {
    if (document[key] !== undefined) number(document[key], key, 0)
  }
  for (const key of ['projectFps', 'pxPerSec']) {
    if (document[key] !== undefined) number(document[key], key, Number.MIN_VALUE)
  }
  if (document.speed !== undefined) number(document.speed, 'playback speed')
  if (document.projectName !== undefined) string(document.projectName, 'project name')
  if (document.sequenceSettings !== undefined) {
    const settings = record(document.sequenceSettings, 'sequence settings')
    for (const key of ['width', 'height']) number(settings[key], `sequence ${key}`, 1)
    if (!Number.isSafeInteger(settings.width) || !Number.isSafeInteger(settings.height)
      || (settings.width as number) > 32768 || (settings.height as number) > 32768
      || (settings.width as number) * (settings.height as number) > 7680 * 7680) invalid('sequence canvas dimensions')
    number(settings.fps, 'sequence frame rate', Number.MIN_VALUE)
    string(settings.label, 'sequence label')
    string(settings.aspectRatio, 'sequence aspect ratio', true)
  }
  if (document.markers !== undefined) {
    for (const marker of collection(document.markers, 'markers')) {
      number(marker.time, 'marker time', 0)
      string(marker.label, 'marker label')
      string(marker.color, 'marker color')
    }
  }
  if (document.paintLayers !== undefined) {
    for (const layer of collection(document.paintLayers, 'paint layers')) {
      string(layer.name, 'paint layer name')
      number(layer.opacity, 'paint layer opacity', 0)
      boolean(layer.visible, 'paint layer visibility')
      boolean(layer.locked, 'paint layer lock')
    }
  }
  if (document.transitions !== undefined) {
    for (const transition of collection(document.transitions, 'transitions')) {
      string(transition.type, 'transition type', true)
      for (const key of ['startTime', 'duration']) number(transition[key], `transition ${key}`, 0)
    }
  }
  if (document.scene3DObjects !== undefined) {
    for (const object of collection(document.scene3DObjects, '3D objects')) {
      try { validateSculptDabs(object.sculptDabs) } catch { invalid('3D sculpt strokes') }
      if (Array.isArray(object.sculptDabs) && object.sculptDabs.length && (object.modelUrl || object.type === 'wheel')) invalid('sculpt target')
      string(object.name, '3D object name')
      string(object.color, '3D object color')
      if (!['wheel', 'cube', 'sphere', 'torus', 'diamond', 'plane'].includes(object.type as string)) invalid('3D object type')
      for (const field of ['position', 'rotation', 'scale']) {
        const vector = record(object[field], `3D ${field}`)
        for (const axis of ['x', 'y', 'z']) number(vector[axis], `3D ${field}.${axis}`)
      }
    }
  }
}
