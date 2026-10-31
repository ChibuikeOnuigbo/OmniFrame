import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Loader2, Music2, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEditor } from '../store'
import { executeAudioPitchTempoForClip } from '../lib/audioPitchTempo'

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(1).padStart(4, '0')}`
}

export function AudioPitchTempoPanel() {
  const clips = useEditor((state) => state.clips)
  const assets = useEditor((state) => state.assets)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const audioClips = useMemo(() => clips.filter((clip) => clip.kind === 'audio'), [clips])
  const selectedAudioClipId = audioClips.some((clip) => clip.id === selectedClipId) ? selectedClipId : null
  const [sourceClipId, setSourceClipId] = useState(selectedAudioClipId || audioClips[0]?.id || '')
  const [pitchSemitones, setPitchSemitones] = useState(0)
  const [tempoPercent, setTempoPercent] = useState(100)
  const [pitchCharacter, setPitchCharacter] = useState<'music' | 'voice'>('music')
  const [muteSource, setMuteSource] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (selectedAudioClipId) setSourceClipId(selectedAudioClipId)
    else if (!audioClips.some((clip) => clip.id === sourceClipId)) setSourceClipId(audioClips[0]?.id || '')
  }, [selectedAudioClipId, audioClips])

  const activeClipId = audioClips.some((clip) => clip.id === sourceClipId)
    ? sourceClipId
    : audioClips[0]?.id || ''
  const activeClip = audioClips.find((clip) => clip.id === activeClipId)
  const activeAsset = assets.find((asset) => asset.id === activeClip?.assetId)

  const reset = () => {
    setPitchSemitones(0)
    setTempoPercent(100)
    setPitchCharacter('music')
    setError(null)
    setSuccess(null)
  }

  const render = async () => {
    if (!activeClip) {
      setError('Add an audio clip to the timeline before rendering pitch or tempo changes.')
      return
    }
    setProcessing(true)
    setProgress(0)
    setStatus('Preparing audio…')
    setError(null)
    setSuccess(null)
    try {
      const result = await executeAudioPitchTempoForClip(activeClip.id, {
        pitchSemitones,
        tempoPercent,
        pitchCharacter,
        muteSource,
      }, (update) => {
        setProgress(update.percent)
        setStatus(update.status)
      })
      setSuccess(`Rendered ${formatTime(result.duration)} to a new audio track${muteSource ? ', source muted' : ''}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('')
    } finally {
      setProcessing(false)
    }
  }

  const neutral = Math.abs(pitchSemitones) < 0.001 && Math.abs(tempoPercent - 100) < 0.001

  return (
    <section data-testid="audio-pitch-tempo-panel" className="rounded-xl border border-sky-500/20 bg-ink-950/60">
      <button
        type="button"
        data-testid="audio-pitch-tempo-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="rounded-md border border-sky-400/25 bg-sky-500/10 p-1.5 text-sky-300"><SlidersHorizontal size={13} /></span>
          <span className="min-w-0"><span className="block text-[10px] font-semibold text-ink-100">Pitch & tempo, independent</span><span className="block text-[9px] leading-snug text-ink-400">Render a new audio clip, local processing</span></span>
        </span>
        <ChevronDown size={13} className={`shrink-0 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-ink-800 p-3">
          {audioClips.length === 0 ? (
            <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-2.5 text-center text-[9px] leading-relaxed text-ink-400">
              Add an audio clip to the timeline. Video audio must be extracted first.
            </div>
          ) : (
            <>
              <label className="block text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                Source audio clip
                <select
                  data-testid="audio-pitch-tempo-clip-select"
                  aria-label="Source audio clip for pitch and tempo rendering"
                  value={activeClipId}
                  disabled={processing}
                  onChange={(event) => { setSourceClipId(event.target.value); setError(null); setSuccess(null) }}
                  className="mt-1 h-8 w-full rounded-md border border-ink-700 bg-ink-900 px-2 text-[10px] font-normal normal-case tracking-normal text-ink-200 outline-none focus:border-sky-400"
                >
                  {audioClips.map((clip) => {
                    const asset = assets.find((item) => item.id === clip.assetId)
                    return <option key={clip.id} value={clip.id}>{asset?.name || clip.name}, {formatTime(clip.duration)}</option>
                  })}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-lg border border-ink-800 bg-ink-900/50 p-2 text-[9px] text-ink-400">
                  <span className="flex items-center justify-between gap-1"><span>Pitch shift</span><span className="font-mono text-sky-200">{pitchSemitones > 0 ? '+' : ''}{pitchSemitones} st</span></span>
                  <input
                    type="range"
                    data-testid="audio-pitch-tempo-pitch"
                    aria-label="Pitch shift in semitones"
                    min={-12}
                    max={12}
                    step={1}
                    value={pitchSemitones}
                    disabled={processing}
                    onChange={(event) => { setPitchSemitones(Number(event.target.value)); setSuccess(null) }}
                    className="of-range mt-1 w-full"
                  />
                  <span className="mt-0.5 flex justify-between font-mono text-[9px] text-ink-400"><span>−12</span><span>0</span><span>+12</span></span>
                </label>
                <label className="rounded-lg border border-ink-800 bg-ink-900/50 p-2 text-[9px] text-ink-400">
                  <span className="flex items-center justify-between gap-1"><span>Tempo / speed</span><span className="font-mono text-sky-200">{tempoPercent}%</span></span>
                  <input
                    type="range"
                    data-testid="audio-pitch-tempo-tempo"
                    aria-label="Tempo playback speed percentage"
                    min={50}
                    max={150}
                    step={1}
                    value={tempoPercent}
                    disabled={processing}
                    onChange={(event) => { setTempoPercent(Number(event.target.value)); setSuccess(null) }}
                    className="of-range mt-1 w-full"
                  />
                  <span className="mt-0.5 flex justify-between font-mono text-[9px] text-ink-400"><span>50%</span><span>100%</span><span>150%</span></span>
                </label>
              </div>

              <label className="block text-[9px] text-ink-400">
                Pitch character
                <select
                  data-testid="audio-pitch-tempo-character"
                  aria-label="Pitch shift audio character"
                  value={pitchCharacter}
                  disabled={processing}
                  onChange={(event) => setPitchCharacter(event.target.value as 'music' | 'voice')}
                  className="mt-1 h-8 w-full rounded-md border border-ink-700 bg-ink-900 px-2 text-[10px] text-ink-200 outline-none focus:border-sky-400"
                >
                  <option value="music">Mixed music, transient-aware</option>
                  <option value="voice">Solo voice, preserve formants</option>
                </select>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-ink-800 bg-ink-900/40 p-2 text-[9px] leading-relaxed text-ink-400">
                <input
                  type="checkbox"
                  data-testid="audio-pitch-tempo-mute-source"
                  checked={muteSource}
                  disabled={processing}
                  onChange={(event) => setMuteSource(event.target.checked)}
                  className="mt-0.5 accent-sky-400"
                />
                <span>Mute the source clip when the rendered version is added. It stays in the project and can be unmuted.</span>
              </label>

              <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-2 text-[9px] leading-relaxed text-sky-100/70">
                Tempo changes duration while keeping pitch; pitch shift changes key while keeping duration. Stereo is processed as linked mid/side. Moderate changes sound most natural; extreme settings can introduce artifacts.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="audio-pitch-tempo-render"
                  onClick={() => void render()}
                  disabled={processing || neutral || !activeClipId}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-sky-500/15 px-2 text-[9px] font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing ? <Loader2 size={11} className="animate-spin" /> : <Music2 size={11} />}
                  {processing ? 'Rendering…' : 'Render new clip'}
                </button>
                <button
                  type="button"
                  data-testid="audio-pitch-tempo-reset"
                  onClick={reset}
                  disabled={processing || neutral}
                  aria-label="Reset pitch and tempo settings"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-700 bg-ink-900 text-ink-400 hover:text-ink-100 disabled:opacity-40"
                ><RotateCcw size={11} /></button>
              </div>
              {processing && (
                <div className="space-y-1" data-testid="audio-pitch-tempo-progress">
                  <div className="h-1 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-sky-400 transition-[width]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
                  <div data-testid="audio-pitch-tempo-status" className="text-[9px] text-ink-400">{Math.round(progress)}%, {status}</div>
                </div>
              )}
              {!processing && success && <div data-testid="audio-pitch-tempo-success" className="flex items-start gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] p-2 text-[9px] text-emerald-300"><CheckCircle2 size={11} className="mt-0.5 shrink-0" />{success}</div>}
              {error && <div data-testid="audio-pitch-tempo-error" role="alert" className="rounded-md border border-red-500/25 bg-red-500/[0.06] p-2 text-[9px] text-red-300">{error}</div>}
              {activeAsset && <div className="truncate text-[9px] text-ink-400" title={activeAsset.name}>Selected source: {activeAsset.name}</div>}
            </>
          )}
        </div>
      )}
    </section>
  )
}
