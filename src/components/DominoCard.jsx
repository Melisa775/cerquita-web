import { useState } from 'react'
import DominoTile from './DominoTile'

/** Tarjeta del lobby para el dominó. */
export default function DominoCard({ send, alone }) {
  const [goal, setGoal] = useState(100)
  const [boneyard, setBoneyard] = useState(true)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-1" style={{ background: 'hsl(158 30% 34%)' }} aria-hidden="true">
        <DominoTile a={2} b={6} unit={26} />
        <DominoTile a={6} b={6} vertical unit={26} />
        <DominoTile a={6} b={4} unit={26} />
        <DominoTile a={4} b={1} unit={26} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Dominó</h3>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Pozo">
          {[[true, 'Con pozo'], [false, 'Sin pozo']].map(([key, label]) => (
            <button
              key={label}
              onClick={() => setBoneyard(key)}
              aria-pressed={boneyard === key}
              className={`rounded-xl px-2 py-2 font-semibold ${boneyard === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          Fichas doble seis, siete para cada uno. Pongan fichas que peguen con los extremos; gana la mano quien se quede sin
          fichas o quien tenga menos puntos si se tranca.
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-ink">{boneyard ? 'Con pozo:' : 'Sin pozo:'}</span>{' '}
          {boneyard ? 'si no tienes jugada, robas hasta poder jugar.' : 'si no tienes jugada, pasas. Más tranques, más estrategia.'}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Meta
              <select value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                {[50, 100, 150].map((n) => <option key={n} value={n}>{n} puntos</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'domino', goal, boneyard })}
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
