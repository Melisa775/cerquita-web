import { useState } from 'react'

/** Tarjeta del lobby para Enredo de letras. */
export default function BoggleCard({ send, alone }) {
  const [size, setSize] = useState(4)
  const [minutes, setMinutes] = useState(3)
  const [rounds, setRounds] = useState(3)

  const selects = [
    { label: 'Minutos', value: minutes, set: setMinutes, options: [[2, '2'], [3, '3'], [4, '4']] },
    { label: 'Rondas', value: rounds, set: setRounds, options: [[1, '1'], [3, '3'], [5, '5']] },
  ]

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-2 bg-ink px-4" aria-hidden="true">
        {['E', 'N', 'R', 'E', 'D', 'O'].map((l, i) => (
          <span
            key={i}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-paper font-display text-2xl font-extrabold text-ink shadow-[0_3px_0_rgb(0_0_0/0.35)]"
            style={{ transform: `rotate(${[-6, 4, -3, 7, -5, 3][i]}deg)` }}
          >
            {l}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Enredo de letras</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Tablero">
          {[[4, 'Tablero 4×4'], [5, 'Tablero 5×5']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSize(value)}
              aria-pressed={size === value}
              className={`rounded-xl px-3 py-2 font-semibold ${size === value ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          Como Boggle: unan letras vecinas, también en diagonal, para armar todas las palabras que puedan antes de que se
          acabe el tiempo. Las que encuentren los dos no cuentan. Las palabras largas valen mucho más.
        </p>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {selects.map((s) => (
              <label key={s.label} className="flex items-center gap-2 text-sm font-semibold">
                {s.label}
                <select
                  value={s.value}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="rounded-xl border border-line bg-stone px-3 py-2"
                >
                  {s.options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                </select>
              </label>
            ))}
            <button
              onClick={() => send({ type: 'start_game', game: 'boggle', size, minutes, rounds })}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white"
            >
              {alone ? 'Practicar mientras llega' : 'Jugar'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
