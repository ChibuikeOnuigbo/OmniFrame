import React, { useState } from 'react'
import {
  Scissors,
  Sparkles,
  Copy,
  Trash2,
  RotateCcw,
  Layers,
  Clock,
  Eye,
  Sliders,
  Check,
  ChevronRight,
  Maximize2,
  Move,
  Film,
} from 'lucide-react'
import { useEditor } from '../store'
import type { OmniframeScopeType } from '../types'

export function OmniFramePanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)
  const omniframeCharacters = useEditor((s) => s.omniframeCharacters)
  const selectedCharacterId = useEditor((s) => s.selectedCharacterId)
  const setSelectedCharacterId = useEditor((s) => s.setSelectedCharacterId)
  const setOmniframeCharacterTransform = useEditor((s) => s.setOmniframeCharacterTransform)
  const evaluateCharacterTransformAtTime = useEditor((s) => s.evaluateCharacterTransformAtTime)
  const cutCharacterToNewTrack = useEditor((s) => s.cutCharacterToNewTrack)
  const duplicateCharacter = useEditor((s) => s.duplicateCharacter)
  const removeCharacterInfill = useEditor((s) => s.removeCharacterInfill)
  const resetCharacterPosition = useEditor((s) => s.resetCharacterPosition)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]
  const selectedChar = omniframeCharacters.find((c) => c.id === selectedCharacterId) || omniframeCharacters[0]
  const currentFrame = Math.round(playhead * projectFps)

  // Scope form state for active character
  const [sectionStart, setSectionStart] = useState<number>(selectedChar?.sectionRange?.start ?? 2.0)
  const [sectionEnd, setSectionEnd] = useState<number>(selectedChar?.sectionRange?.end ?? 5.0)
  const [targetFrame, setTargetFrame] = useState<number>(selectedChar?.frameNumber ?? currentFrame)

  const handleUpdateTransform = (patch: { x?: number; y?: number; scale?: number; rotation?: number }) => {
    if (!selectedChar) return
    setOmniframeCharacterTransform(
      selectedChar.id,
      patch,
      selectedChar.scope,
      selectedChar.scope === 'section' ? { start: sectionStart, end: sectionEnd } : selectedChar.sectionRange,
      selectedChar.scope === 'frame' ? targetFrame : selectedChar.frameNumber
    )
  }

  const handleScopeChange = (newScope: OmniframeScopeType) => {
    if (!selectedChar) return
    setOmniframeCharacterTransform(
      selectedChar.id,
      {},
      newScope,
      newScope === 'section' ? { start: sectionStart, end: sectionEnd } : selectedChar.sectionRange,
      newScope === 'frame' ? targetFrame : selectedChar.frameNumber
    )
  }

  // Milestone evaluation checkpoints for live verification
  const verificationPoints = [
    { label: 'Start (0.0s / F#0)', time: 0.0, frame: 0 },
    { label: 'Section Early (2.5s / F#75)', time: 2.5, frame: 75 },
    { label: 'Section Mid (3.5s / F#105)', time: 3.5, frame: 105 },
    { label: 'Section End (5.0s / F#150)', time: 5.0, frame: 150 },
    { label: 'Late Frame (7.0s / F#210)', time: 7.0, frame: 210 },
  ]

  return (
    <div data-testid="omniframe-panel" className="p-3 text-xs text-ink-200 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-ink-800">
        <div className="flex items-center gap-1.5">
          <Scissors size={14} className="text-brand" />
          <span className="font-semibold text-ink-100">OmniFrame AI</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-mono font-medium">
          Multi-Frame Cuts
        </span>
      </div>

      {/* Target Video Banner */}
      <div className="p-2 rounded-lg bg-ink-900 border border-ink-800 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <Film size={13} className="text-ink-400 shrink-0" />
          <div className="truncate">
            <div className="text-[11px] font-medium text-ink-200 truncate">
              {activeClip ? activeClip.name : 'Death Note Chibi - 5 Characters.mp4'}
            </div>
            <div className="text-[10px] text-ink-400 font-mono">
              Duration: {activeClip ? activeClip.duration.toFixed(1) : '8.0'}s · Playhead: {playhead.toFixed(2)}s (F#{currentFrame})
            </div>
          </div>
        </div>
      </div>

      {/* Detected Characters List */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-ink-400 uppercase tracking-wider">
          <span>Detected Characters ({omniframeCharacters.length})</span>
          <span className="text-[10px] text-brand">1-Click Select</span>
        </div>
        <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-0.5">
          {omniframeCharacters.map((char) => {
            const isSelected = char.id === selectedChar?.id
            return (
              <button
                key={char.id}
                type="button"
                data-testid={`character-card-${char.id}`}
                onClick={() => {
                  setSelectedCharacterId(char.id)
                  if (char.sectionRange) {
                    setSectionStart(char.sectionRange.start)
                    setSectionEnd(char.sectionRange.end)
                  }
                  if (char.frameNumber !== undefined) {
                    setTargetFrame(char.frameNumber)
                  }
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-brand/15 border-brand text-white shadow-xs ring-1 ring-brand/40'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-ink-950 border border-ink-700 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={char.cutoutUrl}
                      alt={char.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-[11px] leading-tight">{char.name}</div>
                    <div className="text-[9px] text-ink-400">{char.label}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
                    char.scope === 'all'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : char.scope === 'section'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {char.scope === 'all' ? 'All Frames' : char.scope === 'section' ? 'Section' : '1 Frame'}
                  </span>
                  {(char.transform.x !== 0 || char.transform.y !== 0) && (
                    <span className="text-[9px] text-brand font-mono font-bold">
                      Δ ({char.transform.x > 0 ? `+${char.transform.x}` : char.transform.x}, {char.transform.y > 0 ? `+${char.transform.y}` : char.transform.y})
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedChar && (
        <div className="flex flex-col gap-3 p-2.5 rounded-xl bg-ink-900/90 border border-ink-800">
          <div className="flex items-center justify-between pb-1.5 border-b border-ink-800">
            <span className="font-semibold text-ink-100 flex items-center gap-1">
              <Move size={12} className="text-brand" />
              Transform: {selectedChar.name}
            </span>
            <button
              type="button"
              data-testid="omniframe-reset-pos-btn"
              title="Reset Position"
              onClick={() => resetCharacterPosition(selectedChar.id)}
              className="text-[10px] text-ink-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>

          {/* Position X */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-ink-400">
              <span>Position X</span>
              <span className="font-mono text-ink-200" data-testid="char-pos-x-val">
                {selectedChar.transform.x > 0 ? `+${selectedChar.transform.x}` : selectedChar.transform.x} px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="omniframe-pos-x-slider"
                min={-400}
                max={400}
                value={selectedChar.transform.x}
                onChange={(e) => handleUpdateTransform({ x: Number(e.target.value) })}
                className="of-range w-full"
              />
              <input
                type="number"
                data-testid="omniframe-pos-x-input"
                value={selectedChar.transform.x}
                onChange={(e) => handleUpdateTransform({ x: Number(e.target.value) })}
                className="w-14 bg-ink-950 border border-ink-700 rounded px-1 py-0.5 text-[10px] font-mono text-center text-ink-100"
              />
            </div>
          </div>

          {/* Position Y */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-ink-400">
              <span>Position Y</span>
              <span className="font-mono text-ink-200" data-testid="char-pos-y-val">
                {selectedChar.transform.y > 0 ? `+${selectedChar.transform.y}` : selectedChar.transform.y} px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="omniframe-pos-y-slider"
                min={-300}
                max={300}
                value={selectedChar.transform.y}
                onChange={(e) => handleUpdateTransform({ y: Number(e.target.value) })}
                className="of-range w-full"
              />
              <input
                type="number"
                data-testid="omniframe-pos-y-input"
                value={selectedChar.transform.y}
                onChange={(e) => handleUpdateTransform({ y: Number(e.target.value) })}
                className="w-14 bg-ink-950 border border-ink-700 rounded px-1 py-0.5 text-[10px] font-mono text-center text-ink-100"
              />
            </div>
          </div>

          {/* Scale & Rotation */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-ink-400 mb-0.5">
                <span>Scale</span>
                <span className="font-mono text-ink-200">{selectedChar.transform.scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                data-testid="omniframe-scale-slider"
                min={0.2}
                max={2.5}
                step={0.05}
                value={selectedChar.transform.scale}
                onChange={(e) => handleUpdateTransform({ scale: parseFloat(e.target.value) })}
                className="of-range w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-ink-400 mb-0.5">
                <span>Rotation</span>
                <span className="font-mono text-ink-200">{selectedChar.transform.rotation}°</span>
              </div>
              <input
                type="range"
                data-testid="omniframe-rot-slider"
                min={-180}
                max={180}
                value={selectedChar.transform.rotation}
                onChange={(e) => handleUpdateTransform({ rotation: parseInt(e.target.value, 10) })}
                className="of-range w-full"
              />
            </div>
          </div>

          {/* Scope Selector: All Frames vs Section vs Only 1 Frame */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              <span>Propagation Scope</span>
              <Clock size={11} />
            </div>

            <div className="grid grid-cols-3 gap-1 bg-ink-950 p-0.5 rounded-lg border border-ink-800">
              <button
                type="button"
                data-testid="scope-all-frames"
                onClick={() => handleScopeChange('all')}
                className={`py-1 px-1 rounded text-[10px] font-medium transition-colors ${
                  selectedChar.scope === 'all'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                All Frames
              </button>
              <button
                type="button"
                data-testid="scope-section-frames"
                onClick={() => handleScopeChange('section')}
                className={`py-1 px-1 rounded text-[10px] font-medium transition-colors ${
                  selectedChar.scope === 'section'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                Section
              </button>
              <button
                type="button"
                data-testid="scope-one-frame"
                onClick={() => handleScopeChange('frame')}
                className={`py-1 px-1 rounded text-[10px] font-medium transition-colors ${
                  selectedChar.scope === 'frame'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                1 Frame
              </button>
            </div>

            {/* Scope Parameter Controls */}
            {selectedChar.scope === 'section' && (
              <div className="p-2 rounded bg-ink-950/70 border border-ink-800 space-y-1.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between text-[10px] text-ink-300">
                  <span>Section Range (Seconds)</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {sectionStart.toFixed(1)}s → {sectionEnd.toFixed(1)}s (Duration: {(sectionEnd - sectionStart).toFixed(1)}s)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-ink-500">Start (s):</span>
                    <input
                      type="number"
                      data-testid="section-start-time"
                      step={0.1}
                      min={0}
                      max={sectionEnd - 0.1}
                      value={sectionStart}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        setSectionStart(val)
                        setOmniframeCharacterTransform(selectedChar.id, {}, 'section', { start: val, end: sectionEnd })
                      }}
                      className="w-full bg-ink-900 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-100"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-ink-500">End (s):</span>
                    <input
                      type="number"
                      data-testid="section-end-time"
                      step={0.1}
                      min={sectionStart + 0.1}
                      max={activeClip ? activeClip.duration : 10}
                      value={sectionEnd}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 5
                        setSectionEnd(val)
                        setOmniframeCharacterTransform(selectedChar.id, {}, 'section', { start: sectionStart, end: val })
                      }}
                      className="w-full bg-ink-900 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedChar.scope === 'frame' && (
              <div className="p-2 rounded bg-ink-950/70 border border-ink-800 space-y-1.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between text-[10px] text-ink-300">
                  <span>Isolated Target Frame</span>
                  <span className="font-mono text-emerald-400 font-bold">Frame #{targetFrame}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    data-testid="frame-target-input"
                    min={0}
                    max={240}
                    value={targetFrame}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0
                      setTargetFrame(val)
                      setOmniframeCharacterTransform(selectedChar.id, {}, 'frame', undefined, val)
                    }}
                    className="w-20 bg-ink-900 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-100"
                  />
                  <button
                    type="button"
                    data-testid="sync-playhead-frame-btn"
                    onClick={() => {
                      setTargetFrame(currentFrame)
                      setOmniframeCharacterTransform(selectedChar.id, {}, 'frame', undefined, currentFrame)
                    }}
                    className="px-2 py-0.5 rounded bg-ink-800 hover:bg-ink-750 text-ink-300 text-[10px] truncate"
                  >
                    Sync to Current (F#{currentFrame})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Operations */}
          <div className="pt-2 border-t border-ink-800 flex flex-col gap-1.5">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              Character Operations
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="omniframe-cut-to-track-btn"
                onClick={() => cutCharacterToNewTrack(selectedChar.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/20 border border-brand/40 text-brand font-medium hover:bg-brand/30 transition-colors"
              >
                <Scissors size={12} />
                <span>Cut to Track</span>
              </button>

              <button
                type="button"
                data-testid="omniframe-duplicate-btn"
                onClick={() => duplicateCharacter(selectedChar.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200 hover:text-white hover:bg-ink-750 transition-colors"
              >
                <Copy size={12} />
                <span>Duplicate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Evaluated Multi-Frame Verification Inspector */}
      {selectedChar && (
        <div data-testid="omniframe-verification-table" className="p-2.5 rounded-xl bg-ink-950 border border-ink-800 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            <span>Evaluated Position Verification</span>
            <span className="font-mono text-brand font-bold">Scope: {selectedChar.scope}</span>
          </div>

          <div className="space-y-1">
            {verificationPoints.map((pt) => {
              const evalTransform = evaluateCharacterTransformAtTime(selectedChar.id, pt.time)
              const isModified = evalTransform.x !== 0 || evalTransform.y !== 0
              return (
                <div
                  key={pt.label}
                  data-testid={`eval-row-${pt.frame}`}
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-mono border ${
                    isModified
                      ? 'bg-brand/10 border-brand/30 text-white'
                      : 'bg-ink-900/60 border-ink-800/80 text-ink-400'
                  }`}
                >
                  <span className="truncate">{pt.label}</span>
                  <div className="flex items-center gap-2">
                    <span>
                      X: {evalTransform.x > 0 ? `+${evalTransform.x}` : evalTransform.x}px
                    </span>
                    <span>
                      Y: {evalTransform.y > 0 ? `+${evalTransform.y}` : evalTransform.y}px
                    </span>
                    <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                      isModified ? 'bg-brand text-white' : 'bg-ink-800 text-ink-500'
                    }`}>
                      {isModified ? 'Shifted' : 'Original'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
