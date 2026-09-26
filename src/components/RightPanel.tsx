import React, { useState } from 'react'
import { PanelRightClose, PanelRightOpen, Trash2, Scissors, AudioLines, Volume2 } from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'
import type { Clip } from '../types'
import { Field, Section, Slider } from './ui'
import { formatClock } from '../lib/time'
import { executeVoiceIsolationForClip, type VoiceIsolationModel } from '../lib/voiceIsolation'

function ClipInspector({ clip }: { clip: Clip }) {
  const assets = useEditor((s) => s.assets)
  const setClipProp = useEditor((s) => s.setClipProp)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const removeClip = useEditor((s) => s.removeClip)
  const splitAt = useEditor((s) => s.splitAt)
  const extractAudio = useEditor((s) => s.extractAudio)
  const defaultModel = useEditor((s) => s.audioIsolationModel)
  const asset = assets.find((a) => a.id === clip.assetId)
  const t = clip.transform

  const [isolationEnabled, setIsolationEnabled] = useState(false)
  const [isolationMode, setIsolationMode] = useState<'remove_vocal' | 'keep_vocal'>('remove_vocal')
  const [isolationModel, setIsolationModel] = useState<VoiceIsolationModel>(defaultModel || 'omni-voicetarget')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isolationStatus, setIsolationStatus] = useState<string | null>(null)

  return (
    <div>
      <Section title="Clip">
        <div className="flex items-center justify-between gap-2">
          <input
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
        {clip.kind === 'video' && !assets.some((item) => item.extractedFromClipId === clip.id) && (
          <button
            type="button"
            onClick={() => void extractAudio(clip.id)}
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 text-xs hover:bg-ink-700"
          >
            <AudioLines size={13} /> Extract audio
          </button>
        )}
      </Section>

      <Section title="Transform">
        <Field label="Position X">
          <Slider min={-960} max={960} value={t.x} onChange={(v) => setClipTransform(clip.id, { x: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.x)}</span>
        </Field>
        <Field label="Position Y">
          <Slider min={-540} max={540} value={t.y} onChange={(v) => setClipTransform(clip.id, { y: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.y)}</span>
        </Field>
        <Field label="Scale">
          <Slider min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => setClipTransform(clip.id, { scale: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{t.scale.toFixed(2)}</span>
        </Field>
        <Field label={<span className="flex items-center gap-1.5"><BlenderRotationIcon size={13} /><span>Rotation</span></span>}>
          <Slider min={-180} max={180} value={t.rotation} onChange={(v) => setClipTransform(clip.id, { rotation: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotation)}°</span>
        </Field>
        <Field label="Opacity">
          <Slider min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => setClipTransform(clip.id, { opacity: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.opacity * 100)}</span>
        </Field>
      </Section>

      {(clip.kind === 'audio' || clip.kind === 'video') && (
        <Section title="Audio">
          <Field label="Volume">
            <Slider
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

          {/* Voice Isolation Checkbox */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="audio-voice-isolation-checkbox"
                checked={isolationEnabled}
                onChange={(e) => setIsolationEnabled(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand focus:ring-brand focus:ring-offset-ink-900 cursor-pointer"
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
                    onChange={(e) => setIsolationModel(e.target.value as VoiceIsolationModel)}
                    className="w-full h-7 rounded border border-ink-700 bg-ink-800 px-2 text-xs text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="omni-voicetarget">omni-voicetarget (20K+ Neural Stems)</option>
                    <option value="htdemucs-v4">HTDemucs v4 (Meta Hybrid Transformer)</option>
                    <option value="bs-roformer-lite">BS-Roformer Lite (Band-Split Web)</option>
                    <option value="dsp-crossover-fast">Fast Crossover DSP (Offline)</option>
                  </select>
                </div>

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
                        { mode: isolationMode, model: isolationModel },
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
              className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
            />
          </Field>
          <Field label="Font Size">
            <Slider
              min={16}
              max={128}
              step={2}
              value={clip.textStyle.fontSize}
              onChange={(v) => {
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, textStyle: { ...c.textStyle!, fontSize: v } } : c)),
                }))
              }}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{clip.textStyle.fontSize}px</span>
          </Field>
        </Section>
      )}

      {clip.effects && (
        <Section title="Effects">
          <Field label="Brightness">
            <Slider min={0} max={2} step={0.05} value={clip.effects.brightness ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { brightness: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.brightness ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Contrast">
            <Slider min={0} max={2} step={0.05} value={clip.effects.contrast ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { contrast: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.contrast ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Saturation">
            <Slider min={0} max={2} step={0.05} value={clip.effects.saturation ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { saturation: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.saturation ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Blur">
            <Slider min={0} max={20} step={0.5} value={clip.effects.blur ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { blur: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.blur ?? 0).toFixed(0)}px</span>
          </Field>
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
              className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
            />
          </Field>
          <Field label="Font Size">
            <Slider
              min={16}
              max={128}
              step={2}
              value={clip.textStyle.fontSize}
              onChange={(v) => {
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, textStyle: { ...c.textStyle!, fontSize: v } } : c)),
                }))
              }}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{clip.textStyle.fontSize}px</span>
          </Field>
        </Section>
      )}

      {clip.effects && (
        <Section title="Effects">
          <Field label="Brightness">
            <Slider min={0} max={2} step={0.05} value={clip.effects.brightness ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { brightness: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.brightness ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Contrast">
            <Slider min={0} max={2} step={0.05} value={clip.effects.contrast ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { contrast: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.contrast ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Saturation">
            <Slider min={0} max={2} step={0.05} value={clip.effects.saturation ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { saturation: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.saturation ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Blur">
            <Slider min={0} max={20} step={0.5} value={clip.effects.blur ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { blur: v })} />
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
  const clip = useEditor((s) => s.clips.find((c) => c.id === s.selectedClipId) ?? null)

  return (
    <div className="shrink-0 flex h-full bg-ink-900 border-l border-ink-700">
      {rightOpen && (
        <div style={{ width: `${rightPanelWidth}px` }} className="shrink-0 bg-ink-850 flex flex-col h-full">
          <div className="h-9 shrink-0 flex items-center px-3 border-b border-ink-700 text-xs font-semibold uppercase tracking-wider text-ink-300">
            {selectedClipId ? 'Clip' : 'Inspector'}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {clip ? <ClipInspector clip={clip} /> : <ProjectInspector />}
          </div>
        </div>
      )}
      <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2">
        <button
          type="button"
          title={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-label={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-expanded={rightOpen}
          onClick={() => setRightOpen(!rightOpen)}
          className="grid place-items-center h-8 w-8 rounded-md text-ink-400 hover:text-white hover:bg-ink-700"
        >
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </div>
  )
}
