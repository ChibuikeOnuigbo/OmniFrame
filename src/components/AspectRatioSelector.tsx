import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  Tv,
  Square,
  Film,
  Sliders,
} from 'lucide-react'
import { useEditor } from '../store'
import { RATIO_PRESETS, validateDimensions, MIN_DIMENSION, MAX_DIMENSION } from '../lib/aspectRatios'
import type { AspectRatioType } from '../types'

export function YouTubeIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="2" y="4" width="20" height="16" rx="4.5" fill="#FF0000" />
      <polygon points="10,8.5 16,12 10,15.5" fill="white" />
    </svg>
  )
}

export function TikTokIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#010101" />
      <path
        d="M16.5 8.2c-.9-.6-1.5-1.5-1.6-2.6h-2.2v9.3a2.3 2.3 0 1 1-2.3-2.3c.4 0 .8.1 1.1.3V10.5a4.7 4.7 0 0 0-1.1-.1 4.6 4.6 0 1 0 4.6 4.6V10.2c1.1.8 2.4 1.3 3.8 1.3V9.3c-.8 0-1.6-.4-2.3-1.1z"
        fill="#25F4EE"
        transform="translate(-0.5, -0.5)"
        opacity="0.85"
      />
      <path
        d="M16.5 8.2c-.9-.6-1.5-1.5-1.6-2.6h-2.2v9.3a2.3 2.3 0 1 1-2.3-2.3c.4 0 .8.1 1.1.3V10.5a4.7 4.7 0 0 0-1.1-.1 4.6 4.6 0 1 0 4.6 4.6V10.2c1.1.8 2.4 1.3 3.8 1.3V9.3c-.8 0-1.6-.4-2.3-1.1z"
        fill="#FE2C55"
        transform="translate(0.5, 0.5)"
        opacity="0.85"
      />
      <path
        d="M16.5 8.2c-.9-.6-1.5-1.5-1.6-2.6h-2.2v9.3a2.3 2.3 0 1 1-2.3-2.3c.4 0 .8.1 1.1.3V10.5a4.7 4.7 0 0 0-1.1-.1 4.6 4.6 0 1 0 4.6 4.6V10.2c1.1.8 2.4 1.3 3.8 1.3V9.3c-.8 0-1.6-.4-2.3-1.1z"
        fill="#FFFFFF"
      />
    </svg>
  )
}

export function YouTubeTikTokPaperSlideIcon({ className = '' }: { className?: string }) {
  return (
    <span
      data-testid="ratio-icon-9-16-stack"
      className={`relative inline-flex items-center w-6 h-5 shrink-0 select-none ${className}`}
      title="YouTube Shorts and TikTok 9:16 vertical stack"
    >
      {/* YouTube card (back paper slide) */}
      <span
        className="absolute left-0 top-0.5 w-3.5 h-4.5 rounded-[3px] bg-[#FF0000] shadow-sm flex items-center justify-center border border-white/20 transform -rotate-6 transition-transform"
        style={{ zIndex: 1 }}
      >
        <svg width="6" height="6" viewBox="0 0 24 24" fill="white">
          <polygon points="7,5 19,12 7,19" />
        </svg>
      </span>

      {/* TikTok card (front paper slide, slid out to the side) */}
      <span
        className="absolute left-2.5 top-0 w-3.5 h-4.5 rounded-[3px] bg-[#0f0f14] shadow-md flex items-center justify-center border border-[#25F4EE]/40 transform rotate-6 transition-transform"
        style={{ zIndex: 2 }}
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 8c-.8-.5-1.4-1.3-1.5-2.2h-1.9v8.2a2 2 0 1 1-2-2c.4 0 .7.1 1 .3V9.5a4 4 0 0 0-1-.1 4 4 0 1 0 4 4V10c1 .7 2.1 1.1 3.4 1.1V9.2c-.7 0-1.4-.4-2-1.2z"
            fill="#25F4EE"
            transform="translate(-0.3, -0.3)"
          />
          <path
            d="M16 8c-.8-.5-1.4-1.3-1.5-2.2h-1.9v8.2a2 2 0 1 1-2-2c.4 0 .7.1 1 .3V9.5a4 4 0 0 0-1-.1 4 4 0 1 0 4 4V10c1 .7 2.1 1.1 3.4 1.1V9.2c-.7 0-1.4-.4-2-1.2z"
            fill="#FE2C55"
            transform="translate(0.3, 0.3)"
          />
          <path
            d="M16 8c-.8-.5-1.4-1.3-1.5-2.2h-1.9v8.2a2 2 0 1 1-2-2c.4 0 .7.1 1 .3V9.5a4 4 0 0 0-1-.1 4 4 0 1 0 4 4V10c1 .7 2.1 1.1 3.4 1.1V9.2c-.7 0-1.4-.4-2-1.2z"
            fill="#FFFFFF"
          />
        </svg>
      </span>
    </span>
  )
}

