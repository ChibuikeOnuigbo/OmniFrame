import { useEffect, useState } from 'react'
import { useEditor } from './store'
import { TopBar } from './components/TopBar'
import { LeftDock } from './components/LeftDock'
import { Preview } from './components/Preview'
import { RightPanel } from './components/RightPanel'
import { Timeline } from './components/Timeline'
import { fps } from './lib/time'

export default function Studio() {
  const importFiles = useEditor((s) => s.importFiles)
  const togglePlay = useEditor((s) => s.togglePlay)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const setTool = useEditor((s) => s.setTool)
  const removeClip = useEditor((s) => s.removeClip)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const zoomBy = useEditor((s) => s.zoomBy)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const setSpeed = useEditor((s) => s.setSpeed)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

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
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const meta = e.ctrlKey || e.metaKey
      const st = () => useEditor.getState()
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (meta) return
      const f = 1 / fps()
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
  }, [togglePlay, setPlayhead, setTool, removeClip, selectedClipId, zoomBy, undo, redo, setSpeed])

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

  return (
    <div
      className="h-full w-full flex flex-col bg-ink-950 text-ink-100 overflow-hidden no-select"
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 216)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 152)),
        })
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files)
      }}
    >
      <TopBar />
      <div className="flex-1 min-h-0 flex">
        <LeftDock />
        <div className="flex-1 min-w-0 flex flex-col">
          <Preview />
          <Timeline />
        </div>
        <RightPanel />
      </div>
      {contextMenu && (
        <div
          data-testid="studio-context-menu"
          role="menu"
          aria-label="Studio actions"
          className="fixed z-[70] w-52 rounded-lg border border-ink-600 bg-[#11131d]/[0.98] p-1.5 text-xs text-ink-200 shadow-2xl backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            role="menuitem"
            onClick={() => {
              document.getElementById('topbar-import-input')?.click()
              setContextMenu(null)
            }}
            className="flex h-9 w-full items-center justify-between rounded-md px-3 text-left font-medium hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span>Add media</span><span className="text-[10px] font-normal text-ink-500">Import</span>
          </button>
          <div className="my-1 border-t border-ink-700" />
          <button role="menuitem" disabled={!canUndo} onClick={() => { undo(); setContextMenu(null) }} className="flex h-8 w-full items-center justify-between rounded-md px-3 text-left hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-35 disabled:hover:bg-transparent"><span>Undo</span><span className="text-[10px] text-ink-500">Ctrl+Z</span></button>
          <button role="menuitem" disabled={!canRedo} onClick={() => { redo(); setContextMenu(null) }} className="flex h-8 w-full items-center justify-between rounded-md px-3 text-left hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-35 disabled:hover:bg-transparent"><span>Redo</span><span className="text-[10px] text-ink-500">Ctrl+Shift+Z</span></button>
        </div>
      )}
    </div>
  )
}
