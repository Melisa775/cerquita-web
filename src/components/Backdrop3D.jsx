import { useEffect, useRef, useState } from 'react'

/**
 * Full-screen 3D background (three.js) behind the home page and the lobby.
 * The scene is loaded on demand, pauses while `active` is false (during a
 * game) or the tab is hidden, and shows a single still frame when the user
 * prefers reduced motion. Without WebGL it simply renders nothing.
 */
export default function Backdrop3D({ active = true }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    import('../lib/backdrop3d.js')
      .then(({ mountBackdrop }) => {
        if (disposed || !canvasRef.current) return
        sceneRef.current = mountBackdrop(canvasRef.current, { reduced })
        setReady(true)
      })
      .catch(() => {}) // no WebGL: the page works the same without the background
    return () => {
      disposed = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const sync = () => (active && !document.hidden ? scene.start() : scene.stop())
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      scene.stop()
    }
  }, [active, ready])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full transition-opacity duration-700"
      // softer on phones, where the text sits right on top of the scene
      style={{ opacity: ready && active ? (window.innerWidth < 700 ? 0.45 : 0.9) : 0 }}
    />
  )
}
