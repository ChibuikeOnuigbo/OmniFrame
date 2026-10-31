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
import { PILLAR_PRESETS, type PillarPresetDef } from './pillarPresets'

export const TRANSITION_MIN_DURATION = 0.1
export const TRANSITION_MAX_DURATION = 5

export interface TransitionPresetDef {
  id: TransitionType
  name: string
  category: 'Dissolve' | 'Wipe' | 'Slide' | 'Shapes' | 'Zoom & Motion' | 'Special' | 'Blur' | 'Light' | 'Flicker' | 'Glitch' | 'TV' | 'Overlay' | 'Scene' | 'Device 3D'
  /** Out-of-the-box duration in seconds. Users can lower/raise it, but the
   *  applied duration is always capped to TRANSITION_MIN/MAX_DURATION. */
  baseDuration: number
  description: string
}

export const TRANSITION_PRESETS: TransitionPresetDef[] = [
  { id: 'device_phone', name: 'Phone 3D Fly-in', category: 'Device 3D', baseDuration: 1.6, description: 'A procedurally modelled phone spins in with the incoming clip on its green screen, then the screen expands flat to full frame (3D→2D).' },
  { id: 'device_monitor', name: 'Monitor 3D Fly-in', category: 'Device 3D', baseDuration: 1.6, description: 'An iMac-style monitor with pedestal stand swings in carrying the incoming clip, then flattens to 2D.' },
  { id: 'device_tv', name: 'TV 3D Fly-in', category: 'Device 3D', baseDuration: 1.6, description: 'A thin-bezel TV on feet rotates in with the incoming clip on screen, then hands off to flat 2D.' },
  { id: 'cross_dissolve', name: 'Cross Dissolve', category: 'Dissolve', baseDuration: 1.2, description: 'Smooth opacity blend from outgoing to incoming frame.' },
  { id: 'film_dissolve', name: 'Film Dissolve', category: 'Dissolve', baseDuration: 1.4, description: 'Film-style blend with a gamma-weighted crossfade.' },
  { id: 'additive_dissolve', name: 'Additive Dissolve', category: 'Dissolve', baseDuration: 1.2, description: 'Incoming frame adds its light over the outgoing frame.' },
  { id: 'dip_to_black', name: 'Dip to Black', category: 'Dissolve', baseDuration: 1.0, description: 'Fades down to pure black, then fades up to incoming media.' },
  { id: 'dip_to_white', name: 'Dip to White', category: 'Dissolve', baseDuration: 1.0, description: 'Flashes to pure white, then resolves into next clip.' },
  { id: 'blur_dissolve', name: 'Blur Dissolve', category: 'Dissolve', baseDuration: 1.5, description: 'Both frames blur through each other (CapCut slow-mo blur look).' },
  { id: 'light_leak', name: 'Light Leak', category: 'Dissolve', baseDuration: 1.6, description: 'Warm light bloom washes over the cut as frames blend.' },
  { id: 'wipe_left', name: 'Wipe Left', category: 'Wipe', baseDuration: 0.8, description: 'Horizontal edge wipes across from right to left.' },
  { id: 'wipe_right', name: 'Wipe Right', category: 'Wipe', baseDuration: 0.8, description: 'Horizontal edge wipes across from left to right.' },
  { id: 'wipe_up', name: 'Wipe Up', category: 'Wipe', baseDuration: 0.8, description: 'Edge wipes upward, revealing the incoming clip.' },
  { id: 'wipe_down', name: 'Wipe Down', category: 'Wipe', baseDuration: 0.8, description: 'Edge wipes downward, revealing the incoming clip.' },
  { id: 'clock_wipe', name: 'Clock Wipe', category: 'Wipe', baseDuration: 1.0, description: 'A rotating clock-hand wedge reveals the incoming clip.' },
  { id: 'pinwheel', name: 'Pinwheel', category: 'Wipe', baseDuration: 1.0, description: 'Two opposite wedges sweep the incoming clip in.' },
  { id: 'checker_wipe', name: 'Checker Wipe', category: 'Wipe', baseDuration: 0.9, description: 'Checkerboard cells flip to the incoming clip in order.' },
  { id: 'blinds_h', name: 'Venetian Blinds H', category: 'Wipe', baseDuration: 0.9, description: 'Horizontal blind slats open onto the incoming clip.' },
  { id: 'blinds_v', name: 'Venetian Blinds V', category: 'Wipe', baseDuration: 0.9, description: 'Vertical blind slats open onto the incoming clip.' },
  { id: 'slide_left', name: 'Slide Left', category: 'Slide', baseDuration: 0.9, description: 'Incoming clip pushes outgoing clip smoothly offscreen.' },
  { id: 'slide_right', name: 'Slide Right', category: 'Slide', baseDuration: 0.9, description: 'Incoming clip pushes in from the left.' },
  { id: 'slide_up', name: 'Slide Up', category: 'Slide', baseDuration: 0.9, description: 'Incoming clip pushes the outgoing clip up and out.' },
  { id: 'slide_down', name: 'Slide Down', category: 'Slide', baseDuration: 0.9, description: 'Incoming clip pushes the outgoing clip down and out.' },
  { id: 'whip_left', name: 'Whip Left', category: 'Slide', baseDuration: 0.5, description: 'Fast blurred pan left into the incoming clip (whip pan).' },
  { id: 'whip_right', name: 'Whip Right', category: 'Slide', baseDuration: 0.5, description: 'Fast blurred pan right into the incoming clip (whip pan).' },
  { id: 'barn_doors', name: 'Barn Doors', category: 'Slide', baseDuration: 1.0, description: 'Outgoing clip splits and slides apart like barn doors.' },
  { id: 'center_split', name: 'Center Split', category: 'Slide', baseDuration: 0.9, description: 'Incoming clip opens out from the centre line.' },
  { id: 'page_turn', name: 'Page Turn', category: 'Slide', baseDuration: 1.1, description: 'Outgoing clip peels away like a turning page.' },
  { id: 'iris_circle', name: 'Iris Round', category: 'Shapes', baseDuration: 1.0, description: 'A circle expands to reveal the incoming clip (Premiere Iris Round).' },
  { id: 'iris_diamond', name: 'Iris Diamond', category: 'Shapes', baseDuration: 1.0, description: 'A diamond expands to reveal the incoming clip.' },
  { id: 'iris_box', name: 'Iris Box', category: 'Shapes', baseDuration: 1.0, description: 'A rectangle expands to reveal the incoming clip.' },
  { id: 'zoom', name: 'Zoom Push', category: 'Zoom & Motion', baseDuration: 1.0, description: 'Camera pushes forward through outgoing into incoming clip.' },
  { id: 'zoom_out', name: 'Zoom Out', category: 'Zoom & Motion', baseDuration: 1.0, description: 'Outgoing clip shrinks away as the incoming settles in.' },
  { id: 'spin', name: 'Spin', category: 'Zoom & Motion', baseDuration: 0.8, description: 'Outgoing spins out while the incoming spins in (CapCut spin change).' },
  { id: 'flip_h', name: 'Flip', category: 'Zoom & Motion', baseDuration: 0.7, description: 'Frame flips sideways into the incoming clip.' },
  { id: 'glitch', name: 'Glitch', category: 'Special', baseDuration: 0.6, description: 'Digital slice offsets tear between the two clips.' },
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
 * Apply a transition preset at the nearest usable cut. Omit `duration` to
 * use the preset's base seconds; any chosen duration must stay inside the
 * 0.1–5s cap and each side of the cut must hold at least duration/2 of clip
 * (centred handle). Returns a JSON-able result — never throws.
 */
export function applyTransitionPreset(type: TransitionType, duration?: number): ApplyTransitionResult {
  const def = TRANSITION_PRESETS.find((p) => p.id === type)
  if (!def) return { ok: false, error: `Unknown transition preset "${type}".` }
  const secs = typeof duration === 'number' && Number.isFinite(duration) ? duration : def.baseDuration
  if (secs < TRANSITION_MIN_DURATION || secs > TRANSITION_MAX_DURATION) {
    return { ok: false, error: `Duration must be between ${TRANSITION_MIN_DURATION}s and ${TRANSITION_MAX_DURATION}s (got ${secs}).` }
  }
  const pair = findTransitionPair(secs)
  if (!pair) {
    return {
      ok: false,
      error: `No usable cut: place two adjacent clips near the playhead, each at least ${(secs / 2).toFixed(2)}s long on its side of the cut.`,
      requiredClipSeconds: secs / 2,
    }
  }
  const startTime = Math.max(pair.fromClip.start, pair.cut - secs / 2)
  const id = useEditor.getState().addTransition({
    type,
    fromClipId: pair.fromClip.id,
    toClipId: pair.toClip.id,
    trackId: pair.fromClip.trackId,
    startTime,
    duration: secs,
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
    requiredClipSeconds: secs / 2,
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
  apply: (type, duration) => applyTransitionPreset(type, duration),
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

// --- Pillar merge -----------------------------------------------------------
/** The 350 pillar presets adapted to the shared def shape; family renderers
 *  in pillarRenderers.ts read their `params`. */
// Glitch left the transition catalog (board J): it is an EFFECT now — every
// property editable + keyframeable, dropped on clips or placed as a layer.
// Legacy projects with saved glitch transitions still render (the pillar
// renderer stays), but no new glitch transitions can be created.
const pillarAsDefs: TransitionPresetDef[] = PILLAR_PRESETS
  .filter((p) => p.family !== 'glitch')
  .map((p) => ({ ...p }) as unknown as TransitionPresetDef)
TRANSITION_PRESETS.push(...pillarAsDefs)

export const PILLAR_DEF_BY_TYPE: Partial<Record<TransitionType, PillarPresetDef>> = Object.fromEntries(
  PILLAR_PRESETS.map((p) => [p.id, p]),
) as Partial<Record<TransitionType, PillarPresetDef>>
