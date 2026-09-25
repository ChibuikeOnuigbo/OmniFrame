import React, { useRef, useState, useEffect } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Plus,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Film,
  Music,
  ImageIcon,
  Grid,
} from 'lucide-react'
import { useEditor } from '../store'
import { formatClock } from '../lib/time'
import { ThreeViewer } from './ThreeViewer'

export function SourceMonitor() {
  const assets = useEditor((s) => s.assets)
  const sourcePreview = useEditor((s) => s.sourcePreview)
  const setSourcePreviewAsset = useEditor((s) => s.setSourcePreviewAsset)
  const setMonitorMode = useEditor((s) => s.setMonitorMode)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const ensureTrack = useEditor((s) => s.ensureTrack)

  const asset = assets.find((a) => a.id === sourcePreview.assetId) || assets[0]

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(asset?.duration || 0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [checkerboard, setCheckerboard] = useState(false)

  useEffect(() => {
    if (asset) {
      setDuration(asset.duration || 0)
      setCurrentTime(0)
      setIsPlaying(false)
    }
  }, [asset?.id])

  if (!asset) {
    return (
      <div
        data-testid="source-monitor-empty"
        className="w-full h-full flex flex-col items-center justify-center bg-ink-950 text-ink-500 text-xs"
      >
        <Film size={32} className="mb-2 opacity-40 text-ink-400" />
        <p>No media asset selected in Source Monitor</p>
        <p className="text-[11px] text-ink-600 mt-1">Click any item in the Media Library to preview it here</p>
      </div>
    )
  }

  const handleTogglePlay = () => {
    if (asset.kind === 'video' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    } else if (asset.kind === 'audio' && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play()
        setIsPlaying(true)
      } else {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime)
    if (asset.kind === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime
    } else if (asset.kind === 'audio' && audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleStep = (frames: number) => {
    const fps = 30
    const next = Math.max(0, Math.min(duration, currentTime + frames / fps))
    handleSeek(next)
  }

  const handleInsertToTimeline = () => {
    const type = asset.kind === 'audio' ? 'audio' : 'video'
    const trackId = ensureTrack(type)
    addClipToTrack(trackId, asset.id)
    setMonitorMode('program')
  }

  return (
    <div
      data-testid="source-monitor"
      className="relative w-full h-full flex flex-col bg-[#07090e] select-none overflow-hidden"
    >
      {/* Top Source Header */}
      <div className="h-9 px-3 shrink-0 flex items-center justify-between border-b border-ink-800 bg-ink-900/60 z-20">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-brand tracking-tight flex items-center gap-1.5">
            {asset.kind === 'video' ? <Film size={13} /> : asset.kind === 'audio' ? <Music size={13} /> : <ImageIcon size={13} />}
            <span>Source: {asset.name}</span>
          </span>
          <span className="text-[10px] text-ink-500 font-mono">
            {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
            {formatClock(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="source-add-to-timeline-btn"
            title="Insert this media asset into timeline"
            onClick={handleInsertToTimeline}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand hover:bg-brand-600 text-white text-[11px] font-medium transition-colors shadow-sm"
          >
            <Plus size={13} />
            <span>Add to Timeline</span>
          </button>

          <button
            type="button"
            data-testid="switch-to-program-btn"
            title="Return to Program / Timeline Monitor"
            onClick={() => setMonitorMode('program')}
            className="px-2 py-1 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-[11px] transition-colors"
          >
            Program Monitor →
          </button>
        </div>
      </div>

      {/* Main Preview Surface */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden">
        {asset.kind === 'video' ? (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={asset.url}
              data-testid="source-video-element"
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
              onEnded={() => setIsPlaying(false)}
              className="max-w-full max-h-[calc(100vh-360px)] object-contain rounded shadow-2xl"
            />
          </div>
        ) : asset.kind === 'image' ? (
          <div
            data-testid="source-image-stage"
            className={`relative w-full h-full flex items-center justify-center ${
              checkerboard ? 'bg-[repeating-conic-gradient(#1b1e2e_0%_25%,#11131f_0%_50%)] bg-[length:24px_24px]' : ''
            }`}
          >
            <img
              src={asset.url}
              alt={asset.name}
              draggable={false}
              data-testid="source-image-element"
              style={{ transform: `scale(${imageZoom})` }}
              className="max-w-full max-h-[calc(100vh-360px)] object-contain transition-transform duration-100 rounded shadow-2xl"
            />
          </div>
        ) : (
          /* Audio preview */
          <div className="w-full max-w-md p-6 rounded-xl bg-ink-900 border border-ink-800 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-4">
              <Music size={28} />
            </div>
            <div className="text-sm font-semibold text-white truncate max-w-xs mb-1">{asset.name}</div>
            <div className="text-xs text-ink-400 font-mono mb-4">{formatClock(currentTime)} / {formatClock(duration)}</div>
            <audio
              ref={audioRef}
              src={asset.url}
              data-testid="source-audio-element"
              onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
              onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}
      </div>

      {/* Bottom Transport / Scrub Bar */}
      <div className="h-11 px-3 shrink-0 flex items-center justify-between border-t border-ink-800 bg-ink-900/90 text-xs text-ink-200">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="source-play-pause-btn"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-1.5 rounded-md bg-brand text-white hover:bg-brand-600 transition-colors"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            type="button"
            data-testid="source-step-back-btn"
            onClick={() => handleStep(-1)}
            title="Step Back 1 Frame (,)"
            className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            data-testid="source-step-fwd-btn"
            onClick={() => handleStep(1)}
            title="Step Forward 1 Frame (.)"
            className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
          >
            <ChevronRight size={14} />
          </button>

          <span className="font-mono text-[11px] text-ink-300 ml-1">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
        </div>

        {/* Scrubber slider */}
        {duration > 0 && (
          <div className="flex-1 max-w-md mx-4 flex items-center">
            <input
              type="range"
              data-testid="source-scrub-slider"
              aria-label="Source preview time"
              min={0}
              max={duration}
              step={0.01}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="of-range w-full"
            />
          </div>
        )}

        {/* Volume & Image controls */}
        <div className="flex items-center gap-2">
          {asset.kind === 'image' && (
            <div className="flex items-center gap-1 border-r border-ink-800 pr-2">
              <button
                type="button"
                data-testid="source-zoom-in-btn"
                title="Zoom In"
                onClick={() => setImageZoom((z) => Math.min(4, z + 0.25))}
                className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
              >
                <ZoomIn size={13} />
              </button>
              <span className="font-mono text-[10px] text-ink-400 w-8 text-center">{Math.round(imageZoom * 100)}%</span>
              <button
                type="button"
                data-testid="source-zoom-out-btn"
                title="Zoom Out"
                onClick={() => setImageZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                data-testid="source-checkerboard-btn"
                title="Toggle Checkerboard Transparency"
                onClick={() => setCheckerboard(!checkerboard)}
                className={`p-1 rounded transition-colors ${checkerboard ? 'bg-brand/20 text-brand' : 'text-ink-400 hover:text-white'}`}
              >
                <Grid size={13} />
              </button>
            </div>
          )}

          {(asset.kind === 'video' || asset.kind === 'audio') && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="source-mute-btn"
                onClick={() => {
                  setMuted(!muted)
                  if (videoRef.current) videoRef.current.muted = !muted
                  if (audioRef.current) audioRef.current.muted = !muted
                }}
                className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                data-testid="source-volume-slider"
                aria-label="Source volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setVolume(val)
                  setMuted(val === 0)
                  if (videoRef.current) videoRef.current.volume = val
                  if (audioRef.current) audioRef.current.volume = val
                }}
                className="of-range w-16"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
