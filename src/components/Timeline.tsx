import { useRef, useState, useEffect, useMemo} from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Magnet,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Video,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Slash,
  MousePointer2,
  ChevronDown,
  Gauge,
  AlignJustify,
  Sparkles,
  MoreVertical,
  Plus,
  Trash2,
  Target,
  Check,
  X,
  Copy,
  Layers,
  ArrowRight,
  Minimize2,
  Bookmark,
  Type,
  Activity,
  ArrowLeft,
  FolderOpen,
  FolderOutput,
  Package,
  Box,
  Image as ImageIcon,
  ChevronRight,
  Film,
} from 'lucide-react'
import { useEditor, gapsOnTrack } from '../store'
import type { Clip, MediaAsset, Track, Transition, TransitionType } from '../types'
import { chooseTickInterval, formatTimecode, formatRulerLabel, uid, clamp } from '../lib/time'
import { IconButton } from './ui'
import { readClipClipboard, writeClipClipboard } from '../lib/clipClipboard'
import { GraphEditor } from './GraphEditor'
import { AudioMeter } from './AudioMeter'
import { TimelineController, TrackModel } from '../lib/oop/TimelineController'
import { readableTextColor } from '../lib/color'

const RULER_H = 28
const HEADER_W = 168
const MAX_PX = 8000 // continuous zoom remains usable through frame-level detail

// Snap a time value to nearby clip edges, markers, and the playhead.
/**
 * Snap a time to nearby clip edges, markers and the playhead.
 *
 * `excludeClipIds` must contain the clips being manipulated. Without it a clip
 * is offered its own edges as snap targets, so it snaps to itself: the dragged
 * clip's start is rewritten every frame from a value derived from its own
 * current position, which makes it stick or jump instead of following the
 * pointer.
 */
function snapTime(value: number, excludeClipIds?: ReadonlySet<string> | string): number {
  const st = useEditor.getState()
  if (!st.snapping) return value
  const px = st.pxPerSec
  const thresh = 8 / px
  let best = value
  let bestDist = thresh
  const excluded =
    typeof excludeClipIds === 'string' ? new Set([excludeClipIds]) : excludeClipIds
  for (const c of st.clips) {
    if (excluded?.has(c.id)) continue
    for (const t of [c.start, c.start + c.duration]) {
      const d = Math.abs(t - value)
      if (d < bestDist) {
        bestDist = d
        best = t
      }
    }
  }
  for (const m of st.markers || []) {
    const dm = Math.abs(m.time - value)
    if (dm < bestDist) {
      bestDist = dm
      best = m.time
    }
  }
  const dph = Math.abs(st.playhead - value)
  if (dph < bestDist) best = st.playhead
  return best
}

/**
 * Snap a clip placement to nearby edges.
 *
 * Snapping must be evaluated on the clip's own edges, not on the pointer. The
 * pointer sits wherever the user grabbed the clip, so aligning the pointer to
 * a neighbour only lines the two clips up when the grab happened to be at the
 * left edge. Try the leading and the trailing edge against every candidate
 * target and take the smallest correction that falls inside the threshold.
 */
function snapPlacement(
  start: number,
  duration: number,
  excludeClipIds?: ReadonlySet<string> | string,
): number {
  const st = useEditor.getState()
  if (!st.snapping) return start
  const thresh = 8 / st.pxPerSec
  const excluded =
    typeof excludeClipIds === 'string' ? new Set([excludeClipIds]) : excludeClipIds

  const targets: number[] = [st.playhead]
  for (const c of st.clips) {
    if (excluded?.has(c.id)) continue
    targets.push(c.start, c.start + c.duration)
  }
  for (const m of st.markers || []) targets.push(m.time)

  let bestDelta: number | null = null
  for (const t of targets) {
    for (const delta of [t - start, t - (start + duration)]) {
      if (Math.abs(delta) < thresh && (bestDelta === null || Math.abs(delta) < Math.abs(bestDelta))) {
        bestDelta = delta
      }
    }
  }
  return bestDelta === null ? start : Math.max(0, start + bestDelta)
}

interface DragTargetInfo {
  mode: 'dock' | 'above' | 'below' | 'between'
  trackId: string | null
  referenceTrackId: string | null
  indicatorY: number
}

function evaluateDragTarget(
  clientY: number,
  lanesEl: HTMLElement,
  tracks: Track[],
  clipKind: string,
): DragTargetInfo {
  const rect = lanesEl.getBoundingClientRect()
  const relY = clientY - rect.top + lanesEl.scrollTop

  if (tracks.length === 0) {
    return { mode: 'dock', trackId: null, referenceTrackId: null, indicatorY: 0 }
  }

  // If above topmost track
  if (relY < 14) {
    return {
      mode: 'above',
      trackId: null,
      referenceTrackId: tracks[0].id,
      indicatorY: 0,
    }
  }

  const clips = useEditor.getState().clips
  let accY = 0
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]
    const trackTop = accY
    const tHeight = new TrackModel(t).getEffectiveHeight(clips)
    const trackBottom = accY + tHeight

    // Gap between tracks (boundary zone +/- 10px)
    if (i > 0 && Math.abs(relY - trackTop) <= 10) {
      return {
        mode: 'between',
        trackId: null,
        referenceTrackId: tracks[i - 1].id,
        indicatorY: trackTop,
      }
    }

    if (relY >= trackTop && relY < trackBottom) {
      return {
        mode: 'dock',
        trackId: t.id,
        referenceTrackId: null,
        indicatorY: trackTop,
      }
    }

    accY = trackBottom
  }

  // Below bottom track
  return {
    mode: 'below',
    trackId: null,
    referenceTrackId: tracks[tracks.length - 1].id,
    indicatorY: accY,
  }
}

interface DragState {
  clipId: string
  clipName: string
  kind: string
  origStart: number
  origDuration: number
  origTrackId: string
  startX: number
  startY: number
  curTime: number
  target: DragTargetInfo
}

function LiveTimecode() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const paint = () => {
      if (ref.current) ref.current.textContent = formatTimecode(useEditor.getState().playhead)
    }
    paint()
    return useEditor.subscribe((state, previous) => {
      if (state.playhead !== previous.playhead) paint()
    })
  }, [])
  return <span ref={ref} data-testid="current-time" className="text-white">00:00:00:00</span>
}

function PlayheadMarker({ px, handle = false }: { px: number; handle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const paint = () => {
      if (ref.current) ref.current.style.transform = `translate3d(${useEditor.getState().playhead * px}px,0,0)`
    }
    paint()
    return useEditor.subscribe((state, previous) => {
      if (state.playhead !== previous.playhead) paint()
    })
  }, [px])
  return (
    <div ref={ref} className={`absolute left-0 top-0 bottom-0 w-0.5 pointer-events-none z-25 ${handle ? 'bg-red-500' : 'bg-red-500/80'}`}>
      {handle && (
        <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rotate-45 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
      )}
    </div>
  )
}

/** Short code for a track (V1, A1, V2...) matching the header target buttons. */
function trackShortCode(tracks: Track[], trackId: string): string {
  const idx = tracks.findIndex((t) => t.id === trackId)
  if (idx < 0) return '?'
  const t = tracks[idx]
  const prefix = t.type === 'audio' ? 'A' : 'V'
  const nth = tracks.slice(0, idx + 1).filter((x) => x.type === t.type).length
  return `${prefix}${nth}`
}

/**
 * Central control for track targeting. Targeting is a refinement, never a
 * gate: with nothing targeted every track stays in scope, so the universal
 * tools keep working exactly as they did before targeting existed.
 */
