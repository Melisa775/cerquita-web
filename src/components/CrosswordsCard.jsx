import { useState } from 'react'

const WORD = [['C', 3], ['E', 1], ['R', 1], ['C', 3], ['A', 1]]

/** Tarjeta del lobby para las palabras cruzadas. */
export default function CrosswordsCard({ send, alone }) {
  const [check, setCheck] = useState(true)
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-1.5" style={{ background: 'hsl(40 28% 92%)' }} aria-hidden="true">
        {WORD.map(([l, v], i) => (
          <span
            key={i}
            className="relative flex h-12 w-12 items-center justify-center rounded-lg font-display text-2xl font-extrabold"
            style={{ background: 'hsl(42 60% 86%)', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.12)', transform: `rotate(${(i - 2) * 3}deg)` }}
          >
            {l}
            <span className="absolute bottom-0.5 right-1 text-[0.6rem] font-bold">{v}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Palabras cruzadas</h3>
        <p className="mt-3 text-muted">
          Al estilo Scrabble: cada uno con siete letras, por turnos arman palabras que se cruzan en el tablero. Las casillas de
          colores multiplican la letra o la palabra, y usar las siete letras de una vez da 50 puntos extra.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Revisar las palabras con el diccionario
        </label>
        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'crosswords', check })}
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
