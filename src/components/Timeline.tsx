import { useRef, useState, useEffect } from 'react'
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
  Copy,
  Layers,
  ArrowRight,
  Minimize2,
  Bookmark,
  Type,
} from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, MediaAsset, Track, Transition, TransitionType } from '../types'
import { chooseTickInterval, formatTimecode, formatRulerLabel, uid, clamp } from '../lib/time'
import { IconButton } from './ui'
import { readClipClipboard, writeClipClipboard } from '../lib/clipClipboard'
import { AudioMeter } from './AudioMeter'
import { TimelineController, TrackModel } from '../lib/oop/TimelineController'

const RULER_H = 28
const HEADER_W = 168
const MAX_PX = 8000 // continuous zoom remains usable through frame-level detail

// Snap a time value to nearby clip edges, markers, and the playhead.
function snapTime(value: number): number {
  const st = useEditor.getState()
  if (!st.snapping) return value
  const px = st.pxPerSec
  const thresh = 8 / px
  let best = value
  let bestDist = thresh
  for (const c of st.clips) {
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
  const createTrack = useEditor((s) => s.createTrack)
  const deleteTrack = useEditor((s) => s.deleteTrack)
  const setTrackHeight = useEditor((s) => s.setTrackHeight)
  const clips = useEditor((s) => s.clips)
  const effectiveHeight = new TrackModel(track).getEffectiveHeight(clips)
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <div
      data-testid="track-header"
      data-track-id={track.id}
      className="shrink-0 flex items-center gap-1 px-2 border-b border-ink-800 bg-ink-850 relative group"
      style={{ height: effectiveHeight }}
    >
      <span className="text-ink-500">
        {track.type === 'audio' ? <Music size={13} /> : <Video size={13} />}
      </span>
      <span className="text-[11px] font-semibold text-ink-200 truncate flex-1">
        {track.name}
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
        title="Close Gaps on Track"
        data-testid={`close-gaps-${track.id}`}
        onClick={() => useEditor.getState().closeTrackGaps(track.id)}
      >
        <Minimize2 size={13} />
      </IconButton>
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
    e.stopPropagation()
    selectClip(clip.id)
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
    if (trimRef.current.mode === 'left') {
      trimClip(clip.id, 'left', snapTime(trimRef.current.origStart + d))
    } else {
      trimClip(clip.id, 'right', snapTime(trimRef.current.origStart + trimRef.current.origDur + d))
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
  const isAudio = clip.kind === 'audio'
  const isText = clip.kind === 'text' || Boolean((clip as any).textStyle)
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
      onContextMenu={(e) => onContextMenu(e, clip)}
      className={[
        'absolute top-1 bottom-1 pointer-events-auto rounded-md overflow-hidden text-[11px] select-none transition-[border-color,box-shadow]',
        tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-inherit',
        selected
          ? isText
            ? 'border-2 border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)] z-10'
            : isAudio
            ? 'border-2 border-purple-400 ring-2 ring-purple-400/80 shadow-[0_0_14px_rgba(192,132,252,0.5)] z-10'
            : 'border-2 border-brand ring-2 ring-brand/70 shadow-[0_0_14px_rgba(108,76,255,0.45)] z-10'
          : isText
          ? 'border border-amber-600/70 hover:border-amber-400 hover:shadow-md'
          : isAudio
          ? 'border border-purple-800/60 hover:border-purple-400 hover:shadow-md'
          : 'border border-ink-600 hover:border-violet-300 hover:shadow-md',
        clip.hidden
          ? 'opacity-40 border-dashed hover:opacity-65 hover:border-violet-300 hover:shadow-[0_0_12px_rgba(167,139,250,.5)]'
          : '',
        isText
          ? 'bg-amber-950/75 text-amber-100'
          : isAudio
          ? 'bg-violet-950/60 text-purple-200'
          : 'bg-brand/25 text-ink-100',
      ].join(' ')}
      style={{ left, width }}
      title={clip.name}
    >
      {!isAudio && !isText && (asset?.thumbnail || asset?.kind === 'image') && (
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
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-violet-200/20" />
          {visibleWaveform.map((peak, index) => (
            <i
              key={index}
              data-peak={peak.toFixed(4)}
              className="min-w-px flex-1 rounded-full bg-violet-300"
              style={{ height: `${clip.volume === 0 ? 1 : Math.max(4, peak * clip.volume * 96)}%` }}
            />
          ))}
        </div>
      )}
      <div className="relative z-[1] px-1.5 py-0.5 truncate text-ink-100 bg-black/40 border-b border-white/5 flex items-center gap-1">
        {clip.hidden ? (
          <EyeOff size={10} aria-label="Hidden clip" />
        ) : isText ? (
          <Type size={10} className="text-amber-400" />
        ) : isAudio ? (
          <Music size={10} />
        ) : (
          <Video size={10} />
        )}
        <span className="truncate">{clip.name}</span>
      </div>
      {!isAudio && !isText && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent" />}

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
  const setScrubbing = useEditor((s) => s.setScrubbing)
  const splitAt = useEditor((s) => s.splitAt)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const moveClip = useEditor((s) => s.moveClip)
  const moveClipToNewTrack = useEditor((s) => s.moveClipToNewTrack)
  const addTransition = useEditor((s) => s.addTransition)
  const updateTransition = useEditor((s) => s.updateTransition)
  const removeTransition = useEditor((s) => s.removeTransition)
  const assets = useEditor((s) => s.assets)
  const setZoom = useEditor((s) => s.setZoom)
  const zoomBy = useEditor((s) => s.zoomBy)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectClip = useEditor((s) => s.selectClip)
  const removeClip = useEditor((s) => s.removeClip)
  const insertClipCopy = useEditor((s) => s.insertClipCopy)
  const toggleClipHidden = useEditor((s) => s.toggleClipHidden)
  const markers = useEditor((s) => s.markers)
  const addMarker = useEditor((s) => s.addMarker)
  const setActiveMarkerModalId = useEditor((s) => s.setActiveMarkerModalId)

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

  // Active clip drag listeners with threshold-based click vs drag state machine & auto-scroll
  const startClipDrag = (clip: Clip, e: React.PointerEvent) => {
    const lanes = lanesRef.current
    if (!lanes) return
    const startX = e.clientX
    const startY = e.clientY
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
          const candidateTime = Math.max(0, snapTime((latestClientX - lanesRect.left) / px))
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
      const candidateTime = Math.max(0, snapTime((moveEv.clientX - lanesRect.left) / px))
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
          title="Split at playhead (B)"
          onClick={() => splitAt(useEditor.getState().playhead)}
          className="flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2.5 text-xs text-ink-300 hover:bg-ink-700 hover:text-white"
        >
          <Scissors size={15} />
          <span className="hidden lg:inline">Split</span>
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
          className="flex h-8 min-w-[42px] items-center justify-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 text-ink-200 hover:bg-ink-700"
        >
          {tool === 'select' ? <MousePointer2 size={16} /> : <Slash size={16} />}
          <ChevronDown size={12} />
        </button>

        {/* marker button */}
        <button
          type="button"
          data-testid="add-marker-btn"
          title="Add Marker at playhead (M)"
          aria-label="Add marker"
          onClick={handleAddMarker}
          className="flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-300 hover:bg-ink-700 hover:text-white transition-colors"
        >
          <Bookmark size={14} className="text-blue-400" />
          <span className="hidden sm:inline">Marker</span>
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
              className="of-range w-24 sm:w-28"
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
          title={`Snapping (${snapping ? 'on' : 'off'})`}
          aria-pressed={snapping}
          onClick={toggleSnapping}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs ${
            snapping
              ? 'border-brand/60 bg-brand/15 text-violet-200'
              : 'border-ink-700 bg-ink-800 text-ink-400 hover:bg-ink-700'
          }`}
        >
          <Magnet size={15} />
          <span className="hidden xl:inline">Snap</span>
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
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative">
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
                      className="absolute top-4 left-1 text-[8px] font-semibold px-1 py-0.2 rounded text-white shadow-sm pointer-events-none whitespace-nowrap opacity-90 group-hover:opacity-100"
                      style={{ backgroundColor: colorHex }}
                    >
                      {marker.label}
                    </span>
                  </div>
                )
              })}

              {/* Imperative marker */}
              <PlayheadMarker px={px} handle />
            </div>

            {/* lanes */}
            <div
              ref={lanesRef}
              data-testid="timeline-lanes"
              className="relative"
              style={{ height: totalHeight }}
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
                        selected={c.id === selectedClipId}
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
                <div className="px-2 py-1 font-semibold text-ink-100 border-b border-ink-750 mb-1 truncate">
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
