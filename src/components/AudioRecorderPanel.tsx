import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Loader2, Mic, Square, Waves } from 'lucide-react'
import { useEditor } from '../store'
import { computeBufferWaveform, encodeAudioBufferToWav } from '../lib/voiceIsolation'

const MAX_RECORDING_SECONDS = 180

type RecorderEffects = {
  bassDb: number
  presenceDb: number
  airDb: number
  reverb: number
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`
}

function createRoomImpulse(context: OfflineAudioContext, seconds = 1.8): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds))
  const channels = Math.min(2, context.destination.channelCount || 2)
  const impulse = context.createBuffer(channels, length, context.sampleRate)
  for (let channel = 0; channel < channels; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const fade = Math.pow(1 - i / length, 2.4)
      // Fixed seed makes the same settings repeatable between recordings.
      const n = Math.sin((i + 1) * (channel + 1) * 12.9898) * 43758.5453
      data[i] = (2 * (n - Math.floor(n)) - 1) * fade
    }
  }
  return impulse
}

async function applyRecorderEffects(input: AudioBuffer, effects: RecorderEffects): Promise<AudioBuffer> {
  const hasEq = Math.abs(effects.bassDb) + Math.abs(effects.presenceDb) + Math.abs(effects.airDb) > 0.001
  if (!hasEq && effects.reverb <= 0.001) return input

  const channels = input.numberOfChannels
  const offline = new OfflineAudioContext(channels, input.length, input.sampleRate)
  const source = offline.createBufferSource()
  source.buffer = input

  const bass = offline.createBiquadFilter()
  bass.type = 'lowshelf'
  bass.frequency.value = 140
  bass.gain.value = effects.bassDb
  const presence = offline.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 1800
  presence.Q.value = 0.8
  presence.gain.value = effects.presenceDb
  const air = offline.createBiquadFilter()
  air.type = 'highshelf'
  air.frequency.value = 7200
  air.gain.value = effects.airDb
  source.connect(bass)
  bass.connect(presence)
  presence.connect(air)

  if (effects.reverb > 0.001) {
    const dry = offline.createGain()
    const wet = offline.createGain()
    const convolver = offline.createConvolver()
    const wetMix = Math.max(0, Math.min(0.55, effects.reverb))
    // Equal-power crossfade; avoid an automatic level jump as the user moves
    // the reverb control from dry to wet.
    dry.gain.value = Math.cos(wetMix * Math.PI / 2)
    wet.gain.value = Math.sin(wetMix * Math.PI / 2)
    convolver.buffer = createRoomImpulse(offline)
    air.connect(dry)
    air.connect(convolver)
    convolver.connect(wet)
    dry.connect(offline.destination)
    wet.connect(offline.destination)
  } else {
    air.connect(offline.destination)
  }

  source.start(0)
  return offline.startRendering()
}

export function AudioRecorderPanel() {
  const [expanded, setExpanded] = useState(false)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [effects, setEffects] = useState<RecorderEffects>({ bassDb: 0, presenceDb: 0, airDb: 0, reverb: 0 })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const insertAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const effectsRef = useRef(effects)

  const setEffect = (key: keyof RecorderEffects, value: number) => {
    const next = { ...effects, [key]: value }
    effectsRef.current = next
    setEffects(next)
  }

  const releaseCapture = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const saveRecording = async (blob: Blob) => {
    if (!blob.size) {
      setError('The microphone returned an empty recording. Check mic permission and try again.')
      return
    }
    setProcessing(true)
    setError(null)
    setSuccess(null)
    setStatus('Preparing recording and applying EQ/reverb…')
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioCtxClass()
    try {
      const input = await context.decodeAudioData(await blob.arrayBuffer())
      const rendered = await applyRecorderEffects(input, effectsRef.current)
      const wav = encodeAudioBufferToWav(rendered)
      const url = URL.createObjectURL(wav)
      const assetId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `voice-recording-${Date.now()}`
      const assetName = `Voice Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-')}.wav`
      const asset = {
        id: assetId,
        name: assetName,
        kind: 'audio' as const,
        url,
        duration: rendered.duration,
        width: 0,
        height: 0,
        size: wav.size,
        waveform: computeBufferWaveform(rendered, 256),
      }
      const state = useEditor.getState()
      state.addAsset(asset)
      const trackId = state.ensureTrack('audio')
      state.addClipToTrack(trackId, assetId, insertAtRef.current)
      const clip = useEditor.getState().clips.find((item) => item.assetId === assetId)
      if (clip) useEditor.getState().selectClip(clip.id)
      setStatus('')
      setSuccess(`Recording added to the timeline at ${formatDuration(insertAtRef.current)}.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`Could not decode or prepare the microphone recording: ${message}`)
      setStatus('')
    } finally {
      await context.close()
      setProcessing(false)
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not provide microphone recording. Use a secure browser origin or import an audio file instead.')
      return
    }
    setError(null)
    setSuccess(null)
    setStatus('Requesting microphone permission…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream
      chunksRef.current = []
      insertAtRef.current = Math.max(0, useEditor.getState().playhead)
      startedAtRef.current = Date.now()
      const preferredMimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setError('The browser stopped microphone recording unexpectedly.')
        setStatus('')
        setRecording(false)
        releaseCapture()
      }
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        setRecording(false)
        releaseCapture()
        if (audioBlob.size > 0) void saveRecording(audioBlob)
        else setError('The microphone returned an empty recording. Check mic permission and try again.')
      }
      recorder.start(250)
      setElapsed(0)
      setStatus('Recording locally. Stop to apply EQ/reverb and add the take to the timeline.')
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(seconds)
        if (seconds >= MAX_RECORDING_SECONDS) stopRecording()
      }, 250)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message.toLowerCase().includes('denied') || message.toLowerCase().includes('permission')
        ? 'Microphone permission was denied. Allow mic access in the browser, then try again.'
        : `Could not start microphone capture: ${message}`)
      setStatus('')
      releaseCapture()
    }
  }

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (recorder) {
      // A dock unmount should cancel capture rather than unexpectedly placing
      // a take on the timeline after the user has left the Audio section.
      recorder.onstop = null
      recorder.ondataavailable = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  return (
    <section data-testid="audio-recorder-panel" className="rounded-xl border border-ink-800 bg-ink-950/60">
      <button
        type="button"
        data-testid="audio-recorder-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="rounded-md border border-rose-400/25 bg-rose-500/10 p-1.5 text-rose-300"><Mic size={13} /></span>
          <span className="min-w-0"><span className="block text-[10px] font-semibold text-ink-100">Voice recorder, EQ & reverb</span><span className="block text-[9px] leading-snug text-ink-400">Capture a local mic take and place it at the playhead</span></span>
        </span>
        <ChevronDown size={13} className={`shrink-0 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-2.5 border-t border-ink-800 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900/50 px-2.5 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-ink-200"><Waves size={12} className="text-rose-300" />Microphone capture</div>
              <div className="mt-0.5 text-[9px] text-ink-400">Up to 3 minutes, processed and stored locally</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span data-testid="audio-recorder-timer" className={`font-mono text-[11px] ${recording ? 'text-rose-300' : 'text-ink-400'}`}>{formatDuration(elapsed)}</span>
              {recording ? (
                <button type="button" data-testid="audio-recorder-stop" onClick={stopRecording} className="flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2.5 py-1.5 text-[9px] font-semibold text-rose-200 hover:bg-rose-500/30"><Square size={10} fill="currentColor" />Stop & add</button>
              ) : (
                <button type="button" data-testid="audio-recorder-start" onClick={() => void startRecording()} disabled={processing} className="flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-[9px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-40"><Mic size={11} />Record</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {([
              ['bassDb', 'Low shelf', -9, 9, 'dB'],
              ['presenceDb', 'Presence', -9, 9, 'dB'],
              ['airDb', 'High shelf', -9, 9, 'dB'],
              ['reverb', 'Room reverb', 0, 0.55, ''],
            ] as const).map(([key, label, min, max, unit]) => (
              <label key={key} className="min-w-0 text-[9px] text-ink-400">
                <span className="flex items-center justify-between gap-1"><span>{label}</span><span className="font-mono text-ink-300">{key === 'reverb' ? `${Math.round(effects[key] * 100)}%` : `${effects[key] > 0 ? '+' : ''}${effects[key]} ${unit}`}</span></span>
                <input
                  type="range"
                  data-testid={`audio-recorder-${key}`}
                  aria-label={label}
                  min={min}
                  max={max}
                  step={key === 'reverb' ? 0.01 : 1}
                  value={effects[key]}
                  disabled={recording || processing}
                  onChange={(event) => setEffect(key, Number(event.target.value))}
                  className="of-range mt-1 w-full"
                />
              </label>
            ))}
          </div>
          {status && <div data-testid="audio-recorder-status" className="flex items-center gap-1.5 text-[9px] text-ink-400">{processing && <Loader2 size={10} className="animate-spin" />}{status}</div>}
          {success && <div data-testid="audio-recorder-success" className="flex items-start gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] p-2 text-[9px] text-emerald-300"><CheckCircle2 size={11} className="mt-0.5 shrink-0" />{success}</div>}
          {error && <div data-testid="audio-recorder-error" role="alert" className="rounded-md border border-red-500/25 bg-red-500/[0.06] p-2 text-[9px] text-red-300">{error}</div>}
          {recording && <div className="text-[9px] leading-relaxed text-amber-300/80">EQ and reverb settings are applied after you stop. The original mic capture is not uploaded.</div>}
        </div>
      )}
    </section>
  )
}
