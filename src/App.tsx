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
    </div>
  )
}
