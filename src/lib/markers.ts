import type { Clip, MarkerKind, TimelineMarker } from '../types'

export interface MarkerKindDef {
  id: MarkerKind
  label: string
  color: string
  hint: string
}

/** Five purposes, five colours — one job per marker (CapCut colour coding). */
export const MARKER_KINDS: MarkerKindDef[] = [
  { id: 'beat', label: 'Beat', color: '#f59e0b', hint: 'Beat / hit points — cut and shake on these' },
  { id: 'section', label: 'Section', color: '#a855f7', hint: 'Structure: intro, hook, drop, outro' },
  { id: 'note', label: 'Note', color: '#38bdf8', hint: 'Reminders — “look here”, “come in here”' },
  { id: 'fix', label: 'Fix-it', color: '#ef4444', hint: 'Problems to repair before export' },
  { id: 'cue', label: 'Cue', color: '#22c55e', hint: 'Audio cues, entrances, sync points' },
]

export const markerKindDef = (kind?: string): MarkerKindDef | undefined =>
  MARKER_KINDS.find((k) => k.id === kind)

const LEGACY_HEX: Record<string, string> = {
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  purple: '#a855f7',
  orange: '#f97316',
}

/** Normalize any stored colour (legacy name or hex) to a hex string. */
export function markerColorHex(color?: string, kind?: string): string {
  if (color && color.startsWith('#')) return color
  if (color && LEGACY_HEX[color]) return LEGACY_HEX[color]
  return markerKindDef(kind)?.color ?? '#3b82f6'
}

/** Where a marker actually sits on the timeline right now. */
export function resolveMarkerTime(m: TimelineMarker, clips: Pick<Clip, 'id' | 'start'>[]): number {
  if (m.clipId) {
    const clip = clips.find((c) => c.id === m.clipId)
    if (clip) return clip.start + (m.clipOffset ?? 0)
  }
  return m.time
}

export interface MarkerGroup {
  time: number
  markers: TimelineMarker[]
  colors: string[]
}

/** Group markers that share a position (±40ms), across timeline + clips —
 * they render as ONE flag split into colour slices (or a gradient + count
 * when there are too many to slice readably). */
export function groupMarkers(markers: TimelineMarker[], clips: Pick<Clip, 'id' | 'start'>[], tolerance = 0.04): MarkerGroup[] {
  const sorted = markers
    .map((m) => ({ m, t: resolveMarkerTime(m, clips) }))
    .sort((a, b) => a.t - b.t)
  const groups: MarkerGroup[] = []
  for (const { m, t } of sorted) {
    const last = groups[groups.length - 1]
    if (last && Math.abs(t - last.time) <= tolerance) {
      last.markers.push(m)
      last.colors.push(markerColorHex(m.color, m.kind))
    } else {
      groups.push({ time: t, markers: [m], colors: [markerColorHex(m.color, m.kind)] })
    }
  }
  return groups
}

/** CSS background for a combined flag: hard slices up to 4 colours, then a
 * smooth gradient (15 markers can't be 15 slices — gradient + count wins). */
export function markerGroupBackground(colors: string[]): string {
  if (colors.length === 1) return colors[0]
  if (colors.length <= 4) {
    const step = 100 / colors.length
    return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`
  }
  return `linear-gradient(90deg, ${colors.join(', ')})`
}
