import React, { useState, useEffect } from 'react'
import { Type, Plus, Sparkles, Bold, Italic, AlignLeft, Check } from 'lucide-react'
import { useEditor } from '../store'
import type { TextStyle } from '../types'

export function TextPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const setClipProp = useEditor((s) => s.setClipProp)
  const addTextTitleClip = useEditor((s) => s.addTextTitleClip)

  const selectedClip = clips.find((c) => c.id === selectedClipId)
  const isEditingTextClip = Boolean(selectedClip?.textStyle)

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

  const handleAdd = (customText?: string, customStyle?: Partial<TextStyle>) => {
    const t = customText || text
    addTextTitleClip(t)
    if (customStyle) {
      const st = useEditor.getState()
      const newClip = st.clips[st.clips.length - 1]
      if (newClip) {
        st.setClipProp(newClip.id, {
          textStyle: { ...newClip.textStyle, ...customStyle, text: t },
        })
      }
    }
  }

  return (
    <div data-testid="text-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      {/* Selected Clip indicator if editing */}
      {isEditingTextClip ? (
        <div className="flex items-center justify-between pb-2 border-b border-ink-800">
          <div>
            <span className="text-[10px] text-brand uppercase tracking-wider font-semibold block">
              Editing Selected Title
            </span>
            <span className="font-medium text-ink-100 truncate block text-[11px]">
              {selectedClip?.name}
            </span>
          </div>
          <button
            type="button"
            data-testid="add-new-title-btn"
            onClick={() => handleAdd()}
            className="flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-brand text-ink-300 hover:text-white text-[10px] transition-colors"
          >
            <Plus size={11} />
            <span>New Title</span>
          </button>
        </div>
      ) : (
        <div className="pb-2 border-b border-ink-800">
          <span className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold block">
            Add Text & Titles
          </span>
          <p className="text-[11px] text-ink-400 mt-0.5">
            Create titles, lower thirds, or subtitles rendered directly on the video canvas.
          </p>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">
          Text Content
        </label>
        <textarea
          data-testid="text-title-input"
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

      <button
        type="button"
        data-testid="add-text-clip-btn"
        onClick={() => handleAdd()}
        className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md bg-brand hover:bg-brand-600 text-white font-medium transition-colors shadow-sm"
      >
        <Plus size={14} />
        <span>Add Title to Timeline</span>
      </button>

      {/* Preset Title Styles */}
      <div className="pt-2 border-t border-ink-800">
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
              onClick={() => handleAdd(preset.text, preset.style)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-brand text-left text-ink-300 hover:text-white transition-colors"
            >
              <div>
                <div className="text-[11px] font-medium text-ink-200">{preset.label}</div>
                <div className="text-[10px] text-ink-500 italic truncate max-w-[170px]">“{preset.text}”</div>
              </div>
              <Plus size={12} className="text-ink-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
