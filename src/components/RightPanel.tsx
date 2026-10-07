import React, { useEffect, useRef, useState } from 'react'
import {
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  PictureInPicture2,
  X,
  Trash2,
  Scissors,
  AudioLines,
  Volume2,
  Diamond,
  Activity,
  FolderOpen,
  FolderOutput,
  Layers,
  SlidersHorizontal,
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'
import type { Clip } from '../types'
import { Field, Section, Slider, AccordionGroup } from './ui'
import { formatClock } from '../lib/time'
import { executeVoiceIsolationForClip, type VoiceIsolationModel } from '../lib/voiceIsolation'
import { isDemucsModelAvailable } from '../lib/demucs/index.ts'
import { loudnessGain, measureIntegratedLufs } from '../lib/loudness'
import { SectionsNavigator } from './SectionsNav'

function ClipInspector({ clip }: { clip: Clip }) {
  const assets = useEditor((s) => s.assets)
  const setClipProp = useEditor((s) => s.setClipProp)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const removeClip = useEditor((s) => s.removeClip)
  const splitAt = useEditor((s) => s.splitAt)
  const extractAudio = useEditor((s) => s.extractAudio)
  const defaultModel = useEditor((s) => s.audioIsolationModel)
  const playhead = useEditor((s) => s.playhead)
  const setClipKeyframe = useEditor((s) => s.setClipKeyframe)
  const removeClipKeyframe = useEditor((s) => s.removeClipKeyframe)
  const setGraphEditorOpen = useEditor((s) => s.setGraphEditorOpen)
  const setActiveCurveProperty = useEditor((s) => s.setActiveCurveProperty)
  const asset = assets.find((a) => a.id === clip.assetId)
  const t = clip.transform

  const [isolationEnabled, setIsolationEnabled] = useState(false)
  const [isolationMode, setIsolationMode] = useState<'remove_vocal' | 'keep_vocal'>('remove_vocal')
  const [isolationModel, setIsolationModel] = useState<VoiceIsolationModel>(defaultModel || 'omni-voicetarget')
  const [demucsReady, setDemucsReady] = useState<boolean | null>(null)
  const [vadCleanup, setVadCleanup] = useState(true)
  const [speedFix, setSpeedFix] = useState(true)
  const [speedNatural, setSpeedNatural] = useState(false)
  useEffect(() => {
    let alive = true
    isDemucsModelAvailable().then((ok) => {
      if (!alive) return
      setDemucsReady(ok)
      // Auto-select the real neural model when its weights are downloaded
      // (public/models/htdemucs.onnx via `npm run fetch:demucs`).
      if (ok) setIsolationModel((m) => (m === 'omni-voicetarget' ? 'htdemucs-v4' : m))
    })
    return () => { alive = false }
  }, [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isolationStatus, setIsolationStatus] = useState<string | null>(null)

  // Loudness normalization (BS.1770-4 integrated LUFS)
  const [loudnessEnabled, setLoudnessEnabled] = useState(false)
  const [targetLufs, setTargetLufs] = useState(-16)
  const [measuredLufs, setMeasuredLufs] = useState<number | null>(null)
  const [loudnessBusy, setLoudnessBusy] = useState(false)
  const [loudnessStatus, setLoudnessStatus] = useState<string | null>(null)

  const measureClipLoudness = async (): Promise<number | null> => {
    if (!asset) return null
    setLoudnessBusy(true)
    try {
      const res = await fetch(asset.url)
      const buf = await res.arrayBuffer()
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const audio = await ctx.decodeAudioData(buf)
      const mono = new Float32Array(audio.length)
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const d = audio.getChannelData(ch)
        for (let i = 0; i < audio.length; i++) mono[i] += d[i] / audio.numberOfChannels
      }
      await ctx.close()
      const lufs = measureIntegratedLufs([mono], audio.sampleRate)
      setMeasuredLufs(lufs)
      return lufs
    } catch {
      setLoudnessStatus('Could not decode audio for measurement')
      return null
    } finally {
      setLoudnessBusy(false)
    }
  }

  const clipTime = Math.max(0, playhead - clip.start)

  // Helper to render keyframe toggle diamond and curve button
  const renderKeyframeControl = (propertyId: string, currentValue: number) => {
    const curve = clip.animation?.curves?.[propertyId]
    const existingKey = curve?.keyframes?.find((k) => Math.abs(k.time - clipTime) < 0.05)
    const hasKey = !!existingKey

    const handleToggle = () => {
      if (hasKey && existingKey) {
        removeClipKeyframe(clip.id, propertyId, existingKey.id)
      } else {
        setClipKeyframe(clip.id, propertyId, clipTime, currentValue, 'bezier')
      }
    }

    const handleOpenCurve = () => {
      setActiveCurveProperty(propertyId)
      setGraphEditorOpen(true)
    }

    return (
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          data-testid={`keyframe-diamond-${propertyId}`}
          title={hasKey ? 'Remove Keyframe at Current Time' : 'Add Keyframe at Current Time'}
          aria-label={hasKey ? 'Remove keyframe at current time' : 'Add keyframe at current time'}
          aria-pressed={hasKey}
          onClick={handleToggle}
          className={`flex min-h-8 min-w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            hasKey ? 'text-brand-400' : 'text-ink-500 hover:text-ink-200'
          }`}
        >
          <Diamond size={13} fill={hasKey ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          data-testid={`open-curve-${propertyId}`}
          title="Open in Curve Graph Editor"
          aria-label={`Open ${propertyId.replace(/_/g, ' ')} in curve graph editor`}
          onClick={handleOpenCurve}
          className="flex min-h-8 min-w-8 items-center justify-center rounded text-ink-500 transition-colors hover:bg-ink-800 hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Activity size={12} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <Section title="Clip">
        <div className="flex items-center justify-between gap-2">
          <input
            aria-label="Clip name"
            value={clip.name}
            onChange={(e) => setClipProp(clip.id, { name: e.target.value })}
            className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
          />
        </div>
        <div className="text-[10px] text-ink-500 mt-1">
          {asset?.kind} · {formatClock(clip.duration)} on track
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => splitAt(useEditor.getState().playhead)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-ink-800 border border-ink-700 text-xs hover:bg-ink-700"
          >
            <Scissors size={13} /> Split
          </button>
          <button
            type="button"
            onClick={() => removeClip(clip.id)}
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-ink-800 border border-ink-700 text-xs text-bad hover:bg-ink-700"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
        {clip.kind === 'compound' && (
          <div className="mt-2 p-2 rounded bg-indigo-950/60 border border-indigo-500/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-400" />
                <span>Compound Sequence</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-300">
                {clip.nestedTrackCount || 1} Tracks · {clip.nestedClipCount || 1} Clips
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                data-testid="inspector-open-compound-btn"
                title="Open Compound Clip Timeline"
                aria-label="Open compound clip timeline"
                onClick={() => {
                  if (clip.sourceSequenceId) useEditor.getState().openSequence(clip.sourceSequenceId)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-medium transition-colors truncate"
              >
                <FolderOpen size={12} className="shrink-0" />
                <span className="truncate">Open Timeline</span>
              </button>
              <button
                type="button"
                data-testid="inspector-uncompound-btn"
                title="Decompose Compound Clip into Individual Tracks"
                aria-label="Decompose compound clip"
                onClick={() => useEditor.getState().uncompoundClip(clip.id)}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-medium transition-colors truncate"
              >
                <FolderOutput size={12} className="shrink-0" />
                <span className="truncate">Decompose</span>
              </button>
            </div>
          </div>
        )}
        {clip.kind === 'video' && !assets.some((item) => item.extractedFromClipId === clip.id) && (
          <button
            type="button"
            title="Extract audio stream to separate audio track"
            aria-label="Extract audio"
            onClick={() => void extractAudio(clip.id)}
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 text-xs hover:bg-ink-700 truncate"
          >
            <AudioLines size={13} className="shrink-0" />
            <span className="truncate">Extract audio</span>
          </button>
        )}
      </Section>

      <Section title="Transform">
        <Field label="Position X">
          <Slider label="Position X" min={-960} max={960} value={t.x} onChange={(v) => setClipTransform(clip.id, { x: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.x)}</span>
          {renderKeyframeControl('position_x', t.x)}
        </Field>
        <Field label="Position Y">
          <Slider label="Position Y" min={-540} max={540} value={t.y} onChange={(v) => setClipTransform(clip.id, { y: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.y)}</span>
          {renderKeyframeControl('position_y', t.y)}
        </Field>
        <Field label="Scale">
          <Slider label="Scale" min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => setClipTransform(clip.id, { scale: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{t.scale.toFixed(2)}</span>
          {renderKeyframeControl('scale_x', t.scale)}
        </Field>
        <Field label={<span className="flex items-center gap-1.5"><BlenderRotationIcon size={13} /><span>Rotation</span></span>}>
          <Slider label="Rotation" min={-180} max={180} value={t.rotation} onChange={(v) => setClipTransform(clip.id, { rotation: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotation)}°</span>
          {renderKeyframeControl('rotation_z', t.rotation)}
        </Field>
        {/* 3D Spatial Properties: Clean Accordion Sub-Group */}
        <AccordionGroup
          title="3D Spatial (Depth, Tilt, Pan)"
          defaultOpen={Boolean(t.z || t.rotationX || t.rotationY)}
        >
          <Field label="3D Depth (Z)">
            <Slider label="3D Depth (Z)" min={-1000} max={1000} value={t.z ?? 0} onChange={(v) => setClipTransform(clip.id, { z: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.z ?? 0)}</span>
            {renderKeyframeControl('position_z', t.z ?? 0)}
          </Field>
          <Field label="Rotation X (Tilt)">
            <Slider label="Rotation X (Tilt)" min={-180} max={180} value={t.rotationX ?? 0} onChange={(v) => setClipTransform(clip.id, { rotationX: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotationX ?? 0)}°</span>
            {renderKeyframeControl('rotation_x', t.rotationX ?? 0)}
          </Field>
          <Field label="Rotation Y (Pan)">
            <Slider label="Rotation Y (Pan)" min={-180} max={180} value={t.rotationY ?? 0} onChange={(v) => setClipTransform(clip.id, { rotationY: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotationY ?? 0)}°</span>
            {renderKeyframeControl('rotation_y', t.rotationY ?? 0)}
          </Field>
        </AccordionGroup>
      </Section>

      <Section title="Appearance">
        <Field label="Opacity">
          <Slider label="Opacity" min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => setClipTransform(clip.id, { opacity: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.opacity * 100)}</span>
          {renderKeyframeControl('opacity', t.opacity)}
        </Field>
      </Section>

      {(clip.kind === 'audio' || clip.kind === 'video') && (
        <Section title="Audio">
          <Field label="Volume">
            <Slider label="Volume"
              min={0}
              max={2}
              step={0.01}
              value={clip.volume ?? 1}
              onChange={(v) => setClipProp(clip.id, { volume: v })}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">
              {Math.round((clip.volume ?? 1) * 100)}%
            </span>
          </Field>

          {/* Loudness Normalization (BS.1770-4 LUFS) */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none" title="Measure integrated loudness (ITU-R BS.1770-4) and apply gain to hit the target LUFS">
              <input
                type="checkbox"
                data-testid="audio-loudness-checkbox"
                checked={loudnessEnabled}
                onChange={(e) => {
                  setLoudnessEnabled(e.target.checked)
                  if (e.target.checked && measuredLufs === null) void measureClipLoudness()
                }}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand focus:ring-offset-ink-900 cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-200">Loudness Normalization</span>
              <span className="ml-auto font-mono text-[10px] text-ink-400" data-testid="audio-loudness-measured">
                {measuredLufs === null ? '' : `${measuredLufs.toFixed(1)} LUFS`}
              </span>
            </label>

            {loudnessEnabled && (
              <div data-testid="audio-loudness-controls" className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-semibold uppercase text-ink-400">Target</label>
                  <span className="font-mono text-[11px] text-brand-400" data-testid="audio-loudness-target-label">
                    {targetLufs.toFixed(1)} LUFS
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="audio-loudness-target-slider"
                  aria-label="Target loudness in LUFS"
                  min={-24}
                  max={-10}
                  step={0.5}
                  value={targetLufs}
                  onChange={(e) => setTargetLufs(parseFloat(e.target.value))}
                  className="of-range w-full"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="audio-loudness-remasure-btn"
                    disabled={loudnessBusy}
                    onClick={() => void measureClipLoudness()}
                    className="flex-1 h-7.5 rounded-md bg-ink-800 hover:bg-ink-750 border border-ink-700 text-ink-200 text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    {loudnessBusy ? 'Measuring…' : 'Measure'}
                  </button>
                  <button
                    type="button"
                    data-testid="audio-loudness-apply-btn"
                    disabled={loudnessBusy}
                    onClick={async () => {
                      const lufs = measuredLufs ?? (await measureClipLoudness())
                      if (lufs === null || !isFinite(lufs)) {
                        setLoudnessStatus('No measurable audio')
                        return
                      }
                      const gain = loudnessGain(lufs, targetLufs)
                      const clamped = Math.max(0.02, Math.min(2, gain))
                      setClipProp(clip.id, { volume: clamped })
                      const db = 20 * Math.log10(clamped)
                      setLoudnessStatus(
                        `${lufs.toFixed(1)} → ${targetLufs.toFixed(1)} LUFS (gain ${db >= 0 ? '+' : ''}${db.toFixed(1)} dB` +
                          `${clamped !== gain ? `, capped at ${(20 * Math.log10(clamped)).toFixed(1)} dB` : ''})`,
                      )
                    }}
                    className="flex-1 h-7.5 rounded-md bg-brand hover:bg-brand-600 text-white text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    Normalize
                  </button>
                </div>
                {loudnessStatus && <p className="text-[10px] text-ink-400 font-mono truncate" data-testid="audio-loudness-status">{loudnessStatus}</p>}
                <p className="text-[9px] leading-relaxed text-ink-500">
                  Streaming target −16 LUFS (podcast), −14 for music platforms. Gain above +0 dB is capped by browser playback.
                </p>
              </div>
            )}
          </div>

          {/* Voice Isolation Checkbox */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="audio-voice-isolation-checkbox"
                checked={isolationEnabled}
                onChange={(e) => setIsolationEnabled(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand focus:ring-offset-ink-900 cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-200">Voice Isolation</span>
            </label>

            {/* Custom dropdown underneath when checkbox is selected */}
            {isolationEnabled && (
              <div
                data-testid="audio-isolation-controls"
                className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-ink-400 block">
                    Mode
                  </label>
                  <select
                    data-testid="audio-isolation-mode-dropdown"
                    value={isolationMode}
                    onChange={(e) => setIsolationMode(e.target.value as 'remove_vocal' | 'keep_vocal')}
                    className="w-full h-7 rounded border border-ink-700 bg-ink-800 px-2 text-xs text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="remove_vocal">Remove Vocal (Instrumental)</option>
                    <option value="keep_vocal">Keep Vocal (Dialogue Only)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-ink-400 block">
                    AI Neural Model
                  </label>
                  <select
                    data-testid="audio-isolation-model-dropdown"
                    value={isolationModel}
                    onChange={(e) => {
                      setIsolationModel(e.target.value as VoiceIsolationModel)
                      useEditor.getState().setAudioIsolationModel(e.target.value as VoiceIsolationModel)
                    }}
                    className="w-full h-7 rounded border border-ink-700 bg-ink-800 px-2 text-xs text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="htdemucs-v4">Demucs v4 · real neural{demucsReady === false ? ' (weights not downloaded)' : ' — best quality'}</option>
                    <option value="omni-voicetarget">omni-voicetarget · fast DSP (mid/side crossover)</option>
                    <option value="bs-roformer-lite">BS-Roformer Lite (planned)</option>
                    <option value="dsp-crossover-fast">Fast Crossover DSP (Offline)</option>
                    <option value="omni-denoise-onnx">AI Denoise ONNX (in-house GRU masker)</option>
                  </select>
                </div>

                {isolationModel === 'htdemucs-v4' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="audio-isolation-vad-toggle">
                    <input
                      type="checkbox"
                      checked={vadCleanup}
                      onChange={(e) => setVadCleanup(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Silero VAD pause cleanup <span className="text-ink-500">(mutes residual noise between phrases)</span></span>
                  </label>
                )}

                {isolationModel === 'htdemucs-v4' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="audio-isolation-speedfix-toggle">
                    <input
                      type="checkbox"
                      checked={speedFix}
                      onChange={(e) => setSpeedFix(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Auto-fix slowed tracks <span className="text-ink-500">(separates at corrected speed, restores timing)</span></span>
                  </label>
                )}

                {isolationModel === 'htdemucs-v4' && speedFix && isolationMode === 'keep_vocal' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none ml-3" data-testid="audio-isolation-naturalpitch-toggle">
                    <input
                      type="checkbox"
                      checked={speedNatural}
                      onChange={(e) => setSpeedNatural(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Vocals at natural pitch <span className="text-ink-500">(skip the slow-back — usable acapella, no longer timeline-aligned)</span></span>
                  </label>
                )}

                {isolationStatus && (
                  <p className="text-[10px] text-ink-400 font-mono truncate">{isolationStatus}</p>
                )}

                <button
                  type="button"
                  data-testid="apply-audio-isolation-btn"
                  disabled={isProcessing}
                  onClick={async () => {
                    setIsProcessing(true)
                    setIsolationStatus('Processing isolation…')
                    try {
                      await executeVoiceIsolationForClip(
                        clip.id,
                        { mode: isolationMode, model: isolationModel, vadGate: isolationModel === 'htdemucs-v4' ? vadCleanup : undefined, speedNormalize: isolationModel === 'htdemucs-v4' ? speedFix : undefined, speedOutput: isolationModel === 'htdemucs-v4' && speedFix && isolationMode === 'keep_vocal' && speedNatural ? 'natural' : 'timeline' },
                        (pct, msg) => setIsolationStatus(`${pct}%: ${msg}`),
                      )
                      setIsolationStatus('Completed!')
                      setTimeout(() => setIsolationStatus(null), 3000)
                    } catch (err) {
                      setIsolationStatus(`Error: ${(err as Error).message}`)
                    } finally {
                      setIsProcessing(false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-7.5 rounded-md bg-brand hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-sm"
                >
                  {isProcessing ? 'Processing Audio…' : 'Isolate Audio Track'}
                </button>
              </div>
            )}
          </div>
        </Section>
      )}

      {clip.textStyle && (
        <Section title="Text & Title">
          <Field label="Text">
            <input
              value={clip.textStyle.text}
              onChange={(e) => {
                const text = e.target.value
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, name: text, textStyle: { ...c.textStyle!, text } } : c)),
                }))
              }}
              aria-label="Clip name"
              className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
            />
          </Field>
          <Field label="Font Size">
            <Slider label="Font Size"
              min={16}
              max={128}
              step={2}
              value={clip.textStyle.fontSize ?? 32}
              onChange={(v) => {
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, textStyle: { ...c.textStyle!, fontSize: v } } : c)),
                }))
              }}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.textStyle.fontSize ?? 32)}px</span>
          </Field>
        </Section>
      )}

      {clip.effects && (
        <Section title="Effects">
          <Field label="Brightness">
            <Slider label="Brightness" min={0} max={2} step={0.05} value={clip.effects.brightness ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { brightness: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.brightness ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Contrast">
            <Slider label="Contrast" min={0} max={2} step={0.05} value={clip.effects.contrast ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { contrast: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.contrast ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Saturation">
            <Slider label="Saturation" min={0} max={2} step={0.05} value={clip.effects.saturation ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { saturation: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.saturation ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Blur">
            <Slider label="Blur" min={0} max={20} step={0.5} value={clip.effects.blur ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { blur: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.blur ?? 0).toFixed(0)}px</span>
          </Field>
        </Section>
      )}

      <Section title="Source">
        <Field label="In point">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.inPoint)}</span>
        </Field>
        <Field label="Duration">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.duration)}</span>
        </Field>
      </Section>
    </div>
  )
}

function ProjectInspector() {
  const projectFps = useEditor((s) => s.projectFps)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  return (
    <div>
      <Section title="Project">
        <Field label="Resolution">
          <span className="text-[11px] text-ink-300">{sequenceSettings.width} × {sequenceSettings.height} ({sequenceSettings.aspectRatio})</span>
        </Field>
        <Field label="Frame rate">
          <span className="text-[11px] text-ink-300">{projectFps} fps</span>
        </Field>
      </Section>
      <Section title="Tips">
        <ul className="text-[11px] text-ink-400 leading-relaxed list-disc pl-4 space-y-1">
          <li>Drag a file anywhere to import.</li>
          <li>Click a clip to select it, then edit here.</li>
          <li>Drag clip edges to trim, body to move.</li>
          <li>Blade tool or Split to cut at the playhead.</li>
          <li>Scroll the timeline to zoom time.</li>
        </ul>
      </Section>
    </div>
  )
}

export function RightPanel() {
  const rightOpen = useEditor((s) => s.rightOpen)
  const setRightOpen = useEditor((s) => s.setRightOpen)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const rightPanelWidth = useEditor((s) => s.rightPanelWidth)
  const setRightPanelWidth = useEditor((s) => s.setRightPanelWidth)
  const rightPanelFloating = useEditor((s) => s.rightPanelFloating)
  const setRightPanelFloating = useEditor((s) => s.setRightPanelFloating)
  const rightPanelFloat = useEditor((s) => s.rightPanelFloat)
  const setRightPanelFloat = useEditor((s) => s.setRightPanelFloat)
  const unclusterInspector = useEditor((s) => s.unclusterInspector)
  const setUnclusterInspector = useEditor((s) => s.setUnclusterInspector)
  const sidebarSectionMode = useEditor((s) => s.sidebarSectionMode)
  const clip = useEditor((s) => s.clips.find((c) => c.id === s.selectedClipId) ?? null)

  const dragState = useRef<{ kind: 'width' | 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; baseX: number; baseY: number } | null>(null)

  // Shared pointer-drag helper: width (docked), move (float header), resize (float corner).
  const beginDrag = (
    kind: 'width' | 'move' | 'resize',
    e: React.PointerEvent,
  ) => {
    const float = useEditor.getState().rightPanelFloat
    dragState.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startW: kind === 'width' ? useEditor.getState().rightPanelWidth : float.w,
      startH: float.h,
      baseX: float.x,
      baseY: float.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragState.current
    if (!d) return
    if (d.kind === 'width') {
      // Dragging the left edge outward (negative dx) widens the panel.
      setRightPanelWidth(d.startW + (d.startX - e.clientX))
    } else if (d.kind === 'move') {
      setRightPanelFloat({
        x: d.baseX + (e.clientX - d.startX),
        y: d.baseY + (e.clientY - d.startY),
      })
    } else if (d.kind === 'resize') {
      setRightPanelFloat({
        w: d.startW + (e.clientX - d.startX),
        h: d.startH + (e.clientY - d.startY),
      })
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    dragState.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
  }

  const inspectorTitle = selectedClipId ? 'Clip Inspector' : 'Project Inspector'

  const inspectorBody = (
    <SectionsNavigator mode={sidebarSectionMode} label="Inspector sections">
      <div
        id="inspector-panel"
        data-testid="inspector-panel"
        role="region"
        aria-labelledby="inspector-heading"
        tabIndex={0}
        className={`flex-1 min-h-0 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${unclusterInspector ? 'space-y-0.5' : ''}`}
      >
        {clip ? <ClipInspector clip={clip} /> : <ProjectInspector />}
      </div>
    </SectionsNavigator>
  )

  // ---- Floating window mode: draggable + resizable inspector overlay ----
  if (rightPanelFloating) {
    return (
      <>
        <div
          data-testid="right-panel-float-window"
          role="dialog"
          aria-label={inspectorTitle}
          style={{
            position: 'fixed',
            left: rightPanelFloat.x,
            top: rightPanelFloat.y,
            width: rightPanelFloat.w,
            height: rightPanelFloat.h,
            zIndex: 60,
          }}
          className="flex flex-col rounded-xl border border-ink-600 bg-ink-850 shadow-[0_24px_64px_rgba(0,0,0,0.55)] overflow-hidden"
        >
          <div
            data-testid="right-panel-float-header"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return
              beginDrag('move', e)
            }}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to move the inspector"
            className="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ink-700 bg-ink-900/90 text-xs font-semibold uppercase tracking-wider text-ink-300 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <h2 id="inspector-heading" className="truncate" title={inspectorTitle}>
              {inspectorTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspector-uncluster-btn"
                title={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-label={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-pressed={unclusterInspector}
                onClick={() => setUnclusterInspector(!unclusterInspector)}
                className={`grid h-7 w-7 place-items-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  unclusterInspector ? 'bg-brand text-white shadow-xs' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                <SlidersHorizontal size={12} />
              </button>
              <button
                type="button"
                data-testid="inspector-dock-btn"
                title="Dock inspector back into the layout"
                aria-label="Dock inspector"
                onClick={() => setRightPanelFloating(false)}
                className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <PanelRight size={13} />
              </button>
              <button
                type="button"
                title="Hide inspector"
                aria-label="Hide inspector"
                onClick={() => setRightOpen(false)}
                className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X size={13} />
              </button>
            </div>
          </div>
          {inspectorBody}
          <div
            data-testid="right-panel-float-resize"
            onPointerDown={(e) => beginDrag('resize', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to resize"
            aria-label="Resize inspector window"
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
          >
            <div className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-ink-500" />
          </div>
        </div>
        {/* Rail keeps dock-side controls available while floating */}
        <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2">
          <button
            type="button"
            data-testid="inspector-dock-btn-rail"
            title="Dock inspector back into the layout"
            aria-label="Dock inspector"
            onClick={() => setRightPanelFloating(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <PanelRight size={18} />
          </button>
        </div>
      </>
    )
  }

  // ---- Docked mode (collapsible + width-draggable) ----
  return (
    <div className="shrink-0 flex h-full bg-ink-900 border-l border-ink-700">
      {rightOpen && (
        <div style={{ width: `${rightPanelWidth}px` }} className="relative shrink-0 bg-ink-850 flex flex-col h-full">
          {/* Width drag handle: slide the inspector edge to resize */}
          <div
            data-testid="right-panel-resize-handle"
            role="separator"
            aria-label="Resize inspector width"
            aria-orientation="vertical"
            onPointerDown={(e) => beginDrag('width', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to resize inspector"
            className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize bg-transparent hover:bg-brand/60 transition-colors touch-none"
          />
          <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-ink-700 text-xs font-semibold uppercase tracking-wider text-ink-300">
            <h2 id="inspector-heading" className="truncate pr-2" title={inspectorTitle}>
              {inspectorTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspector-uncluster-btn"
                title={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-label={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-pressed={unclusterInspector}
                onClick={() => setUnclusterInspector(!unclusterInspector)}
                className={`grid h-8 w-8 place-items-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  unclusterInspector ? 'bg-brand text-white shadow-xs' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                <SlidersHorizontal size={12} />
              </button>
              <button
                type="button"
                data-testid="inspector-float-btn"
                title="Float inspector into a movable window"
                aria-label="Float inspector into a movable window"
                onClick={() => setRightPanelFloating(true)}
                className="grid h-8 w-8 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <PictureInPicture2 size={13} />
              </button>
            </div>
          </div>
          {inspectorBody}
        </div>
      )}
      <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2 gap-1">
        <button
          type="button"
          title={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-label={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-expanded={rightOpen}
          aria-controls={rightOpen ? 'inspector-panel' : undefined}
          onClick={() => setRightOpen(!rightOpen)}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        {rightOpen && (
          <button
            type="button"
            data-testid="inspector-float-btn"
            title="Float inspector into a movable window"
            aria-label="Float inspector into a movable window"
            onClick={() => setRightPanelFloating(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <PictureInPicture2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
