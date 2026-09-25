import React, { useState } from 'react'
import {
  Mic,
  Music2,
  Sliders,
  CheckCircle2,
  Loader2,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Plus,
} from 'lucide-react'
import { useEditor } from '../store'
import { executeVoiceIsolationForClip, type VoiceIsolationOptions } from '../lib/voiceIsolation'

export function VoiceIsolationPanel() {
  const clips = useEditor((s) => s.clips)
  const assets = useEditor((s) => s.assets)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const audioVideoClips = clips.filter((c) => c.kind === 'audio' || c.kind === 'video')

  const targetClipId =
    (selectedClipId && audioVideoClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : audioVideoClips[0]?.id) || ''

  const [activeClipId, setActiveClipId] = useState<string>(targetClipId)
  const [mode, setMode] = useState<'keep_vocal' | 'remove_vocal'>('keep_vocal')
  const [strength, setStrength] = useState<number>(0.92)
  const [preserveBass, setPreserveBass] = useState<boolean>(true)
  const [speechFocus, setSpeechFocus] = useState<boolean>(true)

  const [processing, setProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  React.useEffect(() => {
    if (targetClipId && !activeClipId) {
      setActiveClipId(targetClipId)
    }
  }, [targetClipId, activeClipId])

  // Isolated assets in project library
  const isolatedAssets = assets.filter(
    (a) => a.name.includes('[Vocal Isolated]') || a.name.includes('[Vocal Removed]'),
  )

  const handleExecute = async () => {
    const clipIdToProcess = activeClipId || targetClipId || audioVideoClips[0]?.id
    if (!clipIdToProcess) {
      setError('Please add an audio or video clip to the timeline first.')
      return
    }

    setProcessing(true)
    setProgress(0)
    setStatus('Initializing voice isolation DSP…')
    setError(null)
    setSuccess(false)

    try {
      const options: VoiceIsolationOptions = {
        mode,
        strength,
        preserveBass,
        speechFormantFocus: speechFocus,
      }

      await executeVoiceIsolationForClip(clipIdToProcess, options, (pct, msg) => {
        setProgress(pct)
        setStatus(msg)
      })

      setSuccess(true)
    } catch (err) {
      setError((err as Error).message || 'Voice isolation processing failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div data-testid="voice-isolation-panel" className="flex flex-col h-full p-3.5 space-y-4 text-xs select-none">
      {/* Overview Banner */}
      <div className="p-3 rounded-xl border border-brand/30 bg-brand/10">
        <div className="flex items-center gap-2 font-semibold text-brand mb-1">
          <Mic size={14} />
          <span>Voice Isolation & Vocal Removal</span>
        </div>
        <p className="text-[11px] text-ink-400 leading-relaxed">
          Isolate speech vocals or remove singing for karaoke and instrumental backing tracks using high-fidelity Mid/Side crossover DSP.
        </p>
      </div>

      {/* Target Clip */}
      <div>
        <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
          Source Clip
        </label>
        {audioVideoClips.length === 0 ? (
          <div className="p-3 rounded-lg border border-ink-800 bg-ink-900/60 text-ink-500 text-center">
            No audio or video clips on timeline. Place media on a track to isolate voices.
          </div>
        ) : (
          <select
            data-testid="panel-voice-clip-select"
            value={activeClipId || targetClipId}
            onChange={(e) => setActiveClipId(e.target.value)}
            disabled={processing}
            className="w-full h-8 rounded-md border border-ink-700 bg-ink-900 px-2 text-xs text-ink-200 outline-none focus:border-brand"
          >
            {audioVideoClips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind} · {c.duration.toFixed(1)}s)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mode Selection */}
      <div>
        <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
          Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="panel-mode-keep-vocal"
            onClick={() => setMode('keep_vocal')}
            disabled={processing}
            className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-colors ${
              mode === 'keep_vocal'
                ? 'border-brand bg-brand/20 text-white font-medium'
                : 'border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-400'
            }`}
          >
            <Mic size={13} className={mode === 'keep_vocal' ? 'text-brand' : ''} />
            <span className="truncate">Keep Vocal</span>
          </button>

          <button
            type="button"
            data-testid="panel-mode-remove-vocal"
            onClick={() => setMode('remove_vocal')}
            disabled={processing}
            className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-colors ${
              mode === 'remove_vocal'
                ? 'border-brand bg-brand/20 text-white font-medium'
                : 'border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-400'
            }`}
          >
            <Music2 size={13} className={mode === 'remove_vocal' ? 'text-brand' : ''} />
            <span className="truncate">Remove Vocal</span>
          </button>
        </div>
      </div>

      {/* DSP Parameters */}
      <div className="space-y-3 rounded-lg border border-ink-800 bg-ink-900/60 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-ink-300">Separation Strength</span>
          <span className="font-mono text-ink-400">{Math.round(strength * 100)}%</span>
        </div>
        <input
          type="range"
          data-testid="panel-strength-slider"
          min={0.1}
          max={1.0}
          step={0.01}
          value={strength}
          disabled={processing}
          onChange={(e) => setStrength(parseFloat(e.target.value))}
          className="of-range w-full"
        />

        <div className="pt-2 border-t border-ink-800/80 space-y-2">
          <label className="flex items-center gap-2 text-[11px] text-ink-300 cursor-pointer">
            <input
              type="checkbox"
              data-testid="panel-preserve-bass-toggle"
              checked={preserveBass}
              disabled={processing}
              onChange={(e) => setPreserveBass(e.target.checked)}
              className="rounded border-ink-700 bg-ink-800 text-brand"
            />
            <span>Preserve Bass & Kick Drum (&le; 140Hz)</span>
          </label>

          <label className="flex items-center gap-2 text-[11px] text-ink-300 cursor-pointer">
            <input
              type="checkbox"
              data-testid="panel-speech-focus-toggle"
              checked={speechFocus}
              disabled={processing}
              onChange={(e) => setSpeechFocus(e.target.checked)}
              className="rounded border-ink-700 bg-ink-800 text-brand"
            />
            <span>Speech Formant Bandpass Focus</span>
          </label>
        </div>
      </div>

      {/* Progress & Feedback */}
      {processing && (
        <div data-testid="panel-processing-status" className="space-y-1.5 p-2.5 rounded-lg border border-brand/40 bg-brand/10 text-[11px]">
          <div className="flex items-center justify-between text-violet-200">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-brand" />
              <span>{status}</span>
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {success && (
        <div data-testid="panel-success-alert" className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px]">
          <CheckCircle2 size={14} />
          <span>Synchronized audio track created on timeline!</span>
        </div>
      )}

      {error && (
        <div data-testid="panel-error-alert" className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-[11px]">
          {error}
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        data-testid="panel-execute-voice-btn"
        onClick={handleExecute}
        disabled={processing || audioVideoClips.length === 0}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-brand hover:bg-brand-600 text-white font-medium text-xs shadow-md transition-colors disabled:opacity-50"
      >
        {processing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        <span>{mode === 'keep_vocal' ? 'Isolate Voice (Keep Vocal)' : 'Remove Vocal (Instrumental)'}</span>
      </button>

      {/* Recent Isolated Audio Tracks in Project */}
      {isolatedAssets.length > 0 && (
        <div className="pt-2 border-t border-ink-800">
          <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-2">
            Isolated Audio Assets ({isolatedAssets.length})
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {isolatedAssets.map((asset) => (
              <div
                key={asset.id}
                data-testid="isolated-asset-item"
                className="flex items-center justify-between p-2 rounded-lg border border-ink-800 bg-ink-900/40 hover:bg-ink-850"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-medium text-ink-200 truncate">{asset.name}</div>
                  <div className="text-[10px] text-ink-500">{asset.duration.toFixed(1)}s</div>
                </div>
                <button
                  type="button"
                  title="Add to timeline"
                  onClick={() => {
                    const trkId = useEditor.getState().ensureTrack('audio')
                    useEditor.getState().addClipToTrack(trkId, asset.id)
                  }}
                  className="p-1 rounded bg-ink-800 hover:bg-brand text-ink-300 hover:text-white"
                >
                  <Plus size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
