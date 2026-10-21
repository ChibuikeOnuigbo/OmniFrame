/**
 * Transition preset catalogue + agent API.
 *
 * Taxonomy follows the researched editors (transition_tut.md /
 * ui_downlaod_study/GLOW-SHADOW.md method): Premiere's Dissolve · Wipe ·
 * Slide · Iris · Zoom · Page Peel families and CapCut's trending glitch /
 * whip / blur looks. Every preset here is implemented in playback.ts
 * `drawTransition` and exercised by qa/transition-presets-e2e.mjs, which
 * builds two test clips and renders every preset between them.
 *
 * Agent/MCP-style surface: `window.__omniframe_transitions` exposes
 * list/apply/remove/clear returning plain JSON-able results, so other
 * agents (and QA) can drive every feature and read back what happened.
 */
import { useEditor } from '../store'
import type { Clip, Transition, TransitionType } from '../types'

export const TRANSITION_MIN_DURATION = 0.1
export const TRANSITION_MAX_DURATION = 5

export interface TransitionPresetDef {
  id: TransitionType
  name: string
  category: 'Dissolve' | 'Wipe' | 'Slide' | 'Shapes' | 'Zoom & Motion' | 'Special'
  description: string
}

export const TRANSITION_PRESETS: TransitionPresetDef[] = [
  { id: 'cross_dissolve', name: 'Cross Dissolve', category: 'Dissolve', description: 'Smooth opacity blend from outgoing to incoming frame.' },
  { id: 'film_dissolve', name: 'Film Dissolve', category: 'Dissolve', description: 'Film-style blend with a gamma-weighted crossfade.' },
  { id: 'additive_dissolve', name: 'Additive Dissolve', category: 'Dissolve', description: 'Incoming frame adds its light over the outgoing frame.' },
  { id: 'dip_to_black', name: 'Dip to Black', category: 'Dissolve', description: 'Fades down to pure black, then fades up to incoming media.' },
  { id: 'dip_to_white', name: 'Dip to White', category: 'Dissolve', description: 'Flashes to pure white, then resolves into next clip.' },
  { id: 'blur_dissolve', name: 'Blur Dissolve', category: 'Dissolve', description: 'Both frames blur through each other (CapCut slow-mo blur look).' },
  { id: 'light_leak', name: 'Light Leak', category: 'Dissolve', description: 'Warm light bloom washes over the cut as frames blend.' },
  { id: 'wipe_left', name: 'Wipe Left', category: 'Wipe', description: 'Horizontal edge wipes across from right to left.' },
  { id: 'wipe_right', name: 'Wipe Right', category: 'Wipe', description: 'Horizontal edge wipes across from left to right.' },
  { id: 'wipe_up', name: 'Wipe Up', category: 'Wipe', description: 'Edge wipes upward, revealing the incoming clip.' },
  { id: 'wipe_down', name: 'Wipe Down', category: 'Wipe', description: 'Edge wipes downward, revealing the incoming clip.' },
  { id: 'clock_wipe', name: 'Clock Wipe', category: 'Wipe', description: 'A rotating clock-hand wedge reveals the incoming clip.' },
  { id: 'pinwheel', name: 'Pinwheel', category: 'Wipe', description: 'Two opposite wedges sweep the incoming clip in.' },
  { id: 'checker_wipe', name: 'Checker Wipe', category: 'Wipe', description: 'Checkerboard cells flip to the incoming clip in order.' },
  { id: 'blinds_h', name: 'Venetian Blinds H', category: 'Wipe', description: 'Horizontal blind slats open onto the incoming clip.' },
  { id: 'blinds_v', name: 'Venetian Blinds V', category: 'Wipe', description: 'Vertical blind slats open onto the incoming clip.' },
  { id: 'slide_left', name: 'Slide Left', category: 'Slide', description: 'Incoming clip pushes outgoing clip smoothly offscreen.' },
  { id: 'slide_right', name: 'Slide Right', category: 'Slide', description: 'Incoming clip pushes in from the left.' },
  { id: 'slide_up', name: 'Slide Up', category: 'Slide', description: 'Incoming clip pushes the outgoing clip up and out.' },
  { id: 'slide_down', name: 'Slide Down', category: 'Slide', description: 'Incoming clip pushes the outgoing clip down and out.' },
  { id: 'whip_left', name: 'Whip Left', category: 'Slide', description: 'Fast blurred pan left into the incoming clip (whip pan).' },
  { id: 'whip_right', name: 'Whip Right', category: 'Slide', description: 'Fast blurred pan right into the incoming clip (whip pan).' },
  { id: 'barn_doors', name: 'Barn Doors', category: 'Slide', description: 'Outgoing clip splits and slides apart like barn doors.' },
  { id: 'center_split', name: 'Center Split', category: 'Slide', description: 'Incoming clip opens out from the centre line.' },
  { id: 'page_turn', name: 'Page Turn', category: 'Slide', description: 'Outgoing clip peels away like a turning page.' },
  { id: 'iris_circle', name: 'Iris Round', category: 'Shapes', description: 'A circle expands to reveal the incoming clip (Premiere Iris Round).' },
  { id: 'iris_diamond', name: 'Iris Diamond', category: 'Shapes', description: 'A diamond expands to reveal the incoming clip.' },
  { id: 'iris_box', name: 'Iris Box', category: 'Shapes', description: 'A rectangle expands to reveal the incoming clip.' },
  { id: 'zoom', name: 'Zoom Push', category: 'Zoom & Motion', description: 'Camera pushes forward through outgoing into incoming clip.' },
  { id: 'zoom_out', name: 'Zoom Out', category: 'Zoom & Motion', description: 'Outgoing clip shrinks away as the incoming settles in.' },
  { id: 'spin', name: 'Spin', category: 'Zoom & Motion', description: 'Outgoing spins out while the incoming spins in (CapCut spin change).' },
  { id: 'flip_h', name: 'Flip', category: 'Zoom & Motion', description: 'Frame flips sideways into the incoming clip.' },
  { id: 'glitch', name: 'Glitch', category: 'Special', description: 'Digital slice offsets tear between the two clips.' },
]