export function InstagramIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <defs>
        <radialGradient id="ig-grad" cx="20%" cy="100%" r="130%">
          <stop offset="0%" stopColor="#ffc107" />
          <stop offset="20%" stopColor="#f44336" />
          <stop offset="60%" stopColor="#e91e63" />
          <stop offset="100%" stopColor="#9c27b0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" stroke="white" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
      <circle cx="15.5" cy="8.5" r="0.75" fill="white" />
    </svg>
  )
}

export function CinemascopeIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="1" y="6" width="22" height="12" rx="2" fill="#1e1e2d" stroke="#8b5cf6" strokeWidth="1.2" />
      <path d="M4 6v12M20 6v12M8 6v12M16 6v12" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.6" />
      <polygon points="10,9 15,12 10,15" fill="#a78bfa" />
    </svg>
  )
}

export function PinterestIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" fill="#E60023" />
      <path
        d="M12 6.5C8.96 6.5 6.5 8.96 6.5 12c0 2.34 1.45 4.33 3.51 5.14-.05-.44-.09-1.11.02-1.59l.78-3.32s-.2-.4-.2-.99c0-.93.54-1.62 1.21-1.62.57 0 .85.43.85.95 0 .58-.37 1.44-.56 2.24-.16.67.33 1.21.99 1.21 1.19 0 2.11-1.25 2.11-3.07 0-1.6-1.15-2.73-2.8-2.73-1.91 0-3.03 1.43-3.03 2.91 0 .58.22 1.19.5 1.53.05.07.06.12.04.2-.06.24-.19.78-.22.89-.04.14-.13.17-.3.1-1.12-.52-1.82-2.16-1.82-3.48 0-2.83 2.06-5.43 5.94-5.43 3.12 0 5.54 2.22 5.54 5.2 0 3.1-1.95 5.59-4.66 5.59-.91 0-1.77-.47-2.06-1.03l-.56 2.14c-.2.78-.75 1.75-1.12 2.35.84.26 1.74.4 2.68.4 5.52 0 10-4.48 10-10S17.52 6.5 12 6.5z"
        fill="white"
      />
    </svg>
  )
}

export function RetroTvIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="2" y="7" width="20" height="14" rx="3" fill="#1e2230" stroke="#3b82f6" strokeWidth="1.3" />
      <rect x="4.5" y="9.5" width="11" height="9" rx="1.5" fill="#0f111a" />
      <circle cx="18.5" cy="11.5" r="1.2" fill="#3b82f6" />
      <circle cx="18.5" cy="15.5" r="1.2" fill="#3b82f6" />
      <path d="M8 3l4 4 4-4" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DslrCameraIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#181a24" stroke="#e2e8f0" strokeWidth="1.3" />
      <circle cx="12" cy="14" r="4" fill="#0d0f18" stroke="#38bdf8" strokeWidth="1.4" />
      <circle cx="12" cy="14" r="1.8" fill="#38bdf8" opacity="0.6" />
      <circle cx="18" cy="11" r="0.8" fill="#ef4444" />
    </svg>
  )
}

export function SourceMediaIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.3" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" stroke="#818cf8" strokeWidth="1.1" />
      <polygon points="10,9.5 15,12 10,14.5" fill="#a5b4fc" />
    </svg>
  )
}

