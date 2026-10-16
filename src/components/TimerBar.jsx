import { useState } from 'react'

/**
 * Barra que se vacía durante la fase. Si se monta a mitad de fase (por
 * ejemplo al reconectarse), arranca desde donde va según `msLeft`.
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
