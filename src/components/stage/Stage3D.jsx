import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

/**
 * Generic React wrapper for a 3D board. `load` imports the board module (it
 * stays out of the first page load), whose `create(container, handlers)`
 * returns a controller with at least `update(state)` and `dispose()`. The
 * controller is reachable through the ref (`ref.current.call('resetView')`).
 */
const Stage3D = forwardRef(function Stage3D({ load, state, onPick, onHover, label = 'Tablero en 3D' }, ref) {
  const box = useRef(null)
  const ctrl = useRef(null)
  const handlers = useRef({ onPick, onHover })
  handlers.current = { onPick, onHover }
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
      .then(({ create }) => {
        if (cancelled || !box.current) return
        ctrl.current = create(box.current, {
          onPick: (data) => handlers.current.onPick?.(data),
          onHover: (data) => handlers.current.onHover?.(data),
        })
        if (import.meta.env.DEV) window.__stage = ctrl.current // lets the browser tests tap the 3D board
        setReady((n) => n + 1)
      })
      .catch((err) => {
        console.warn(err)
        setFailed(true)
      })
    return () => {
      cancelled = true
      ctrl.current?.dispose()
      ctrl.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ctrl.current && state) ctrl.current.update(state)
  }, [state, ready])

  useImperativeHandle(ref, () => ({
    call: (method, ...args) => ctrl.current?.[method]?.(...args),
  }))

  return (
    <div ref={box} className="absolute inset-0" aria-label={label} role="img">
      {failed && (
        <p className="flex h-full items-center justify-center p-6 text-center text-muted">
          Tu navegador no pudo mostrar el tablero en 3D. Prueba con otro navegador o activa la aceleración por hardware.
        </p>
      )}
    </div>
  )
})

export default Stage3D
