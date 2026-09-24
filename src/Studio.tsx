import { useEffect, useRef, useState } from 'react'
import { Clipboard, Copy, Scissors, Trash2, Upload, Files, AudioLines, Undo2, Redo2, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useEditor } from './store'
import type { Clip, Transition } from './types'
import { readClipClipboard, writeClipClipboard } from './lib/clipClipboard'

type ContextTarget =
  | { type: 'EMPTY_EDITOR' }
  | { type: 'CANVAS' }
  | { type: 'MEDIA_PANEL' }
  | { type: 'TRANSITION'; transition: Transition }
  | { type: 'VIDEO_CLIP' | 'AUDIO_CLIP' | 'IMAGE_CLIP'; clip: Clip }

type ContextState = ContextTarget & { x: number; y: number; anchorX: number; anchorY: number }
import { TopBar } from './components/TopBar'
import { LeftDock } from './components/LeftDock'
import { Preview } from './components/Preview'
import { RightPanel } from './components/RightPanel'
import { Timeline } from './components/Timeline'

export default function Studio() {
  const importFiles = useEditor((s) => s.importFiles)
  const togglePlay = useEditor((s) => s.togglePlay)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const setTool = useEditor((s) => s.setTool)
  const removeClip = useEditor((s) => s.removeClip)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const projectFps = useEditor((s) => s.projectFps)
  const zoomBy = useEditor((s) => s.zoomBy)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const setSpeed = useEditor((s) => s.setSpeed)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const insertClipCopy = useEditor((s) => s.insertClipCopy)
  const toggleClipHidden = useEditor((s) => s.toggleClipHidden)
  const extractAudio = useEditor((s) => s.extractAudio)
  const [contextMenu, setContextMenu] = useState<ContextState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  // Global keyboard shortcuts (disabled while typing in inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || t.closest('input, textarea, select, option, [role="dialog"], [role="menu"], [role="listbox"]'))) return
      const meta = e.ctrlKey || e.metaKey
      const st = () => useEditor.getState()
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (meta) return
      const f = 1 / projectFps
      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          st().pause()
          setPlayhead(st().playhead - (e.shiftKey ? 1 : f))
          break
        case 'ArrowRight':
          e.preventDefault()
          st().pause()
          setPlayhead(st().playhead + (e.shiftKey ? 1 : f))
          break
        case 'h':
        case 'H':
          if (selectedClipId) {
            e.preventDefault()
            toggleClipHidden(selectedClipId)
          }
          break
        case 'b':
        case 'B':
          setTool('blade')
          break
        case 'v':
        case 'V':
          setTool('select')
          break
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) removeClip(selectedClipId)
          break
        case '+':
        case '=':
          zoomBy(1.25)
          break
        case '-':
        case '_':
          zoomBy(0.8)
          break
        case 'j':
        case 'J':
          setSpeed(-(Math.abs(st().speed) || 1))
          st().play()
          break
        case 'k':
        case 'K':
          st().pause()
          break
        case 'l':
        case 'L':
          setSpeed(Math.abs(st().speed) || 1)
          st().play()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, setPlayhead, setTool, removeClip, toggleClipHidden, selectedClipId, projectFps, zoomBy, undo, redo, setSpeed])

  // Release imported blob URLs when the document is actually leaving. Assets
  // remain live for the project lifetime so preview and export can reuse them.
  useEffect(() => {
    const releaseAssets = () => {
      for (const asset of useEditor.getState().assets) URL.revokeObjectURL(asset.url)
    }
    window.addEventListener('pagehide', releaseAssets)
    return () => window.removeEventListener('pagehide', releaseAssets)
  }, [])

  // Auto-collapse side panels on narrow viewports so the UI never clusters
  // or develops horizontal overflow. We only ever *close* automatically.
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      const st = useEditor.getState()
      if (w < 1080 && (st.leftOpen || st.rightOpen)) {
        useEditor.setState({ leftOpen: false, rightOpen: false })
      }
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const clipboardClip = readClipClipboard()
  const focusMode = useEditor((s) => s.focusMode)
  const setFocusMode = useEditor((s) => s.setFocusMode)
  const setTimelineHeight = useEditor((s) => s.setTimelineHeight)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useEditor.getState().focusMode !== 'none') {
        useEditor.getState().setFocusMode('none')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const onSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = useEditor.getState().timelineHeight

    const onPointerMove = (ev: PointerEvent) => {
      const deltaY = startY - ev.clientY
      setTimelineHeight(startHeight + deltaY)
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const contextCommands = contextMenu ? (
    contextMenu.type === 'TRANSITION'
      ? [
          { id: 'trans-dissolve', label: 'Cross Dissolve', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'cross_dissolve' }) },
          { id: 'trans-dip-black', label: 'Dip to Black', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'dip_to_black' }) },
          { id: 'trans-dip-white', label: 'Dip to White', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'dip_to_white' }) },
          { id: 'trans-wipe-left', label: 'Wipe Left', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'wipe_left' }) },
          { id: 'trans-slide-left', label: 'Slide Left', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'slide_left' }) },
          { id: 'trans-zoom', label: 'Zoom Push', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { type: 'zoom' }) },
          { id: 'trans-dur-15', label: 'Duration: 1.5s', icon: Sparkles, run: () => useEditor.getState().updateTransition(contextMenu.transition.id, { duration: 1.5 }) },
          { id: 'delete', label: 'Delete Transition', shortcut: 'Delete', icon: Trash2, destructive: true, run: () => useEditor.getState().removeTransition(contextMenu.transition.id) },
        ]
      : 'clip' in contextMenu
      ? [
          { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', icon: Scissors, run: () => { writeClipClipboard(contextMenu.clip); removeClip(contextMenu.clip.id) } },
          { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', icon: Copy, run: () => { writeClipClipboard(contextMenu.clip) } },
          ...(clipboardClip ? [{ id: 'paste', label: 'Paste at playhead', shortcut: 'Ctrl+V', icon: Clipboard, run: () => insertClipCopy(clipboardClip!, useEditor.getState().playhead) }] : []),
          { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', icon: Files, run: () => insertClipCopy(contextMenu.clip, contextMenu.clip.start + contextMenu.clip.duration) },
          ...(contextMenu.type === 'VIDEO_CLIP' || contextMenu.type === 'IMAGE_CLIP' ? [{
            id: 'add-transition',
            label: 'Add Transition',
            icon: Sparkles,
            run: () => {
              const clp = contextMenu.clip
              const st = useEditor.getState()
              const adj = st.clips.find(
                (c) => c.trackId === clp.trackId && c.id !== clp.id && Math.abs(c.start - (clp.start + clp.duration)) < 0.2,
              )
              st.addTransition({
                type: 'cross_dissolve',
                fromClipId: clp.id,
                toClipId: adj ? adj.id : clp.id,
                trackId: clp.trackId,
                startTime: Math.max(0, clp.start + clp.duration - 0.5),
                duration: 1.0,
                alignment: 'centered',
                enabled: true,
              })
            },
          }] : []),
          ...(contextMenu.type === 'VIDEO_CLIP' ? [{ id: 'separate-audio', label: 'Separate audio', icon: AudioLines, run: () => void extractAudio(contextMenu.clip.id) }] : []),
          { id: 'hide-toggle', label: contextMenu.clip.hidden ? 'Unhide Clip' : 'Hide Clip', shortcut: 'H', icon: contextMenu.clip.hidden ? Eye : EyeOff, run: () => toggleClipHidden(contextMenu.clip.id) },
          { id: 'delete', label: 'Delete', shortcut: 'Delete', icon: Trash2, destructive: true, run: () => removeClip(contextMenu.clip.id) },
        ]
      : [
          { id: 'add-media', label: contextMenu.type === 'MEDIA_PANEL' ? 'Import media' : 'Add media', shortcut: 'Import', icon: Upload, primary: true, run: () => document.getElementById('topbar-import-input')?.click() },
          ...(canUndo ? [{ id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: Undo2, run: undo }] : []),
          ...(canRedo ? [{ id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', icon: Redo2, run: redo }] : []),
        ]
  ) : []

  return (
    <div
      className="h-full w-full flex flex-col bg-ink-950 text-ink-100 overflow-hidden no-select"
      onContextMenuCapture={(event) => {
        const element = event.target as HTMLElement
        // Preserve native editing commands for genuine editable fields.
        if (element.closest('input, textarea, [contenteditable="true"]')) return
        event.preventDefault()
        event.stopPropagation()
        // An open popup owns its interaction; never cover it with a parent menu.
        if (element.closest('[role="menu"], [role="listbox"], select, option')) return
        const transElement = element.closest<HTMLElement>('[data-testid="timeline-transition"]')
        const transition = transElement
          ? (useEditor.getState().transitions || []).find((tr) => tr.id === transElement.dataset.transitionId)
          : undefined
        const clipElement = element.closest<HTMLElement>('[data-testid="timeline-clip"]')
        const clip = clipElement ? useEditor.getState().clips.find((item) => item.id === clipElement.dataset.clipId) : undefined
        const target: ContextTarget = transition
          ? { type: 'TRANSITION', transition }
          : clip
          ? { type: clip.kind === 'audio' ? 'AUDIO_CLIP' : clip.kind === 'image' ? 'IMAGE_CLIP' : 'VIDEO_CLIP', clip }
          : element.closest('[data-testid="preview-stage"]')
            ? { type: 'CANVAS' }
            : element.closest('[data-testid="media-library"]')
              ? { type: 'MEDIA_PANEL' }
              : { type: 'EMPTY_EDITOR' }
        const width = 224
        const height = target.type === 'TRANSITION' ? 280 : 'clip' in target ? (target.type === 'VIDEO_CLIP' ? 280 : 220) : 144
        const margin = 8, offset = 4
        const x = event.clientX + width + offset <= window.innerWidth - margin ? event.clientX + offset : event.clientX - width - offset
        const y = event.clientY + height + offset <= window.innerHeight - margin ? event.clientY + offset : event.clientY - height - offset
        setContextMenu({ ...target, x: Math.max(margin, x), y: Math.max(margin, y), anchorX: event.clientX, anchorY: event.clientY })
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files)
      }}
    >
      <TopBar />
      {focusMode !== 'none' && (
        <div
          data-testid="focus-mode-banner"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-3 py-1.5 bg-ink-900/95 border border-brand/60 rounded-full shadow-2xl backdrop-blur-md text-xs text-ink-200"
        >
          <span className="font-medium text-brand">Focus Mode: {focusMode}</span>
          <button
            type="button"
            data-testid="exit-focus-btn"
            onClick={() => setFocusMode('none')}
            className="px-2 py-0.5 rounded-full bg-brand text-white font-medium hover:bg-brand-600 transition-colors shadow-sm"
          >
            Exit (Esc)
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex relative">
        <LeftDock />
        <div className="flex-1 min-w-0 flex flex-col">
          <Preview />
          <div
            data-testid="timeline-splitter"
            onPointerDown={onSplitterPointerDown}
            className="h-1.5 w-full bg-ink-800 hover:bg-brand/70 cursor-row-resize transition-colors z-20 shrink-0"
            title="Drag to resize timeline"
          />
          <Timeline />
        </div>
        <RightPanel />
      </div>
      {contextMenu && (
        <div
          ref={menuRef}
          data-testid="studio-context-menu"
          data-context-target={contextMenu.type}
          data-anchor-x={contextMenu.anchorX}
          data-anchor-y={contextMenu.anchorY}
          role="menu"
          aria-label={`${contextMenu.type.toLowerCase().replace(/_/g, ' ')} actions`}
          className="fixed z-[70] w-56 max-h-[min(420px,calc(100vh-16px))] overflow-y-auto rounded-xl border border-ink-600 bg-[#11131d]/[0.98] p-2 text-xs text-ink-200 shadow-[0_18px_48px_rgba(0,0,0,.42)] backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="px-2.5 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {contextMenu.type.replace(/_/g, ' ')}
          </div>
          {contextCommands.map((command, index) => {
            const Icon = command.icon
            const destructive = 'destructive' in command && command.destructive
            const primary = 'primary' in command && command.primary
            return (
              <button
                key={command.id}
                role="menuitem"
                autoFocus={index === 0}
                onClick={() => { command.run(); setContextMenu(null) }}
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand ${destructive ? 'text-red-400 hover:bg-red-500/10' : primary ? 'bg-brand/10 text-violet-200 hover:bg-brand/20' : 'hover:bg-ink-700'}`}
              >
                <Icon size={15} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {'shortcut' in command && command.shortcut && <span className="shrink-0 text-[10px] font-normal text-ink-500">{command.shortcut}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
