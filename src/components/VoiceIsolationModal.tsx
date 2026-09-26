import React, { useState } from 'react'
import {
  X,
  Mic,
  Music2,
  Sliders,
  CheckCircle2,
  Loader2,
  Volume2,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useEditor } from '../store'
import { executeVoiceIsolationForClip, type VoiceIsolationOptions } from '../lib/voiceIsolation'

interface VoiceIsolationModalProps {
  isOpen: boolean
  onClose: () => void
  initialClipId?: string
}

export function VoiceIsolationModal({ isOpen, onClose, initialClipId }: VoiceIsolationModalProps) {
  const clips = useEditor((s) => s.clips)
  const audioVideoClips = clips.filter((c) => c.kind === 'audio' || c.kind === 'video')

  const [selectedClipId, setSelectedClipId] = useState<string>(initialClipId || '')
  const [mode, setMode] = useState<'keep_vocal' | 'remove_vocal'>('keep_vocal')
  const [strength, setStrength] = useState<number>(0.92)
  const [preserveBass, setPreserveBass] = useState<boolean>(true)
  const [speechFocus, setSpeechFocus] = useState<boolean>(true)

  const [processing, setProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<boolean>(false)

  React.useEffect(() => {
    if (initialClipId) {
      setSelectedClipId(initialClipId)
    } else if (audioVideoClips.length > 0 && !selectedClipId) {
      setSelectedClipId(audioVideoClips[0].id)
    }
  }, [initialClipId, audioVideoClips, selectedClipId])

  if (!isOpen) return null

  const effectiveClipId = selectedClipId || initialClipId || audioVideoClips[0]?.id

  const handleExecute = async () => {
    if (!effectiveClipId) {
      setError('Please select an audio or video clip to process.')
      return
    }

    setProcessing(true)
    setProgress(0)
    setStatus('Initializing voice isolation DSP…')
    setError(null)
    setCompleted(false)

    try {
      const options: VoiceIsolationOptions = {
        mode,
        strength,
        preserveBass,
        speechFormantFocus: speechFocus,
      }

      await executeVoiceIsolationForClip(effectiveClipId, options, (pct, msg) => {
        setProgress(pct)
        setStatus(msg)
      })

      setCompleted(true)
      setTimeout(() => {
        onClose()
      }, 600)
    } catch (err) {
      setError((err as Error).message || 'Voice isolation processing failed')
    } finally {
      setProcessing(false)
    }
  }

  const selectedClip = clips.find((c) => c.id === selectedClipId)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-isolation-title"
      data-testid="voice-isolation-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4 bg-ink-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/20 text-brand border border-brand/40">
              <Mic size={18} />
            </div>
            <div>
              <h2 id="voice-isolation-title" className="text-sm font-semibold text-white">
                Isolate Voice & Vocal Removal
              </h2>
              <p className="text-[11px] text-ink-400">
                Mid/Side stereo phase cancellation & speech formant DSP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-voice-isolation-modal"
            className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* Target Clip Selector */}
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1.5">
              Target Timeline Clip
            </label>
            {audioVideoClips.length === 0 ? (
              <div className="p-3 rounded-lg border border-ink-800 bg-ink-950/60 text-xs text-ink-500 text-center">
                No audio or video clips on timeline. Import media and place it on a track first.
              </div>
            ) : (
              <select
                data-testid="voice-isolation-clip-select"
                value={selectedClipId}
                onChange={(e) => setSelectedClipId(e.target.value)}
                disabled={processing}
                className="w-full h-9 rounded-lg border border-ink-700 bg-ink-800 px-3 text-xs text-ink-100 outline-none focus:border-brand"
              >
                {audioVideoClips.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind} · {c.duration.toFixed(1)}s)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mode Selector (Keep Vocal vs Remove Vocal) */}
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-2">
              Processing Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="mode-keep-vocal-btn"
                onClick={() => setMode('keep_vocal')}
                disabled={processing}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                  mode === 'keep_vocal'
                    ? 'border-brand bg-brand/15 ring-2 ring-brand/40 text-white'
                    : 'border-ink-750 bg-ink-850 hover:bg-ink-800 text-ink-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-semibold text-xs">
                  <Mic size={15} className={mode === 'keep_vocal' ? 'text-brand' : 'text-ink-400'} />
                  <span>Keep Vocal</span>
                </div>
                <p className="text-[11px] text-ink-400 leading-snug">
                  Isolates dialogue and singing, attenuating background music and stereo noise.
                </p>
              </button>

              <button
                type="button"
                data-testid="mode-remove-vocal-btn"
                onClick={() => setMode('remove_vocal')}
                disabled={processing}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                  mode === 'remove_vocal'
                    ? 'border-brand bg-brand/15 ring-2 ring-brand/40 text-white'
                    : 'border-ink-750 bg-ink-850 hover:bg-ink-800 text-ink-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-semibold text-xs">
                  <Music2 size={15} className={mode === 'remove_vocal' ? 'text-brand' : 'text-ink-400'} />
                  <span>Remove Vocal</span>
                </div>
                <p className="text-[11px] text-ink-400 leading-snug">
                  Creates an instrumental / karaoke track by canceling center vocals and keeping bass.
                </p>
              </button>
            </div>
          </div>

          {/* Parameters & DSP Options */}
          <div className="space-y-3.5 rounded-xl border border-ink-800 bg-ink-950/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-300 font-medium">Isolation Strength</span>
              <span className="font-mono text-ink-400 font-semibold">{Math.round(strength * 100)}%</span>
            </div>
            <input
              type="range"
              data-testid="voice-isolation-strength-slider"
              aria-label="Isolation strength"
              min={0.1}
              max={1.0}
              step={0.01}
              value={strength}
              disabled={processing}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="of-range w-full"
            />

            <div className="pt-2 border-t border-ink-800/80 space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs text-ink-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="preserve-bass-toggle"
                  checked={preserveBass}
                  disabled={processing}
                  onChange={(e) => setPreserveBass(e.target.checked)}
                  className="rounded border-ink-700 bg-ink-800 text-brand focus:ring-brand/40 h-4 w-4"
                />
                <div>
                  <span className="font-medium">Preserve Low Bass & Kick Drum</span>
                  <p className="text-[10px] text-ink-500">
                    Crossover keeps frequencies &le; 140Hz in mono so bass and rhythm don't thin out.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-ink-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="speech-focus-toggle"
                  checked={speechFocus}
                  disabled={processing}
                  onChange={(e) => setSpeechFocus(e.target.checked)}
                  className="rounded border-ink-700 bg-ink-800 text-brand focus:ring-brand/40 h-4 w-4"
                />
                <div>
                  <span className="font-medium">Speech Formant Bandpass Focus</span>
                  <p className="text-[10px] text-ink-500">
                    Filters out sub audible rumble and high frequency cymbal bleed (130Hz to 6500Hz).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Processing Status & Progress */}
          {processing && (
            <div data-testid="voice-isolation-progress-card" className="space-y-2 p-3.5 rounded-xl border border-brand/40 bg-brand/10 text-xs">
              <div className="flex items-center justify-between text-violet-200 font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-brand" />
                  <span>{status}</span>
                </span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-ink-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Notification */}
          {completed && (
            <div data-testid="voice-isolation-success-alert" className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium">
              <CheckCircle2 size={16} />
              <span>Voice isolation successfully processed and added as a synchronized audio track!</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div data-testid="voice-isolation-error-alert" className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-ink-800 px-5 py-3.5 bg-ink-950/80">
          <button
            type="button"
            data-testid="cancel-voice-isolation-btn"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-lg border border-ink-700 bg-ink-800 hover:bg-ink-750 text-xs font-medium text-ink-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="execute-voice-isolation-btn"
            onClick={handleExecute}
            disabled={processing || audioVideoClips.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-600 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{mode === 'keep_vocal' ? 'Isolate Voice (Keep Vocal)' : 'Remove Vocal (Instrumental)'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
