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
} from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, MediaAsset, Track } from '../types'
import { chooseTickInterval, formatTimecode, formatRulerLabel, uid, clamp } from '../lib/time'
import { IconButton, Segmented } from './ui'
import { readClipClipboard, writeClipClipboard } from '../lib/clipClipboard'

const RULER_H = 28
const HEADER_W = 168
const MAX_PX = 8000 // continuous zoom remains usable through frame-level detail

// Snap a time value to nearby clip edges and the playhead.
function snapTime(value: number): number {
  const st = useEditor.getState()
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
  const dph = Math.abs(st.playhead - value)
  if (dph < bestDist) best = st.playhead
  return best
}

function getTrackAtY(y: number, lanesTop: number, tracks: Track[]): string | null {
  let acc = lanesTop
  for (const t of tracks) {
    if (y >= acc && y < acc + t.height) return t.id
    acc += t.height
  }
  return tracks.length ? tracks[tracks.length - 1].id : null
}

function ClipView({
  clip,
  asset,
  px,
  tool,
  selected,
  lanesRef,
  tracks,
}: {
  clip: Clip
  asset?: MediaAsset
  px: number
  tool: 'select' | 'blade'
  selected: boolean
  lanesRef: React.RefObject<HTMLDivElement>
  tracks: Track[]
}) {
  const moveClip = useEditor((s) => s.moveClip)
  const trimClip = useEditor((s) => s.trimClip)
  const selectClip = useEditor((s) => s.selectClip)
  const splitAt = useEditor((s) => s.splitAt)
  const beginHistory = useEditor((s) => s.beginHistory)
  const endHistory = useEditor((s) => s.endHistory)
  const drag = useRef<{
    mode: 'move' | 'left' | 'right'
    startX: number
    origStart: number
    origDur: number
  } | null>(null)

  const onDown = (mode: 'move' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.stopPropagation()
    selectClip(clip.id)
    if (tool === 'blade' && mode === 'move') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const time = clip.start + (e.clientX - rect.left) / px
      splitAt(time)
      return
    }
    beginHistory()
    drag.current = { mode, startX: e.clientX, origStart: clip.start, origDur: clip.duration }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const d = (e.clientX - drag.current.startX) / px
    if (drag.current.mode === 'move') {
      const ns = snapTime(drag.current.origStart + d)
      let trackId = clip.trackId
      const lanes = lanesRef.current
      if (lanes) {
        const id = getTrackAtY(e.clientY, lanes.getBoundingClientRect().top, tracks)
        if (id) trackId = id
      }
      moveClip(clip.id, ns, trackId)
    } else if (drag.current.mode === 'left') {
      trimClip(clip.id, 'left', snapTime(drag.current.origStart + d))
    } else {
      trimClip(clip.id, 'right', snapTime(drag.current.origStart + drag.current.origDur + d))
    }
  }

  const onUp = (e: React.PointerEvent) => {
    if (drag.current) {
      drag.current = null
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
      onPointerMove={onMove}
      onPointerUp={onUp}
      className={[
        'absolute top-1 bottom-1 pointer-events-auto rounded-md overflow-hidden cursor-grab active:cursor-grabbing border text-[11px] select-none',
        selected ? 'border-brand ring-1 ring-brand z-10' : 'border-ink-600',
        clip.hidden
          ? 'opacity-40 border-dashed hover:opacity-65 hover:border-violet-300 hover:shadow-[0_0_12px_rgba(167,139,250,.5)]'
          : 'hover:border-violet-400/80',
        isAudio ? 'bg-brand/15' : 'bg-brand/25',
      ].join(' ')}
      style={{ left, width }}
      title={clip.name}
    >
      {!isAudio && (asset?.thumbnail || asset?.kind === 'image') && (
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
      <div className="relative z-[1] px-1.5 py-0.5 truncate text-ink-100 bg-black/35 border-b border-white/5 flex items-center gap-1">
        {clip.hidden ? <EyeOff size={10} aria-label="Hidden clip" /> : isAudio ? <Music size={10} /> : <Video size={10} />}
        <span className="truncate">{clip.name}</span>
      </div>
      {!isAudio && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent" />}

      {/* trim handles */}
      <div
        onPointerDown={onDown('left')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        data-testid="trim-left"
        aria-label={`Trim start of ${clip.name}`}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
      />
      <div
        onPointerDown={onDown('right')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        data-testid="trim-right"
        aria-label={`Trim end of ${clip.name}`}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
      />
    </div>
  )
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
    <div ref={ref} className={`absolute left-0 top-0 bottom-0 w-0.5 pointer-events-none ${handle ? 'bg-brand' : 'bg-brand/80'}`}>
      {handle && <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 bg-brand rotate-45" />}
    </div>
  )
}

function TrackHeader({ track }: { track: Track }) {
  const toggleMute = useEditor((s) => s.toggleTrackMute)
  const toggleHidden = useEditor((s) => s.toggleTrackHidden)
  const toggleLock = useEditor((s) => s.toggleTrackLock)
  return (
    <div
      className="shrink-0 flex items-center gap-1 px-2 border-b border-ink-800 bg-ink-850"
      style={{ height: track.height }}
    >
      <span className="text-ink-500">
        {track.type === 'audio' ? <Music size={13} /> : <Video size={13} />}
      </span>
      <span className="text-[11px] text-ink-200 truncate flex-1">{track.name}</span>
      {track.type === 'audio' ? (
        <IconButton title="Mute" active={track.muted} onClick={() => toggleMute(track.id)}>
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </IconButton>
      ) : (
        <IconButton title="Hide" active={track.hidden} onClick={() => toggleHidden(track.id)}>
          {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </IconButton>
      )}
      <IconButton title={track.locked ? 'Unlock' : 'Lock'} active={track.locked} onClick={() => toggleLock(track.id)}>
        {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </IconButton>
    </div>
  )
}

export function Timeline() {
  const renderCount = useRef(0)
  renderCount.current += 1
  const tracks = useEditor((s) => s.tracks)
  const clips = useEditor((s) => s.clips)
  const px = useEditor((s) => s.pxPerSec)
  const FPS = useEditor((s) => s.projectFps)
  const duration = useEditor((s) => s.duration)
  const tool = useEditor((s) => s.tool)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const setTool = useEditor((s) => s.setTool)
  const playing = useEditor((s) => s.playing)
  const togglePlay = useEditor((s) => s.togglePlay)
  const speed = useEditor((s) => s.speed)
  const setSpeed = useEditor((s) => s.setSpeed)
  const splitAt = useEditor((s) => s.splitAt)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const assets = useEditor((s) => s.assets)
  const setZoom = useEditor((s) => s.setZoom)
  const zoomBy = useEditor((s) => s.zoomBy)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const removeClip = useEditor((s) => s.removeClip)
  const insertClipCopy = useEditor((s) => s.insertClipCopy)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewW, setViewW] = useState(900)
  const seeking = useRef(false)

  const contentWidth = Math.max(duration, 20) * px + 80
  const totalHeight = tracks.reduce((a, t) => a + t.height, 0)
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
        event.preventDefault(); writeClipClipboard(selected)
        if (key === 'x') removeClip(selected.id)
      } else if (key === 'v' && readClipClipboard()) {
        event.preventDefault(); insertClipCopy(readClipClipboard()!, useEditor.getState().playhead)
      } else if (key === 'd' && selected) {
        event.preventDefault(); insertClipCopy(selected, selected.start + selected.duration)
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

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const el = scrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cursorX = e.clientX - rect.left - HEADER_W
      const timeAtCursor = (scrollLeft + cursorX) / px
      const factor = e.deltaY < 0 ? 1.12 : 0.89
      const next = clamp(px * factor, 8, MAX_PX)
      setZoom(next)
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = timeAtCursor * next - cursorX
        }
      })
    }
  }

  const seekFromClientX = (clientX: number) => {
    const el = lanesRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPlayhead((clientX - rect.left) / px)
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
      if (major) label = formatTimecode(t)
      else if (frameW >= 32 && (frameW >= 64 || frame % (frameW >= 64 ? 1 : 5) === 0)) label = String(frame)
      ticks.push({ t, label, major })
    }
  } else {
    const interval = chooseTickInterval(px, 72, FPS)
    const minor = interval / (interval * px < 120 ? 2 : 5)
    for (let t = Math.floor(tStart / interval) * interval; t <= tEnd; t += interval) {
      ticks.push({ t, label: formatRulerLabel(t, interval, FPS), major: true })
    }
    for (let t = Math.floor(tStart / minor) * minor; t <= tEnd; t += minor) {
      if (!ticks.some((x) => Math.abs(x.t - t) < 1e-6)) ticks.push({ t, major: false })
    }
  }

  return (
    <div data-testid="timeline" data-px-per-second={px.toFixed(4)} data-project-fps={FPS} data-render-count={renderCount.current} className="h-[280px] shrink-0 flex flex-col bg-ink-900 border-t border-ink-700">
      {/* transport + tools + zoom (groups separated by dividers) */}
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
        <Segmented
          options={[
            { value: 0.5, label: '0.5×' },
            { value: 1, label: '1×' },
            { value: 2, label: '2×' },
          ]}
          value={speed < 0 ? -speed : speed}
          onChange={(v) => setSpeed(v)}
        />

        <div className="w-px h-6 bg-ink-700" />

        {/* edit tools */}
        <IconButton title="Split at playhead (B)" onClick={() => splitAt(useEditor.getState().playhead)}>
          <Scissors size={16} />
        </IconButton>
        <div className="flex items-center gap-1 bg-ink-800 rounded-md p-0.5 border border-ink-700">
          <IconButton title="Select tool (V)" active={tool === 'select'} onClick={() => setTool('select')}>
            <MousePointer2 size={16} />
          </IconButton>
          <IconButton title="Blade tool (B)" active={tool === 'blade'} onClick={() => setTool('blade')}>
            <Slash size={16} />
          </IconButton>
        </div>

        <div className="flex-1 min-w-[12px]" />

        {/* zoom group */}
        <div className="flex items-center gap-1 shrink-0">
          <IconButton title="Zoom out" onClick={() => zoomBy(0.8)}>
            <ZoomOut size={15} />
          </IconButton>
          <input
            type="range"
            className="of-range w-28"
            min={8}
            max={MAX_PX}
            value={px}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
          <IconButton title="Zoom in" onClick={() => zoomBy(1.25)}>
            <ZoomIn size={15} />
          </IconButton>
          <IconButton title="Fit" onClick={fitZoom}>
            <Maximize size={15} />
          </IconButton>
        </div>
        <IconButton title="Snapping (on)" active>
          <Magnet size={15} />
        </IconButton>
        <span className="text-[10px] text-ink-500 whitespace-nowrap">
          {px.toFixed(0)} px/s{frameMode ? ' · frame' : ''}
        </span>
      </div>

      {/* body */}
      <div ref={scrollRef} onWheel={onWheel} className="flex-1 min-h-0 overflow-auto">
        <div className="flex min-w-max">
          {/* left: track headers */}
          <div className="w-[168px] shrink-0 sticky left-0 z-20 bg-ink-900 border-r border-ink-800">
            <div className="h-[28px] border-b border-ink-800 bg-ink-900 flex items-center px-2">
              <span data-testid="timeline-media-mode" className="truncate text-[10px] font-medium text-ink-400">{mediaMode}</span>
            </div>
            {tracks.map((t) => (
              <TrackHeader key={t.id} track={t} />
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
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                seekFromClientX(e.clientX)
              }}
              onPointerMove={(e) => {
                if (seeking.current) seekFromClientX(e.clientX)
              }}
              onPointerUp={(e) => {
                seeking.current = false
                try {
                  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                } catch {
                  /* noop */
                }
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
              {/* Imperative marker: playback moves this transform without rerendering tracks/clips. */}
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
                const hitId = getTrackAtY(e.clientY, rect.top, tracks)
                const hit = tracks.find((t) => t.id === hitId)
                const trackId = hit && hit.type === expectedType && !hit.locked
                  ? hit.id
                  : useEditor.getState().ensureTrack(expectedType)
                addClipToTrack(trackId, assetId, Math.max(0, (e.clientX - rect.left) / px))
              }}
            >
              {tracks.map((tr) => (
                <div
                  key={tr.id}
                  className="relative border-b border-ink-800 bg-ink-900/40"
                  style={{ height: tr.height }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) seekFromClientX(e.clientX)
                  }}
                >
                  {/* subtle row striping for readability */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_39px,rgba(255,255,255,0.02)_40px)]" />
                </div>
              ))}

              {/* clips layer */}
              <div className="absolute inset-0 pointer-events-none">
                {clips.map((c) => {
                  const tr = tracks.find((t) => t.id === c.trackId)
                  if (!tr) return null
                  const top = tracks.slice(0, tracks.indexOf(tr)).reduce((a, t) => a + t.height, 0)
                  return (
                    <div key={c.id} className="absolute inset-x-0 pointer-events-none" style={{ top, height: tr.height }}>
                      <ClipView
                        clip={c}
                        asset={assets.find((asset) => asset.id === c.assetId)}
                        px={px}
                        tool={tool}
                        selected={c.id === selectedClipId}
                        lanesRef={lanesRef}
                        tracks={tracks}
                      />
                    </div>
                  )
                })}
              </div>

              {/* playhead line across lanes */}
              <PlayheadMarker px={px} />
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
