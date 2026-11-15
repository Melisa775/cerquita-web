import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Room from './pages/Room'

// The room lives in the URL (?sala=ABCDE) so the link can be shared
// and works on any static host without rewrite rules.
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
