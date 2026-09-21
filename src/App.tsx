import { useEffect, useState } from 'react'
import { Landing } from './components/Landing'
import Studio from './Studio'

function isStudioRoute() {
  return window.location.hash === '#studio'
}

export default function App() {
  const [studio, setStudio] = useState(isStudioRoute)

  useEffect(() => {
    const route = () => setStudio(isStudioRoute())
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])

  const openStudio = () => {
    window.location.hash = 'studio'
    setStudio(true)
  }

  return studio ? <Studio /> : <Landing onEnter={openStudio} />
}
