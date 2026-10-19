import React, { useState, useEffect } from 'react'
import { buildRetroText, buildWatermark, WATERMARK_LEVELS, type WatermarkLevel } from '../lib/builders'
import { TEXT_PRESETS, buildTextPreset, lengthGuidance } from '../lib/textPresets'
import { Type, Play, Sparkles, Bold, Italic, AlignLeft, Check, ChevronRight, Upload, Trash2 } from 'lucide-react'
import { useEditor } from '../store'
import type { TextStyle } from '../types'
import { previewTextClip } from '../lib/visualPreviewActions'
import { registerAllCustomFonts } from '../lib/fonts'

const BUILTIN_FONTS: Array<{ value: string; label: string }> = [
  { value: 'sans-serif', label: 'Clean Sans (system)' },
  { value: 'Georgia, serif', label: 'Serif (Georgia)' },
  { value: '"Courier New", monospace', label: 'Mono (Courier)' },
  { value: 'Impact, sans-serif', label: 'Display (Impact)' },
]

export function TextPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const setClipProp = useEditor((s) => s.setClipProp)
  const activeSubMode = useEditor((s) => s.activeSubMode)
  const openSubMode = useEditor((s) => s.openSubMode)

  const selectedClip = clips.find((c) => c.id === selectedClipId)
  const isEditingTextClip = Boolean(selectedClip?.textStyle)
  const customFonts = useEditor((s) => s.customFonts)
  const importCustomFontFile = useEditor((s) => s.importCustomFontFile)
  const removeCustomFont = useEditor((s) => s.removeCustomFont)
  const importSubtitleFile = useEditor((s) => s.importSubtitleFile)
  const assets = useEditor((s) => s.assets)
  const watermarks = useEditor((s) => s.watermarks)
  const addWatermark = useEditor((s) => s.addWatermark)
  const removeWatermark = useEditor((s) => s.removeWatermark)
  const [presetText, setPresetText] = useState('YOUR TEXT')
  const [presetColor, setPresetColor] = useState('#ff2a4d')
  const [presetSeed, setPresetSeed] = useState(7)
  const [presetMsg, setPresetMsg] = useState('')
  const [retroText, setRetroText] = useState('NOELLE')
  const [retroSub, setRetroSub] = useState('★ RETRO ★')
  const [retroColor, setRetroColor] = useState('#ff2a4d')
  const [retroSeed, setRetroSeed] = useState(7)
  const [retroMethod, setRetroMethod] = useState<'effects' | 'traditional'>('traditional')
  const [wmText, setWmText] = useState('@yourname')
  const [wmLevel, setWmLevel] = useState<1 | 2 | 3 | 4 | 5 | 6>(2)
  const [wmColor, setWmColor] = useState('#7dd3fc')
  const [wmChar, setWmChar] = useState('')
  const [wmVoice, setWmVoice] = useState('')
  const [wmCorner, setWmCorner] = useState('br')
  const [studioStatus, setStudioStatus] = useState('')
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__omniframe_text_presets = TEXT_PRESETS.map((p) => ({ id: p.id, name: p.name, category: p.category, source: p.source, ideal: p.ideal, demo: p.demo }))
    w.__omniframe_build_text_preset = (id: string, text: string, seed?: number, color?: string) => buildTextPreset(id, text, { seed: seed ?? 7, color: color ?? '#ff2a4d' })
  }, [])
  const [fontFamily, setFontFamily] = useState('sans-serif')
  const [utilStatus, setUtilStatus] = useState('')

  // Imported fonts register with the document so canvas + DOM render them.
  useEffect(() => {
    void registerAllCustomFonts(useEditor.getState().customFonts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [text, setText] = useState('OmniFrame Title')
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState('#ffffff')
  const [bgColor, setBgColor] = useState('rgba(0,0,0,0.6)')
  const [bold, setBold] = useState(true)
  const [italic, setItalic] = useState(false)

  // Sync state when selected clip changes
  useEffect(() => {
    if (selectedClip?.textStyle) {
      const ts = selectedClip.textStyle
      setText(ts.text || '')
      setFontSize(ts.fontSize || 48)
      setColor(ts.color || '#ffffff')
      setBgColor(ts.backgroundColor || 'transparent')
      setBold(ts.bold ?? true)
      setItalic(ts.italic ?? false)
      setFontFamily(ts.fontFamily || 'sans-serif')
    }
  }, [selectedClipId, selectedClip?.textStyle])

  const handleUpdate = (patch: Partial<TextStyle>) => {
    if (isEditingTextClip && selectedClip) {
      const updatedStyle: TextStyle = {
        ...selectedClip.textStyle,
        text,
        fontSize,
        color,
        backgroundColor: bgColor,
        bold,
        italic,
        ...patch,
      }
      setClipProp(selectedClip.id, {
        textStyle: updatedStyle,
        name: patch.text !== undefined ? patch.text : selectedClip.name,
      })
    }
  }

  const handleAdd = (customText?: string, customStyle?: Partial<TextStyle>, label?: string) => {
    const t = customText || text
    const style = customStyle ?? { fontSize, color, backgroundColor: bgColor, bold, italic, fontFamily }
    previewTextClip(label || t, t, style)
  }

  const applyFontFamily = (value: string) => {
    setFontFamily(value)
    if (isEditingTextClip) handleUpdate({ fontFamily: value })
  }

  const onPickFontFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const names: string[] = []
    for (const file of Array.from(files)) {
      try {
        const font = await importCustomFontFile(file)
        names.push(font.name)
      } catch (err) {
        setUtilStatus(err instanceof Error ? err.message : String(err))
        return
      }
    }
    setUtilStatus(`Imported ${names.join(', ')} - embedded in the project on Save .omni.`)
  }

  const onPickSubtitleFile = async (file: File | null) => {
    if (!file) return
    try {
      const result = await importSubtitleFile(file, fontFamily)
      setUtilStatus(`Imported ${result.cues} caption clip${result.cues === 1 ? '' : 's'} from ${file.name}.`)
    } catch (err) {
      setUtilStatus(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div data-testid="text-panel" className="p-2.5 text-xs text-ink-200 select-none space-y-2.5">
      {/* Selected Clip indicator if editing */}
      {isEditingTextClip ? (
        <div className="flex items-center justify-between pb-1.5 border-b border-ink-800">
          <div className="truncate pr-2">
            <span className="text-[10px] text-brand-400 uppercase tracking-wider font-semibold block">
              Editing Selected Title
            </span>
            <span className="font-medium text-ink-100 truncate block text-[11px]" title={selectedClip?.name}>
              {selectedClip?.name}
            </span>
          </div>
          <button
            type="button"
            data-testid="add-new-title-btn"
            title="Preview a new title at the playhead; Apply in the monitor to add it"
            aria-label="Preview new title"
            onClick={() => handleAdd()}
            className="flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-brand text-ink-300 hover:text-white text-[10px] transition-colors shrink-0"
          >
            <Play size={11} className="shrink-0" />
            <span>Preview Title</span>
          </button>
        </div>
      ) : (
        <div className="pb-1.5 border-b border-ink-800">
          <span className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold block">
            Add Text & Titles
          </span>
          <p className="text-[11px] text-ink-400 mt-0.5">
            Preview titles over the timeline first; Apply in the monitor adds the title clip.
          </p>
        </div>
      )}

      {/* Quick Sub-Mode Channels Bar */}
      {(!activeSubMode || activeSubMode === 'text-overview') && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">
            Text & Title Channels
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="text-submode-presets-btn"
              onClick={() => openSubMode('text', 'text-presets', 'Title Templates & Presets', 'Sparkles')}
              className="flex items-center justify-between p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-left transition-all"
            >
              <div>
                <div className="font-semibold text-[11px] text-ink-100">Presets</div>
                <div className="text-[9px] text-ink-400">Cinematic & Lower 3rd</div>
              </div>
              <ChevronRight size={13} className="text-ink-400" />
            </button>

            <button
              type="button"
              data-testid="text-submode-styling-btn"
              onClick={() => openSubMode('text', 'text-styling', 'Font & Typography', 'Type')}
              className="flex items-center justify-between p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-left transition-all"
            >
              <div>
                <div className="font-semibold text-[11px] text-ink-100">Styling</div>
                <div className="text-[9px] text-ink-400">Fonts & Colors</div>
              </div>
              <ChevronRight size={13} className="text-ink-400" />
            </button>
          </div>
        </div>
      )}

      {/* Content & Typography Styling Section */}
      {(!activeSubMode || activeSubMode === 'text-styling') && (
        <div data-testid="text-styling-section" className="space-y-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
              Text Content
            </label>
            <textarea
              data-testid="text-title-input"
              maxLength={500}
              aria-label="Text content"
              value={text}
              rows={2}
              onChange={(e) => {
                setText(e.target.value)
                handleUpdate({ text: e.target.value })
              }}
              className="w-full px-2.5 py-1.5 rounded-md bg-ink-900 border border-ink-700 text-ink-100 text-xs focus:outline-none focus:border-brand resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
                Font Size ({fontSize}px)
              </label>
              <input
                type="range"
                aria-label="Font size"
                min={18}
                max={120}
                step={2}
                value={fontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setFontSize(val)
                  handleUpdate({ fontSize: val })
                }}
                className="of-range w-full"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
                Style Toggles
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Bold"
                  onClick={() => {
                    const next = !bold
                    setBold(next)
                    handleUpdate({ bold: next })
                  }}
                  className={`p-1.5 rounded border text-xs transition-colors ${
                    bold ? 'bg-brand text-white border-brand' : 'bg-ink-900 text-ink-400 border-ink-700'
                  }`}
                >
                  <Bold size={13} />
                </button>
                <button
                  type="button"
                  title="Italic"
                  onClick={() => {
                    const next = !italic
                    setItalic(next)
                    handleUpdate({ italic: next })
                  }}
                  className={`p-1.5 rounded border text-xs transition-colors ${
                    italic ? 'bg-brand text-white border-brand' : 'bg-ink-900 text-ink-400 border-ink-700'
                  }`}
                >
                  <Italic size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
                Text Color
              </label>
              <div className="flex items-center gap-1.5 h-7">
                <input
                  type="color"
                  data-testid="text-color-picker"
                  aria-label="Text colour"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value)
                    handleUpdate({ color: e.target.value })
                  }}
                  className="w-7 h-7 rounded border border-ink-700 cursor-pointer bg-transparent p-0"
                />
                <span className="font-mono text-[10px] text-ink-400">{color}</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
                Background Box
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Toggle Dark Pill Background"
                  onClick={() => {
                    const next = bgColor === 'transparent' ? 'rgba(0,0,0,0.65)' : 'transparent'
                    setBgColor(next)
                    handleUpdate({ backgroundColor: next })
                  }}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                    bgColor !== 'transparent'
                      ? 'bg-ink-800 text-white border-brand/60'
                      : 'bg-ink-900 text-ink-500 border-ink-800'
                  }`}
                >
                  {bgColor !== 'transparent' ? 'Pill Active' : 'Transparent'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
              Font
            </label>
            <select
              data-testid="text-font-select"
              aria-label="Font family"
              value={fontFamily}
              onChange={(e) => applyFontFamily(e.target.value)}
              className="w-full h-7 px-1.5 rounded-md bg-ink-900 border border-ink-700 text-ink-100 text-[11px] focus:outline-none focus:border-brand"
            >
              <optgroup label="Built-in">
                {BUILTIN_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </optgroup>
              {customFonts.length > 0 && (
                <optgroup label="Imported (saved in project)">
                  {customFonts.map((f) => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div data-testid="fonts-manager" className="rounded-md bg-ink-900/60 border border-ink-800 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">Imported Fonts</span>
              <label
                data-testid="font-import-btn"
                className="flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-brand text-ink-200 hover:text-white text-[10px] cursor-pointer transition-colors"
                title="Import .ttf, .otf, .woff or .woff2 font files"
              >
                <Upload size={11} />
                <span>Import font</span>
                <input
                  type="file"
                  data-testid="font-import-input"
                  accept=".ttf,.otf,.woff,.woff2"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onPickFontFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {customFonts.length === 0 ? (
              <p className="text-[10px] text-ink-500">
                No imported fonts yet. Imported fonts apply to titles, captions and text masks, and are embedded when you Save .omni.
              </p>
            ) : (
              customFonts.map((font) => (
                <div
                  key={font.id}
                  data-testid={`font-row-${font.id}`}
                  className="flex items-center gap-2 rounded bg-ink-900 border border-ink-800 px-2 py-1"
                >
                  <span
                    aria-hidden="true"
                    className="text-[15px] leading-none text-ink-100 w-8 text-center shrink-0"
                    style={{ fontFamily: `"${font.name}", sans-serif` }}
                  >
                    Ag
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-ink-100" title={font.fileName}>{font.name}</span>
                    <span className="block text-[9px] uppercase text-ink-500">
                      {font.format} - {Math.max(1, Math.round(font.sizeBytes / 1024))} KB - saved in project
                    </span>
                  </span>
                  <button
                    type="button"
                    data-testid={`font-apply-${font.id}`}
                    title={`Use ${font.name} for the selected title / next title`}
                    onClick={() => applyFontFamily(font.name)}
                    className="px-1.5 py-1 rounded bg-ink-800 hover:bg-brand text-ink-200 hover:text-white text-[10px] transition-colors shrink-0"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    data-testid={`font-remove-${font.id}`}
                    title={`Remove ${font.name} from this project`}
                    aria-label={`Remove font ${font.name}`}
                    onClick={() => removeCustomFont(font.id)}
                    className="p-1 rounded bg-ink-800 hover:bg-red-600 text-ink-300 hover:text-white transition-colors shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[10px] text-ink-500">Captions from file (.srt / .vtt)</span>
              <label
                data-testid="subtitle-import-btn"
                className="flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-brand text-ink-200 hover:text-white text-[10px] cursor-pointer transition-colors"
                title="Import subtitles as caption clips on their own track"
              >
                <Upload size={11} />
                <span>Import subtitles</span>
                <input
                  type="file"
                  data-testid="subtitle-import-input"
                  accept=".srt,.vtt"
                  className="hidden"
                  onChange={(e) => {
                    void onPickSubtitleFile(e.target.files?.[0] || null)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {utilStatus && (
              <p data-testid="fonts-status" role="status" className="text-[10px] text-ink-400">
                {utilStatus}
              </p>
            )}
          </div>

          <button
            type="button"
            data-testid="add-text-clip-btn"
            aria-label="Preview Title"
            title="Preview this title; Apply in the monitor to add it to the timeline"
            onClick={() => handleAdd()}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md bg-brand hover:bg-brand-600 text-white font-medium transition-colors shadow-sm text-xs"
          >
            <Play size={14} />
            <span>Preview Title</span>
          </button>
        </div>
      )}

      {/* Preset Title Styles */}
      {(!activeSubMode || activeSubMode === 'text-presets') && (
        <div data-testid="text-presets-section" className="pt-2 border-t border-ink-800">
          <span className="text-[10px] font-semibold uppercase text-ink-500 block mb-1.5">
            Title Presets
          </span>
          <div className="space-y-1.5">
            {[
              {
                label: 'Cinematic Title',
                text: 'EPISODE ONE',
                style: { fontSize: 56, color: '#f8fafc', backgroundColor: 'rgba(0,0,0,0.7)', bold: true },
              },
              {
                label: 'Lower Third Subtitle',
                text: 'DIRECTOR · OMNIFRAME',
                style: { fontSize: 32, color: '#38bdf8', backgroundColor: 'rgba(15,23,42,0.85)', bold: true },
              },
              {
                label: 'Neon Amber Glow',
                text: 'HIGHLIGHT REEL',
                style: { fontSize: 48, color: '#f59e0b', backgroundColor: 'rgba(0,0,0,0.8)', bold: true },
              },
              {
                label: 'Callout Pill',
                text: 'STEP 1: IMPORT ASSETS',
                style: { fontSize: 28, color: '#ffffff', backgroundColor: '#6366f1', bold: true },
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                data-testid={`text-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                aria-label={`${preset.label} — “${preset.text}” — preview title`}
                title={`Preview ${preset.label}; Apply in the monitor to add it`}
                onClick={() => handleAdd(preset.text, preset.style, preset.label)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-brand text-left text-ink-300 hover:text-white transition-colors"
              >
                <div>
                  <div className="text-[11px] font-medium text-ink-200">{preset.label}</div>
                  <div className="text-[10px] text-ink-500 italic truncate max-w-[170px]">“{preset.text}”</div>
                </div>
                <Play size={12} className="text-ink-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Preset Library — procedural looks from tutorial.md */}
      <div data-testid="text-preset-library" className="pt-2 border-t border-ink-800 space-y-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Text Preset Library</span>
        <input data-testid="preset-text-input" value={presetText} onChange={(e) => setPresetText(e.target.value)} placeholder="Your text" className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[11px] text-white outline-none focus:border-brand" />
        <div className="flex items-center gap-1.5">
          <input type="color" data-testid="preset-color-input" value={presetColor} onChange={(e) => setPresetColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950 p-0.5" title="Accent colour" />
          <label className="flex items-center gap-1 text-[10px] text-ink-400">Seed
            <input type="number" data-testid="preset-seed-input" value={presetSeed} onChange={(e) => setPresetSeed(Number(e.target.value) || 1)} className="h-6 w-14 rounded border border-ink-700 bg-ink-950 px-1 font-mono text-[10px] text-white outline-none" />
          </label>
          <span className="text-[9px] text-ink-600">Any text works — presets are procedural, not recordings.</span>
        </div>
        <div className="space-y-1">
          {TEXT_PRESETS.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid={`text-preset-lib-${p.id}`}
                onClick={() => {
                  const ids = buildTextPreset(p.id, presetText, { seed: presetSeed, color: presetColor })
                  setPresetMsg(`${p.name}: ${ids.length} editable clips built for “${(presetText || p.demo).trim()}”. ${lengthGuidance(p, presetText)}`)
                }}
                className="flex-1 rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-left hover:border-brand"
                title={`${p.source} · best with ${p.ideal[0]}–${p.ideal[1]} characters`}
              >
                <span className="block text-[11px] font-medium text-ink-100">{p.name}</span>
                <span className="block text-[9px] text-ink-500">{p.category} · best {p.ideal[0]}–{p.ideal[1]} chars</span>
              </button>
            </div>
          ))}
        </div>
        <p className="text-[9px] leading-snug text-ink-500" data-testid="preset-guidance">{presetMsg || lengthGuidance(TEXT_PRESETS[0], presetText)}</p>
      </div>

      {/* Retro Text Studio (Alight Motion study) */}
      <div data-testid="retro-text-studio" className="pt-2 border-t border-ink-800 space-y-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Retro Text Studio</span>
        <input data-testid="retro-text-input" value={retroText} onChange={(e) => setRetroText(e.target.value)} placeholder="Main text" className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[11px] text-white outline-none focus:border-brand" />
        <input data-testid="retro-sub-input" value={retroSub} onChange={(e) => setRetroSub(e.target.value)} placeholder="Small satellite text" className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[11px] text-white outline-none focus:border-brand" />
        <div className="flex items-center gap-1.5">
          <input type="color" data-testid="retro-color-input" value={retroColor} onChange={(e) => setRetroColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950 p-0.5" title="Shadow / glitch colour" />
          <label className="flex items-center gap-1 text-[10px] text-ink-400">Seed
            <input type="number" data-testid="retro-seed-input" value={retroSeed} onChange={(e) => setRetroSeed(Number(e.target.value) || 1)} className="h-6 w-14 rounded border border-ink-700 bg-ink-950 px-1 font-mono text-[10px] text-white outline-none" />
          </label>
          <div className="ml-auto flex rounded-md border border-ink-700 overflow-hidden" role="group" aria-label="Retro method">
            <button type="button" data-testid="retro-method-effects" aria-pressed={retroMethod === 'effects'} onClick={() => setRetroMethod('effects')} className={`h-6 px-2 text-[10px] ${retroMethod === 'effects' ? 'bg-brand text-white' : 'text-ink-400'}`}>Effects</button>
            <button type="button" data-testid="retro-method-traditional" aria-pressed={retroMethod === 'traditional'} onClick={() => setRetroMethod('traditional')} className={`h-6 px-2 text-[10px] ${retroMethod === 'traditional' ? 'bg-brand text-white' : 'text-ink-400'}`}>Traditional</button>
          </div>
        </div>
        <button
          type="button"
          data-testid="retro-build-btn"
          onClick={() => {
            const ids = buildRetroText({ text: retroText.trim() || 'RETRO', sub: retroSub, color: retroColor, seed: retroSeed, method: retroMethod, duration: 3 })
            setStudioStatus(`Retro text built — ${ids.length} editable clips on new tracks. Compound them to move as one.`)
          }}
          className="h-7 w-full rounded bg-brand text-[11px] font-semibold text-white hover:bg-brand/85"
        >
          Build retro text at playhead
        </button>
        <p className="text-[9px] leading-snug text-ink-600">Effects = Text Randomizer scramble that settles. Traditional = per-letter 1-frame glitches (move/colour/stroke/vanish) that settle — same seed, same glitches, every time.</p>
      </div>

      {/* Watermark Studio (CapCut study, levels 1–6) */}
      <div data-testid="watermark-studio" className="pt-2 border-t border-ink-800 space-y-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Watermark Studio</span>
        <input data-testid="wm-text-input" value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="Watermark name — @you" className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[11px] text-white outline-none focus:border-brand" />
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Watermark level">
          {WATERMARK_LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              data-testid={`wm-level-${l.level}`}
              aria-pressed={wmLevel === l.level}
              onClick={() => setWmLevel(l.level as WatermarkLevel)}
              title={l.desc}
              className={`rounded border px-1.5 py-1 text-left text-[9px] leading-tight ${wmLevel === l.level ? 'border-brand bg-brand/15 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <select data-testid="wm-char-select" value={wmChar} onChange={(e) => setWmChar(e.target.value)} className="h-7 min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-1 text-[10px] text-ink-200" aria-label="Character or logo image">
            <option value="">No character</option>
            {assets.filter((a) => a.kind === 'image' || a.kind === 'video').map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          <select data-testid="wm-voice-select" value={wmVoice} onChange={(e) => setWmVoice(e.target.value)} className="h-7 min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-1 text-[10px] text-ink-200" aria-label="Voice tag audio">
            <option value="">No voice tag</option>
            {assets.filter((a) => a.kind === 'audio').map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          <input type="color" data-testid="wm-color-input" value={wmColor} onChange={(e) => setWmColor(e.target.value)} className="h-7 w-8 shrink-0 cursor-pointer rounded border border-ink-700 bg-ink-950 p-0.5" title="Glow colour" />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            data-testid="wm-build-btn"
            onClick={() => {
              const ids = buildWatermark({ text: wmText.trim() || '@you', level: wmLevel, color: wmColor, characterAssetId: wmChar || undefined, voiceAssetId: wmVoice || undefined, duration: 5, seed: 42 })
              setStudioStatus(`Watermark built — ${ids.length} clips. Drag anywhere, or stamp it as a compound below.`)
            }}
            className="h-7 flex-1 rounded bg-brand text-[11px] font-semibold text-white hover:bg-brand/85"
          >
            Build on timeline
          </button>
          <button
            type="button"
            data-testid="wm-save-btn"
            onClick={() => {
              addWatermark({ name: wmText.trim() || '@you', level: wmLevel, color: wmColor, characterAssetId: wmChar || undefined, voiceAssetId: wmVoice || undefined, seed: 42 })
              setStudioStatus('Watermark saved — stamp it onto any project from the list below.')
            }}
            className="h-7 rounded border border-ink-600 bg-ink-800 px-2 text-[10px] text-ink-100 hover:border-brand"
          >
            Save preset
          </button>
        </div>
        {watermarks.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-ink-500">Stamp at</span>
              <select data-testid="wm-corner-select" value={wmCorner} onChange={(e) => setWmCorner(e.target.value)} className="h-6 rounded border border-ink-700 bg-ink-950 px-1 text-[10px] text-ink-200" aria-label="Stamp corner">
                <option value="br">Bottom right</option>
                <option value="bl">Bottom left</option>
                <option value="tr">Top right</option>
                <option value="tl">Top left</option>
                <option value="c">Centre</option>
              </select>
            </div>
            {watermarks.map((w) => (
              <div key={w.id} className="flex items-center gap-1.5 rounded border border-ink-800 bg-ink-900 px-2 py-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                <span className="min-w-0 flex-1 truncate text-[10px] text-ink-200">{w.name} · L{w.level}</span>
                <button
                  type="button"
                  data-testid={`wm-apply-${w.id}`}
                  onClick={() => {
                    const st = useEditor.getState()
                    const before = new Set(st.clips.map((c) => c.id))
                    const ids = buildWatermark({ text: w.name, level: w.level as WatermarkLevel, color: w.color, characterAssetId: w.characterAssetId, voiceAssetId: w.voiceAssetId, duration: Math.max(3, st.duration || 5), seed: w.seed })
                    const pos = { br: { x: 620, y: 390 }, bl: { x: -620, y: 390 }, tr: { x: 620, y: -390 }, tl: { x: -620, y: -390 }, c: { x: 0, y: 0 } }[wmCorner as 'br'] || { x: 620, y: 390 }
                    const fresh = useEditor.getState().clips.filter((c) => !before.has(c.id))
                    useEditor.setState({
                      clips: useEditor.getState().clips.map((c) => (ids.includes(c.id) ? { ...c, start: 0, transform: { ...c.transform, x: (c.transform?.x || 0) * 0.4 + pos.x, y: (c.transform?.y || 0) * 0.4 + pos.y } } : c)),
                    })
                    void fresh
                    setStudioStatus(`Stamped “${w.name}” across the project at ${wmCorner.toUpperCase()}. Select the clips to compound them into one movable watermark.`)
                  }}
                  className="h-6 shrink-0 rounded bg-ink-800 border border-ink-600 px-2 text-[9px] text-white hover:border-brand"
                >
                  Stamp
                </button>
                <button type="button" data-testid={`wm-delete-${w.id}`} onClick={() => removeWatermark(w.id)} className="h-6 shrink-0 rounded border border-red-900/60 px-1.5 text-[9px] text-red-300 hover:bg-red-950/40" aria-label={`Delete watermark ${w.name}`}>✕</button>
              </div>
            ))}
          </div>
        )}
        {studioStatus && <p className="text-[9px] leading-snug text-emerald-300" role="status">{studioStatus}</p>}
        <p className="text-[9px] leading-snug text-ink-600">Levels follow the CapCut tutorial ladder. Everything is real editable clips — keyframes, graphs, effects — never a baked render. Green-screen footage? Add Chroma Key from the Effects panel.</p>
      </div>
    </div>
  )
}
