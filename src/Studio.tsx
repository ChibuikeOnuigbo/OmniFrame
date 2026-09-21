import { useEffect } from 'react'
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
    </div>
  )
}
