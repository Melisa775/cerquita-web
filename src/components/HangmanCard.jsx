import { useState } from 'react'
import { storage } from '../lib/api'

const MODE_KEY = 'cerquita:hangman:mode'
const ROUNDS = { turns: [2, 4, 6], random: [3, 5, 10] }
const BAND = ['A', null, 'O', 'R', null, 'A', null, 'O'] // A_OR_A_O

/** Tarjeta del lobby para el Ahorcado. */
export default function HangmanCard({ send, alone }) {
  const [mode, setMode] = useState(() => (storage.get(MODE_KEY) === 'random' ? 'random' : 'turns'))
  const [lives, setLives] = useState(6)
  const [rounds, setRounds] = useState({ turns: 4, random: 5 })
  const blocked = mode === 'turns' && alone

  function chooseMode(next) {
    setMode(next)
    storage.set(MODE_KEY, next)
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-1.5 px-4" style={{ background: 'var(--color-p1)' }} aria-hidden="true">
        {BAND.map((l, i) => (
          <span
            key={i}
            className="flex h-12 w-8 items-end justify-center border-b-4 border-white/90 pb-0.5 font-display text-3xl font-extrabold text-white sm:w-9"
          >
            {l}
          </span>
        ))}
      </div>
      <div className="p-6">
        <h3 className="text-2xl font-bold">Ahorcado</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo de juego">
          {[['turns', 'Nos turnamos'], ['random', 'Cerquita elige']].map(([key, label]) => (
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
          {mode === 'turns'
            ? 'Uno escribe una palabra o frase con una pista y el otro la adivina letra por letra. Si la adivina, punto para quien adivina; si no, para quien la eligió. Se van turnando.'
            : 'Sale una palabra al azar de una categoría y la adivinan juntos, compartiendo las vidas. ¿Cuántas logran salvar?'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Vidas
            <select
              value={lives}
              onChange={(e) => setLives(Number(e.target.value))}
              className="rounded-xl border border-line bg-stone px-3 py-2"
            >
              <option value={6}>6 (clásico)</option>
              <option value={8}>8</option>
              <option value={10}>10 (con calma)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Rondas
            <select
              value={rounds[mode]}
              onChange={(e) => setRounds({ ...rounds, [mode]: Number(e.target.value) })}
              className="rounded-xl border border-line bg-stone px-3 py-2"
            >
              {ROUNDS[mode].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button
            onClick={() => send({ type: 'start_game', game: 'hangman', mode, lives, rounds: rounds[mode] })}
            disabled={blocked}
            className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {blocked ? 'Esperando a tu pareja' : alone ? 'Practicar mientras llega' : 'Jugar'}
          </button>
        </div>
      </div>
    </article>
  )
}
