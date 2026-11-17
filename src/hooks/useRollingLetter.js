import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

const POOL = 'ABCDEFGHIJLMNOPRSTUV'

/**
 * Cycles through random letters for a moment before settling on `letter`,
 * like a slot machine. Returns [letter to show, still rolling?].
 */
export function useRollingLetter(letter, enabled, duration = 750) {
  const reduce = useReducedMotion()
  const active = enabled && !reduce
  const [shown, setShown] = useState(active ? POOL[0] : letter)
  const [rolling, setRolling] = useState(active)

  useEffect(() => {
    if (!active) {
      setShown(letter)
      setRolling(false)
      return
    }
    setRolling(true)
    let i = 0
    const tick = setInterval(() => setShown(POOL[(i++ * 7 + letter.charCodeAt(0)) % POOL.length]), 70)
    const stop = setTimeout(() => {
      clearInterval(tick)
      setShown(letter)
      setRolling(false)
    }, duration)
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
  }, [letter, active, duration])

  return [shown, rolling]
}
