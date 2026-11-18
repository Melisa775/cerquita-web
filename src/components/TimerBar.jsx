import { useEffect, useState } from 'react'
import { play } from '../lib/sound'

/**
 * Bar that empties during the phase. If it mounts mid-phase (for example
 * after reconnecting), it starts from where it should be per `msLeft`.
 * It ticks in the last three seconds and sounds an alarm when time runs out
 * (unless `sound` is false).
 */
export default function TimerBar({ seconds, resetKey, msLeft, color = 'var(--color-ink)', track = 'bg-line', sound = true }) {
  return (
    <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${track}`} aria-hidden="true">
      <Fill key={resetKey} seconds={seconds} msLeft={msLeft} color={color} sound={sound} />
    </div>
  )
}

function Fill({ seconds, msLeft, color, sound }) {
  const [delay] = useState(() => (msLeft == null ? 0 : -Math.max(0, seconds - msLeft / 1000)))
  const [remaining] = useState(() => (msLeft == null ? seconds * 1000 : msLeft))

  useEffect(() => {
    if (!sound || remaining < 300) return
    const timers = [setTimeout(() => play('timeUp'), remaining)]
    for (const s of [3, 2, 1]) if (remaining > s * 1000 + 200) timers.push(setTimeout(() => play('tick'), remaining - s * 1000))
    return () => timers.forEach(clearTimeout)
  }, [sound, remaining])

  return (
    <div
      className="timer-bar h-full origin-left"
      style={{ background: color, animation: `drain ${seconds}s linear ${delay}s forwards` }}
    />
  )
}
