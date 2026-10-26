import { useState } from 'react'

/** Tarjeta del lobby para el mini golf. */
export default function GolfCard({ send, alone }) {
  const [holes, setHoles] = useState(9)
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <svg viewBox="0 0 300 112" className="h-28 w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="300" height="112" fill="hsl(140 32% 30%)" />
        <rect x="20" y="14" width="260" height="84" rx="10" fill="hsl(112 42% 50%)" stroke="hsl(28 42% 44%)" strokeWidth="6" />
        <circle cx="210" cy="58" r="13" fill="hsl(346 70% 56%)" stroke="white" strokeWidth="3" />
        <path d="M66 74 Q130 20 196 40" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" />
        <circle cx="62" cy="76" r="6" fill="white" stroke="var(--color-p1)" strokeWidth="2.5" />
        <circle cx="252" cy="44" r="9" fill="#1d2420" />
        <line x1="253" y1="44" x2="253" y2="10" stroke="white" strokeWidth="2" />
        <path d="M254 10 l20 6 l-20 7 z" fill="hsl(2 75% 55%)" />
      </svg>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Mini golf</h3>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Hoyos">
          {[3, 6, 9].map((n) => (
            <button
              key={n}
              onClick={() => setHoles(n)}
              aria-pressed={holes === n}
              className={`rounded-xl px-2 py-2 font-semibold ${holes === n ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {n} hoyos
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          Como el de Plato: jalas hacia atrás para tirar y la bola rebota en las paredes. Nueve hoyos con bumpers, arena, agua,
          rampas y un portal. Por turnos, gana quien termine con menos golpes.
        </p>
        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'golf', holes })}
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
