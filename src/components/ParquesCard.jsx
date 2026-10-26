import { useState } from 'react'

const PREVIEW = ['var(--color-p1)', 'var(--color-p2)']

/** Tarjeta del lobby para el parqués. */
export default function ParquesCard({ send, alone }) {
  const [pieces, setPieces] = useState(4)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="relative flex h-28 items-center justify-center gap-6" style={{ background: 'hsl(46 60% 88%)' }} aria-hidden="true">
        {[[3, 5], [6, 6]].map(([a, b], k) => (
          <div key={k} className="flex gap-1.5" style={{ transform: `rotate(${k ? 12 : -10}deg)` }}>
            {[a, b].map((v, i) => (
              <span key={i} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-display text-xl font-extrabold shadow-sm">
                {v}
              </span>
            ))}
          </div>
        ))}
        <div className="flex gap-1.5">
          {PREVIEW.map((c, i) => (
            <span key={i} className="h-7 w-7 rounded-full" style={{ background: c, boxShadow: '0 0 0 2px white' }} />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Parqués</h3>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Fichas">
          {[[4, '4 fichas'], [2, '2 fichas, más corto']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPieces(key)}
              aria-pressed={pieces === key}
              className={`rounded-xl px-2 py-2 font-semibold ${pieces === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          El de toda la vida: se sale de la cárcel con pares, cada dado mueve por separado, se come en las casillas que no son
          seguro y al cielo se entra con el número exacto. Tercer par seguido: una ficha directo al cielo.
        </p>

        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'parques', pieces })}
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
