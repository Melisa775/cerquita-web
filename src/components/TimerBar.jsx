import { useState } from 'react'

/**
 * Bar that empties during the phase. If it mounts mid-phase (for example
 * after reconnecting), it starts from where it should be per `msLeft`.
 */
export default function TimerBar({ seconds, resetKey, msLeft, color = 'var(--color-ink)', track = 'bg-line' }) {
  return (
    <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${track}`} aria-hidden="true">
      <Fill key={resetKey} seconds={seconds} msLeft={msLeft} color={color} />
    </div>
  )
}

function Fill({ seconds, msLeft, color }) {
  const [delay] = useState(() => (msLeft == null ? 0 : -Math.max(0, seconds - msLeft / 1000)))
  return (
    <div
      className="timer-bar h-full origin-left"
      style={{ background: color, animation: `drain ${seconds}s linear ${delay}s forwards` }}
    />
  )
}
