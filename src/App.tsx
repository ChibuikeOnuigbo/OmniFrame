import { useEffect, useRef, useState } from 'react'
import { Landing } from './components/Landing'
import Studio from './Studio'

function isStudioRoute() {
  return window.location.hash === '#studio'
}

export default function App() {
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
    }, reduced ? 60 : 680)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      {(studio || transitioning) && (
        <div data-testid="studio-scene" className="absolute inset-0 z-0">
          <Studio />
        </div>
      )}
      {!studio && (
        <div className="absolute inset-0 z-20">
          <Landing onEnter={openStudio} />
        </div>
      )}
      {transitioning && (
        <div data-testid="transition-wave" className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[14vw] min-w-24 of-transition-wave" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand to-violet-400 shadow-[0_0_70px_rgba(109,94,252,.45)]" />
          <div className="absolute inset-y-0 right-[-2px] w-1 bg-white/25 blur-[1px]" />
        </div>
      )}
    </div>
  )
}
