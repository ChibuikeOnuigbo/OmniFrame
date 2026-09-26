import React, { useState } from 'react'
import {
  LayoutTemplate,
  X,
  CheckCircle2,
  Play,
  Film,
  Type,
  Image as ImageIcon,
  Music,
  Plus,
} from 'lucide-react'
import { useEditor } from '../store'
import { BUILTIN_TEMPLATES } from '../lib/templatePresets'
import type { TemplateDefinition, TemplateSlot } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function TemplatePickerModal({ isOpen, onClose }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILTIN_TEMPLATES[0].id)
  const [slotAssignments, setSlotAssignments] = useState<Record<string, string>>({})

  const assets = useEditor((s) => s.assets)
  const addTextTitleClip = useEditor((s) => s.addTextTitleClip)
  const addClipToTrack = useEditor((s) => s.addClipToTrack)
  const ensureTrack = useEditor((s) => s.ensureTrack)

  if (!isOpen) return null

  const currentTemplate = BUILTIN_TEMPLATES.find((t) => t.id === selectedTemplateId) || BUILTIN_TEMPLATES[0]

  const handleApplyTemplate = () => {
    // Instantiate tracks and clips based on template slots
    const videoTrack = ensureTrack('video')
    const audioTrack = ensureTrack('audio')

    for (const slot of currentTemplate.slots) {
      if (slot.type === 'text') {
        addTextTitleClip(slot.name, slot.durationConstraint || 5)
      } else if (slot.type === 'video' || slot.type === 'image') {
        const assignedAssetId = slotAssignments[slot.id]
        const asset = assets.find((a) => a.id === assignedAssetId) || assets.find((a) => a.kind === slot.type)
        if (asset) {
          addClipToTrack(videoTrack, asset.id, 0)
        }
      } else if (slot.type === 'audio') {
        const assignedAssetId = slotAssignments[slot.id]
        const asset = assets.find((a) => a.id === assignedAssetId) || assets.find((a) => a.kind === 'audio')
        if (asset) {
          addClipToTrack(audioTrack, asset.id, 0)
        }
      }
    }

    onClose()
  }

  const getSlotIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Film size={13} className="text-blue-400" />
      case 'image':
      case 'logo':
        return <ImageIcon size={13} className="text-emerald-400" />
      case 'text':
        return <Type size={13} className="text-amber-400" />
      case 'audio':
        return <Music size={13} className="text-purple-400" />
      default:
        return <Film size={13} className="text-ink-400" />
    }
  }

  return (
    <div
      data-testid="template-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-800 bg-ink-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand/20 text-brand">
              <LayoutTemplate size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Sequence Templates & Layouts</h3>
              <p className="text-[11px] text-ink-400">Pre-composed multi-track layouts with media slot replacement.</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-template-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex gap-4 overflow-y-auto flex-1">
          {/* Template List */}
          <div className="w-1/2 space-y-2">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
              Available Templates
            </span>
            <div className="space-y-1.5">
              {BUILTIN_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  data-testid={`template-item-${tmpl.id}`}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${
                    selectedTemplateId === tmpl.id
                      ? 'border-brand bg-brand/15 text-white'
                      : 'border-ink-800 bg-ink-950/40 text-ink-300 hover:bg-ink-800/50'
                  }`}
                >
                  <div className="font-semibold text-xs text-ink-100">{tmpl.name}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5 line-clamp-2">{tmpl.description}</div>
                  <div className="text-[10px] text-brand font-mono mt-1.5">
                    {tmpl.slots.length} configured slots
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Slot Inspector & Mapping */}
          <div className="w-1/2 space-y-3 p-3 rounded-xl border border-ink-800 bg-ink-950/40 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-ink-800">
              <span className="font-semibold text-white text-xs">{currentTemplate.name}</span>
              <span className="text-[10px] text-ink-400 font-mono">Template Inspector</span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
                Designated Slots
              </span>

              {currentTemplate.slots.map((slot) => (
                <div
                  key={slot.id}
                  data-testid="template-slot-card"
                  className="p-2.5 rounded-lg border border-ink-800 bg-ink-900 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-ink-100">
                      {getSlotIcon(slot.type)}
                      <span>{slot.name}</span>
                    </div>
                    {slot.required && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] uppercase font-bold">
                        Required
                      </span>
                    )}
                  </div>

                  {slot.type !== 'text' ? (
                    <select
                      value={slotAssignments[slot.id] || ''}
                      onChange={(e) =>
                        setSlotAssignments((prev) => ({ ...prev, [slot.id]: e.target.value }))
                      }
                      className="w-full h-7 px-2 rounded bg-ink-950 border border-ink-700 text-[11px] text-ink-200"
                    >
                      <option value="">Auto-fill from project library</option>
                      {assets
                        .filter((a) => (slot.type === 'video' ? a.kind === 'video' : a.kind === slot.type))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({Math.round(a.duration)}s)
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="text-[11px] text-ink-400 italic">Editable text title clip</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800 bg-ink-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-white text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="apply-template-btn"
            onClick={handleApplyTemplate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-white font-medium text-xs shadow-md shadow-brand/20"
          >
            <CheckCircle2 size={13} />
            <span>Apply Template to Project</span>
          </button>
        </div>
      </div>
    </div>
  )
}
