import React, { useState } from 'react'
import { Type, Plus, Sparkles } from 'lucide-react'
import { useEditor } from '../store'

export function TextPanel() {
  const addTextTitleClip = useEditor((s) => s.addTextTitleClip)
  const [text, setText] = useState('OmniFrame Title')
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState('#ffffff')
  const [bgColor, setBgColor] = useState('rgba(0,0,0,0.5)')

  const handleAdd = (customText?: string) => {
    addTextTitleClip(customText || text)
  }

  return (
    <div data-testid="text-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      <div>
        <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">Title Text</label>
        <input
          type="text"
          data-testid="text-title-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-8 px-2.5 rounded-md bg-ink-900 border border-ink-700 text-ink-100 text-xs focus:outline-none focus:border-brand"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">Font Size</label>
          <input
            type="number"
            value={fontSize}
            min={16}
            max={120}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="w-full h-7 px-2 rounded bg-ink-900 border border-ink-700 text-ink-100 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-ink-500 mb-1">Color</label>
          <div className="flex items-center gap-1.5 h-7">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 rounded border border-ink-700 cursor-pointer bg-transparent p-0"
            />
            <span className="font-mono text-[10px] text-ink-400">{color}</span>
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
        <span className="text-[10px] font-semibold uppercase text-ink-500 block mb-1.5">Quick Presets</span>
        <div className="space-y-1.5">
          {[
            { label: 'Cinematic Title', text: 'EPISODE ONE' },
            { label: 'Lower Third Subtitle', text: 'Director · OmniFrame Studio' },
            { label: 'Callout Tag', text: 'KEY TAKEAWAY #1' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-testid={`text-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => handleAdd(preset.text)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-brand text-left text-ink-300 hover:text-white transition-colors"
            >
              <div>
                <div className="text-[11px] font-medium text-ink-200">{preset.label}</div>
                <div className="text-[10px] text-ink-500 italic">“{preset.text}”</div>
              </div>
              <Plus size={12} className="text-ink-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
