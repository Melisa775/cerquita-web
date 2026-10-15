import { useEffect, useState } from 'react'

/** Segundos restantes de la fase actual, a partir de lo que reporta el servidor. */
export function useCountdown(room) {
  const ms = room?.phaseEndsInMs
  const [deadline, setDeadline] = useState(null)
  const [left, setLeft] = useState(null)

  useEffect(() => {
    setDeadline(ms == null ? null : Date.now() + ms)
  }, [room, ms])

  useEffect(() => {
    if (deadline == null) {
      setLeft(null)
      return
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [deadline])

  return left
}
