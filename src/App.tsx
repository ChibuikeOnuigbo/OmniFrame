import { useEffect, useRef, useState } from 'react'
import { Landing } from './components/Landing'
import Studio from './Studio'
import ReplaceDialog from './components/ReplaceDialog'
import { CustomCursor } from './components/CustomCursor'
import { useEditor } from './store'

function isStudioRoute() {
  return window.location.hash === '#studio'
}

export default function App() {
  const hideOverflowX = useEditor((s) => s.hideOverflowX)
  const [studio, setStudio] = useState(isStudioRoute)
  const [transitioning, setTransitioning] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const route = () => {
      setStudio(isStudioRoute())
      setTransitioning(false)
    }
    window.addEventListener('hashchange', route)
    return () => {
      window.removeEventListener('hashchange', route)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const openStudio = () => {
    if (transitioning) return
    setTransitioning(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = window.setTimeout(() => {
      window.location.hash = 'studio'
      setStudio(true)
      setTransitioning(false)
    }, reduced ? 60 : 980)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      {(studio || transitioning) && (
        <div data-testid="studio-scene" data-overflow-x={hideOverflowX ? 'hidden' : 'visible'} className="absolute inset-0 z-0">
          <Studio />
        </div>
      )}
      {!studio && (
        <div className="absolute inset-0 z-20">
          <Landing onEnter={openStudio} />
        </div>
      )}
      {transitioning && (
        <div data-testid="transition-wave" className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[5vw] min-w-12 max-w-20 of-transition-wave" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-[#090a10]/95 via-[#14161e]/95 to-brand shadow-[-14px_0_28px_rgba(0,0,0,.45)]" />
          <div className="absolute inset-y-0 right-0 w-1.5 bg-brand-400" />
        </div>
      )}
      <CustomCursor />
    <ReplaceDialog />
</div>
  )
}