export function CustomRatioIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M8 12h8M12 8v8" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

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
    if (ar === '9:16') {
      return <YouTubeTikTokPaperSlideIcon />
    }
    if (ar === '16:9') {
      return <YouTubeIcon size={14} />
    }
    if (ar === '3:4' || ar === '1:1' || ar === '4:5') {
      return <InstagramIcon size={14} />
    }
    if (ar === '2:3') {
      return <PinterestIcon size={14} />
    }
    if (ar === '21:9') {
      return <CinemascopeIcon size={14} />
    }
    if (ar === '4:3' || ar === '5:4') {
      return <RetroTvIcon size={14} />
    }
    if (ar === '3:2') {
      return <DslrCameraIcon size={14} />
    }
    if (ar === 'source') {
      return <SourceMediaIcon size={14} />
    }
    if (ar === 'custom') {
      return <CustomRatioIcon size={14} />
    }
    return <Tv size={14} className="text-brand shrink-0" />
  }

  // Specific icon for preset items
  const renderPresetIcon = (presetId: string) => {
    if (presetId === '9:16') {
      return <YouTubeTikTokPaperSlideIcon />
    }
    if (presetId === '16:9') {
      return <YouTubeIcon size={15} />
    }
    if (presetId === '3:4' || presetId === '1:1' || presetId === '4:5') {
      return <InstagramIcon size={15} />
    }
    if (presetId === '2:3') {
      return <PinterestIcon size={15} />
    }
    if (presetId === '21:9') {
      return <CinemascopeIcon size={15} />
    }
    if (presetId === '4:3' || presetId === '5:4') {
      return <RetroTvIcon size={15} />
    }
    if (presetId === '3:2') {
      return <DslrCameraIcon size={15} />
    }
    if (presetId === 'source') {
      return <SourceMediaIcon size={15} />
    }
    if (presetId === 'custom') {
      return <CustomRatioIcon size={15} />
    }
    return <Tv size={15} className="text-brand shrink-0" />
  }

  return (
    <div className="absolute bottom-2 right-2 z-20 flex items-center select-none">
      {/* Tooltip on Hover/Focus */}
      {tooltipVisible && !open && currentPreset && (
        <div
          role="tooltip"
          data-testid="ratio-platform-tooltip"
          className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink-950 border border-ink-700 shadow-xl text-[11px] text-ink-200 z-50 pointer-events-none whitespace-nowrap animate-in fade-in duration-100"
        >
          <div className="font-semibold text-white flex items-center gap-1.5">
            <span>{currentPreset.label}</span>
            <span className="text-ink-500 font-mono text-[10px]">({sequenceSettings.width} × {sequenceSettings.height})</span>
          </div>
          <div className="text-ink-400 text-[10px]">{currentPreset.description}</div>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-brand">
            {currentPreset.platforms.slice(0, 3).map((plat) => (
              <span key={plat} className="px-1 py-0.5 rounded bg-brand/10 border border-brand/30">
                {plat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compact Closed Trigger Button: Takes small space with actual icons */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="ratio-selector-btn"
        id="aspect-ratio-selector-trigger"
        title="Sequence Aspect Ratio and Output Format"
        aria-label="Aspect Ratio Selector"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className="flex items-center gap-2 h-7 px-2.5 rounded-md bg-ink-950 hover:bg-ink-900 border border-ink-750 hover:border-ink-600 text-ink-200 hover:text-white shadow-lg transition-all text-xs font-medium"
      >
        {renderRepresentativeIcon()}
        <span className="font-mono text-[11px] font-semibold tracking-tight">
          {sequenceSettings.isCustom
            ? `${sequenceSettings.width} × ${sequenceSettings.height}`
            : sequenceSettings.aspectRatio}
        </span>
        <ChevronDown size={12} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Accessible Popover Menu: Positioned bottom-right above trigger */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Aspect Ratio Presets"
          data-testid="ratio-popover"
          className="absolute bottom-full right-0 mb-2 w-72 max-h-72 overflow-y-auto rounded-xl bg-ink-950 border border-ink-750 shadow-2xl p-1.5 z-50 text-xs text-ink-200 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-ink-800 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Sequence Aspect Ratio
            </span>
            <span className="font-mono text-[10px] text-brand">
              {sequenceSettings.width} × {sequenceSettings.height}
            </span>
          </div>

          {/* Preset List with Real Platform Icons and Stacked Paper Slide */}
          <div className="space-y-0.5">
            {RATIO_PRESETS.map((preset) => {
              const active = sequenceSettings.aspectRatio === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`ratio-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors text-left ${
                    active
                      ? 'bg-brand/20 text-brand font-medium'
                      : 'hover:bg-ink-850 text-ink-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1.5">
                    <div className="flex items-center justify-center w-6 h-5 shrink-0">
                      {renderPresetIcon(preset.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium leading-tight">
                        <span>{preset.label}</span>
                        <span className="text-[9px] font-mono text-ink-500">
                          ({preset.width} × {preset.height})
                        </span>
                      </div>
                      <div className="text-[9px] text-ink-500 truncate leading-tight">
                        {preset.platforms.slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  </div>
                  {active && <Check size={13} className="shrink-0 text-brand" />}
                </button>
              )
            })}
          </div>

          {/* Custom Dimension Editor: Takes small space, quick customize */}
          {sequenceSettings.aspectRatio === 'custom' && (
            <div
              data-testid="custom-ratio-editor"
              className="mt-2 pt-2 border-t border-ink-800 space-y-2 animate-in fade-in duration-100"
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-ink-300">
                <span className="flex items-center gap-1 text-cyan-400">
                  <CustomRatioIcon size={12} />
                  <span>Custom Dimensions</span>
                </span>
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
                  <label className="block text-[9px] text-ink-500 font-mono mb-0.5">WIDTH PX</label>
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
                  <label className="block text-[9px] text-ink-500 font-mono mb-0.5">HEIGHT PX</label>
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
