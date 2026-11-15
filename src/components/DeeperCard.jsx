import { useState } from 'react'
import { LEVELS, LEVEL_META } from '../lib/deeper'

/** Lobby card for Más cerca (question cards to connect as a couple). */
export default function DeeperCard({ send, alone }) {
  const [start, setStart] = useState('icebreaker')
  const [wildcards, setWildcards] = useState(true)
  const [letter, setLetter] = useState(true)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="relative flex h-28 items-center justify-center" style={{ background: 'hsl(250 34% 22%)' }} aria-hidden="true">
        {/* Three fanned cards, one per level */}
        {LEVELS.map((level, i) => (
          <div
            key={level}
            className="absolute flex h-20 w-14 items-end justify-center rounded-lg pb-1.5 shadow-lg"
            style={{ background: LEVEL_META[level].bg, transform: `translateX(${(i - 1) * 34}px) rotate(${(i - 1) * 11}deg)`, outline: '2px solid hsl(250 34% 22%)' }}
          >
            <span className="h-1 w-6 rounded-full bg-white/60" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Más cerca</h3>
        <p className="mt-3 text-muted">
          Cartas con preguntas para conocerse mejor y conectar de verdad. Empiezan con rompehielos y, cuando los dos
          quieran, bajan a lo profundo: empatía, introspección y lo que a veces cuesta decir. Sin puntos ni reloj.
        </p>

        <p className="mt-4 text-sm font-semibold">Empezar en</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Nivel inicial">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setStart(level)}
              aria-pressed={start === level}
              className={`rounded-xl px-2 py-2 text-sm font-semibold ${start === level ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {LEVEL_META[level].label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wildcards} onChange={(e) => setWildcards(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Incluir comodines: pequeñas acciones para hacer juntos
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={letter} onChange={(e) => setLetter(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Carta final: cada uno le escribe al otro y se leen al mismo tiempo
        </label>

        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'deeper', start, wildcards, letter })}
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
