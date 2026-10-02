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
  PaintBucket,
  Image as ImageIcon,
  BoxSelect,
  Wand2,
} from 'lucide-react'
import { useEditor } from '../store'
import type { OmniframeScopeType } from '../types'
import { SelectionMaskSubTool } from './SelectionMaskSubTool'
import { RECOLOR_BLENDS, type RecolorBlend } from '../lib/recolor'

/**
 * The panel used to render every control at once, which made it read as a
 * wall of small icons. These are the sections it is split into; only the
 * active one renders.
 */
const PANEL_SECTIONS = [
  {
    id: 'segments',
    label: 'Segments',
    icon: BoxSelect,
    hint: 'Pick the asset and choose a detected segment',
  },
  { id: 'select', label: 'Mask', icon: Wand2, hint: 'Selection and masking sub-tools' },
  { id: 'transform', label: 'Transform', icon: Move, hint: 'Position, scale and rotation' },
  { id: 'color', label: 'Color', icon: PaintBucket, hint: 'Recolor the segment and pick a blend mode' },
  { id: 'scope', label: 'Scope', icon: Clock, hint: 'All frames, a section, or a single frame' },
  { id: 'actions', label: 'Actions', icon: Layers, hint: 'Duplicate, cut to track, remove, and verify' },
] as const

type PanelSection = (typeof PANEL_SECTIONS)[number]['id']

/** Renders children only when its section is the active one. */
function Section({ active, children }: { active: boolean; children: React.ReactNode }) {
  return active ? <>{children}</> : null
}

