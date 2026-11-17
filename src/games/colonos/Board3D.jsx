import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

/**
 * React wrapper around the three.js board (lib/colonos3d.js). The scene is
 * created once and fed with the latest state; it reports taps on glowing
 * targets through `onPick`. Without WebGL it shows a short message instead.
 */
const Board3D = forwardRef(function Board3D({ state, onPick, onHover }, ref) {
  const box = useRef(null)
  const scene = useRef(null)
  const handlers = useRef({ onPick, onHover })
  handlers.current = { onPick, onHover }
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    let cancelled = false
    import('../../lib/colonos3d.js')
      .then(({ createColonosScene }) => {
        if (cancelled || !box.current) return
        scene.current = createColonosScene(box.current, {
          onPick: (kind, id) => handlers.current.onPick?.(kind, id),
          onHover: (t) => handlers.current.onHover?.(t),
        })
        if (import.meta.env.DEV) window.__colonos = scene.current // lets the browser tests tap the 3D board
        setReady((n) => n + 1)
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => {
    if (scene.current && state) scene.current.update(state)
  }, [state, ready])

  useImperativeHandle(ref, () => ({
    rolled: (...args) => scene.current?.rolled(...args),
    resetView: () => scene.current?.resetView(),
    zoom: (dir) => scene.current?.zoom(dir),
  }))

  return (
    <div ref={box} className="absolute inset-0" aria-label="Tablero de la isla en 3D" role="img">
      {failed && (
        <p className="flex h-full items-center justify-center p-6 text-center text-muted">
          Tu navegador no pudo mostrar el tablero en 3D. Prueba con otro navegador o activa la aceleración por hardware.
        </p>
      )}
    </div>
  )
})

export default Board3D
