import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Room from './pages/Room'

// La sala vive en la URL (?sala=ABCDE) para que el enlace se pueda compartir
// y funcione en cualquier hosting estático sin reglas de reescritura.
function readCode() {
  return (new URLSearchParams(window.location.search).get('sala') || '').toUpperCase()
}

export default function App() {
  const [session, setSession] = useState(null) // { code, name }
  const [linkCode, setLinkCode] = useState(readCode)

  useEffect(() => {
    const onPop = () => {
      setLinkCode(readCode())
      setSession(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function enter(code, name) {
    window.history.pushState(null, '', `?sala=${code}`)
    setSession({ code, name })
  }

  function exit() {
    window.history.pushState(null, '', window.location.pathname)
    setLinkCode('')
    setSession(null)
  }

  if (session) return <Room key={session.code} code={session.code} name={session.name} onExit={exit} />
  return <Home initialCode={linkCode} onEnter={enter} />
}
