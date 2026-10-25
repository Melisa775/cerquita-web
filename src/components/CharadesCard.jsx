import { useState } from 'react'

/** Tarjeta del lobby para Caras y gestos. */
export default function CharadesCard({ send, alone }) {
  const [level, setLevel] = useState('mezcla')
  const [seconds, setSeconds] = useState(90)
  const [rounds, setRounds] = useState(2)
  const [showCategory, setShowCategory] = useState(true)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-5" style={{ background: 'hsl(258 32% 46%)' }} aria-hidden="true">
        {/* Dos máscaras de teatro: una feliz y una triste */}
        {[1, -1].map((mood) => (
          <svg key={mood} viewBox="0 0 60 70" className="h-20" style={{ transform: `rotate(${mood * -10}deg)` }}>
            <path d="M6 8 Q30 0 54 8 Q56 40 30 66 Q4 40 6 8 Z" fill="white" />
            <path d="M15 24 q5 -5 10 0 M35 24 q5 -5 10 0" stroke="hsl(258 32% 46%)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path
              d={mood > 0 ? 'M18 40 Q30 54 42 40' : 'M18 48 Q30 36 42 48'}
              stroke="hsl(258 32% 46%)"
              strokeWidth="4.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Caras y gestos</h3>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Dificultad">
          {[['facil', 'Fácil'], ['mezcla', 'Mezcla'], ['dificil', 'Difícil']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLevel(key)}
              aria-pressed={level === key}
              className={`rounded-xl px-2 py-2 font-semibold ${level === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          Por turnos, uno actúa frente a la cámara sin hablar y el otro adivina en voz alta. Contra el reloj, todas las
          cartas que puedan: películas, animales, acciones, cosas de Colombia y algunas solo para ustedes.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCategory}
            onChange={(e) => setShowCategory(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-ink)]"
          />
          Mostrar la categoría a quien adivina
        </label>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Tiempo
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[60, 90, 120].map((n) => <option key={n} value={n}>{n} s</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Rondas
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'charades', level, seconds, rounds, showCategory })}
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
