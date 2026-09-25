import React from 'react'
import { Wand2, Sliders, RotateCcw, Sparkles } from 'lucide-react'
import { useEditor } from '../store'
import type { ClipEffect } from '../types'

export function EffectsPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const setClipEffect = useEditor((s) => s.setClipEffect)

  const selectedClip = clips.find((c) => c.id === selectedClipId)
  const effects: ClipEffect = selectedClip?.effects || {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blur: 0,
    grayscale: 0,
    invert: 0,
    sepia: 0,
    hueRotate: 0,
  }

  const handleChange = (key: keyof ClipEffect, val: number) => {
    if (!selectedClipId) return
    setClipEffect(selectedClipId, { [key]: val })
  }

  const handleReset = () => {
    if (!selectedClipId) return
    setClipEffect(selectedClipId, {
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      grayscale: 0,
      invert: 0,
      sepia: 0,
      hueRotate: 0,
    })
  }

  const applyPreset = (preset: 'cinematic' | 'noir' | 'vintage' | 'warm') => {
    if (!selectedClipId) return
    if (preset === 'cinematic') {
      setClipEffect(selectedClipId, { contrast: 1.25, saturation: 1.15, brightness: 0.95, sepia: 0.1 })
    } else if (preset === 'noir') {
      setClipEffect(selectedClipId, { grayscale: 1, contrast: 1.4, brightness: 0.9 })
    } else if (preset === 'vintage') {
      setClipEffect(selectedClipId, { sepia: 0.6, contrast: 0.9, brightness: 1.05 })
    } else if (preset === 'warm') {
      setClipEffect(selectedClipId, { brightness: 1.05, saturation: 1.25, sepia: 0.25 })
    }
  }

  if (!selectedClip) {
    return (
      <div data-testid="effects-panel-empty" className="p-4 text-xs text-ink-500 text-center">
        <Wand2 size={24} className="mx-auto mb-2 opacity-40 text-ink-400" />
        <p className="font-medium text-ink-300">No clip selected</p>
        <p className="text-[11px] text-ink-500 mt-1">Select a video or image clip on the timeline to apply real-time effects.</p>
      </div>
    )
  }

  return (
    <div data-testid="effects-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      {/* Target clip badge & Reset */}
      <div className="flex items-center justify-between pb-2 border-b border-ink-800">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold block">Target Clip</span>
          <span className="font-medium text-ink-100 truncate block text-[11px]">{selectedClip.name}</span>
        </div>
        <button
          type="button"
          data-testid="reset-effects-btn"
          onClick={handleReset}
          title="Reset effects"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-[10px] text-ink-400 hover:text-white"
        >
          <RotateCcw size={10} />
          <span>Reset</span>
        </button>
      </div>

      {/* Quick Color Presets */}
      <div>
        <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider block mb-1.5">
          Stylistic Presets
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'cinematic', label: 'Cinematic' },
            { id: 'noir', label: 'Film Noir (B&W)' },
            { id: 'vintage', label: 'Vintage 70s' },
            { id: 'warm', label: 'Golden Hour' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`effect-preset-${p.id}`}
              onClick={() => applyPreset(p.id as any)}
              className="px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-brand text-[11px] text-ink-300 hover:text-white transition-colors text-left"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2 pt-1 border-t border-ink-800">
        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Brightness</span>
            <span className="font-mono">{Math.round((effects.brightness ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-brightness"
            min={0}
            max={2}
            step={0.05}
            value={effects.brightness ?? 1}
            onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Contrast</span>
            <span className="font-mono">{Math.round((effects.contrast ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-contrast"
            min={0}
            max={2}
            step={0.05}
            value={effects.contrast ?? 1}
            onChange={(e) => handleChange('contrast', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Saturation</span>
            <span className="font-mono">{Math.round((effects.saturation ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-saturation"
            min={0}
            max={2}
            step={0.05}
            value={effects.saturation ?? 1}
            onChange={(e) => handleChange('saturation', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Blur Radius</span>
            <span className="font-mono">{effects.blur ?? 0}px</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-blur"
            min={0}
            max={20}
            step={0.5}
            value={effects.blur ?? 0}
            onChange={(e) => handleChange('blur', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Grayscale</span>
            <span className="font-mono">{Math.round((effects.grayscale ?? 0) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-grayscale"
            min={0}
            max={1}
            step={0.05}
            value={effects.grayscale ?? 0}
            onChange={(e) => handleChange('grayscale', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Sepia</span>
            <span className="font-mono">{Math.round((effects.sepia ?? 0) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-sepia"
            min={0}
            max={1}
            step={0.05}
            value={effects.sepia ?? 0}
            onChange={(e) => handleChange('sepia', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>
      </div>
    </div>
  )
}
