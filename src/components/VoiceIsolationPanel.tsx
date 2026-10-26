import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines,
  CheckCircle2,
  Download,
  HelpCircle,
  Info,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Sliders,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useEditor } from '../store'
import {
  executeDemucsStemSeparationForClip,
  executeVocalPatchForClip,
  executeVoiceIsolationForClip,
  type VocalInterval,
  type VoiceIsolationModel,
  type VoiceIsolationOptions,
} from '../lib/voiceIsolation'
import { isDemucsModelAvailable } from '../lib/demucs/index.ts'
import { analyzeAudioUrl, type AudioAnalysisSummary } from '../lib/audioAnalysis'
import { AudioRecorderPanel } from './AudioRecorderPanel'
import { AudioPitchTempoPanel } from './AudioPitchTempoPanel'

interface ReviewedInterval extends VocalInterval {
  included: boolean
}

interface StemSession {
  clipId: string
  sourceAssetId: string
  groupId: string
  instrumentalAssetId: string
  stemClipIds: string[]
  intervals: ReviewedInterval[]
  speedFactor: number
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${(safe % 60).toFixed(2).padStart(5, '0')}`
}

export function VoiceIsolationPanel() {
  const clips = useEditor((s) => s.clips)
  const assets = useEditor((s) => s.assets)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectedClipIds = useEditor((s) => s.selectedClipIds)
  const isolationModel = useEditor((s) => s.audioIsolationModel)
  const setAudioIsolationModel = useEditor((s) => s.setAudioIsolationModel)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const openVoiceModal = useEditor((s) => s.openVoiceModal)
  const extractAudio = useEditor((s) => s.extractAudio)
  const audioVideoClips = useMemo(() => clips.filter((c) => c.kind === 'audio' || c.kind === 'video'), [clips])

  const targetClipId =
    (selectedClipId && audioVideoClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : audioVideoClips[0]?.id) || ''

  const [activeClipId, setActiveClipId] = useState<string>(targetClipId)
  const [mode, setMode] = useState<'keep_vocal' | 'remove_vocal'>('keep_vocal')
  const [strength, setStrength] = useState<number>(0.92)
  const [preserveBass, setPreserveBass] = useState<boolean>(true)
  const [speechFocus, setSpeechFocus] = useState<boolean>(true)
  const [speedNormalize, setSpeedNormalize] = useState<boolean>(true)
  const [manualSpeedCorrection, setManualSpeedCorrection] = useState<boolean>(false)
  const [manualSpeedFactor, setManualSpeedFactor] = useState<number>(1.33)
  const [speedOutput, setSpeedOutput] = useState<'timeline' | 'natural'>('timeline')
  const [vadGate, setVadGate] = useState<boolean>(true)
  const [crossfadeMs, setCrossfadeMs] = useState<number>(80)

  const [processing, setProcessing] = useState<boolean>(false)
  const [processingTask, setProcessingTask] = useState<'isolate' | 'batch' | 'stems' | 'patch' | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [demucsReady, setDemucsReady] = useState<boolean | null>(null)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisSummary | null>(null)
  const [stemSession, setStemSession] = useState<StemSession | null>(null)
  const [patchCreated, setPatchCreated] = useState(false)
  const [manualStart, setManualStart] = useState('0.00')
  const [manualEnd, setManualEnd] = useState('1.50')
  const [previewingAssetId, setPreviewingAssetId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const userPickedEngine = useRef(false)

  const currentClip = audioVideoClips.find((c) => c.id === (activeClipId || targetClipId))
  const currentAsset = assets.find((a) => a.id === currentClip?.assetId)
  const sessionClip = clips.find((c) => c.id === stemSession?.clipId)
  const selectedBatchClipIds = selectedClipIds.filter((id) => clips.some((clip) => clip.id === id && clip.kind === 'audio'))

  useEffect(() => {
    let live = true
    void isDemucsModelAvailable().then((ready) => {
      if (!live) return
      setDemucsReady(ready)
      // Demucs is the quality-first default when its local model is installed.
      // Respect an explicit choice made in either the dock or clip inspector.
      if (ready && !userPickedEngine.current && (isolationModel === 'omni-voicetarget' || isolationModel === 'dsp-crossover-fast')) {
        setAudioIsolationModel('htdemucs-v4')
      }
    })
    return () => { live = false }
  }, [isolationModel, setAudioIsolationModel])

  useEffect(() => {
    if (selectedClipId && audioVideoClips.some((c) => c.id === selectedClipId)) {
      setActiveClipId(selectedClipId)
    } else if (targetClipId && !activeClipId) {
      setActiveClipId(targetClipId)
    }
  }, [selectedClipId, targetClipId, activeClipId, audioVideoClips])

  useEffect(() => () => {
    previewAudioRef.current?.pause()
    previewAudioRef.current = null
  }, [])

  const isolatedAssets = assets
    .filter((a) => a.audioStemRole || a.name.includes('[Vocal Isolated]') || a.name.includes('[Vocal Removed]'))
    .slice()
    .reverse()

  const handleModeChange = (nextMode: 'keep_vocal' | 'remove_vocal') => {
    setMode(nextMode)
    if (nextMode === 'remove_vocal' && (isolationModel === 'omni-denoise-onnx' || isolationModel === 'rnnoise-xiph')) {
      setAudioIsolationModel(demucsReady ? 'htdemucs-v4' : 'omni-unified')
    }
  }

  const handleEngineChange = (model: VoiceIsolationModel) => {
    userPickedEngine.current = true
    setAudioIsolationModel(model)
  }

  const handleClipChange = (clipId: string) => {
    setActiveClipId(clipId)
    setStemSession(null)
    setPatchCreated(false)
    setAnalysisResult(null)
    setAnalysisStatus('')
    setError(null)
    setSuccess(null)
  }

  const setProgressState = (pct: number, message: string) => {
    setProgress(pct)
    setStatus(message)
  }

  const handleAnalyzeMusic = async () => {
    if (!currentAsset) {
      setError('Select an audio source before running key/BPM analysis.')
      return
    }
    setAnalysisBusy(true)
    setAnalysisResult(null)
    setError(null)
    setAnalysisStatus('Loading audio…')
    try {
      const result = await analyzeAudioUrl(currentAsset.url, (_pct, message) => setAnalysisStatus(message))
      setAnalysisResult(result)
      setAnalysisStatus('Estimate ready · local analysis only')
    } catch (err) {
      setError((err as Error).message || 'Key/BPM analysis failed')
      setAnalysisStatus('Analysis failed')
    } finally {
      setAnalysisBusy(false)
    }
  }

  const handleExecute = async () => {
    const clipIdToProcess = activeClipId || targetClipId || audioVideoClips[0]?.id
    if (!clipIdToProcess) {
      setError('Add an audio clip to the timeline first. For video, use Separate Audio from Video to expose its soundtrack.')
      return
    }
    if (isolationModel === 'htdemucs-v4' && demucsReady === false) {
      setError('Demucs v4 weights are not available. Run `npm run fetch:demucs`, then reload OmniFrame.')
      return
    }

    setProcessing(true)
    setProcessingTask('isolate')
    setProgress(0)
    setStatus('Preparing audio isolation…')
    setError(null)
    setSuccess(null)
    try {
      const options: VoiceIsolationOptions = {
        mode,
        strength,
        preserveBass,
        speechFormantFocus: speechFocus,
        model: isolationModel,
        vadGate,
        speedNormalize,
        speedFactorOverride: manualSpeedCorrection ? manualSpeedFactor : undefined,
        speedOutput,
      }
      await executeVoiceIsolationForClip(clipIdToProcess, options, setProgressState)
      // Keep the source selected so another operation is applied to the same
      // material rather than recursively isolating the generated output.
      useEditor.getState().selectClip(clipIdToProcess)
      setSuccess(mode === 'keep_vocal'
        ? 'Voice stem created and synchronized to the source clip.'
        : 'Instrumental mix created and synchronized to the source clip.')
    } catch (err) {
      setError((err as Error).message || 'Audio isolation failed')
    } finally {
      setProcessing(false)
      setProcessingTask(null)
    }
  }

  const handleBatchExecute = async () => {
    const batchIds = selectedBatchClipIds.slice()
    if (batchIds.length < 2) {
      setError('Select at least two audio clips on the timeline to run a batch. Extract audio from video clips first.')
      return
    }
    if (demucsSelected && demucsReady === false) {
      setError('Demucs v4 weights are not available. Run `npm run fetch:demucs`, then reload OmniFrame.')
      return
    }
    const options: VoiceIsolationOptions = {
      mode,
      strength,
      preserveBass,
      speechFormantFocus: speechFocus,
      model: isolationModel,
      vadGate,
      speedNormalize,
      speedFactorOverride: manualSpeedCorrection ? manualSpeedFactor : undefined,
      speedOutput,
    }
    setProcessing(true)
    setProcessingTask('batch')
    setProgress(0)
    setStatus(`Batch 1/${batchIds.length} · preparing audio…`)
    setError(null)
    setSuccess(null)
    try {
      for (let index = 0; index < batchIds.length; index++) {
        const currentIndex = index
        await executeVoiceIsolationForClip(batchIds[index], options, (pct, message) => {
          setProgress(Math.round((currentIndex * 100 + pct) / batchIds.length))
          setStatus(`Batch ${currentIndex + 1}/${batchIds.length} · ${message}`)
        })
      }
      useEditor.getState().selectClips(batchIds)
      setSuccess(`${batchIds.length} selected audio clips processed sequentially; each result is synchronized to its source.`)
    } catch (err) {
      setError((err as Error).message || 'Batch audio isolation failed')
    } finally {
      setProcessing(false)
      setProcessingTask(null)
    }
  }

  const handleStemSeparation = async () => {
    const clipIdToProcess = activeClipId || targetClipId || audioVideoClips[0]?.id
    if (!clipIdToProcess) {
      setError('Add an audio clip to the timeline before splitting stems.')
      return
    }
    if (demucsReady === false) {
      setError('Demucs v4 weights are not available. Run `npm run fetch:demucs`, then reload OmniFrame.')
      return
    }
    setProcessing(true)
    setProcessingTask('stems')
    setProgress(0)
    setStatus('Starting Demucs v4 four-stem separation…')
    setError(null)
    setSuccess(null)
    setStemSession(null)
    setPatchCreated(false)
    try {
      const result = await executeDemucsStemSeparationForClip(clipIdToProcess, {
        strength,
        speedNormalize,
        speedFactorOverride: manualSpeedCorrection ? manualSpeedFactor : undefined,
      }, setProgressState)
      const sourceAssetId = audioVideoClips.find((c) => c.id === clipIdToProcess)?.assetId || ''
      setStemSession({
        clipId: clipIdToProcess,
        sourceAssetId,
        groupId: result.groupId,
        instrumentalAssetId: result.instrumentalAssetId,
        stemClipIds: result.stemClipIds,
        intervals: result.intervals.map((item) => ({ ...item, included: true })),
        speedFactor: result.speedFactor,
      })
      setSuccess(result.intervals.length > 0
        ? `Four stems created. Review ${result.intervals.length} suggested vocal range${result.intervals.length === 1 ? '' : 's'} before patching.`
        : 'Four stems created. No vocal ranges were confidently detected; add a range manually if needed.')
    } catch (err) {
      setError((err as Error).message || 'Demucs stem separation failed')
    } finally {
      setProcessing(false)
      setProcessingTask(null)
    }
  }

  const updateInterval = (id: string, patch: Partial<ReviewedInterval>) => {
    setStemSession((session) => session ? {
      ...session,
      intervals: session.intervals.map((item) => item.id === id ? { ...item, ...patch } : item),
    } : session)
  }

  const addManualInterval = () => {
    if (!stemSession) return
    const start = Number(manualStart)
    const end = Number(manualEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      setError('Enter a valid source-media range: start must be non-negative and end must be later.')
      return
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `manual-${Date.now()}-${Math.round(Math.random() * 1e6)}`
    setStemSession({
      ...stemSession,
      intervals: [...stemSession.intervals, { id, start, end, confidence: 0, included: true }]
        .sort((a, b) => a.start - b.start),
    })
    setError(null)
  }

  const handlePatch = async () => {
    if (!stemSession) return
    const chosen = stemSession.intervals.filter((item) => item.included && item.end > item.start)
    if (chosen.length === 0) {
      setError('Select at least one vocal range (or add a range manually) before building the patch mix.')
      return
    }
    setProcessing(true)
    setProcessingTask('patch')
    setProgress(0)
    setStatus('Preparing vocal patch mix…')
    setError(null)
    setSuccess(null)
    try {
      await executeVocalPatchForClip(
        stemSession.clipId,
        stemSession.instrumentalAssetId,
        chosen,
        { crossfadeMs, stemClipIds: stemSession.stemClipIds, groupId: stemSession.groupId },
        setProgressState,
      )
      setPatchCreated(true)
      setSuccess('Patched mix created. The source and separated stems are muted; unmute any stem track to remix.')
    } catch (err) {
      setError((err as Error).message || 'Vocal interval patch failed')
    } finally {
      setProcessing(false)
      setProcessingTask(null)
    }
  }

  const togglePreview = (asset: { id: string; url: string }) => {
    if (previewingAssetId === asset.id) {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      setPreviewingAssetId(null)
      return
    }
    previewAudioRef.current?.pause()
    const audio = new Audio(asset.url)
    audio.onended = () => setPreviewingAssetId(null)
    audio.onerror = () => {
      setPreviewingAssetId(null)
      setError('Could not preview this audio asset in the browser.')
    }
    previewAudioRef.current = audio
    setPreviewingAssetId(asset.id)
    void audio.play().catch(() => {
      setPreviewingAssetId(null)
      setError('Audio preview was blocked by the browser. Try pressing Play again.')
    })
  }

  const jumpToInterval = (interval: VocalInterval) => {
    if (!sessionClip) return
    setPlayhead(Math.max(0, sessionClip.start + interval.start - sessionClip.inPoint))
  }

  const sessionRanges = stemSession?.intervals.filter((item) => {
    if (!sessionClip) return true
    const visibleStart = sessionClip.inPoint
    const visibleEnd = sessionClip.inPoint + sessionClip.duration
    return item.end > visibleStart && item.start < visibleEnd
  }) || []
  const includedRangeCount = sessionRanges.filter((item) => item.included && item.end > item.start).length
  const isKeepOnlyEngine = isolationModel === 'omni-denoise-onnx' || isolationModel === 'rnnoise-xiph'
  const usesDspControls = isolationModel === 'omni-voicetarget' || isolationModel === 'dsp-crossover-fast'
  const demucsSelected = isolationModel === 'htdemucs-v4'

  return (
    <div role="region" aria-label="Audio studio tools and results" tabIndex={0} data-testid="voice-isolation-panel" className="flex h-full flex-col gap-3.5 overflow-y-auto p-3 text-xs text-ink-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
      <div className="border border-ink-700 bg-ink-900/60 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="border border-ink-700 bg-brand/15 p-1.5 text-brand-300"><AudioLines size={16} /></div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-white">Audio Studio · Voice & Music</div>
              <div className="text-[10px] text-ink-400">Record · analyze · isolate · patch</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">Local</span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-300">
          Separate voice, music, drums, bass and other content. Slow + reverb correction and reviewed vocal-range patching are available with Demucs v4.
        </p>
      </div>

      <AudioRecorderPanel />
      <AudioPitchTempoPanel />

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-400">Source clip</label>
        {audioVideoClips.length === 0 ? (
          <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-2.5 text-center text-[11px] text-ink-400">
            No audio or video clips on the timeline. Import audio, then place it on a track.
          </div>
        ) : (
          <div className="space-y-1.5">
            <select
              data-testid="panel-voice-clip-select"
              aria-label="Clip to process"
              value={activeClipId || targetClipId}
              onChange={(e) => handleClipChange(e.target.value)}
              disabled={processing}
              className="h-8 w-full rounded-md border border-ink-700 bg-ink-900 px-2 text-xs text-ink-200 outline-none focus:border-brand"
            >
              {audioVideoClips.map((clip) => (
                <option key={clip.id} value={clip.id}>{clip.name} ({clip.kind} · {clip.duration.toFixed(1)}s)</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              {currentAsset && (
                <button
                  type="button"
                  data-testid="panel-source-preview-btn"
                  onClick={() => togglePreview(currentAsset)}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-ink-700 bg-ink-900/80 px-2 py-1.5 text-[10px] text-ink-300 hover:border-ink-600 hover:text-white"
                  title="Audition the selected source"
                >
                  {previewingAssetId === currentAsset.id ? <Pause size={12} /> : <Play size={12} />}
                  <span>{previewingAssetId === currentAsset.id ? 'Pause source' : 'Preview source'}</span>
                </button>
              )}
              {currentClip?.kind === 'video' && (
                <button
                  type="button"
                  data-testid="panel-separate-audio-btn"
                  title="Create an audio-only timeline clip from this video"
                  onClick={() => extractAudio(currentClip.id)}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded border border-ink-700 bg-ink-900/80 px-2 py-1.5 text-[10px] text-ink-300 hover:border-brand/40 hover:text-white"
                >
                  <AudioLines size={12} className="shrink-0 text-brand-300" />
                  <span className="truncate">Separate video audio</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-900/45 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Music key & tempo</div>
            <div className="text-[9px] text-ink-400">Local estimate · analyzes up to 90 seconds</div>
          </div>
          <button
            type="button"
            data-testid="panel-audio-analysis-btn"
            onClick={handleAnalyzeMusic}
            disabled={!currentAsset || analysisBusy || processing}
            className="flex shrink-0 items-center gap-1.5 rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-[9px] font-medium text-ink-300 hover:border-brand-400/50 hover:text-white disabled:opacity-40"
          >
            {analysisBusy ? <Loader2 size={11} className="animate-spin" /> : <Music2 size={11} />}
            Analyze
          </button>
        </div>
        {analysisBusy && <div data-testid="panel-audio-analysis-status" className="mt-1.5 truncate text-[9px] text-ink-400">{analysisStatus}</div>}
        {analysisResult && (
          <div data-testid="panel-audio-analysis-result" className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-md border border-ink-800 bg-ink-950/70 p-2">
              <div className="text-[9px] uppercase tracking-wide text-ink-400">Estimated key</div>
              <div className="mt-0.5 truncate text-[12px] font-semibold text-brand-200">{analysisResult.key || 'Not detected'}</div>
              <div className="text-[9px] text-ink-400">12-tone chroma profile</div>
            </div>
            <div className="rounded-md border border-ink-800 bg-ink-950/70 p-2">
              <div className="text-[9px] uppercase tracking-wide text-ink-400">Estimated tempo</div>
              <div className="mt-0.5 truncate text-[12px] font-semibold text-brand-200">{analysisResult.bpm ? `≈ ${analysisResult.bpm} BPM` : 'Not detected'}</div>
              {analysisResult.alternativeBpms.length > 0 && <div className="truncate text-[9px] text-ink-400">Half/double: {analysisResult.alternativeBpms.join(' / ')}</div>}
            </div>
            <div className="col-span-2 text-[9px] text-ink-400">Estimated from {analysisResult.analyzedSeconds.toFixed(0)}s · verify by ear; slowed pitch and unusual meters can affect results.</div>
          </div>
        )}
        {!analysisResult && !analysisBusy && analysisStatus && <div className="mt-1.5 truncate text-[9px] text-ink-400">{analysisStatus}</div>}
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-900/45 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="panel-engine-select" className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Isolation engine</label>
          <span className="text-[9px] text-ink-400">local neural model</span>
        </div>
        <select
          aria-label="Isolation engine"
          data-testid="panel-engine-select"
          id="panel-engine-select"
          value={isolationModel}
          disabled={processing}
          onChange={(e) => handleEngineChange(e.target.value as VoiceIsolationModel)}
          className="h-8 w-full rounded-md border border-ink-700 bg-ink-950 px-2 text-[11px] text-ink-100 outline-none focus:border-brand disabled:opacity-50"
        >
          <option value="htdemucs-v4">Demucs v4 · four-stem neural {demucsReady === false ? '(model missing)' : '· best installed local model'}</option>
          <option value="omni-unified">Omni Unified · voice isolation + denoise</option>
          <option value="omni-voicetarget">Omni VoiceTarget · fast stereo DSP</option>
          <option value="dsp-crossover-fast">Crossover DSP · fast/offline</option>
          <option value="omni-denoise-onnx" disabled={mode === 'remove_vocal'}>AI Denoise · voice-focused (keep vocal)</option>
          <option value="rnnoise-xiph" disabled={mode === 'remove_vocal'}>RNNoise · speech-noise cleanup</option>
          <option value="bs-roformer-lite" disabled>BS-Roformer Lite · not installed</option>
        </select>
        {isKeepOnlyEngine && <div className="mt-1 text-[9px] text-amber-300/80">This engine is voice-only; switch to Demucs or Omni Unified for instrumental removal.</div>}
        <div data-testid="panel-demucs-status" className={`mt-1.5 flex items-start gap-1.5 text-[10px] ${demucsReady ? 'text-emerald-300' : demucsReady === false ? 'text-amber-300' : 'text-ink-400'}`}>
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            {demucsReady === true
              ? 'Demucs v4 weights found locally · WAV output · no upload to a third-party service.'
              : demucsReady === false
                ? 'Install the local model with npm run fetch:demucs to enable high-quality four-stem separation.'
                : 'Checking for the local Demucs v4 model…'}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-400">Task</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="panel-mode-keep-vocal"
            onClick={() => handleModeChange('keep_vocal')}
            disabled={processing}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${mode === 'keep_vocal' ? 'border-brand bg-brand/15 text-white' : 'border-ink-800 bg-ink-900/60 text-ink-400 hover:bg-ink-800'}`}
          >
            <Mic size={14} className={mode === 'keep_vocal' ? 'text-brand-300' : ''} />
            <span><span className="block text-[11px] font-medium">Keep voice</span><span className="block text-[9px] text-ink-400">Acapella / dialogue</span></span>
          </button>
          <button
            type="button"
            data-testid="panel-mode-remove-vocal"
            onClick={() => handleModeChange('remove_vocal')}
            disabled={processing}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${mode === 'remove_vocal' ? 'border-brand bg-brand/15 text-white' : 'border-ink-800 bg-ink-900/60 text-ink-400 hover:bg-ink-800'}`}
          >
            <Music2 size={14} className={mode === 'remove_vocal' ? 'text-brand-300' : ''} />
            <span><span className="block text-[11px] font-medium">Remove voice</span><span className="block text-[9px] text-ink-400">Instrumental / karaoke</span></span>
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/45 p-2.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-ink-300">Separation quality</span>
          <span className="font-mono text-ink-400">{strength >= 0.85 ? 'High · 3 passes' : strength >= 0.6 ? 'Balanced · 2 passes' : 'Fast · 1 pass'}</span>
        </div>
        <input
          type="range"
          data-testid="panel-strength-slider"
          aria-label="Isolation strength"
          min={0.1}
          max={1.0}
          step={0.01}
          value={strength}
          disabled={processing}
          onChange={(e) => setStrength(parseFloat(e.target.value))}
          className="of-range w-full"
        />
        <div className="flex items-center justify-between text-[9px] text-ink-400"><span>Fast preview</span><span>{Math.round(strength * 100)}%</span><span>Best quality</span></div>

        {demucsSelected && (
          <div className="space-y-1 border-t border-ink-800 pt-2">
            <label className="flex min-h-[24px] cursor-pointer items-start gap-2 text-[10px] text-ink-300" data-testid="panel-speedfix-toggle">
              <input type="checkbox" checked={speedNormalize} disabled={processing} onChange={(e) => setSpeedNormalize(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400" />
              <span><span className="font-medium">Correct slowed + reverb</span><span className="block text-[9px] text-ink-400">Detects slowed edits, separates at corrected pitch, restores timeline timing.</span></span>
            </label>
            {speedNormalize && (
              <div className="ml-5 space-y-1 rounded-md border border-ink-800 bg-ink-950/60 p-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-ink-300" data-testid="panel-manual-speed-override-toggle">
                  <input type="checkbox" checked={manualSpeedCorrection} disabled={processing} onChange={(e) => setManualSpeedCorrection(e.target.checked)} className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400" />
                  I know the correction factor · override auto
                </label>
                {manualSpeedCorrection && (
                  <>
                    <div className="flex items-center justify-between text-[9px] text-ink-400"><span>Speed-up before separation</span><span className="font-mono">×{manualSpeedFactor.toFixed(2)}</span></div>
                    <input type="range" data-testid="panel-manual-speed-factor" aria-label="Manual slowed-track correction factor" min="1.05" max="1.8" step="0.01" value={manualSpeedFactor} disabled={processing} onChange={(e) => setManualSpeedFactor(parseFloat(e.target.value))} className="of-range w-full" />
                    <div className="text-[9px] text-ink-400">Approximately {Math.round((1 / manualSpeedFactor) * 100)}% original playback speed. Use only when you know the source was slowed; output timing is restored.</div>
                  </>
                )}
              </div>
            )}
            <label className="flex min-h-[24px] cursor-pointer items-start gap-2 text-[10px] text-ink-300" data-testid="panel-vad-toggle">
              <input type="checkbox" checked={vadGate} disabled={processing || mode !== 'keep_vocal'} onChange={(e) => setVadGate(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400" />
              <span><span className="font-medium">Silero pause cleanup</span><span className="block text-[9px] text-ink-400">Safely attenuates residual noise between speech phrases.</span></span>
            </label>
            {mode === 'keep_vocal' && speedNormalize && (
              <label className="flex min-h-[24px] cursor-pointer items-start gap-2 pl-5 text-[10px] text-ink-300" data-testid="panel-natural-pitch-toggle">
                <input type="checkbox" checked={speedOutput === 'natural'} disabled={processing} onChange={(e) => setSpeedOutput(e.target.checked ? 'natural' : 'timeline')} className="mt-0.5 h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400" />
                <span><span className="font-medium">Keep isolated vocals at natural pitch</span><span className="block text-[9px] text-ink-400">Only applies when slowed audio is detected; output is shorter and not timeline-aligned.</span></span>
              </label>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-ink-800 pt-2">
          <label className={`flex items-center gap-1.5 text-[10px] ${mode === 'remove_vocal' ? 'text-ink-300' : 'text-ink-400'}`}>
            <input type="checkbox" data-testid="panel-preserve-bass-toggle" aria-label="Preserve bass" checked={preserveBass} disabled={processing || mode !== 'remove_vocal' || !usesDspControls} onChange={(e) => setPreserveBass(e.target.checked)} className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400" />
            Preserve bass/kick
          </label>
          <label className={`flex items-center gap-1.5 text-[10px] ${mode === 'keep_vocal' ? 'text-ink-300' : 'text-ink-400'}`}>
            <input type="checkbox" data-testid="panel-speech-focus-toggle" aria-label="Speech focus" checked={speechFocus} disabled={processing || mode !== 'keep_vocal' || !usesDspControls} onChange={(e) => setSpeechFocus(e.target.checked)} className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400" />
            Speech formant focus
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          data-testid="panel-execute-voice-btn"
          title={mode === 'keep_vocal' ? 'Isolate voice (keep vocal)' : 'Remove voice (instrumental)'}
          aria-label={mode === 'keep_vocal' ? 'Isolate voice' : 'Remove vocal'}
          onClick={handleExecute}
          disabled={processing || audioVideoClips.length === 0 || (demucsSelected && demucsReady === false)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {processingTask === 'isolate' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span>{mode === 'keep_vocal' ? 'Isolate Voice' : 'Create Instrumental'}</span>
          <span className="ml-auto text-[9px] font-normal text-white/70">{demucsSelected ? 'Demucs v4' : isolationModel}</span>
        </button>

        {selectedBatchClipIds.length > 1 && (
          <div className="space-y-1 rounded-lg border border-ink-800 bg-ink-900/60 p-2">
            <button
              type="button"
              data-testid="panel-batch-isolate-btn"
              onClick={handleBatchExecute}
              disabled={processing || (demucsSelected && demucsReady === false)}
              className="flex w-full items-center justify-center gap-2 rounded border border-ink-700 bg-ink-950 px-3 py-2 text-[10px] font-medium text-ink-200 hover:border-brand/50 hover:text-white disabled:opacity-40"
            >
              {processingTask === 'batch' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Process {selectedBatchClipIds.length} selected audio clips · {mode === 'keep_vocal' ? 'voice' : 'instrumental'}
            </button>
            <div className="text-center text-[9px] text-ink-400">Sequential local processing · separate synchronized result for each clip</div>
          </div>
        )}

        <button
          type="button"
          data-testid="panel-stem-separate-btn"
          onClick={handleStemSeparation}
          disabled={processing || audioVideoClips.length === 0 || !demucsSelected || demucsReady === false}
          title={!demucsSelected ? 'Select Demucs v4 to split drums, bass, other and vocals' : 'Create four aligned stems and detect likely vocal ranges'}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/35 bg-brand/10 px-3 py-2 text-[11px] font-semibold text-brand-200 transition-colors hover:bg-brand/20 disabled:opacity-40"
        >
          {processingTask === 'stems' ? <Loader2 size={13} className="animate-spin" /> : <AudioLines size={13} />}
          <span>Split 4 stems + find vocal ranges</span>
        </button>
        {!demucsSelected && <p className="text-[9px] text-ink-400">Choose Demucs v4 above to enable four-stem separation and vocal timing.</p>}
      </div>

      {processing && (
        <div data-testid="panel-processing-status" className="space-y-1.5 rounded-lg border border-brand/40 bg-brand/10 p-2.5 text-[10px]">
          <div className="flex items-center justify-between gap-2 text-brand-200">
            <span className="flex min-w-0 items-center gap-1.5"><Loader2 size={12} className="shrink-0 animate-spin text-brand-400" /><span className="truncate">{status}</span></span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800"><div className="h-full bg-brand transition-all duration-150" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {success && (
        <div data-testid="panel-success-alert" className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[10px] text-emerald-300">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" /><span>{success}</span>
        </div>
      )}
      {error && <div data-testid="panel-error-alert" role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[10px] text-red-300">{error}</div>}

      {stemSession && (
        <section data-testid="panel-vocal-range-workflow" className="space-y-2 rounded-xl border border-brand/30 bg-brand/[0.06] p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-violet-100">Vocal range review</div>
              <div className="text-[9px] text-ink-400">{stemSession.speedFactor > 1 ? `Speed-corrected ×${stemSession.speedFactor.toFixed(2)} before analysis · ` : ''}times are source-media time</div>
            </div>
            <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[9px] text-ink-400">{includedRangeCount} selected</span>
          </div>
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] p-2 text-[9px] leading-relaxed text-amber-200/80">
            <Info size={11} className="mt-0.5 shrink-0" />
            <span>These are automatic suggestions, not a perfect sung-vocal detector. Listen and adjust the ranges; false positives or missed melodic vocals are possible.</span>
          </div>

          {sessionRanges.length > 0 ? (
            <div data-testid="panel-vocal-range-list" className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
              {sessionRanges.map((interval, index) => (
                <div key={interval.id} data-testid="panel-vocal-range-item" className="grid grid-cols-[16px_1fr_auto] items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950/70 p-1.5">
                  <input
                    type="checkbox"
                    data-testid="panel-vocal-range-toggle"
                    aria-label={`Include vocal range ${index + 1}`}
                    checked={interval.included}
                    disabled={processing || patchCreated}
                    onChange={(e) => updateInterval(interval.id, { included: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[9px] text-ink-300">
                      <label className="sr-only" htmlFor={`range-start-${interval.id}`}>Range {index + 1} start in source seconds</label>
                      <input id={`range-start-${interval.id}`} type="number" min="0" step="0.05" value={interval.start.toFixed(2)} disabled={processing || patchCreated} onChange={(e) => updateInterval(interval.id, { start: Math.max(0, Number(e.target.value) || 0) })} className="w-[58px] rounded border border-ink-700 bg-ink-900 px-1 py-0.5 font-mono text-[9px] text-ink-200" />
                      <span>–</span>
                      <label className="sr-only" htmlFor={`range-end-${interval.id}`}>Range {index + 1} end in source seconds</label>
                      <input id={`range-end-${interval.id}`} type="number" min="0" step="0.05" value={interval.end.toFixed(2)} disabled={processing || patchCreated} onChange={(e) => updateInterval(interval.id, { end: Math.max(0, Number(e.target.value) || 0) })} className="w-[58px] rounded border border-ink-700 bg-ink-900 px-1 py-0.5 font-mono text-[9px] text-ink-200" />
                      <span className="ml-auto text-[9px] text-ink-400">{interval.confidence > 0 ? `${Math.round(interval.confidence * 100)}%` : 'manual'}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[9px] text-ink-400">{formatTime(interval.start)}–{formatTime(interval.end)}</div>
                  </div>
                  <button type="button" data-testid="panel-vocal-range-jump" disabled={!sessionClip} onClick={() => jumpToInterval(interval)} className="rounded border border-ink-700 px-1.5 py-1 text-[9px] text-ink-400 hover:border-brand/50 hover:text-white disabled:opacity-40">Jump</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-ink-800 bg-ink-950/60 p-2 text-[9px] text-ink-400">No ranges passed the confidence threshold. Add a range by entering source-media seconds below.</p>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5 border-t border-ink-800 pt-2">
            <label className="text-[9px] text-ink-400">Start (s)<input type="number" min="0" step="0.05" value={manualStart} onChange={(e) => setManualStart(e.target.value)} disabled={processing || patchCreated} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-950 px-1.5 font-mono text-[10px] text-ink-200" /></label>
            <label className="text-[9px] text-ink-400">End (s)<input type="number" min="0" step="0.05" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} disabled={processing || patchCreated} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-950 px-1.5 font-mono text-[10px] text-ink-200" /></label>
            <button type="button" data-testid="panel-add-vocal-range-btn" onClick={addManualInterval} disabled={processing || patchCreated} className="h-7 rounded border border-ink-700 bg-ink-900 px-2 text-[9px] text-ink-300 hover:border-brand-400/50 disabled:opacity-40">Add range</button>
          </div>

          <div className="space-y-1.5 border-t border-ink-800 pt-2">
            <div className="flex items-center justify-between gap-2 text-[9px] text-ink-400">
              <label htmlFor="panel-patch-crossfade">Patch crossfade</label><span className="font-mono">{crossfadeMs} ms</span>
            </div>
            <input id="panel-patch-crossfade" data-testid="panel-patch-crossfade" type="range" min="20" max="250" step="10" value={crossfadeMs} disabled={processing || patchCreated} onChange={(e) => setCrossfadeMs(parseInt(e.target.value, 10))} className="of-range w-full" />
            <p className="text-[9px] leading-relaxed text-ink-400">The patched copy replaces the chosen ranges with the time-aligned instrumental stem from the same passage, preserving the beat. The original full mix remains available in the library.</p>
          </div>
          <button
            type="button"
            data-testid="panel-create-vocal-patch-btn"
            onClick={handlePatch}
            disabled={processing || patchCreated || includedRangeCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {processingTask === 'patch' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {patchCreated ? 'Patched mix created' : `Create vocal-free patch mix · ${includedRangeCount} range${includedRangeCount === 1 ? '' : 's'}`}
          </button>
        </section>
      )}

      <button
        type="button"
        data-testid="panel-voice-settings-btn"
        title="Voice Isolation Settings"
        aria-label="Voice isolation settings"
        onClick={() => openVoiceModal(activeClipId || targetClipId || audioVideoClips[0]?.id)}
        disabled={audioVideoClips.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 py-2 text-xs font-medium text-ink-300 transition-colors hover:border-ink-600 hover:bg-ink-800/60 disabled:opacity-50"
      >
        <Sliders size={13} /><span>More isolation settings…</span>
      </button>

      {isolatedAssets.length > 0 && (
        <section className="border-t border-ink-800 pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Audio results ({isolatedAssets.length})</label>
            <Volume2 size={12} className="text-ink-400" />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {isolatedAssets.map((asset) => (
              <div key={asset.id} data-testid="isolated-asset-item" className="flex items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-900/50 p-1.5 hover:bg-ink-900">
                <button type="button" data-testid="panel-audio-preview-btn" title={previewingAssetId === asset.id ? 'Pause preview' : 'Preview result'} onClick={() => togglePreview(asset)} className="shrink-0 rounded bg-ink-800 p-1.5 text-ink-300 hover:bg-brand hover:text-white">
                  {previewingAssetId === asset.id ? <Pause size={11} /> : <Play size={11} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[9px] font-medium text-ink-200" title={asset.name}>{asset.name}</div>
                  <div className="text-[9px] text-ink-400">{asset.audioStemRole ? `${asset.audioStemRole} · ` : ''}{asset.duration.toFixed(1)}s · WAV</div>
                </div>
                <a href={asset.url} download={asset.name.replace(/[^a-z0-9._-]+/gi, '_')} title="Download WAV" className="shrink-0 rounded border border-ink-700 p-1.5 text-ink-400 hover:border-ink-500 hover:text-white"><Download size={11} /></a>
                <button
                  type="button"
                  title="Add another copy to the playhead"
                  onClick={() => {
                    const trackId = useEditor.getState().ensureTrack('audio')
                    useEditor.getState().addClipToTrack(trackId, asset.id)
                  }}
                  className="shrink-0 rounded border border-ink-700 p-1.5 text-ink-400 hover:border-brand/50 hover:text-white"
                ><Plus size={11} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-start gap-1.5 border-t border-ink-800 pt-2 text-[9px] leading-relaxed text-ink-400" title="Neural separation is an estimate. Results depend on the recording and may retain instrumental or vocal bleed.">
        <HelpCircle size={11} className="mt-0.5 shrink-0" />
        <span>Source separation is an estimate, not a guaranteed perfect match. Use preview/download to review before replacing original audio.</span>
      </div>
    </div>
  )
}