function TrackTargetMenu() {
  const tracks = useEditor((s) => s.tracks)
  const targeted = useEditor((s) => s.targetedTrackIds)
  const toggleTrackTarget = useEditor((s) => s.toggleTrackTarget)
  const setTrackTargets = useEditor((s) => s.setTrackTargets)
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const allInScope = targeted.length === 0
  const label = allInScope
    ? 'All tracks'
    : tracks.filter((t) => targeted.includes(t.id)).map((t) => trackShortCode(tracks, t.id)).join(', ') || 'None'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-testid="track-target-menu-btn"
        aria-expanded={open}
        title={
          allInScope
            ? 'Tools apply to all tracks. Click to target specific ones.'
            : `Tools apply to: ${label}. Click to change.`
        }
        aria-label="Track targeting"
        onClick={() => setOpen((o) => !o)}
        className={
          'flex h-8 max-w-[132px] items-center justify-center gap-1 rounded-md border px-1.5 text-xs transition-colors ' +
          (allInScope
            ? 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-white'
            : 'border-brand bg-brand/20 text-white hover:bg-brand/30')
        }
      >
        <Target size={14} className="shrink-0" />
        {/* Only spell out the scope once it is narrowed: the default state is
            "everything", which the tooltip already says, and the toolbar
            already scrolls horizontally without extra text. */}
        {!allInScope && <span className="truncate">{label}</span>}
        <ChevronDown size={11} className="shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            data-testid="track-target-menu"
            className="fixed z-50 w-52 rounded-md border border-ink-700 bg-ink-850 p-1 shadow-2xl text-[11px] text-ink-200"
            style={{
              left: btnRef.current ? btnRef.current.getBoundingClientRect().left : 0,
              top: btnRef.current ? btnRef.current.getBoundingClientRect().bottom + 4 : 0,
            }}
          >
            <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-ink-500">
              Apply tools to
            </div>
            <button
              type="button"
              data-testid="track-target-all"
              onClick={() => {
                setTrackTargets([])
                setOpen(false)
              }}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
            >
              <Check size={12} className={allInScope ? 'opacity-100' : 'opacity-0'} />
              <span>All tracks (default)</span>
            </button>
            <div className="my-1 border-t border-ink-700" />
            {tracks.map((t) => {
              const on = targeted.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`track-target-item-${t.id}`}
                  onClick={() => toggleTrackTarget(t.id)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <span
                    className={
                      'grid place-items-center w-3.5 h-3.5 shrink-0 rounded-[3px] border ' +
                      (on ? 'bg-brand border-brand text-white' : 'border-ink-600')
                    }
                  >
                    {on && <Check size={10} />}
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              )
            })}
            {!allInScope && (
              <>
                <div className="my-1 border-t border-ink-700" />
                <button
                  type="button"
                  data-testid="track-target-clear"
                  onClick={() => {
                    setTrackTargets([])
                    setOpen(false)
                  }}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <X size={12} />
                  <span>Clear targeting</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

function TrackHeader({
  track,
  tracks,
  index,
}: {
  track: Track
  tracks: Track[]
  index: number
}) {
  const toggleMute = useEditor((s) => s.toggleTrackMute)
  const toggleHidden = useEditor((s) => s.toggleTrackHidden)
  const toggleLock = useEditor((s) => s.toggleTrackLock)
  const toggleGapless = useEditor((s) => s.toggleTrackGapless)
  const targetedTrackIds = useEditor((s) => s.targetedTrackIds)
  const toggleTrackTarget = useEditor((s) => s.toggleTrackTarget)
  const targetTrackOnly = useEditor((s) => s.targetTrackOnly)
  const createTrack = useEditor((s) => s.createTrack)
  const deleteTrack = useEditor((s) => s.deleteTrack)
  const setTrackHeight = useEditor((s) => s.setTrackHeight)
  const clips = useEditor((s) => s.clips)
  const effectiveHeight = new TrackModel(track).getEffectiveHeight(clips)
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const trackClips = clips.filter((c) => c.trackId === track.id)
  const primaryKind = trackClips[0]?.kind || (track.type === 'audio' ? 'audio' : 'video')

  const shortCode = trackShortCode(tracks, track.id)
  const isTargeted = targetedTrackIds.includes(track.id)
  const targetingActive = targetedTrackIds.length > 0

  const kindBadge = (() => {
    switch (primaryKind) {
      case 'audio':
        return <span data-testid="track-kind-badge-audio" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">AUD</span>
      case 'image':
        return <span data-testid="track-kind-badge-image" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">IMG</span>
      case 'text':
        return <span data-testid="track-kind-badge-text" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">TXT</span>
      case 'threed':
        return <span data-testid="track-kind-badge-threed" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 shrink-0">3D</span>
      case 'compound':
        return <span data-testid="track-kind-badge-compound" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-indigo-500/25 text-indigo-300 border border-indigo-400/40 shrink-0">CMP</span>
      case 'video':
      default:
        return <span data-testid="track-kind-badge-video" className="text-[10px] font-mono font-bold px-1 py-0.2 rounded uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">VID</span>
    }
  })()

  const kindIcon = (() => {
    switch (primaryKind) {
      case 'audio':
        return <Music size={13} className="text-emerald-400" />
      case 'image':
        return <ImageIcon size={13} className="text-purple-400" />
      case 'text':
        return <Type size={13} className="text-amber-400" />
      case 'threed':
        return <Box size={13} className="text-fuchsia-400" />
      case 'compound':
        return <Layers size={13} className="text-indigo-400" />
      case 'video':
      default:
        return <Video size={13} className="text-sky-400" />
    }
  })()

  return (
    <div
      data-testid="track-header"
      data-track-id={track.id}
      data-track-kind={primaryKind}
      className="shrink-0 flex items-center gap-1 px-2 border-b border-ink-800 bg-ink-850 relative group"
      style={{ height: effectiveHeight }}
    >
      {/* Accent bar: the track is receiving universal tools. */}
      {isTargeted && (
        <span
          data-testid={`track-scope-accent-${track.id}`}
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand"
        />
      )}
      <button
        type="button"
        data-testid={`track-target-${track.id}`}
        data-targeted={isTargeted}
        aria-pressed={isTargeted}
        title={
          isTargeted
            ? `${shortCode} is targeted. Click to untarget — tools then apply to all tracks.`
            : `Target ${shortCode}. Targeted tracks are the only ones universal tools touch. Click to toggle, Shift-click to target only this track.`
        }
        onClick={(e) => {
          if (e.shiftKey) targetTrackOnly(track.id)
          else toggleTrackTarget(track.id)
        }}
        className={
          'shrink-0 h-8 min-w-[20px] px-1.5 rounded-[3px] border font-mono text-[9px] font-bold leading-none grid place-items-center transition-colors ' +
          (isTargeted
            ? 'bg-brand border-brand text-white'
            : targetingActive
              ? 'border-ink-700 text-ink-600 hover:text-ink-300 hover:border-ink-600'
              : 'border-ink-700 text-ink-400 hover:text-white hover:border-ink-500')
        }
      >
        {shortCode}
      </button>
      <span className="shrink-0">
        {kindIcon}
      </span>
      <span className="text-[11px] font-semibold text-ink-200 truncate flex-1 flex items-center gap-1.5 min-w-0">
        <span className="truncate" title={track.name}>{track.name}</span>
        {kindBadge}
      </span>

      {track.type === 'audio' ? (
        <IconButton title="Mute" active={track.muted} onClick={() => toggleMute(track.id)}>
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </IconButton>
      ) : (
        <IconButton title="Hide" active={track.hidden} onClick={() => toggleHidden(track.id)}>
          {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </IconButton>
      )}
      <IconButton
        title={track.gapless ? 'Disable gapless ripple' : 'Enable gapless ripple'}
        active={track.gapless}
        onClick={() => toggleGapless(track.id)}
      >
        <AlignJustify size={13} />
      </IconButton>
      <IconButton title={track.locked ? 'Unlock' : 'Lock'} active={track.locked} onClick={() => toggleLock(track.id)}>
        {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </IconButton>

      {/* Track Menu Trigger */}
      <button
        ref={btnRef}
        type="button"
        data-testid={`track-menu-${track.id}`}
        title="Track options"
        onClick={() => setMenuOpen((o) => !o)}
        className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-750 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical size={12} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed z-50 w-44 rounded-md border border-ink-700 bg-ink-850 p-1 shadow-2xl text-[11px] text-ink-200"
            style={{
              left: btnRef.current ? btnRef.current.getBoundingClientRect().right + 4 : 172,
              top: btnRef.current ? btnRef.current.getBoundingClientRect().top : 100,
            }}
          >
            <button
              type="button"
              data-testid="track-close-gaps"
              onClick={() => {
                useEditor.getState().closeTrackGaps(track.id)
                setMenuOpen(false)
              }}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
            >
              <Minimize2 size={13} />
              <span>Close Gaps</span>
            </button>
            <div className="my-1 border-t border-ink-700" />
            <button
              type="button"
              data-testid="track-add-above"
              onClick={() => {
                createTrack(track.type, 'above', track.id)
                setMenuOpen(false)
              }}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
            >
              <Plus size={13} />
              <span>Add Track Above</span>
            </button>
            <button
              type="button"
              data-testid="track-add-below"
              onClick={() => {
                createTrack(track.type, 'below', track.id)
                setMenuOpen(false)
              }}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
            >
              <Plus size={13} />
              <span>Add Track Below</span>
            </button>
            <div className="my-1 border-t border-ink-700" />
            <div className="px-2 py-1 text-[10px] text-ink-500 uppercase font-semibold">Track Height</div>
            <div className="flex gap-1 px-1 mb-1">
              {[36, 56, 80].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setTrackHeight(track.id, h)
                    setMenuOpen(false)
                  }}
                  className={`flex-1 py-1 rounded text-[10px] text-center ${
                    track.height === h ? 'bg-brand text-white' : 'bg-ink-800 text-ink-300 hover:bg-ink-750'
                  }`}
                >
                  {h === 36 ? 'Sm' : h === 56 ? 'Md' : 'Lg'}
                </button>
              ))}
            </div>
            {tracks.length > 1 && (
              <>
                <div className="my-1 border-t border-ink-700" />
                <button
                  type="button"
                  data-testid="track-delete"
                  onClick={() => {
                    deleteTrack(track.id)
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-red-400 hover:bg-red-500/20 text-left"
                >
                  <Trash2 size={13} />
                  <span>Delete Track</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TransitionView({
  transition,
  px,
  tracks,
  onContextMenu,
}: {
  transition: Transition
  px: number
  tracks: Track[]
  onContextMenu: (e: React.MouseEvent, tr: Transition) => void
}) {
  const selectTransition = useEditor((s) => s.selectTransition)
  const updateTransition = useEditor((s) => s.updateTransition)
  const selectedTransitionId = useEditor((s) => s.selectedTransitionId)
  const isSelected = selectedTransitionId === transition.id

  const track = tracks.find((t) => t.id === transition.trackId)
  if (!track || track.hidden) return null

  const clips = useEditor((s) => s.clips)
  const trackHeight = new TrackModel(track).getEffectiveHeight(clips)
  const top = tracks.slice(0, tracks.indexOf(track)).reduce((a, t) => a + new TrackModel(t).getEffectiveHeight(clips), 0)
  const left = transition.startTime * px
  const width = Math.max(20, transition.duration * px)

  const trimRef = useRef<{ mode: 'left' | 'right'; startX: number; origStart: number; origDur: number } | null>(null)

  const onTrimDown = (mode: 'left' | 'right') => (e: React.PointerEvent) => {
    e.stopPropagation()
    selectTransition(transition.id)
    trimRef.current = {
      mode,
      startX: e.clientX,
      origStart: transition.startTime,
      origDur: transition.duration,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onTrimMove = (e: React.PointerEvent) => {
    if (!trimRef.current) return
    const d = (e.clientX - trimRef.current.startX) / px
    if (trimRef.current.mode === 'left') {
      const newStart = Math.max(0, trimRef.current.origStart + d)
      const newDur = Math.max(0.1, trimRef.current.origDur - d)
      updateTransition(transition.id, { startTime: newStart, duration: newDur })
    } else {
      const newDur = Math.max(0.1, trimRef.current.origDur + d)
      updateTransition(transition.id, { duration: newDur })
    }
  }

  const onTrimUp = (e: React.PointerEvent) => {
    if (trimRef.current) {
      trimRef.current = null
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    }
  }

  return (
    <div
      data-testid="timeline-transition"
      data-transition-id={transition.id}
      data-transition-type={transition.type}
      data-start={transition.startTime.toFixed(4)}
      data-duration={transition.duration.toFixed(4)}
      onClick={(e) => {
        e.stopPropagation()
        selectTransition(transition.id)
      }}
      onContextMenu={(e) => onContextMenu(e, transition)}
      className={[
        'absolute pointer-events-auto rounded border text-[10px] select-none z-20 flex items-center justify-center gap-1 overflow-hidden transition-all',
        isSelected
          ? 'border-amber-400 bg-amber-500/35 text-amber-100 ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
          : 'border-amber-500/60 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200',
      ].join(' ')}
      style={{
        top: top + 4,
        height: trackHeight - 8,
        left,
        width,
      }}
      title={`${transition.type.replace(/_/g, ' ')} (${transition.duration.toFixed(2)}s)`}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,#fbbf24_6px,#fbbf24_12px)]" />
      <Sparkles size={11} className="text-amber-300 relative z-[1] shrink-0" />
      <span className="truncate max-w-[75px] font-semibold uppercase tracking-wider relative z-[1] text-[9px]">
        {transition.type.replace(/_/g, ' ')}
      </span>

      {/* trim handles */}
      <div
        data-testid="transition-trim-left"
        onPointerDown={onTrimDown('left')}
        onPointerMove={onTrimMove}
        onPointerUp={onTrimUp}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-300/40"
      />
      <div
        data-testid="transition-trim-right"
        onPointerDown={onTrimDown('right')}
        onPointerMove={onTrimMove}
        onPointerUp={onTrimUp}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-300/40"
      />
    </div>
  )
}

function ClipView({
  clip,
  asset,
  px,
  tool,
  selected,
  onStartDrag,
  onContextMenu,
}: {
  clip: Clip
  asset?: MediaAsset
  px: number
  tool: 'select' | 'blade'
  selected: boolean
  onStartDrag: (clip: Clip, e: React.PointerEvent) => void
  onContextMenu: (e: React.MouseEvent, clip: Clip) => void
}) {
  const trimClip = useEditor((s) => s.trimClip)
  const selectClip = useEditor((s) => s.selectClip)
  const splitAt = useEditor((s) => s.splitAt)
  const beginHistory = useEditor((s) => s.beginHistory)
  const endHistory = useEditor((s) => s.endHistory)
  const trimRef = useRef<{ mode: 'left' | 'right'; startX: number; origStart: number; origDur: number } | null>(null)

  const onDown = (mode: 'move' | 'left' | 'right') => (e: React.PointerEvent) => {
    const store = useEditor.getState()
    const inGroup = store.selectedClipIds.length > 1 && store.selectedClipIds.includes(clip.id)

    // Right button belongs to the timeline rubber-band lasso: keep a group
    // selection intact, and let the event bubble so the marquee can start.
    if (e.button === 2) {
      if (!inGroup) selectClip(clip.id)
      return
    }
    if (e.button !== 0) return

    e.stopPropagation()
    // Grabbing a member of a gripped group must not collapse the selection to
    // that one clip, otherwise the whole point of the lasso is lost.
    if (!inGroup) selectClip(clip.id)
    if (tool === 'blade' && mode === 'move') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const time = clip.start + (e.clientX - rect.left) / px
      splitAt(time)
      return
    }

    if (mode === 'move') {
      onStartDrag(clip, e)
      return
    }

    beginHistory()
    trimRef.current = { mode, startX: e.clientX, origStart: clip.start, origDur: clip.duration }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onTrimMove = (e: React.PointerEvent) => {
    if (!trimRef.current) return
    const d = (e.clientX - trimRef.current.startX) / px
    // A gripped multi-selection shortens as one unit.
    const trimStore = useEditor.getState()
    const trimGroup =
      trimStore.selectedClipIds.length > 1 && trimStore.selectedClipIds.includes(clip.id)
        ? trimStore.selectedClipIds
        : null
    if (trimGroup) {
      trimStore.trimSelectedClips(trimRef.current.mode, d)
      return
    }
    if (trimRef.current.mode === 'left') {
      trimClip(clip.id, 'left', snapTime(trimRef.current.origStart + d, clip.id))
    } else {
      trimClip(clip.id, 'right', snapTime(trimRef.current.origStart + trimRef.current.origDur + d, clip.id))
    }
  }

  const onTrimUp = (e: React.PointerEvent) => {
    if (trimRef.current) {
      trimRef.current = null
      endHistory()
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    }
  }

  const left = clip.start * px
  const width = Math.max(6, clip.duration * px)
  const isCompound = clip.kind === 'compound'
  const isAudio = clip.kind === 'audio'
  const isText = clip.kind === 'text' || Boolean((clip as any).textStyle)
  const is3D = clip.kind === 'threed'
  const isImage = clip.kind === 'image' || asset?.kind === 'image'
  const isVideo = clip.kind === 'video' || (!isCompound && !isAudio && !isText && !is3D && !isImage)

  const clipBorderClass = selected
    ? isCompound
      ? 'border-2 border-indigo-400 ring-2 ring-indigo-400/90 shadow-[0_0_16px_rgba(129,140,248,0.6)] z-10'
      : isText
      ? 'border-2 border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)] z-10'
      : isAudio
      ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.5)] z-10'
      : isImage
      ? 'border-2 border-purple-400 ring-2 ring-purple-400/80 shadow-[0_0_14px_rgba(192,132,252,0.5)] z-10'
      : is3D
      ? 'border-2 border-fuchsia-400 ring-2 ring-fuchsia-400/80 shadow-[0_0_14px_rgba(232,121,249,0.5)] z-10'
      : 'border-2 border-sky-400 ring-2 ring-sky-400/80 shadow-[0_0_14px_rgba(56,189,248,0.5)] z-10'
    : isCompound
    ? 'border border-indigo-500/80 hover:border-indigo-300 hover:shadow-md'
    : isText
    ? 'border border-amber-600/70 hover:border-amber-400 hover:shadow-md'
    : isAudio
    ? 'border border-emerald-800/70 hover:border-emerald-400 hover:shadow-md'
    : isImage
    ? 'border border-purple-800/70 hover:border-purple-400 hover:shadow-md'
    : is3D
    ? 'border border-fuchsia-800/70 hover:border-fuchsia-400 hover:shadow-md'
    : 'border border-sky-600/70 hover:border-sky-300 hover:shadow-md'

  const clipBgClass = isCompound
    ? 'bg-gradient-to-r from-indigo-950/90 via-purple-950/80 to-indigo-950/90 text-indigo-100'
    : isText
    ? 'bg-amber-950/75 text-amber-100'
    : isAudio
    ? 'bg-emerald-950/70 text-emerald-100'
    : isImage
    ? 'bg-purple-950/65 text-purple-100'
    : is3D
    ? 'bg-fuchsia-950/70 text-fuchsia-100'
    : 'bg-sky-950/65 text-sky-100'

  const visibleWaveform = (() => {
    if (!isAudio || !asset?.waveform?.length) return []
    const sourceDuration = Math.max(asset.duration, 0.001)
    const from = Math.max(0, Math.floor((clip.inPoint / sourceDuration) * asset.waveform.length))
    const to = Math.min(
      asset.waveform.length,
      Math.max(from + 1, Math.ceil(((clip.inPoint + clip.duration) / sourceDuration) * asset.waveform.length)),
    )
    return asset.waveform.slice(from, to)
  })()

  return (
    <div
      data-testid="timeline-clip"
      data-clip-id={clip.id}
      data-kind={clip.kind}
      data-start={clip.start.toFixed(4)}
      data-duration={clip.duration.toFixed(4)}
      data-in-point={clip.inPoint.toFixed(4)}
      data-volume={clip.volume.toFixed(3)}
      data-hidden={clip.hidden ? 'true' : 'false'}
      onPointerDown={onDown('move')}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (clip.kind === 'compound' && clip.sourceSequenceId) {
          useEditor.getState().openSequence(clip.sourceSequenceId)
        }
      }}
      onContextMenu={(e) => onContextMenu(e, clip)}
      className={[
        'absolute top-1 bottom-1 pointer-events-auto rounded-md overflow-hidden text-[11px] select-none transition-[border-color,box-shadow]',
        tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-inherit',
        clipBorderClass,
        clip.hidden
          ? 'opacity-40 border-dashed hover:opacity-65 hover:border-violet-300 hover:shadow-[0_0_12px_rgba(167,139,250,.5)]'
          : '',
        clipBgClass,
      ].join(' ')}
      style={{ left, width }}
      title={clip.name}
    >
      {isCompound && (
        <div className="pointer-events-none absolute inset-0 opacity-15 flex flex-col justify-around py-1 px-1">
          <div className="h-1.5 w-3/4 rounded bg-indigo-400" />
          <div className="h-1.5 w-1/2 rounded bg-purple-400 ml-4" />
          <div className="h-1.5 w-2/3 rounded bg-sky-400" />
        </div>
      )}
      {!isCompound && !isAudio && !isText && (asset?.thumbnail || asset?.kind === 'image') && (
        <div
          data-testid="clip-filmstrip"
          className="pointer-events-none absolute inset-0 opacity-55"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.15),rgba(8,9,13,.15)),url(${asset.kind === 'image' ? asset.url : asset.thumbnail})`,
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'center',
            backgroundSize: 'auto 100%',
          }}
        />
      )}
      {isText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90 px-2 overflow-hidden">
          <span
            className="truncate font-semibold tracking-wide text-center"
            style={{
              color: clip.textStyle?.color || '#fef08a',
              fontFamily: clip.textStyle?.fontFamily || 'sans-serif',
              fontSize: '11px',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {clip.textStyle?.text || clip.name}
          </span>
        </div>
      )}
      {isAudio && visibleWaveform.length > 0 && (
        <div
          data-testid="clip-waveform"
          data-waveform-bins={visibleWaveform.length}
          data-source-offset={clip.inPoint.toFixed(4)}
          data-applied-volume={clip.volume.toFixed(3)}
          className="pointer-events-none absolute inset-x-1 bottom-1 top-5 flex items-center gap-px opacity-80"
          aria-hidden="true"
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-emerald-200/20" />
          {visibleWaveform.map((peak, index) => (
            <i
              key={index}
              data-peak={peak.toFixed(4)}
              className="min-w-px flex-1 rounded-full bg-emerald-400"
              style={{ height: `${clip.volume === 0 ? 1 : Math.max(4, peak * clip.volume * 96)}%` }}
            />
          ))}
        </div>
      )}
      <div className="relative z-[1] px-1.5 py-0.5 truncate text-ink-100 bg-black/40 border-b border-white/5 flex items-center gap-1 min-w-0">
        {clip.hidden ? (
          <EyeOff size={10} aria-label="Hidden clip" />
        ) : isCompound ? (
          <Layers size={10} className="text-indigo-300 shrink-0" />
        ) : isText ? (
          <Type size={10} className="text-amber-400 shrink-0" />
        ) : isAudio ? (
          <Music size={10} className="text-emerald-400 shrink-0" />
        ) : isImage ? (
          <ImageIcon size={10} className="text-purple-400 shrink-0" />
        ) : is3D ? (
          <Box size={10} className="text-fuchsia-400 shrink-0" />
        ) : (
          <Video size={10} className="text-sky-400 shrink-0" />
        )}
        <span className="truncate">{clip.name}</span>
        {isCompound && (
          <span className="ml-auto text-[10px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-mono font-bold shrink-0">
            NESTED ({clip.nestedClipCount || 2})
          </span>
        )}
      </div>
      {!isCompound && !isAudio && !isText && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent" />}

      {/* trim handles */}
      <div
        onPointerDown={onDown('left')}
        onPointerMove={onTrimMove}
        onPointerUp={onTrimUp}
        data-testid="trim-left"
        aria-label={`Trim start of ${clip.name}`}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40 z-20"
      />
      <div
        onPointerDown={onDown('right')}
        onPointerMove={onTrimMove}
        onPointerUp={onTrimUp}
        data-testid="trim-right"
        aria-label={`Trim end of ${clip.name}`}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40 z-20"
      />
    </div>
  )
}

export function Timeline() {
  const renderCount = useRef(0)
  renderCount.current += 1
  const tracks = useEditor((s) => s.tracks)
  const clips = useEditor((s) => s.clips)
  const transitions = useEditor((s) => s.transitions || [])
  const px = useEditor((s) => s.pxPerSec)
  const FPS = useEditor((s) => s.projectFps)
  const dropFrameTimecode = useEditor((s) => s.dropFrameTimecode)
  const duration = useEditor((s) => s.duration)
  const timelineHeight = useEditor((s) => s.timelineHeight)
  const tool = useEditor((s) => s.tool)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const setTool = useEditor((s) => s.setTool)
  const playing = useEditor((s) => s.playing)
  const togglePlay = useEditor((s) => s.togglePlay)
  const speed = useEditor((s) => s.speed)
  const setSpeed = useEditor((s) => s.setSpeed)
  const snapping = useEditor((s) => s.snapping)
  const toggleSnapping = useEditor((s) => s.toggleSnapping)
  const gapSelectMode = useEditor((s) => s.gapSelectMode)

  const setGapSelectMode = useEditor((s) => s.setGapSelectMode)
  const removeGapAt = useEditor((s) => s.removeGapAt)
  const targetedTrackIds = useEditor((s) => s.targetedTrackIds)

  // Counted only while the picker is open, so the banner can tell the user
  // whether there is anything to click before they hunt for it.
  const gapCount = useMemo(() => {
    if (!gapSelectMode) return 0
    return tracks
      .filter((t) => targetedTrackIds.length === 0 || targetedTrackIds.includes(t.id))
      .reduce((n, t) => n + gapsOnTrack(clips, t.id).length, 0)
  }, [gapSelectMode, tracks, clips, targetedTrackIds])
  const setScrubbing = useEditor((s) => s.setScrubbing)
  const splitAt = useEditor((s) => s.splitAt)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const moveClip = useEditor((s) => s.moveClip)
  const moveClipToNewTrack = useEditor((s) => s.moveClipToNewTrack)
  const createTrack = useEditor((s) => s.createTrack)
  const deleteTrack = useEditor((s) => s.deleteTrack)
  const addTransition = useEditor((s) => s.addTransition)
  const updateTransition = useEditor((s) => s.updateTransition)
  const removeTransition = useEditor((s) => s.removeTransition)
  const assets = useEditor((s) => s.assets)
  const setZoom = useEditor((s) => s.setZoom)
  const zoomBy = useEditor((s) => s.zoomBy)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectedClipIds = useEditor((s) => s.selectedClipIds)
  const selectClip = useEditor((s) => s.selectClip)
  const removeClip = useEditor((s) => s.removeClip)
  const insertClipCopy = useEditor((s) => s.insertClipCopy)
  const toggleClipHidden = useEditor((s) => s.toggleClipHidden)
  const markers = useEditor((s) => s.markers)
  const addMarker = useEditor((s) => s.addMarker)
  const setActiveMarkerModalId = useEditor((s) => s.setActiveMarkerModalId)
  const graphEditorOpen = useEditor((s) => s.graphEditorOpen)
  const setGraphEditorOpen = useEditor((s) => s.setGraphEditorOpen)
  const breadcrumbs = useEditor((s) => s.breadcrumbs || [{ id: 'main', name: 'Main Timeline' }])
  const navigateBreadcrumb = useEditor((s) => s.navigateBreadcrumb)

  const handleAddMarker = () => {
    const playheadTime = useEditor.getState().playhead
    const existing = markers.find((m) => Math.abs(m.time - playheadTime) < 0.1)
    if (existing) {
      setActiveMarkerModalId(existing.id)
    } else {
      const id = addMarker({
        time: playheadTime,
        label: `Marker ${markers.length + 1}`,
        color: 'blue',
      })
      setActiveMarkerModalId(id)
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Windows-style rubber-band (right-drag) multi-selection.
  // Hold the right button and sweep a rectangle across the lanes: everything the
  // rectangle touches is highlighted, exactly like lassoing icons on a desktop.
  // The resulting selection then behaves as one gripped group -- it can be
  // deleted, dragged, or shortened as a unit.
  // ---------------------------------------------------------------------------
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeBoxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeOriginRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeMovedRef = useRef(false)
  const marqueeSuppressCtxRef = useRef(false)
  const marqueeActiveRef = useRef(false)
  const [marqueeCount, setMarqueeCount] = useState(0)

  /** Windows rule: a clip counts as selected if the band overlaps it at all. */
  const marqueeHitTest = (box: { x0: number; y0: number; x1: number; y1: number }) => {
    const lanes = lanesRef.current
    if (!lanes) return []
    const base = lanes.getBoundingClientRect()
    const left = Math.min(box.x0, box.x1) + base.left
    const right = Math.max(box.x0, box.x1) + base.left
    const top = Math.min(box.y0, box.y1) + base.top
    const bottom = Math.max(box.y0, box.y1) + base.top
    const hits: string[] = []
    lanes.querySelectorAll<HTMLElement>('[data-clip-id]').forEach((node) => {
      const r = node.getBoundingClientRect()
      if (r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom) {
        const id = node.getAttribute('data-clip-id')
        if (id) hits.push(id)
      }
    })
    return hits
  }

  // Chromium raises `contextmenu` on right-button DOWN, so the menu is already
  // open before a lasso has a chance to begin. Suppressing it here would also
  // kill ordinary right-clicks, so instead we only swallow context menus that
  // arrive while a lasso is genuinely dragging (pointer past the threshold);
  // the menu opened by the initial press is closed via markLassoEngaged below.
  useEffect(() => {
    const onContextMenuCaptureWindow = (e: MouseEvent) => {
      if (!marqueeMovedRef.current) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('contextmenu', onContextMenuCaptureWindow, true)
    return () => window.removeEventListener('contextmenu', onContextMenuCaptureWindow, true)
  }, [])

  const beginMarquee = (e: React.PointerEvent) => {
    const lanes = lanesRef.current
    if (!lanes) return
    marqueeSuppressCtxRef.current = false
    marqueeActiveRef.current = true
    const rect = lanes.getBoundingClientRect()
    const originX = e.clientX - rect.left
    const originY = e.clientY - rect.top
    marqueeOriginRef.current = { x: e.clientX, y: e.clientY }
    marqueeMovedRef.current = false
    const box = { x0: originX, y0: originY, x1: originX, y1: originY }
    marqueeBoxRef.current = box
    // Deliberately no setMarquee here: a press with no movement is a click, not
    // a lasso, so nothing should be painted until the pointer actually travels.
    setMarquee(null)
    setMarqueeCount(0)

    const onMove = (ev: PointerEvent) => {
      if (!marqueeBoxRef.current || !marqueeOriginRef.current) return
      if (!marqueeMovedRef.current) {
        const dist = Math.hypot(ev.clientX - marqueeOriginRef.current.x, ev.clientY - marqueeOriginRef.current.y)
        if (dist < 4) return // below threshold this is a click, not a lasso
        marqueeMovedRef.current = true
        // The right-press already opened a context menu; dismiss it now that
        // this gesture is unambiguously a lasso.
        useEditor.getState().markLassoEngaged()
      }
      const lanesEl = lanesRef.current
      if (!lanesEl) return
      const r = lanesEl.getBoundingClientRect()
      const next = { x0: originX, y0: originY, x1: ev.clientX - r.left, y1: ev.clientY - r.top }
      marqueeBoxRef.current = next
      setMarquee(next)
      const hits = marqueeHitTest(next)
      setMarqueeCount(hits.length)
      useEditor.getState().selectClips(hits)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const box = marqueeBoxRef.current
      if (marqueeMovedRef.current && box) {
        const hits = marqueeHitTest(box)
        useEditor.getState().selectClips(hits)
        setMarqueeCount(hits.length)
        // The browser raises `contextmenu` right after pointerup; swallow it so
        // completing a lasso does not pop the menu open. The flag is consumed
        // by that event (see onContextMenuCapture) rather than expiring on a
        // timer alone: a slow frame can push the event past any fixed window,
        // which is exactly the bug this suppression is meant to prevent. The
        // timeout is only a backstop for browsers that never raise the event.
        marqueeSuppressCtxRef.current = true
        setTimeout(() => {
          marqueeSuppressCtxRef.current = false
        }, 1000)
      }
      marqueeActiveRef.current = false
      marqueeBoxRef.current = null
      marqueeOriginRef.current = null
      setMarquee(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Delete / Backspace removes the whole gripped selection, not just the anchor.
  useEffect(() => {
    const onDeleteKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return
      const st = useEditor.getState()
      const ids = st.selectedClipIds || []
      if (ids.length <= 1) return // single-clip delete is handled by Studio
      ev.preventDefault()
      ids.forEach((id) => st.removeClip(id))
      st.selectClips([])
    }
    window.addEventListener('keydown', onDeleteKey)
    return () => window.removeEventListener('keydown', onDeleteKey)
  }, [])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewW, setViewW] = useState(900)
  const seeking = useRef(false)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [customSpeed, setCustomSpeed] = useState(Math.abs(speed))
  const toolButtonRef = useRef<HTMLButtonElement>(null)
  const speedButtonRef = useRef<HTMLButtonElement>(null)

  // Drag state for clip movement & vertical track creation
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    type: 'clip' | 'transition' | 'empty-track'
    x: number
    y: number
    clip?: Clip
    transition?: Transition
    trackId?: string
  } | null>(null)

  useEffect(() => {
    if (!toolMenuOpen && !speedMenuOpen && !contextMenu) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (
        target.closest(
          '[data-testid="tool-menu"], [data-testid="speed-menu"], [data-testid="tool-menu-button"], [data-testid="speed-menu-button"], [data-testid="timeline-context-menu"]',
        )
      )
        return
      setToolMenuOpen(false)
      setSpeedMenuOpen(false)
      setContextMenu(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolMenuOpen(false)
        setSpeedMenuOpen(false)
        setContextMenu(null)
      }
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', escape)
    }
  }, [toolMenuOpen, speedMenuOpen, contextMenu])

  const contentWidth = Math.max(duration, 20) * px + 80
  const totalHeight = tracks.reduce((a, t) => a + new TrackModel(t).getEffectiveHeight(clips), 0)
  const hasVideo = clips.some((clip) => clip.kind === 'video' || clip.kind === 'image')
  const hasAudio = clips.some((clip) => clip.kind === 'audio')
  const mediaMode = hasVideo && hasAudio ? 'Video + Audio' : hasVideo ? 'Video' : hasAudio ? 'Audio' : 'Empty'

  useEffect(() => {
    const onClipboardKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (!(event.ctrlKey || event.metaKey)) return
      const selected = useEditor.getState().clips.find((clip) => clip.id === useEditor.getState().selectedClipId)
      const key = event.key.toLowerCase()
      if ((key === 'c' || key === 'x') && selected) {
        event.preventDefault()
        writeClipClipboard(selected)
        if (key === 'x') removeClip(selected.id)
      } else if (key === 'v' && readClipClipboard()) {
        event.preventDefault()
        insertClipCopy(readClipClipboard()!, useEditor.getState().playhead)
      } else if (key === 'd' && selected) {
        event.preventDefault()
        insertClipCopy(selected, selected.start + selected.duration)
      }
    }
    window.addEventListener('keydown', onClipboardKey)
    return () => window.removeEventListener('keydown', onClipboardKey)
  }, [insertClipCopy, removeClip])

  const fitZoom = () => {
    const el = scrollRef.current
    if (!el) return
    const w = el.clientWidth - HEADER_W - 40
    setZoom(Math.max(8, w / Math.max(duration, 10)))
    el.scrollLeft = 0
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      setScrollLeft(el.scrollLeft)
      setViewW(el.clientWidth)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const cursorX = event.clientX - rect.left - HEADER_W
      const timeAtCursor = (el.scrollLeft + cursorX) / px
      const factor = event.deltaY < 0 ? 1.12 : 0.89
      const next = clamp(px * factor, 8, MAX_PX)
      setZoom(next)
      requestAnimationFrame(() => {
        el.scrollLeft = timeAtCursor * next - cursorX
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [px, setZoom])

  const seekFromClientX = (clientX: number) => {
    const el = lanesRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPlayhead((clientX - rect.left) / px)
  }

  // Keep the scroll position inside the content after a zoom change.
  //
  // Zooming out shrinks the scrollable width, but a scroll position set while
  // zoomed in is kept as-is, so the clips end up far off to the left with no
  // visible content on screen and no way back except manual scrolling. Anchor
  // the left edge of the viewport to the same time it was showing before.
  const prevPxRef = useRef(px)
  useEffect(() => {
    const el = scrollRef.current
    const prevPx = prevPxRef.current
    prevPxRef.current = px
    if (!el || prevPx === px || prevPx <= 0) return
    const anchoredLeft = (el.scrollLeft / prevPx) * px
    el.scrollLeft = Math.max(0, Math.min(anchoredLeft, Math.max(0, el.scrollWidth - el.clientWidth)))
  }, [px])

  // Active clip drag listeners with threshold-based click vs drag state machine & auto-scroll
  const startClipDrag = (clip: Clip, e: React.PointerEvent) => {
    const lanes = lanesRef.current
    if (!lanes) return
    // Clips in the gripped group move together and must not be offered to the
    // snapper: a clip that can snap to itself (or to a sibling it is being
    // dragged along with) sticks instead of tracking the pointer.
    const selected = useEditor.getState().selectedClipIds
    const dragGroupIds: ReadonlySet<string> =
      selected.length > 1 && selected.includes(clip.id) ? new Set(selected) : new Set([clip.id])
    const startX = e.clientX
    const startY = e.clientY
    // Where inside the clip the pointer went down. Without this the clip's
    // start is set to the pointer's absolute time, so grabbing a clip anywhere
    // but its left edge teleports it sideways the moment you start dragging.
    const lanesRectAtStart = lanes.getBoundingClientRect()
    const grabOffset = (startX - lanesRectAtStart.left) / px - clip.start
    let hasMoved = false
    let autoScrollRaf: number | null = null
    let latestClientX = startX
    let latestClientY = startY

    const stepAutoScroll = () => {
      const scrollEl = scrollRef.current
      const lanesEl = lanesRef.current
      if (hasMoved && scrollEl && lanesEl) {
        const containerRect = scrollEl.getBoundingClientRect()
        const auto = TimelineController.calculateAutoScroll(latestClientX, containerRect, HEADER_W)
        if (auto.shouldScroll) {
          scrollEl.scrollLeft += auto.deltaX

          const lanesRect = lanesEl.getBoundingClientRect()
          const pointerTime = (latestClientX - lanesRect.left) / px
          const candidateTime = Math.max(0, snapPlacement(pointerTime - grabOffset, clip.duration, dragGroupIds))
          const evaluatedTarget = evaluateDragTarget(latestClientY, lanesEl, tracks, clip.kind)

          const updated: DragState = {
            clipId: clip.id,
            clipName: clip.name,
            kind: clip.kind,
            origStart: clip.start,
            origDuration: clip.duration,
            origTrackId: clip.trackId,
            startX,
            startY,
            curTime: candidateTime,
            target: evaluatedTarget,
          }
          dragRef.current = updated
          setDragState(updated)
        }
      }
      autoScrollRaf = requestAnimationFrame(stepAutoScroll)
    }

    autoScrollRaf = requestAnimationFrame(stepAutoScroll)

    const onPointerMove = (moveEv: PointerEvent) => {
      latestClientX = moveEv.clientX
      latestClientY = moveEv.clientY
      const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY)
      if (!hasMoved) {
        if (dist < 5) return // Drag threshold: remain in click mode under 5px
        hasMoved = true
      }

      const lanesRect = lanes.getBoundingClientRect()
      const pointerTime = (moveEv.clientX - lanesRect.left) / px
      const candidateTime = Math.max(0, snapPlacement(pointerTime - grabOffset, clip.duration, dragGroupIds))
      const evaluatedTarget = evaluateDragTarget(moveEv.clientY, lanes, tracks, clip.kind)
      const updated: DragState = {
        clipId: clip.id,
        clipName: clip.name,
        kind: clip.kind,
        origStart: clip.start,
        origDuration: clip.duration,
        origTrackId: clip.trackId,
        startX,
        startY,
        curTime: candidateTime,
        target: evaluatedTarget,
      }
      dragRef.current = updated
      setDragState(updated)
    }

    const onPointerUp = () => {
      if (autoScrollRaf !== null) {
        cancelAnimationFrame(autoScrollRaf)
        autoScrollRaf = null
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)

      if (!hasMoved) {
        // Pure click: select clip without moving or rippling
        selectClip(clip.id)
        dragRef.current = null
        setDragState(null)
        return
      }

      const final = dragRef.current
      dragRef.current = null
      setDragState(null)
      if (!final) return

      const { mode, trackId, referenceTrackId } = final.target
      const clipType: 'audio' | 'video' = final.kind === 'audio' ? 'audio' : 'video'

      // Gripped group: shift every member by the same delta. Each clip stays on
      // its own track so the arrangement survives the move.
      const dragGroup = useEditor.getState().selectedClipIds
      if (dragGroup.length > 1 && dragGroup.includes(final.clipId)) {
        useEditor.getState().moveSelectedClips(final.curTime - final.origStart)
        return
      }

      if (mode === 'dock' && trackId) {
        moveClip(final.clipId, final.curTime, trackId)
      } else if ((mode === 'above' || mode === 'below' || mode === 'between') && referenceTrackId) {
        moveClipToNewTrack(
          final.clipId,
          final.curTime,
          clipType,
          mode === 'above' ? 'above' : 'below',
          referenceTrackId,
        )
      } else {
        moveClip(final.clipId, final.curTime, final.origTrackId)
      }
    }

    const onKeyDown = (keyEv: KeyboardEvent) => {
      if (keyEv.key === 'Escape') {
        if (autoScrollRaf !== null) {
          cancelAnimationFrame(autoScrollRaf)
          autoScrollRaf = null
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('keydown', onKeyDown)
        dragRef.current = null
        setDragState(null)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
  }

  // Ruler ticks are bounded to the visible window and derived from the same
  // time-to-pixel scale used by clips, seeking, and the playhead.
  const tStart = Math.max(0, scrollLeft / px)
  const tEnd = (scrollLeft + viewW - HEADER_W) / px
  const frameW = px / FPS
  const frameMode = frameW >= 10
  type Tick = { t: number; label?: string; major: boolean }
  const ticks: Tick[] = []
  if (frameMode) {
    const f0 = Math.floor(tStart * FPS)
    const f1 = Math.ceil(tEnd * FPS)
    for (let f = f0; f <= f1; f++) {
      const t = f / FPS
      const frame = f - Math.floor(t) * FPS
      const major = frame === 0
      let label: string | undefined
      if (major) label = formatTimecode(t, FPS, dropFrameTimecode)
      else if (frameW >= 32 && (frameW >= 64 || frame % (frameW >= 64 ? 1 : 5) === 0)) label = String(frame)
      ticks.push({ t, label, major })
    }
  } else {
    const interval = chooseTickInterval(px, 72, FPS)
    const minor = interval / (interval * px < 120 ? 2 : 5)
    for (let t = Math.floor(tStart / interval) * interval; t <= tEnd; t += interval) {
      ticks.push({ t, label: formatRulerLabel(t, interval, FPS, dropFrameTimecode), major: true })
    }
    for (let t = Math.floor(tStart / minor) * minor; t <= tEnd; t += minor) {
      if (!ticks.some((x) => Math.abs(x.t - t) < 1e-6)) ticks.push({ t, major: false })
    }
  }

  return (
    <div
      data-testid="timeline"
      data-px-per-second={px.toFixed(4)}
      data-project-fps={FPS}
      data-drop-frame={dropFrameTimecode ? 'true' : 'false'}
      data-render-count={renderCount.current}
      style={{
        height: timelineHeight > 0 ? `${timelineHeight}px` : '0px',
        display: timelineHeight === 0 ? 'none' : 'flex',
      }}
      className={`shrink-0 flex flex-col bg-ink-900 border-t border-ink-700 select-none ${
        tool === 'blade' ? 'of-blade-tool' : 'of-select-tool'
      }`}
    >
      {/* Sequence Breadcrumbs Bar */}
      <div
        data-testid="sequence-breadcrumbs-bar"
        className="shrink-0 flex items-center justify-between px-3 py-1 bg-ink-950 border-b border-ink-800 text-xs select-none"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {breadcrumbs.map((b, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <div key={b.id} className="flex items-center gap-1.5">
                {idx > 0 && <ChevronRight size={12} className="text-ink-500" />}
                <button
                  type="button"
                  data-testid={`breadcrumb-item-${b.id}`}
                  onClick={() => navigateBreadcrumb(b.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 min-h-[24px] rounded transition-colors ${
                    isLast
                      ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-xs'
                      : 'text-ink-400 hover:text-ink-100 hover:bg-ink-850'
                  }`}
                >
                  {idx === 0 ? <Film size={12} className="text-brand-400 shrink-0" /> : <Layers size={12} className="text-indigo-400 shrink-0" />}
                  <span className="truncate max-w-[160px]" title={b.name}>{b.name}</span>
                </button>
              </div>
            )
          })}
        </div>

        {breadcrumbs.length > 1 && (
          <button
            type="button"
            data-testid="breadcrumb-back-button"
            aria-label="Back to parent timeline"
            onClick={() => navigateBreadcrumb(breadcrumbs[breadcrumbs.length - 2].id)}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded bg-ink-800 hover:bg-ink-750 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-medium transition-colors shadow-xs shrink-0"
            title="Exit Compound Clip to Parent Timeline"
          >
            <ArrowLeft size={12} className="shrink-0" />
            <span className="hidden sm:inline">Back to Timeline</span>
          </button>
        )}
      </div>

      {/* transport + tools + zoom */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-ink-800 bg-ink-900 overflow-x-auto">
        {/* transport */}
        <div className="flex items-center gap-1">
          <IconButton title="Go to start (Home)" onClick={() => setPlayhead(0)}>
            <SkipBack size={16} />
          </IconButton>
          <IconButton title={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={togglePlay}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </IconButton>
          <IconButton title="Go to end (End)" onClick={() => setPlayhead(duration)}>
            <SkipForward size={16} />
          </IconButton>
        </div>
        <div className="px-2 font-mono text-sm tabular-nums whitespace-nowrap">
          <LiveTimecode />
          <span className="text-ink-500"> / {formatTimecode(duration)}</span>
        </div>
        <button
          ref={speedButtonRef}
          type="button"
          data-testid="speed-menu-button"
          title="Playback speed"
          aria-expanded={speedMenuOpen}
          onClick={() => {
            setToolMenuOpen(false)
            setSpeedMenuOpen((open) => !open)
          }}
          className="flex h-8 min-w-[66px] items-center justify-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200 hover:bg-ink-700"
        >
          <Gauge size={15} />
          <span className="tabular-nums">{Math.abs(speed).toFixed(Math.abs(speed) % 1 ? 2 : 0)}×</span>
          <ChevronDown size={12} />
        </button>

        <div className="w-px h-6 bg-ink-700" />

        {/* edit tools */}
        <button
          type="button"
          data-testid="timeline-split-btn"
          title="Split at playhead (Ctrl+B / B)"
          aria-label="Split at playhead"
          onClick={() => splitAt(useEditor.getState().playhead)}
          className="grid place-items-center h-8 w-8 shrink-0 rounded-md border border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-white transition-colors"
        >
          <Scissors size={15} />
        </button>
        <button
          ref={toolButtonRef}
          type="button"
          data-testid="tool-menu-button"
          title="Editing tools"
          aria-expanded={toolMenuOpen}
          onClick={() => {
            setSpeedMenuOpen(false)
            setToolMenuOpen((open) => !open)
          }}
          className="flex h-8 min-w-[36px] items-center justify-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-1.5 text-ink-200 hover:bg-ink-700"
        >
          {tool === 'select' ? <MousePointer2 size={15} /> : <Slash size={15} />}
          <ChevronDown size={11} />
        </button>

        <div className="w-px h-6 bg-ink-700" />

        {/* Universal tools: target tracks, then close or hand-pick gaps. */}
        <TrackTargetMenu />

        <button
          type="button"
          data-testid="gap-select-mode-btn"
          title={
            gapSelectMode
              ? 'Exit Select Gaps (Esc)'
              : 'Select Gaps — click any gap to remove it (Shift+G)'
          }
          aria-pressed={gapSelectMode}
          onClick={() => setGapSelectMode(!gapSelectMode)}
          className={
            'flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs transition-colors ' +
            (gapSelectMode
              ? 'border-amber-400 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
              : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-white')
          }
        >
          <Trash2 size={14} />
          <span className="hidden lg:inline">Select Gaps</span>
        </button>

        {/* marker button */}

        <button
          type="button"
          data-testid="add-marker-btn"
          title="Add Marker at playhead (M)"
          aria-label="Add marker"
          onClick={handleAddMarker}
          className="grid place-items-center h-8 w-8 shrink-0 rounded-md border border-ink-700 bg-ink-800 text-blue-400 hover:bg-ink-700 hover:text-blue-300 transition-colors"
        >
          <Bookmark size={15} />
        </button>

        <div className="flex-1 min-w-[12px]" />

        {/* Audio VU Meter & Master Volume */}
        <AudioMeter />

        {/* zoom group */}
        <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-md border border-ink-700 bg-ink-800">
          <IconButton title="Zoom out" onClick={() => zoomBy(0.8)} className="rounded-none border-r border-ink-700">
            <ZoomOut size={15} />
          </IconButton>
          <div className="relative flex h-full items-center px-2">
            <input
              type="range"
              data-testid="timeline-scale"
              aria-label="Timeline zoom"
              className="of-range w-20 sm:w-28"
              min={8}
              max={MAX_PX}
              value={px}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <i
              aria-hidden="true"
              title="Fit point"
              className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/60"
              style={{
                left: `${
                  8 +
                  ((Math.max(8, (viewW - HEADER_W - 40) / Math.max(duration, 10)) - 8) / (MAX_PX - 8)) * 100
                }%`,
              }}
            />
          </div>
          <IconButton title="Zoom in" onClick={() => zoomBy(1.25)} className="rounded-none border-l border-ink-700">
            <ZoomIn size={15} />
          </IconButton>
          <IconButton title="Fit" onClick={fitZoom} className="rounded-none border-l border-ink-700">
            <Maximize size={15} />
          </IconButton>
        </div>
        <button
          type="button"
          data-testid="snapping-toggle"
          title={`Snapping: ${snapping ? 'ON' : 'OFF'} (S)`}
          aria-label="Toggle snapping"
          aria-pressed={snapping}
          onClick={toggleSnapping}
          className={`grid place-items-center h-8 w-8 rounded-md border transition-colors ${
            snapping
              ? 'border-brand/60 bg-brand/15 text-violet-200'
              : 'border-ink-700 bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-white'
          }`}
        >
          <Magnet size={15} />
        </button>
        <button
          type="button"
          data-testid="toggle-graph-editor-btn"
          title={`Graph Editor / Curves (${graphEditorOpen ? 'Active' : 'Hidden'})`}
          aria-pressed={graphEditorOpen}
          onClick={() => setGraphEditorOpen(!graphEditorOpen)}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
            graphEditorOpen
              ? 'border-brand/60 bg-brand/20 text-white font-medium shadow-xs'
              : 'border-ink-700 bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-white'
          }`}
        >
          <Activity size={15} className={graphEditorOpen ? 'text-brand-400' : ''} />
          <span className="hidden xl:inline">Curves</span>
        </button>
        <span className="text-[10px] text-ink-500 whitespace-nowrap">
          {px.toFixed(0)} px/s{frameMode ? ' · frame' : ''}
        </span>
      </div>

      {toolMenuOpen && (
        <div
          data-testid="tool-menu"
          role="menu"
          className="fixed z-[90] w-44 rounded-lg border border-ink-600 bg-ink-850 p-1.5 shadow-2xl"
          style={{
            left: Math.min(toolButtonRef.current?.getBoundingClientRect().left ?? 8, window.innerWidth - 184),
            top: (toolButtonRef.current?.getBoundingClientRect().bottom ?? 48) + 4,
          }}
        >
          {[
            { id: 'select' as const, label: 'Select', key: 'V', icon: MousePointer2 },
            { id: 'blade' as const, label: 'Blade', key: 'B', icon: Slash },
          ].map((item) => (
            <button
              key={item.id}
              role="menuitemradio"
              aria-checked={tool === item.id}
              onClick={() => {
                setTool(item.id)
                setToolMenuOpen(false)
              }}
              className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-xs ${
                tool === item.id ? 'bg-brand/15 text-violet-200' : 'text-ink-300 hover:bg-ink-700'
              }`}
            >
              <item.icon size={15} />
              <span>{item.label}</span>
              <kbd className="ml-auto text-[10px] text-ink-500">{item.key}</kbd>
            </button>
          ))}
        </div>
      )}

      {speedMenuOpen && (
        <div
          data-testid="speed-menu"
          className="fixed z-[90] w-[min(224px,calc(100vw-16px))] rounded-lg border border-ink-600 bg-ink-850 p-2 shadow-2xl"
          style={{
            left: Math.max(8, Math.min(speedButtonRef.current?.getBoundingClientRect().left ?? 8, window.innerWidth - 232)),
            top: (speedButtonRef.current?.getBoundingClientRect().bottom ?? 48) + 4,
          }}
        >
          <div className="grid grid-cols-3 gap-1">
            {[0.5, 1, 2].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setSpeed(value)
                  setCustomSpeed(value)
                }}
                className={`h-8 rounded-md text-xs ${
                  Math.abs(speed) === value ? 'bg-brand text-white' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
                }`}
              >
                {value}×
              </button>
            ))}
          </div>
          <label className="mt-2 block text-[10px] text-ink-400">
            <span className="mb-1 flex justify-between">
              <span>Custom</span>
              <output>{customSpeed.toFixed(2)}×</output>
            </span>
            <input
              aria-label="Custom playback speed"
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={customSpeed}
              onChange={(event) => {
                const value = Number(event.target.value)
                setCustomSpeed(value)
                setSpeed(value)
              }}
              className="of-range w-full"
            />
          </label>
          <div className="mt-1 text-[9px] text-ink-500">Safe range: 0.10×–4.00×</div>
        </div>
      )}

      {/* body */}
      {graphEditorOpen ? (
        <GraphEditor />
      ) : (
        <div ref={scrollRef} tabIndex={0} aria-label="Timeline tracks, scrollable" className="flex-1 min-h-0 overflow-auto relative">
        <div className="flex min-w-max relative">
          {/* left: track headers */}
          <div className="w-[168px] shrink-0 sticky left-0 z-40 bg-ink-900 border-r border-ink-800 shadow-sm">
            <div className="h-[28px] border-b border-ink-800 bg-ink-900 flex items-center px-2">
              <span data-testid="timeline-media-mode" className="truncate text-[10px] font-medium text-ink-400">
                {mediaMode}
              </span>
            </div>
            {tracks.map((t, idx) => (
              <TrackHeader key={t.id} track={t} tracks={tracks} index={idx} />
            ))}
          </div>

          {/* right: ruler + lanes */}
          <div className="relative" style={{ width: contentWidth }}>
            {/* ruler */}
            <div
              data-testid="timeline-ruler"
              className="h-[28px] sticky top-0 z-10 bg-ink-850 border-b border-ink-800 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                seeking.current = true
                setScrubbing(true)
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                seekFromClientX(e.clientX)
              }}
              onPointerMove={(e) => {
                if (seeking.current) seekFromClientX(e.clientX)
              }}
              onPointerUp={(e) => {
                seeking.current = false
                setScrubbing(false)
                try {
                  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                } catch {
                  /* noop */
                }
              }}
              onPointerCancel={() => {
                seeking.current = false
                setScrubbing(false)
              }}
            >
              {/* Adaptive visible-range major and minor ticks. */}
              {ticks.map((tk, i) => (
                <div
                  key={i}
                  data-testid="ruler-tick"
                  data-time={tk.t.toFixed(6)}
                  data-major={tk.major ? 'true' : 'false'}
                  className={`absolute bottom-0 top-0 w-px ${tk.major ? 'bg-ink-600' : 'bg-ink-700'}`}
                  style={{ left: tk.t * px }}
                >
                  {tk.label && (
                    <span
                      data-testid="ruler-label"
                      className={`absolute top-1 left-1 text-[9px] tabular-nums ${
                        tk.major ? 'text-ink-300 font-medium' : 'text-ink-500'
                      }`}
                    >
                      {tk.label}
                    </span>
                  )}
                </div>
              ))}

              {/* Sequence Timeline Markers */}
              {markers.map((marker) => {
                const markerLeft = marker.time * px
                const markerWidth = marker.duration ? Math.max(4, marker.duration * px) : 0
                const colorHex =
                  marker.color === 'green'
                    ? '#10b981'
                    : marker.color === 'red'
                    ? '#ef4444'
                    : marker.color === 'yellow'
                    ? '#f59e0b'
                    : marker.color === 'purple'
                    ? '#a855f7'
                    : marker.color === 'orange'
                    ? '#f97316'
                    : '#3b82f6'

                return (
                  <div
                    key={marker.id}
                    data-testid="timeline-marker"
                    data-marker-id={marker.id}
                    data-marker-color={marker.color}
                    data-marker-time={marker.time.toFixed(3)}
                    title={`${marker.label} (${formatTimecode(marker.time, FPS, dropFrameTimecode)})${marker.notes ? `\n${marker.notes}` : ''}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPlayhead(marker.time)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setActiveMarkerModalId(marker.id)
                    }}
                    className="absolute top-0 z-20 cursor-pointer group"
                    style={{ left: markerLeft }}
                  >
                    {/* Duration span ribbon */}
                    {markerWidth > 0 && (
                      <div
                        className="absolute top-0 h-[28px] opacity-25 pointer-events-none"
                        style={{
                          width: markerWidth,
                          backgroundColor: colorHex,
                        }}
                      />
                    )}

                    {/* Flag pin */}
                    <div
                      className="relative w-3.5 h-4 flex items-center justify-center -ml-1.5 transition-transform group-hover:scale-125"
                      style={{ color: colorHex }}
                    >
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                        <path d="M0 0 H12 L7 6 L12 12 H0 Z" />
                      </svg>
                    </div>

                    {/* Marker label pill */}
                    <span
                      title={marker.label}
                      className="absolute top-4 left-1 text-[10px] font-semibold px-1 py-0.2 rounded shadow-sm pointer-events-none whitespace-nowrap opacity-90 group-hover:opacity-100 truncate max-w-[80px]"
                      style={{ backgroundColor: colorHex, color: readableTextColor(colorHex) }}
                    >
                      {marker.label}
                    </span>
                  </div>
                )
              })}

              {/* Imperative marker */}
              <PlayheadMarker px={px} handle />
            </div>

            {/* Select Gaps mode banner */}
            {gapSelectMode && (
              <div
                data-testid="gap-select-banner"
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-400/40 text-[11px] text-amber-100"
              >
                <Trash2 size={12} className="shrink-0 text-amber-300" />
                <span className="font-semibold">Select Gaps</span>
                <span className="text-amber-100/70 truncate">
                  {gapCount > 0
                    ? `Click any hatched gap to close it. ${gapCount} found.`
                    : 'No gaps on the targeted tracks.'}
                </span>
                <button
                  type="button"
                  data-testid="gap-select-done"
                  onClick={() => setGapSelectMode(false)}
                  className="ml-auto shrink-0 px-2 py-0.5 rounded border border-amber-400/50 hover:bg-amber-400/20 text-amber-100 transition-colors"
                >
                  Done (Esc)
                </button>
              </div>
            )}

            {/* lanes */}
            <div
              ref={lanesRef}
              data-testid="timeline-lanes"
              data-drop-target="true"
              className="relative"
              style={{ height: totalHeight }}
              onPointerDown={(e) => {
                // A new interaction always re-arms the menu; without this the
                // suppression could linger and swallow a later, legitimate
                // right-click.
                marqueeSuppressCtxRef.current = false
                if (e.button === 2) beginMarquee(e)
              }}
              onContextMenuCapture={(e) => {
                if (marqueeSuppressCtxRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  marqueeSuppressCtxRef.current = false
                }
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-omniframe-asset')) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={(e) => {
                const assetId = e.dataTransfer.getData('application/x-omniframe-asset')
                const asset = assets.find((a) => a.id === assetId)
                const lanes = lanesRef.current
                if (!asset || !lanes) return
                e.preventDefault()
                const rect = lanes.getBoundingClientRect()
                const expectedType = asset.kind === 'audio' ? 'audio' : 'video'
                const target = evaluateDragTarget(e.clientY, lanes, tracks, asset.kind)
                let trackId: string
                if (target.mode === 'above' && target.referenceTrackId) {
                  trackId = useEditor.getState().createTrack(expectedType, 'above', target.referenceTrackId)
                } else if (target.mode === 'below' && target.referenceTrackId) {
                  trackId = useEditor.getState().createTrack(expectedType, 'below', target.referenceTrackId)
                } else if (target.mode === 'dock' && target.trackId) {
                  trackId = target.trackId
                } else {
                  trackId = useEditor.getState().ensureTrack(expectedType)
                }
                addClipToTrack(trackId, assetId, Math.max(0, (e.clientX - rect.left) / px))
              }}
            >
              {tracks.map((tr) => {
                const laneHeight = new TrackModel(tr).getEffectiveHeight(clips)
                return (
                  <div
                    key={tr.id}
                    data-testid={`track-lane-${tr.id}`}
                    className="relative border-b border-ink-800 bg-ink-900/40"
                    style={{ height: laneHeight }}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) seekFromClientX(e.clientX)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({
                        type: 'empty-track',
                        x: e.clientX,
                        y: e.clientY,
                        trackId: tr.id,
                      })
                    }}
                  >
                    {/* subtle row striping for readability */}
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_39px,rgba(255,255,255,0.02)_40px)] pointer-events-none" />
                  </div>
                )
              })}

              {/* clips layer */}
              <div className="absolute inset-0 pointer-events-none">
                {clips.map((c) => {
                  const tr = tracks.find((t) => t.id === c.trackId)
                  if (!tr) return null
                  const top = tracks.slice(0, tracks.indexOf(tr)).reduce((a, t) => a + new TrackModel(t).getEffectiveHeight(clips), 0)
                  const laneHeight = new TrackModel(tr).getEffectiveHeight(clips)
                  return (
                    <div key={c.id} className="absolute inset-x-0 pointer-events-none" style={{ top, height: laneHeight }}>
                      <ClipView
                        clip={c}
                        asset={assets.find((asset) => asset.id === c.assetId)}
                        px={px}
                        tool={tool}
                        selected={c.id === selectedClipId || selectedClipIds.includes(c.id)}
                        onStartDrag={startClipDrag}
                        onContextMenu={(e, clp) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({
                            type: 'clip',
                            x: e.clientX,
                            y: e.clientY,
                            clip: clp,
                          })
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Gap picker overlay. Only mounted in Select Gaps mode, so the
                  lanes stay uncluttered and unclickable the rest of the time. */}
              {gapSelectMode && (
                <div className="absolute inset-0 pointer-events-none z-20" data-testid="gap-select-overlay">
                  {tracks.flatMap((tr) => {
                    const idx = tracks.indexOf(tr)
                    const top = tracks
                      .slice(0, idx)
                      .reduce((a, t) => a + new TrackModel(t).getEffectiveHeight(clips), 0)
                    const laneHeight = new TrackModel(tr).getEffectiveHeight(clips)
                    const inScope =
                      targetedTrackIds.length === 0 || targetedTrackIds.includes(tr.id)
                    if (!inScope) return []
                    return gapsOnTrack(clips, tr.id).map((g) => {
                      const w = Math.max(16, g.duration * px)
                      return (
                        <button
                          key={`${tr.id}-${g.index}`}
                          type="button"
                          data-testid={`gap-block-${tr.id}-${g.index}`}
                          title={`Remove this ${g.duration.toFixed(2)}s gap`}
                          aria-label={`Remove ${g.duration.toFixed(2)} second gap`}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeGapAt(tr.id, g.index)
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute group rounded-[3px] border border-dashed border-amber-400/50 overflow-hidden transition-colors hover:border-amber-300 hover:bg-amber-400/20 pointer-events-auto"
                          style={{
                            top: top + 4,
                            height: Math.max(18, laneHeight - 8),
                            left: g.start * px,
                            width: w,
                            backgroundColor: 'rgba(251,191,36,0.07)',
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(251,191,36,0.20) 0 5px, transparent 5px 10px)',
                          }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-1 h-full text-amber-200 group-hover:text-amber-100">
                            <Trash2 size={11} className="shrink-0" />
                            {w > 54 && (
                              <span className="font-mono text-[9px] leading-none">
                                {g.duration.toFixed(2)}s
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })
                  })}
                </div>
              )}

              {/* Transitions layer */}
              <div className="absolute inset-0 pointer-events-none">
                {transitions.map((tr) => (
                  <TransitionView
                    key={tr.id}
                    transition={tr}
                    px={px}
                    tracks={tracks}
                    onContextMenu={(e, item) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({
                        type: 'transition',
                        x: e.clientX,
                        y: e.clientY,
                        transition: item,
                      })
                    }}
                  />
                ))}
              </div>

              {/* Windows-style rubber-band lasso drawn while right-dragging */}

              {marquee && (

                <div

                  data-testid="timeline-marquee"

                  data-marquee-count={marqueeCount}

                  className="absolute z-40 pointer-events-none"

                  style={{

                    left: Math.min(marquee.x0, marquee.x1),

                    top: Math.min(marquee.y0, marquee.y1),

                    width: Math.abs(marquee.x1 - marquee.x0),

                    height: Math.abs(marquee.y1 - marquee.y0),

                    background: 'rgba(9,13,24,0.45)',

                    border: '1px solid rgba(125,211,252,0.9)',

                    boxShadow: 'inset 0 0 0 1px rgba(3,7,18,0.5)',

                  }}

                >

                  <span className="absolute -top-4 left-0 px-1 rounded bg-sky-500 text-white font-mono text-[9px] whitespace-nowrap shadow">

                    {marqueeCount} selected

                  </span>

                </div>

              )}


              {/* Vertical Insertion Boundary Line (Ripple Push Guide) */}
              {dragState && dragState.target.mode === 'dock' && (
                <div
                  data-testid="timeline-insertion-line"
                  className="absolute top-0 bottom-0 w-0.5 bg-brand z-30 pointer-events-none shadow-[0_0_12px_#8b5cf6]"
                  style={{ left: dragState.curTime * px }}
                >
                  <span className="absolute -top-3 -translate-x-1/2 px-1.5 py-0.5 rounded bg-brand text-white font-mono text-[9px] shadow-md whitespace-nowrap">
                    | INSERT {dragState.curTime.toFixed(2)}s
                  </span>
                </div>
              )}

              {/* Drag Drop Target Insertion Guide Line */}
              {dragState && (dragState.target.mode === 'above' || dragState.target.mode === 'below' || dragState.target.mode === 'between') && (
                <div
                  data-testid="timeline-drop-indicator"
                  className="absolute left-0 right-0 h-1 bg-violet-400 z-30 pointer-events-none shadow-[0_0_10px_#8b5cf6]"
                  style={{ top: dragState.target.indicatorY }}
                >
                  <span className="absolute left-3 -top-3 px-2 py-0.5 rounded bg-violet-600 text-white font-semibold text-[10px] shadow-lg flex items-center gap-1">
                    <Plus size={11} />
                    <span>Create {dragState.kind === 'audio' ? 'Audio' : 'Video'} Track</span>
                  </span>
                </div>
              )}

              {/* Drag Ghost Clip */}
              {dragState && (
                <div
                  data-testid="timeline-drag-ghost"
                  className="absolute rounded-md border-2 border-dashed border-amber-400 bg-amber-500/35 pointer-events-none z-30 flex items-center justify-between px-2 text-amber-100 font-mono text-[10px] shadow-[0_0_16px_rgba(251,191,36,0.6)]"
                  style={{
                    left: dragState.curTime * px,
                    width: Math.max(10, dragState.origDuration * px),
                    top: dragState.target.indicatorY + 2,
                    height: 48,
                  }}
                >
                  <span className="truncate max-w-[120px] font-sans font-medium">{dragState.clipName}</span>
                  <span className="tabular-nums opacity-90">{formatTimecode(dragState.curTime, FPS)}</span>
                </div>
              )}

              {/* playhead line across lanes */}
              <PlayheadMarker px={px} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Centralized Target-Aware Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setContextMenu(null)} />
          <div
            data-testid="timeline-context-menu"
            role="menu"
            className="fixed z-[100] w-52 rounded-md border border-ink-700 bg-ink-850 p-1.5 shadow-2xl text-xs text-ink-200"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 220),
              top: Math.min(contextMenu.y, window.innerHeight - 240),
            }}
          >
            {contextMenu.type === 'clip' && contextMenu.clip && (
              <>
                <div className="px-2 py-1 font-semibold text-ink-100 border-b border-ink-750 mb-1 truncate" title={contextMenu.clip.name}>
                  {contextMenu.clip.name}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    splitAt(useEditor.getState().playhead)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Scissors size={14} />
                  <span>Split at Playhead</span>
                  <kbd className="ml-auto text-[10px] text-ink-500">B</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clp = contextMenu.clip!
                    const currentClips = useEditor.getState().clips
                    const adjacent = currentClips.find(
                      (c) =>
                        c.trackId === clp.trackId &&
                        c.id !== clp.id &&
                        Math.abs(c.start - (clp.start + clp.duration)) < 0.2,
                    )
                    if (adjacent) {
                      addTransition({
                        type: 'cross_dissolve',
                        fromClipId: clp.id,
                        toClipId: adjacent.id,
                        trackId: clp.trackId,
                        startTime: clp.start + clp.duration - 0.5,
                        duration: 1.0,
                        alignment: 'centered',
                        enabled: true,
                      })
                    } else {
                      // Add single-ended fade transition
                      addTransition({
                        type: 'dip_to_black',
                        fromClipId: clp.id,
                        toClipId: clp.id,
                        trackId: clp.trackId,
                        startTime: clp.start + clp.duration - 0.5,
                        duration: 1.0,
                        alignment: 'end_at_cut',
                        enabled: true,
                      })
                    }
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Sparkles size={14} />
                  <span>Add Transition</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleClipHidden(contextMenu.clip!.id)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  {contextMenu.clip.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{contextMenu.clip.hidden ? 'Show Clip' : 'Hide Clip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertClipCopy(contextMenu.clip!, contextMenu.clip!.start + contextMenu.clip!.duration)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Copy size={14} />
                  <span>Duplicate</span>
                  <kbd className="ml-auto text-[10px] text-ink-500">Cmd+D</kbd>
                </button>

                <div className="my-1 border-t border-ink-700" />

                {contextMenu.clip.kind === 'compound' ? (
                  <>
                    <button
                      type="button"
                      data-testid="context-menu-open-compound-clip"
                      onClick={() => {
                        if (contextMenu.clip?.sourceSequenceId) {
                          useEditor.getState().openSequence(contextMenu.clip.sourceSequenceId)
                        }
                        setContextMenu(null)
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-left font-medium"
                    >
                      <Layers size={14} className="text-indigo-400" />
                      <span>Open Compound Clip</span>
                    </button>
                    <button
                      type="button"
                      data-testid="context-menu-uncompound-clip"
                      onClick={() => {
                        useEditor.getState().uncompoundClip(contextMenu.clip!.id)
                        setContextMenu(null)
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 text-left"
                    >
                      <FolderOutput size={14} className="text-amber-400" />
                      <span>Uncompound Clip</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid="context-menu-create-compound-clip"
                    onClick={() => {
                      const selIds = useEditor.getState().selectedClipIds
                      const idsToCompound = selIds.length > 1 && selIds.includes(contextMenu.clip!.id)
                        ? selIds
                        : [contextMenu.clip!.id]
                      useEditor.getState().createCompoundClip(idsToCompound)
                      setContextMenu(null)
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-left"
                  >
                    <Layers size={14} className="text-indigo-400" />
                    <span>Create Compound Clip</span>
                  </button>
                )}

                <div className="my-1 border-t border-ink-700" />
                <button
                  type="button"
                  onClick={() => {
                    removeClip(contextMenu.clip!.id)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-red-400 hover:bg-red-500/20 text-left"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                  <kbd className="ml-auto text-[10px] text-red-400">Del</kbd>
                </button>
              </>
            )}

            {contextMenu.type === 'transition' && contextMenu.transition && (
              <>
                <div className="px-2 py-1 font-semibold text-amber-300 border-b border-ink-750 mb-1 capitalize">
                  Transition: {contextMenu.transition.type.replace(/_/g, ' ')}
                </div>
                <div className="px-2 py-1 text-[10px] text-ink-500 uppercase font-semibold">Change Type</div>
                {(['cross_dissolve', 'dip_to_black', 'dip_to_white', 'wipe_left', 'slide_left', 'zoom'] as TransitionType[]).map((tType) => (
                  <button
                    key={tType}
                    type="button"
                    onClick={() => {
                      updateTransition(contextMenu.transition!.id, { type: tType })
                      setContextMenu(null)
                    }}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded text-left capitalize ${
                      contextMenu.transition!.type === tType ? 'bg-amber-500/30 text-amber-200 font-medium' : 'hover:bg-ink-750'
                    }`}
                  >
                    <ArrowRight size={12} />
                    <span>{tType.replace(/_/g, ' ')}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-ink-700" />
                <div className="px-2 py-1 text-[10px] text-ink-500 uppercase font-semibold">Duration</div>
                <div className="flex gap-1 px-1 mb-1">
                  {[0.5, 1.0, 1.5, 2.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => {
                        updateTransition(contextMenu.transition!.id, { duration: dur })
                        setContextMenu(null)
                      }}
                      className={`flex-1 py-1 rounded text-[10px] text-center ${
                        Math.abs(contextMenu.transition!.duration - dur) < 0.05
                          ? 'bg-amber-500 text-black font-semibold'
                          : 'bg-ink-800 text-ink-300 hover:bg-ink-750'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>
                <div className="my-1 border-t border-ink-700" />
                <button
                  type="button"
                  onClick={() => {
                    removeTransition(contextMenu.transition!.id)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-red-400 hover:bg-red-500/20 text-left"
                >
                  <Trash2 size={14} />
                  <span>Delete Transition</span>
                </button>
              </>
            )}

            {contextMenu.type === 'empty-track' && contextMenu.trackId && (
              <>
                <div className="px-2 py-1 font-semibold text-ink-300 border-b border-ink-750 mb-1 flex items-center justify-between">
                  <span>Track {tracks.find((t) => t.id === contextMenu.trackId)?.name || ''}</span>
                  <span className="text-[10px] text-ink-500 uppercase">{tracks.find((t) => t.id === contextMenu.trackId)?.type}</span>
                </div>
                <button
                  type="button"
                  data-testid="track-close-gaps-ctx"
                  onClick={() => {
                    useEditor.getState().closeTrackGaps(contextMenu.trackId!)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Minimize2 size={14} />
                  <span>Close Gaps on Track</span>
                </button>
                <div className="my-1 border-t border-ink-700" />
                <button
                  type="button"
                  data-testid="ctx-track-add-above"
                  onClick={() => {
                    createTrack(tracks.find((t) => t.id === contextMenu.trackId)?.type || 'video', 'above', contextMenu.trackId)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Plus size={14} />
                  <span>Add Track Above</span>
                </button>
                <button
                  type="button"
                  data-testid="ctx-track-add-below"
                  onClick={() => {
                    createTrack(tracks.find((t) => t.id === contextMenu.trackId)?.type || 'video', 'below', contextMenu.trackId)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-brand/20 hover:text-violet-200 text-left"
                >
                  <Plus size={14} />
                  <span>Add Track Below</span>
                </button>
                {tracks.length > 1 && (
                  <>
                    <div className="my-1 border-t border-ink-700" />
                    <button
                      type="button"
                      data-testid="ctx-track-delete"
                      onClick={() => {
                        deleteTrack(contextMenu.trackId!)
                        setContextMenu(null)
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-red-400 hover:bg-red-500/20 text-left"
                    >
                      <Trash2 size={14} />
                      <span>Delete Track</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
