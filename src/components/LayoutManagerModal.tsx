import React, { useState } from 'react'
import {
  LayoutGrid,
  X,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Check,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useEditor } from '../store'
import { WorkspaceSchematic } from './WorkspaceSchematic'
import type { WorkspacePreset, FocusMode } from '../types'

interface LayoutManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'presets' | 'custom' | 'focus'

export const LayoutManagerModal: React.FC<LayoutManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('presets')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')

  const workspacePreset = useEditor((s) => s.workspacePreset)
  const setWorkspacePreset = useEditor((s) => s.setWorkspacePreset)
  const focusMode = useEditor((s) => s.focusMode)
  const setFocusMode = useEditor((s) => s.setFocusMode)
  const customWorkspaces = useEditor((s) => s.customWorkspaces)
  const saveCustomWorkspace = useEditor((s) => s.saveCustomWorkspace)
  const applyCustomWorkspace = useEditor((s) => s.applyCustomWorkspace)
  const deleteCustomWorkspace = useEditor((s) => s.deleteCustomWorkspace)
  const resetLayoutToDefault = useEditor((s) => s.resetLayoutToDefault)

  if (!isOpen) return null

  const PRESETS: { id: WorkspacePreset; label: string; desc: string; shortcut?: string }[] = [
    { id: 'default', label: 'Default', desc: 'Balanced layout with media, large preview, inspector, and timeline', shortcut: 'Alt+1' },
    { id: 'edit', label: 'Edit', desc: 'Expanded timeline and left dock for rapid sequence assembly', shortcut: 'Alt+2' },
    { id: 'timeline-focus', label: 'Timeline Focus', desc: 'Maximized timeline height for multi-track audio/video trimming', shortcut: 'Alt+3' },
    { id: 'preview-focus', label: 'Preview Focus', desc: 'Expanded preview viewport with compact bottom transport', shortcut: 'Alt+4' },
    { id: 'drawing', label: 'Drawing & Paint', desc: 'Drawing canvas overlay with brush palette and paint layers', shortcut: 'Alt+5' },
    { id: 'color', label: 'Color Grading', desc: 'Focused preview canvas with inspector color wheels & parameters', shortcut: 'Alt+6' },
    { id: '3d', label: '3D Scene & Compositing', desc: '3D viewport integration with camera and 2.5D video planes', shortcut: 'Alt+7' },
    { id: 'minimal', label: 'Minimal', desc: 'Zen editing workspace with sidebars hidden until requested', shortcut: 'Alt+8' },
    { id: 'full-canvas', label: 'Full Canvas', desc: 'Canvas-only presentation mode filling the entire studio window', shortcut: 'Alt+9' },
  ]

  const FOCUS_OPTIONS: { id: FocusMode; label: string; desc: string }[] = [
    { id: 'none', label: 'Normal Workspace', desc: 'Standard editing environment with active panels' },
    { id: 'preview', label: 'Preview Focus', desc: 'Large preview canvas with collapsed utility sidebars' },
    { id: 'timeline', label: 'Timeline Focus', desc: 'Maximized timeline tracks for multi-channel editing' },
    { id: 'one-panel', label: 'One Panel Only (Inspector)', desc: 'Large preview alongside selected inspector properties only' },
    { id: 'canvas-only', label: 'Hide Everything (Zen)', desc: 'Pure distraction-free canvas presentation' },
  ]

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return
    saveCustomWorkspace(newWorkspaceName)
    setNewWorkspaceName('')
  }

  return (
    <div
      data-testid="layout-manager-modal"
      role="dialog"
      aria-label="Workspace Layout Manager"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl rounded-xl border border-ink-700 bg-ink-900 shadow-2xl flex flex-col overflow-hidden text-ink-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-brand" />
            <h2 className="text-sm font-semibold text-white">Workspace Layout & Focus Mode</h2>
          </div>
          <button
            type="button"
            data-testid="close-layout-modal"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:text-white hover:bg-ink-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-ink-800 bg-ink-950/60 px-5 gap-4 text-xs font-medium">
          <button
            type="button"
            data-testid="tab-presets"
            onClick={() => setActiveTab('presets')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'presets' ? 'border-brand text-brand font-semibold' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Built-in Presets
          </button>
          <button
            type="button"
            data-testid="tab-custom"
            onClick={() => setActiveTab('custom')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'custom' ? 'border-brand text-brand font-semibold' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            My Workspaces ({customWorkspaces.length})
          </button>
          <button
            type="button"
            data-testid="tab-focus"
            onClick={() => setActiveTab('focus')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'focus' ? 'border-brand text-brand font-semibold' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Focus Modes
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto max-h-[460px]">
          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {PRESETS.map((p) => {
                const isActive = workspacePreset === p.id && focusMode === 'none'
                return (
                  <div
                    key={p.id}
                    data-testid={`preset-card-${p.id}`}
                    onClick={() => {
                      setWorkspacePreset(p.id)
                      onClose()
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-brand/15 border-brand text-white shadow-sm'
                        : 'bg-ink-950/40 border-ink-800 hover:bg-ink-800/60 text-ink-300 hover:text-white'
                    }`}
                  >
                    <WorkspaceSchematic preset={p.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{p.label}</span>
                        {p.shortcut && (
                          <span className="text-[10px] font-mono text-ink-500 bg-ink-800 px-1 py-0.5 rounded">
                            {p.shortcut}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-400 truncate mt-0.5">{p.desc}</p>
                    </div>
                    {isActive && <Check size={15} className="text-brand shrink-0" />}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="flex flex-col gap-4">
              {/* Save New Layout Form */}
              <form onSubmit={handleSaveCustom} className="flex gap-2">
                <input
                  type="text"
                  data-testid="custom-workspace-name-input"
                  placeholder="Workspace name (e.g., Anime Rotoscoping, Dual Monitor)..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-ink-950 border border-ink-700 text-xs text-white focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  data-testid="save-custom-workspace-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-600 transition-colors"
                >
                  <Plus size={14} />
                  Save Current
                </button>
              </form>

              {/* List of Custom Workspaces */}
              <div className="flex flex-col gap-2">
                {customWorkspaces.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-500 border border-dashed border-ink-800 rounded-lg">
                    No custom workspaces saved yet. Arrange panels to your liking and save your layout above!
                  </div>
                ) : (
                  customWorkspaces.map((ws) => (
                    <div
                      key={ws.id}
                      data-testid={`custom-workspace-item-${ws.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-ink-950/40 border border-ink-800 hover:border-ink-700"
                    >
                      <div className="flex items-center gap-3">
                        <WorkspaceSchematic
                          leftOpen={ws.leftOpen}
                          rightOpen={ws.rightOpen}
                          focusMode={ws.focusMode}
                        />
                        <div>
                          <div className="text-xs font-semibold text-white">{ws.name}</div>
                          <div className="text-[10px] text-ink-500 font-mono">
                            Timeline: {ws.timelineHeight}px • Left Dock: {ws.leftDockWidth}px
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`apply-custom-ws-${ws.id}`}
                          onClick={() => {
                            applyCustomWorkspace(ws.id)
                            onClose()
                          }}
                          className="px-2.5 py-1 rounded bg-brand/20 hover:bg-brand/30 text-brand text-xs font-medium transition-colors"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          data-testid={`delete-custom-ws-${ws.id}`}
                          onClick={() => deleteCustomWorkspace(ws.id)}
                          title="Delete custom workspace"
                          className="p-1 rounded text-ink-400 hover:text-red-400 hover:bg-ink-800"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'focus' && (
            <div className="flex flex-col gap-2">
              {FOCUS_OPTIONS.map((f) => {
                const isActive = focusMode === f.id
                return (
                  <div
                    key={f.id}
                    data-testid={`focus-option-${f.id}`}
                    onClick={() => {
                      setFocusMode(f.id)
                      onClose()
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-brand/15 border-brand text-white shadow-sm'
                        : 'bg-ink-950/40 border-ink-800 hover:bg-ink-800/60 text-ink-300 hover:text-white'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold">{f.label}</span>
                      <p className="text-[11px] text-ink-400 mt-0.5">{f.desc}</p>
                    </div>
                    {isActive && <Check size={16} className="text-brand" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800 bg-ink-950/40 text-xs">
          <button
            type="button"
            data-testid="reset-layout-default-btn"
            onClick={() => {
              resetLayoutToDefault()
              onClose()
            }}
            className="flex items-center gap-1.5 text-ink-400 hover:text-white transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset Layout to Default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-750 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
