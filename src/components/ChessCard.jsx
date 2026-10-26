import { useState } from 'react'
import ChessPiece from './ChessPiece'

const CONTROLS = [
  ['libre', 'Sin reloj'],
  ['3+2', '3 min + 2 s'],
  ['5+3', '5 min + 3 s'],
  ['10+0', '10 min'],
  ['15+10', '15 min + 10 s'],
]
const PREVIEW = ['r', 'n', 'b', 'q', 'K', 'B', 'N', 'R']

/** Tarjeta del lobby para el ajedrez. */
export default function ChessCard({ send, alone }) {
  const [timeControl, setTimeControl] = useState('libre')
  const [hints, setHints] = useState(true)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="grid h-28 grid-cols-8" aria-hidden="true">
        {PREVIEW.map((p, i) => (
          <div key={i} className="flex items-center justify-center p-1" style={{ background: i % 2 ? '#7C9893' : '#E8E2D4' }}>
            <ChessPiece piece={p} className="h-12 w-12" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Ajedrez</h3>
        <p className="mt-3 text-muted">
          Una partida entre los dos, con todas las reglas: enroque, captura al paso, coronación, tablas. Pueden pedirse
          deshacer una jugada, ofrecer tablas o jugar con reloj. Los colores se sortean y en la revancha se cambian.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Mostrar las jugadas posibles al tocar una pieza
        </label>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Reloj
              <select value={timeControl} onChange={(e) => setTimeControl(e.target.value)} className="rounded-xl border border-line bg-stone px-3 py-2">
                {CONTROLS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'chess', timeControl, hints })}
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
