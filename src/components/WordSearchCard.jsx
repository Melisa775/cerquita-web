import { useState } from 'react'
import { storage } from '../lib/api'

const MODE_KEY = 'cerquita:wordsearch:mode'
const BAND = ['RTLAMORPZE', 'OSUEÑOBCAN', 'MIELUNAGTD']
const LEVELS = [
  ['facil', 'Fácil · 10×10'],
  ['normal', 'Normal · 12×12'],
  ['dificil', 'Difícil · 14×14'],
]

/** Tarjeta del lobby para la Sopa de letras. */
export default function WordSearchCard({ send, alone }) {
  const [mode, setMode] = useState(() => (storage.get(MODE_KEY) === 'team' ? 'team' : 'race'))
  const [level, setLevel] = useState('normal')
  const [rounds, setRounds] = useState(1)

  function chooseMode(next) {
    setMode(next)
    storage.set(MODE_KEY, next)
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 flex-col items-center justify-center" style={{ background: 'var(--color-p2)' }} aria-hidden="true">
        {BAND.map((row, r) => (
          <div key={row} className="relative flex">
            {r === 0 && <span className="absolute inset-y-0 left-[5.25rem] w-28 rounded-full bg-white/30" />}
            {row.split('').map((ch, i) => (
              <span key={i} className="relative flex h-7 w-7 items-center justify-center font-display text-lg font-extrabold text-white">
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Sopa de letras</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo de juego">
          {[['race', 'Carrera'], ['team', 'Juntos']].map(([key, label]) => (
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
          {mode === 'race'
            ? 'La misma sopa para los dos. Cada palabra es de quien la encuentre primero, y ven en vivo por dónde está buscando el otro.'
            : 'La misma sopa para los dos y las mismas palabras: las buscan juntos contra el reloj y ven en vivo por dónde va el otro.'}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Nivel
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {LEVELS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
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
              onClick={() => send({ type: 'start_game', game: 'wordsearch', mode, level, rounds })}
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