export interface TransitionPairCandidate {
  fromClip: Clip
  toClip: Clip
  cut: number
  distance: number
}

/** Nearest usable cut to the playhead for a centred transition of `duration`. */
export function findTransitionPair(duration: number): TransitionPairCandidate | null {
  const state = useEditor.getState()
  const half = duration / 2
  const candidates: TransitionPairCandidate[] = []
  for (const track of state.tracks) {
    if (track.type !== 'video' || track.hidden) continue
    const clips = state.clips
      .filter((clip) => clip.trackId === track.id && !clip.hidden && clip.kind !== 'audio' && clip.kind !== 'adjustment')
      .sort((a, b) => a.start - b.start)
    for (let index = 0; index < clips.length - 1; index++) {
      const fromClip = clips[index]
      const toClip = clips[index + 1]
      const cut = fromClip.start + fromClip.duration
      const gap = toClip.start - cut
      if (gap < -0.01 || gap > 0.5) continue
      if (fromClip.duration < half || toClip.duration < half) continue
      candidates.push({ fromClip, toClip, cut, distance: Math.abs(cut - state.playhead) })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cut - b.cut)
  return candidates[0] ?? null
}

export interface ApplyTransitionResult {
  ok: boolean
  error?: string
  transition?: Transition
  from?: { id: string; name: string; duration: number }
  to?: { id: string; name: string; duration: number }
  cut?: number
  requiredClipSeconds?: number
}

/**
 * Apply a transition preset at the nearest usable cut. Duration must be
 * 0.1–5s and each side of the cut must hold at least duration/2 of clip
 * (centred handle). Returns a JSON-able result — never throws.
 */
export function applyTransitionPreset(type: TransitionType, duration: number): ApplyTransitionResult {
  const def = TRANSITION_PRESETS.find((p) => p.id === type)
  if (!def) return { ok: false, error: `Unknown transition preset "${type}".` }
  if (!Number.isFinite(duration) || duration < TRANSITION_MIN_DURATION || duration > TRANSITION_MAX_DURATION) {
    return { ok: false, error: `Duration must be between ${TRANSITION_MIN_DURATION}s and ${TRANSITION_MAX_DURATION}s (got ${duration}).` }
  }
  const pair = findTransitionPair(duration)
  if (!pair) {
    return {
      ok: false,
      error: `No usable cut: place two adjacent clips near the playhead, each at least ${(duration / 2).toFixed(2)}s long on its side of the cut.`,
      requiredClipSeconds: duration / 2,
    }
  }
  const startTime = Math.max(pair.fromClip.start, pair.cut - duration / 2)
  const id = useEditor.getState().addTransition({
    type,
    fromClipId: pair.fromClip.id,
    toClipId: pair.toClip.id,
    trackId: pair.fromClip.trackId,
    startTime,
    duration,
    alignment: 'centered',
    enabled: true,
  })
  const placed = (useEditor.getState().transitions || []).find((t) => t.id === id)
  return {
    ok: true,
    transition: placed,
    from: { id: pair.fromClip.id, name: pair.fromClip.name, duration: pair.fromClip.duration },
    to: { id: pair.toClip.id, name: pair.toClip.name, duration: pair.toClip.duration },
    cut: pair.cut,
    requiredClipSeconds: duration / 2,
  }
}

// --- Agent surface (window.__omniframe_transitions) -------------------------
export interface TransitionAgentApi {
  list: () => { presets: TransitionPresetDef[]; minDuration: number; maxDuration: number; count: number }
  apply: (type: TransitionType, duration?: number) => ApplyTransitionResult
  placed: () => Transition[]
  remove: (id: string) => { ok: boolean }
  clear: () => { ok: boolean; removed: number }
}

export const transitionAgentApi: TransitionAgentApi = {
  list: () => ({ presets: TRANSITION_PRESETS, minDuration: TRANSITION_MIN_DURATION, maxDuration: TRANSITION_MAX_DURATION, count: TRANSITION_PRESETS.length }),
  apply: (type, duration = 1) => applyTransitionPreset(type, duration),
  placed: () => useEditor.getState().transitions || [],
  remove: (id) => { useEditor.getState().removeTransition(id); return { ok: true } },
  clear: () => {
    const all = useEditor.getState().transitions || []
    all.forEach((t) => useEditor.getState().removeTransition(t.id))
    return { ok: true, removed: all.length }
  },
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__omniframe_transitions = transitionAgentApi
}
