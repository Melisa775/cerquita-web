import { useState } from 'react'

/** Tarjeta del lobby para el Pinturillo. */
export default function PinturilloCard({ send, alone }) {
  const [seconds, setSeconds] = useState(90)
  const [rounds, setRounds] = useState(2)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center border-b border-line bg-white" aria-hidden="true">
        <svg viewBox="0 0 260 90" className="h-24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M52 66 C20 44 26 18 46 22 C56 24 58 34 52 40 C46 34 48 24 58 22 C78 18 84 44 52 66 Z" stroke="#E04848" strokeWidth="5" />
          <circle cx="128" cy="40" r="20" stroke="#F2C230" strokeWidth="5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path
              key={a}
              d={`M${128 + 28 * Math.cos((a * Math.PI) / 180)} ${40 + 28 * Math.sin((a * Math.PI) / 180)} L${128 + 36 * Math.cos((a * Math.PI) / 180)} ${40 + 36 * Math.sin((a * Math.PI) / 180)}`}
              stroke="#F2C230"
              strokeWidth="5"
            />
          ))}
          <path d="M184 70 L204 30 L224 70 Z M196 70 V54 H212 V70" stroke="#3B7DC4" strokeWidth="5" />
          <path d="M14 82 C60 74 120 88 170 80 S240 76 250 82" stroke="#3E9460" strokeWidth="4" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Pinturillo</h3>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Tiempo para dibujar">
          {[60, 90, 120].map((s) => (
            <button
              key={s}
              onClick={() => setSeconds(s)}
              aria-pressed={seconds === s}
              className={`rounded-xl px-3 py-2 font-semibold ${seconds === s ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {s} s
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          Por turnos, uno dibuja y el otro adivina escribiendo. El dibujo se ve en vivo, trazo por trazo. Mientras más rápido
          adivinen, más puntos; y al final quedan todos sus dibujos.
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Rondas
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n} ({n * 2} dibujos)</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'pinturillo', drawSeconds: seconds, rounds })}
              disabled={alone}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
            >
              {alone ? 'Esperando a tu pareja' : 'Jugar'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
