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
    }, reduced ? 60 : 980)
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
        <div data-testid="transition-wave" className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[5vw] min-w-12 max-w-20 of-transition-wave" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-[#090a10]/95 via-[#1a1530]/95 to-brand shadow-[-14px_0_28px_rgba(0,0,0,.45),10px_0_32px_rgba(109,94,252,.28)]" />
          <div className="absolute inset-y-0 left-[16%] w-[38%] bg-gradient-to-r from-transparent via-violet-300/10 to-violet-200/25" />
          <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-r from-brand-400 to-violet-200/80 shadow-[0_0_16px_rgba(144,131,255,.55)]" />
        </div>
      )}
    </div>
  )
}
