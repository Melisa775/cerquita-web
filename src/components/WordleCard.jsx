import { useState } from 'react'
import { storage } from '../lib/api'
import { MARK_COLORS } from '../games/WordleGame'

const MODE_KEY = 'cerquita:wordle:mode'
const BAND = [['C', 'correct'], ['E', 'absent'], ['R', 'present'], ['C', 'correct'], ['A', 'correct']]

/** Tarjeta del lobby para Wordle a dúo. */
export default function WordleCard({ send, alone }) {
  const [mode, setMode] = useState(() => (storage.get(MODE_KEY) === 'team' ? 'team' : 'duel'))
  const [length, setLength] = useState(5)
  const [rounds, setRounds] = useState(3)

  function chooseMode(next) {
    setMode(next)
    storage.set(MODE_KEY, next)
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-1.5 bg-line px-4" aria-hidden="true">
        {BAND.map(([l, mark], i) => (
          <span
            key={i}
            className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-2xl font-extrabold text-white"
            style={{ background: MARK_COLORS[mark] }}
          >
            {l}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Wordle a dúo</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo de juego">
          {[['duel', 'Duelo'], ['team', 'Juntos']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => chooseMode(key)}
              aria-pressed={mode === key}
              className={`rounded-xl px-3 py-2 font-semibold ${mode === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          {mode === 'duel'
            ? 'Los dos buscan la misma palabra en 6 intentos, cada uno en su tablero. Ven los colores del otro pero no sus letras. Gana quien la saque en menos intentos.'
            : 'Un solo tablero y 6 intentos. Se turnan para escribir y, mientras uno escribe, el otro ve las letras en vivo. ¿Cuántas sacan juntos?'}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Letras
              <select
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Rondas
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[1, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'wordle', mode, length, rounds })}
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
