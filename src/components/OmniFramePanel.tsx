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
  Crosshair,
} from 'lucide-react'
import { useEditor } from '../store'
import type { OmniframeScopeType } from '../types'
import { SelectionMaskSubTool } from './SelectionMaskSubTool'
import { RotoMaskSubTool } from './RotoMaskSubTool'
import { RECOLOR_BLENDS, type RecolorBlend } from '../lib/recolor'
import { PanelSection } from './PanelSection'

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
  { id: 'select', label: 'Select', icon: Wand2, hint: 'Selection sub-tools: box, ellipse, lasso, brush' },
  { id: 'rotomask', label: 'Roto', icon: Crosshair, hint: 'Click-to-segment rotoscoping (RotoMask)' },
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
  const omniTransparentSelect = useEditor((s) => s.omniTransparentSelect)
  const omniSelectMainElement = useEditor((s) => s.omniSelectMainElement)
  const omniExtractCutout = useEditor((s) => s.omniExtractCutout)
  const omniSetPatchUnder = useEditor((s) => s.omniSetPatchUnder)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]
  const selectedChar = omniframeCharacters.find((c) => c.id === selectedCharacterId) || omniframeCharacters[0]
  const currentFrame = Math.round(playhead * projectFps)
  const patchUnderOn = !!((activeClip as unknown as { patch?: unknown } | undefined)?.patch)

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
          <Scissors size={17} className="text-brand-400" />
          <span className="font-semibold text-ink-100">OmniFrame</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand-400 font-mono font-medium">
          Frame Scope
        </span>
      </div>
      <p className="text-[10px] leading-snug text-ink-500 -mt-2">
        Apply tools to the whole frame or one region: select or drag a region, resize it, then shift, recolor or clean it across frames.
      </p>

      {/* Target Video Banner */}
      <div className="px-2.5 py-1.5 rounded-lg bg-ink-900 border border-ink-800 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <Film size={15} className="text-brand-400 shrink-0" />
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
      <section aria-labelledby="omniframe-workflow-heading" className="space-y-1.5">
        <h3 id="omniframe-workflow-heading" className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Workflow
        </h3>
        <div
          data-testid="omniframe-section-nav"
          role="group"
          aria-label="OmniFrame workflow steps"
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
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{sec.label}</span>
            </button>
          )
        })}
        </div>
      </section>

      <Section active={section === 'segments'}>
      {/* Quick Sub-Mode Channels Bar */}
      {(!activeSubMode || activeSubMode === 'omniframe-overview') && (
        <section aria-labelledby="omniframe-channels-heading" className="space-y-1">
          <h3 id="omniframe-channels-heading" className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Quick tools
          </h3>
          <div role="group" aria-label="OmniFrame quick tools" className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              data-testid="omniframe-submode-selection-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-selection', 'OmniFrame Selection Subtool', 'BoxSelect')}
              className="flex min-h-[84px] flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900 p-2 text-center transition-all hover:border-brand/60 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BoxSelect size={20} className="text-brand-400 mb-1" />
              <div className="font-semibold text-[11px] leading-tight text-ink-100">Selection</div>
              <div className="text-[10px] text-ink-400">6 sub-tools</div>
            </button>

            <button
              type="button"
              data-testid="omniframe-submode-shift-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-shift', 'Select, Drag & Shift Regions', 'Move')}
              className="flex min-h-[84px] flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900 p-2 text-center transition-all hover:border-brand/60 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Move size={20} className="text-amber-400 mb-1" />
              <div className="font-semibold text-[11px] leading-tight text-ink-100">Shift & Infill</div>
              <div className="text-[10px] text-ink-400">Multi-frame</div>
            </button>

            <button
              type="button"
              data-testid="omniframe-submode-recolor-btn"
              onClick={() => openSubMode('omniframe', 'omniframe-recolor', 'Recolor & Material Palette', 'PaintBucket')}
              className="flex min-h-[84px] flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900 p-2 text-center transition-all hover:border-brand/60 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <PaintBucket size={20} className="text-cyan-400 mb-1" />
              <div className="font-semibold text-[11px] leading-tight text-ink-100">Recolor</div>
              <div className="text-[10px] text-ink-400">Hue & presets</div>
            </button>
          </div>
        </section>
      )}

      {/* Target Asset / Media Switcher */}
      {(!activeSubMode || activeSubMode === 'omniframe-selection' || activeSubMode === 'omniframe-recolor') && (
        <section aria-labelledby="omniframe-asset-heading" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h3 id="omniframe-asset-heading" className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Active Asset</h3>
            <span className="text-[10px] text-brand-400 font-mono">Image & video</span>
          </div>
          <div role="group" aria-label="Choose an asset to edit by region" className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="switch-asset-room-btn"
              aria-pressed={omniframeCharacters.some((c) => c.id.startsWith('char_towel'))}
              title="Load the room chair and towel photo to edit by region"
              onClick={() => {
                useEditor.getState().ensureDemoAssets(); loadAssetObjects('asset-room-chair-towel')
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
              <div className="text-[10px] text-ink-400 truncate">Real Uploaded Photo</div>
            </button>

            <button
              type="button"
              data-testid="switch-asset-deathnote-btn"
              aria-pressed={omniframeCharacters.some((c) => c.id.startsWith('char_light'))}
              title="Load the Death Note characters video or image to edit by region"
              onClick={() => {
                useEditor.getState().ensureDemoAssets(); loadAssetObjects('asset-death-note-vid')
              }}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                omniframeCharacters.some((c) => c.id.startsWith('char_light'))
                  ? 'bg-brand/20 border-brand text-white shadow-xs'
                  : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px] truncate">Death Note 5 Chibi</div>
              <div className="text-[10px] text-ink-400 truncate">Characters Video/Image</div>
            </button>
          </div>
        </section>
      )}

      </Section>

      <Section active={section === 'select'}>
      {/* Unified Selection & Masking Sub-Tool */}
      {(!activeSubMode || activeSubMode === 'omniframe-selection' || activeSubMode === 'omniframe-recolor') && (
        <SelectionMaskSubTool context="omniframe" />
      )}
      <div className="grid grid-cols-2 gap-1 pt-1.5">
        <button type="button" data-testid="omni-transparent-btn" title="Transparent selection: ignore the bg colour, keep the element"
          onClick={() => { omniTransparentSelect().catch(() => undefined) }}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200 hover:text-white text-[10px] truncate">
          <span className="truncate">Transparent</span>
        </button>
        <button type="button" data-testid="omni-main-element-btn" title="Mind main element: flood the bg from the borders, keep the subject"
          onClick={() => { omniSelectMainElement().catch(() => undefined) }}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200 hover:text-white text-[10px] truncate">
          <span className="truncate">Main element</span>
        </button>
        <button type="button" data-testid="omni-extract-btn" title="Create a clip on the track above holding only the cut-out section"
          onClick={() => { omniExtractCutout() }}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-brand/20 border border-brand/40 text-brand-400 hover:bg-brand/30 text-[10px] truncate">
          <span className="truncate">Extract cut-out</span>
        </button>
        <button type="button" data-testid="omni-patchunder-btn" title="Patch under: smart-fill the hole on the source for every frame"
          onClick={() => { omniSetPatchUnder(!patchUnderOn) }}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] truncate ${patchUnderOn ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-ink-800 border-ink-700 text-ink-200 hover:text-white'}`}>
          <span className="truncate">Patch under</span>
        </button>
      </div>
      </Section>

      <Section active={section === 'rotomask'}>
      {/* RotoMask Sub-Tool - click-to-segment rotoscoping */}
      <RotoMaskSubTool context="omniframe" />
      </Section>

      {/* Detected Characters List & Multi-Frame Shift */}
      {(!activeSubMode || activeSubMode === 'omniframe-shift') && (
        <>
          <Section active={section === 'segments'}>
          <section aria-labelledby="omniframe-detected-heading" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
          <h3 id="omniframe-detected-heading" className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Segments <span className="font-mono text-ink-300">({omniframeCharacters.length})</span>
          </h3>
          <button
            type="button"
            data-testid="omniframe-auto-arrange-btn"
            onClick={handleAutoArrange}
            className="flex min-h-7 items-center gap-1 rounded bg-brand/20 px-2 py-1 text-[10px] font-semibold text-brand-400 transition-colors hover:bg-brand/30 hover:text-white border border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Sparkles size={14} />
            <span>Rearrange Clean</span>
          </button>
        </div>
        <div tabIndex={0} aria-label="Character list, scrollable" className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-0.5">
          {omniframeCharacters.map((char) => {
            const isSelected = char.id === selectedChar?.id
            return (
              <button
                key={char.id}
                type="button"
                data-testid={`character-card-${char.id}`}
                aria-pressed={isSelected}
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
                className={`flex min-h-[46px] items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-brand/15 border-brand text-white shadow-xs ring-1 ring-brand/40'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
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
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[11px] leading-tight">{char.name}</div>
                    <div className="truncate text-[10px] text-ink-400">{char.label}</div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-row items-center justify-end gap-1">
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono uppercase ${
                    char.scope === 'all'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : char.scope === 'section'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {char.scope === 'all' ? 'All Frames' : char.scope === 'section' ? 'Section' : '1 Frame'}
                  </span>
                  {(char.transform.x !== 0 || char.transform.y !== 0) && (
                    <span className="text-[10px] text-brand-400 font-mono font-bold">
                      Δ ({char.transform.x > 0 ? `+${char.transform.x}` : char.transform.x}, {char.transform.y > 0 ? `+${char.transform.y}` : char.transform.y})
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
          </section>
          </Section>

      {selectedChar && (
        <div className="flex flex-col gap-3 p-2.5 rounded-xl bg-ink-900/90 border border-ink-800">
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
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-brand/20 border border-brand/40 text-brand-400 font-medium hover:bg-brand/30 transition-colors truncate"
              >
                <Scissors size={15} className="shrink-0" />
                <span className="truncate">Cut to Track</span>
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
        <PanelSection
          title="Frame Verification"
          hint={`${verificationPoints.length} checkpoints`}
          defaultOpen={false}
          testId="omniframe-verification"
        >
        <div data-testid="omniframe-verification-table" className="rounded-lg bg-ink-950/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
            <span>Evaluated Position</span>
            <span className="font-mono text-brand-400 font-bold">Scope: {selectedChar.scope}</span>
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
                    <span className={`text-[10px] px-1 py-0.2 rounded font-bold uppercase ${
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
        </PanelSection>
      )}
        </>
      )}
    </div>
  )
}