export function OmniFramePanel() {
  const assets = useEditor((s) => s.assets)
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
  const deleteCharacter = useEditor((s) => s.deleteCharacter)
  const restoreCharacter = useEditor((s) => s.restoreCharacter)
  const resetCharacterPosition = useEditor((s) => s.resetCharacterPosition)
  const ensureTrack = useEditor((s) => s.ensureTrack)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const loadAssetObjects = useEditor((s) => s.loadAssetObjects)
  const recolorActiveSelection = useEditor((s) => s.recolorActiveSelection)
  const activeSubMode = useEditor((s) => s.activeSubMode)
  const openSubMode = useEditor((s) => s.openSubMode)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]
  const selectedChar = omniframeCharacters.find((c) => c.id === selectedCharacterId) || omniframeCharacters[0]
  const currentFrame = Math.round(playhead * projectFps)

  const handleAutoArrange = () => {
    const positions: Record<string, { x: number; y: number; scale: number }> = {
      char_light: { x: -30, y: 0, scale: 0.95 },
      char_l: { x: 40, y: 35, scale: 0.95 },
      char_mello: { x: 10, y: -10, scale: 0.95 },
      char_near: { x: 30, y: 20, scale: 0.95 },
      char_ryuk: { x: 60, y: -20, scale: 0.95 },
    }
    omniframeCharacters.forEach((c) => {
      const pos = positions[c.id] || { x: 0, y: 0, scale: 1 }
      setOmniframeCharacterTransform(c.id, pos, 'all')
    })
  }

  // Scope form state for active character
  const [sectionStart, setSectionStart] = useState<number>(selectedChar?.sectionRange?.start ?? 2.0)
  const [sectionEnd, setSectionEnd] = useState<number>(selectedChar?.sectionRange?.end ?? 5.0)
  const [targetFrame, setTargetFrame] = useState<number>(selectedChar?.frameNumber ?? currentFrame)
  const [section, setSection] = useState<PanelSection>('segments')
  const [recolorBlend, setRecolorBlend] = useState<RecolorBlend>(
    selectedChar?.recolorBlend ?? 'dye',
  )

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
          <Scissors size={17} className="text-brand" />
          <span className="font-semibold text-ink-100">OmniFrame Mask</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-mono font-medium">
          Multi-Frame Cuts
        </span>
      </div>

      {/* Target Video Banner */}
      <div className="px-2.5 py-1.5 rounded-lg bg-ink-900 border border-ink-800 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <Film size={15} className="text-brand shrink-0" />
          <span className="font-medium text-ink-200 truncate">
            {activeClip ? activeClip.name : 'Death Note Chibi - 5 Characters.mp4'}
          </span>
        </div>
        <span className="text-[10px] text-ink-400 font-mono shrink-0">
          F#{currentFrame} ({playhead.toFixed(2)}s)
        </span>
      </div>

      {/* Section navigation — the panel used to render every control at once,
          which is what made it read as a wall of small icons. One section
          at a time; the controls you are not using are not on screen. */}
      <div
        data-testid="omniframe-section-nav"
        className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-ink-950 border border-ink-800"
      >
        {PANEL_SECTIONS.map((sec) => {
          const Icon = sec.icon
          const active = section === sec.id
          return (
            <button
              key={sec.id}
              type="button"
              data-testid={`omniframe-section-${sec.id}`}
              title={sec.hint}
              aria-label={sec.label}
              aria-pressed={active}
              onClick={() => setSection(sec.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-md transition-colors ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[9px] font-medium leading-none">{sec.label}</span>
            </button>
          )
        })}
      </div>

      <Section active={section === 'segments'}>
      {/* Quick Sub-Mode Channels Bar */}
      {(!activeSubMode || activeSubMode === 'omniframe-overview') && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">
            OmniFrame Channels
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              data-testid="omniframe-submode-selection-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-selection', 'OmniFrame Selection Subtool', 'BoxSelect')}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-center transition-all"
            >
              <BoxSelect size={20} className="text-brand mb-1" />
              <div className="font-semibold text-[10px] text-ink-100">Selection</div>
              <div className="text-[9px] text-ink-400">6 Subtools</div>
            </button>

            <button
              type="button"
              data-testid="omniframe-submode-shift-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-shift', 'AI Segmentation & Character Shift', 'Move')}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-center transition-all"
            >
              <Move size={20} className="text-amber-400 mb-1" />
              <div className="font-semibold text-[10px] text-ink-100">Shift & Infill</div>
              <div className="text-[9px] text-ink-400">Multi-Frame</div>
            </button>

            <button
              type="button"
              data-testid="omniframe-submode-recolor-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-recolor', 'Recolor & Material Palette', 'PaintBucket')}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-center transition-all"
            >
              <PaintBucket size={20} className="text-cyan-400 mb-1" />
              <div className="font-semibold text-[10px] text-ink-100">Recolor</div>
              <div className="text-[9px] text-ink-400">Hue & Presets</div>
            </button>
          </div>
        </div>
      )}

      {/* Target Asset / Media Switcher */}
      {(!activeSubMode || activeSubMode === 'omniframe-selection' || activeSubMode === 'omniframe-recolor') && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            <span>Active Asset Mode</span>
            <span className="text-[9px] text-brand-400 font-mono">Image & Video Eligible</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="switch-asset-room-btn"
              onClick={() => {
                loadAssetObjects('asset-room-chair-towel')
                const roomAsset = assets.find((a) => a.id === 'asset-room-chair-towel')
                if (roomAsset) {
                  const trkId = ensureTrack('video')
                  if (!clips.some((c) => c.assetId === 'asset-room-chair-towel')) {
                    addClipToTrack(trkId, roomAsset.id, 0)
                  }
                }
              }}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                omniframeCharacters.some((c) => c.id.startsWith('char_towel'))
                  ? 'bg-brand/20 border-brand text-white shadow-xs'
                  : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px] truncate">Room Chair & Towel</div>
              <div className="text-[9px] text-ink-400 truncate">Real Uploaded Photo</div>
            </button>

            <button
              type="button"
              data-testid="switch-asset-deathnote-btn"
              onClick={() => {
                loadAssetObjects('asset-death-note-vid')
              }}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                omniframeCharacters.some((c) => c.id.startsWith('char_light'))
                  ? 'bg-brand/20 border-brand text-white shadow-xs'
                  : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px] truncate">Death Note 5 Chibi</div>
              <div className="text-[9px] text-ink-400 truncate">Characters Video/Image</div>
            </button>
          </div>
        </div>
      )}

      </Section>

      <Section active={section === 'select'}>
      {/* Unified Selection & Masking Sub-Tool */}
      {(!activeSubMode || activeSubMode === 'omniframe-selection' || activeSubMode === 'omniframe-recolor') && (
        <SelectionMaskSubTool />
      )}
      </Section>

      {/* Detected Characters List & Multi-Frame Shift */}
      {(!activeSubMode || activeSubMode === 'omniframe-shift') && (
        <>
          <Section active={section === 'segments'}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-400 uppercase tracking-wider">
          <span>Detected Characters ({omniframeCharacters.length})</span>
          <button
            type="button"
            data-testid="omniframe-auto-arrange-btn"
            onClick={handleAutoArrange}
            className="flex items-center gap-1 text-[10px] text-brand hover:text-white px-2 py-0.5 rounded bg-brand/20 hover:bg-brand/30 border border-brand/40 font-semibold transition-colors"
          >
            <Sparkles size={14} />
            <span>Rearrange Clean</span>
          </button>
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
          </Section>

      {selectedChar && (
        <div className="flex flex-col gap-3 p-2.5 rounded-xl bg-ink-900/90 border border-ink-800">
          <Section active={section === 'transform'}>
          <div className="flex items-center justify-between pb-1.5 border-b border-ink-800">
            <span className="font-semibold text-ink-100 flex items-center gap-1 truncate pr-1" title={selectedChar.name}>
              <Move size={15} className="text-brand shrink-0" />
              <span className="truncate">Transform: {selectedChar.name}</span>
            </span>
            <button
              type="button"
              data-testid="omniframe-reset-pos-btn"
              title="Reset Position"
              onClick={() => resetCharacterPosition(selectedChar.id)}
              className="text-[10px] text-ink-400 hover:text-white flex items-center gap-1 shrink-0 px-1.5 py-1 rounded hover:bg-ink-800 min-h-[24px]"
            >
              <RotateCcw size={13} />
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
                aria-label="Position X"
                min={-400}
                max={400}
                value={selectedChar.transform.x}
                onChange={(e) => handleUpdateTransform({ x: Number(e.target.value) })}
                className="of-range w-full"
              />
              <input
                type="number"
                data-testid="omniframe-pos-x-input"
                aria-label="Position X (px)"
                value={selectedChar.transform.x}
                onChange={(e) => handleUpdateTransform({ x: Number(e.target.value) })}
                className="w-14 min-h-[24px] bg-ink-950 border border-ink-700 rounded px-1 py-1 text-[10px] font-mono text-center text-ink-100"
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
                aria-label="Position Y"
                min={-300}
                max={300}
                value={selectedChar.transform.y}
                onChange={(e) => handleUpdateTransform({ y: Number(e.target.value) })}
                className="of-range w-full"
              />
              <input
                type="number"
                data-testid="omniframe-pos-y-input"
                aria-label="Position Y (px)"
                value={selectedChar.transform.y}
                onChange={(e) => handleUpdateTransform({ y: Number(e.target.value) })}
                className="w-14 min-h-[24px] bg-ink-950 border border-ink-700 rounded px-1 py-1 text-[10px] font-mono text-center text-ink-100"
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
                aria-label="Scale"
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
                aria-label="Rotation"
                min={-180}
                max={180}
                value={selectedChar.transform.rotation}
                onChange={(e) => handleUpdateTransform({ rotation: parseInt(e.target.value, 10) })}
                className="of-range w-full"
              />
            </div>
          </div>

          </Section>
          <Section active={section === 'color'}>
          {/* Object Recolor & Tint (Photorealistic Luminance Preservation) */}
          <div className="pt-2 border-t border-ink-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              <div className="flex items-center gap-1">
                <PaintBucket size={14} className="text-amber-400" />
                <span>Object Color & Recolor</span>
              </div>
              <span className="font-mono text-[9px] text-brand">
                {selectedChar.recolorColor || 'Original'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'Original', hex: '' },
                { label: 'Royal Blue', hex: '#2563eb' },
                { label: 'Crimson Red', hex: '#dc2626' },
                { label: 'Golden Amber', hex: '#d97706' },
                { label: 'Emerald Green', hex: '#059669' },
                { label: 'Purple Violet', hex: '#7c3aed' },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  data-testid={`char-recolor-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
                  title={`${c.label} (${c.hex || 'Default'})`}
                  onClick={() => {
                    if (!c.hex) {
                      recolorActiveSelection('')
                    } else {
                      recolorActiveSelection(c.hex, recolorBlend)
                    }
                  }}
                  className={`px-2 py-1 min-h-[24px] rounded text-[10px] border font-medium transition-all ${
                    (selectedChar.recolorColor === c.hex || (!selectedChar.recolorColor && !c.hex))
                      ? 'border-white bg-white/20 text-white font-bold'
                      : 'border-ink-800 bg-ink-900 text-ink-300 hover:text-white'
                  }`}
                  style={c.hex ? { borderLeftColor: c.hex, borderLeftWidth: 3 } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Blend mode — how the colour is applied to the object's pixels.
                Flat compositing is what made the towel read as a coloured
                layer; these keep the object's own lightness structure. */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[9px] uppercase tracking-wider text-ink-500 shrink-0">
                Blend
              </span>
              <select
                data-testid="recolor-blend-select"
                value={recolorBlend}
                onChange={(e) => setRecolorBlend(e.target.value as RecolorBlend)}
                title="How the colour is applied to the object's pixels"
                className="flex-1 min-w-0 min-h-[24px] bg-ink-950 border border-ink-800 rounded px-1.5 py-1 text-[10px] text-ink-200 outline-none focus:border-brand"
              >
                {RECOLOR_BLENDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <p
              data-testid="recolor-blend-hint"
              className="text-[9px] text-ink-500 leading-tight"
            >
              {RECOLOR_BLENDS.find((b) => b.value === recolorBlend)?.hint}
            </p>
          </div>

          </Section>
          <Section active={section === 'scope'}>
          {/* Scope Selector: All Frames vs Section vs Only 1 Frame */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              <span>Propagation Scope</span>
              <Clock size={14} />
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

          </Section>
          <Section active={section === 'actions'}>
          {/* Action Operations */}
          <div className="pt-2 border-t border-ink-800 flex flex-col gap-1.5">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              Character Operations
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="omniframe-cut-to-track-btn"
                title="Cut character to new timeline track"
                aria-label="Cut character to track"
                onClick={() => cutCharacterToNewTrack(selectedChar.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/20 border border-brand/40 text-brand font-medium hover:bg-brand/30 transition-colors truncate"
              >
                <Scissors size={15} className="shrink-0" />
                <span className="truncate">Cut to Track</span>
              </button>

              <button
                type="button"
                data-testid="omniframe-duplicate-btn"
                title="Duplicate character instance"
                aria-label="Duplicate character"
                onClick={() => duplicateCharacter(selectedChar.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200 hover:text-white hover:bg-ink-750 transition-colors truncate"
              >
                <Copy size={15} className="shrink-0" />
                <span className="truncate">Duplicate</span>
              </button>

              {selectedChar.transform.opacity === 0 ? (
                <button
                  type="button"
                  data-testid="omniframe-restore-btn"
                  title="Restore character visibility"
                  aria-label="Restore character"
                  onClick={() => restoreCharacter(selectedChar.id)}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-medium hover:bg-emerald-500/30 transition-colors truncate"
                >
                  <Eye size={15} className="shrink-0" />
                  <span className="truncate">Restore</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="omniframe-delete-infill-btn"
                  title="Remove character and infill background cleanly"
                  aria-label="Delete and infill character"
                  onClick={() => removeCharacterInfill(selectedChar.id)}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium hover:bg-amber-500/30 transition-colors truncate"
                >
                  <Trash2 size={15} className="shrink-0" />
                  <span className="truncate">Delete / Infill</span>
                </button>
              )}

              <button
                type="button"
                data-testid="omniframe-delete-permanent-btn"
                title="Permanently remove character track"
                aria-label="Remove character"
                onClick={() => deleteCharacter(selectedChar.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-medium hover:bg-red-500/30 transition-colors truncate"
              >
                <Trash2 size={15} className="shrink-0" />
                <span className="truncate">Remove</span>
              </button>
            </div>
          </div>
          </Section>
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
                      evalTransform.opacity === 0
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                        : isModified
                        ? 'bg-brand text-white'
                        : 'bg-ink-800 text-ink-500'
                    }`}>
                      {evalTransform.opacity === 0 ? 'Infilled' : isModified ? 'Shifted' : 'Original'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
