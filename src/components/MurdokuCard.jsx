import { useState } from 'react'
import { ROOM_COLORS, FurnitureIcon } from '../games/MurdokuGame'

// Un plano chiquito para la franja de la tarjeta
const PLAN = ['00112', '00112', '33122', '33444']
const PROPS = { '0-1': 'planta', '1-3': 'mesa', '3-4': 'estante', '2-0': 'silla' }

/** Tarjeta del lobby para Murdoku. */
export default function MurdokuCard({ send, alone }) {
  const [mode, setMode] = useState('team')
  const [level, setLevel] = useState('facil')
  const [rounds, setRounds] = useState(1)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-6 bg-ink px-4" aria-hidden="true">
        <div className="grid grid-cols-5 overflow-hidden rounded-lg border-2 border-white/80">
          {PLAN.flatMap((row, r) =>
            row.split('').map((k, c) => (
              <span key={`${r}-${c}`} className="relative h-5 w-5" style={{ background: ROOM_COLORS[Number(k)] }}>
                {PROPS[`${r}-${c}`] && <FurnitureIcon kind={PROPS[`${r}-${c}`]} />}
              </span>
            )),
          )}
        </div>
        <svg viewBox="0 0 48 48" className="h-16 w-16">
          <circle cx="20" cy="20" r="13" fill="none" stroke="white" strokeWidth="5" />
          <path d="M30 30 L42 42" stroke="white" strokeWidth="6" strokeLinecap="round" />
          <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="800" fill="white">?</text>
        </svg>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Murdoku</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo de juego">
          {[['team', 'Juntos'], ['race', 'Carrera']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`rounded-xl px-3 py-2 font-semibold ${mode === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          Sudoku con asesinato: ubiquen a los sospechosos y a la víctima en el plano, una persona por fila y por columna,
          siguiendo las pistas. El asesino es quien quedó a solas con la víctima.{' '}
          {mode === 'team' ? 'Lo resuelven juntos en el mismo plano.' : 'Cada uno en su plano: gana quien lo resuelva primero.'}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Nivel
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-xl border border-line bg-stone px-3 py-2">
                <option value="facil">Fácil · 5×5</option>
                <option value="normal">Normal · 6×6</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Casos
              <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'murdoku', mode, level, rounds })}
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
