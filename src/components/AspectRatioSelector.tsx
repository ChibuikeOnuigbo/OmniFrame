import React, { useState, useRef, useEffect } from 'react'
import {
  Maximize2,
  ChevronDown,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  Tv,
  Smartphone,
  Square,
  Film,
  Sliders,
} from 'lucide-react'
import { useEditor } from '../store'
import { RATIO_PRESETS, validateDimensions, MIN_DIMENSION, MAX_DIMENSION } from '../lib/aspectRatios'
import type { AspectRatioType } from '../types'

export function AspectRatioSelector() {
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  const setSequenceAspectRatio = useEditor((s) => s.setSequenceAspectRatio)

  const [open, setOpen] = useState(false)
  const [customW, setCustomW] = useState(sequenceSettings.width)
  const [customH, setCustomH] = useState(sequenceSettings.height)
  const [ratioLocked, setRatioLocked] = useState(true)
  const [customError, setCustomError] = useState<string | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Sync custom input values when sequenceSettings changes externally
  useEffect(() => {
    setCustomW(sequenceSettings.width)
    setCustomH(sequenceSettings.height)
  }, [sequenceSettings.width, sequenceSettings.height])

  // Click outside listener
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', handleClickOutside)
    return () => window.removeEventListener('pointerdown', handleClickOutside)
  }, [open])

  const currentPreset = RATIO_PRESETS.find((p) => p.id === sequenceSettings.aspectRatio)

  const handleSelectPreset = (id: AspectRatioType) => {
    if (id === 'custom') {
      setSequenceAspectRatio('custom', customW, customH)
    } else {
      setSequenceAspectRatio(id)
      setOpen(false)
    }
  }

  const handleCustomWidthChange = (valStr: string) => {
    const val = parseInt(valStr, 10)
    setCustomW(val)
    if (Number.isNaN(val)) {
      setCustomError('Width must be a valid number')
      return
    }
    const check = validateDimensions(val, customH)
    if (!check.valid) {
      setCustomError(check.error || 'Invalid width')
      return
    }
    setCustomError(null)

    if (ratioLocked && sequenceSettings.height > 0) {
      const ratio = sequenceSettings.width / sequenceSettings.height
      const newH = Math.round(val / ratio)
      setCustomH(newH)
      setSequenceAspectRatio('custom', val, newH)
    } else {
      setSequenceAspectRatio('custom', val, customH)
    }
  }

  const handleCustomHeightChange = (valStr: string) => {
    const val = parseInt(valStr, 10)
    setCustomH(val)
    if (Number.isNaN(val)) {
      setCustomError('Height must be a valid number')
      return
    }
    const check = validateDimensions(customW, val)
    if (!check.valid) {
      setCustomError(check.error || 'Invalid height')
      return
    }
    setCustomError(null)

    if (ratioLocked && sequenceSettings.width > 0) {
      const ratio = sequenceSettings.width / sequenceSettings.height
      const newW = Math.round(val * ratio)
      setCustomW(newW)
      setSequenceAspectRatio('custom', newW, val)
    } else {
      setSequenceAspectRatio('custom', customW, val)
    }
  }

  const handleResetCustom = () => {
    setCustomW(1920)
    setCustomH(1080)
    setCustomError(null)
    setSequenceAspectRatio('16:9')
    setOpen(false)
  }

  // Representative icon based on ratio format
  const renderRepresentativeIcon = () => {
    const ar = sequenceSettings.aspectRatio
    if (ar === '9:16' || ar === '4:5' || ar === '2:3') {
      return <Smartphone size={13} className="text-brand shrink-0" />
    }
    if (ar === '1:1') {
      return <Square size={13} className="text-amber-400 shrink-0" />
    }
    if (ar === '21:9') {
      return <Film size={13} className="text-violet-400 shrink-0" />
    }
    return <Tv size={13} className="text-brand shrink-0" />
  }

  return (
    <div className="absolute bottom-2 right-2 z-20 flex items-center select-none">
      {/* Tooltip on Hover/Focus */}
      {tooltipVisible && !open && currentPreset && (
        <div
          role="tooltip"
          data-testid="ratio-platform-tooltip"
          className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink-900/95 border border-ink-700 shadow-xl backdrop-blur-md text-[11px] text-ink-200 z-50 pointer-events-none whitespace-nowrap animate-in fade-in duration-100"
        >
          <div className="font-semibold text-white flex items-center gap-1.5">
            <span>{currentPreset.label}</span>
            <span className="text-ink-500 font-mono text-[10px]">({sequenceSettings.width}×{sequenceSettings.height})</span>
          </div>
          <div className="text-ink-400 text-[10px]">{currentPreset.description}</div>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-brand">
            {currentPreset.platforms.slice(0, 3).map((plat, idx) => (
              <span key={plat} className="px-1 py-0.5 rounded bg-brand/10 border border-brand/30">
                {plat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compact Closed Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="ratio-selector-btn"
        id="aspect-ratio-selector-trigger"
        title="Sequence Aspect Ratio & Output Format"
        aria-label="Aspect Ratio Selector"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-ink-900/90 hover:bg-ink-800 border border-ink-700/80 hover:border-ink-600 text-ink-200 hover:text-white shadow-lg backdrop-blur-md transition-all text-xs font-medium"
      >
        {renderRepresentativeIcon()}
        <span className="font-mono text-[11px] font-semibold tracking-tight">
          {sequenceSettings.isCustom
            ? `${sequenceSettings.width}×${sequenceSettings.height}`
            : sequenceSettings.aspectRatio}
        </span>
        <ChevronDown size={12} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Accessible Popover Menu - Positioned bottom-right above trigger to prevent overflow */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Aspect Ratio Presets"
          data-testid="ratio-popover"
          className="absolute bottom-full right-0 mb-2 w-72 max-h-[440px] overflow-y-auto rounded-xl bg-ink-900/98 border border-ink-700 shadow-2xl backdrop-blur-xl p-2 z-50 text-xs text-ink-200 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-ink-800 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Sequence Aspect Ratio
            </span>
            <span className="font-mono text-[10px] text-brand">
              {sequenceSettings.width} × {sequenceSettings.height}
            </span>
          </div>

          {/* Preset List */}
          <div className="space-y-0.5">
            {RATIO_PRESETS.map((preset) => {
              const active = sequenceSettings.aspectRatio === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`ratio-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left ${
                    active
                      ? 'bg-brand/20 text-brand font-medium'
                      : 'hover:bg-ink-800 text-ink-300 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{preset.label}</span>
                      <span className="text-[10px] font-mono text-ink-500">
                        ({preset.width}×{preset.height})
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-500 truncate">
                      {preset.platforms.slice(0, 3).join(' · ')}
                    </div>
                  </div>
                  {active && <Check size={14} className="shrink-0 text-brand" />}
                </button>
              )
            })}
          </div>

          {/* Custom Dimension Editor */}
          {sequenceSettings.aspectRatio === 'custom' && (
            <div
              data-testid="custom-ratio-editor"
              className="mt-2 pt-2 border-t border-ink-800 space-y-2 animate-in fade-in duration-100"
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-ink-300">
                <span>Custom Dimensions</span>
                <button
                  type="button"
                  data-testid="reset-custom-ratio-btn"
                  onClick={handleResetCustom}
                  className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-white"
                  title="Reset to 1920x1080"
                >
                  <RotateCcw size={10} />
                  <span>Reset</span>
                </button>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                <div>
                  <label className="block text-[9px] text-ink-500 font-mono mb-0.5">WIDTH (PX)</label>
                  <input
                    type="number"
                    data-testid="custom-width-input"
                    aria-label="Custom width"
                    min={MIN_DIMENSION}
                    max={MAX_DIMENSION}
                    value={customW}
                    onChange={(e) => handleCustomWidthChange(e.target.value)}
                    className="w-full h-7 px-2 rounded bg-ink-800 border border-ink-700 text-ink-100 font-mono text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <button
                  type="button"
                  data-testid="toggle-ratio-lock-btn"
                  onClick={() => setRatioLocked(!ratioLocked)}
                  title={ratioLocked ? 'Ratio Locked' : 'Ratio Unlocked'}
                  className={`mt-3 p-1.5 rounded transition-colors ${
                    ratioLocked ? 'bg-brand/20 text-brand' : 'text-ink-500 hover:text-ink-300'
                  }`}
                >
                  {ratioLocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                <div>
                  <label className="block text-[9px] text-ink-500 font-mono mb-0.5">HEIGHT (PX)</label>
                  <input
                    type="number"
                    data-testid="custom-height-input"
                    aria-label="Custom height"
                    min={MIN_DIMENSION}
                    max={MAX_DIMENSION}
                    value={customH}
                    onChange={(e) => handleCustomHeightChange(e.target.value)}
                    className="w-full h-7 px-2 rounded bg-ink-800 border border-ink-700 text-ink-100 font-mono text-xs focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {customError && (
                <div data-testid="custom-ratio-error" className="text-[10px] text-red-400">
                  {customError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
